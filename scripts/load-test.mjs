import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

// Closed-loop, bounded HTTP workload. Only public API credentials are required.
process.loadEnvFile(process.env.LOAD_ENV_FILE || '.env.e2e');
const base = new URL(process.env.SUPABASE_URL);
const remote = !['localhost', '127.0.0.1'].includes(base.hostname);
if (remote && !process.argv.includes('--remote'))
  throw new Error(
    'Pass --remote explicitly to exercise the configured cloud project.',
  );
const sustained = process.argv.includes('--sustained');
const levels = sustained
  ? [remote ? 10 : 25]
  : remote
    ? [1, 5, 10]
    : [1, 10, 25];
const iterations = sustained ? 240 : 30;
const fixtureCount = remote ? 20 : 100;
const report = {
  startedAt: new Date().toISOString(),
  environment: remote ? 'cloud' : 'local',
  host: base.hostname,
  node: process.version,
  model: `closed-loop; ${iterations} requests per worker per stage; 150ms think time`,
  sustained,
  fixtureCount,
  thresholds: { readP95Ms: 2000, writeP95Ms: 3000, unexpectedErrors: 0 },
  stages: [],
  samples: [],
};
let fixtureId;
let manager;
let consecutiveErrors = 0;

async function settleWorkers(workers) {
  // Drain every in-flight worker before cleanup, including assertion failures.
  const results = await Promise.allSettled(workers);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
  return results.map((result) => result.value);
}

async function request(path, account, body, expected = [200], label) {
  const started = performance.now();
  let status = 0;
  let data;
  try {
    const response = await fetch(new URL(path, base), {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        ...(account ? { Authorization: `Bearer ${account.token}` } : {}),
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10_000),
    });
    status = response.status;
    const text = await response.text();
    data = text ? JSON.parse(text) : null;
  } finally {
    const ok = expected.includes(status);
    consecutiveErrors = ok ? 0 : consecutiveErrors + 1;
    if (label)
      report.samples.push({
        label,
        status,
        ok,
        ms: performance.now() - started,
      });
  }
  if (!expected.includes(status))
    throw new Error(`${label || path.split('?')[0]}: HTTP ${status}`);
  return { status, data };
}
async function login(prefix) {
  const { data } = await request('/auth/v1/token?grant_type=password', null, {
    email: process.env[`${prefix}_EMAIL`],
    password: process.env[`${prefix}_PASSWORD`],
  });
  return { token: data.access_token, id: data.user.id };
}
function rpc(name, account, body, expected = [204], label) {
  return request(`/rest/v1/rpc/${name}`, account, body, expected, label);
}
function metrics(samples, elapsedMs) {
  const sorted = samples.map((sample) => sample.ms).sort((a, b) => a - b);
  const percentile = (p) =>
    Math.round(sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] || 0);
  return {
    requests: samples.length,
    unexpectedErrors: samples.filter((sample) => !sample.ok).length,
    elapsedMs: Math.round(elapsedMs),
    requestsPerSecond: +(samples.length / (elapsedMs / 1000)).toFixed(2),
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    maxMs: Math.round(sorted.at(-1) || 0),
  };
}

try {
  manager = await login('MANAGER');
  const alice = await login('EXECUTOR');
  const bob = await login('SECOND_EXECUTOR');
  fixtureId = (
    await rpc(
      'create_object',
      manager,
      {
        p_name: `LOAD ${report.startedAt}`,
        p_address: 'Temporary performance fixture',
      },
      [200],
    )
  ).data;
  const tasks = [];
  for (let index = 0; index < fixtureCount; index++) {
    tasks.push(
      (
        await rpc(
          'create_task',
          manager,
          {
            p_title: `Load fixture ${index}`,
            p_description: 'x'.repeat(500),
            p_object_id: fixtureId,
            p_assignee_id: index % 2 ? bob.id : alice.id,
          },
          [200],
        )
      ).data,
    );
  }
  console.log(
    `Prepared ${fixtureCount} isolated tasks; starting ${report.environment} workload.`,
  );
  for (const concurrency of levels) {
    const label = `reads-${concurrency}`;
    const started = performance.now();
    await settleWorkers(
      Array.from({ length: concurrency }, async (_, worker) => {
        const account = [manager, alice, bob][worker % 3];
        for (let index = 0; index < iterations; index++) {
          if (consecutiveErrors >= 5)
            throw new Error('Stopped after five consecutive HTTP failures.');
          const table = ['objects', 'tasks', 'task_history'][index % 3];
          const filter =
            table === 'objects'
              ? `id=eq.${fixtureId}`
              : table === 'tasks'
                ? `object_id=eq.${fixtureId}`
                : `task_id=eq.${tasks[0]}`;
          const result = await request(
            `/rest/v1/${table}?select=*&${filter}`,
            account,
            undefined,
            [200],
            label,
          );
          assert.ok(Array.isArray(result.data));
          if (table === 'tasks') {
            assert.equal(
              result.data.length,
              account === manager ? fixtureCount : fixtureCount / 2,
            );
            if (account !== manager)
              assert.ok(
                result.data.every((task) => task.assignee_id === account.id),
              );
          }
          if (table === 'task_history')
            assert.equal(result.data.length, account === bob ? 0 : 1);
          await delay(150);
        }
      }),
    );
    const stage = {
      label,
      concurrency,
      ...metrics(
        report.samples.filter((sample) => sample.label === label),
        performance.now() - started,
      ),
    };
    report.stages.push(stage);
    console.log(JSON.stringify(stage));
  }
  // Independent rows exercise successful writes; the next batch contends on one row.
  const writesStarted = performance.now();
  const writeTasks = tasks.slice(1, 11);
  await settleWorkers(
    writeTasks.map(async (id, index) => {
      const account = (index + 1) % 2 ? bob : alice;
      for (const [status, version, actor] of [
        ['in_progress', 1, account],
        ['review', 2, account],
        ['accepted', 3, manager],
      ])
        await rpc(
          'transition_task',
          actor,
          { p_id: id, p_to: status, p_version: version },
          [204],
          'writes-10',
        );
      const { data: history } = await request(
        `/rest/v1/task_history?select=id&task_id=eq.${id}`,
        manager,
      );
      assert.equal(history.length, 4);
    }),
  );
  report.stages.push({
    label: 'writes-10',
    concurrency: 10,
    ...metrics(
      report.samples.filter((sample) => sample.label === 'writes-10'),
      performance.now() - writesStarted,
    ),
  });
  const raceStarted = performance.now();
  const race = await settleWorkers(
    Array.from({ length: 10 }, () =>
      rpc(
        'transition_task',
        alice,
        {
          p_id: tasks[0],
          p_to: 'in_progress',
          p_version: 1,
        },
        [204, 409],
        'race-10',
      ),
    ),
  );
  assert.equal(race.filter((response) => response.status === 204).length, 1);
  assert.equal(race.filter((response) => response.status === 409).length, 9);
  assert.equal(
    (
      await request(
        `/rest/v1/task_history?select=id&task_id=eq.${tasks[0]}`,
        manager,
      )
    ).data.length,
    2,
  );
  assert.equal(
    (await request(`/rest/v1/tasks?select=version&id=eq.${tasks[0]}`, manager))
      .data[0].version,
    2,
  );
  report.stages.push({
    label: 'race-10',
    concurrency: 10,
    ...metrics(
      report.samples.filter((sample) => sample.label === 'race-10'),
      performance.now() - raceStarted,
    ),
    successes: 1,
    expectedConflicts: 9,
    historyEvents: 2,
  });
  report.passed = report.stages.every(
    (stage) =>
      stage.unexpectedErrors === 0 &&
      stage.p95Ms <= (stage.label.startsWith('reads') ? 2000 : 3000),
  );
} catch (error) {
  report.passed = false;
  report.failure = error.message;
  console.error(error.message);
} finally {
  if (fixtureId) {
    try {
      await rpc('delete_object', manager, { p_id: fixtureId, p_version: 1 });
      assert.equal(
        (
          await request(
            `/rest/v1/tasks?select=id&object_id=eq.${fixtureId}`,
            manager,
          )
        ).data.length,
        0,
      );
      report.cleanup =
        'Temporary object/tasks soft-deleted; immutable history retained by application design.';
    } catch (error) {
      report.cleanup = `Failed for object ${fixtureId}: ${error.message}`;
      report.passed = false;
    }
  }
  report.finishedAt = new Date().toISOString();
  await mkdir('artifacts', { recursive: true });
  const output = `artifacts/load-${report.environment}${sustained ? '-sustained' : ''}.json`;
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      passed: report.passed,
      stages: report.stages,
      cleanup: report.cleanup,
      output,
    }),
  );
  if (!report.passed) process.exitCode = 1;
}

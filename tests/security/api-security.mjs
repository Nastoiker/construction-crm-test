import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createPrivateKey, sign } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { URLSearchParams } from 'node:url';

process.loadEnvFile(process.env.SECURITY_ENV_FILE || '.env.e2e');
const base = new URL(process.env.SUPABASE_URL);
const local = ['localhost', '127.0.0.1'].includes(base.hostname);
if (!local && !process.argv.includes('--remote'))
  throw new Error('Use --remote for cloud verification.');
const checks = [];
const report = {
  startedAt: new Date().toISOString(),
  environment: local ? 'local' : 'cloud',
  checks,
};
let manager;
let objectId;
async function http(path, token, body, expected = [200]) {
  const response = await fetch(new URL(path, base), {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  assert.ok(
    expected.includes(response.status),
    `${path.split('?')[0]} returned ${response.status}`,
  );
  return { status: response.status, data };
}
async function login(prefix) {
  return (
    await http('/auth/v1/token?grant_type=password', null, {
      email: process.env[`${prefix}_EMAIL`],
      password: process.env[`${prefix}_PASSWORD`],
    })
  ).data;
}
const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString());
const encode = (part) =>
  Buffer.from(JSON.stringify(part)).toString('base64url');
const rpc = (name, token, args, expected = [204]) =>
  http(`/rest/v1/rpc/${name}`, token, args, expected);
async function check(name, run) {
  await run();
  checks.push({ name, passed: true });
  console.log(`PASS ${name}`);
}
try {
  manager = await login('MANAGER');
  const alice = await login('EXECUTOR');
  const bob = await login('SECOND_EXECUTOR');
  const parts = alice.access_token.split('.');
  const claims = decode(parts[1]);
  await check(
    'Fresh tokens have a 900-second lifetime and a session id',
    async () => {
      assert.equal(claims.exp - claims.iat, 900);
      assert.ok(claims.session_id);
      assert.ok(claims.exp > Date.now() / 1000);
      await http('/rest/v1/tasks?select=id&limit=1', alice.access_token);
    },
  );
  await check('Unsigned and signature-tampered JWTs are rejected', async () => {
    const forged = `${parts[0]}.${encode({ ...claims, role: 'service_role', exp: claims.exp + 86400 })}.${parts[2]}`;
    await http('/rest/v1/tasks?select=id', forged, undefined, [401]);
    await http(
      '/rest/v1/tasks?select=id',
      `${encode({ alg: 'none', typ: 'JWT' })}.${parts[1]}.`,
      undefined,
      [401],
    );
  });
  if (local) {
    await check(
      'Correctly signed expired JWT is rejected for reads and writes',
      async () => {
        // Read ONLY the disposable local Docker signing key. Never request cloud signing keys.
        const container = JSON.parse(
          execFileSync(
            'docker',
            ['inspect', 'supabase_auth_construction-crm'],
            { encoding: 'utf8' },
          ),
        )[0];
        const entry = container.Config.Env.find((value) =>
          value.startsWith('GOTRUE_JWT_KEYS='),
        );
        const keys = JSON.parse(entry.slice('GOTRUE_JWT_KEYS='.length));
        const header = decode(parts[0]);
        const jwk = keys.find((key) => key.kid === header.kid);
        assert.equal(header.alg, 'ES256');
        const key = createPrivateKey({ key: jwk, format: 'jwk' });
        const mint = (payload) => {
          const input = `${parts[0]}.${encode(payload)}`;
          const signature = sign('sha256', Buffer.from(input), {
            key,
            dsaEncoding: 'ieee-p1363',
          }).toString('base64url');
          return `${input}.${signature}`;
        };
        // Positive control proves the same signer is accepted, rather than all tokens failing signature validation.
        await http('/rest/v1/tasks?select=id&limit=1', mint(claims));
        const expired = mint({
          ...claims,
          iat: claims.iat - 1800,
          exp: claims.iat - 900,
        });
        const read = await http(
          '/rest/v1/tasks?select=id',
          expired,
          undefined,
          [401],
        );
        assert.match(read.data.message, /expired/i);
        await rpc(
          'create_object',
          expired,
          { p_name: 'Must not exist', p_address: 'Forbidden' },
          [401],
        );
      },
    );
  } else
    report.expiryVerification =
      'Cloud: verified issued TTL; correctly signed expired-token rejection tested only on local Supabase.';

  objectId = (
    await rpc(
      'create_object',
      manager.access_token,
      {
        p_name: `Security ${Date.now()}`,
        p_address: 'Isolated API verification',
      },
      [200],
    )
  ).data;
  const payloads = [
    "' OR '1'='1",
    "x'); SELECT current_user; --",
    '<img src=x onerror=alert(1)>',
  ];
  let taskId;
  await check(
    'SQL metacharacters remain literal text through RPC and REST equality filters',
    async () => {
      for (const payload of payloads) {
        taskId = (
          await rpc(
            'create_task',
            manager.access_token,
            {
              p_title: payload,
              p_description: payload,
              p_object_id: objectId,
              p_assignee_id: alice.user.id,
            },
            [200],
          )
        ).data;
        const task = (
          await http(
            `/rest/v1/tasks?select=title,description&id=eq.${taskId}`,
            manager.access_token,
          )
        ).data;
        assert.deepEqual(task, [{ title: payload, description: payload }]);
        const filter = new URLSearchParams({
          select: 'id',
          title: `eq.${payload}`,
          object_id: `eq.${objectId}`,
        });
        assert.equal(
          (await http(`/rest/v1/tasks?${filter}`, alice.access_token)).data
            .length,
          1,
        );
        assert.deepEqual(
          (await http(`/rest/v1/tasks?${filter}`, bob.access_token)).data,
          [],
        );
      }
    },
  );
  await check(
    'Injection into a typed UUID argument is rejected without changing data',
    async () => {
      await rpc(
        'update_task',
        manager.access_token,
        {
          p_id: `${taskId}' OR '1'='1`,
          p_title: 'Must not change',
          p_description: '',
          p_assignee_id: alice.user.id,
          p_version: 1,
        },
        [400],
      );
      const task = (
        await http(
          `/rest/v1/tasks?select=title,version&id=eq.${taskId}`,
          manager.access_token,
        )
      ).data;
      assert.deepEqual(task, [{ title: payloads.at(-1), version: 1 }]);
    },
  );
  await check(
    'Metadata role spoofing cannot grant manager privileges',
    async () => {
      const response = await fetch(new URL('/auth/v1/user', base), {
        method: 'PUT',
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${alice.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: { role: 'manager' } }),
        signal: AbortSignal.timeout(10_000),
      });
      assert.equal(response.status, 200);
      try {
        await rpc(
          'create_object',
          alice.access_token,
          { p_name: 'Forbidden', p_address: 'Forbidden' },
          [403],
        );
        assert.deepEqual(
          (
            await http(
              `/rest/v1/profiles?select=role&id=eq.${alice.user.id}`,
              alice.access_token,
            )
          ).data,
          [{ role: 'executor' }],
        );
      } finally {
        const restore = await fetch(new URL('/auth/v1/user', base), {
          method: 'PUT',
          headers: {
            apikey: process.env.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${alice.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: { role: alice.user.user_metadata?.role ?? null },
          }),
          signal: AbortSignal.timeout(10_000),
        });
        assert.equal(restore.status, 200);
      }
    },
  );
  await check(
    'Refresh rotates tokens; logout invalidates the refresh token for that session',
    async () => {
      const rotated = (
        await http(
          '/auth/v1/token?grant_type=refresh_token',
          bob.access_token,
          { refresh_token: bob.refresh_token },
        )
      ).data;
      assert.notEqual(rotated.refresh_token, bob.refresh_token);
      await http('/rest/v1/tasks?select=id&limit=1', rotated.access_token);
      await http(
        '/auth/v1/logout?scope=local',
        rotated.access_token,
        {},
        [204],
      );
      await http(
        '/auth/v1/token?grant_type=refresh_token',
        null,
        { refresh_token: rotated.refresh_token },
        [400, 401],
      );
    },
  );
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error.message;
  console.error(error.message);
} finally {
  if (objectId) {
    try {
      await rpc('delete_object', manager.access_token, {
        p_id: objectId,
        p_version: 1,
      });
      report.cleanup = true;
    } catch (error) {
      report.cleanup = false;
      report.passed = false;
      console.error(error.message);
    }
  }
  report.finishedAt = new Date().toISOString();
  await mkdir('artifacts', { recursive: true });
  await writeFile(
    `artifacts/security-${local ? 'local' : 'cloud'}.json`,
    JSON.stringify(report, null, 2),
  );
  if (!report.passed) process.exitCode = 1;
}

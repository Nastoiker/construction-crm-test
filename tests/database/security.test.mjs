import { before, after, beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL engine in WASM. Only the Supabase Auth boundary is stubbed.
const db = new PGlite();
const manager = '00000000-0000-4000-8000-000000000001';
const alice = '00000000-0000-4000-8000-000000000002';
const bob = '00000000-0000-4000-8000-000000000003';
const secondManager = '00000000-0000-4000-8000-000000000004';
const objectId = '10000000-0000-4000-8000-000000000001';
const emptyObject = '10000000-0000-4000-8000-000000000002';
const taskId = '20000000-0000-4000-8000-000000000001';
const foreignTask = '20000000-0000-4000-8000-000000000002';
const statuses = ['new', 'in_progress', 'review', 'accepted', 'rework'];

before(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to public;
  `);
  await db.exec(
    await readFile(
      new URL(
        '../../supabase/migrations/202611030001_crm.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(`
    insert into auth.users values ('${manager}'), ('${alice}'), ('${bob}'), ('${secondManager}');
    insert into public.profiles values ('${manager}', 'Manager', 'manager'), ('${alice}', 'Alice', 'executor'), ('${bob}', 'Bob', 'executor'), ('${secondManager}', 'Manager 2', 'manager');
    insert into public.objects(id,name,address,created_by) values ('${objectId}','Object','Address','${manager}'), ('${emptyObject}','Empty','Address','${manager}');
    insert into public.tasks(id,title,object_id,assignee_id,author_id) values ('${taskId}','Alice task','${objectId}','${alice}','${manager}'), ('${foreignTask}','Bob task','${objectId}','${bob}','${manager}');
    insert into public.task_history(task_id,actor_id,to_status) values ('${taskId}','${manager}','new'), ('${foreignTask}','${manager}','new');
  `);
});
after(() => db.close());
beforeEach(() => db.exec('begin'));
afterEach(() => db.exec('rollback'));

async function asUser(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
  await db.exec('set local role authenticated');
}
async function denied(sql, params = []) {
  await db.exec('savepoint denied_action');
  await assert.rejects(() => db.query(sql, params));
  await db.exec('rollback to savepoint denied_action');
}
async function transition(to, version = 1, comment = null, id = taskId) {
  return db.query('select public.transition_task($1,$2,$3,$4)', [
    id,
    to,
    version,
    comment,
  ]);
}

test('executor reads only own tasks, their history and related objects', async () => {
  await asUser(alice);
  assert.deepEqual((await db.query('select id from public.tasks')).rows, [
    { id: taskId },
  ]);
  assert.deepEqual((await db.query('select id from public.objects')).rows, [
    { id: objectId },
  ]);
  assert.equal(
    (await db.query('select * from public.task_history')).rows.length,
    1,
  );
  assert.equal(
    (await db.query('select * from public.tasks where id = $1', [foreignTask]))
      .rows.length,
    0,
  );
});

test('each manager sees all objects and tasks', async () => {
  for (const id of [manager, secondManager]) {
    await asUser(id);
    assert.equal((await db.query('select * from public.tasks')).rows.length, 2);
    assert.equal(
      (await db.query('select * from public.objects')).rows.length,
      2,
    );
  }
});

test('anonymous user cannot read tables or execute writes', async () => {
  await db.exec('set local role anon');
  await denied('select * from public.tasks');
  await denied('select * from public.objects');
  await denied('select * from public.profiles');
  await denied("select public.create_object('Name','Address')");
  await denied('select public.transition_task($1,$2,$3)', [
    taskId,
    'in_progress',
    1,
  ]);
});

test('no API role can insert, edit or delete history or bypass task RPCs', async () => {
  for (const id of [alice, manager]) {
    await asUser(id);
    await denied("update public.tasks set status = 'accepted'");
    await denied('update public.tasks set assignee_id = $1', [alice]);
    await denied('delete from public.tasks');
    await denied(
      "insert into public.tasks(title,object_id,assignee_id,author_id) values ('Fake',$1,$2,$3)",
      [objectId, alice, manager],
    );
    await denied(
      "insert into public.task_history(task_id,actor_id,to_status) values ($1,$2,'accepted')",
      [taskId, manager],
    );
    await denied("update public.task_history set comment = 'forged'");
    await denied('delete from public.task_history');
    await denied("update public.profiles set role = 'manager' where id = $1", [
      alice,
    ]);
  }
});

test('executor cannot call manager mutations or operate on foreign task', async () => {
  await asUser(alice);
  await denied("select public.create_object('Fake','Address')");
  await denied("select public.update_object($1,'Fake','Address',1)", [
    objectId,
  ]);
  await denied('select public.delete_object($1,1)', [objectId]);
  await denied("select public.create_task('Fake','',$1,$2)", [objectId, alice]);
  await denied("select public.update_task($1,'Fake','',$2,1)", [taskId, alice]);
  await denied('select public.delete_task($1,1)', [taskId]);
  await denied('select public.transition_task($1,$2,1)', [
    foreignTask,
    'in_progress',
  ]);
});

for (const role of ['manager', 'executor']) {
  for (const from of statuses) {
    for (const to of statuses) {
      const allowed =
        role === 'manager'
          ? from === 'review' && ['accepted', 'rework'].includes(to)
          : (['new', 'rework'].includes(from) && to === 'in_progress') ||
            (from === 'in_progress' && to === 'review');
      test(`${role}: ${from} -> ${to} ${allowed ? 'allowed' : 'denied'}`, async () => {
        await db.query('update public.tasks set status = $1 where id = $2', [
          from,
          taskId,
        ]);
        await asUser(role === 'manager' ? manager : alice);
        if (!allowed) {
          await denied('select public.transition_task($1,$2,1,$3)', [
            taskId,
            to,
            'Reason',
          ]);
          assert.equal(
            (
              await db.query('select status from public.tasks where id = $1', [
                taskId,
              ])
            ).rows[0].status,
            from,
          );
          assert.equal(
            (
              await db.query(
                'select * from public.task_history where task_id = $1',
                [taskId],
              )
            ).rows.length,
            1,
          );
        } else {
          await transition(to, 1, 'Reason');
          const task = (
            await db.query(
              'select status,version from public.tasks where id = $1',
              [taskId],
            )
          ).rows[0];
          assert.deepEqual(task, { status: to, version: 2 });
          const history = (
            await db.query(
              'select * from public.task_history where task_id = $1 order by created_at',
              [taskId],
            )
          ).rows;
          assert.equal(history.length, 2);
          assert.equal(
            history[1].actor_id,
            role === 'manager' ? manager : alice,
          );
          assert.equal(history[1].from_status, from);
          assert.equal(history[1].to_status, to);
          assert.equal(history[1].comment, 'Reason');
        }
      });
    }
  }
}

test('rework requires a nonblank comment and invalid input is atomic', async () => {
  await db.query("update public.tasks set status = 'review' where id = $1", [
    taskId,
  ]);
  await asUser(manager);
  for (const comment of [null, '', '   ', 'a'.repeat(2001)]) {
    await denied('select public.transition_task($1,$2,1,$3)', [
      taskId,
      'rework',
      comment,
    ]);
  }
  assert.equal(
    (
      await db.query('select * from public.task_history where task_id = $1', [
        taskId,
      ])
    ).rows.length,
    1,
  );
});

test('optimistic version prevents duplicate transitions and stale edits', async () => {
  await asUser(alice);
  await transition('in_progress');
  await denied('select public.transition_task($1,$2,1)', [taskId, 'review']);
  await denied('select public.transition_task($1,$2,null)', [taskId, 'review']);
  await asUser(manager);
  await denied("select public.update_task($1,'Stale','',$2,1)", [taskId, bob]);
  await denied('select public.delete_task($1,1)', [taskId]);
});

test('manager CRUD, reassignment and creation history preserve author', async () => {
  await asUser(secondManager);
  const created = (
    await db.query(
      "select public.create_task('New task','Description',$1,$2) as id",
      [objectId, alice],
    )
  ).rows[0].id;
  await db.query("select public.update_task($1,'Edited','Updated',$2,1)", [
    created,
    bob,
  ]);
  const row = (
    await db.query('select * from public.tasks where id = $1', [created])
  ).rows[0];
  assert.equal(row.author_id, secondManager);
  assert.equal(row.assignee_id, bob);
  assert.equal(row.status, 'new');
  const history = (
    await db.query('select * from public.task_history where task_id = $1', [
      created,
    ])
  ).rows;
  assert.equal(history.length, 1);
  assert.equal(history[0].from_status, null);
  await asUser(alice);
  assert.equal(
    (await db.query('select * from public.tasks where id = $1', [created])).rows
      .length,
    0,
  );
  await asUser(bob);
  assert.equal(
    (await db.query('select * from public.tasks where id = $1', [created])).rows
      .length,
    1,
  );
});

test('soft deletion hides object and tasks but preserves immutable audit records', async () => {
  await asUser(manager);
  await db.query('select public.delete_object($1,1)', [objectId]);
  assert.equal((await db.query('select * from public.tasks')).rows.length, 0);
  assert.equal(
    (await db.query('select * from public.task_history')).rows.length,
    0,
  );
  await denied("select public.create_task('Orphan','',$1,$2)", [
    objectId,
    alice,
  ]);
  await db.exec('reset role');
  assert.equal(
    (await db.query('select * from public.task_history')).rows.length,
    2,
  );
  assert.equal(
    (await db.query('select * from public.tasks where deleted_at is not null'))
      .rows.length,
    2,
  );
});

test('invalid assignees and blank fields fail database validation', async () => {
  await asUser(manager);
  await denied("select public.create_task('Task','',$1,$2)", [
    objectId,
    manager,
  ]);
  await denied("select public.create_task('  ','',$1,$2)", [objectId, alice]);
  await denied("select public.create_object('  ','Address')");
  await denied("select public.create_object('Name','  ')");
  await denied('select public.transition_task($1,null,1)', [taskId]);
});

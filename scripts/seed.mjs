import { createClient } from '@supabase/supabase-js';

function env(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}
const url = env('SUPABASE_URL');
if (
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) &&
  !process.argv.includes('--remote')
) {
  throw new Error('Remote seed requires an explicit --remote argument.');
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), options);
function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}
const accounts = [
  {
    email: env('MANAGER_EMAIL'),
    password: env('MANAGER_PASSWORD'),
    name: 'Алексей Смирнов',
    role: 'manager',
  },
  {
    email: env('EXECUTOR_EMAIL'),
    password: env('EXECUTOR_PASSWORD'),
    name: 'Анна Волкова',
    role: 'executor',
  },
  {
    email: env('SECOND_EXECUTOR_EMAIL'),
    password: env('SECOND_EXECUTOR_PASSWORD'),
    name: 'Иван Петров',
    role: 'executor',
  },
];
const existing = unwrap(
  await admin.auth.admin.listUsers({ perPage: 1000 }),
).users;
for (const account of accounts) {
  const previous = existing.find((user) => user.email === account.email);
  const user = previous
    ? unwrap(
        await admin.auth.admin.updateUserById(previous.id, {
          password: account.password,
          email_confirm: true,
        }),
      ).user
    : unwrap(
        await admin.auth.admin.createUser({
          email: account.email,
          password: account.password,
          email_confirm: true,
        }),
      ).user;
  account.id = user.id;
  unwrap(
    await admin
      .from('profiles')
      .upsert({ id: user.id, display_name: account.name, role: account.role }),
  );
  account.client = createClient(url, env('SUPABASE_ANON_KEY'), options);
  unwrap(
    await account.client.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    }),
  );
}
const [manager, alice, bob] = accounts;
const objects = unwrap(
  await manager.client.from('objects').select('id').limit(1),
);
if (objects.length) {
  console.log(
    'Accounts updated; existing objects retained. Seed data was not duplicated.',
  );
  process.exit(0);
}
async function object(name, address) {
  return unwrap(
    await manager.client.rpc('create_object', {
      p_name: name,
      p_address: address,
    }),
  );
}
async function task(title, description, objectId, assignee, target) {
  const id = unwrap(
    await manager.client.rpc('create_task', {
      p_title: title,
      p_description: description,
      p_object_id: objectId,
      p_assignee_id: assignee.id,
    }),
  );
  const path = {
    new: [],
    in_progress: ['in_progress'],
    review: ['in_progress', 'review'],
    accepted: ['in_progress', 'review', 'accepted'],
    rework: ['in_progress', 'review', 'rework'],
  }[target];
  let version = 1;
  for (const status of path) {
    const client = ['accepted', 'rework'].includes(status)
      ? manager.client
      : assignee.client;
    unwrap(
      await client.rpc('transition_task', {
        p_id: id,
        p_to: status,
        p_version: version++,
        p_comment:
          status === 'rework'
            ? 'Проверьте примыкания и приложите результат повторного осмотра.'
            : null,
      }),
    );
  }
}
const riverside = await object(
  'ЖК «Речной квартал»',
  'Астрахань, Набережная Приволжского затона, 12',
);
const school = await object(
  'Школа на 800 мест',
  'Астрахань, ул. Николая Островского, 146',
);
const office = await object(
  'Бизнес-центр «Горизонт»',
  'Астрахань, ул. Адмиралтейская, 28',
);
await task(
  'Проверить армирование перекрытия',
  'Проверить шаг арматуры и защитный слой перед бетонированием секции А.',
  riverside,
  alice,
  'new',
);
await task(
  'Подготовить исполнительную схему',
  'Подготовить схему выполненных работ по первому этажу.',
  riverside,
  alice,
  'in_progress',
);
await task(
  'Осмотреть гидроизоляцию',
  'Проверить примыкания гидроизоляции в подземном паркинге.',
  riverside,
  bob,
  'rework',
);
await task(
  'Проверить монтаж окон',
  'Осмотреть оконные блоки и монтажные швы на втором этаже.',
  school,
  alice,
  'review',
);
await task(
  'Принять кладку перегородок',
  'Сверить геометрию и расположение дверных проёмов с проектом.',
  school,
  bob,
  'accepted',
);
await task(
  'Подготовить площадку под разгрузку',
  'Обозначить зону разгрузки и проверить подъездные пути.',
  office,
  bob,
  'new',
);
console.log(
  'Seed complete: 3 accounts, 3 objects, 6 tasks across all 5 statuses.',
);

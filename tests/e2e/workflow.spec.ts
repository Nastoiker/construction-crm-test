import { test, expect } from '@playwright/test';
import { signIn, signOut, api, required } from './helpers';
import { createClient } from '@supabase/supabase-js';

test('unauthenticated routes redirect; login validation and wrong password', async ({
  page,
}) => {
  await page.goto('/objects');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByText('Введите корректный email')).toBeVisible();
  await expect(page.getByText('Введите пароль', { exact: true })).toBeVisible();
  await page
    .getByLabel('Email', { exact: true })
    .fill(required('MANAGER_EMAIL'));
  await page.getByLabel('Пароль', { exact: true }).fill('incorrect-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByText('Неверный email или пароль.')).toBeVisible();
});

test('full lifecycle, rework reason, persistent history, reassignment and delete', async ({
  page,
}) => {
  const suffix = `${Date.now()}`;
  const objectName = `Тестовый объект ${suffix}`;
  const taskName = `Проверка перекрытий ${suffix}`;
  await signIn(page, 'MANAGER');
  await page.getByRole('button', { name: 'Новый объект', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить объект' }).click();
  await expect(
    page.getByText('Введите название', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Название объекта').fill(objectName);
  await page
    .getByLabel('Адрес', { exact: true })
    .fill('Астрахань, Тестовая, 7');
  await page.getByRole('button', { name: 'Сохранить объект' }).click();
  await page.getByRole('link').filter({ hasText: objectName }).click();
  const objectUrl = page.url();
  await page.getByRole('button', { name: 'Новая задача', exact: true }).click();
  await page.getByLabel('Название задачи').fill(taskName);
  await page
    .getByLabel('Описание', { exact: true })
    .fill('Проверить качество работ');
  await page
    .getByLabel('Исполнитель', { exact: true })
    .selectOption({ label: 'Анна Волкова' });
  await page.getByRole('button', { name: 'Сохранить задачу' }).click();
  await page.getByRole('link').filter({ hasText: taskName }).click();
  const taskUrl = page.url();
  await expect(page.getByText('Создана → Новая')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Взять в работу' }),
  ).toHaveCount(0);
  await signOut(page);

  await signIn(page, 'SECOND_EXECUTOR');
  await page.goto(taskUrl);
  await expect(
    page.getByRole('heading', { name: 'Задача недоступна' }),
  ).toBeVisible();
  await page.goto(objectUrl);
  await expect(
    page.getByRole('heading', { name: 'Объект недоступен' }),
  ).toBeVisible();
  await signOut(page);

  await signIn(page, 'EXECUTOR');
  await page.getByRole('link', { name: 'Мои задачи' }).click();
  await page.getByRole('link').filter({ hasText: taskName }).click();
  await expect(page.getByRole('button', { name: 'Редактировать' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Взять в работу' }).click();
  await page.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(
    page.getByText('Задача ожидает решения постановщика.'),
  ).toBeVisible();
  await signOut(page);

  await signIn(page, 'MANAGER');
  await page.goto(taskUrl);
  await page.getByRole('button', { name: 'Вернуть на доработку' }).click();
  await expect(
    page.getByText('Укажите причину доработки', { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Комментарий (обязателен для доработки)')
    .fill('Исправить примыкание у колонны');
  await page.getByRole('button', { name: 'Вернуть на доработку' }).click();
  await expect(page.getByText('Исправить примыкание у колонны')).toBeVisible();
  await signOut(page);

  await signIn(page, 'EXECUTOR');
  await page.goto(taskUrl);
  await page.getByRole('button', { name: 'Взять в работу' }).click();
  await page.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(
    page.getByText('Задача ожидает решения постановщика.'),
  ).toBeVisible();
  await signOut(page);

  await signIn(page, 'MANAGER');
  await page.goto(taskUrl);
  await page.getByRole('button', { name: 'Принять задачу' }).click();
  await expect(
    page.getByText('Задача принята. Работа завершена.'),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('Исправить примыкание у колонны')).toBeVisible();
  await expect(page.getByRole('list').getByRole('listitem')).toHaveCount(7);
  await page.getByRole('button', { name: 'Редактировать' }).click();
  await page.getByLabel('Название задачи').fill(`${taskName} — готово`);
  await page
    .getByLabel('Исполнитель', { exact: true })
    .selectOption({ label: 'Иван Петров' });
  await page.getByRole('button', { name: 'Сохранить задачу' }).click();
  await expect(
    page.getByRole('heading', { name: `${taskName} — готово` }),
  ).toBeVisible();
  await signOut(page);
  await signIn(page, 'EXECUTOR');
  await page.goto(taskUrl);
  await expect(
    page.getByRole('heading', { name: 'Задача недоступна' }),
  ).toBeVisible();
  await signOut(page);
  await signIn(page, 'SECOND_EXECUTOR');
  await page.goto(taskUrl);
  await expect(
    page.getByText('Задача принята. Работа завершена.'),
  ).toBeVisible();
  await signOut(page);
  await signIn(page, 'MANAGER');
  await page.goto(taskUrl);
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: `${taskName} — готово` }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.getByRole('button', { name: 'Подтвердить удаление' }).click();
  await expect(page).toHaveURL(objectUrl);
  await page.getByRole('button', { name: 'Редактировать' }).click();
  await page.getByLabel('Название объекта').fill(`${objectName} — архив`);
  await page.getByRole('button', { name: 'Сохранить объект' }).click();
  await expect(
    page.getByRole('heading', { name: `${objectName} — архив` }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.getByRole('button', { name: 'Подтвердить удаление' }).click();
  await expect(page).toHaveURL(/\/objects$/);
  await expect(
    page.getByRole('link').filter({ hasText: objectName }),
  ).toHaveCount(0);
});

test('direct Supabase API enforces RLS, RPC permissions, audit protection and disabled signup', async () => {
  const manager = await api('MANAGER');
  const alice = await api('EXECUTOR');
  const bob = await api('SECOND_EXECUTOR');
  const { data: auth } = await alice.auth.getUser();
  const aliceId = auth.user!.id;
  const { data: tasks, error } = await manager
    .from('tasks')
    .select('*')
    .eq('assignee_id', aliceId);
  expect(error).toBeNull();
  expect(tasks!.length).toBeGreaterThan(0);
  const task = tasks![0];
  const foreign = await bob.from('tasks').select('*').eq('id', task.id);
  expect(foreign.error).toBeNull();
  expect(foreign.data).toEqual([]);
  expect(
    (await bob.from('task_history').select('*').eq('task_id', task.id)).data,
  ).toEqual([]);
  expect(
    (
      await bob.rpc('transition_task', {
        p_id: task.id,
        p_to: 'in_progress',
        p_version: task.version,
      })
    ).error,
  ).not.toBeNull();
  expect(
    (await alice.from('tasks').update({ status: 'accepted' }).eq('id', task.id))
      .error,
  ).not.toBeNull();
  expect(
    (await alice.from('profiles').update({ role: 'manager' }).eq('id', aliceId))
      .error,
  ).not.toBeNull();
  expect(
    (
      await alice.rpc('create_object', {
        p_name: 'Forged',
        p_address: 'Address',
      })
    ).error,
  ).not.toBeNull();
  expect(
    (
      await manager
        .from('task_history')
        .insert({ task_id: task.id, actor_id: aliceId, to_status: 'accepted' })
    ).error,
  ).not.toBeNull();
  expect(
    (await manager.from('task_history').delete().eq('task_id', task.id)).error,
  ).not.toBeNull();
  const anonymous = createClient(
    required('SUPABASE_URL'),
    required('SUPABASE_ANON_KEY'),
    { auth: { persistSession: false } },
  );
  expect((await anonymous.from('tasks').select('*')).error).not.toBeNull();
  const signup = await anonymous.auth.signUp({
    email: `forbidden-${Date.now()}@crm.test`,
    password: 'Never-Allowed-2026!',
  });
  expect(signup.error).not.toBeNull();
  expect(signup.data.user).toBeNull();
});

test('mobile layout, task filters, empty search and keyboard navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, 'EXECUTOR');
  await page.getByLabel('Поиск объектов').fill('Несуществующий объект');
  await expect(
    page.getByRole('heading', { name: 'Ничего не найдено' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Мои задачи' }).click();
  await page.getByLabel('Фильтр по статусу').selectOption('accepted');
  await expect(
    page.getByRole('heading', { name: 'Задач пока нет' }),
  ).toBeVisible();
  await page.getByLabel('Фильтр по статусу').selectOption('new');
  await expect(
    page
      .getByRole('link')
      .filter({ hasText: 'Проверить армирование перекрытия' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Выйти', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Войти', exact: true }),
  ).toBeVisible();
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn, api } from './helpers';

test('network failure has a recoverable error state', async ({ page }) => {
  await signIn(page, 'MANAGER');
  await page.route('**/rest/v1/objects?*', (route) => route.abort('failed'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Нет связи с сервером');
  await page.unroute('**/rest/v1/objects?*');
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(
    page.getByRole('link').filter({ hasText: 'ЖК «Речной квартал»' }),
  ).toBeVisible();
});

test('stale task transition is rejected, refreshed, and does not duplicate history', async ({
  page,
}) => {
  const manager = await api('MANAGER');
  const executor = await api('EXECUTOR');
  const { data: user } = await executor.auth.getUser();
  const { data: objects } = await manager.from('objects').select('id').limit(1);
  const { data: id, error } = await manager.rpc('create_task', {
    p_title: `Concurrent task ${Date.now()}`,
    p_description: '',
    p_object_id: objects![0].id,
    p_assignee_id: user.user!.id,
  });
  expect(error).toBeNull();
  try {
    await signIn(page, 'EXECUTOR');
    await page.goto(`tasks/${id}`);
    await expect(
      page.getByRole('button', { name: 'Взять в работу' }),
    ).toBeVisible();
    expect(
      (
        await executor.rpc('transition_task', {
          p_id: id,
          p_to: 'in_progress',
          p_version: 1,
        })
      ).error,
    ).toBeNull();
    await page.getByRole('button', { name: 'Взять в работу' }).click();
    await expect(page.getByRole('alert')).toContainText('Задача изменена');
    await expect(
      page.getByRole('button', { name: 'Отправить на проверку' }),
    ).toBeVisible();
    expect(
      (await executor.from('task_history').select('id').eq('task_id', id)).data,
    ).toHaveLength(2);
  } finally {
    const { data: task } = await manager
      .from('tasks')
      .select('version')
      .eq('id', id)
      .single();
    await manager.rpc('delete_task', { p_id: id, p_version: task!.version });
  }
});

test('login, objects and task views have no serious accessibility issues', async ({
  page,
}) => {
  await page.goto('login');
  let audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({
    path: 'artifacts/login-desktop.png',
    fullPage: true,
  });
  await signIn(page, 'MANAGER');
  audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({
    path: 'artifacts/objects-desktop.png',
    fullPage: true,
  });
  await page
    .getByRole('link')
    .filter({ hasText: 'ЖК «Речной квартал»' })
    .click();
  await page
    .getByRole('link')
    .filter({ hasText: 'Осмотреть гидроизоляцию' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'История задачи' }),
  ).toBeVisible();
  audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: 'artifacts/task-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/task-mobile.png', fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('background refresh preserves draft and cannot bypass optimistic edit version', async ({
  page,
}) => {
  const manager = await api('MANAGER');
  const executor = await api('EXECUTOR');
  const { data: user } = await executor.auth.getUser();
  const { data: objects } = await manager.from('objects').select('id').limit(1);
  const { data: id, error } = await manager.rpc('create_task', {
    p_title: `Edit conflict ${Date.now()}`,
    p_description: '',
    p_object_id: objects![0].id,
    p_assignee_id: user.user!.id,
  });
  expect(error).toBeNull();
  try {
    await page.clock.install();
    await signIn(page, 'MANAGER');
    await page.goto(`tasks/${id}`);
    await page.getByRole('button', { name: 'Редактировать' }).click();
    await page.getByLabel('Название задачи').fill('Мой несохранённый черновик');
    expect(
      (
        await manager.rpc('update_task', {
          p_id: id,
          p_title: 'Правки другого постановщика',
          p_description: 'Новое описание',
          p_assignee_id: user.user!.id,
          p_version: 1,
        })
      ).error,
    ).toBeNull();
    await page.clock.fastForward(16_000);
    await page.evaluate(() =>
      window.dispatchEvent(new Event('visibilitychange')),
    );
    await expect(
      page.getByRole('heading', {
        name: 'Правки другого постановщика',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByLabel('Название задачи')).toHaveValue(
      'Мой несохранённый черновик',
    );
    await page.getByRole('button', { name: 'Сохранить задачу' }).click();
    await expect(page.getByRole('alert')).toContainText('Задача изменена');
    const { data: task } = await manager
      .from('tasks')
      .select('title, description, version')
      .eq('id', id)
      .single();
    expect(task).toEqual({
      title: 'Правки другого постановщика',
      description: 'Новое описание',
      version: 2,
    });
  } finally {
    const { data: task } = await manager
      .from('tasks')
      .select('version')
      .eq('id', id)
      .single();
    await manager.rpc('delete_task', { p_id: id, p_version: task!.version });
  }
});

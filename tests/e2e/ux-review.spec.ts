import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { api, signIn } from './helpers';

test('review: narrow screens and long content preserve readable controls and dialog focus', async ({
  page,
}) => {
  const manager = await api('MANAGER');
  const executor = await api('EXECUTOR');
  const user = (await executor.auth.getUser()).data.user!;
  const title = `UX ${'ДлинноеНазвание'.repeat(9)}`;
  const { data: objectId, error } = await manager.rpc('create_object', {
    p_name: title,
    p_address: 'АдресБезПробелов'.repeat(10),
  });
  expect(error).toBeNull();
  try {
    const { data: taskId, error: taskError } = await manager.rpc(
      'create_task',
      {
        p_title: title,
        p_description: 'ОписаниеБезПробелов'.repeat(30),
        p_object_id: objectId,
        p_assignee_id: user.id,
      },
    );
    expect(taskError).toBeNull();
    await signIn(page, 'MANAGER');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        'objects',
        `objects/${objectId}`,
        `tasks/${taskId}`,
      ]) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect
          .soft(overflow, `${path} at ${width}px must not scroll horizontally`)
          .toBeLessThanOrEqual(1);
        await page.screenshot({
          path: `artifacts/ux-${width}-${path.split('/')[0]}${path.includes('/') ? '-detail' : ''}.png`,
          fullPage: true,
        });
      }
    }
    await page.setViewportSize({ width: 320, height: 700 });
    await page.getByRole('button', { name: 'Удалить', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Отмена' })).toBeFocused();
    const fits = await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.left >= 0 &&
        bounds.right <= window.innerWidth &&
        element.scrollWidth <= element.clientWidth
      );
    });
    expect
      .soft(fits, 'Delete confirmation and buttons fit at 320px')
      .toBe(true);
    await page.screenshot({
      path: 'artifacts/ux-delete-320.png',
      fullPage: true,
    });
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect.soft(audit.violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Удалить', exact: true }),
    ).toBeFocused();
    await page.getByRole('button', { name: 'Редактировать' }).click();
    await page.getByLabel('Название задачи').fill('');
    await page.getByRole('button', { name: 'Сохранить задачу' }).click();
    await expect(page.getByLabel('Название задачи')).toBeFocused();
    await expect
      .soft(page.getByLabel('Название задачи'))
      .toHaveAccessibleDescription('Введите название');
  } finally {
    const cleanup = await manager.rpc('delete_object', {
      p_id: objectId,
      p_version: 1,
    });
    expect(cleanup.error).toBeNull();
  }
});

test('review: executor navigation and task actions fit at 320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signIn(page, 'EXECUTOR');
  await page.getByRole('link', { name: 'Мои задачи', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Мои задачи' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Мои задачи' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'К содержимому' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.screenshot({
    path: 'artifacts/ux-my-tasks-320.png',
    fullPage: true,
  });
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

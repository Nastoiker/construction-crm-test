import { test, expect } from '@playwright/test';
import { signIn, api } from './helpers';

test('expired stored session refreshes successfully; invalid refresh signs out and clears private views', async ({
  page,
}) => {
  await signIn(page, 'EXECUTOR');
  // Exercise recovery from an expired local cache using a real refresh endpoint.
  // API signature/exp enforcement is separately verified by tests/security/api-security.mjs.
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) =>
      name.endsWith('-auth-token'),
    )!;
    const session = JSON.parse(localStorage.getItem(key)!);
    session.expires_at = Math.floor(Date.now() / 1000) - 60;
    localStorage.setItem(key, JSON.stringify(session));
  });
  const refreshed = page.waitForResponse((response) =>
    response.url().includes('/auth/v1/token?grant_type=refresh_token'),
  );
  await page.reload();
  expect((await refreshed).status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Объекты', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Мои задачи', exact: true }).click();
  await expect(
    page.getByRole('link').filter({ hasText: 'Проверить армирование' }),
  ).toBeVisible();
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) =>
      name.endsWith('-auth-token'),
    )!;
    const session = JSON.parse(localStorage.getItem(key)!);
    session.expires_at = Math.floor(Date.now() / 1000) - 60;
    session.refresh_token = 'invalid-refresh-token-for-regression';
    localStorage.setItem(key, JSON.stringify(session));
  });
  const rejected = page.waitForResponse((response) =>
    response.url().includes('/auth/v1/token?grant_type=refresh_token'),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event('visibilitychange')),
  );
  expect([400, 401]).toContain((await rejected).status());
  await expect(
    page.getByRole('button', { name: 'Войти', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Проверить армирование перекрытия')).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((name) => name.endsWith('-auth-token')),
    ),
  ).toEqual([]);
});

test('stored HTML and SQL-like input renders as text without executing script', async ({
  page,
}) => {
  const manager = await api('MANAGER');
  const executor = await api('EXECUTOR');
  const user = (await executor.auth.getUser()).data.user!;
  const { data: objects } = await manager.from('objects').select('id').limit(1);
  const text = '<img src=x onerror="window.__xss=1">';
  const { data: id, error } = await manager.rpc('create_task', {
    p_title: text,
    p_description: "' OR '1'='1; " + text,
    p_object_id: objects![0].id,
    p_assignee_id: user.id,
  });
  expect(error).toBeNull();
  try {
    await signIn(page, 'EXECUTOR');
    await page.goto(`tasks/${id}`);
    await expect(
      page.getByRole('heading', { name: text, exact: true }),
    ).toBeVisible();
    await expect(page.locator('main img')).toHaveCount(0);
    expect(await page.evaluate(() => '__xss' in window)).toBe(false);
  } finally {
    expect(
      (await manager.rpc('delete_task', { p_id: id, p_version: 1 })).error,
    ).toBeNull();
  }
});

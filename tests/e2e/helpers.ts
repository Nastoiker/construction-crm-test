import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

export type Account = 'MANAGER' | 'EXECUTOR' | 'SECOND_EXECUTOR';
export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Run local-env and seed first.`);
  return value;
}
export async function signIn(page: Page, account: Account) {
  await page.goto('login');
  await page
    .getByLabel('Email', { exact: true })
    .fill(required(`${account}_EMAIL`));
  await page
    .getByLabel('Пароль', { exact: true })
    .fill(required(`${account}_PASSWORD`));
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Объекты', exact: true }),
  ).toBeVisible();
}
export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Войти', exact: true }),
  ).toBeVisible();
}
export async function api(account: Account) {
  const client = createClient(
    required('SUPABASE_URL'),
    required('SUPABASE_ANON_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({
    email: required(`${account}_EMAIL`),
    password: required(`${account}_PASSWORD`),
  });
  if (error) throw error;
  return client;
}

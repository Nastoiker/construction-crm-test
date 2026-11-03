/* global document */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(process.env.SECURITY_APP_URL || 'http://127.0.0.1:4174/');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  assert.ok(policy.includes("script-src 'self';"));
  assert.ok(!policy.includes("'unsafe-eval'"));
  await page.evaluate(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      if (event.blockedURI === 'inline')
        document.documentElement.dataset.inlineBlocked = 'true';
    });
    const script = document.createElement('script');
    script.textContent =
      'document.documentElement.dataset.injectedScriptExecuted = "true"';
    document.head.append(script);
  });
  await page.waitForFunction(
    () => document.documentElement.dataset.inlineBlocked === 'true',
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.dataset.injectedScriptExecuted,
    ),
    undefined,
  );
  console.log(
    'Production CSP verified: inline script rejected by the browser; script did not execute.',
  );
} finally {
  await browser.close();
}

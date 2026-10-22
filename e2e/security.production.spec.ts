import { test, expect } from '@playwright/test';
test('production CSP, nonce rotation, console and validation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const response = await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Accede a tu compañía' })).toBeVisible();
  const headers = response!.headers();
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['content-security-policy']).toContain("require-trusted-types-for 'script'");
  const nonce = await page.locator('app-root').getAttribute('ngCspNonce');
  expect(nonce).toMatch(/^[a-f0-9]{32}$/);
  expect(headers['content-security-policy']).toContain(`'nonce-${nonce}'`);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByLabel('Identificador único de tu compañía')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(errors).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Accede a tu compañía' })).toBeVisible();
  expect(await page.locator('app-root').getAttribute('ngCspNonce')).not.toBe(nonce);
  expect(errors).toEqual([]);
});

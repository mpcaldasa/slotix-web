import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const companyId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const resourceId = '33333333-3333-4333-8333-333333333333';
const bookingId = '44444444-4444-4444-8444-444444444444';
const resource = {
  id: resourceId,
  companyId,
  name: 'Sala de prueba',
  resourceType: 'SPACE',
  description: '',
  capacity: 4,
  visibility: 'MEMBERS',
  status: 'ACTIVE',
};
const slot = { startAt: '2026-10-20T14:00:00Z', endAt: '2026-10-20T15:00:00Z' };
const booking = {
  id: bookingId,
  companyId,
  resourceId,
  customerUserId: userId,
  bookingNumber: 1,
  ...slot,
  timezone: 'America/Bogota',
  status: 'CONFIRMED',
};
async function mockApi(page: Page, role = 'CUSTOMER') {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const token = `header.${Buffer.from(JSON.stringify({ sub: userId, companyId, roles: [role], exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
    let body: unknown = [];
    if (path === '/api/users/login') body = { token, tokenType: 'Bearer' };
    else if (path.endsWith('/resources')) body = [resource];
    else if (path.endsWith('/availability')) body = [slot];
    else if (path === `/api/v1/bookings/${bookingId}`) body = booking;
    await route.fulfill({ json: body });
  });
}
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Identificador único de tu compañía').fill(companyId);
  await page.getByLabel('Correo electrónico').fill('qa@example.test');
  await page.locator('#auth-password').fill('test-only-password');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reservas', exact: true })).toBeVisible();
}
async function createForm(page: Page) {
  await page.getByRole('link', { name: 'Nueva reserva', exact: true }).click();
  await page.locator('#availability-resourceId').selectOption(resourceId);
  await page.getByLabel('Fecha en America/Bogota').fill('2026-10-20');
  await page.getByRole('button', { name: 'Consultar disponibilidad' }).click();
  await expect(page.getByRole('button', { name: /Reservar este horario/ })).toBeVisible();
}
test('login validation, keyboard, accessibility and responsive viewport', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');
  const loginCenterOffset = await page.locator('.auth-layout').evaluate((element) => {
    const { x, width } = element.getBoundingClientRect();
    return Math.abs(x + width / 2 - window.innerWidth / 2);
  });
  expect(loginCenterOffset).toBeLessThan(1);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByLabel('Identificador único de tu compañía')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByLabel('Identificador único de tu compañía')).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await login(page);
  await expect(page.getByText('COMPAÑÍA', { exact: true })).toBeVisible();
  await expect(page.getByText('Usuario de compañía', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Miembros', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Políticas', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Accede a tu compañía' })).toBeVisible();
});
test('guards reject company administration for customers', async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.evaluate(() => {
    history.pushState({}, '', '/members');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/forbidden/);
  await expect(page.getByRole('heading', { name: 'Acceso denegado' })).toBeVisible();
});
test('revoked session, forbidden and network errors remain truthful', async ({ page }) => {
  const unhandled: string[] = [];
  await page.addInitScript(() => {
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      console.warn(
        '[slotix-unhandled-test]',
        reason instanceof Error
          ? reason.stack
          : `${reason?.stack ?? ''} ${JSON.stringify(reason, Object.getOwnPropertyNames(reason))}`,
      );
    });
  });
  page.on('console', (message) => {
    if (message.text().includes('[slotix-unhandled-test]')) unhandled.push(message.text());
  });
  page.on('pageerror', (error) => unhandled.push(`pageerror: ${error.stack ?? error.message}`));
  await mockApi(page);
  await login(page);
  await page.route('**/api/v1/bookings?*', (route) =>
    route.fulfill({ status: 403, json: { code: 'ACCESS_DENIED' } }),
  );
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('permisos pueden haber cambiado');
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await page.route('**/api/v1/bookings?*', (route) => route.abort('connectionfailed'));
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo conectar');
  await page.route('**/api/v1/bookings?*', (route) =>
    route.fulfill({ status: 401, json: { code: 'AUTHENTICATION_REQUIRED' } }),
  );
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Accede a tu compañía' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText(/expiró|revocado/);
  expect(unhandled).toEqual([]);
});
test('uncertain creation reuses key and blocks duplicate submission', async ({ page }) => {
  await mockApi(page);
  await login(page);
  await createForm(page);
  const keys: string[] = [];
  let release: (() => void) | undefined;
  await page.route('**/api/v1/bookings', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    keys.push(route.request().headers()['idempotency-key'] ?? '');
    if (keys.length === 1) {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.abort('connectionfailed');
    } else await route.fulfill({ json: booking });
  });
  const reserve = page.getByRole('button', { name: /Reservar este horario/ });
  await reserve.click();
  await expect(reserve).toBeDisabled();
  expect(keys).toHaveLength(1);
  release?.();
  await expect(page.getByRole('alert')).toContainText('No se pudo conectar');
  await reserve.click();
  await expect(page.getByRole('heading', { name: 'Reserva #1' })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});
test('concurrent conflict refreshes availability without fake success', async ({ page }) => {
  await mockApi(page);
  await login(page);
  await createForm(page);
  let submissions = 0;
  await page.route('**/api/v1/bookings', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    submissions++;
    await route.fulfill({ status: 409, json: { code: 'BOOKING_SLOT_UNAVAILABLE' } });
  });
  await page.route('**/availability?*', (route) => route.fulfill({ json: [] }));
  await page.getByRole('button', { name: /Reservar este horario/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Horario ocupado');
  await page.getByRole('button', { name: 'Entendido' }).click();
  await expect(
    page.getByText('No hay horarios disponibles. Elige otra fecha o recurso.'),
  ).toBeVisible();
  expect(submissions).toBe(1);
  await expect(page).toHaveURL(/bookings\/new/);
});
test('changed reservation payload rotates idempotency key', async ({ page }) => {
  await mockApi(page);
  await login(page);
  await createForm(page);
  const keys: string[] = [];
  await page.route('**/api/v1/bookings', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    keys.push(route.request().headers()['idempotency-key'] ?? '');
    await route.abort('connectionfailed');
  });
  const reserve = page.getByRole('button', { name: /Reservar este horario/ });
  await reserve.click();
  await expect(page.getByRole('alert')).toContainText('No se pudo conectar');
  await page.getByLabel('Notas para la reserva').fill('Changed payload');
  await page.getByRole('button', { name: 'Consultar disponibilidad' }).click();
  await reserve.click();
  await expect(page.getByRole('alert')).toContainText('No se pudo conectar');
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).not.toBe(keys[0]);
});
test('authenticated availability screen and accessible calendar meet automated AA checks', async ({
  page,
}) => {
  await mockApi(page);
  await login(page);
  await createForm(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole('link', { name: 'Calendario', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Descartar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Calendario de reservas' })).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Vistas de reservas' })
      .getByRole('link', { name: 'Calendario' }),
  ).toHaveAttribute('aria-current', 'page');
  const screenshotDir = process.env['SLOTIX_GUIDE_SCREENSHOT_DIR'];
  if (screenshotDir) {
    mkdirSync(screenshotDir, { recursive: true });
    const suffix = test.info().project.name === 'mobile' ? '-mobile' : '';
    await page.screenshot({
      path: join(screenshotDir, `company-calendar-context${suffix}.png`),
      fullPage: true,
    });
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

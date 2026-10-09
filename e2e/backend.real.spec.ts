import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
// Explicit isolated QA database. These credentials are supplied out of band, never committed.
test('real isolated backend onboarding, resource schedule, policy, availability and UI reservation', async ({
  request,
  page,
}) => {
  const credentialsPath =
    process.env['SLOTIX_QA_CREDENTIALS'] ?? '/private/tmp/slotix-qa-credentials.json';
  const credentials: { email: string; password: string } = JSON.parse(
    readFileSync(credentialsPath, 'utf8'),
  );
  const base = process.env['SLOTIX_QA_API'] ?? 'http://localhost:8080/api';
  const login = await request.post(`${base}/platform/login`, { data: credentials });
  expect(login.ok()).toBe(true);
  const platform: { token: string } = await login.json();
  const unique = randomUUID();
  const password = `QA-${randomUUID()}`;
  const email = `qa-${unique}@example.test`;
  const onboard = await request.post(`${base}/v1/companies/onboarding`, {
    headers: { Authorization: `Bearer ${platform.token}` },
    data: {
      company: {
        legalName: 'Slotix isolated frontend QA',
        displayName: 'Frontend QA',
        slug: `qa-${unique}`,
        contactEmail: email,
      },
      administrator: { newUser: { email, password, fullName: 'Frontend QA Administrator' } },
    },
  });
  expect(onboard.ok()).toBe(true);
  const identity: { company: { id: string }; administrator: { userId: string } } =
    await onboard.json();
  const apiRequests: string[] = [];
  page.on('request', (request) => apiRequests.push(request.url()));
  await page.goto('/platform/login');
  await page.getByLabel('Correo electrónico').fill(credentials.email);
  await page.locator('#auth-password').fill(credentials.password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Compañías', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Crear compañía con administrador' }),
  ).toBeVisible();
  const companyLogin = await request.post(`${base}/users/login`, {
    data: { companyId: identity.company.id, email, password },
  });
  expect(companyLogin.ok()).toBe(true);
  const admin: { token: string } = await companyLogin.json();
  const headers = { Authorization: `Bearer ${admin.token}` };
  const companyPath = `${base}/v1/companies/${identity.company.id}`;
  const resourceResponse = await request.post(`${companyPath}/resources`, {
    headers,
    data: {
      name: 'Isolated QA room',
      description: 'Created only by frontend real QA',
      resourceType: 'SPACE',
      capacity: 4,
      visibility: 'MEMBERS',
    },
  });
  expect(resourceResponse.ok()).toBe(true);
  const resource: { id: string } = await resourceResponse.json();
  const activation = await request.post(`${companyPath}/resources/${resource.id}/activate`, {
    headers,
  });
  expect(activation.ok()).toBe(true);
  const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  for (let weekday = 0; weekday < 7; weekday++) {
    const rule = await request.post(`${companyPath}/resources/${resource.id}/availability-rules`, {
      headers,
      data: { weekday, startLocalTime: '08:00:00', endLocalTime: '18:00:00', effectiveFrom: day },
    });
    expect(rule.ok()).toBe(true);
  }
  const policyResponse = await request.post(`${companyPath}/booking-policies`, {
    headers,
    data: {
      name: 'Isolated QA policy',
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      slotIncrementMinutes: 30,
      minNoticeMinutes: 0,
      maxAdvanceDays: 30,
      cancellationNoticeMinutes: 0,
      approvalRequired: false,
      allowCustomerCancel: true,
    },
  });
  expect(policyResponse.ok()).toBe(true);
  const policy: { id: string } = await policyResponse.json();
  const assignment = await request.post(`${companyPath}/resources/${resource.id}/policies`, {
    headers,
    data: { policyId: policy.id, effectiveFrom: `${day}T00:00:00Z` },
  });
  expect(assignment.ok()).toBe(true);
  const availability = await request.get(`${companyPath}/resources/${resource.id}/availability`, {
    headers,
    params: { date: day, durationMinutes: 60 },
  });
  expect(availability.ok()).toBe(true);
  expect((await availability.json()).length).toBeGreaterThan(0);
  await page.goto('/login');
  await page.getByLabel('ID de compañía').fill(identity.company.id);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.locator('#auth-password').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reservas', exact: true })).toBeVisible();
  expect(apiRequests.some((url) => new URL(url).pathname.startsWith('/api/'))).toBe(true);
  expect(apiRequests.every((url) => new URL(url).origin === 'http://localhost:4200')).toBe(true);
  await page.getByRole('link', { name: 'Nueva reserva', exact: true }).click();
  await page.locator('#availability-resourceId').selectOption(resource.id);
  await page.getByLabel(/Fecha en/).fill(day);
  await page.getByRole('button', { name: 'Consultar disponibilidad' }).click();
  await page
    .getByRole('button', { name: /Reservar este horario/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: /Reserva #/ })).toBeVisible();
  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByLabel('Motivo').fill('Isolated frontend QA cleanup');
  await page.getByRole('button', { name: 'Confirmar cancelación' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancelar reserva', exact: true })
    .click();
  await expect(page.getByText('Cancelada', { exact: true })).toBeVisible();
});

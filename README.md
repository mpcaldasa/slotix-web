# Slotix Web

La guía de usuario y recorrido completo de pruebas está en [Guia-de-usuario-y-pruebas-E2E-Slotix.pdf](Guia-de-usuario-y-pruebas-E2E-Slotix.pdf); su fuente editable está en [docs/GUIA-DE-PRUEBAS.md](docs/GUIA-DE-PRUEBAS.md).

Angular frontend for the existing multitenant `reservation-core` API. The application contains separate company and platform access, role-based feature routes and backend-backed reservation operations.

## Requirements

- Node.js `^22.22.3`, `^24.15.0` or `^26.0.0` and npm 11.
- Java 25, Docker and the neighboring `reservation-core` repository for local API integration.
- Chromium for Playwright E2E. Install the browser with `npx playwright install chromium`.

## Install and run

```sh
npm ci
docker compose -f ../reservation-core/docker-compose.yml up -d postgres
cd ../reservation-core && ./mvnw spring-boot:run
```

In another terminal from this frontend directory:

```sh
npm start
```

Angular serves at `http://localhost:4200`; `proxy.conf.json` forwards `/api` to `http://localhost:8080`. To sign in, use the unique company identifier and account credentials provided by your company administrator. Platform access is at `/platform/login`. The backend must have an active account/company membership. Invitations require backend SMTP delivery to be enabled; recovery returns the backend's privacy-preserving acknowledgement and does not prove email delivery.

Runtime deployment settings are in `public/config.json`. Set `apiBaseUrl` to a same-origin `/api` path and configure the IANA `companyTimezone` only when it matches that company's backend timezone. Do not put secrets in this file. The API login token is kept in memory; a browser reload asks the user to sign in again. Logout clears the browser's token and does not revoke it server-side.

## Development and verification

```sh
npm run typecheck
npm run lint
npm run format:check
npm run contract:check
npm run test:coverage
npm run build
npx playwright install chromium
npm run e2e
npm run e2e:real
npm run audit:prod
npm run audit:dev
```

`npm run e2e` uses test-only API mocks in Chromium desktop and Pixel 7 profiles. `npm run e2e:real` needs a running backend. It provisions data in a dedicated test company through platform APIs; do not point it at a production database. Unit and HTTP integration tests use Angular's test HTTP backend. Coverage reports are written to `coverage/`; Playwright traces, screenshots, video and HTML reports are retained on failure.

The initial production bundle budget is 350 kB warning / 500 kB failure; one component stylesheet is 4 kB warning / 8 kB failure. `npm run verify` runs strict types, lint, formatting, coverage, production build and mocked E2E.

## Deploy

Run `npm run build` and `docker build -t slotix-web .`. The included Nginx image serves `dist/slotix-web/browser`, falls client routes back to `index.html`, caches hashed assets immutably, serves `config.json` without cache, and proxies `/api/` to `http://reservation-core:8080`. Attach the web container to a network where the backend resolves as `reservation-core`, or edit that upstream for the deployment's service DNS. Same-origin proxying avoids browser CORS; direct cross-origin API deployments need explicit backend allowlists for the web origin, Authorization, Idempotency-Key, methods and preflight. TLS termination and security headers beyond the included baseline belong at the deployment ingress.

## Contract and known limits

- [DESIGN.md](DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md), [UX-CONTRACT.md](UX-CONTRACT.md).
- [Feature/endpoint/role matrix](docs/FEATURE-MATRIX.md), [backend contract review](docs/CONTRACT-REVIEW.md), [verification report](docs/VERIFICATION.md).
- The backend does not expose current company profile/timezone to company sessions, customer policy details, member search for booking managers, invitation list/resend/revoke, or timezone mutation. The frontend adapts to these actual limitations.
- The backend's existing slug regex vulnerability is documented in its own quality assessment. The form enforces a reasonable max length; a direct API request still needs a backend fix.
- Design direction is a new frontend assumption because no prior product visual agreement was found. No billing, payments or anonymous public catalog are included.

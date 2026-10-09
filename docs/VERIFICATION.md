# Frontend verification report

**Date:** 2026-10-09  
**Environment:** Node.js 26.8.2, npm 11.19.1, Angular CLI 22.2.2, Chrome desktop, local Spring Boot API at `http://localhost:8080`.

## Local integration

- `GET http://localhost:8080/actuator/health/readiness` returned `{"status":"UP"}`.
- `GET http://localhost:4200/` returned HTTP 200. The company login also rendered in normal Chrome at `http://localhost:4200/login`.
- `public/config.json` sets `apiBaseUrl` to `/api`; the Angular dev server's `proxy.conf.json` forwards `/api` to `http://localhost:8080`. The browser E2E asserted that API calls used the frontend origin and `/api` paths.
- `PLAYWRIGHT_CHANNEL=chrome npm run e2e:real` passed against the local backend and isolated `slotix_frontend_qa` database. It authenticated a configured local platform administrator in the platform UI, read the protected company screen, onboarded a unique company through the platform onboarding API, logged into that company through the company UI, checked its reservation screen, fetched availability, created a reservation, and cancelled it. This establishes platform and company authentication against actual local accounts and data; the platform password is kept outside the repository.
- The real integration test leaves its QA company, resource, schedule, and policy in the isolated QA database. It cancels the reservation it creates. The ordinary `slotix` database was not used for test provisioning.

## Checks executed

| Check | Result |
| --- | --- |
| `npm run contract:check` | Passed; generated frontend contract matches the checked-in OpenAPI source. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `npm test` | Passed: 10 files, 29 tests. |
| `npm run test:coverage` | Passed: 24.38% lines, 31.89% branches across all included app TypeScript. |
| `npm run e2e` | Passed: 14/14 desktop and mobile browser tests, including axe checks, expired/revoked session, forbidden and network errors, conflicts, idempotency, and double-submit prevention. |
| `PLAYWRIGHT_CHANNEL=chrome npm run e2e:real` | Passed: one end-to-end local backend integration. |
| `npm run build` | Passed. Initial bundle 291.60 kB raw / 79.04 kB estimated transfer; feature screens are emitted as lazy chunks. |
| `npm audit --omit=dev`; `npm audit` | Both previously passed with zero reported vulnerabilities in production and full dependency trees. No dependencies changed after the audit. |

The all-source coverage is intentionally reported without excluding page code. Core HTTP and error handling coverage is higher: `api.ts`, `errors.ts`, and `session.ts` are each at 100% line coverage; `interceptors.ts` is at 88.23% lines and 95.23% branches. `bookings-api.ts` is at 80% lines and 90% branches. Many page templates and route branches are exercised in browser E2E rather than direct component coverage, so the all-source unit coverage remains modest.

## Limits

Automated axe checks ran on the login and authenticated availability/calendar journeys in desktop and mobile layouts. Chrome's accessibility tree was also inspected for the company login. This is not a full manual WCAG audit with assistive technology. Backend capabilities absent from the contract and resulting UI limitations are listed in `CONTRACT-REVIEW.md` and `FEATURE-MATRIX.md`.

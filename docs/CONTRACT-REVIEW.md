# Backend contract review

Review date: 2026-10-08. Source repository: sibling `reservation-core`. HEAD: `c6226683989a4115bf15b4ee9b241ebc3d09bd19`. Backend files were read without modification. Existing uncommitted quality-tooling changes were present in CI, README, pom.xml, specs indexes/standards, dependabot, config, scripts and quality-assessment.md; these remain owned by the backend work.

## Sources reviewed

Read all 12 specifications under specs, all business controllers, request/response DTOs and relevant authentication/tenant access, company, resource access, availability, booking, lifecycle, rescheduling, policy and operational application rules. Also read backend application configuration and enum definitions. The endpoint/DTO matrix is [FEATURE-MATRIX.md](FEATURE-MATRIX.md).

No prior product visual specification or DESIGN.md was found under the Slotix workspace. Engineering decisions do exist: English technical documentation, capability organization, atomic business/audit/outbox writes, persisted authorization, no fabricated commercial billing requirement. Visual direction must therefore be identified as a new frontend assumption rather than a recovered agreement.

Runtime OpenAPI is configured at `/v3/api-docs` and Swagger UI is public. An initial read attempt returned connection code 000; after the backend became available, `curl -fsS http://localhost:8080/v3/api-docs -o /private/tmp/slotix-openapi.json` succeeded. The live paths and schemas were inspected against the controller/DTO matrix. No preexisting checked-in OpenAPI file was found. Schema retrieval is a read-only integration check; it does not imply successful authenticated business journeys.

## Findings affecting frontend implementation

1. **Two API generations coexist.** Platform company list/create/activate uses `/api/companies`; onboarding uses `/api/v1/companies`. Do not invent GET `/api/v1/companies`. User/platform authentication and recovery also use legacy unversioned paths.
2. **Missing company metadata for company sessions.** Login returns only token/type and JWT has no timezone, name or email. Company timezone is only exposed in the platform company list and booking response. Backend Company.create fixes America/Bogota/COP and offers no timezone modification endpoint. A configurable assumed company zone is necessary before booking metadata; generalized timezone discovery needs backend support. Server slots must be sent unchanged.
3. **No resource/policy detail GET.** Detail pages must resolve the item from the authorized list, not call an invented endpoint. Resource list is unpaginated; server filters private resources for customers.
4. **Customer policy terms unavailable.** Policy list is administrator-only; resource assignment reads expose only policy id and interval. The UI can know status/ownership but cannot prove customer cancellation/reschedule window. Server conflict/validation handling is required; exact action availability remains a backend contract limitation.
5. **Calendar prose drift.** specs/api-errors.md describes a 90-day range; BookingService.calendar enforces `Duration.toDays() > 31`. Frontend must use <=31 exact days; acceptance should cover this actual service limit.
6. **Current permission claims may become stale.** Server resolves persisted roles each request. Demotion can yield 403 with an unchanged JWT; suspension/inactive user/company yields 401. No profile/role refresh endpoint exists. Claims can guide initial UI but server errors must remove unusable context and require reauthentication where needed.
7. **Manager customer lookup absent.** BOOKING_MANAGER may create for active members but cannot query company memberships. Use known member UUID when booking on behalf; do not expose administrator member APIs to managers.
8. **Lifecycle and historical safety are material.** Resource deletion is irreversible soft deletion blocked by future PENDING/CONFIRMED/CHECKED_IN bookings. Assigned policies cannot be edited even after assignments end. Active/future assignments prevent deactivation; replacements and closure/removal preserve active reservation terms. These restrictions must use actual conflict codes.
9. **Idempotency expires.** Creation keys default to 24 hours, require unchanged payload and cannot guarantee replay forever. Disable duplicate submissions and preserve key for uncertain same-request retry; never automatically retry arbitrary writes.
10. **Reschedule availability exclusion is private to service.** The reschedule write computes availability excluding itself. Public availability cannot include that parameter. A selection UI based only on public slots may omit otherwise valid overlapping moves; document this restriction or provide an explicit company-zone interval input whose submission is server validated.
11. **Invitation/recovery delivery is external.** Invitation requires enabled email; recovery always acknowledges generically even when no email is queued. Frontend must report request acknowledgement and not guaranteed delivery. No invitation preview/list/resend/revoke API exists.
12. **Operations are platform-only.** Audit and delivery inspection/replay use `/api/platform/operations`; COMPANY_ADMIN has no such endpoints. Failed-delivery replay queues a retry, never confirms email delivery.
13. **CORS not configured.** Use frontend same-origin proxy or configure server CORS for actual deployed origin. No refresh/logout endpoint or HttpOnly-cookie session contract exists. Client logout cannot revoke the JWT server-side.
14. **Slug defect remains a backend issue.** Existing quality assessment reproduced Java regex StackOverflowError on a 10,001-character slug. Frontend bounded validation improves ordinary UX; it does not close direct API exposure. Backend was preserved as requested.

## Report interpretation

The backend's supplied assessment records 112 passing tests, 93.07% line and 63.22% branch coverage. These are its prior baseline, not frontend verification and not checks executed by this review. Production telemetry, real SMTP, deployment, backup restore and dependency CVE coverage were explicitly excluded in that assessment. No backend test rerun or behavior change was made for this documentation review.

# Frontend feature and authorization matrix

Reviewed against `reservation-core` commit `c6226683989a4115bf15b4ee9b241ebc3d09bd19` and its existing working-tree specifications on 2026-10-08. Controllers, DTOs and application decisions are authoritative when a prose specification differs. This matrix describes backend capability; verification results for the implemented frontend are recorded separately.

Role abbreviations: **P** = PLATFORM_ADMIN; **A** = COMPANY_ADMIN; **M** = BOOKING_MANAGER; **C** = CUSTOMER; **Public** = unauthenticated. Company operations require a token for that exact company, an active company, active user and active membership. Platform privileges never replace a company membership. Server authorization resolves current persisted roles on every request; JWT role claims are only a UI hint.

## Authentication and identity

| Operation | Endpoint | Role | Input | Response / constraints |
| --- | --- | --- | --- | --- |
| Company sign-in | POST `/api/users/login` | Public | `companyId`, `email`, `password` | 200 `{token,tokenType}`; active identity, company and membership required |
| Platform sign-in | POST `/api/platform/login` | Public | `email`, `password` | 200 `{token,tokenType}`; persisted platform role required; no company context |
| Request password recovery | POST `/api/password-resets` | Public | `email` | 202 `{message}`; identical message for unknown account or disabled email; max 3 email requests per account/hour |
| Confirm recovery | POST `/api/password-resets/confirm` | Public | `token`, `password` | 200 `{message}`; token 30 minutes, single use; changes credential version and invalidates existing JWTs |
| Accept invitation | POST `/api/invitations/accept` | Public | `token`, `password`, `fullName` | 201 UserResponse; seven-day, single-use token; fullName max 120 |
| Provision new user and company membership | POST `/api/users` | A | `companyId`, `email`, `password`, `fullName`, nonempty `roles` | 200 UserResponse; atomic account + membership; duplicate email 409 |

JWT claims: `sub`, optional `companyId`, `roles`, `credentialVersion`, `iat`, `exp`. Default validity is 60 minutes. No refresh, logout, current-profile, membership-discovery, company-switch or invitation-preview API exists. Logout clears frontend state; expiry or invalid identity requires sign-in again. Inactive account, company or membership produces 401 and cannot reliably be distinguished from expired credentials. Login intentionally uses INVALID_CREDENTIALS without revealing suspension. Authenticated insufficient privilege returns 403 ACCESS_DENIED. Passwords require 8–72 characters and at most 72 UTF-8 bytes when creating/resetting accounts; email max 320, provisioning fullName max 200. Invitation acceptance fullName max 120 is a distinct DTO limit.

## Platform and companies

| Operation | Endpoint | Role | Input | Response / constraints |
| --- | --- | --- | --- | --- |
| List companies | GET `/api/companies` | P | None | 200 CompanyResponse[]; legacy path; no pagination |
| Create pending company | POST `/api/companies` | P | `legalName`, `displayName`, `slug`, `contactEmail` | 200 CompanyResponse; no administrator yet |
| Activate legacy company | POST `/api/companies/{companyId}/activate` | P | No body | 200 CompanyResponse |
| Create company with administrator | POST `/api/v1/companies/onboarding` | P | `{company: CreateCompanyRequest, administrator: InitialAdministratorRequest}` | 201 `{company,administrator}`; active company and administrator atomically |
| Initialize existing company | POST `/api/v1/companies/{companyId}/initial-administrator` | P | InitialAdministratorRequest | 200 `{company,administrator}`; PENDING or ACTIVE with no active administrator |
| List global users | GET `/api/platform/users` | P | `page=0`, `size=20` | Page of PlatformUserResponse; size 1–100 |
| Deactivate global user | POST `/api/platform/users/{userId}/deactivate` | P | No body | PlatformUserResponse; invalidates credentials across companies; protects last active platform admin |
| Reactivate global user | POST `/api/platform/users/{userId}/reactivate` | P | No body | PlatformUserResponse; old JWTs remain invalid |
| Grant platform role | POST `/api/platform/users/{userId}/platform-admin` | P | No body | PlatformUserResponse; target must be active |
| Revoke platform role | DELETE `/api/platform/users/{userId}/platform-admin` | P | No body | 200 PlatformUserResponse; protects last active platform admin |

InitialAdministratorRequest requires exactly one of `existingUserId` or `newUser: {email,password,fullName}`. CompanyResponse contains `id,legalName,displayName,slug,status,timezone,currencyCode,contactEmail,createdAt`. New company timezone is fixed by backend to America/Bogota and currency to COP. No endpoint changes these values. GET `/api/v1/companies` does **not** exist; the legacy GET above does. No company detail/update/suspend/delete endpoint exists. The reproduced unbounded-slug regex issue is documented in the backend quality assessment; frontend short-slug validation is an additional UX limit, not a backend security fix.

## Company members

Base **members** = `/api/v1/companies/{companyId}/memberships`. All actions A only.

| Operation | Endpoint | Input | Response / constraints |
| --- | --- | --- | --- |
| List | GET members | `page=0`, `size=20` | MembershipPageResponse; page >=0, size 1–100; stable creation/id order |
| Link existing identity | POST members | `userId`, nonempty `roles` | 201 MembershipResponse; active global user required; existing active membership conflicts |
| Invite new identity | POST members`/invitations` | `email`, nonempty `roles` | 202 CompanyInvitationResponse; enabled email required; existing global identity or pending invitation conflicts |
| Replace roles | PUT members`/{membershipId}/roles` | nonempty `roles` | MembershipResponse; entire role set replaced |
| Suspend | POST members`/{membershipId}/suspend` | No body | MembershipResponse; existing token receives 401 |
| Activate | POST members`/{membershipId}/activate` | No body | MembershipResponse; target global user must be active |

Roles are COMPANY_ADMIN, BOOKING_MANAGER, CUSTOMER. Last active company administrator with an active global account cannot be suspended/demoted: LAST_COMPANY_ADMIN_REQUIRED (409). Repeating no-op state/role changes preserves timestamps. No member detail/search, invitation list/revoke/resend, or company role discovery endpoint exists. Managers cannot list members: booking on behalf must use a known user UUID. User registration above supports direct provisioning alongside invitations.

## Resources, schedules and blocks

Base **resources** = `/api/v1/companies/{companyId}/resources`; **resource** = resources`/{resourceId}`.

| Operation | Endpoint | Role | Input | Response / constraints |
| --- | --- | --- | --- | --- |
| Catalog | GET resources | A/M/C | None | ResourceResponse[]; name order; no pagination; C excludes PRIVATE |
| Create | POST resources | A | ResourceRequest | 201 ResourceResponse; initial DRAFT |
| Edit | PUT resource | A | ResourceRequest | ResourceResponse; capacity locked by active future allocations |
| Activate | POST resource`/activate` | A | No body | ResourceResponse |
| Deactivate | POST resource`/deactivate` | A | No body | ResourceResponse; existing bookings retained, new availability empty |
| Delete | DELETE resource | A | No body | 204; soft delete, repeatable; active future allocations block |
| Availability | GET resource`/availability` | A/M/C | `date` YYYY-MM-DD, positive `durationMinutes` | AvailabilitySlot[] with Instant `startAt,endAt`; schedule, policy, notice, blocks and capacity enforced |
| Schedule rules | GET resource`/availability-rules` | A/M/C | None | AvailabilityRuleResponse[] |
| Create rule | POST resource`/availability-rules` | A | RuleRequest | 201 AvailabilityRuleResponse |
| Edit rule | PUT resource`/availability-rules/{ruleId}` | A | RuleRequest | AvailabilityRuleResponse |
| Remove rule | DELETE resource`/availability-rules/{ruleId}` | A | No body | 204; repeatable soft delete |
| Blocks | GET resource`/blocks` | A/M/C | None | ResourceBlockResponse[]; start order |
| Create block | POST resource`/blocks` | A | BlockRequest | 201 ResourceBlockResponse |
| Edit block | PUT resource`/blocks/{blockId}` | A | BlockRequest | ResourceBlockResponse |
| Remove block | DELETE resource`/blocks/{blockId}` | A | No body | 204; repeatable soft delete |

ResourceRequest = `name` (required, max 150), nullable `description` (max 2000), `resourceType`, positive integer `capacity`, `visibility`. Types: SPACE, PERSON, EQUIPMENT, SERVICE_RESOURCE, OTHER; vehicles/courts do not have additional backend enum values. Visibility: PUBLIC, MEMBERS, PRIVATE. PUBLIC still requires company authentication. Statuses: DRAFT, ACTIVE, INACTIVE, MAINTENANCE; no direct maintenance-status endpoint. No GET resource detail: derive from the authorized catalog. Deleted/private inaccessible reads return RESOURCE_NOT_FOUND (404). Soft deletion retains schedules, assignments and booking history and cannot be reversed. PENDING/CONFIRMED/CHECKED_IN allocations with future end prevent capacity changes/deletion.

RuleRequest = `weekday` (0 Sunday … 6 Saturday), `startLocalTime,endLocalTime` (local HH:mm[:ss]), nullable `effectiveFrom,effectiveTo` (dates). End strictly after start, inclusive effective dates; overnight rules unsupported. BlockRequest = Instant `startAt,endAt`, required `reason`, `blockType` MAINTENANCE/CLOSURE/ADMIN_BLOCK; end after start. No pagination on these lists.

## Policies and assignments

Base **policies** = `/api/v1/companies/{companyId}/booking-policies`; **assignments** = resource`/policies`.

| Operation | Endpoint | Role | Input | Response / constraints |
| --- | --- | --- | --- | --- |
| Policy list | GET policies | A | None | BookingPolicyResponse[] including inactive; no pagination |
| Create policy | POST policies | A | PolicyRequest | 201 `{id}` (not complete policy) |
| Edit policy | PUT policies`/{policyId}` | A | PolicyRequest | BookingPolicyResponse; never-assigned policies only |
| Activate | POST policies`/{policyId}/activate` | A | No body | BookingPolicyResponse |
| Deactivate | POST policies`/{policyId}/deactivate` | A | No body | BookingPolicyResponse; current/future assignments block |
| Read resource assignments | GET assignments | A/M/C | None | ResourcePolicyResponse[]; start order; resource visibility enforced |
| Assign | POST assignments | A | `policyId,effectiveFrom`, nullable `effectiveTo` | 201 ResourcePolicyResponse; active company policy, positive nonoverlapping interval |
| Close | PUT assignments`/{effectiveFrom}` | A | `effectiveTo` | ResourcePolicyResponse; shorten only; active reservations extending past new end block |
| Replace policy | PUT assignments`/{effectiveFrom}/policy` | A | `policyId` | ResourcePolicyResponse; active policy; active reservations block replacement |
| Remove future assignment | DELETE assignments`/{effectiveFrom}` | A | No body | 204; start strictly future, no active reservations |

Assignment identity uses the original Instant `effectiveFrom` in URL (encode it, preserve precision). ResourcePolicyResponse contains only resourceId, policyId, effectiveFrom, effectiveTo; no policy terms. PolicyRequest = `name` max 120, positive `minDurationMinutes,maxDurationMinutes,slotIncrementMinutes`; nonnegative `minNoticeMinutes,maxAdvanceDays,cancellationNoticeMinutes`; booleans `approvalRequired,allowCustomerCancel`. Min <= max; duration bounds divisible by increment. Historical assignments make policy terms permanently immutable. No policy detail or DELETE endpoint exists. Do not pretend policy replacement/capacity safety can be inferred without the server; handle stable conflict codes.

## Booking flows and lifecycle

Base **booking** = `/api/v1/bookings/{bookingId}`. Company context comes from the token, not a body/path field.

| Operation | Endpoint | Role | Input | Response / constraints |
| --- | --- | --- | --- | --- |
| Create | POST `/api/v1/bookings` | A/M/C | `Idempotency-Key`; `resourceId,startAt,endAt`, optional `customerUserId,notes` | 201 BookingResponse; C self only; staff may target active company member |
| List | GET `/api/v1/bookings` | A/M/C | Instant `from,to` | BookingResponse[]; no pagination; C own bookings |
| Calendar | GET `/api/v1/calendar` | A/M/C | Instant `from,to` | Same service/list response |
| Detail | GET booking | A/M/C | None | BookingResponse; staff or owner; non-owner C 403 |
| Cancel | POST booking`/cancel` | A/M/C | Optional `{reason}` | BookingResponse; staff reason mandatory; owner policy window applies |
| Approve | POST booking`/approve` | A/M | No body | BookingResponse; PENDING → CONFIRMED |
| Reject | POST booking`/reject` | A/M | No body | BookingResponse; PENDING → REJECTED |
| Reschedule | PUT booking`/reschedule` | A/M/C | `startAt,endAt` | BookingResponse; PENDING/CONFIRMED only; C own + old cancellation policy/window |
| Check in | POST booking`/check-in` | A/M | No body | CONFIRMED → CHECKED_IN only during start <= now < end |
| Complete | POST booking`/complete` | A/M | No body | CHECKED_IN → COMPLETED at/after checkedInAt; releases capacity |
| No-show | POST booking`/no-show` | A/M | No body | CONFIRMED → NO_SHOW at/after end; releases capacity |

Creation chooses PENDING if approvalRequired, otherwise CONFIRMED; staff does not bypass policy approval. Positive whole-minute interval <=24 hours must exactly match an authoritative available slot. Idempotency key required, nonblank, max 200 chars; request hash includes resource, resolved customer, original start/end, notes. Keep the key and payload unchanged for retry of an uncertain creation. Default key TTL 24 hours; after expiration reuse may create a new booking. Disable double submit; a network error is not proof the write failed. No automatic write retry. BOOKING_SLOT_UNAVAILABLE (409) requires refreshing availability and selection. Rescheduling excludes itself from capacity checks internally; ordinary GET availability does not expose that exclusion, so overlap with the existing booking can be absent from public results although the reschedule endpoint supports it.

List/calendar actual service rejects nonpositive ranges and `Duration.between(from,to).toDays() > 31`; frontend should request <=31 exact days. The API-errors prose claiming 90 days is stale. Cancellation PENDING/CONFIRMED → CANCELLED; repeating CANCELLED is a no-op. Customer cancellation and rescheduling use the policy of the original interval, even if inactive: allowCustomerCancel and cancellationNoticeMinutes; exact deadline inclusive. Customers cannot retrieve those terms through a current endpoint; server confirmation is authoritative. Existing private bookings remain readable/cancellable by their owner but private resource discovery and new/moved bookings require staff visibility.

Statuses: PENDING, CONFIRMED, REJECTED, CANCELLED, CHECKED_IN, COMPLETED, EXPIRED, NO_SHOW. Pending timeout default 30 minutes is applied by backend worker; no expire endpoint. Repeated attendance action only idempotent while the booking remains in its resulting state. Do not automatically retry transitions as their state may have changed. BookingResponse includes number, ids, Instant times, status, timezone snapshot, notes, cancellation metadata, check-in/completion/no-show actors and times.

## Platform operations

Base **operations** = `/api/platform/operations`; P only (company administrator has no operational access).

| Operation | Endpoint | Input | Response / constraints |
| --- | --- | --- | --- |
| Audit | GET operations`/audit` | optional `companyId,action,entityType,entityId`; `page=0,size=20` | AuditPageResponse; exact filters; action/entityType normalized uppercase; newest first |
| Deliveries | GET operations`/notification-deliveries` | `status=FAILED,page=0,size=20` | NotificationDeliveryPageResponse; PENDING/SENDING/SENT/FAILED; newest first; no company filter |
| Replay | POST operations`/notification-deliveries/{deliveryId}/replay` | No body | NotificationDeliveryResponse; FAILED only, else 409; resets to PENDING, attempts 0; queues normal delivery, does not prove email sent |

All paginated endpoints use `{items,page,size,totalElements,totalPages}`, page >=0 and size 1–100. Audit entries include ids, actor, action, entity, nullable JSON-string before/after snapshots, correlation id and timestamp. Display snapshots as escaped text; never HTML. Deliveries include id, companyId, nullable bookingId, eventType, status, attempts, errorCode, nextAttemptAt, createdAt, sentAt. Email is disabled by default; SMTP/staging verification requires configured external provider. Replay scope covers notification_deliveries, not a fabricated general email or invitation console.

## Timezone and integration constraints

Availability `date` and recurring schedules use company local dates/times. Slots, blocks, assignments and bookings use ISO Instant strings. Preserve selected slot instants exactly; format with explicit IANA zone and never convert a company wall clock with browser timezone. BookingResponse.timezone is the persisted company-zone snapshot. A company user cannot fetch company metadata or timezone before the first booking; current backend creates every company in America/Bogota, so any default zone is a documented deployment assumption and must be configurable for out-of-band company data. A company metadata endpoint is needed for fully general multi-timezone discovery. Platform company catalog exposes the actual timezone.

Backend has no CORS policy configured in SecurityConfig. Use same-origin `/api` reverse proxy in production and an Angular development proxy; separate origins require explicit allowed-origin/header/method configuration on the server (including Authorization and Idempotency-Key). Public health/OpenAPI endpoints do not authorize business access. No billing/payment/anonymous catalog capability exists.

Errors use `{status,code,error,fields}` with all 79 ApiErrorCode values in source. Branch on code/status, translate user guidance, associate validation field keys, clear invalid sessions on 401, preserve input on 403/409/422/network failures, and do not expose credentials or token-bearing URLs in logs. Unknown/internal/non-JSON errors require safe fallback guidance; success appears only after an actual API success.

# Slotix interface review — 2026-11-19

## Implemented

The desktop shell now uses the full workspace width rather than subtracting the navigation width twice. Routed and shared component hosts use block layout. The document background extends the navigation color to the bottom while the rail remains fixed and usable. Query/filter navigation preserves focus and scroll; changing screens resets the content position.

The native confirmation dialog retains its top-layer focus handling, inert background and Escape behavior. A full-document scrim now covers long screenshots and scrolling pages, and background document scrolling is locked. Action colors distinguish primary, reversible state changes and destructive operations without relying on color alone.

Company, policy, rule, block, policy-assignment and availability-slot lists now use the shared range-count paginator. Existing server-paged member/user/operations screens retain their API pagination. Booking rows are limited to ten per page. Resource details use separate schedule and policy panels, preserving unsaved input when switching panels.

Calendar and list are separate views. The calendar places reservations on day/week hour axes, uses state colors and a text legend, offers today/previous/next navigation, and filters by resource and state. Dense weekly overlaps open a detailed day; individual reservations open their authorized detail. Overnight intervals are split at company-local midnight. The display remains read-only; it does not add drag-to-reschedule writes. Internal scroll keeps the date window bounded.

Invitation success welcomes the person by name. Its sign-in link carries company context internally and prefills email, so the invited person does not copy a UUID. Password character guidance remains visible; byte-based password validation still runs, with plain-language errors. Technical codes in company rows are secondary support disclosures.

## AgendaPro comparison

Reviewed official product documentation on 2026-11-19. No access to a paid AgendaPro workspace was used, and no claim of pixel-level replication is made.

| Pattern                                                  | Official evidence                                                                                                                 | Slotix decision                                                                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calendar/list, resource filters, today/period navigation | [How to use the agenda](https://ayuda.agendapro.com/es/articles/6486845-como-usar-la-seccion-agenda)                              | Adopted with the existing Slotix authorization model                                                                                                             |
| State colors and a visible legend                        | [Reservation states](https://ayuda.agendapro.com/es/articles/6493779-cuales-son-los-estados-de-reservas-que-existen-en-agendapro) | Adopted using Slotix states, always accompanied by text                                                                                                          |
| Branch-specific agendas                                  | [Agenda guide](https://ayuda.agendapro.com/es/articles/6486845-como-usar-la-seccion-agenda)                                       | Later product decision: Slotix companies are tenant boundaries, not branch aliases                                                                               |
| Public reservation website                               | [AgendaPro plans](https://agendapro.com/es/planes)                                                                                | Gap to evaluate later: current Slotix PUBLIC resources still require membership                                                                                  |
| Customer-oriented scheduling and customer information    | [Agenda guide](https://ayuda.agendapro.com/es/articles/6486845-como-usar-la-seccion-agenda)                                       | Priority follow-up: an authorized customer lookup for staff, replacing known-user-code entry without granting access to the full member administration directory |

The useful scheduling patterns were adopted. Sales, billing and unrelated vertical-specific screens were not added to a generic resource reservation product.

## Design contract reconciliation

| Previous rule/evidence                               | Resolution                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Center content by adding a second rail-width padding | Removed: current user explicitly requested wider operational tables/forms             |
| Prefer lists to calendars                            | Updated: current user explicitly requested a real calendar with a list alternative    |
| Session has no revocation endpoint                   | Corrected documentation: logout revocation exists; session restoration still does not |
| Unbounded local configuration tables                 | Shared local pagination; server pagination remains in place where supported           |

Runtime CSS remains the token owner, mirrored by DESIGN.md. No dependencies or UI framework were added. Spanish remains the existing product locale; code, identifiers, tests and engineering documentation use English.

## Verification

Run evidence, screenshots and browser results are delivered outside the repository. Real browser checks use the normal local backend/PostgreSQL database and an SMTP receiver that stores mail locally, not an external provider. The saved test run covers all four roles, desktop/mobile calendar, filters, overlapping events, list pagination, long-page rail/modal behavior, the invitation email → acceptance → sign-in flow, and read-only manager permissions. Axe AA checks cover the rendered calendar in desktop and mobile.

Unit regressions cover interval layout, adjacent boundaries, overnight/midnight splitting, dense groups, stale calendar responses and invitation sign-in context. The normal verify command also runs the repository's mocked regression E2E suite; those tests are recorded separately from the real browser checks.

The premium static auditor reports a false positive for the existing Angular `(click)="logout()"` binding in app.html: its literal-button scanner recognizes native/Vue click syntax, not Angular event bindings. Logout remains wired and covered by the existing browser regression. The unchanged audit JSON and this triage are retained; a clean static audit is not claimed. DESIGN.md lint has no errors; unused-token warnings reflect runtime-owned CSS colors, not generated component references.

## Limits and follow-ups

- Local pagination limits rendered rows but does not add database paging to unpaged backend endpoints. Server paging is needed before large datasets.
- No drag-to-reschedule, month view, staff customer search, public booking website, branch model or payment workflow was introduced.
- No physical mobile device, Safari/Firefox or manual screen-reader session was available. Automated AA checks do not establish full accessibility compliance.
- The current in-memory session still requires signing in after a full reload. A secure restoration flow requires a backend contract.
- Date/time administrative inputs still require explicit timezone values; a future shared company-local date/time editor would further reduce technical input.

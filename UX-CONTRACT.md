# UX contract

This frontend follows [DESIGN.md](DESIGN.md). Business policies are defined by the backend contract and summarized in [docs/FEATURE-MATRIX.md](docs/FEATURE-MATRIX.md).

## Navigation and permissions

The platform shell belongs to `PLATFORM_ADMIN`. Company routes require an authorized company JWT and the roles specified by each backend controller. Company admins alone manage members, policies and resource mutations; booking managers share staff booking transitions; customers see only their own bookings. Client guards and hidden actions are a usability layer. A server 401/403 remains authoritative.

## Forms and feedback

Use the shared labeled editor for forms. It associates required, email, length and domain errors with controls, preserves field values after failure and prevents repeat submission while busy. Confirm irreversible deletion, suspension, role changes, replay and booking transitions with a named object and an explicit verb. Render success only after HTTP success. Inline API errors retain the backend code for support.

## Lists and schedules

Use server pagination when the API provides a page response; resource and booking lists use bounded company/date retrieval because their API is unpaged. The active resource query and list page are preserved in the URL. Calendar has a timed visual view and a semantic list alternative and ranges are capped at the implemented 31 days. Lists show explicit empty, loading and error states.

## Canonical UI map

| Capability        | Owner                                 | Contract                                                                                                                      |
| ----------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Shell and scroll  | App, app.html, styles.css             | Document scroll, full-height grid rail, sticky menu bounded above the account footer; query updates preserve focus and scroll |
| Forms/select/date | shared/editor.ts, native controls     | Spanish labels, native keyboard behavior, visible validation, busy controls                                                   |
| Confirmation      | shared/dialog.ts, native dialog       | Top layer, inert background, full-document scrim, scroll lock, Escape/cancel and trigger focus restoration                    |
| Pagination        | shared/pagination.ts                  | Explicit range, total, previous/next, disabled edges; server pages retained for paged APIs                                    |
| Calendar          | features/bookings/booking-calendar.ts | Day/week navigation; state color and text; dense week groups open a day, every booking opens its authorized detail            |
| Feedback          | shared/feedback.ts                    | Server-confirmed success and recoverable inline errors                                                                        |
| Scrollbar         | styles.css                            | Visible global baseline; tables/calendar own internal overflow                                                                |

Local configuration panels keep page state within their resource or policy screen. Company/bookings list navigation remains in the URL. Local pagination bounds the rendered rows; unpaged backend endpoints still retrieve the full authorized dataset. Backend pagination for those endpoints is a separate scaling task.

## Async, session and concurrency

Never automatically retry a write. Keep a booking creation key stable across retries of the same request, explain uncertain network outcomes, and refresh availability after slot conflicts. Statuses come from the booking response. A 401 clears local identity and redirects to sign-in; a 403 preserves the session and explains that server permissions may have changed. Session state remains in memory because there is no refresh/session-restoration endpoint. Logout uses the existing server revocation endpoint.

## Locale, time and access

Spanish (`es-CO`) is the first locale. Backend timestamps are instants; format them in the booking timezone snapshot or configured IANA company timezone. Send availability's slot instants unchanged. Local schedule rules use a company-local weekday and local clock value. Administrative UTC instants require an explicit offset. Keyboard focus, visible focus rings, semantic tables/forms, reduced motion and responsive operation are part of each shared surface.

## Customer and workspace workflows

Company administrators and booking managers share a tenant-scoped customer directory, bounded name/email/phone search and paged booking history. Contact notes and telephone numbers belong to a company; the directory does not modify global identity or membership roles. Booking creation uses the shared customer picker and defaults to the authenticated person. Customer accounts never receive staff search controls. The shared editor and unsaved-change guard protect contact changes.

The workspace header and account footer use authenticated company/person names. Only persisted active company memberships populate the company selector. Switching requires explicit discard confirmation, resolves target roles server-side and initializes the target timezone before opening its bookings.

The calendar supports day/week/resource columns, resource pagination, zoom and a native-dialog booking preview. Resource filters narrow columns. Preview closes with Escape, restores trigger focus and preserves the calendar URL and filters. Summary counts describe the filtered query; no occupancy percentage is invented.

Only company administrators configure reminders or Google Calendar. Reminders require email delivery and explain their notice window. Google credentials missing, consent cancellation and provider failure never produce a connected success state. The first Google release copies bookings manually and explains that external edits do not change Slotix availability. OAuth callback parameters are cleared from browser history.

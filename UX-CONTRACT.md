# UX contract

This frontend follows [DESIGN.md](DESIGN.md). Business policies are defined by the backend contract and summarized in [docs/FEATURE-MATRIX.md](docs/FEATURE-MATRIX.md).

## Navigation and permissions

The platform shell belongs to `PLATFORM_ADMIN`. Company routes require an authorized company JWT and the roles specified by each backend controller. Company admins alone manage members, policies and resource mutations; booking managers share staff booking transitions; customers see only their own bookings. Client guards and hidden actions are a usability layer. A server 401/403 remains authoritative.

## Forms and feedback

Use the shared labeled editor for forms. It associates required, email, length and domain errors with controls, preserves field values after failure and prevents repeat submission while busy. Confirm irreversible deletion, suspension, role changes, replay and booking transitions with a named object and an explicit verb. Render success only after HTTP success. Inline API errors retain the backend code for support.

## Lists and schedules

Use server pagination when the API provides a page response; resource and booking lists use bounded company/date retrieval because their API is unpaged. The active resource query and list page are preserved in the URL. Calendar has a semantic table alternative and ranges are capped at the implemented 31 days. Lists show explicit empty, loading and error states.

## Async, session and concurrency

Never automatically retry a write. Keep a booking creation key stable across retries of the same request, explain uncertain network outcomes, and refresh availability after slot conflicts. Statuses come from the booking response. A 401 clears local identity and redirects to sign-in; a 403 preserves the session and explains that server permissions may have changed. Session state remains in memory because there is no refresh or revocation endpoint.

## Locale, time and access

Spanish (`es-CO`) is the first locale. Backend timestamps are instants; format them in the booking timezone snapshot or configured IANA company timezone. Send availability's slot instants unchanged. Local schedule rules use a company-local weekday and local clock value. Administrative UTC instants require an explicit offset. Keyboard focus, visible focus rings, semantic tables/forms, reduced motion and responsive operation are part of each shared surface.

# Slotix design system

This is the implementation reference for Slotix's authenticated, multitenant booking product. `DESIGN.md` is the product-level visual contract; `src/styles.css` owns the runtime tokens and global components. Feature-specific rules must respect the API roles, states, and capabilities rather than imply unsupported actions.

## Product intent

Help company staff and customers complete booking work with confidence, and help platform administrators manage tenants without losing scope. Keep company identity and its IANA timezone visible. Use real backend data and state labels. Explain empty, loading, conflict, denied, and network-error states in Spanish. Do not add public discovery, payments, fabricated metrics, or sample data.

## Visual direction

Use a calm operations workspace: deep navy navigation, an open cool-white work surface, clear calendar blue for primary actions, mint green for availability and successful states, and restrained warm red for destructive and error states. The direction takes the legibility of Swiss editorial systems and the scanability of dense scheduling dashboards, softened for everyday staff use. Avoid marketing heroes, decorative gradients, heavy card shadows, and generic demo content.

The compact calendar-grid mark and the narrow mint selected-navigation rail are functional wayfinding cues. Icons are consistent inline SVGs with accessible names only when they convey meaning; decorative SVGs are hidden from assistive technology.

The access and recovery container sits over a quiet, low-contrast 36px grid that nods to scheduling without competing with form labels or keyboard focus.

## Tokens and typography

- Runtime tokens and responsive rules live in `src/styles.css`; keep semantic names such as `--accent`, `--ink`, `--paper`, `--line`, `--success`, and `--danger`.
- Use Fira Sans for interface copy, headings, and controls. Use Fira Code only for technical identifiers and diagnostics.
- Fonts are bundled through Fontsource and included by `angular.json`; do not load fonts from third-party origins.
- Controls use an 8px radius and panels a 14px radius. Use thin borders and restrained elevation. Keep visible keyboard focus and honor reduced-motion preferences.
- Status must be conveyed by its Spanish label and text, not color alone.

## Layout and behavior

Desktop uses a persistent navigation rail and a focused work column. On narrow screens the navigation moves above the content; filters and forms reflow, while wide data tables retain an explicitly labeled horizontal-scroll region. Preserve the current task, filters, and pagination when supported by the URL.

Use native date, time, and select controls where they improve reliable keyboard and assistive-technology operation. Show company-local times with the company's IANA timezone without changing the server-provided instant. Keep validation, help, and error text associated with its form control. Confirm irreversible actions and warn about unsaved edits.

## Rationale and source notes

The UI UX Pro Max scheduling and operations-dashboard guidance informed the dense, scan-first information hierarchy and restrained calendar palette. Design with Intent's intent, journey, inclusion, organization, and evaluation methods informed role-specific task paths, explicit system feedback, and accessible alternatives. Impeccable's interface audit informed removal of decorative accent borders and clearer typography hierarchy. These are design inputs; the live OpenAPI contract, existing authorization, and `DESIGN.md` remain the product and behavior sources of truth.

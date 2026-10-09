---
version: alpha
colors:
  primary: '#002fa7'
  primary-dark: '#001f70'
  ink: '#18232b'
  muted: '#596a75'
  paper: '#f5f8f8'
  surface: '#ffffff'
  line: '#dbe3e6'
  danger: '#a53232'
typography:
  body:
    fontFamily: 'Arial, Helvetica, sans-serif'
    fontSize: '15px'
    lineHeight: '1.55'
  display:
    fontFamily: 'Helvetica, Arial, sans-serif'
    lineHeight: '1.2'
  code:
    fontFamily: 'ui-monospace, SFMono-Regular, monospace'
rounded:
  control: '7px'
  panel: '10px'
spacing:
  control: '0.5rem'
  panel: '1rem'
components:
  primary-action:
    backgroundColor: '#002fa7'
    color: '#ffffff'
    borderRadius: '7px'
  data-panel:
    backgroundColor: '#ffffff'
    borderColor: '#dbe3e6'
    borderRadius: '10px'
---

## Overview

Slotix is an operational tool for company staff and a platform console for platform administrators. No prior Slotix visual agreement was present in the reviewed repositories, so this frontend establishes a sober, legible product direction. The visual anchor is a Swiss administrative grid softened with a restrained Swiss blue signal: hierarchy comes from clear typography, table rules and consistent alignment. The signature is the small blue slot mark beside the wordmark, carried into the active navigation and focus system.

The palette pairs a near-white work surface with deep ink and the Swiss blue action color. Display headings use Helvetica and reading text uses Arial, with system fallbacks. The system font stack loads without external font requests and keeps geometry stable across platforms. Keep data surfaces quiet so status and schedule changes remain easy to scan.

## Colors

Runtime ownership is `src/styles.css`. CSS custom properties map one to one to the values above: `--accent`, `--accent-dark`, `--ink`, `--muted`, `--paper`, `--surface`, `--line`, and `--danger`. Focus uses the distinct high-contrast `--focus` outline so keyboard navigation remains visible. Status uses text and labels in addition to tone; color never carries state alone.

## Typography

Use Arial for body copy and controls, Helvetica for headings, and tabular numerals for booking dates, page counts and identifiers. Technical identifiers and preformatted diagnostics use the system monospace stack (`ui-monospace, SFMono-Regular, monospace`). Keep Spanish dates explicit to the company IANA timezone. Use natural wrapping for long IDs and localized text.

## Layout

At desktop sizes, a persistent navigation rail anchors an open working area with an explicit content width. Tables scroll inside their own visible surface. At narrow widths, navigation moves above content, forms collapse to one column, and tables retain a labeled horizontal scroll alternative. Native date, time and select controls are deliberate: their platform popup behavior is acceptable for these administrative fields; all form labels, validation and help text remain app-owned and Spanish.

## Elevation & Depth

Use hairline borders and quiet surface contrast. Reserve a soft shadow for modal confirmation; static lists and details stay flat. Feedback and errors occupy stable in-flow space so actions do not jump during routine mutations.

## Shapes

Controls use a 7px radius; panels use 10px. Status chips may be pill-shaped because their bounded labels are distinct from action controls. Focus outlines must never be removed.

## Components

`src/styles.css` owns semantic runtime variables and global scrollbar colors. `src/app/shared/editor.ts` owns labeled form controls, validation association and busy state. `src/app/shared/dialog.ts` owns confirmation focus and keyboard behavior. Feature routes own domain-specific business choices; API types derive from the captured live OpenAPI schema in `contracts/openapi.json` through `scripts/generate-contract.mjs`.

## Do's and Don'ts

- Keep company identity and timezone visible in context.
- Preserve instants returned by server availability; only format them in the explicit company timezone.
- Use real role and reservation state labels from the backend.
- Do not add fabricated dashboards, public listings, payment surfaces or sample bookings.
- Keep navigation, actions, error messages and field guidance in Spanish.
- Prefer direct, readable lists over decorative calendar widgets.

---
version: 1
colors:
  primary: '#2856c7'
  primary-dark: '#1e429d'
  ink: '#14233b'
  muted: '#53647a'
  paper: '#f3f6f9'
  surface: '#ffffff'
  line: '#dce4ec'
  danger: '#a72f2b'
  success: '#126b50'
  navigation: '#14233b'
  navigation-strong: '#1c3150'
  navigation-muted: '#aebbd0'
  accent-soft: '#e9efff'
  mint: '#dff4eb'
  warning: '#8b5709'
  danger-soft: '#fff0ed'
  control-border: '#bdcbd9'
  control-border-hover: '#8fa3bb'
typography:
  body:
    fontFamily: 'Fira Sans, ui-sans-serif, system-ui, sans-serif'
    fontSize: '15px'
    lineHeight: '1.55'
  display:
    fontFamily: 'Fira Sans, ui-sans-serif, system-ui, sans-serif'
    lineHeight: '1.2'
  code:
    fontFamily: 'Fira Code, ui-monospace, SFMono-Regular, monospace'
  sizes:
    [
      '0.67rem',
      '0.69rem',
      '0.72rem',
      '0.76rem',
      '0.78rem',
      '0.79rem',
      '0.8rem',
      '0.82rem',
      '0.83rem',
      '0.85rem',
      '0.86rem',
      '0.87rem',
      '0.9rem',
      '0.91rem',
      '0.93rem',
      '0.94rem',
      '0.95rem',
      '0.96rem',
      '1rem',
      '1.08rem',
      '1.32rem',
      '1.35rem',
      '1.6rem',
    ]
rounded:
  control: '8px'
  panel: '14px'
  auth-panel: '20px'
  status: '999px'
spacing:
  control: '0.65rem'
  panel: '1.5rem'
components:
  primary-action:
    backgroundColor: '#2856c7'
    color: '#ffffff'
    borderRadius: '8px'
  data-panel:
    backgroundColor: '#ffffff'
    borderColor: '#dce4ec'
    borderRadius: '14px'
---

## Overview

Slotix is an operational tool for company staff and a platform console for platform administrators. The visual direction combines Swiss clarity with a calendar-specific color system: calendar blue anchors navigation and actions; mint green signals availability; warm red is reserved for errors. A midnight-blue navigation rail, a compact calendar-grid mark, Fira typography, and high-contrast page hierarchy give the product a distinct identity. The authenticated experience follows an operational dashboard pattern, not a marketing hero or demo layout.

The palette pairs a cool near-white work surface with deep ink, calendar blue, and a green availability signal. Fira Sans is used for interface text and headings; Fira Code is reserved for technical identifiers. Both font families are bundled locally so the browser makes no third-party font requests. Table rows, filters, and schedule states stay quiet enough to scan quickly.

## Colors

Runtime ownership is `src/styles.css`. CSS custom properties map to the semantic palette: `--accent`, `--accent-dark`, `--ink`, `--muted`, `--paper`, `--surface`, `--line`, `--danger`, `--success`, and `--nav`. Focus uses the distinct high-contrast `--focus` outline so keyboard navigation remains visible. Status uses text and labels in addition to tone; color never carries state alone.

## Typography

Use Fira Sans for body copy, controls, and headings, with weight and size establishing hierarchy. Use Fira Code for technical identifiers and preformatted diagnostics. Keep tabular numerals for booking dates, page counts, and identifiers. Keep Spanish dates explicit to the company IANA timezone. Use natural wrapping for long IDs and localized text.

## Layout

At desktop sizes, a persistent navigation rail anchors an open working area with an explicit content width. Tables scroll inside their own visible surface. At narrow widths, navigation moves above content, forms collapse to one column, and tables retain a labeled horizontal scroll alternative. Native date, time and select controls are deliberate: their platform popup behavior is acceptable for these administrative fields; all form labels, validation and help text remain app-owned and Spanish.

## Elevation & Depth

Use hairline borders and restrained elevation to separate interactive work panels from the canvas. Static lists remain flat within their panels; dialogs have the strongest elevation. Feedback and errors occupy stable in-flow space so actions do not jump during routine mutations.

## Shapes

Controls use an 8px radius; panels use 14px. Status chips may be pill-shaped because their bounded labels are distinct from action controls. Focus outlines must never be removed.

## Components

`src/styles.css` owns semantic runtime variables and global scrollbar colors. `src/app/shared/editor.ts` owns labeled form controls, validation association and busy state. `src/app/shared/dialog.ts` owns confirmation focus and keyboard behavior. Feature routes own domain-specific business choices; API types derive from the captured live OpenAPI schema in `contracts/openapi.json` through `scripts/generate-contract.mjs`.

## Do's and Don'ts

- Keep company identity and timezone visible in context.
- Preserve instants returned by server availability; only format them in the explicit company timezone.
- Use real role and reservation state labels from the backend.
- Do not add fabricated dashboards, public listings, payment surfaces or sample bookings.
- Keep navigation, actions, error messages and field guidance in Spanish.
- Prefer direct, readable lists over decorative calendar widgets.

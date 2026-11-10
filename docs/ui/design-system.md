# Design system

Direction: **clean and professional.** Calm, light and trustworthy, like a modern admin dashboard. The school's own colour is the only strong colour.

## Principles

- One accent colour per school, set at runtime from the school's settings (`--school-accent`). Everything accent-coloured (buttons, current menu item, focus ring) follows it.
- Status always uses words as well as colour (Paid in full, Part paid, Unpaid).
- Phone-friendly: 40px minimum touch height, 16px text in inputs on phones (prevents zoom on iPhones), tables scroll sideways instead of squeezing, the sidebar becomes a scrolling bar on small screens.
- Amounts use tabular numerals (`.num`) so columns line up.
- The school's name and badge come first, with "Powered by ClassBridge" beneath.
- Grids use `grid-cols-1` as the base so wide content (tables) cannot stretch the page on phones.

## Tokens (`apps/web/src/index.css`)

| Group    | Tokens                                                                                        |
| -------- | --------------------------------------------------------------------------------------------- |
| Neutrals | `canvas` (page), `surface` (panels), `line`, `line-strong`, `ink` (headings), `body`, `muted` |
| Accent   | `accent`, `accent-soft` (tint), `accent-strong` (hover), all derived from the school colour   |
| Status   | `good`, `warn`, `bad`, `info`, each with a `-soft` tint                                       |
| Shape    | `rounded-card` 12px for panels, `rounded-lg` 8px for controls                                 |
| Type     | Inter. Page title 24px semibold, panel title 16px semibold, body 14px                         |

## Components (`apps/web/src/components`)

`AppShell` (header, role sidebar, page) · `Button` (primary, secondary, ghost, danger; md, sm) · `Badge` · `Card` · `Field`, `TextField`, `SelectField` (labels, hints, errors wired for screen readers) · `Stat` · `DataTable` · `Icon`.

The **component gallery** (`apps/web/src/pages/Gallery.jsx`) shows them all on a realistic head's Invoices page. Run `npm run dev:web` to see it. Add a component here first, with a test, before using it on a screen.

## Mobile later

React Native will reuse the same colour and spacing values. Tailwind styling carries over through NativeWind, so tokens stay the single source of truth.

# Calendar Library Choice — Built-in Web Calendar (Chat 052-W)

Decision record for the web calendar surface (`apps/web/app/(app)/calendar`). Candidates
were the two entries in `OPEN_SOURCE_INVENTORY.md`: **FullCalendar** (standard/free tier) and
**react-big-calendar**.

## Decision

**react-big-calendar**, with recurrence expanded server-side (our own RRULE expander) and the
calendar fed *already-expanded* one-off instances.

## How the candidates compare

| Axis | FullCalendar (free) | react-big-calendar | Winner |
|------|---------------------|--------------------|--------|
| Month / week / day views | Yes (separate plugins: daygrid, timegrid) | Yes (built in) | tie |
| RRULE handling | `@fullcalendar/rrule` plugin (wraps `rrule`) | none built-in | see note |
| Theming fit to Vesper tokens | Own CSS-variable theme + shadow DOM-ish structure; harder to map to the espresso/cream palette | Plain semantic CSS class names (`.rbc-*`) trivially overridable with token-mapped CSS | react-big-calendar |
| Bundle impact | Multi-package (`@fullcalendar/react` + `core` + `daygrid` + `timegrid` + `interaction`), heaviest of the two | Single package; date math via `date-fns` **already a dependency** of `@vesper/web` | react-big-calendar |
| Date lib | Bundles Luxon/moment adapters or its own | `dateFnsLocalizer` reuses installed `date-fns` (no new date lib) | react-big-calendar |
| React 19 fit | Wrapper has historically lagged on React peer ranges | Plain function components, no special peer wiring | react-big-calendar |
| V1 coverage (display + create/edit/delete + recurring display) | Covered | Covered | tie |

### Why the RRULE axis is *not* decisive

The authoritative contract (TECHNICAL_SPEC §3 #25) stores **only** the RRULE string plus the
series start/end. Recurrence instances are **expanded on read** for the requested window and
**never persisted**. Chat 052-W therefore ships its own expander (`recurrence.ts`, built on the
`rrule` npm package) and hands the calendar plain, pre-expanded instances. The calendar component
never sees an RRULE, so FullCalendar's bundled `@fullcalendar/rrule` plugin gives us nothing we
need. With the recurrence advantage neutralised, the remaining tiebreakers — lighter bundle,
plain-CSS theming that maps cleanly onto the `@vesper/ui` tokens, and reuse of the already-present
`date-fns` — all favour react-big-calendar.

## Consequences

- New dependencies in `apps/web`: `react-big-calendar`, `@types/react-big-calendar`, `rrule`.
  `pnpm install` is required before type-check / build / test.
- The calendar component is theme-skinned with a token-mapped stylesheet
  (`_components/rbc-theme.css`) layered over `react-big-calendar/lib/css/react-big-calendar.css` —
  no bespoke off-system colors; every value resolves to a `@vesper/ui` token hex.
- Recurrence is owned by `recurrence.ts`, not the calendar library, keeping the "expand on read,
  never persist" rule enforceable in one place and independent of the display library (so the
  library could be swapped without touching recurrence semantics).

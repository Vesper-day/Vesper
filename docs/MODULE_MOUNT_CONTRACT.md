# Module Mount Contract

**Source of truth for module surface locations and the mount pattern.**
Authored by ADD-A (Modules-tab navigation refactor). Errands (062) and every
future module chat mount into this contract — read this file FIRST, not the
paths named in the original module chats (013 shell, 060 medications, 061 bills),
which are partially stale on surface locations.

Last updated: ADD-A (Modules-tab nav refactor landed).

---

## The two module card kinds

The Modules tab is a vertically scrollable list of rounded-rectangle cards, one
card per module. Cards divide into two kinds, and **both kinds route to a full
page — no card is a dead toggle**:

- **Reminder-list modules** (medications, bills, errands) route to a **full
  management page** — a list plus add/edit. Their entries continue to surface
  through their existing notification / schedule mechanism and as plan blocks;
  this is **unchanged** by the mount refactor.

- **Generative modules** (fitness, nutrition, sleep) route to a **richer module
  page**. At V1 these ship as **functional-breadth scaffolds (method B)** — real,
  navigable, demoable surfaces — with the deep engines explicitly deferred
  (nutrition micronutrient / RDA / calorie internals; fitness strength-rank /
  world-standard percentile mapping). See PRD §6.2 / §6.3.

---

## Module gate keys (SINGULAR, live)

Module enablement is read from `GET /api/v1/profile` →
`profile.modulesEnabled.<key>.enabled` (a boolean). The keys are **singular**:

| Module      | Gate key      | Notes                                              |
| ----------- | ------------- | -------------------------------------------------- |
| Medications | `medication`  | —                                                  |
| Bills       | `finance`     | The Finance module. Key is `finance`, **NOT** `bills`. |

A module page **self-gates on its key**: it renders a "module off" card until the
module is enabled, so a deep link while the module is off is safe. The Modules
list shows a module's card regardless of gate state (with an at-a-glance On/Off
hint) and routes into the self-gating page — the card is never removed and never a
dead toggle.

---

## Surface locations (current, post-ADD-A)

### Mobile (Expo Router, `apps/mobile/app/(tabs)/`)

Tab bar: **plan / Modules / tasks / calendar** (Modules second-from-left).
Settings is **not a tab** — it is a card pinned at the bottom of the Modules list.

```
(tabs)/_layout.tsx                     tab navigator (plan, modules, tasks, calendar)
(tabs)/modules/_layout.tsx             the Modules Stack
(tabs)/modules/index.tsx               the Modules card list (routes + bottom Settings card)
(tabs)/modules/medications.tsx         Medications module page (reminder-list; chat 060 logic)
(tabs)/modules/bills.tsx               Bills / Finance module page (reminder-list; chat 061 logic)
(tabs)/modules/settings/_layout.tsx    the Settings sub-stack
(tabs)/modules/settings/index.tsx      Settings home (links into the sub-screens)
(tabs)/modules/settings/integrations.tsx
(tabs)/modules/settings/privacy.tsx
(tabs)/modules/settings/subscription.tsx
```

Routes: a module page is `/modules/<name>`; settings sub-screens are
`/modules/settings/<name>`.

### Web (Next.js App Router, `apps/web/app/(app)/`)

The web app shell has **no persistent tab bar**. The Modules surface is a
`/modules` list page with the same rounded-card list + card→page routing + bottom
Settings card.

```
(app)/modules/page.tsx                 the Modules card list
(app)/modules/medications/page.tsx     Medications module page (chat 060 logic)
(app)/modules/bills/page.tsx           Bills / Finance module page (chat 061 logic)
(app)/settings/page.tsx                Settings (reached from the Modules Settings card)
(app)/settings/integrations/page.tsx   Google Calendar connect/disconnect
(app)/settings/integrations/callback/page.tsx   OAuth callback (path is fixed — Google redirect URI)
```

Web settings is **left at `/settings`** (not moved under `/modules/settings`)
because the Google OAuth callback path `/settings/integrations/callback` is a
registered redirect URI; the Modules Settings card links to `/settings`.

---

## How a new module mounts (checklist for future chats)

1. Add the module page under `(tabs)/modules/<name>.tsx` (mobile) and
   `(app)/modules/<name>/page.tsx` (web). Reminder-list → management page;
   generative → method-B scaffold page.
2. The page **self-gates** on its singular `modulesEnabled.<key>.enabled` flag.
3. Register the module in the Modules card catalog (`apps/mobile/lib/modules.ts`
   and `apps/web/lib/modules.ts`) so its card appears in the list and routes to
   the page. Keep the card catalog in list order.
4. Register the new mobile screen in `(tabs)/modules/_layout.tsx`.
5. Keep API routes at `/api/v1/<name>/*`. Do not re-parent API routes when the UI
   surface moves.

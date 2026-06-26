# Vesper Design System

**Status:** Built in Phase 4 / Chat 107 (first design-BUILD chat). Encodes the
locked Layer 4 visual system as a single token layer + core primitives.
**Source of truth for values:** `docs/LAYER_4_EXPERIENCE_IDENTITY.md` (palette, type,
spacing, radii, motion). This document does **not** invent values — it records where
they live and the rule for composing from them.

---

## 1. Canonical token home

There is **one** token source, read by both web and mobile:

- **`packages/ui/src/tokens.ts`** — the plain token object: `colors`, `borderRadius`,
  `spacing`, `typography` (families, the utility `fontSize` scale, `letterSpacing`,
  `lineHeight`, `fontWeight`, and per-role `roles`), and `motion` (duration bands +
  midpoints, easing curves, the Reanimated spring, the reduced-motion fallback).
- **`packages/ui/src/tailwind.ts`** — the `vesperPreset` Tailwind preset, built
  entirely from `tokens.ts`. Maps every semantic token to `theme.extend`: colors,
  borderRadius, fontFamily, fontSize, letterSpacing, lineHeight, transitionDuration,
  transitionTimingFunction.
- **`packages/ui/src/index.ts`** — exports the token object **and** `vesperPreset`.

**Web** consumes the preset via `apps/web/tailwind.config.ts`
(`presets: [vesperPreset]`); **mobile** consumes the same preset via
`apps/mobile/tailwind.config.js` (`presets: [vesperPreset, nativewind/preset]`). The
same semantic utility class names (`bg-surface`, `text-cream-faint`, `rounded-lg`,
`font-display`, `leading-butler`, `duration-quick`, …) resolve to the same values on
both platforms. React Native StyleSheet / Swift consumers read the raw `tokens.ts`
object (and its Swift mirror, below).

**This is a consolidation, not a second system.** Tokens already existed in
`@vesper/ui` (laid down by 052-W / 053); Chat 107 extended that same home to carry the
full Layer 4 set (added: `spacing`, `radius-none`, the state aliases `warning`/`error`,
the full `typography.roles` / `letterSpacing` / `lineHeight` / `fontWeight`, and the
entire `motion` object). No parallel `apps/web` or `apps/mobile` token file exists.

### Native (Swift) mirror

`apps/mobile/ios/Shared/DesignTokens.swift` is the hand-synced Swift mirror of
`tokens.ts` (Swift cannot import the TS package). It carries token **values only**
(`VesperColor`, `VesperFont`, `VesperSpacing`, `VesperRadius`, `VesperMotion`) for the
native surfaces the build track owns from a design-track spec:

- iOS alarm screen (059b) — `docs/native/ALARM_SCREEN_059b_VISUAL_SPEC.md`
- Live Activity widgets (077 / 078) — `docs/native/LIVE_ACTIVITY_078_VISUAL_SPEC.md`

The design track supplies the Swift token values + the visual specs; the build track
(Opus-native) writes the SwiftUI. (DESIGN_STRATEGY.md §5.)

---

## 2. Token names → Layer 4 source

| Group | Tokens | Layer 4 source |
|---|---|---|
| Background | `espresso` (bg-primary), `surface` (bg-surface), `elevated` (bg-elevated) | Palette › Background |
| Text | `cream` (text-primary), `cream-muted` (text-secondary), `cream-faint` (text-tertiary) | Palette › Text |
| Accent | `bronze` (accent-bronze), `oxblood` (accent-oxblood) | Palette › Accent |
| Border | `line-subtle` (border-subtle), `line-strong` (border-strong) | Palette › Border |
| State | `success`, `warning` (= bronze), `error` (= oxblood) | Palette › State |
| Radii | `none, sm, md, lg, xl, 2xl, full` (0/4/8/12/16/24/9999px) | Border radii |
| Spacing | `0,1,2,3,4,5,6,8,10,12,16,20,24,32` (4px base) | Spacing scale |
| Type families | `display` (Fraunces), `sans`/`body` (Inter), `mono` (JetBrains Mono) | Typography |
| Type roles | `display1-3`, `butlerLine`, `bodyLarge`, `body`, `bodySmall`, `uiLabel`, `uiLabelSmall`, `mono`, `monoSmall` | Typography roles |
| Motion durations | `quick` (150-250), `considered` (300-500), `slow` (600-900), `cinematic` (1000-2000), `instant` (reduced-motion) | Motion bands |
| Motion easing | `standardOut`, `standardIn`, `cinematic`, `spring` (damping 18 / stiffness 150) | Motion easing |

### Fonts

The three families load on **web** via a Google-Fonts `@import` in
`apps/web/app/globals.css` (Fraunces with opsz+ital axes, Inter, JetBrains Mono) — no
binary font asset is committed. On **mobile**, `font-display`/`font-mono` map to the
family names; loading them on-device via `expo-font` is a later on-device pass (no
`expo-font` dependency is added in 107 — mobile is gated on build/lint only here).

### Material discipline (globals.css)

- **Vellum:** `.vellum-overlay` — inline data-URI SVG fractal noise at ~3% opacity,
  at the limit of perceptibility (no binary asset). The web `Card` renders it as an
  absolutely-positioned child. Mobile uses the flat warm surface for now (parity note
  in `Card.tsx`).
- **Carved wood:** the espresso `body` darkens almost imperceptibly toward the corners
  via a single radial wash (flat-aesthetic preserved).
- **Reduced motion:** a `prefers-reduced-motion` media query collapses all
  animation/transition to instant; mobile mirrors via
  `AccessibilityInfo.isReduceMotionEnabled`.

---

## 3. Core primitives

Authored per-app (a DOM card and an RN card cannot be one file), both composing from
the same tokens — no primitive hardcodes a hex, size, radius, or duration.

- **Web** — `apps/web/components/ui/` (shadcn alias from `components.json`): `Card`,
  `Button`, `BlockRow`, `ButlerLine`; `cn` helper at `apps/web/lib/utils.ts`.
- **Mobile** — `apps/mobile/components/ui/` (NativeWind, the 053 styling approach):
  `Card`, `Button`, `BlockRow`, `ButlerLine`; `cn` at `apps/mobile/components/ui/utils.ts`.

| Primitive | Treatment |
|---|---|
| `Card` | `bg-surface`, `rounded-lg`, `border-line-subtle`; web carries the ~3% vellum overlay. |
| `Button` | Variants `primary` / `secondary` / `ghost` / `destructive`. `primary` is the **single bronze action** per surface; leather press shadow (web), quick-band press. |
| `BlockRow` | The plan-block row: `rounded-lg`, `bg-surface`, mono time, optional bronze active rail (one per plan). |
| `ButlerLine` | The ambient butler-line shell: Fraunces italic (`font-display italic`), `text-cream-faint`, `leading-butler`; renders nothing when empty. |

Each primitive has a colocated unit test asserting it renders, applies the expected
semantic token classes, and hardcodes no hex/px where a token exists. (`@testing-library`
is not a repo dependency: web tests render via `react-dom/server`; mobile tests mock
`react-native` and inspect the returned element's className — required so vite's SSR
transform never parses React Native's Flow source.)

---

## 4. Composition rule (binding on every later screen)

> **Later screens MUST compose from these tokens and primitives — never re-derive.**

No screen introduces a new hex, type size, radius, or motion value, and no screen
re-implements a card/button/block/butler-line. If a surface needs a value that is not
yet a token, the token is added to `tokens.ts` (and, if a native surface needs it, to
`DesignTokens.swift`) — not inlined at the call site.

If any **value** in `tokens.ts` ever changes (vs only adding tokens),
`apps/web/app/(app)/calendar/_components/rbc-theme.css` mirrors literal token hexes
(CSS cannot read Tailwind tokens) and must be hand-synced. *Chat 107 changed no
existing value — it only added tokens — so rbc-theme.css required no sync.*

---

## 5. Scorekeeping as absence (hard constraint)

Per DESIGN_STRATEGY.md §3 and Layer 4: **no grade, no score rendered as a headline, no
streak, badge, points, level, leaderboard, or progress-bar gamification primitive
exists in this library — and none may be added, even as an unused export.** A surface
cannot accidentally render scorekeeping chrome if no such primitive exists; this is the
cheapest enforcement point and it is enforced here by the component simply not
existing. Counts of literal events (blocks arranged, conflicts resolved) may appear as
calm recap on a surface, but never as a score, ratio, derived figure, or headline, and
never via a shared primitive.

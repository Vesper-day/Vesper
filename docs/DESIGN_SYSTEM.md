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
  transitionTimingFunction, and (added by the rich re-overhaul / ADD-D) `boxShadow`
  and `backdropBlur`. The `boxShadow` extend **merges** with Tailwind's default
  shadow scale, so pre-existing `shadow-sm` / `shadow-inner` consumers keep resolving.
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
writes the SwiftUI. (DESIGN_STRATEGY.md §5.)

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
| Motion durations | `quick` (150-250), `considered` (300-500), `slow` (600-900), `cinematic` (1000-2000, **KEPT**), `instant` (reduced-motion) | Motion bands |
| Motion easing | `standardOut`, `standardIn`, `cinematic` (**KEPT**), `emphasized`, `overshoot` (added by ADD-D), `spring` (damping 18 / stiffness 150) | Motion easing |
| Elevation (ADD-D) | `shadow-raised` (rest), `shadow-floating` (hover/lift), `shadow-press` (:active inset), `shadow-glow` (bronze focus halo) | Rich-posture `boxShadow` (warm, espresso-tinted) |
| Backdrop blur (ADD-D) | `backdrop-blur-veil` (12px, web-only glass overlay) | Rich-posture `backdropBlur` |

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

## 3a. Part-2 components (Chat 107a)

The second tier — form controls, time/date pickers, the rendered butler-line voice
surface, and motion primitives — authored per-app and composing the **same** tokens +
107 primitives (no second token system, no new container, no scorekeeping primitive).

- **Web** — `apps/web/components/ui/`: `TextField`, `Toggle`, `Select`,
  `SegmentedControl`, `TimePicker`, `DatePicker`, `ButlerVoice`, `motion` (Entrance /
  Interaction / `useReducedMotion` / `motionDurationClass`).
- **Mobile** — `apps/mobile/components/ui/`: the same set **minus `Select`**
  (`TextField`, `Toggle`, `SegmentedControl`, `TimePicker`, `DatePicker`, `ButlerVoice`,
  `motion`). RN has no native `<select>`, so the select/segmented role ships as
  `SegmentedControl` only on mobile.

| Component | Treatment / contract |
|---|---|
| `TextField` | 107 input tokens: `bg-surface`, `border-line-subtle`, `rounded-md`, `font-body text-sm`, `text-cream`, cream-faint placeholder; Quick-band focus token. Same value/onChange (web) / onChangeText (mobile) contract as the inline TaskForm field, lifted to a primitive. |
| `Toggle` | On/off switch; `rounded-full` track fills `bronze` when on (the on-state claims the single accent), cream knob slides on the Quick-band token. Controlled `checked` + `onChange(next)`. |
| `Select` (web) | Token-styled native `<select>` — same option `{label,value}` shape + value/onChange as TaskForm. Selection only; never a score/ratio/progress control. |
| `SegmentedControl` | Inline few-option track; selected segment fills `bronze`; Quick-band swap. `value` + `onChange(value)`, `{label,value}` options. The mobile select/segmented control. Selection only — no score/progress. |
| `TimePicker` | Round-trips **`"HH:mm"`** (24-hour, zero-padded) — the `BaseProfile.wakeTarget` / `bedtimeTarget` wire format (parsed live as `/^(\d{2}):(\d{2})$/` in `apps/mobile/lib/alarm.ts`). |
| `DatePicker` | Round-trips **`"YYYY-MM-DD"`** for the surfaces that capture a date alongside wake/bed. |
| `ButlerVoice` | The rendered butler-line voice surface — a **thin wrapper composing the existing `ButlerLine` container** (107a determination #7), exposing a `copy` slot for the voice-gated line authored later (Chat 044). Authors no copy; renders nothing when the slot is empty; ONE container (107's). Not a scorekeeping surface. |
| `motion` | Reusable entrance + interaction primitives in the Quick / Considered bands, reading the band/easing tokens (never an inline ms/bezier), each with an explicit reduced-motion → instant fallback. |

### Picker approach (chosen)

No date/time picker library is a dependency of either app. **Web** pickers wrap a
token-skinned **native `<input type="time">` / `<input type="date">`** — the native
time input's value IS exactly `"HH:mm"` and the date input's `"YYYY-MM-DD"`, so they
round-trip the data-layer string with no conversion and no heavy picker dep (matching
TaskForm's native-input convention). **Mobile** has no native datetime input and no
picker dep, so the pickers **compose the `TextField` primitive** as a validated
`"HH:mm"` / `"YYYY-MM-DD"` entry via `onChangeText`; a native wheel/calendar picker is
a later on-device pass.

### Motion mechanism (chosen) + reduced-motion fallback

No web motion library is a dependency, so **web** motion primitives drive entrances /
interactions with **CSS transitions using the preset's token classes** —
`duration-quick` / `duration-considered` (band midpoints), `ease-standard-out`, and
`duration-instant` for the reduced path; `useReducedMotion` reads
`prefers-reduced-motion` and composes on the `globals.css` collapse already in place.
**Mobile** builds on **react-native-reanimated** (a live dep): declarative `FadeIn`
for timed entrances at the band duration, and a spring (the `motion.spring` token,
damping 18 / stiffness 150) for press feedback. Durations + spring are read from the
`@vesper/ui` `motion` token object — never a hardcoded ms/stiffness. Reduced motion is
detected via `AccessibilityInfo.isReduceMotionEnabled` (`useReducedMotion`) and swaps
every animation to **instant** (no entering animation, no spring).

Each part-2 component has a colocated unit test in the shallow 107 shape (web:
`react-dom/server` markup; mobile: call-as-function + read `element.props.className`,
mocking `react-native` and `react-native-reanimated`). These assert token classes /
shapes — not resolved on-device styles.

---

## 3b. Rich posture baseline (Design-Track Re-Overhaul / ADD-D)

The design track returned to a **rich / animated / immersive** posture built from
**code libraries** (the earlier clean-posture re-scope is reversed; the AI-image
GENERATION pipeline stays retired — richness comes from libraries, not generated
stills). Execution runs on the **single build model** (the Fable carve-out is
retired). This section records the baseline the shipped surfaces were lifted to.
Full authority: `docs/PHASE_4_BUILD_PLAN.md` → Addendum ("Design-Track
Re-Overhaul" + chat ADD-D) and the rich-posture banner in `docs/DESIGN_STRATEGY.md`.

### Rich-UI tooling (installed into `@vesper/web`)

| Library | Role | Notes |
|---|---|---|
| `lenis` | Smooth-scroll inertia | Wrapped by the `SmoothScroll` provider; reduced-motion → native scroll. |
| `gsap` | Timeline / ScrollTrigger motion | Reserved for the heavier immersive `-V` surfaces (landing / scroll storytelling). |
| `vanta` + `three` | WebGL animated backgrounds | `three` is vanta's runtime peer. Reserved for the immersive hero (`093-V`). |
| Playwright | Visual / interaction checks | Dev dep + config already present (`apps/web/playwright.config.ts`, root `pnpm playwright`); browsers are a user-run `npx playwright install`. |

`react-bits` (reactbits.dev animated components) is **copy-in via the jsrepo CLI**,
**not** a runtime npm dependency — the npm package named `react-bits` is an unrelated
"common React interfaces" library and is deliberately **not** installed. Components
are copied in per-need when a surface uses one.

**CSP / Decision 13.** The installed libraries were audited for JS `eval` /
`new Function` (three core, vanta, gsap, lenis) — **all zero**. WebGL shader
compilation is GPU-side (`gl.compileShader`), not JS-eval-gated. So **no `script-src`
relaxation was made**; Decision 13's exclusion of `'unsafe-eval'` stays fully intact.
See `docs/CSP_NOTES.md` for the audit. If a future surface adopts three's
worker-based loaders (Draco/KTX2), the minimal addition is `worker-src blob:` —
still far narrower than `'unsafe-eval'`.

### New motion / immersive tokens (names only — values in `tokens.ts`)

- **Elevation** (`boxShadow`): `raised` / `floating` / `press` / `glow` — a warm,
  espresso-tinted shadow set (`glow` is the bronze focus halo). Emits
  `shadow-raised` / `shadow-floating` / `shadow-press` / `shadow-glow`.
- **Easing**: `emphasized` (decelerate-heavy reveal) + `overshoot` (gentle spring
  pop) added alongside the **KEPT** `cinematic` curve. Emits `ease-emphasized` /
  `ease-overshoot`.
- **Backdrop blur**: `veil` (12px) — web-only glass. Emits `backdrop-blur-veil`.

All are mirrored in `DesignTokens.swift` (`VesperElevation`, `VesperMotion`'s
`emphasizedCurve` / `overshootCurve`). The **loosened token-freeze** holds: a new
value enters only as a new token **name**; existing names stay stable; `cinematic`
is kept; reduced-motion → instant remains mandatory on every motion surface.

### New primitives

- **`Reveal`** (web `motion.tsx`) — cinematic-band entrance (rise + blur-clear on
  the emphasized curve) for hero / first-plan moments; reduced-motion shows content
  instantly with no transform/blur.
- **`SmoothScroll`** (web `SmoothScroll.tsx`) — Lenis provider for immersive scroll
  surfaces; constructs Lenis only when `prefers-reduced-motion` is off.

### Shipped surfaces lifted to the rich bar

- **Core primitives** (web): `Card` (rest → hover elevation), `Button` (leather
  raise / press / bronze focus glow + scale press), `BlockRow` (elevation + active
  glow), `ButlerLine` (slow-band cross-fade).
- **Part-2 primitives** (web): `TextField` / `Select` (focus glow), `Toggle`
  (on-state + focus glow), `SegmentedControl` (active + focus glow).
- **Plan surfaces**: `BlockCard`, `BlockTimeline` (via BlockCard), `PlanSkeleton`,
  `PlanEmpty` (web + mobile) — warm elevation, live-block glow, richer CTA press.
- **Mobile**: `Card` carries `shadow-raised` (RN 0.81 boxShadow); the Reanimated
  spring/FadeIn motion set is the mobile rich layer. `weekly-planning` composes the
  enriched `Card`/`Button` primitives and inherits the lift.
- **Settings / integrations** (web): elevated cards, richer connect/disconnect
  buttons. (The `/week` and `/settings` index pages are still route stubs — nothing
  shipped there yet to polish.)

Reduced-motion fallback is preserved everywhere: `globals.css` collapses all
web transitions to instant under `prefers-reduced-motion`, and the mobile set swaps
to instant via `AccessibilityInfo.isReduceMotionEnabled`.

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

# Live Activity Widget — Visual Spec (078)

**Status:** Design-track visual spec (Chat 107). Implemented by the **build track**
(Opus-native, SwiftUI / WidgetKit) — this document is the contract, not the
implementation.
**Tokens:** `apps/mobile/ios/Shared/DesignTokens.swift`.
**Data:** `VesperBlockAttributes.ContentState` in
`apps/mobile/ios/VesperLiveActivity/ActivityModels.swift` — fields: `title`,
`abbreviation` (2-char module code), `blockType` (module slug), `endTime`,
`minutesRemaining`, `nextBlockTitle?`, `nextBlockStart?`. The device recomputes the
countdown from `endTime` each minute.

> Ownership (DESIGN_STRATEGY.md §5): the widget target + app group (077) and the
> three UI variants (078) are build-track-owned; the design track supplies these
> token values and this spec only. Fable does not write the SwiftUI.

The Live Activity tracks the **current block** and shows time remaining. It is calm,
ambient context — never a countdown engineered for urgency, never scorekeeping.

---

## Shared treatment (all three variants)

- **Background:** `VesperColor.surface`. (WidgetKit tints the system container;
  request `surface` where a custom background is allowed, `espresso` where the system
  forces a darker base.)
- **Primary text:** `VesperColor.cream`. **Secondary / labels:** `VesperColor.creamMuted`.
  **Ambient / time-remaining footnote:** `VesperColor.creamFaint`.
- **Accent:** `VesperColor.bronze` — used once per variant, for the module
  abbreviation chip and/or the thin time-progress tick. Bronze marks the active
  block; nothing else competes with it.
- **Module chip:** `abbreviation` in `VesperFont.uiLabelSmall` (Inter, weight .medium,
  tracking 0.04), `VesperColor.bronze` on a `VesperColor.elevated` fill, corner
  `VesperRadius.sm` (4).
- **Times / countdown:** `VesperFont.mono` / `monoSmall` (JetBrains Mono),
  `VesperColor.creamFaint`. Times are mono per Layer 4.
- **Container corners:** `VesperRadius.lg` (12) where the variant draws its own card;
  the Dynamic Island uses the system capsule shape.
- **No progress-bar gamification:** time remaining may render as a calm mono label or
  a single thin tick rail in bronze; never a celebratory/score progress bar (§3).

---

## Variant 1 — Lock Screen / banner (expanded notification)

```
┌──────────────────────────────────────────────┐  ← surface, radius-lg
│ [GY]  Deep work                       42 min │  ← chip + title (Body) … remaining (mono)
│       ends 09:30 · next: Lunch at 09:30       │  ← meta (Body small / creamMuted)
└──────────────────────────────────────────────┘
```

- **Row 1:** module chip (shared treatment) · `title` in `VesperFont.body`
  (`VesperColor.cream`, single line, truncate) · right-aligned
  `"\(minutesRemaining) min"` in `VesperFont.mono` (`VesperColor.creamFaint`).
- **Row 2:** `"ends HH:mm"` from `endTime`; when `nextBlockTitle` is present append
  `" · next: \(nextBlockTitle) at HH:mm"` from `nextBlockStart`. `VesperFont.bodySmall`,
  `VesperColor.creamMuted`. Omit the "next" clause entirely when not pre-armed.
- **Padding:** `VesperSpacing.s4` (16) container inset, `VesperSpacing.s2` (8) between
  rows, `VesperSpacing.s3` (12) between chip and title.

## Variant 2 — Dynamic Island, compact

```
 (•[GY])                          ( 42m )
  leading                          trailing
```

- **Leading:** module `abbreviation` in `VesperFont.uiLabelSmall`, `VesperColor.bronze`.
- **Trailing:** `"\(minutesRemaining)m"` in `VesperFont.monoSmall`,
  `VesperColor.creamFaint`.
- **Minimal (single-island fallback):** the bronze `abbreviation` only.
- Keep both sides to ≤3 glyphs; no title in compact.

## Variant 3 — Dynamic Island, expanded

```
┌ leading ───────────────┬──────────── trailing ┐
│ [GY] Deep work         │              42 min  │  ← title (Body) · remaining (mono)
├ center ─────────────────────────────────────── ┤
│ ends 09:30                                      │  ← meta (Body small / creamMuted)
└ bottom ──────────────────────────────────────── ┘
│ next: Lunch · 09:30        (only when pre-armed) │  ← creamFaint, mono time
```

- **Leading region:** chip + `title` (`VesperFont.body`, `VesperColor.cream`).
- **Trailing region:** `"\(minutesRemaining) min"` (`VesperFont.mono`,
  `VesperColor.creamFaint`).
- **Center region:** `"ends HH:mm"` (`VesperFont.bodySmall`, `VesperColor.creamMuted`).
- **Bottom region:** only rendered when `nextBlockTitle != nil` —
  `"next: \(nextBlockTitle) · HH:mm"`, `VesperColor.creamFaint`, mono time.

---

## Motion

- **Content updates** (minute tick, block change): cross-fade on
  `VesperMotion.considered` (0.4s), `standardOut` curve. WidgetKit owns the
  transition; request no faster than `quick` and no slower than `considered`.
- **Reduced motion** (`UIAccessibility.isReduceMotionEnabled`): `VesperMotion.instant`
  — values swap with no animation.
- No looping/ambient animation in the widget (battery + the calm posture).

## Scorekeeping discipline

The widget shows the current block, the module, and minutes remaining — no score,
grade, streak, count-of-completed, or progress-bar gamification. (§3.)

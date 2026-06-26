# iOS Alarm Screen — Visual Spec (059b)

**Status:** Design-track visual spec (Chat 107). Implemented by the **build track**
(native Swift, SwiftUI) — this document is the contract, not the implementation.
**Tokens:** `apps/mobile/ios/Shared/DesignTokens.swift` (the Swift mirror of
`packages/ui/src/tokens.ts`). Every value below names a token; the build track must
not re-derive a hex, size, radius, or duration.

> Ownership (DESIGN_STRATEGY.md §5): the alarm screen is a Notification Service /
> Content Extension with custom two-button UI, built in SwiftUI by the build track
> from this spec. The design track does **not** write the Swift.

---

## 1. Purpose & surface

The full-screen, edge-to-edge alarm surface shown above the system action buttons on
the lock screen when a Vesper wake alarm fires (`UNNotificationContentExtension`,
`UNNotificationExtensionDefaultContentHidden = true`). It replaces
`AlarmContentView.swift`'s current ad-hoc styling with token-driven values.

The actual dismiss-capable controls are the category's `UNNotificationActions`
(registered from RN in `apps/mobile/lib/alarm.ts`). The two buttons drawn here are
the **visual affordances** that mirror those actions and fill the width.

## 2. Layout (top → bottom)

```
┌───────────────────────────────────────────────┐  ← VesperColor.espresso, ignoresSafeArea
│                                                │
│                  (Spacer)                      │
│                                                │
│                  07:24                         │  ← wake time, Display 1 role
│              Good morning                      │  ← greeting, butler line (Fraunces italic)
│                                                │
│                  (Spacer)                      │
│                                                │
├───────────────────────────────────────────────┤  ← 1px hairline, lineStrong @ ~0.2 alpha
│                  SNOOZE                         │  ← secondary affordance (outlined/text)
├───────────────────────────────────────────────┤  ← 1px hairline divider
│                   STOP                          │  ← PRIMARY affordance (filled bronze)
└───────────────────────────────────────────────┘
```

- **Background:** `VesperColor.espresso`, `ignoresSafeArea()`. No gradient, no image.
- **Vertical rhythm:** `Spacer` above and below the time/greeting cluster so it sits
  optically centered; the button stack is pinned to the bottom edge.
- **Cluster spacing:** `VesperSpacing.s3` (12) between the time and the greeting.

## 3. Type

| Element | Token role | Notes |
|---|---|---|
| Wake time (`07:24`) | `VesperFont.display1` (Fraunces, weight .medium, opsz 24) | The single hero. Render at the lower end of the band (~48pt) so two digits + colon never truncate on the narrowest device. `VesperColor.cream`. |
| Greeting (`Good morning`) | `VesperFont.butlerLine` (Fraunces **italic**, weight .regular, opsz 9, line-height 1.4) | `VesperColor.creamFaint`. Butler voice; copy is gated/supplied, default "Good morning". |
| Button labels | `VesperFont.uiLabel` (Inter, weight .medium, tracking 0.02) | Uppercased, letter-spaced. |

> The current file renders the greeting in serif but not italic and at the wrong
> cream; adopt `butlerLine` + `VesperColor.creamFaint`.

## 4. The two-button treatment

Two full-width stacked affordances, no gap, separated by 1px hairlines.

- **STOP — the single primary action.** Filled `VesperColor.bronze`, label
  `VesperColor.espresso`. This is the one bronze element on the surface; nothing
  else competes with it (bronze discipline).
- **SNOOZE — secondary.** Transparent fill, label `VesperColor.cream`, sitting
  above STOP. No border fill; separated from STOP and from the content cluster by a
  1px hairline in `VesperColor.lineStrong` at ~0.2 alpha.
- **Hit area:** vertical padding `VesperSpacing.s5`–`s6` (20–24) so each button is a
  comfortable full-width tap target; `frame(maxWidth: .infinity)`.
- **Corners:** the buttons are edge-to-edge bands → `VesperRadius.none` is acceptable
  here **because they are full-bleed sections, not free-standing controls** (the
  "minimum radius-sm" rule applies to inset interactive elements). Keep them flush.

## 5. Motion

- **Appearance:** the surface is presented by the system; do not add an entrance
  animation that fights the notification present. If any emphasis is used on the time
  cluster, it is a single `VesperMotion.considered` (0.4s) fade/settle on the
  `standardOut` curve — at most one orchestrated moment.
- **Press feedback:** `VesperMotion.quick` (0.2s) dim on the filled STOP button.
- **Reduced motion:** when `UIAccessibility.isReduceMotionEnabled`, drop to
  `VesperMotion.instant` (0) — the surface appears with no animated reveal.

## 6. Scorekeeping discipline

No grade, score, streak, count, or progress chrome appears on the alarm surface — it
shows the time and two actions only. (DESIGN_STRATEGY.md §3.)

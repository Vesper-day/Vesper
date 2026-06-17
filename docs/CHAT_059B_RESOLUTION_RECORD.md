# Chat 059b Resolution Record — iOS native alarm screen (Windows-committable slice)

Authored on Windows. Native integration (`expo prebuild`, Xcode target, on-device
alarm-fire test) is **deferred to a Mac session** and gated on **Apple Developer
enrollment (C-04)**. See `docs/RUNBOOKS/IOS_ALARM_REBUILD.md`.

## Scope delivered (committable now)

- `apps/mobile/lib/alarm.ts` — local-notification scheduling + SNOOZE(9 min)/STOP
  + foreground `alarm_fired` sync.
- `apps/mobile/lib/analytics.ts` — thin typed `track()` seam (no PostHog wiring;
  chat 096 wires it). Autocapture OFF [ARCHITECTURE_DECISIONS Decision 08].
- `apps/mobile/ios/VesperAlarmExtension/*` — native source authored as committed
  text only (not compiled here).
- `apps/mobile/app.config.js` — one line: main-app time-sensitive entitlement.
- `apps/mobile/lib/alarm.test.ts` — focused vitest.

## Key decisions

### Extension architecture (build-plan vs PRD tension)
The build plan says "Notification Service Extension"; the PRD wants a full-screen
lock-screen alarm with two edge-to-edge SNOOZE/STOP buttons dismissible without
unlock. Resolved as:
- **`UNNotificationCategory` "vesperalarm" + two `UNNotificationActions`** — the
  SNOOZE/STOP buttons and the dismiss-without-unlock behavior. Registered at
  runtime from RN (`registerAlarmCategory`).
- **`UNNotificationContentExtension`** — the edge-to-edge SwiftUI surface, and the
  site that stamps `fired_at`.
- **No `UNNotificationServiceExtension`.** A Service Extension only runs for remote
  mutable-content pushes; it is **never invoked for a local scheduled
  notification**, so it cannot stamp `fired_at`. Dropped deliberately.

### Dismiss-without-unlock
Controlled by `isAuthenticationRequired:false` on BOTH actions — set explicitly.
`opensAppToForeground:false` governs background handling only and does NOT control
unlock.

### Interruption level
`timeSensitive`, NOT `critical` — critical is reserved for emergency alerts and
needs a separate Apple-granted entitlement [PRD §3.2].

### wake-target source (corrected)
Read from the canonical, top-level `baseProfile.wakeTarget` (HH:MM) — the single
source of truth after Chat 111 (`docs/CHAT_111_RESOLUTION_RECORD.md`). The pre-111
`preferences.wakeTarget` path no longer exists. The `BaseProfile` type is imported
from `@vesper/shared` (a type-only re-export of `@vesper/db`) so no `@vesper/db`
value reaches the mobile bundle. A not-yet-onboarded user's `'{}'` base_profile is
rejected by `BaseProfileSchema` (parse throws), so the fetch is wrapped in
try/catch: on throw — or on absent/invalid `wakeTarget` — `scheduleAlarm` returns
null and emits nothing.

## Events (TECHNICAL_SPEC §11, verbatim)
- `alarm_scheduled` `{ wake_target_local, scheduled_at, snooze_minutes }` (snooze_minutes = 9)
- `alarm_fired` `{ fired_at, latency_from_target_ms }`
- `alarm_dismissed` `{ action, dismissed_at }` (action ∈ 'snooze' | 'stop')

---

## RECORD 1 — `fired_at` measures target→shown, not target→delivery

`fired_at` is stamped in the Content Extension's `didReceive(_:)`, which fires when
the custom alarm UI is **DISPLAYED** (≈ when the alarm is shown), not strictly at
notification delivery. Therefore `latency_from_target_ms` measures
**target → shown**, not target → delivery. **Chat 096** must read the metric with
that meaning when registering/charting the `alarm_fired` event — it is a
display-latency, and is also subject to the Content Extension's
`UNNotificationServiceExtension`-free path (local notifications have no
mutable-content pre-display hook).

## RECORD 2 — STOP → energy check-in is OUT OF SCOPE for 059b (known follow-up)

PRD §3.2 says STOP advances to the energy check-in. But STOP is a **no-unlock**
action (`opensAppToForeground:false`), so it cannot launch the app. The
reconciliation: the energy check-in is the **"first interaction of the day"** shown
on the **next foreground**, not driven by the STOP tap itself. STOP→energy-check-in
routing is **not in the 059b build-plan Output** and is **not implemented here**.
Logged explicitly as a **known follow-up for the screen-flow chat** — do not treat
it as silently dropped. `handleAlarmResponse` STOP path only cancels the scheduled
notification and emits `alarm_dismissed{action:'stop'}`.

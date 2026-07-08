// Mobile day-rollover hook (build chat 040 — RN parity with web 039's
// apps/web/hooks/useDayRollover.ts).
//
// When the user's local clock crosses midnight, advance the displayed plan date to the
// new local day so usePlanQuery re-fires for ['plan', <new date>].
//
// DUAL MECHANISM (RN twin of the web visibilitychange + poll pair):
//   1. AppState 'active' → an IMMEDIATE check when the app is foregrounded, catching
//      "phone slept past midnight, user reopened the app" instantly. This is the RN
//      app-lifecycle signal (NOT the web-only visibilitychange, NOT expo-notifications).
//   2. a 60s polling interval → the always-on fallback for an app that stays foregrounded
//      across the boundary (and a backstop if #1 is missed).
// Both call the same pure hasRolledOver check, so neither advances early. The advance
// target is the CURRENT local date, so an app that slept across several midnights snaps
// straight to today in one step.
//
// FOREGROUND SEAM (same limitation usePlanRealtime documents): the chat-013
// useAppLifecycle() is `(): void` with no callback seam and is already mounted at the
// root (via useBiometricLock), where it invalidates ['plan'] on foreground. It exposes no
// hook to drive this date-advance, so — exactly as usePlanRealtime does for its socket —
// this hook attaches its own AppState listener rather than a second useAppLifecycle mount.
//
// Read-only: this hook only advances a date; it never mutates plan data.
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { hasRolledOver, localDateInTimeZone } from '../components/plan/planViewHelpers';

const POLL_INTERVAL_MS = 60_000;

export function useDayRollover(
  displayedDate: string | null,
  timeZone: string,
  onRollover: (nextDate: string) => void,
): void {
  useEffect(() => {
    if (!displayedDate) return;

    const check = (): void => {
      const now = new Date();
      if (hasRolledOver(displayedDate, now, timeZone)) {
        onRollover(localDateInTimeZone(timeZone, now));
      }
    };

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') check();
    });
    const interval = setInterval(check, POLL_INTERVAL_MS);
    // Run once on mount in case we mounted already past midnight.
    check();

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [displayedDate, timeZone, onRollover]);
}

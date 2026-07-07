import { useEffect } from 'react';
import { localDateInTimeZone } from '@/lib/dates/localDate';
import { hasRolledOver } from '@/components/plan/planViewHelpers';

/**
 * Day-rollover hook (build chat 039). When the user's local clock crosses
 * midnight, advance the displayed plan date to the new local day so usePlanQuery
 * re-fires for ['plan', <new date>].
 *
 * DUAL MECHANISM — a single setTimeout-to-midnight is unreliable because a
 * backgrounded tab's timers are throttled (a 6-hour-away timeout can fire minutes
 * late), so we use two triggers:
 *   1. visibilitychange → an IMMEDIATE check when the tab is foregrounded, which
 *      catches "laptop slept past midnight, user reopened the tab" instantly.
 *   2. a 60s polling interval → the always-on fallback for a tab that stays open
 *      and foregrounded across the boundary (and a backstop if #1 is missed).
 * Both call the same pure hasRolledOver check, so neither can advance early. The
 * advance target is the CURRENT local date (localDateInTimeZone) — so even a tab
 * that slept across several midnights snaps straight to today in one step.
 *
 * `timeZone` is the IANA zone used for the local-midnight math (the browser zone
 * in practice; the authoritative per-user zone is users.timezone server-side).
 * Read-only: this hook only advances a date; it never mutates plan data.
 */
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

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') check();
    };

    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(check, POLL_INTERVAL_MS);
    // Run once on mount in case we mounted already past midnight.
    check();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, [displayedDate, timeZone, onRollover]);
}

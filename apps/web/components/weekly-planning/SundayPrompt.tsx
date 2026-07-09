'use client';

// SundayPrompt — the dismissible Sunday-morning weekly-planning nudge (Chat 057),
// hosted in the web day/plan view (apps/web/app/(app)/plan/page.tsx). Renders the
// PRE-AUTHORED butler line through the landed 107 ButlerLine container and links into
// the session surface (/weekly-planning). No new copy is authored here and no voice
// gate runs — the two lines are transcribed verbatim from PRD §6.7:
//   prompt:   "Sunday. Shall we look at the week?"
//   skipped:  "Right. We'll keep things as they are."
//
// DISMISSAL (DECISION C): client-only, NO API/DB. Persisted in localStorage keyed by
// userId + the target week's weekStartDate, read behind a client-only effect (never
// during SSR render — avoids a hydration mismatch). It re-appears next Sunday (the
// target Monday changes) and does not leak across account switches on a shared device.
//
// VISIBILITY: shown only on the local Sunday, only once auth has a userId, and only
// while not dismissed for this target week. The skipped line shows briefly after a
// dismiss, then the prompt unmounts itself.
//
// IMPORT SAFETY: imports the ButlerLine primitive + client-safe week helpers only —
// no bare @vesper/shared barrel (which would pull server code into the client bundle).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ButlerLine } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { comingMonday, dismissalKey, isLocalSunday } from '@/lib/weekly-planning/week';

const PROMPT_LINE = 'Sunday. Shall we look at the week?';
const SKIPPED_LINE = "Right. We'll keep things as they are.";
const SKIPPED_VISIBLE_MS = 4000;

export function SundayPrompt(): React.JSX.Element | null {
  const userId = useAuthStore((s) => s.currentUser?.id);

  // Sunday gate + target week are evaluated on the client only (avoids SSR/CSR skew).
  const [mounted, setMounted] = useState(false);
  const [weekStartDate, setWeekStartDate] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isLocalSunday()) return;
    setWeekStartDate(comingMonday());
  }, []);

  // Read the persisted dismissal once we know the user + target week (client-only).
  useEffect(() => {
    if (!userId || !weekStartDate) return;
    try {
      const stored = window.localStorage.getItem(dismissalKey(userId, weekStartDate));
      if (stored === '1') setDismissed(true);
    } catch {
      // localStorage unavailable (private mode / disabled) — treat as not dismissed.
    }
  }, [userId, weekStartDate]);

  // Auto-unmount the skipped acknowledgement after a beat.
  useEffect(() => {
    if (!showSkipped) return;
    const t = setTimeout(() => setDismissed(true), SKIPPED_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [showSkipped]);

  // Not on the client yet, not Sunday, or no signed-in user → render nothing.
  if (!mounted || !weekStartDate || !userId) return null;

  const handleDismiss = (): void => {
    try {
      window.localStorage.setItem(dismissalKey(userId, weekStartDate), '1');
    } catch {
      // Best-effort — if persistence fails the prompt simply reappears next load.
    }
    setShowSkipped(true);
  };

  if (dismissed) return null;

  if (showSkipped) {
    return (
      <div className="mb-4 rounded-lg border border-line-subtle bg-surface px-4 py-3">
        <ButlerLine>{SKIPPED_LINE}</ButlerLine>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-line-subtle bg-surface px-4 py-3">
      <ButlerLine>{PROMPT_LINE}</ButlerLine>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          // New route: the typedRoutes .next/types are stale until a build regen. The
          // UrlObject form ({ pathname }) satisfies Link's `UrlObject | RouteImpl` union
          // without depending on the not-yet-generated literal route type.
          href={{ pathname: '/weekly-planning' }}
          className="rounded-md bg-bronze px-3 py-1.5 text-sm font-medium tracking-wider text-espresso"
        >
          Look at the week
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md px-3 py-1.5 text-sm text-cream-muted hover:text-cream"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

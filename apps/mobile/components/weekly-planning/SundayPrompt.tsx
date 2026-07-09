// SundayPrompt — the dismissible Sunday-morning weekly-planning nudge (Chat 057),
// mounted in the mobile day view (apps/mobile/app/(tabs)/plan.tsx). RN parity of the
// web SundayPrompt: it renders the PRE-AUTHORED butler line through the landed 107
// ButlerLine and links into the session surface (/weekly-planning). No new copy is
// authored and no voice gate runs — the two lines are transcribed verbatim from
// PRD §6.7:
//   prompt:   "Sunday. Shall we look at the week?"
//   skipped:  "Right. We'll keep things as they are."
//
// DISMISSAL (DECISION C): client-only, NO API/DB. Persisted via the EXISTING mobile
// secure-store helper (lib/auth/secureStorage — the same expo-secure-store adapter the
// device_id uses), keyed by userId + the target week's weekStartDate. It re-appears
// next Sunday and does not leak across account switches on a shared device. No new
// storage dependency is added.
//
// VISIBILITY: shown only on the local Sunday, only once auth has a userId, and only
// while not dismissed for this target week.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, type Href } from 'expo-router';
import { ButlerLine } from '../ui/ButlerLine';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { secureStorageAdapter } from '../../lib/auth/secureStorage';
import { useAuthStore } from '../../store/auth';
import { comingMonday, isLocalSunday } from '../../lib/weeklyPlanning';

const PROMPT_LINE = 'Sunday. Shall we look at the week?';
const SKIPPED_LINE = "Right. We'll keep things as they are.";
const SKIPPED_VISIBLE_MS = 4000;

function dismissalKey(userId: string, weekStartDate: string): string {
  return `weekly-planning.dismissed.${userId}.${weekStartDate}`;
}

export function SundayPrompt(): React.JSX.Element | null {
  const userId = useAuthStore((s) => s.user?.id);

  const [weekStartDate, setWeekStartDate] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  // Evaluate the Sunday gate + target week once on mount.
  useEffect(() => {
    if (isLocalSunday()) setWeekStartDate(comingMonday());
  }, []);

  // Read the persisted dismissal once the user + target week are known.
  useEffect(() => {
    if (!userId || !weekStartDate) return;
    let cancelled = false;
    void (async () => {
      try {
        const stored = await secureStorageAdapter.getItem(dismissalKey(userId, weekStartDate));
        if (!cancelled && stored === '1') setDismissed(true);
      } catch {
        // Secure store unavailable — treat as not dismissed.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, weekStartDate]);

  // Auto-unmount the skipped acknowledgement after a beat.
  useEffect(() => {
    if (!showSkipped) return;
    const t = setTimeout(() => setDismissed(true), SKIPPED_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [showSkipped]);

  if (!weekStartDate || !userId || dismissed) return null;

  const handleDismiss = (): void => {
    void secureStorageAdapter.setItem(dismissalKey(userId, weekStartDate), '1').catch(() => undefined);
    setShowSkipped(true);
  };

  if (showSkipped) {
    return (
      <Card className="mb-4 px-4 py-3">
        <ButlerLine>{SKIPPED_LINE}</ButlerLine>
      </Card>
    );
  }

  return (
    <Card className="mb-4 px-4 py-3">
      <ButlerLine>{PROMPT_LINE}</ButlerLine>
      <View className="mt-3 flex-row items-center gap-2">
        <Button
          title="Look at the week"
          variant="primary"
          className="flex-1"
          // New route: expo-router's generated types are stale until regen — cast.
          onPress={() => router.push('/weekly-planning' as Href)}
        />
        <Button title="Not now" variant="ghost" onPress={handleDismiss} />
      </View>
    </Card>
  );
}

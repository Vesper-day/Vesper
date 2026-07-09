// Mobile weekly-planning session surface — Steps 1–3 (Chat 057; RN parity with the
// web apps/web/app/(app)/weekly-planning/page.tsx).
//
// MOUNT NOTE: mobile has no (app) route group — the app is a root Stack over (auth) +
// (tabs) (app/_layout.tsx). Placing this under (tabs) would register a stray 5th tab,
// so the session lives as a ROOT stack screen (app/weekly-planning.tsx), pushed over
// the tabs by the Sunday prompt via router.push('/weekly-planning'). The fixed
// four-tab bar is left untouched.
//
//   Step 1  Prior-week review    — completion % from completion_log block events
//                                  (GET /weekly-review), plain review context (no
//                                  score/streak/progress-bar). Empty week → "nothing
//                                  to review yet".
//   Step 2  Priority entry       — 3–5 rows seeded from an AI pre-suggestion (POST
//                                  /weekly-priorities/suggest via the seam) or the
//                                  saved week, overwritable; edit flips ai_suggested →
//                                  user. Submit PUTs /weekly-priorities.
//   Step 3  Upcoming-week events — READ-ONLY review of the target week's fixed events
//                                  (Mon–Sun); link out to the Calendar tab; Confirm
//                                  advances and PERSISTS NOTHING.
//
// All server logic is reached through the thin client (lib/weeklyPlanning + lib/tasks)
// — this file imports NO @vesper/ai and NO @vesper/db.
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { ButlerLine } from '../components/ui/ButlerLine';
import {
  getWeeklyPriorities,
  getPriorWeekCompletion,
  suggestPriorities,
  putWeeklyPriorities,
  listWeekEvents,
  comingMonday,
  addDays,
  type CalendarEventInstance,
  type WeeklyReview,
} from '../lib/weeklyPlanning';
import { listTasks } from '../lib/tasks';
import {
  buildPrioritiesSubmission,
  editRowText,
  PriorityCountError,
  type PriorityRow,
} from '../lib/buildPrioritiesSubmission';

const MIN_ROWS = 3;
const MAX_ROWS = 5;
const C = { bronze: '#B8884A' } as const;

function emptyRows(n: number): PriorityRow[] {
  return Array.from({ length: n }, () => ({ text: '', source: 'user' as const }));
}

type Step = 'review' | 'priorities' | 'events' | 'done';

export default function WeeklyPlanningScreen(): React.JSX.Element {
  const targetMonday = useMemo(() => comingMonday(), []);
  const priorMonday = useMemo(() => addDays(targetMonday, -7), [targetMonday]);

  const [step, setStep] = useState<Step>('review');

  const reviewQuery = useQuery({
    queryKey: ['weekly-review', targetMonday],
    queryFn: () => getPriorWeekCompletion(targetMonday),
  });
  const existingQuery = useQuery({
    queryKey: ['weekly-priorities', targetMonday],
    queryFn: () => getWeeklyPriorities(targetMonday),
  });

  return (
    <View className="flex-1 bg-espresso">
      <ScrollView contentContainerClassName="p-4">
        <View className="mb-5">
          <Text className="text-2xl font-semibold text-cream">Weekly planning</Text>
          <Text className="text-sm text-cream-muted">Setting up the week of {targetMonday}.</Text>
        </View>

        {step === 'review' && (
          <ReviewStep
            isLoading={reviewQuery.isLoading}
            isError={reviewQuery.isError}
            review={reviewQuery.data}
            onNext={() => setStep('priorities')}
          />
        )}

        {step === 'priorities' && (
          <PrioritiesStep
            targetMonday={targetMonday}
            priorMonday={priorMonday}
            existing={existingQuery.data?.priorities}
            existingLoaded={existingQuery.isSuccess}
            review={reviewQuery.data}
            onSaved={() => setStep('events')}
          />
        )}

        {step === 'events' && (
          <EventsStep targetMonday={targetMonday} onConfirm={() => setStep('done')} />
        )}

        {step === 'done' && (
          <Card className="p-6">
            <ButlerLine>The week is set. I&apos;ll take it from here.</ButlerLine>
            <View className="mt-4">
              <Button
                title="Back to today"
                variant="secondary"
                onPress={() => router.replace('/(tabs)/plan')}
              />
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

// --- Step 1: prior-week review ----------------------------------------------

function ReviewStep({
  isLoading,
  isError,
  review,
  onNext,
}: {
  isLoading: boolean;
  isError: boolean;
  review: WeeklyReview | undefined;
  onNext: () => void;
}): React.JSX.Element {
  return (
    <Card className="p-6">
      <Text className="mb-2 text-lg font-medium text-cream">Last week</Text>
      {isLoading ? (
        <Text className="text-sm text-cream-muted">Looking back…</Text>
      ) : isError ? (
        <Text className="text-sm text-oxblood">Could not load last week.</Text>
      ) : !review || review.rate === null ? (
        <Text className="text-sm text-cream-muted">Nothing to review yet.</Text>
      ) : (
        <Text className="text-sm text-cream">
          Of the {review.total} blocks you actioned last week, you completed {review.completed} —{' '}
          {Math.round(review.rate * 100)}%.
        </Text>
      )}
      <View className="mt-5">
        <Button title="Set this week's priorities" variant="primary" onPress={onNext} />
      </View>
    </Card>
  );
}

// --- Step 2: priority entry -------------------------------------------------

function PrioritiesStep({
  targetMonday,
  priorMonday,
  existing,
  existingLoaded,
  review,
  onSaved,
}: {
  targetMonday: string;
  priorMonday: string;
  existing: Array<{ text: string; source: 'user' | 'ai_suggested' }> | undefined;
  existingLoaded: boolean;
  review: WeeklyReview | undefined;
  onSaved: () => void;
}): React.JSX.Element {
  const [rows, setRows] = useState<PriorityRow[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rows !== null || !existingLoaded) return;

    if (existing && existing.length > 0) {
      setRows(existing.map((p) => ({ text: p.text, source: p.source })));
      return;
    }

    let cancelled = false;
    setSuggesting(true);
    void (async () => {
      try {
        const [tasks, prior] = await Promise.all([
          listTasks('pending').catch(() => []),
          getWeeklyPriorities(priorMonday).catch(() => null),
        ]);
        const suggestions = await suggestPriorities({
          outstandingTasks: tasks.map((t) => ({
            title: t.title,
            priority: t.priority,
            estimatedMinutes: t.estimatedMinutes,
          })),
          priorWeekCompletion: {
            completed: review?.completed ?? 0,
            total: review?.total ?? 0,
            priorPriorities: prior?.priorities.map((p) => p.text),
          },
        });
        if (!cancelled) {
          setRows(suggestions.map((text) => ({ text, source: 'ai_suggested' as const })));
        }
      } catch {
        if (!cancelled) setRows(emptyRows(MIN_ROWS));
      } finally {
        if (!cancelled) setSuggesting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rows, existingLoaded, existing, priorMonday, review]);

  const current = rows ?? emptyRows(MIN_ROWS);

  const setRowText = (i: number, text: string): void =>
    setRows((prev) => {
      const base = prev ?? emptyRows(MIN_ROWS);
      return base.map((r, idx) => (idx === i ? editRowText(r, text) : r));
    });

  const addRow = (): void =>
    setRows((prev) => {
      const base = prev ?? emptyRows(MIN_ROWS);
      return base.length >= MAX_ROWS ? base : [...base, { text: '', source: 'user' }];
    });

  const removeRow = (i: number): void =>
    setRows((prev) => {
      const base = prev ?? emptyRows(MIN_ROWS);
      return base.length <= MIN_ROWS ? base : base.filter((_, idx) => idx !== i);
    });

  const submit = async (): Promise<void> => {
    setError(null);
    let priorities;
    try {
      priorities = buildPrioritiesSubmission(current);
    } catch (e) {
      setError(
        e instanceof PriorityCountError
          ? 'Please enter between 3 and 5 priorities.'
          : 'Something looks off with your priorities.',
      );
      return;
    }
    setSaving(true);
    try {
      await putWeeklyPriorities(targetMonday, priorities);
      onSaved();
    } catch {
      setError('Could not save your priorities. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <Text className="mb-1 text-lg font-medium text-cream">This week&apos;s priorities</Text>
      <Text className="mb-4 text-sm text-cream-muted">
        Three to five. Overwrite anything I&apos;ve suggested.
      </Text>

      {suggesting ? (
        <ActivityIndicator color={C.bronze} className="my-6" />
      ) : (
        <View className="gap-2">
          {current.map((row, i) => (
            <View key={i} className="flex-row items-center gap-2">
              <TextField
                value={row.text}
                onChangeText={(text) => setRowText(i, text)}
                placeholder={`Priority ${i + 1}`}
                className="flex-1"
              />
              {row.source === 'ai_suggested' && (
                <Text className="text-xs text-cream-faint">suggested</Text>
              )}
              <Button
                title="Remove"
                variant="ghost"
                disabled={current.length <= MIN_ROWS}
                onPress={() => removeRow(i)}
              />
            </View>
          ))}
          {current.length < MAX_ROWS && (
            <Button title="Add priority" variant="ghost" onPress={addRow} className="self-start" />
          )}
        </View>
      )}

      {error && <Text className="mt-3 text-sm text-oxblood">{error}</Text>}

      <View className="mt-5">
        <Button
          title={saving ? 'Saving…' : 'Save and review the week'}
          variant="primary"
          disabled={saving || suggesting}
          onPress={() => void submit()}
        />
      </View>
    </Card>
  );
}

// --- Step 3: upcoming-week fixed events (read-only) -------------------------

function EventsStep({
  targetMonday,
  onConfirm,
}: {
  targetMonday: string;
  onConfirm: () => void;
}): React.JSX.Element {
  const eventsQuery = useQuery({
    queryKey: ['weekly-planning-events', targetMonday],
    queryFn: () => listWeekEvents(targetMonday),
  });

  const events = useMemo(
    () => (eventsQuery.data ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [eventsQuery.data],
  );

  const fmt = (iso: string): string =>
    new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <Card className="p-6">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-lg font-medium text-cream">Fixed events this week</Text>
        <Button
          title="Edit in Calendar"
          variant="ghost"
          onPress={() => router.replace('/(tabs)/calendar')}
        />
      </View>
      <Text className="mb-4 text-sm text-cream-muted">The week of {targetMonday}. Review only.</Text>

      {eventsQuery.isLoading ? (
        <ActivityIndicator color={C.bronze} className="my-4" />
      ) : eventsQuery.isError ? (
        <Text className="py-4 text-sm text-oxblood">Could not load your calendar.</Text>
      ) : events.length === 0 ? (
        <Text className="py-4 text-sm text-cream-muted">Nothing fixed this week.</Text>
      ) : (
        <View className="gap-2">
          {events.map((e: CalendarEventInstance, i) => (
            <View
              key={`${e.id}-${e.startTime}-${i}`}
              className="flex-row items-center justify-between rounded-md border border-line-subtle px-3 py-2"
            >
              <Text className="flex-1 pr-2 text-sm text-cream">{e.title}</Text>
              <Text className="text-xs text-cream-muted">
                {fmt(e.startTime)}
                {e.recurring ? '  ↻' : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View className="mt-5">
        <Button title="Looks right" variant="primary" onPress={onConfirm} />
      </View>
    </Card>
  );
}

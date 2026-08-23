'use client';

// Web weekly-planning session surface — Steps 1–3 (Chat 057).
//
//   Step 1  Prior-week review  — a completion percentage from completion_log block
//                                events (GET /weekly-review), rendered as PLAIN review
//                                context (no score/streak/badge/progress-bar —
//                                scorekeeping-as-absence). Empty prior week → a plain
//                                "nothing to review yet" state, not 0% styled as a grade.
//   Step 2  Priority entry     — 3–5 rows seeded from an AI pre-suggestion (POST
//                                /weekly-priorities/suggest) or the already-saved week,
//                                overwritable; editing a pre-filled row flips its source
//                                ai_suggested → user. Submit PUTs /weekly-priorities.
//   Step 3  Upcoming-week events — READ-ONLY review of the target week's fixed events
//                                (GET /calendar-events over the Mon–Sun window); a link
//                                out to the Calendar surface for edits; Confirm advances
//                                and PERSISTS NOTHING.
//
// Steps 4+ / plan regeneration / the regeneration handoff are OUT OF SCOPE.
//
// The target planning week is the COMING Monday (a Sunday session plans the week
// ahead); the reviewed prior week is the week just ending. All server logic is reached
// through /api/v1 (the @/lib/api helper) — this file imports NO @vesper/ai and NO bare
// @vesper/shared barrel (client-safe pieces come from subpaths / local declarations).
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Card, TextField, ButlerLine } from '@/components/ui';
import {
  buildPrioritiesSubmission,
  editRowText,
  PriorityCountError,
  type PriorityRow,
} from '@/lib/weekly-planning/buildPrioritiesSubmission';
import { addDays, comingMonday, weekWindow } from '@/lib/weekly-planning/week';
import { Step4ModuleAdjustments } from './Step4ModuleAdjustments';
import { Step5ReviewGrid } from './Step5ReviewGrid';
import type { WeekConstraints } from '@/lib/weekly-planning/weekConstraints';
import { WEEK_REVIEW_ACCEPTED_LINE } from '@vesper/shared/copy';

// --- Local response types (no @vesper/shared barrel) ------------------------

interface WeeklyReview {
  weekStartDate: string;
  priorWeekStart: string;
  completed: number;
  total: number;
  rate: number | null;
}
interface PriorityItem {
  text: string;
  source: 'user' | 'ai_suggested';
  completedAt: string | null;
}
interface WeeklyPrioritiesResponse {
  weekPriorities: { id: string | null; weekStartDate: string; priorities: PriorityItem[] };
}
interface TaskItem {
  title: string;
  priority: string;
  estimatedMinutes: number;
  status: string;
}
interface CalendarInstance {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  recurring: boolean;
}

// Steps 1-3 (Chat 057) + Steps 4-5 (Chat 058): module adjustments, then the
// seven-day generation + review grid, then the accepted "week is set" state.
type Step = 'review' | 'priorities' | 'events' | 'adjust' | 'review-week' | 'done';

const MAX_ROWS = 5;
const MIN_ROWS = 3;

function emptyRows(n: number): PriorityRow[] {
  return Array.from({ length: n }, () => ({ text: '', source: 'user' as const }));
}

export default function WeeklyPlanningPage(): React.JSX.Element {
  const targetMonday = useMemo(() => comingMonday(), []);
  const priorMonday = useMemo(() => addDays(targetMonday, -7), [targetMonday]);
  const window = useMemo(() => weekWindow(targetMonday), [targetMonday]);

  const [step, setStep] = useState<Step>('review');
  // Step-4 transient constraints, carried into the Step-5 generation.
  const [constraints, setConstraints] = useState<WeekConstraints | null>(null);

  // --- Reads ---------------------------------------------------------------
  const reviewQuery = useQuery({
    queryKey: ['weekly-review', targetMonday],
    queryFn: () => api.get<{ weeklyReview: WeeklyReview }>(`/weekly-review?weekStart=${targetMonday}`),
  });
  const existingQuery = useQuery({
    queryKey: ['weekly-priorities', targetMonday],
    queryFn: () =>
      api.get<WeeklyPrioritiesResponse>(`/weekly-priorities?weekStart=${targetMonday}`),
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-cream">Weekly planning</h1>
        <p className="text-sm text-cream-muted">Setting up the week of {targetMonday}.</p>
      </header>

      {step === 'review' && (
        <ReviewStep
          isLoading={reviewQuery.isLoading}
          isError={reviewQuery.isError}
          review={reviewQuery.data?.weeklyReview}
          onNext={() => setStep('priorities')}
        />
      )}

      {step === 'priorities' && (
        <PrioritiesStep
          targetMonday={targetMonday}
          priorMonday={priorMonday}
          existing={existingQuery.data?.weekPriorities.priorities}
          existingLoaded={existingQuery.isSuccess}
          review={reviewQuery.data?.weeklyReview}
          onSaved={() => setStep('events')}
        />
      )}

      {step === 'events' && (
        <EventsStep window={window} targetMonday={targetMonday} onConfirm={() => setStep('adjust')} />
      )}

      {step === 'adjust' && (
        <Step4ModuleAdjustments
          targetMonday={targetMonday}
          onBuild={(c) => {
            setConstraints(c);
            setStep('review-week');
          }}
        />
      )}

      {step === 'review-week' && constraints && (
        <Step5ReviewGrid
          targetMonday={targetMonday}
          constraints={constraints}
          onAccepted={() => setStep('done')}
        />
      )}

      {step === 'done' && (
        <Card className="p-6">
          <ButlerLine>{WEEK_REVIEW_ACCEPTED_LINE}</ButlerLine>
          <div className="mt-4">
            <Link
              href="/plan"
              className="rounded-md border border-line-strong px-4 py-2 text-sm text-cream hover:bg-elevated"
            >
              Back to today
            </Link>
          </div>
        </Card>
      )}
    </main>
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
      <h2 className="mb-2 text-lg font-medium text-cream">Last week</h2>
      {isLoading ? (
        <p className="text-sm text-cream-muted">Looking back…</p>
      ) : isError ? (
        <p className="text-sm text-oxblood">Could not load last week.</p>
      ) : !review || review.rate === null ? (
        // Empty prior week — plain state, NOT 0% styled as a grade.
        <p className="text-sm text-cream-muted">Nothing to review yet.</p>
      ) : (
        <p className="text-sm text-cream">
          Of the {review.total} blocks you actioned last week, you completed{' '}
          {review.completed} — {Math.round(review.rate * 100)}%.
        </p>
      )}
      <div className="mt-5">
        <Button variant="primary" onClick={onNext}>
          Set this week&apos;s priorities
        </Button>
      </div>
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
  existing: PriorityItem[] | undefined;
  existingLoaded: boolean;
  review: WeeklyReview | undefined;
  onSaved: () => void;
}): React.JSX.Element {
  const [rows, setRows] = useState<PriorityRow[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the rows exactly once, when the existing-week read has settled:
  //   - an already-saved week pre-fills from its stored priorities;
  //   - an empty week asks the AI seam for a pre-suggestion (ai_suggested rows).
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
        // Assemble the model input: outstanding tasks + prior-week completion + the
        // prior week's priorities (for continuity). All cheap reads through /api/v1.
        const [tasksRes, priorRes] = await Promise.all([
          api.get<{ tasks: TaskItem[] }>('/tasks?status=pending').catch(() => ({ tasks: [] })),
          api
            .get<WeeklyPrioritiesResponse>(`/weekly-priorities?weekStart=${priorMonday}`)
            .catch(() => null),
        ]);
        const suggestInput = {
          outstandingTasks: tasksRes.tasks.map((t) => ({
            title: t.title,
            priority: t.priority,
            estimatedMinutes: t.estimatedMinutes,
          })),
          priorWeekCompletion: {
            completed: review?.completed ?? 0,
            total: review?.total ?? 0,
            priorPriorities: priorRes?.weekPriorities.priorities.map((p) => p.text),
          },
        };
        const { suggestions } = await api.post<{ suggestions: string[] }>(
          '/weekly-priorities/suggest',
          suggestInput,
        );
        if (!cancelled) {
          setRows(suggestions.map((text) => ({ text, source: 'ai_suggested' as const })));
        }
      } catch {
        // Suggestion is best-effort — fall back to blank user rows.
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
      await api.put('/weekly-priorities', { weekStartDate: targetMonday, priorities });
      onSaved();
    } catch {
      setError('Could not save your priorities. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-medium text-cream">This week&apos;s priorities</h2>
      <p className="mb-4 text-sm text-cream-muted">
        Three to five. Overwrite anything I&apos;ve suggested.
      </p>

      {suggesting ? (
        <p className="py-6 text-sm text-cream-muted">Drafting a few suggestions…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {current.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <TextField
                value={row.text}
                onChange={(e) => setRowText(i, e.target.value)}
                placeholder={`Priority ${i + 1}`}
                aria-label={`Priority ${i + 1}`}
                className="flex-1"
              />
              {row.source === 'ai_suggested' && (
                <span className="text-xs text-cream-faint" title="AI suggestion — edit to make it yours">
                  suggested
                </span>
              )}
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={current.length <= MIN_ROWS}
                className="rounded-md border border-line-subtle px-2 py-1 text-xs text-cream-muted disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))}
          {current.length < MAX_ROWS && (
            <button
              type="button"
              onClick={addRow}
              className="self-start rounded-md border border-line-subtle px-2 py-1 text-xs text-cream"
            >
              Add priority
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-oxblood">{error}</p>}

      <div className="mt-5">
        <Button variant="primary" onClick={() => void submit()} disabled={saving || suggesting}>
          {saving ? 'Saving…' : 'Save and review the week'}
        </Button>
      </div>
    </Card>
  );
}

// --- Step 3: upcoming-week fixed events (read-only) -------------------------

function EventsStep({
  window,
  targetMonday,
  onConfirm,
}: {
  window: { start: string; end: string };
  targetMonday: string;
  onConfirm: () => void;
}): React.JSX.Element {
  const eventsQuery = useQuery({
    queryKey: ['calendar-events', window.start, window.end],
    queryFn: () =>
      api.get<{ events: CalendarInstance[] }>(
        `/calendar-events?start=${encodeURIComponent(window.start)}&end=${encodeURIComponent(window.end)}`,
      ),
  });

  const events = useMemo(
    () => (eventsQuery.data?.events ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime)),
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
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-medium text-cream">Fixed events this week</h2>
        {/* Edits happen on the existing Calendar surface — not duplicated here. */}
        <Link href="/calendar" className="text-sm text-bronze hover:underline">
          Edit in Calendar
        </Link>
      </div>
      <p className="mb-4 text-sm text-cream-muted">The week of {targetMonday}. Review only.</p>

      {eventsQuery.isLoading ? (
        <p className="py-4 text-sm text-cream-muted">Loading your week…</p>
      ) : eventsQuery.isError ? (
        <p className="py-4 text-sm text-oxblood">Could not load your calendar.</p>
      ) : events.length === 0 ? (
        <p className="py-4 text-sm text-cream-muted">Nothing fixed this week.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e, i) => (
            <li
              key={`${e.id}-${e.startTime}-${i}`}
              className="flex items-center justify-between rounded-md border border-line-subtle px-3 py-2"
            >
              <span className="text-sm text-cream">{e.title}</span>
              <span className="text-xs text-cream-muted">
                {fmt(e.startTime)}
                {e.recurring && <span className="ml-2 text-bronze">↻</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        <Button variant="primary" onClick={onConfirm}>
          Looks right
        </Button>
      </div>
    </Card>
  );
}

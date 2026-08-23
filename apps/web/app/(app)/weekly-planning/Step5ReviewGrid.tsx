'use client';

// Step 5 — Plan Generation and Review (Chat 058, web). PRD §3.3: the engine generates
// the full week's template; the user reviews it as a seven-day block grid and either
// accepts it as presented or makes individual block-level adjustments. Accepting
// batch-writes the week and returns the user to the day view with the week loaded.
//
// Generation runs server-side (POST /plans/week/generate — the weekly Sonnet call is
// never in the client bundle); accept batch-writes (POST /plans/week/accept). Grid
// mapping, block edits, and the accept payload go through the pure weekReview helpers.
// Copy comes from the client-safe @vesper/shared/copy subpath.
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Card, TextField, ButlerLine } from '@/components/ui';
import {
  WEEK_REVIEW_HEADING,
  WEEK_REVIEW_INTRO,
  WEEK_REVIEW_GENERATING_LINE,
  WEEK_REVIEW_FALLBACK_LINE,
  WEEK_REVIEW_ACCEPT_LABEL,
  WEEK_REVIEW_ADJUST_BLOCK_LABEL,
  weekDayLabel,
} from '@vesper/shared/copy';
import type { WeekConstraints } from '@/lib/weekly-planning/weekConstraints';
import {
  buildWeekGrid,
  editGridBlock,
  removeGridBlock,
  buildAcceptPayload,
  type GeneratedWeek,
  type GridDay,
} from '@/lib/weekly-planning/weekReview';

interface WeekGenerateResponse {
  targetMonday: string;
  served: 'generated' | 'fallback';
  week: GeneratedWeek;
}

function dayHeader(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long', timeZone: 'UTC' });
  const short = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return weekDayLabel(weekday, short);
}

export function Step5ReviewGrid({
  targetMonday,
  constraints,
  onAccepted,
}: {
  targetMonday: string;
  constraints: WeekConstraints;
  onAccepted: () => void;
}): React.JSX.Element {
  // Stable key: the constraints only change when the user re-enters step 4.
  const constraintsKey = useMemo(() => JSON.stringify(constraints), [constraints]);

  const genQuery = useQuery({
    queryKey: ['weekly-plan-generate', targetMonday, constraintsKey],
    queryFn: () =>
      api.post<WeekGenerateResponse>('/plans/week/generate', { targetMonday, constraints }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const [grid, setGrid] = useState<GridDay[] | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the editable grid once, when generation settles.
  useEffect(() => {
    if (grid !== null || !genQuery.isSuccess) return;
    setGrid(buildWeekGrid(genQuery.data.week, targetMonday));
  }, [grid, genQuery.isSuccess, genQuery.data, targetMonday]);

  const editTitle = (dayIndex: number, blockIndex: number, title: string): void =>
    setGrid((prev) => (prev ? editGridBlock(prev, dayIndex, blockIndex, { title }) : prev));

  const removeBlock = (dayIndex: number, blockIndex: number): void =>
    setGrid((prev) => (prev ? removeGridBlock(prev, dayIndex, blockIndex) : prev));

  const accept = async (): Promise<void> => {
    if (!grid) return;
    setError(null);
    setAccepting(true);
    try {
      await api.post('/plans/week/accept', buildAcceptPayload(grid, targetMonday));
      onAccepted();
    } catch {
      setError('Could not save the week. Please try again.');
      setAccepting(false);
    }
  };

  const fmtTime = (t: string): string => t;

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-medium text-cream">{WEEK_REVIEW_HEADING}</h2>
      <p className="mb-4 text-sm text-cream-muted">{WEEK_REVIEW_INTRO}</p>

      {genQuery.isLoading ? (
        <p className="py-6 text-sm text-cream-muted">{WEEK_REVIEW_GENERATING_LINE}</p>
      ) : genQuery.isError ? (
        <p className="py-6 text-sm text-oxblood">Could not draft the week.</p>
      ) : (
        <>
          {genQuery.data?.served === 'fallback' && (
            <ButlerLine>{WEEK_REVIEW_FALLBACK_LINE}</ButlerLine>
          )}

          <div className="mt-3 flex flex-col gap-4">
            {(grid ?? []).map((day) => (
              <div key={day.dayIndex} className="rounded-md border border-line-subtle p-3">
                <h3 className="mb-2 text-sm font-medium text-cream">{dayHeader(day.date)}</h3>
                {day.plan.blocks.length === 0 ? (
                  <p className="text-xs text-cream-muted">
                    {day.plan.note ?? 'Nothing scheduled.'}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {day.plan.blocks.map((b, bi) => (
                      <li key={bi} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-xs text-cream-muted">
                          {fmtTime(b.startTime)}–{fmtTime(b.endTime)}
                        </span>
                        <TextField
                          value={b.title}
                          onChange={(e) => editTitle(day.dayIndex, bi, e.target.value)}
                          aria-label={`${WEEK_REVIEW_ADJUST_BLOCK_LABEL} ${b.title}`}
                          className="flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => removeBlock(day.dayIndex, bi)}
                          className="rounded-md border border-line-subtle px-2 py-1 text-xs text-cream-muted"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {error && <p className="mt-3 text-sm text-oxblood">{error}</p>}

          <div className="mt-5">
            <Button
              variant="primary"
              onClick={() => void accept()}
              disabled={accepting || grid === null}
            >
              {accepting ? 'Saving…' : WEEK_REVIEW_ACCEPT_LABEL}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

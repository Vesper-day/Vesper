// Step 5 — Plan Generation and Review (Chat 058, mobile twin of the web Step5). PRD
// §3.3: the engine generates the full week; the user reviews it as a seven-day block
// grid and either accepts as presented or makes block-level adjustments. Accepting
// batch-writes the week and returns to the day view.
//
// Generation runs server-side (POST /plans/week/generate); accept batch-writes (POST
// /plans/week/accept). Grid mapping, edits, and the accept payload go through the pure
// weekReview helpers. Copy from the client-safe @vesper/shared/copy subpath; zero
// @vesper/ai, zero @vesper/db.
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { ButlerLine } from '../ui/ButlerLine';
import { apiClient } from '../../lib/api/client';
import {
  WEEK_REVIEW_HEADING,
  WEEK_REVIEW_INTRO,
  WEEK_REVIEW_FALLBACK_LINE,
  WEEK_REVIEW_ACCEPT_LABEL,
  weekDayLabel,
} from '@vesper/shared/copy';
import type { WeekConstraints } from '../../lib/weekConstraints';
import {
  buildWeekGrid,
  editGridBlock,
  removeGridBlock,
  buildAcceptPayload,
  type GeneratedWeek,
  type GridDay,
} from '../../lib/weekReview';

const C = { bronze: '#B8884A' } as const;

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
  const constraintsKey = useMemo(() => JSON.stringify(constraints), [constraints]);

  const genQuery = useQuery({
    queryKey: ['weekly-plan-generate', targetMonday, constraintsKey],
    queryFn: () =>
      apiClient.post<WeekGenerateResponse>('/plans/week/generate', { targetMonday, constraints }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const [grid, setGrid] = useState<GridDay[] | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await apiClient.post('/plans/week/accept', buildAcceptPayload(grid, targetMonday));
      onAccepted();
    } catch {
      setError('Could not save the week. Please try again.');
      setAccepting(false);
    }
  };

  return (
    <Card className="p-6">
      <Text className="mb-1 text-lg font-medium text-cream">{WEEK_REVIEW_HEADING}</Text>
      <Text className="mb-4 text-sm text-cream-muted">{WEEK_REVIEW_INTRO}</Text>

      {genQuery.isLoading ? (
        <ActivityIndicator color={C.bronze} className="my-6" />
      ) : genQuery.isError ? (
        <Text className="py-6 text-sm text-oxblood">Could not draft the week.</Text>
      ) : (
        <>
          {genQuery.data?.served === 'fallback' && (
            <ButlerLine>{WEEK_REVIEW_FALLBACK_LINE}</ButlerLine>
          )}

          <View className="mt-3 gap-4">
            {(grid ?? []).map((day) => (
              <View key={day.dayIndex} className="rounded-md border border-line-subtle p-3">
                <Text className="mb-2 text-sm font-medium text-cream">{dayHeader(day.date)}</Text>
                {day.plan.blocks.length === 0 ? (
                  <Text className="text-xs text-cream-muted">
                    {day.plan.note ?? 'Nothing scheduled.'}
                  </Text>
                ) : (
                  <View className="gap-2">
                    {day.plan.blocks.map((b, bi) => (
                      <View key={bi} className="flex-row items-center gap-2">
                        <Text className="w-20 shrink-0 text-xs text-cream-muted">
                          {b.startTime}–{b.endTime}
                        </Text>
                        <TextField
                          value={b.title}
                          onChangeText={(t) => editTitle(day.dayIndex, bi, t)}
                          className="flex-1"
                        />
                        <Button
                          title="Remove"
                          variant="ghost"
                          onPress={() => removeBlock(day.dayIndex, bi)}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>

          {error && <Text className="mt-3 text-sm text-oxblood">{error}</Text>}

          <View className="mt-5">
            <Button
              title={accepting ? 'Saving…' : WEEK_REVIEW_ACCEPT_LABEL}
              variant="primary"
              disabled={accepting || grid === null}
              onPress={() => void accept()}
            />
          </View>
        </>
      )}
    </Card>
  );
}

// Plan day view — mobile (build chat 040; RN parity with the web 039 day view).
//
// A read-only vertical block timeline for the user's current local day, wired to:
//   - usePlanQuery(['plan', planDate])   — GET /plans/date/[date] (§9 PlanResponse shape)
//   - usePlanRealtime(userId, planDate)  — existing chat-037 Realtime sync (no 2nd sub)
//   - useDayRollover(...)                — advance the date at local midnight (AppState + poll)
//   - a POST /plans/generate consumer    — the empty-state Generate CTA
// Renders one of: PlanSkeleton (loading / generating), BlockTimeline (plan present),
// PlanEmpty (PLAN_NOT_FOUND 404 → CTA, or a settled source:'fallback' → apology).
//
// MOBILE-ONLY: pull-to-refresh (RefreshControl). It attempts a refetch UNCONDITIONALLY
// (no NetInfo pre-gate); on failure the chat-013 persisted cache stays rendered and a 2s
// butler-voiced toast ("Showing your saved plan") shows — no spinner-lock, no error state.
//
// SSE TRANSPORT (chat-040 determination): RN core fetch can't stream a body (no
// ReadableStream reader in Hermes), so generation shows the skeleton for the request
// DURATION, then parses the fully-buffered event-stream text for the terminal outcome and
// refetches the settled ['plan', planDate] GET — the timeline always renders from §9 GET,
// never the DailyPlan partial.
//
// Read-only render consumer: no mutations (042), no block-detail expansion (041), no
// drag-reorder (043). All @vesper/shared use is via subpaths (usePlanRealtime imports
// '@vesper/shared/realtime'); this file imports no bare '@vesper/shared' barrel.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Link } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { usePlanStore } from '../../store/plan';
import { useUiStore } from '../../store/ui';
import { usePlanQuery } from '../../hooks/usePlanQuery';
import { usePlanRealtime } from '../../hooks/usePlanRealtime';
import { useDayRollover } from '../../hooks/useDayRollover';
import { BlockTimeline } from '../../components/plan/BlockTimeline';
import { PlanSkeleton } from '../../components/plan/PlanSkeleton';
import { PlanEmpty } from '../../components/plan/PlanEmpty';
import {
  selectEmptyStateVariant,
  localDateInTimeZone,
} from '../../components/plan/planViewHelpers';

// Raw token hex (verbatim from @vesper/ui tokens.ts) for the RefreshControl color props,
// which take a color value, not a NativeWind class (the tasks.tsx convention).
const C = { bronze: '#B8884A', cream: '#E8DDC9' } as const;

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// The device IANA zone is the client proxy for the local-day boundary (the authoritative
// per-user zone is users.timezone, used server-side by /plans/today + start_of_local_day).
function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

// The Generate CTA needs an energyScore (1..10). Capturing energy is the daily check-in
// surface, not this read-only view — so the CTA posts a neutral default (parity with web
// 039's DEFAULT_ENERGY_SCORE). FLAG: revisit when the check-in feeds a real score here.
const DEFAULT_ENERGY_SCORE = 5;

const TOAST_MS = 2000;

interface GenerationState {
  active: boolean;
  fallbackNotice: string | null;
  errored: boolean;
}

const IDLE_GENERATION: GenerationState = { active: false, fallbackNotice: null, errored: false };

interface SseFrame {
  event: string;
  data: string;
}

/** Parse a fully-buffered SSE payload into {event,data} frames (RN can't stream). */
function parseSseFrames(text: string): SseFrame[] {
  return text
    .split('\n\n')
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => {
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      return { event, data: dataLines.join('\n') };
    });
}

function safeJson(text: string): { source?: string; fallbackNotice?: unknown } | null {
  try {
    return JSON.parse(text) as { source?: string; fallbackNotice?: unknown };
  } catch {
    return null;
  }
}

export default function PlanScreen(): React.JSX.Element {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const planDate = usePlanStore((s) => s.currentPlanDate);
  const setPlanDate = usePlanStore((s) => s.setCurrentPlanDate);
  const setIsStreamingPlan = usePlanStore((s) => s.setIsStreamingPlan);
  const enqueueToast = useUiStore((s) => s.enqueueToast);
  const dismissToast = useUiStore((s) => s.dismissToast);

  const [timeZone] = useState(deviceTimeZone);
  const [generation, setGeneration] = useState<GenerationState>(IDLE_GENERATION);
  const [refreshing, setRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Seed the displayed date to the current local day on first mount.
  useEffect(() => {
    if (planDate === null) {
      setPlanDate(localDateInTimeZone(timeZone, new Date()));
    }
  }, [planDate, setPlanDate, timeZone]);

  const query = usePlanQuery(planDate);
  usePlanRealtime(userId, planDate ?? '');

  const onRollover = useCallback(
    (nextDate: string) => {
      setGeneration(IDLE_GENERATION);
      setPlanDate(nextDate);
    },
    [setPlanDate],
  );
  useDayRollover(planDate, timeZone, onRollover);

  // Abort any in-flight generation request on unmount / date change.
  useEffect(() => () => abortRef.current?.abort(), [planDate]);

  // Pull-to-refresh: unconditional refetch (no NetInfo pre-gate). On failure the cached
  // plan stays rendered and a brief butler-voiced toast shows — no error state.
  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      const result = await query.refetch();
      if (result.isError) {
        const id = enqueueToast({ message: 'Showing your saved plan', variant: 'info' });
        setTimeout(() => dismissToast(id), TOAST_MS);
      }
    } finally {
      setRefreshing(false);
    }
  }, [query, enqueueToast, dismissToast]);

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (!planDate || generation.active) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setGeneration({ ...IDLE_GENERATION, active: true });
    setIsStreamingPlan(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${BASE_URL}/plans/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vesper-Client': 'mobile',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ date: planDate, energyScore: DEFAULT_ENERGY_SCORE }),
        signal: controller.signal,
      });

      // Pre-stream failures (cap / lock / validation) come back as §9 JSON, not SSE.
      if (!res.ok) {
        setGeneration({ ...IDLE_GENERATION, errored: true });
        return;
      }

      // RN can't stream: read the whole buffered event-stream, then parse for the
      // terminal frame. `done` may carry a source:'fallback' apology; `error` fails.
      const text = await res.text();
      const frames = parseSseFrames(text);
      let fallbackNotice: string | null = null;

      for (const frame of frames) {
        if (frame.event === 'error') {
          setGeneration({ ...IDLE_GENERATION, errored: true });
          return;
        }
        if (frame.event === 'done') {
          const data = safeJson(frame.data);
          if (data && data.source === 'fallback') {
            fallbackNotice = typeof data.fallbackNotice === 'string' ? data.fallbackNotice : '';
          }
        }
      }

      if (fallbackNotice !== null) {
        setGeneration({ ...IDLE_GENERATION, fallbackNotice: fallbackNotice || ' ' });
      } else {
        // Settled render comes from the §9 GET cache — refetch and hand off to BlockTimeline.
        setGeneration(IDLE_GENERATION);
        await queryClient.invalidateQueries({ queryKey: ['plan', planDate] });
      }
    } catch {
      if (!controller.signal.aborted) {
        setGeneration({ ...IDLE_GENERATION, errored: true });
      }
    } finally {
      setIsStreamingPlan(false);
    }
  }, [planDate, generation.active, queryClient, setIsStreamingPlan]);

  const onGenerate = useCallback(() => {
    void handleGenerate();
  }, [handleGenerate]);

  function renderBody(): React.JSX.Element {
    if (generation.active) return <PlanSkeleton />;
    if (!planDate || (query.isPending && query.fetchStatus !== 'idle')) return <PlanSkeleton />;

    // A settled plan wins over any stale error.
    if (query.data && !query.isError) {
      return <BlockTimeline plan={query.data.plan} />;
    }

    const variant = generation.errored
      ? 'error'
      : selectEmptyStateVariant({
          httpStatus: query.error?.status,
          fallbackSource: generation.fallbackNotice !== null ? 'fallback' : null,
          fallbackNotice: generation.fallbackNotice,
        });

    return (
      <PlanEmpty
        variant={variant}
        fallbackNotice={generation.fallbackNotice}
        onGenerate={onGenerate}
        isGenerating={generation.active}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-espresso">
        <ScrollView
          contentContainerClassName="p-4"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.bronze}
              colors={[C.bronze]}
            />
          }
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-semibold text-cream">Daily plan</Text>
            {/* Entry link to the task pool (preserved from chat 054-W). */}
            <Link
              href="/tasks"
              className="rounded-md border border-line-subtle px-3 py-1.5"
            >
              <Text className="text-sm text-cream-muted">Tasks</Text>
            </Link>
          </View>

          {renderBody()}
        </ScrollView>
      </View>
    </GestureHandlerRootView>
  );
}

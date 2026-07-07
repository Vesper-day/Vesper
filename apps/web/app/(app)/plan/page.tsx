'use client';

// Plan day view (build chat 039).
//
// MOUNT NOTE: the 039 brief named apps/web/app/(app)/page.tsx, but that route
// group index resolves to "/", which already collides with (marketing)/page.tsx
// ("/") — two parallel pages at the same path is a hard `next build` error. The
// authenticated daily-plan surface is this file, the (app)/plan scaffold that the
// plan-store stub explicitly reserved for "Chat 039". So the day view mounts here
// (route "/plan"), preserving the existing Tasks entry link (chat 054-W).
//
// A read-only vertical block timeline for the user's current local day, wired to:
//   - usePlanQuery(['plan', planDate])         — GET /plans/date/[date] (§9 shape)
//   - usePlanRealtime(userId, planDate)        — existing Realtime sync (chat 037)
//   - useDayRollover(...)                      — advance date at local midnight
//   - inline POST /plans/generate SSE consumer — drives the streaming skeleton
// Renders one of: PlanSkeleton (loading / streaming), BlockTimeline (plan present),
// PlanEmpty (PLAN_NOT_FOUND 404 → CTA, or source:'fallback' → apology).
//
// All @vesper/shared imports go through subpaths (usePlanRealtime imports
// '@vesper/shared/realtime'); this file imports no bare '@vesper/shared' barrel.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { usePlanStore } from '@/store/plan';
import { localDateInTimeZone } from '@/lib/dates/localDate';
import { usePlanQuery } from '@/hooks/usePlanQuery';
import { usePlanRealtime } from '@/hooks/usePlanRealtime';
import { useDayRollover } from '@/hooks/useDayRollover';
import { BlockTimeline } from '@/components/plan/BlockTimeline';
import { PlanSkeleton } from '@/components/plan/PlanSkeleton';
import { PlanEmpty } from '@/components/plan/PlanEmpty';
import { selectEmptyStateVariant } from '@/components/plan/planViewHelpers';

// The browser IANA zone is the client proxy for the day boundary. The
// authoritative per-user zone is users.timezone (used server-side by /plans/today
// and start_of_local_day); on the client we key the local date off the browser.
function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

// The generate CTA needs an energyScore (1..10). Capturing energy is a separate
// surface (the daily check-in), not this read-only view — so the CTA posts a
// neutral default. FLAG: revisit when the check-in feeds a real score here.
const DEFAULT_ENERGY_SCORE = 5;

interface GenerationState {
  active: boolean;
  filledCount: number;
  fallbackNotice: string | null;
  errored: boolean;
}

const IDLE_GENERATION: GenerationState = {
  active: false,
  filledCount: 0,
  fallbackNotice: null,
  errored: false,
};

/** Parse the tail-buffered SSE text into complete {event,data} frames. */
function drainFrames(
  buffer: string,
): { frames: Array<{ event: string; data: string }>; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const frames = parts.map((raw) => {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    return { event, data: dataLines.join('\n') };
  });
  return { frames, rest };
}

export default function PlanPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const hydrate = useAuthStore((s) => s.hydrate);
  const authStatus = useAuthStore((s) => s.status);

  const planDate = usePlanStore((s) => s.currentPlanDate);
  const setPlanDate = usePlanStore((s) => s.setCurrentPlanDate);
  const setIsStreamingPlan = usePlanStore((s) => s.setIsStreamingPlan);

  const [timeZone] = useState(browserTimeZone);
  const [generation, setGeneration] = useState<GenerationState>(IDLE_GENERATION);
  const abortRef = useRef<AbortController | null>(null);

  // Seed the displayed date to the current local day on first mount.
  useEffect(() => {
    if (planDate === null) {
      setPlanDate(localDateInTimeZone(timeZone, new Date()));
    }
  }, [planDate, setPlanDate, timeZone]);

  // Hydrate auth once so usePlanRealtime has a userId (realtime is a no-op until then).
  useEffect(() => {
    if (authStatus === 'loading') void hydrate();
  }, [authStatus, hydrate]);

  const query = usePlanQuery(planDate);
  usePlanRealtime(currentUser?.id, planDate ?? '');

  const onRollover = useCallback(
    (nextDate: string) => {
      setGeneration(IDLE_GENERATION);
      setPlanDate(nextDate);
    },
    [setPlanDate],
  );
  useDayRollover(planDate, timeZone, onRollover);

  // Abort any in-flight generation stream on unmount / date change.
  useEffect(() => () => abortRef.current?.abort(), [planDate]);

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (!planDate || generation.active) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setGeneration({ ...IDLE_GENERATION, active: true });
    setIsStreamingPlan(true);

    try {
      const res = await fetch('/api/v1/plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: planDate, energyScore: DEFAULT_ENERGY_SCORE }),
        signal: controller.signal,
      });

      // Pre-stream failures (cap/lock/validation) come back as §9 JSON, not SSE.
      const contentType = res.headers.get('Content-Type') ?? '';
      if (!res.ok || !contentType.includes('text/event-stream') || !res.body) {
        setGeneration({ ...IDLE_GENERATION, errored: true });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let filled = 0;
      let fallbackNotice: string | null = null;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { frames, rest } = drainFrames(buffer);
        buffer = rest;
        for (const frame of frames) {
          if (frame.event === 'plan') {
            filled += 1;
            setGeneration((g) => ({ ...g, filledCount: filled }));
          } else if (frame.event === 'done') {
            const data = safeJson(frame.data);
            if (data && data.source === 'fallback') {
              fallbackNotice =
                typeof data.fallbackNotice === 'string' ? data.fallbackNotice : '';
            }
          } else if (frame.event === 'error') {
            setGeneration({ ...IDLE_GENERATION, errored: true });
            return;
          }
        }
      }

      if (fallbackNotice !== null) {
        setGeneration({ ...IDLE_GENERATION, fallbackNotice: fallbackNotice || ' ' });
      } else {
        // Settled render comes from the §9 GET cache — refetch and hand off to
        // BlockTimeline (the SSE partials never render a real BlockCard).
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-cream">Daily plan</h1>
        {/* Entry link to the task pool (Chat 054-W). Link only; no nav-shell work here. */}
        <Link
          href="/tasks"
          className="rounded-md border border-line-subtle px-3 py-1.5 text-sm text-cream-muted hover:text-cream"
        >
          Tasks
        </Link>
      </div>

      {renderBody()}
    </main>
  );

  function renderBody(): React.JSX.Element {
    // Streaming or first load → skeleton.
    if (generation.active) {
      return <PlanSkeleton filledCount={generation.filledCount} />;
    }
    if (!planDate || (query.isPending && query.fetchStatus !== 'idle')) {
      return <PlanSkeleton />;
    }

    // A settled plan wins over any stale error.
    if (query.data && query.data.plan.blocks.length >= 0 && !query.isError) {
      return <BlockTimeline plan={query.data.plan} />;
    }

    // Empty / error branch — pick the variant from the query error + any fallback.
    const variant = generation.errored
      ? 'error'
      : selectEmptyStateVariant({
          errorCode: query.error?.code,
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
}

/** Parse SSE `data:` JSON, tolerating a malformed frame (returns null). */
function safeJson(text: string): { source?: string; fallbackNotice?: unknown } | null {
  try {
    return JSON.parse(text) as { source?: string; fallbackNotice?: unknown };
  } catch {
    return null;
  }
}

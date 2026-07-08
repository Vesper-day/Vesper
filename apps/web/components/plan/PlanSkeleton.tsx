import type React from 'react';
import { cn } from '@/lib/utils';

/**
 * Streaming skeleton for the day view (build chat 039). Shown during first-plan
 * generation and regeneration while the POST /plans/generate SSE stream runs. As
 * each `event: plan` chunk arrives the page raises `filledCount`, so the first
 * `filledCount` placeholder rows render "settled" (solid, no pulse) and the rest
 * keep pulsing — a coarse fill-in progress cue. The settled render is NOT done
 * here: on the terminal `event: done` the page invalidates ['plan', planDate] and
 * hands off to BlockTimeline (this skeleton never renders a real BlockCard against
 * a DailyPlan partial).
 *
 * Composed from @vesper/ui Layer-4 tokens (bg-surface / bg-elevated /
 * border-line-subtle) + the Tailwind `animate-pulse` utility — no hardcoded hex.
 */
const DEFAULT_ROWS = 6;

export function PlanSkeleton({
  filledCount = 0,
  rowCount = DEFAULT_ROWS,
}: {
  filledCount?: number;
  rowCount?: number;
}): React.JSX.Element {
  const rows = Array.from({ length: Math.max(rowCount, filledCount) });

  return (
    <div
      className="flex flex-col gap-3"
      role="status"
      aria-busy="true"
      aria-label="Building your plan"
    >
      {rows.map((_, i) => {
        const settled = i < filledCount;
        return (
          <div
            key={i}
            className={cn(
              'flex items-start gap-3 rounded-lg border border-line-subtle bg-surface p-4',
              !settled && 'animate-pulse',
            )}
          >
            <div className="h-9 w-9 shrink-0 rounded-md bg-elevated" />
            <div className="flex-1">
              <div
                className={cn(
                  'h-4 rounded-sm bg-elevated',
                  settled ? 'w-2/3' : 'w-1/2',
                )}
              />
              <div className="mt-2 h-3 w-24 rounded-sm bg-elevated" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

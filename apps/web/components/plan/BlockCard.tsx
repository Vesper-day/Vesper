import type React from 'react';
import type { PlanBlock } from '@/app/api/v1/plans/operations';
import { cn } from '@/lib/utils';

/**
 * Per-block card for the day-view timeline (build chat 039). Renders a single §9
 * PlanResponse block: a type glyph, the title, the formatted time range, and a
 * status badge. Read-only — NO block-detail expansion (deferred to 041-V/041-W),
 * no actions (042). `status` is rendered AS-IS: the server already computed the
 * effective status (a live block arrives as 'in_progress'), so the client never
 * recomputes it.
 *
 * Styling composes @vesper/ui Layer-4 tokens through the Tailwind preset
 * (bg-surface / text-cream / border-line-subtle / font-mono for times, etc.) — no
 * hardcoded hexes. NOTE: @vesper/ui currently exports tokens only (no icon
 * primitive), so the "type-specific icon" is a per-type unicode glyph rather than
 * an icon component; swap for a real icon primitive when 107x ships one.
 */

const TYPE_GLYPH: Record<PlanBlock['blockType'], string> = {
  work: '💼',
  fitness: '🏋',
  nutrition: '🍽',
  sleep: '🌙',
  errands: '🧾',
  medication: '💊',
  finance: '💰',
  focus: '🎯',
  commute: '🚆',
  custom: '✳️',
};

// Status → token color class + human label. Values render the COMPUTED status.
const STATUS_STYLE: Record<PlanBlock['status'], { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'text-cream-muted border-line-subtle' },
  in_progress: { label: 'In progress', className: 'text-bronze border-bronze' },
  completed: { label: 'Completed', className: 'text-success border-success' },
  skipped: { label: 'Skipped', className: 'text-cream-faint border-line-subtle' },
  rescheduled: { label: 'Rescheduled', className: 'text-warning border-line-strong' },
};

/** Format an ISO instant to a local "HH:MM" (24h) using the browser locale/zone. */
function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export function BlockCard({ block }: { block: PlanBlock }): React.JSX.Element {
  const status = STATUS_STYLE[block.status];
  const timeRange = `${formatTime(block.startTime)}–${formatTime(block.endTime)}`;

  return (
    <article
      className={cn(
        'flex items-start gap-3 rounded-lg border border-line-subtle bg-surface p-4',
        // Rich posture (ADD-D): rest elevation + hover lift on the quick band; the
        // live block carries the bronze glow halo. Collapses to instant under
        // prefers-reduced-motion via globals.css.
        'shadow-raised transition-shadow duration-quick ease-standard-out hover:shadow-floating',
        block.status === 'in_progress' && 'shadow-glow',
        block.status === 'skipped' && 'opacity-60',
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-elevated text-lg"
      >
        {TYPE_GLYPH[block.blockType]}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate text-base font-medium text-cream">{block.title}</h3>
          <span
            className={cn(
              'shrink-0 rounded-sm border px-2 py-0.5 text-xs',
              status.className,
            )}
          >
            {status.label}
          </span>
        </div>
        <p className="mt-1 font-mono text-sm text-cream-muted">{timeRange}</p>
      </div>
    </article>
  );
}

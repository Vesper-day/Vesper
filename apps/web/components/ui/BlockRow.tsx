// BlockRow — the plan-block row primitive (Layer 4 / Chat 107). The unit the
// day/week plan surfaces stack to render a scheduled block. Carries the radius-lg
// plan-block treatment; an optional bronze leading rail marks an active/now block
// (bronze stays the single accent — used as a 2px rail, never as a fill that
// competes with a primary action).
//
// Scorekeeping discipline: this row renders a block, never a grade/score/streak.
// No such field exists on it by construction. All chrome is @vesper/ui tokens.
import * as React from 'react';
import { cn } from '@/lib/utils';

// Omit the DOM `title` (string tooltip) — our `title` is the block's ReactNode label.
export interface BlockRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Time / duration label, set in the mono family (Layer 4 mono role). */
  time?: React.ReactNode;
  title: React.ReactNode;
  /** Secondary line (module, location, note). */
  meta?: React.ReactNode;
  /** Bronze leading rail — marks the active/now block. At most one per plan. */
  active?: boolean;
}

export const BlockRow = React.forwardRef<HTMLDivElement, BlockRowProps>(
  ({ className, time, title, meta, active = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-start gap-3 rounded-lg border border-line-subtle bg-surface px-4 py-3',
        // Rich posture (ADD-D): rest elevation + hover lift over the quick band.
        'shadow-raised transition-shadow duration-quick ease-standard-out hover:shadow-floating',
        // Active/now block gets the bronze rail AND the bronze glow halo.
        active && 'border-l-2 border-l-bronze shadow-glow',
        className,
      )}
      {...props}
    >
      {time != null && (
        <span className="shrink-0 pt-0.5 font-mono text-sm text-cream-faint">{time}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-cream">{title}</p>
        {meta != null && <p className="mt-0.5 truncate text-xs text-cream-muted">{meta}</p>}
      </div>
    </div>
  ),
);
BlockRow.displayName = 'BlockRow';

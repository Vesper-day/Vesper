// Card — the primary surface primitive (Layer 4 / Chat 107). Every later screen
// composes cards from this; it never hardcodes the surface treatment inline.
//
// Tokens: bg-surface, rounded-lg (radius-lg primary card), border-line-subtle,
// text-cream. The vellum material (subtle warm noise at ~3% opacity) rides as an
// absolutely-positioned overlay child so it tints the card without affecting
// layout. Discipline: no hex, radius, or size literal lives here — all are
// @vesper/ui tokens via Tailwind utilities.
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Drop the vellum noise overlay (e.g. when nesting cards). */
  noVellum?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, noVellum = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative overflow-hidden rounded-lg border border-line-subtle bg-surface text-cream',
        className,
      )}
      {...props}
    >
      {!noVellum && <span aria-hidden className="vellum-overlay" />}
      {children}
    </div>
  ),
);
Card.displayName = 'Card';

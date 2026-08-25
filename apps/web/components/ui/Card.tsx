// Card — the primary surface primitive (Layer 4 / Chat 107). Every later screen
// composes cards from this; it never hardcodes the surface treatment inline.
//
// Tokens: bg-surface, rounded-lg (radius-lg primary card), border-line-subtle,
// text-cream. The vellum material (subtle warm noise at ~3% opacity) rides as an
// absolutely-positioned overlay child so it tints the card without affecting
// layout. Discipline: no hex, radius, or size literal lives here — all are
// @vesper/ui tokens via Tailwind utilities.
//
// Rich posture (Design-Track Re-Overhaul / ADD-D): the card rests at the warm
// `shadow-raised` elevation and lifts to `shadow-floating` on hover over the
// considered band with the standard-out curve. Motion is a shadow transition
// only (no transform), and globals.css collapses all transitions to instant under
// prefers-reduced-motion, so the reduced-motion fallback needs no extra branch.
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
        'shadow-raised transition-shadow duration-considered ease-standard-out hover:shadow-floating',
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

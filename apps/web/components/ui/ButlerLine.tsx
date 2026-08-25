// ButlerLine — the ambient butler-line container shell (Layer 4 / Chat 107).
//
// The butler's quiet voice line: Fraunces italic (display family, butler-line
// role), text-tertiary (cream-faint, lowest hierarchy), line-height 1.4. It is a
// shell — voice copy is gated and supplied by the surface; this only renders the
// line with the right type treatment. Renders nothing when empty so an absent
// line leaves no chrome. Tokens only — no literals.
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButlerLineProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

export const ButlerLine = React.forwardRef<HTMLParagraphElement, ButlerLineProps>(
  ({ className, children, ...props }, ref) => {
    if (children == null || children === '') return null;
    return (
      <p
        ref={ref}
        className={cn(
          'font-display text-base italic leading-butler text-cream-faint',
          // Rich posture (ADD-D): the ambient voice cross-fades on the slow band so
          // line swaps read as a quiet settle, not a cut. Collapses to instant under
          // prefers-reduced-motion via globals.css.
          'transition-opacity duration-slow ease-standard-out',
          className,
        )}
        {...props}
      >
        {children}
      </p>
    );
  },
);
ButlerLine.displayName = 'ButlerLine';

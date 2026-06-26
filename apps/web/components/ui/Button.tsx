// Button — leather press primitive (Layer 4 / Chat 107).
//
// Bronze discipline: the `primary` variant is the SINGLE bronze primary action a
// surface is allowed; nothing else competes with it. Use it at most once per
// surface. Other intents use `secondary` (outlined), `ghost` (text), or
// `destructive` (oxblood). Leather = a slightly softer shadow that presses in on
// :active. All radii/colors/durations are @vesper/ui tokens — no literals.
import * as React from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// One semantic class set per variant. `primary` is the bronze leather button.
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-bronze text-espresso shadow-sm hover:bg-bronze/90 active:shadow-inner focus-visible:ring-bronze',
  secondary:
    'border border-line-strong bg-transparent text-cream hover:bg-elevated focus-visible:ring-line-strong',
  ghost: 'bg-transparent text-cream-muted hover:text-cream hover:bg-elevated focus-visible:ring-line-subtle',
  destructive:
    'border border-oxblood bg-transparent text-oxblood hover:bg-oxblood/10 active:shadow-inner focus-visible:ring-oxblood',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        // Shared chassis: pill-free leather, UI-label tracking, quick press.
        'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium tracking-wider',
        'transition-[background-color,box-shadow] duration-quick ease-standard-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-espresso',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

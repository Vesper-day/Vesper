// Button — leather press primitive (Layer 4 / Chat 107).
//
// Bronze discipline: the `primary` variant is the SINGLE bronze primary action a
// surface is allowed; nothing else competes with it. Use it at most once per
// surface. Other intents use `secondary` (outlined), `ghost` (text), or
// `destructive` (oxblood). Leather = a slightly softer shadow that presses in on
// :active. All radii/colors/durations are @vesper/ui tokens — no literals.
//
// Rich posture (Design-Track Re-Overhaul / ADD-D): the leather now rests at
// `shadow-raised`, lifts to `shadow-floating` on hover (primary), presses into
// `shadow-press` on :active, and takes the bronze `shadow-glow` halo on
// focus-visible. A Quick-band scale press rounds it out. globals.css collapses
// transitions to instant under prefers-reduced-motion (the mandated fallback).
import * as React from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// One semantic class set per variant. `primary` is the bronze leather button.
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-bronze text-espresso shadow-raised hover:bg-bronze/90 hover:shadow-floating active:shadow-press focus-visible:ring-bronze focus-visible:shadow-glow',
  secondary:
    'border border-line-strong bg-transparent text-cream shadow-raised hover:bg-elevated hover:shadow-floating active:shadow-press focus-visible:ring-line-strong',
  ghost: 'bg-transparent text-cream-muted hover:text-cream hover:bg-elevated focus-visible:ring-line-subtle',
  destructive:
    'border border-oxblood bg-transparent text-oxblood hover:bg-oxblood/10 active:shadow-press focus-visible:ring-oxblood',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        // Shared chassis: pill-free leather, UI-label tracking, quick press.
        'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium tracking-wider',
        'transition-[background-color,box-shadow,transform] duration-quick ease-standard-out active:scale-95',
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

// Toggle — on/off switch (Layer 4 / Chat 107a). A two-state control composed from
// the 107 tokens: a rounded-full track that fills bronze when on (bronze is the
// single accent; the on-state is the one moment it earns it) and a cream knob that
// slides on a Quick-band token transition (toggles = quick). The knob slide and
// track fill read the duration-quick / ease-standard-out tokens — never an inline
// ms. on/off is a controlled `checked` + `onChange(next)` contract. No literals.
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ToggleProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function Toggle({ checked, onChange, disabled, className, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-line-subtle',
        'transition-colors duration-quick ease-standard-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze focus-visible:ring-offset-2 focus-visible:ring-offset-espresso',
        'disabled:pointer-events-none disabled:opacity-50',
        checked ? 'bg-bronze' : 'bg-surface',
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-cream',
          'transition-transform duration-quick ease-standard-out',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

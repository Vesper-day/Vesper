// Select — token-styled native dropdown (Layer 4 / Chat 107a). The reusable form
// of the native <select> used inline by TaskForm (054-W): same value/onChange
// contract, same option shape, same 107 input tokens (bg-surface, border-line-subtle,
// rounded-md, font-body text-sm, text-cream). A plain selection control — it carries
// no score, ratio, or progress chrome and never renders one. No literals.
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: ReadonlyArray<SelectOption>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full rounded-md border border-line-subtle bg-surface px-3 py-2',
        'font-body text-sm text-cream',
        'transition-[border-color,box-shadow] duration-quick ease-standard-out',
        // Rich posture (ADD-D): focus lifts the bronze glow halo alongside the border.
        'focus:border-line-strong focus:shadow-glow focus:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
);
Select.displayName = 'Select';

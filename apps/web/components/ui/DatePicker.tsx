// DatePicker — calendar-day capture (Layer 4 / Chat 107a) for the surfaces that
// consume a date alongside the wake/bed times. Mechanism: a token-skinned native
// <input type="date"> — no picker dependency is a web dep and the native control
// already emits the canonical "YYYY-MM-DD" day string, so no heavy picker dep is
// added (same native-input convention as TaskForm). Emits/consumes "YYYY-MM-DD".
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  /** "YYYY-MM-DD" calendar day. */
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

export function DatePicker({ value, onChange, className, ...rest }: DatePickerProps) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={cn(
        'w-full rounded-md border border-line-subtle bg-surface px-3 py-2',
        'font-body text-sm text-cream',
        'transition-[border-color] duration-quick ease-standard-out',
        'focus:border-line-strong focus:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  );
}

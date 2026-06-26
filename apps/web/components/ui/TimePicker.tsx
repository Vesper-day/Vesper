// TimePicker — time-of-day capture (Layer 4 / Chat 107a). Sized for the onboarding
// wake/bed capture and the module-preference surfaces that consume those fields.
// Mechanism: a token-skinned native <input type="time"> — no picker dependency is a
// web dep, and a native time input already round-trips the exact string the data
// layer uses, so a heavy picker dep is unwarranted (matches the native-input
// convention of TaskForm's datetime field).
//
// Data shape: emits/consumes "HH:mm" (24-hour, zero-padded) — the wire format of
// BaseProfile.wakeTarget / bedtimeTarget (packages/db .../jsonb/base-profile.ts;
// parsed live as /^(\d{2}):(\d{2})$/ in apps/mobile/lib/alarm.ts). The native
// time input's value IS exactly "HH:mm", so it round-trips with no conversion.
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TimePickerProps {
  /** "HH:mm" (24-hour) — the wakeTarget/bedtimeTarget wire format. */
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

export function TimePicker({ value, onChange, className, ...rest }: TimePickerProps) {
  return (
    <input
      type="time"
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

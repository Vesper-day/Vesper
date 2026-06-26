// SegmentedControl — inline few-option choice (Layer 4 / Chat 107a). A token track
// of mutually-exclusive segments for the module-preference surfaces (a small fixed
// set of choices shown at once, vs Select's dropdown). The selected segment fills
// bronze (single accent, claimed by the active choice); the swap rides a Quick-band
// token transition (selection = quick). value/onChange(value) contract; options are
// {label,value}. A selection control only — no score/ratio/progress is rendered.
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentOption {
  label: string;
  value: string;
}

export interface SegmentedControlProps {
  options: ReadonlyArray<SegmentOption>;
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  'aria-label'?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  ...rest
}: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex rounded-md border border-line-subtle bg-surface p-0.5', className)}
      {...rest}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange?.(o.value)}
            className={cn(
              'flex-1 rounded-sm px-3 py-1.5 text-sm font-medium tracking-wider',
              'transition-colors duration-quick ease-standard-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze',
              selected ? 'bg-bronze text-espresso' : 'bg-transparent text-cream-muted hover:text-cream',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

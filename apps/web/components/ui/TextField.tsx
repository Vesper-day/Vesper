// TextField — token-styled text input (Layer 4 / Chat 107a). The form-control
// twin of the native <input> used inline by TaskForm (054-W), lifted to a reusable
// primitive. Composes the 107 input tokens only: bg-surface, border-line-subtle,
// rounded-md, Inter body role (font-body text-sm), text-cream, cream-faint
// placeholder. Focus is a Quick-band token transition (input focus = quick). Same
// value/onChange contract as a DOM input (controlled or uncontrolled) and the same
// cn className-merge as the 107 primitives. No hex/px literal lives here.
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'w-full rounded-md border border-line-subtle bg-surface px-3 py-2',
        'font-body text-sm text-cream placeholder:text-cream-faint',
        'transition-[border-color] duration-quick ease-standard-out',
        'focus:border-line-strong focus:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
TextField.displayName = 'TextField';

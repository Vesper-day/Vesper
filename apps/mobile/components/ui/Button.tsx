// Button — RN leather press primitive (Layer 4 / Chat 107), mobile twin of the
// web Button. Bronze discipline: `primary` is the single bronze action per
// surface. NativeWind className tokens only; no literals. The press dim is the
// Pressable opacity feedback (quick band).
import { Pressable, Text, type PressableProps } from 'react-native';
import { cn } from './utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: ButtonVariant;
  className?: string;
}

// One semantic class set per variant (container + label color).
const CONTAINER_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-bronze',
  secondary: 'border border-line-strong bg-transparent',
  ghost: 'bg-transparent',
  destructive: 'border border-oxblood bg-transparent',
};

const LABEL_CLASS: Record<ButtonVariant, string> = {
  primary: 'text-espresso',
  secondary: 'text-cream',
  ghost: 'text-cream-muted',
  destructive: 'text-oxblood',
};

export function Button({ title, variant = 'secondary', className, ...props }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={cn(
        'flex-row items-center justify-center rounded-md px-4 py-2',
        CONTAINER_CLASS[variant],
        className,
      )}
      {...props}
    >
      <Text className={cn('text-sm font-medium tracking-wider', LABEL_CLASS[variant])}>
        {title}
      </Text>
    </Pressable>
  );
}

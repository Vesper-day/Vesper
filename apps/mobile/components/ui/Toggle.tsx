// Toggle — RN on/off switch (Layer 4 / Chat 107a), mobile twin of the web Toggle.
// A rounded-full track that fills bronze when on (the single accent, claimed by the
// on-state) and a cream knob that shifts on toggle. The Quick-band intent rides the
// `duration-quick` token class (a token, not an inline ms). Controlled `checked` +
// `onChange(next)` contract; accessibilityRole "switch". NativeWind tokens only.
import { Pressable, View } from 'react-native';
import { cn } from './utils';

export interface ToggleProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, disabled, className }: ToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange?.(!checked)}
      className={cn(
        'h-6 w-11 flex-row items-center rounded-full border border-line-subtle px-0.5 duration-quick',
        checked ? 'bg-bronze' : 'bg-surface',
        disabled && 'opacity-50',
        className,
      )}
    >
      <View
        className={cn(
          'h-4 w-4 rounded-full bg-cream duration-quick',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </Pressable>
  );
}

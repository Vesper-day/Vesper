// SegmentedControl — RN inline few-option choice (Layer 4 / Chat 107a). On mobile
// this is the select/segmented control: RN has no native <select> and no picker dep
// is present, so the module-preference surfaces pick from a token segment track.
// The selected segment fills bronze (single accent); the Quick-band intent rides the
// `duration-quick` token class. value/onChange(value) contract; {label,value} options.
// A selection control only — no score / ratio / progress is rendered. NativeWind only.
import { Pressable, Text, View } from 'react-native';
import { cn } from './utils';

export interface SegmentOption {
  label: string;
  value: string;
}

export interface SegmentedControlProps {
  options: ReadonlyArray<SegmentOption>;
  value: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
  return (
    <View
      accessibilityRole="tablist"
      className={cn('flex-row rounded-md border border-line-subtle bg-surface p-0.5', className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange?.(o.value)}
            className={cn(
              'flex-1 items-center rounded-sm px-3 py-1.5 duration-quick',
              selected ? 'bg-bronze' : 'bg-transparent',
            )}
          >
            <Text className={cn('text-sm font-medium', selected ? 'text-espresso' : 'text-cream-muted')}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

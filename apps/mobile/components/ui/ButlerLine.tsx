// ButlerLine — RN ambient butler-line shell (Layer 4 / Chat 107), mobile twin of
// the web ButlerLine. Fraunces italic (display family, butler role), text-tertiary
// (cream-faint), butler line-height. Renders nothing when empty. NativeWind tokens
// only. (font-display resolves to Fraunces once the family is loaded on-device via
// expo-font in a later on-device pass — gated build/lint only here.)
import { Text } from 'react-native';
import { cn } from './utils';

export interface ButlerLineProps {
  children?: string;
  className?: string;
}

export function ButlerLine({ children, className }: ButlerLineProps) {
  if (children == null || children === '') return null;
  return (
    <Text className={cn('font-display text-base italic leading-butler text-cream-faint', className)}>
      {children}
    </Text>
  );
}

// Card — the RN surface primitive (Layer 4 / Chat 107), the mobile twin of
// apps/web/components/ui/Card. Same semantic tokens via NativeWind className
// (bg-surface, rounded-lg, border-line-subtle) — the 052/053 styling approach,
// no second pattern. No hex/radius literal here.
//
// Vellum parity note: the web card carries a ~3% SVG-noise overlay. On mobile the
// flat warm surface stands in for now (no binary asset; an SVG-noise overlay is a
// later on-device pass) — the noise sits at the limit of perceptibility anyway.
import { View, type ViewProps } from 'react-native';
import { cn } from './utils';

export interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <View
      className={cn(
        'overflow-hidden rounded-lg border border-line-subtle bg-surface',
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
}

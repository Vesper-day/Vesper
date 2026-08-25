// Card — the RN surface primitive (Layer 4 / Chat 107), the mobile twin of
// apps/web/components/ui/Card. Same semantic tokens via NativeWind className
// (bg-surface, rounded-lg, border-line-subtle) — the 052/053 styling approach,
// no second pattern. No hex/radius literal here.
//
// Vellum parity note: the web card carries a ~3% SVG-noise overlay. On mobile the
// flat warm surface stands in for now (no binary asset; an SVG-noise overlay is a
// later on-device pass) — the noise sits at the limit of perceptibility anyway.
//
// Rich posture (Design-Track Re-Overhaul / ADD-D): the card carries the warm
// `shadow-raised` elevation token — RN 0.81 (New Arch) renders the boxShadow the
// @vesper/ui preset emits, mirrored natively as VesperElevation.raised. No hex or
// radius literal here; the elevation is a token name like every other style.
import { View, type ViewProps } from 'react-native';
import { cn } from './utils';

export interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <View
      className={cn(
        'overflow-hidden rounded-lg border border-line-subtle bg-surface shadow-raised',
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
}

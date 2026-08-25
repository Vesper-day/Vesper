// PlanSkeleton — loading placeholder for the mobile plan day view (build chat 040).
//
// TRANSPORT PATH (chat-040 determination): React Native's core fetch cannot stream a
// response body here — Hermes exposes no ReadableStream reader on `res.body`, so the web
// 039 pattern (per-chunk SSE frames raising a `filledCount`) has no RN equivalent. The
// mobile generate flow therefore shows this skeleton for the DURATION of the POST
// /plans/generate request and refetches the settled ['plan', planDate] GET on completion
// (see plan.tsx). So the skeleton is duration-based, not per-chunk fill: a fixed set of
// muted placeholder rows, not a partial timeline.
//
// Composes the Layer 4 surface tokens (bg-surface / bg-elevated / line-subtle) via
// NativeWind — no off-system hex.
import { View } from 'react-native';

export interface PlanSkeletonProps {
  /** Placeholder row count. Fixed-duration skeleton (no per-chunk fill on RN). */
  rows?: number;
}

export function PlanSkeleton({ rows = 4 }: PlanSkeletonProps): React.JSX.Element {
  return (
    <View className="gap-2" accessibilityRole="progressbar" accessibilityLabel="Loading your plan">
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          className="flex-row items-center gap-3 rounded-lg border border-line-subtle bg-surface px-4 py-4 shadow-raised"
        >
          <View className="h-6 w-6 rounded bg-elevated" />
          <View className="min-w-0 flex-1 gap-2">
            <View className="h-3 w-3/5 rounded bg-elevated" />
            <View className="h-2.5 w-2/5 rounded bg-elevated" />
          </View>
        </View>
      ))}
    </View>
  );
}

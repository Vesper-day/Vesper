// PlanEmpty — empty / non-timeline states for the mobile plan day view (build chat 040).
//
// Three variants, selected upstream by selectEmptyStateVariant (planViewHelpers):
//   - 'no-plan-yet'      → PLAN_NOT_FOUND 404: "no plan yet" + a Generate-plan CTA.
//   - 'fallback-apology' → a POST /plans/generate that settled source:'fallback':
//                          the butler's apology (the §9 fallbackNotice string).
//   - 'error'            → any other failure: a plain, quiet error line.
//
// Composes Layer 4 surface tokens via NativeWind — no off-system hex. Copy is written in
// the butler register (calm, first-person, no exclamation, no scorekeeping).
import { View, Text, Pressable } from 'react-native';
import type { EmptyStateVariant } from './planViewHelpers';

export interface PlanEmptyProps {
  variant: EmptyStateVariant;
  fallbackNotice: string | null;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function PlanEmpty({
  variant,
  fallbackNotice,
  onGenerate,
  isGenerating,
}: PlanEmptyProps): React.JSX.Element {
  if (variant === 'fallback-apology') {
    return (
      <View className="items-center gap-2 py-16">
        <Text className="text-center text-sm font-medium text-cream">
          I couldn’t put a plan together just now.
        </Text>
        <Text className="max-w-xs text-center text-sm text-cream-muted">
          {fallbackNotice && fallbackNotice.trim().length > 0
            ? fallbackNotice
            : 'Please try again in a little while.'}
        </Text>
      </View>
    );
  }

  if (variant === 'error') {
    return (
      <View className="items-center gap-2 py-16">
        <Text className="text-center text-sm font-medium text-cream">
          I couldn’t load your plan.
        </Text>
        <Text className="text-center text-sm text-cream-muted">
          Please check your connection and try again.
        </Text>
      </View>
    );
  }

  // 'no-plan-yet'
  return (
    <View className="items-center gap-4 py-16">
      <View className="items-center gap-1">
        <Text className="text-center text-base font-medium text-cream">
          Your day is a blank page.
        </Text>
        <Text className="max-w-xs text-center text-sm text-cream-muted">
          When you’re ready, I’ll draft a plan around your tasks and calendar.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={isGenerating}
        onPress={onGenerate}
        className="rounded-md bg-bronze px-4 py-2.5 shadow-raised active:shadow-press"
      >
        <Text className="text-sm font-medium text-espresso">
          {isGenerating ? 'Drafting…' : 'Generate plan'}
        </Text>
      </Pressable>
    </View>
  );
}

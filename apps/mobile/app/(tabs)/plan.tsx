import { View, Text } from 'react-native';
import { Link } from 'expo-router';

/** Placeholder — the daily plan surface lands in a later chat. The entry link to
 * the task pool is added in Chat 054-W (link only; no nav-shell work). */
export default function PlanScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-espresso">
      <Text className="text-lg text-cream">Plan</Text>
      <Link href="/tasks" className="rounded-md border border-line-subtle px-4 py-2">
        <Text className="text-sm text-cream-muted">Tasks</Text>
      </Link>
    </View>
  );
}

import { Stack } from 'expo-router';
import { colors } from '@vesper/ui';

/**
 * Settings sub-stack (chat 063; re-parented under the Modules tab by ADD-A). The
 * Settings entry is a card pinned at the bottom of the Modules list
 * ((tabs)/modules/index.tsx), NOT a top-level tab. This stack renders
 * `settings/index` and pushes the Integrations / Privacy / Subscription
 * sub-screens on top.
 *
 * The module pages (medications, bills) are NO LONGER settings sub-screens — they
 * are their own module cards on the Modules list and live at (tabs)/modules/*.
 *
 * Headers are hidden to match the tab shell (the tab navigator owns chrome);
 * sub-screens render their own in-content titles.
 */
export default function SettingsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.espresso },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="integrations" />
      <Stack.Screen name="privacy" />
      {/* Subscription upgrade + Apple manage-subscription entry (chat 085). Always
          mounted (not module-gated); reached from the settings/index link. */}
      <Stack.Screen name="subscription" />
    </Stack>
  );
}

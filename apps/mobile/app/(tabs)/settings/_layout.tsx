import { Stack } from 'expo-router';
import { colors } from '@vesper/ui';

/**
 * Settings stack (chat 063). The Settings tab is now a nested stack so it can
 * push sub-screens (Integrations is the first). The tab itself renders
 * `settings/index`; `settings/integrations` is pushed on top.
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
    </Stack>
  );
}

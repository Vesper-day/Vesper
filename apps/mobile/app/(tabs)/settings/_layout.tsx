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
      {/* Medications is a MODULE (chat 060), OFF by default and gated on
          modulesEnabled.medication.enabled — mounted here as a settings sub-screen
          (NOT a new top-level tab). The screen self-gates; the settings/index link
          to it is shown only when the module is enabled. */}
      <Stack.Screen name="medications" />
      {/* Bills is the Finance MODULE (chat 061), OFF by default and gated on
          modulesEnabled.finance.enabled — mounted here as a settings sub-screen
          (NOT a new top-level tab). The screen self-gates; the settings/index link
          to it is shown only when the module is enabled. */}
      <Stack.Screen name="bills" />
    </Stack>
  );
}

import { Stack } from 'expo-router';
import { colors } from '@vesper/ui';

/**
 * Modules stack (ADD-A). The "Modules" tab (second-from-left) renders this stack.
 * `index` is the scrollable rounded-card list; each module page and the Settings
 * sub-stack are pushed on top.
 *
 * Reminder-list module pages (medications, bills) live directly under this stack;
 * the Settings sub-stack ((tabs)/modules/settings) is a nested navigator reached
 * from the Settings card pinned at the bottom of the list.
 *
 * Headers are hidden to match the tab shell (the tab navigator owns chrome);
 * screens render their own in-content titles.
 */
export default function ModulesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.espresso },
      }}
    >
      <Stack.Screen name="index" />
      {/* Reminder-list modules (chat 060 / 061), re-homed here by ADD-A. Each
          self-gates on its singular module key. */}
      <Stack.Screen name="medications" />
      <Stack.Screen name="bills" />
      {/* Application settings, re-parented under the Modules tab (nested stack). */}
      <Stack.Screen name="settings" />
    </Stack>
  );
}

import { Tabs } from 'expo-router';
import { colors } from '@vesper/ui';

/**
 * Authenticated tab navigator: Plan, Tasks, Calendar, Settings (in order).
 * Tab bar styled with named Layer 4 tokens (no hardcoded hex). Icons land in a
 * later chat — labels only for the shell.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.espresso },
        tabBarActiveTintColor: colors.bronze,
        tabBarInactiveTintColor: colors['cream-faint'],
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors['line-subtle'],
        },
      }}
    >
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

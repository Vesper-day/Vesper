import { Tabs } from 'expo-router';
import { colors } from '@vesper/ui';

/**
 * Authenticated tab navigator: Plan, Modules, Tasks, Calendar (in order, ADD-A).
 * Modules is second-from-left and is the home for every lifestyle module and for
 * application settings (settings live in a card at the bottom of the Modules list,
 * NOT a tab). Tab bar styled with named Layer 4 tokens (no hardcoded hex). Icons
 * land in a later chat — labels only for the shell.
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
      <Tabs.Screen name="modules" options={{ title: 'Modules' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
    </Tabs>
  );
}

import { View, Text, Pressable } from 'react-native';
import { Link, type Href } from 'expo-router';

/**
 * Settings home (was the flat (tabs)/settings.tsx placeholder; moved here when
 * Settings became a nested stack in chat 063). Still a placeholder surface — the
 * full settings list lands in a later chat — but it now links into the
 * Integrations sub-screen.
 */
export default function SettingsScreen() {
  return (
    <View className="flex-1 bg-espresso px-6 pt-16">
      <Text className="mb-6 text-2xl text-cream">Settings</Text>
      {/* Cast: the typed-routes union in .expo/types is only regenerated when
          the Expo dev server runs, so a freshly-added route is not yet in it.
          The path is valid at runtime (groups are URL-transparent). */}
      <Link href={'/settings/integrations' as Href} asChild>
        <Pressable className="mb-3 rounded-lg border border-line-subtle p-4">
          <Text className="text-cream">Integrations</Text>
          <Text className="text-sm text-cream-faint">Google Calendar and more</Text>
        </Pressable>
      </Link>
      <Link href={'/settings/privacy' as Href} asChild>
        <Pressable className="rounded-lg border border-line-subtle p-4">
          <Text className="text-cream">Privacy</Text>
          <Text className="text-sm text-cream-faint">Biometric lock</Text>
        </Pressable>
      </Link>
    </View>
  );
}

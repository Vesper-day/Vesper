import { View, Text, Pressable, ScrollView } from 'react-native';
import { Link, type Href } from 'expo-router';

/**
 * Settings home (chat 063; re-parented under the Modules tab by ADD-A). Reached
 * from the "Settings" card pinned at the bottom of the Modules list. Links into
 * the Integrations, Privacy, and Subscription sub-screens.
 *
 * The Medications and Bills modules are NO LONGER linked here — they are their own
 * cards on the Modules list (ADD-A). This screen carries only application
 * settings, so it no longer needs the profile module-gate query.
 */
export default function SettingsScreen() {
  return (
    <View className="flex-1 bg-espresso">
      <ScrollView contentContainerClassName="px-6 pb-10 pt-16">
        <Text className="mb-6 text-2xl text-cream">Settings</Text>
        {/* Cast: the typed-routes union in .expo/types is only regenerated when
            the Expo dev server runs, so a freshly-moved route is not yet in it.
            The path is valid at runtime (groups are URL-transparent). */}
        <Link href={'/modules/settings/integrations' as Href} asChild>
          <Pressable className="mb-3 rounded-lg border border-line-subtle p-4">
            <Text className="text-cream">Integrations</Text>
            <Text className="text-sm text-cream-faint">Google Calendar and more</Text>
          </Pressable>
        </Link>
        <Link href={'/modules/settings/privacy' as Href} asChild>
          <Pressable className="mb-3 rounded-lg border border-line-subtle p-4">
            <Text className="text-cream">Privacy</Text>
            <Text className="text-sm text-cream-faint">Biometric lock</Text>
          </Pressable>
        </Link>
        {/* Subscription (chat 085): upgrade + Apple manage-subscription. Not module-
            gated — always shown. */}
        <Link href={'/modules/settings/subscription' as Href} asChild>
          <Pressable className="mb-3 rounded-lg border border-line-subtle p-4">
            <Text className="text-cream">Subscription</Text>
            <Text className="text-sm text-cream-faint">Plan and billing</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </View>
  );
}

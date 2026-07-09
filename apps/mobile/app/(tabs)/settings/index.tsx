import { View, Text, Pressable } from 'react-native';
import { Link, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api/client';

/** Minimal gate slice of GET /api/v1/profile ({ user, profile }, unwrapped). Only
 * the module flags read on this screen (medication, finance) are typed here. */
interface ProfileGate {
  profile: {
    modulesEnabled: {
      medication: { enabled: boolean };
      finance: { enabled: boolean };
    };
  };
}

/**
 * Settings home (was the flat (tabs)/settings.tsx placeholder; moved here when
 * Settings became a nested stack in chat 063). Links into the Integrations and
 * Privacy sub-screens, and — only when the Medications MODULE is enabled
 * (modulesEnabled.medication.enabled, chat 060) — into the Medications sub-screen.
 * Medications is a module, not a tab; the link is hidden while the module is off.
 */
export default function SettingsScreen() {
  const { data: gate } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<ProfileGate>('/profile'),
  });
  const medicationEnabled = gate?.profile.modulesEnabled.medication.enabled ?? false;
  const financeEnabled = gate?.profile.modulesEnabled.finance.enabled ?? false;

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
        <Pressable className="mb-3 rounded-lg border border-line-subtle p-4">
          <Text className="text-cream">Privacy</Text>
          <Text className="text-sm text-cream-faint">Biometric lock</Text>
        </Pressable>
      </Link>
      {/* Subscription (chat 085): upgrade + Apple manage-subscription. Not module-
          gated — always shown. */}
      <Link href={'/settings/subscription' as Href} asChild>
        <Pressable className="mb-3 rounded-lg border border-line-subtle p-4">
          <Text className="text-cream">Subscription</Text>
          <Text className="text-sm text-cream-faint">Plan and billing</Text>
        </Pressable>
      </Link>
      {medicationEnabled && (
        <Link href={'/settings/medications' as Href} asChild>
          <Pressable className="mb-3 rounded-lg border border-line-subtle p-4">
            <Text className="text-cream">Medications</Text>
            <Text className="text-sm text-cream-faint">Doses and reminders</Text>
          </Pressable>
        </Link>
      )}
      {financeEnabled && (
        <Link href={'/settings/bills' as Href} asChild>
          <Pressable className="rounded-lg border border-line-subtle p-4">
            <Text className="text-cream">Bills</Text>
            <Text className="text-sm text-cream-faint">Due days and reminders</Text>
          </Pressable>
        </Link>
      )}
    </View>
  );
}

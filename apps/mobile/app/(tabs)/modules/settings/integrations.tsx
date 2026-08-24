import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';

/**
 * Integrations screen (chat 063, mobile equivalent of
 * apps/web/app/(app)/settings/integrations/page.tsx).
 *
 * Structural surface: renders the Google Calendar row, the error-state reconnect
 * banner, and the disabled Apple Calendar "Coming soon" row. The actual OAuth
 * browser flow (expo-auth-session per TECHNICAL_SPEC §6) and the authed
 * connect/disconnect API calls are the chat 034-W onboarding-wiring half — the
 * Connect handler below is a marked placeholder, not a live exchange.
 */
type GcalStatus = 'connected' | 'error' | 'unknown';

export default function IntegrationsScreen() {
  const [status, setStatus] = useState<GcalStatus>('unknown');

  function onConnect(): void {
    // TODO(chat 034-W): launch the expo-auth-session Google consent flow
    // (scope calendar.readonly, access_type=offline), capture the code, and POST
    // it to /api/v1/integrations/google-calendar/connect with the Bearer token.
    // Until then this is inert; setStatus is wired so the UI states are reachable.
    setStatus((prev) => prev);
  }

  return (
    <View className="flex-1 bg-espresso px-6 pt-16">
      <Text className="mb-6 text-2xl text-cream">Integrations</Text>

      {status === 'error' && (
        <View className="mb-6 rounded-lg border border-bronze bg-surface p-4">
          <Text className="text-cream">
            We couldn&apos;t reach your Google Calendar. Please reconnect.
          </Text>
          <Pressable onPress={onConnect} className="mt-3 rounded-md bg-bronze px-4 py-2">
            <Text className="text-espresso">Reconnect Google Calendar</Text>
          </Pressable>
        </View>
      )}

      <View className="rounded-lg border border-line-subtle">
        {/* Google Calendar */}
        <View className="flex-row items-center justify-between border-b border-line-subtle p-4">
          <View>
            <Text className="text-cream">Google Calendar</Text>
            <Text className="text-sm text-cream-faint">
              {status === 'connected' ? 'Connected' : 'Read-only calendar access'}
            </Text>
          </View>
          <Pressable
            onPress={onConnect}
            className={status === 'connected' ? 'rounded-md border border-line-subtle px-4 py-2' : 'rounded-md bg-bronze px-4 py-2'}
          >
            <Text className={status === 'connected' ? 'text-cream' : 'text-espresso'}>
              {status === 'connected' ? 'Disconnect' : 'Connect'}
            </Text>
          </Pressable>
        </View>

        {/* Apple Calendar — disabled placeholder. */}
        <View className="flex-row items-center justify-between p-4 opacity-50">
          <View>
            <Text className="text-cream">Apple Calendar</Text>
            <Text className="text-sm text-cream-faint">Coming soon</Text>
          </View>
          <Pressable disabled className="rounded-md border border-line-subtle px-4 py-2">
            <Text className="text-cream-faint">Connect</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

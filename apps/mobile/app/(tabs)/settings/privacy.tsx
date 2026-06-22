import { useEffect, useState } from 'react';
import { View, Text, Switch, Alert } from 'react-native';
import { apiClient } from '../../../lib/api/client';
import {
  getBiometricAvailability,
  isBiometricLockEnabled,
  setBiometricLockEnabledLocal,
} from '../../../lib/biometric';

/**
 * Settings → Privacy (chat-090b). Hosts the optional biometric-lock toggle and a
 * plain-language explanation. Sits beside settings/index and settings/integrations
 * and matches their structure/styling.
 *
 * Toggling persists the preference two ways: PUT /api/v1/profile
 * { biometricLockEnabled } (cross-device source of truth → users.biometric_lock_enabled)
 * AND a local secure-store cache so the cold-start gate can decide before any
 * network round-trip. The column is OFF by default; this screen is the only way
 * to turn it on. Enabling is blocked unless a biometric is enrolled on the device.
 */
export default function PrivacyScreen() {
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reflect the locally-cached flag on mount.
  useEffect(() => {
    let cancelled = false;
    void isBiometricLockEnabled().then((v) => {
      if (!cancelled) setEnabled(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onToggle(next: boolean): Promise<void> {
    if (saving) return;

    // Enabling requires an enrolled biometric — otherwise the lock would trap the
    // user out of the app with no way to satisfy it.
    if (next) {
      const { available } = await getBiometricAvailability();
      if (!available) {
        Alert.alert(
          'Set up Face ID first',
          'Enable Face ID or Touch ID in your device settings, then turn this on.',
        );
        return;
      }
    }

    setSaving(true);
    setEnabled(next); // optimistic
    try {
      await apiClient.put('/profile', { biometricLockEnabled: next });
      await setBiometricLockEnabledLocal(next);
    } catch {
      setEnabled(!next); // revert on failure
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-espresso px-6 pt-16">
      <Text className="mb-6 text-2xl text-cream">Privacy</Text>

      <View className="rounded-lg border border-line-subtle">
        <View className="flex-row items-center justify-between p-4">
          <View className="flex-1 pr-4">
            <Text className="text-cream">Biometric lock</Text>
            <Text className="text-sm text-cream-faint">
              Require Face ID or Touch ID to open Vesper.
            </Text>
          </View>
          <Switch value={enabled} onValueChange={(v) => void onToggle(v)} disabled={saving} />
        </View>
      </View>

      <Text className="mt-4 text-sm text-cream-faint">
        When on, Vesper locks on launch and after it has been in the background for
        more than a minute. After three failed attempts you&apos;ll be signed out
        and sent a magic link to sign back in. This protects what&apos;s on this
        device only — your data is unchanged.
      </Text>
    </View>
  );
}

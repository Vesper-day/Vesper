import { View, Text, Pressable } from 'react-native';
import { useBiometricLockStore } from '../hooks/useBiometricLock';

/**
 * Lock screen (chat-090b). Rendered as a sibling of the root navigator so that,
 * while locked, it obscures ALL app content behind an opaque full-screen overlay
 * and presents the biometric prompt / retry affordance.
 *
 * The WHEN (cold start, resume > 60s) is decided by useBiometricLock; this
 * component is purely presentational: it reflects the shared lock state and
 * re-runs the unlock flow on the retry affordance. Returns null when unlocked,
 * so it is safe to mount unconditionally.
 */
export function BiometricGate(): React.JSX.Element | null {
  const locked = useBiometricLockStore((s) => s.locked);
  const authenticating = useBiometricLockStore((s) => s.authenticating);
  const authenticate = useBiometricLockStore((s) => s.authenticate);

  if (!locked) return null;

  return (
    <View className="absolute inset-0 z-50 flex-1 items-center justify-center bg-espresso px-8">
      <Text className="mb-3 text-2xl text-cream">Vesper is locked</Text>
      <Text className="mb-8 text-center text-base text-cream-faint">
        Unlock with Face ID to continue.
      </Text>
      <Pressable
        onPress={() => void authenticate()}
        disabled={authenticating}
        className={
          authenticating
            ? 'rounded-md border border-line-subtle px-6 py-3 opacity-50'
            : 'rounded-md bg-bronze px-6 py-3'
        }
      >
        <Text className={authenticating ? 'text-cream-faint' : 'text-espresso'}>
          {authenticating ? 'Unlocking…' : 'Unlock with Face ID'}
        </Text>
      </Pressable>
    </View>
  );
}

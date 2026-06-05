// Sign-in screen — three live options: Google OAuth, native Sign in with Apple,
// and email magic link. Styling uses ONLY the named vesperPreset token classes
// (HARD CONSTRAINT 3). Copy is plain/utilitarian — this screen is NOT voice-gated
// (the butler voice gate is Chat 017). The Apple button is the native system
// button per Apple HIG (not a custom-styled one).
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '../../store/auth';

type Pending = 'google' | 'apple' | 'magic_link' | null;

export default function SignInScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function run(provider: Pending, input: Parameters<typeof signIn>[0]) {
    setError(null);
    setPending(provider);
    try {
      const result = await signIn(input);
      if (!result.ok && result.reason && result.reason !== 'user_canceled') {
        setError('Something went wrong. Please try again.');
      } else if (result.ok && input.provider === 'magic_link') {
        setMagicSent(true);
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <View className="flex-1 bg-espresso px-6 justify-center">
      <View className="mb-10">
        <Text className="text-cream text-3xl font-semibold">Vesper</Text>
        <Text className="text-cream-muted text-base mt-2">
          Sign in to plan your day.
        </Text>
      </View>

      {/* Google */}
      <Pressable
        accessibilityRole="button"
        disabled={pending !== null}
        onPress={() => run('google', { provider: 'google' })}
        className="h-12 rounded-lg bg-elevated border border-line-subtle items-center justify-center mb-3"
      >
        {pending === 'google' ? (
          <ActivityIndicator />
        ) : (
          <Text className="text-cream text-base font-medium">
            Continue with Google
          </Text>
        )}
      </Pressable>

      {/* Apple — native system button (Apple HIG) */}
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={
          AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
        }
        buttonStyle={
          AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
        }
        cornerRadius={12}
        style={{ height: 48, marginBottom: 24 }}
        onPress={() => run('apple', { provider: 'apple' })}
      />

      {/* Divider */}
      <View className="flex-row items-center mb-4">
        <View className="flex-1 h-px bg-line-subtle" />
        <Text className="text-cream-faint text-xs mx-3">or</Text>
        <View className="flex-1 h-px bg-line-subtle" />
      </View>

      {/* Magic link */}
      <TextInput
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setMagicSent(false);
        }}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        editable={pending === null}
        className="h-12 rounded-lg bg-surface border border-line-subtle px-4 text-cream mb-3"
      />
      <Pressable
        accessibilityRole="button"
        disabled={!emailValid || pending !== null}
        onPress={() =>
          run('magic_link', { provider: 'magic_link', email: email.trim() })
        }
        className={`h-12 rounded-lg items-center justify-center ${
          emailValid ? 'bg-bronze' : 'bg-surface border border-line-subtle'
        }`}
      >
        {pending === 'magic_link' ? (
          <ActivityIndicator />
        ) : (
          <Text
            className={`text-base font-medium ${
              emailValid ? 'text-espresso' : 'text-cream-faint'
            }`}
          >
            Email me a sign-in link
          </Text>
        )}
      </Pressable>

      {magicSent && (
        <Text className="text-success text-sm mt-4 text-center">
          Check your email for a sign-in link.
        </Text>
      )}
      {error && (
        <Text className="text-oxblood text-sm mt-4 text-center">{error}</Text>
      )}
    </View>
  );
}

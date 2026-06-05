import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Providers } from './providers';
import { initSentry } from '../lib/sentry';
import { initAuthStore, useAuthStore } from '../store/auth';
import { useAppLifecycle } from '../hooks/useAppLifecycle';

// Sentry boots on import (no-op without a DSN — see lib/sentry.ts).
initSentry();

export default function RootLayout() {
  // Wire onAuthStateChange + hydrate the session once for the app's lifetime
  // (the existing Chat 011 auth slice owns the session; we only read it).
  useEffect(() => {
    const unsubscribe = initAuthStore();
    return unsubscribe;
  }, []);

  return (
    <Providers>
      <RootNavigator />
    </Providers>
  );
}

/**
 * Auth gate. Reads the Zustand auth slice and redirects between the route
 * groups: unauthenticated → (auth); authenticated → (tabs). While the session
 * is still hydrating ('loading') we hold position and let no redirect fire.
 */
function RootNavigator() {
  useAppLifecycle();

  const status = useAuthStore((s) => s.status);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    const inAuthGroup = segments[0] === '(auth)';

    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (status === 'authenticated' && inAuthGroup) {
      router.replace('/(tabs)/plan');
    }
  }, [status, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

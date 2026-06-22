/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: 'Vesper',
  slug: 'vesper',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'vesper',
  platforms: ['ios'],
  icon: './assets/icon.png',
  // Cream-on-espresso launch screen. backgroundColor is the espresso design
  // token value (#1E1815 — @vesper/ui colors.espresso); app.config.js is CJS so
  // the token cannot be imported here, but the value is kept in sync by hand.
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#1E1815',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.vesper.app',
    deploymentTarget: '17.2',
    // Sign in with Apple capability (App Store guideline 4.8). The Apple
    // Services ID / key are provisioned at Cutover C-09; the entitlement must
    // ship now so the native button works once enrollment completes.
    usesAppleSignIn: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Vesper uses your location to surface nearby errands and optimise your route.',
      // Live Activity support (TECHNICAL_SPEC §7). Without these the widget
      // extension builds but activities silently fail at runtime.
      // - NSSupportsLiveActivities: declares the app supports Live Activities.
      // - NSSupportsLiveActivitiesFrequentUpdates: enables sub-hourly cadence,
      //   required for the per-minute countdown and staleDate-driven transitions.
      NSSupportsLiveActivities: true,
      NSSupportsLiveActivitiesFrequentUpdates: true,
    },
    // Shared App Group + Keychain access group, configured now so the future
    // Live Activity widget extension and the app can share the Keychain session
    // and a common container. Setting these at the shell stage avoids a
    // disruptive prebuild rebuild when the widget extension is added later.
    // `$(AppIdentifierPrefix)` resolves to the team prefix at build time.
    entitlements: {
      'com.apple.security.application-groups': ['group.com.vesper.app'],
      'keychain-access-groups': ['$(AppIdentifierPrefix)com.vesper.app'],
      // Required for local alarm notifications scheduled with
      // interruptionLevel:'timeSensitive' (apps/mobile/lib/alarm.ts). NOT
      // 'critical' — critical is reserved for emergency alerts [PRD §3.2].
      // On-device effect is gated on Apple Developer enrollment (C-04).
      'com.apple.developer.usernotifications.time-sensitive': true,
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
    [
      // chat-090b biometric lock. Sets NSFaceIDUsageDescription so Face ID works
      // in custom dev/TestFlight/production builds (Expo Go already carries its
      // own description). Without it, authenticateAsync throws on a real device.
      'expo-local-authentication',
      {
        faceIDPermission: 'Vesper uses Face ID to unlock the app when biometric lock is on.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#ffffff',
        sounds: [],
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        project: 'vesper-mobile',
        organization: 'vesper',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

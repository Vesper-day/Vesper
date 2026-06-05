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
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
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

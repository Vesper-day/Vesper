/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: 'Vesper',
  slug: 'vesper',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'vesper',
  platforms: ['ios'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.vesper.app',
    deploymentTarget: '16.1',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Vesper uses your location to surface nearby errands and optimise your route.',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
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

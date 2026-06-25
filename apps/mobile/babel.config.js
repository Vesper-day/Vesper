module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }]],
    // Reanimated 4 moved its Babel plugin into the worklets package. The old
    // 'react-native-reanimated/plugin' path is gone; use the worklets plugin
    // (react-native-worklets is a direct dep pinned by Expo SDK 54 to 0.5.1).
    plugins: ['react-native-worklets/plugin'],
  };
};

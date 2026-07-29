module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      './babel-plugin-nunito-text.js',
      // Reanimated plugin must be listed last.
      'react-native-reanimated/plugin',
    ],
  };
};

module.exports = (api) => {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // Modern JSX transform for React 19 - automatic runtime
          jsxRuntime: "automatic",
        },
      ],
    ],
    plugins: [
      // NativeWind plugin for Tailwind CSS support
      "nativewind/babel",
      // Reanimated plugin must be last in the plugins array
      // Always include it since react-native-reanimated is installed
      "react-native-reanimated/plugin",
    ],
    env: {
      production: {
        plugins: [
          // Keep all console statements for debugging
          // ['transform-remove-console', { exclude: ['error', 'warn'] }],
        ],
      },
    },
  };
};

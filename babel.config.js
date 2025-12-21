module.exports = (api) => {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // Modern JSX transform for React 18 - automatic runtime
          jsxRuntime: "automatic",
        },
      ],
    ],
    plugins: [
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

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
      // VisionCamera frame processor plugin - must come before reanimated
      [
        "react-native-worklets-core/plugin",
        {
          // Enable worklet support for frame processors
        }
      ],
      // Reanimated plugin must be last in the plugins array
      // Always include it since react-native-reanimated is installed
      "react-native-reanimated/plugin",
    ],
    env: {
      production: {
        plugins: [
          // Remove console.log, console.debug, console.info in production
          // Keep console.error and console.warn for error tracking
          ['transform-remove-console', { exclude: ['error', 'warn'] }],
        ],
      },
    },
  };
};

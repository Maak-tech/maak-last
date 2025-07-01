module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Modern JSX transform for React 18 - automatic runtime
          jsxRuntime: 'automatic',
        },
      ],
    ],
    plugins: [
      // Conditionally enable reanimated plugin for Hermes
      // Only if ENABLE_REANIMATED=true is set
      ...(process.env.ENABLE_REANIMATED === 'true'
        ? ['react-native-reanimated/plugin']
        : []),
    ],
    env: {
      production: {
        plugins: [
          // Additional production optimizations for Hermes
          ['transform-remove-console', { exclude: ['error', 'warn'] }],
        ],
      },
    },
  };
};

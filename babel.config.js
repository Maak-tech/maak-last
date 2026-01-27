module.exports = (api) => {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxRuntime: "automatic",
        },
      ],
      "nativewind/babel",
    ],
    plugins: [
      "react-native-worklets-core/plugin",
      "react-native-reanimated/plugin",
    ],
    env: {
      production: {
        plugins: [["transform-remove-console", { exclude: ["error", "warn"] }]],
      },
    },
  };
};

// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // Disable import resolution errors due to native binding issues
      "import/no-unresolved": "off",
      "import/namespace": "off",
      "import/no-duplicates": "warn",
    },
  }
]);

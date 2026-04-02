// Configures react-native-reanimated logger settings early in the app lifecycle.
// Must be imported at the very top of app/_layout.tsx (before any Reanimated usage).

try {
  // Use the v3 configureReanimatedLogger API if available
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reanimated = require("react-native-reanimated");
  if (typeof reanimated.configureReanimatedLogger === "function") {
    reanimated.configureReanimatedLogger({
      level: reanimated.ReanimatedLogLevel?.warn ?? 1,
      strict: false,
    });
  }
} catch {
  // Reanimated not available or logger API not supported in this version
}

export {};

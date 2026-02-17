// Initialize Sentry before any other modules load.
import "./lib/sentry";

// Run Arabic text runtime patch before Expo Router loads route modules.
import "./lib/patchTextFontRuntime";
import "expo-router/entry";

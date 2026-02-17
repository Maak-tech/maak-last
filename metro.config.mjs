// Delegate to the canonical Metro config.
//
// Why:
// - This repo has both `metro.config.js` and `metro.config.mjs`.
// - Depending on the runtime/CLI, Expo/EAS may pick either.
// - The `.js` config contains critical production safety logic (stubbing dev-client modules
//   to avoid `DevMenu` TurboModule crashes).
//
// By delegating here, we ensure the same config is always used.
import config from "./metro.config.js";

export default config;

/**
 * Empty module polyfill for development-only dependencies
 * Used to prevent expo-dev-client modules from being bundled in production builds
 * This resolves the "DevMenu TurboModule not found" error in production/release builds
 */
module.exports = {};
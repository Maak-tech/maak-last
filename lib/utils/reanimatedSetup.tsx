/**
 * Reanimated Setup Utility
 *
 * This file is imported early to ensure Text components are patched
 * before react-native-reanimated loads.
 *
 * The main fix is now handled via Metro bundler configuration that
 * replaces reanimated's Text.ts with our polyfill.
 */

// No patching needed here - Metro handles it
export function ensureReanimatedPatched() {
  // No-op
}

export function initializeReanimatedCompatibility() {
  // No-op
}

export default {};

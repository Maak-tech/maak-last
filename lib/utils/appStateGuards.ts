import { LayoutAnimation, type LayoutAnimationConfig } from "react-native";

/**
 * Wrapper around LayoutAnimation.configureNext that silently catches
 * the "Cannot be called while the app is in the background" error.
 */
export function configureLayoutAnimationIfActive(
  config: LayoutAnimationConfig
): void {
  try {
    LayoutAnimation.configureNext(config);
  } catch {
    // Safe to ignore — occurs when app transitions to/from background
  }
}

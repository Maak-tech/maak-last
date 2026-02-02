/**
 * Hook for managing animations that automatically pause when app goes to background
 * Prevents crashes from animations running during background state
 */

import { useEffect, useRef, useState } from "react";
import { Animated, AppState, type AppStateStatus } from "react-native";

/**
 * Creates an animated value that automatically stops animations when app goes to background
 * @param initialValue Initial value for the animation
 * @returns Animated.Value that stops when backgrounded
 */
export function useAppStateAwareAnimation(initialValue = 1): Animated.Value {
  const animValue = useRef(new Animated.Value(initialValue)).current;

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        // Stop any running animations when backgrounded to prevent crashes
        animValue.stopAnimation();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, [animValue]);

  return animValue;
}

/**
 * Hook to check if app is currently active
 * @returns true if app is in active state, false otherwise
 */
export function useIsAppActive(): boolean {
  const [isActive, setIsActive] = useState(AppState.currentState === "active");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      setIsActive(nextAppState === "active");
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return isActive;
}

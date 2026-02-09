import { Animated } from "react-native";
import { isAppActive } from "./appStateGuards";

type TimingConfig = Animated.TimingAnimationConfig;
type SpringConfig = Animated.SpringAnimationConfig;

const createNoopAnimation = (): Animated.CompositeAnimation => ({
  start: (callback?: Animated.EndCallback) => {
    if (callback) {
      callback({ finished: false });
    }
  },
  stop: () => {
    // no-op by design
  },
  reset: () => {
    // no-op by design
  },
});

export const timingIfActive = (
  value: Animated.Value,
  config: TimingConfig
): Animated.CompositeAnimation => {
  if (!isAppActive()) {
    return createNoopAnimation();
  }
  return Animated.timing(value, config);
};

export const springIfActive = (
  value: Animated.Value,
  config: SpringConfig
): Animated.CompositeAnimation => {
  if (!isAppActive()) {
    return createNoopAnimation();
  }
  return Animated.spring(value, config);
};

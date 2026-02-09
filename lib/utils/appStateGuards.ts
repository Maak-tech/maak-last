import { AppState, LayoutAnimation } from "react-native";

export type LayoutAnimationPreset =
  | typeof LayoutAnimation.Presets.easeInEaseOut
  | typeof LayoutAnimation.Presets.linear
  | typeof LayoutAnimation.Presets.spring;

export const isAppActive = (): boolean => AppState.currentState === "active";

export const configureLayoutAnimationIfActive = (
  preset: LayoutAnimationPreset
): void => {
  if (!isAppActive()) {
    return;
  }
  LayoutAnimation.configureNext(preset);
};

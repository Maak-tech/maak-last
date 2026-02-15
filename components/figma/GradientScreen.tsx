import { LinearGradient } from "expo-linear-gradient";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet } from "react-native";
import {
  SafeAreaView,
  type SafeAreaViewProps,
} from "react-native-safe-area-context";

type GradientScreenProps = SafeAreaViewProps & {
  containerStyle?: StyleProp<ViewStyle>;
  gradientColors?: readonly string[];
  gradientLocations?: readonly number[];
};

const DEFAULT_GRADIENT = ["#F0FAFB", "#F9FDFE", "#E6F7F9"] as const;

export default function GradientScreen({
  children,
  style,
  containerStyle,
  gradientColors = DEFAULT_GRADIENT,
  gradientLocations,
  ...rest
}: GradientScreenProps) {
  const resolvedColors =
    gradientColors.length >= 2 ? gradientColors : [...DEFAULT_GRADIENT];
  const resolvedLocations =
    gradientLocations && gradientLocations.length >= 2
      ? gradientLocations
      : undefined;

  return (
    <LinearGradient
      colors={resolvedColors as [string, string, ...string[]]}
      locations={
        resolvedLocations as [number, number, ...number[]] | null | undefined
      }
      style={[styles.container, containerStyle]}
    >
      <SafeAreaView {...rest} style={[styles.safeArea, style]}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
});

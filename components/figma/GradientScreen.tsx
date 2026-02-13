import { LinearGradient } from "expo-linear-gradient";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet } from "react-native";
import {
  SafeAreaView,
  type SafeAreaViewProps,
} from "react-native-safe-area-context";

type GradientScreenProps = SafeAreaViewProps & {
  containerStyle?: StyleProp<ViewStyle>;
  gradientColors?: string[];
  gradientLocations?: number[];
};

const DEFAULT_GRADIENT = ["#F0FAFB", "#F9FDFE", "#E6F7F9"];

export default function GradientScreen({
  children,
  style,
  containerStyle,
  gradientColors = DEFAULT_GRADIENT,
  gradientLocations,
  ...rest
}: GradientScreenProps) {
  return (
    <LinearGradient
      colors={gradientColors}
      locations={gradientLocations}
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

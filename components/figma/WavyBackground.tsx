import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import type React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

type WavyBackgroundVariant = "teal" | "gold" | "light";
type WavyBackgroundCurve = "default" | "home";

type WavyBackgroundProps = {
  children: React.ReactNode;
  variant?: WavyBackgroundVariant;
  height?: number;
  curve?: WavyBackgroundCurve;
  /** Position of content: "top" keeps title at top when wave extends down, "bottom" (default) aligns to bottom */
  contentPosition?: "top" | "bottom";
};

// Web design colors (exact match from design-figma)
const WEB_VARIANT_COLORS: Record<
  WavyBackgroundVariant,
  { primary: string; secondary: string; accent: string }
> = {
  teal: {
    primary: "#003543",
    secondary: "#004552",
    accent: "#00667A",
  },
  gold: {
    primary: "#EB9C0C",
    secondary: "#D68A0A",
    accent: "#F5A623",
  },
  light: {
    primary: "#F0FAFB",
    secondary: "#E6F7F9",
    accent: "#D4F1F4",
  },
};

// Legacy variant colors (for default curve)
const VARIANT_COLORS: Record<
  WavyBackgroundVariant,
  { gradient: string[]; waveMid: string; waveLight: string }
> = {
  teal: {
    gradient: ["#003543", "#004D5F", "#00677B"],
    waveMid: "#A6CBD4",
    waveLight: "#F8FAFC",
  },
  gold: {
    gradient: ["#C07900", "#D98B06", "#F0A52E"],
    waveMid: "#F4D9A6",
    waveLight: "#FFF7E8",
  },
  light: {
    gradient: ["#F4FBFC", "#EEF8FA", "#E6F4F6"],
    waveMid: "#E6F4F6",
    waveLight: "#F9FEFF",
  },
};

// Exact wave paths from web WavyBackground (design-figma)
const HOME_WAVE_PATHS = {
  main: "M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,133.3C672,139,768,181,864,181.3C960,181,1056,139,1152,133.3C1248,128,1344,160,1392,176L1440,192L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z",
  secondary:
    "M0,160L48,170.7C96,181,192,203,288,197.3C384,192,480,160,576,154.7C672,149,768,171,864,181.3C960,192,1056,192,1152,181.3C1248,171,1344,149,1392,138.7L1440,128L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z",
};

const DEFAULT_HEIGHT = 240;

export default function WavyBackground({
  children,
  variant = "teal",
  height = DEFAULT_HEIGHT,
  curve = "default",
  contentPosition = "bottom",
}: WavyBackgroundProps) {
  const svgWidth = Dimensions.get("window").width;
  const contentStyle = [
    styles.content,
    contentPosition === "top" && { justifyContent: "flex-start" as const },
  ];

  if (curve === "home") {
    const colors = WEB_VARIANT_COLORS[variant];
    const grad1Id = `wavy-home-${variant}-1`;
    const grad2Id = `wavy-home-${variant}-2`;

    return (
      <View style={[styles.container, { height }]}>
        <Svg
          height={height}
          preserveAspectRatio="none"
          style={StyleSheet.absoluteFill}
          viewBox="0 0 1440 320"
          width={svgWidth}
        >
          <Defs>
            {/* Main wave gradient: primary → secondary → accent (diagonal) */}
            <LinearGradient id={grad1Id} x1="0%" x2="100%" y1="0%" y2="100%">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={1} />
              <Stop offset="50%" stopColor={colors.secondary} stopOpacity={1} />
              <Stop offset="100%" stopColor={colors.accent} stopOpacity={1} />
            </LinearGradient>
            {/* Secondary wave gradient: accent 30% → primary 30% (horizontal) */}
            <LinearGradient id={grad2Id} x1="0%" x2="100%" y1="0%" y2="0%">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.3} />
              <Stop
                offset="100%"
                stopColor={colors.primary}
                stopOpacity={0.3}
              />
            </LinearGradient>
          </Defs>
          {/* Main wave */}
          <Path
            d={HOME_WAVE_PATHS.main}
            fill={`url(#${grad1Id})`}
            fillOpacity={1}
          />
          {/* Secondary wave for depth */}
          <Path
            d={HOME_WAVE_PATHS.secondary}
            fill={`url(#${grad2Id})`}
            fillOpacity={1}
          />
        </Svg>
        <View style={contentStyle}>{children}</View>
      </View>
    );
  }

  // Default curve (legacy)
  const colors = VARIANT_COLORS[variant];
  const paths = {
    waveMid:
      "M0,120C120,150,240,190,360,186C480,182,600,136,720,130C840,124,960,166,1080,176C1200,186,1320,166,1440,150L1440,0L0,0Z",
    waveLight:
      "M0,210C180,242,360,238,540,214C720,190,900,168,1080,188C1230,204,1350,222,1440,232L1440,320L0,320Z",
  };

  return (
    <View style={[styles.container, { height }]}>
      <ExpoLinearGradient
        colors={colors.gradient as [string, string, ...string[]]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg
        height={height}
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
        viewBox="0 0 1440 320"
        width={svgWidth}
      >
        <Path d={paths.waveLight} fill={colors.waveLight} fillOpacity={1} />
        <Path d={paths.waveMid} fill={colors.waveMid} fillOpacity={1} />
      </Svg>
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
  },
});

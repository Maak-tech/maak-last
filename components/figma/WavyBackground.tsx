import { LinearGradient } from "expo-linear-gradient";
import type React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

type WavyBackgroundVariant = "teal" | "gold" | "light";
type WavyBackgroundCurve = "default" | "home";

type WavyBackgroundProps = {
  children: React.ReactNode;
  variant?: WavyBackgroundVariant;
  height?: number;
  curve?: WavyBackgroundCurve;
};

const VARIANT_COLORS: Record<
  WavyBackgroundVariant,
  { gradient: string[]; waveMid: string; waveLight: string }
> = {
  teal: {
    gradient: ["#003543", "#004D5F", "#00677B"],
    waveMid: "#A6CBD4",
    waveLight: "#F2FBFC",
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

const DEFAULT_HEIGHT = 240;

export default function WavyBackground({
  children,
  variant = "teal",
  height = DEFAULT_HEIGHT,
  curve = "default",
}: WavyBackgroundProps) {
  const colors = VARIANT_COLORS[variant];
  const svgWidth = Dimensions.get("window").width;
  const paths =
    curve === "home"
      ? {
          waveMid:
            "M0,130C160,165,320,170,480,150C640,130,800,110,960,120C1120,130,1280,170,1440,160L1440,0L0,0Z",
          waveLight:
            "M0,220C160,255,320,260,480,240C640,220,800,210,960,220C1120,230,1280,245,1440,250L1440,320L0,320Z",
        }
      : {
          waveMid:
            "M0,120C120,150,240,190,360,186C480,182,600,136,720,130C840,124,960,166,1080,176C1200,186,1320,166,1440,150L1440,0L0,0Z",
          waveLight:
            "M0,210C180,242,360,238,540,214C720,190,900,168,1080,188C1230,204,1350,222,1440,232L1440,320L0,320Z",
        };

  return (
    <View style={[styles.container, { height }]}>
      <LinearGradient
        colors={colors.gradient}
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
        <Path d={paths.waveLight} fill={colors.waveLight} />
        <Path d={paths.waveMid} fill={colors.waveMid} />
      </Svg>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
    width: "100%",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
  },
});

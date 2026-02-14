import { Dimensions, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Path, Pattern, Rect } from "react-native-svg";

const { width, height } = Dimensions.get("window");

export function WatermarkPattern() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg height={height} style={styles.svg} width={width}>
        <Defs>
          <Pattern
            height={160}
            id="maakPattern"
            patternUnits="userSpaceOnUse"
            width={160}
            x={0}
            y={0}
          >
            {/* Two dots representing the logo */}
            <Circle cx={30} cy={30} fill="#003543" r={3} />
            <Circle cx={50} cy={30} fill="#EB9C0C" r={3} />

            {/* Additional dots for pattern */}
            <Circle cx={100} cy={60} fill="#003543" opacity={0.5} r={2} />
            <Circle cx={60} cy={100} fill="#003543" opacity={0.5} r={2} />
            <Circle cx={130} cy={130} fill="#003543" opacity={0.5} r={2} />

            {/* Flowing calligraphy curve */}
            <Path
              d="M 20 50 Q 60 20, 100 50 T 140 50"
              fill="none"
              opacity={0.3}
              stroke="#003543"
              strokeWidth={1}
            />

            {/* Secondary curve */}
            <Path
              d="M 40 90 Q 70 70, 100 90 T 130 90"
              fill="none"
              opacity={0.2}
              stroke="#EB9C0C"
              strokeWidth={0.8}
            />
          </Pattern>
        </Defs>
        <Rect
          fill="url(#maakPattern)"
          height={height}
          width={width}
          x={0}
          y={0}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.03,
  },
});

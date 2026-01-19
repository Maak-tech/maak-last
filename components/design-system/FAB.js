import { useRef } from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { colors, shadows, spacing } from "./theme";

const FAB = ({
  onPress,
  icon,
  size = 56,
  backgroundColor = colors.primary,
  position = "bottom-right", // bottom-right, bottom-left, bottom-center
  style,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const positionStyles = {
    "bottom-right": styles.bottomRight,
    "bottom-left": styles.bottomLeft,
    "bottom-center": styles.bottomCenter,
  }[position];

  return (
    <Animated.View
      style={[
        styles.container,
        positionStyles,
        {
          transform: [{ scale: scaleAnim }],
        },
        style,
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.fab,
          shadows.large,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor,
          },
        ]}
      >
        <View style={styles.iconContainer}>{icon}</View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
  },
  bottomRight: {
    bottom: spacing.lg,
    right: spacing.lg,
  },
  bottomLeft: {
    bottom: spacing.lg,
    left: spacing.lg,
  },
  bottomCenter: {
    bottom: spacing.lg,
    alignSelf: "center",
  },
  fab: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default FAB;

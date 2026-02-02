import { useEffect, useRef } from "react";
import {
  Animated,
  AppState,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { borderRadius, colors, shadows, spacing } from "./theme";

const Card = ({
  children,
  onPress,
  variant = "elevated", // elevated, outlined, filled
  style,
  pressable = true,
  contentStyle,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Stop animations when app goes to background to prevent crashes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        // Stop any running animations when backgrounded
        scaleAnim.stopAnimation();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [scaleAnim]);

  const handlePressIn = () => {
    if (pressable && onPress) {
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (pressable && onPress) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  };

  const cardStyle = [
    styles.card,
    styles[`card_${variant}`],
    variant === "elevated" && shadows.medium,
    style,
  ];

  const content = (
    <View style={[styles.content, contentStyle]}>{children}</View>
  );

  if (onPress && pressable) {
    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View
          style={[
            cardStyle,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {content}
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{content}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  card_elevated: {
    backgroundColor: colors.surface,
  },
  card_outlined: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card_filled: {
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
});

export default Card;

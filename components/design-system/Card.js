import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { useAppStateAwareAnimation } from "../../hooks/useAppStateAwareAnimation";
import { springIfActive } from "../../lib/utils/animationGuards";
import { borderRadius, colors, shadows, spacing } from "./theme";

/**
 * @typedef {Object} CardProps
 * @property {import("react").ReactNode} children
 * @property {(() => void)=} onPress
 * @property {"elevated" | "outlined" | "filled"=} variant
 * @property {import("react-native").StyleProp<import("react-native").ViewStyle>=} style
 * @property {boolean=} pressable
 * @property {import("react-native").StyleProp<import("react-native").ViewStyle>=} contentStyle
 */

/** @param {CardProps} props */
const Card = ({
  children,
  onPress = undefined,
  variant = "elevated", // elevated, outlined, filled
  style = undefined,
  pressable = true,
  contentStyle = undefined,
}) => {
  const scaleAnim = useAppStateAwareAnimation(1);

  const handlePressIn = () => {
    if (pressable && onPress) {
      springIfActive(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (pressable && onPress) {
      springIfActive(scaleAnim, {
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

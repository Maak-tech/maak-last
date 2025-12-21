import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import type React from "react";
import { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { getTextStyle } from "@/utils/styles";

interface AnimatedCheckButtonProps {
  isChecked: boolean;
  onPress: () => void;
  label?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  style?: any;
}

export const AnimatedCheckButton: React.FC<AnimatedCheckButtonProps> = ({
  isChecked,
  onPress,
  label,
  size = "md",
  disabled = false,
  style,
}) => {
  const { theme } = useTheme();
  const scaleValue = useRef(new Animated.Value(1)).current;
  const checkOpacity = useRef(new Animated.Value(isChecked ? 1 : 0)).current;

  const sizes = {
    sm: { width: 32, height: 32, iconSize: 14 },
    md: { width: 40, height: 40, iconSize: 16 },
    lg: { width: 48, height: 48, iconSize: 20 },
  };

  const currentSize = sizes[size];

  useEffect(() => {
    Animated.timing(checkOpacity, {
      toValue: isChecked ? 1 : 0.3,
      duration: 200,
      useNativeDriver: Platform.OS !== "web",
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChecked]);

  const handlePress = () => {
    if (disabled) return;

    // Haptic feedback (only on native platforms)
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Scale animation
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();

    onPress();
  };

  const buttonStyle = {
    width: currentSize.width,
    height: currentSize.height,
    borderRadius: currentSize.width / 2,
    backgroundColor: isChecked
      ? theme.colors.accent.success
      : theme.colors.background.secondary,
    borderColor: isChecked
      ? theme.colors.accent.success
      : theme.colors.border.medium,
    borderWidth: 2,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={disabled}
          onPress={handlePress}
          style={buttonStyle}
        >
          <Animated.View style={{ opacity: checkOpacity }}>
            <Check
              color={isChecked ? theme.colors.neutral.white : theme.colors.text.tertiary}
              size={currentSize.iconSize}
              strokeWidth={isChecked ? 3 : 2}
            />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
      {label && (
        <Text
          style={[
            getTextStyle(
              theme,
              "caption",
              "medium",
              theme.colors.text.secondary
            ),
            styles.label,
            isChecked && { color: theme.colors.accent.success },
          ]}
        >
          {label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 4,
  },
  label: {
    textAlign: "center",
  },
});

export default AnimatedCheckButton;

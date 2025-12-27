import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from './theme';

const Card = ({
  children,
  onPress,
  variant = 'elevated', // elevated, outlined, filled
  style,
  pressable = true,
  contentStyle,
}) => {
  const scaleAnim = new Animated.Value(1);

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
    variant === 'elevated' && shadows.medium,
    style,
  ];

  const content = <View style={[styles.content, contentStyle]}>{children}</View>;

  if (onPress && pressable) {
    return (
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
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
    overflow: 'hidden',
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

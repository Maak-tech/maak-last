import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from './theme';

// Badge Component
export const Badge = ({
  children,
  variant = 'primary', // primary, secondary, success, error, warning, info
  size = 'medium', // small, medium, large
  style,
}) => {
  return (
    <View style={[styles.badge, styles[`badge_${variant}`], styles[`badge_${size}`], style]}>
      <Text style={[styles.badgeText, styles[`badgeText_${size}`]]}>
        {children}
      </Text>
    </View>
  );
};

// Avatar Component
export const Avatar = ({
  source,
  size = 48,
  name,
  style,
}) => {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        shadows.small,
        style,
      ]}
    >
      {source ? (
        <Image
          source={source}
          style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size / 2.5 }]}>
          {initials}
        </Text>
      )}
    </View>
  );
};

// Divider Component
export const Divider = ({
  vertical = false,
  spacing: dividerSpacing = 'medium',
  color = colors.divider,
  thickness = 1,
  style,
}) => {
  const spacingValue = {
    small: spacing.sm,
    medium: spacing.md,
    large: spacing.lg,
  }[dividerSpacing];

  return (
    <View
      style={[
        styles.divider,
        vertical ? styles.dividerVertical : styles.dividerHorizontal,
        vertical
          ? {
              width: thickness,
              marginHorizontal: spacingValue,
            }
          : {
              height: thickness,
              marginVertical: spacingValue,
            },
        { backgroundColor: color },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  // Badge Styles
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    alignSelf: 'flex-start',
  },
  badge_small: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  badge_medium: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badge_large: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  badge_primary: {
    backgroundColor: colors.primary,
  },
  badge_secondary: {
    backgroundColor: colors.secondary,
  },
  badge_success: {
    backgroundColor: colors.success,
  },
  badge_error: {
    backgroundColor: colors.error,
  },
  badge_warning: {
    backgroundColor: colors.warning,
  },
  badge_info: {
    backgroundColor: colors.info,
  },
  badgeText: {
    color: colors.textLight,
    fontWeight: typography.weightSemiBold,
  },
  badgeText_small: {
    fontSize: 10,
  },
  badgeText_medium: {
    fontSize: typography.caption,
  },
  badgeText_large: {
    fontSize: typography.bodySmall,
  },

  // Avatar Styles
  avatar: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: colors.primary,
    fontWeight: typography.weightBold,
  },

  // Divider Styles
  divider: {
    backgroundColor: colors.divider,
  },
  dividerHorizontal: {
    width: '100%',
  },
  dividerVertical: {
    height: '100%',
  },
});

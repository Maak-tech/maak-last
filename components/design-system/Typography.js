import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { colors, typography, spacing } from './theme';

// Heading Component
export const Heading = ({
  level = 1, // 1-6
  children,
  color = colors.textPrimary,
  align = 'left',
  weight = 'bold',
  style,
  ...props
}) => {
  const fontSize = {
    1: typography.h1,
    2: typography.h2,
    3: typography.h3,
    4: typography.h4,
    5: typography.h5,
    6: typography.h6,
  }[level];

  const fontWeight = {
    light: typography.weightLight,
    regular: typography.weightRegular,
    medium: typography.weightMedium,
    semibold: typography.weightSemiBold,
    bold: typography.weightBold,
  }[weight];

  return (
    <RNText
      style={[
        styles.heading,
        { fontSize, fontWeight, color, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
};

// Body Text Component
export const Text = ({
  children,
  size = 'medium', // small, medium, large
  color = colors.textPrimary,
  align = 'left',
  weight = 'regular',
  style,
  ...props
}) => {
  const fontSize = {
    small: typography.caption,
    medium: typography.body,
    large: typography.h6,
  }[size];

  const fontWeight = {
    light: typography.weightLight,
    regular: typography.weightRegular,
    medium: typography.weightMedium,
    semibold: typography.weightSemiBold,
    bold: typography.weightBold,
  }[weight];

  return (
    <RNText
      style={[
        styles.text,
        { fontSize, fontWeight, color, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
};

// Caption Text
export const Caption = ({ children, color = colors.textSecondary, style, numberOfLines, ...props }) => {
  return (
    <RNText
      style={[styles.caption, { color }, style]}
      numberOfLines={numberOfLines}
      {...props}
    >
      {children}
    </RNText>
  );
};

// Label Text (for forms)
export const Label = ({ children, required = false, style, ...props }) => {
  return (
    <RNText style={[styles.label, style]} {...props}>
      {children}
      {required && <RNText style={styles.required}> *</RNText>}
    </RNText>
  );
};

const styles = StyleSheet.create({
  heading: {
    lineHeight: typography.lineHeightTight * typography.h1,
  },
  text: {
    lineHeight: typography.lineHeightNormal * typography.body,
  },
  caption: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeightNormal * typography.caption,
  },
  label: {
    fontSize: typography.bodySmall,
    fontWeight: typography.weightMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.error,
  },
});

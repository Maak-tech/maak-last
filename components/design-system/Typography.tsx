import type React from "react";
import {
  Text as RNText,
  type TextProps as RNTextProps,
  StyleSheet,
  type TextStyle,
} from "react-native";
import { colors, typography } from "./theme";

export type CaptionProps = Omit<RNTextProps, "style"> & {
  children: React.ReactNode;
  color?: string;
  style?: RNTextProps["style"];
  numberOfLines?: number;
};

export type HeadingProps = Omit<RNTextProps, "style"> & {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
  color?: string;
  align?: "left" | "center" | "right";
  weight?: "light" | "regular" | "medium" | "semibold" | "bold";
  style?: RNTextProps["style"];
};

export type TextProps = Omit<RNTextProps, "style"> & {
  children: React.ReactNode;
  size?: "small" | "medium" | "large";
  color?: string;
  align?: "left" | "center" | "right";
  weight?: "light" | "regular" | "medium" | "semibold" | "bold";
  style?: RNTextProps["style"];
  numberOfLines?: number;
};

export type LabelProps = Omit<RNTextProps, "style"> & {
  children: React.ReactNode;
  color?: string;
  style?: RNTextProps["style"];
  numberOfLines?: number;
  required?: boolean;
};

// Heading Component
export const Heading: React.FC<HeadingProps> = ({
  level = 1, // 1-6
  children,
  color = colors.textPrimary,
  align = "left",
  weight = "bold",
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
  }[weight] as TextStyle["fontWeight"];

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
export const Text: React.FC<TextProps> = ({
  children,
  size = "medium", // small, medium, large
  color = colors.textPrimary,
  align = "left",
  weight = "regular",
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
  }[weight] as TextStyle["fontWeight"];

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
export const Caption: React.FC<CaptionProps> = ({
  children,
  color = colors.textSecondary,
  style,
  numberOfLines,
  ...props
}) => (
  <RNText
    numberOfLines={numberOfLines}
    style={[styles.caption, { color }, style]}
    {...props}
  >
    {children}
  </RNText>
);

// Label Text (for forms)
export const Label: React.FC<LabelProps> = ({
  children,
  required = false,
  style,
  ...props
}) => (
  <RNText style={[styles.label, style]} {...props}>
    {children}
    {required ? <RNText style={styles.required}> *</RNText> : null}
  </RNText>
);

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
    fontWeight: typography.weightMedium as TextStyle["fontWeight"],
    color: colors.textPrimary,
  },
  required: {
    color: colors.error,
  },
});

import { StyleSheet, PixelRatio } from 'react-native';
import { Theme } from '@/constants/theme';

// Get scalable font size that respects system font settings
const getScalableFont = (size: number): number => {
  const scale = PixelRatio.getFontScale();
  return Math.round(size * scale);
};

type ThemedStylesFunction<T> = (theme: typeof Theme.light) => T;

export const createThemedStyles = <T extends StyleSheet.NamedStyles<T>>(
  stylesFunction: ThemedStylesFunction<T>
) => {
  return (theme: typeof Theme.light) => StyleSheet.create(stylesFunction(theme));
};

export const getTextStyle = (
  theme: typeof Theme.light,
  variant: 'heading' | 'subheading' | 'body' | 'caption' | 'button',
  weight: 'regular' | 'medium' | 'semibold' | 'bold' = 'regular',
  color?: string
) => {
  const baseStyles = {
    fontFamily: weight === 'bold' 
      ? theme.typography.fontFamily.bold
      : weight === 'semibold'
      ? theme.typography.fontFamily.semiBold
      : weight === 'medium'
      ? theme.typography.fontFamily.medium
      : theme.typography.fontFamily.regular,
    color: color || theme.colors.text.primary,
  };

  switch (variant) {
    case 'heading':
      const headingSize = getScalableFont(theme.typography.fontSize['2xl']);
      return {
        ...baseStyles,
        fontSize: headingSize,
        lineHeight: headingSize * theme.typography.lineHeight.tight,
        fontWeight: theme.typography.fontWeight.bold,
      };
    case 'subheading':
      const subheadingSize = getScalableFont(theme.typography.fontSize.lg);
      return {
        ...baseStyles,
        fontSize: subheadingSize,
        lineHeight: subheadingSize * theme.typography.lineHeight.normal,
        fontWeight: theme.typography.fontWeight.semibold,
      };
    case 'body':
      const bodySize = getScalableFont(theme.typography.fontSize.base);
      return {
        ...baseStyles,
        fontSize: bodySize,
        lineHeight: bodySize * theme.typography.lineHeight.normal,
      };
    case 'caption':
      const captionSize = getScalableFont(theme.typography.fontSize.sm);
      return {
        ...baseStyles,
        fontSize: captionSize,
        lineHeight: captionSize * theme.typography.lineHeight.normal,
      };
    case 'button':
      const buttonSize = getScalableFont(theme.typography.fontSize.base);
      return {
        ...baseStyles,
        fontSize: buttonSize,
        lineHeight: buttonSize * theme.typography.lineHeight.tight,
        fontWeight: theme.typography.fontWeight.semibold,
      };
    default:
      return baseStyles;
  }
};

export const getButtonStyle = (
  theme: typeof Theme.light,
  variant: 'primary' | 'secondary' | 'tertiary' | 'ghost' = 'primary',
  size: 'sm' | 'md' | 'lg' = 'md'
) => {
  const baseStyles = {
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
  };

  const sizeStyles = {
    sm: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.base,
      minHeight: 36,
    },
    md: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      minHeight: 44,
    },
    lg: {
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.xl,
      minHeight: 52,
    },
  };

  const variantStyles = {
    primary: {
      backgroundColor: theme.colors.primary.main,
      borderWidth: 0,
    },
    secondary: {
      backgroundColor: theme.colors.secondary.main,
      borderWidth: 0,
    },
    tertiary: {
      backgroundColor: theme.colors.background.secondary,
      borderWidth: 1,
      borderColor: theme.colors.border.medium,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
  };

  return {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant],
  };
};

export const getCardStyle = (theme: typeof Theme.light, elevated: boolean = true) => {
  return {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
    ...(elevated ? theme.shadows.md : {}),
  };
};

export const getInputStyle = (theme: typeof Theme.light, state: 'default' | 'focused' | 'error' = 'default') => {
  const baseStyle = {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.base,
    fontSize: getScalableFont(theme.typography.fontSize.base),
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
    borderWidth: 1,
  };

  const stateStyles = {
    default: {
      borderColor: theme.colors.border.medium,
    },
    focused: {
      borderColor: theme.colors.primary.main,
    },
    error: {
      borderColor: theme.colors.accent.error,
    },
  };

  return {
    ...baseStyle,
    ...stateStyles[state],
  };
};
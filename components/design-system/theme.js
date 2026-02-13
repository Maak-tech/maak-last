// Modern Design System for Maak App

export const colors = {
  // Primary palette - Maak teal
  primary: "#003543",
  primaryLight: "#00667A",
  primaryDark: "#03303C",

  // Secondary palette - Maak gold
  secondary: "#EB9C0C",
  secondaryLight: "#F1D8A3",
  secondaryDark: "#D68A0A",

  // Accent colors
  accent: "#EB9C0C",
  accentLight: "#F1D8A3",
  warning: "#F59E0B",
  error: "#EF4444",
  success: "#10B981",
  info: "#3B82F6",

  // Neutrals
  background: "#F9FDFE",
  backgroundDark: "#03303C",
  surface: "#FFFFFF",
  surfaceDark: "#003543",

  // Text colors
  textPrimary: "#1A1D1F",
  textSecondary: "#6C7280",
  textDisabled: "#9CA3AF",
  textLight: "#FFFFFF",

  // Border and divider
  border: "#E5E7EB",
  divider: "#F3F4F6",

  // Overlay
  overlay: "rgba(0, 0, 0, 0.5)",
  overlayLight: "rgba(0, 0, 0, 0.2)",
};

export const typography = {
  // Font families
  fontRegular: "Inter-Regular",
  fontMedium: "Inter-Medium",
  fontBold: "Inter-Bold",
  fontLight: "Inter-Regular",

  // Font sizes
  h1: 32,
  h2: 28,
  h3: 24,
  h4: 20,
  h5: 18,
  h6: 16,

  body: 16,
  bodySmall: 14,
  caption: 12,
  button: 16,

  // Line heights
  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,

  // Font weights
  weightLight: "300",
  weightRegular: "400",
  weightMedium: "500",
  weightSemiBold: "600",
  weightBold: "700",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  round: 9999,
};

export const shadows = {
  small: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  large: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const animations = {
  fast: 200,
  normal: 300,
  slow: 500,
};

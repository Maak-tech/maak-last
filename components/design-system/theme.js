// Modern Design System for Maak App

export const colors = {
  // Primary palette - Maak teal/dark blue
  primary: "#0A3D4A",
  primaryLight: "#15576A",
  primaryDark: "#062832",

  // Secondary palette - Maak orange/gold
  secondary: "#E89B2E",
  secondaryLight: "#F4B550",
  secondaryDark: "#D88718",

  // Accent colors
  accent: "#E89B2E",
  accentLight: "#F4B550",
  warning: "#F4B550",
  error: "#E74C3C",
  success: "#27AE60",
  info: "#3498DB",

  // Neutrals
  background: "#F8F9FA",
  backgroundDark: "#1A1A2E",
  surface: "#FFFFFF",
  surfaceDark: "#16213E",

  // Text colors
  textPrimary: "#2D3436",
  textSecondary: "#636E72",
  textDisabled: "#B2BEC3",
  textLight: "#FFFFFF",

  // Border and divider
  border: "#DFE6E9",
  divider: "#ECEFF1",

  // Overlay
  overlay: "rgba(0, 0, 0, 0.5)",
  overlayLight: "rgba(0, 0, 0, 0.2)",
};

export const typography = {
  // Font families
  fontRegular: "System",
  fontMedium: "System",
  fontBold: "System",
  fontLight: "System",

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

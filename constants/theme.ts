export const Colors = {
  // Primary Colors (Maak Teal)
  primary: {
    main: "#003543", // Maak teal primary
    light: "#00667A", // Lighter teal for highlights
    dark: "#03303C", // Darker teal
    50: "#F0FAFB", // Very light teal tint
    100: "#E6F7F9", // Light teal tint
    200: "#D4F1F4", // Medium light teal tint
  },

  // Secondary Colors (Maak Gold)
  secondary: {
    main: "#EB9C0C", // Maak gold accent
    light: "#F1D8A3", // Soft gold
    dark: "#D68A0A", // Darker gold
    50: "#FFF9EF", // Warm background tint
    100: "#FDF1D8", // Light gold tint
    200: "#F1D8A3", // Medium light gold tint
  },

  // Accent Colors
  accent: {
    success: "#10B981", // Green for success states
    warning: "#F59E0B", // Yellow for warnings
    error: "#EF4444", // Red for errors
    info: "#3B82F6", // Blue for info
  },

  // Neutral Colors
  neutral: {
    50: "#F9FAFB", // Very light background
    100: "#F3F4F6", // Light background
    200: "#E5E7EB", // Light border
    300: "#D1D5DB", // Medium border
    400: "#BEC5D0", // Light text
    500: "#9CA3AF", // Medium text
    600: "#6C7280", // Dark text
    700: "#4E5661", // Darker text
    800: "#2E3338", // Very dark text
    900: "#1A1D1F", // Near black
    white: "#FFFFFF", // Pure white
  },

  // Semantic Colors
  background: {
    primary: "#F9FDFE", // Main app background
    secondary: "#FFFFFF", // Card background
    tertiary: "#FFF9EF", // Warm section background
  },

  text: {
    primary: "#1A1D1F", // Main text
    secondary: "#6C7280", // Secondary text
    tertiary: "#9CA3AF", // Tertiary text
    inverse: "#FFFFFF", // White text on dark backgrounds
  },

  border: {
    light: "#E5E7EB", // Light borders
    medium: "#D1D5DB", // Medium borders
    dark: "#BEC5D0", // Dark borders
  },

  // Status Colors
  status: {
    active: "#10B981", // Green for active/completed
    pending: "#F59E0B", // Gold/orange for pending
    inactive: "#9CA3AF", // Gray for inactive
    critical: "#EF4444", // Red for critical
  },

  // Health-specific Colors
  health: {
    excellent: "#10B981", // Green for excellent health
    good: "#3B82F6", // Blue for good health
    fair: "#F59E0B", // Yellow for fair health
    poor: "#EB9C0C", // Gold for poor health
    critical: "#EF4444", // Red for critical health
  },

  // Severity Colors (for symptoms)
  severity: {
    1: "#10B981", // Mild - Green
    2: "#F59E0B", // Mild-Moderate - Yellow
    3: "#EB9C0C", // Moderate - Gold
    4: "#EF4444", // Severe - Red
    5: "#DC2626", // Critical - Dark Red
  },
};

export const Typography = {
  // Font Families
  fontFamily: {
    regular: "Inter-Regular",
    medium: "Inter-Medium",
    semiBold: "Inter-SemiBold",
    bold: "Inter-Bold",
    arabic: "NotoSansArabic-Regular",
    arabicBold: "NotoSansArabic-Bold",
  },

  // Font Sizes (using scalable sizes)
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
    "5xl": 48,
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 2,
  },

  // Font Weights
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  "4xl": 64,
};

export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  xl: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
};

// Dark mode shadows - subtle glows instead of harsh shadows
export const DarkShadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Dark Theme Colors - Enhanced for better visual appeal
export const DarkColors = {
  primary: {
    main: "#60A5FA", // Brighter, more vibrant blue for dark mode
    light: "#93C5FD", // Even lighter for hover states
    dark: "#3B82F6", // Slightly darker for pressed states
    50: "#1E3A5F", // Dark navy tint with blue undertone
    100: "#1E40AF", // Medium dark navy tint
    200: "#2563EB", // Light dark navy tint
  },

  secondary: {
    main: "#FB923C", // Vibrant orange for dark mode
    light: "#FCD34D", // Lighter orange for highlights
    dark: "#F97316", // Darker orange for depth
    50: "#7C2D12", // Dark orange tint
    100: "#9A3412", // Medium dark orange tint
    200: "#C2410C", // Light dark orange tint
  },

  // Enhanced accent colors for dark mode
  accent: {
    success: "#34D399", // Brighter green for better visibility
    warning: "#FBBF24", // Softer yellow that's easier on the eyes
    error: "#F87171", // Softer red that's less harsh
    info: "#60A5FA", // Bright blue for info states
  },

  // Dark mode neutral colors
  neutral: {
    50: "#1E293B", // Very dark background
    100: "#334155", // Dark background
    200: "#475569", // Dark border
    300: "#64748B", // Medium dark border
    400: "#94A3B8", // Light text
    500: "#CBD5E1", // Medium light text
    600: "#E2E8F0", // Lighter text
    700: "#F1F5F9", // Very light text
    800: "#F8FAFC", // Almost white text
    900: "#FFFFFF", // Pure white
    white: "#FFFFFF", // Pure white
  },

  background: {
    primary: "#0A0F1C", // Richer, deeper dark background
    secondary: "#1E293B", // Dark card background with subtle blue tint
    tertiary: "#334155", // Dark section background
  },

  text: {
    primary: "#F8FAFC", // Brighter white for better readability
    secondary: "#CBD5E1", // Softer gray for secondary text
    tertiary: "#94A3B8", // Muted gray for tertiary text
    inverse: "#0F172A", // Dark text on light backgrounds
  },

  border: {
    light: "#334155", // Subtle borders
    medium: "#475569", // Medium borders with better visibility
    dark: "#64748B", // Dark borders for emphasis
  },

  // Status colors optimized for dark mode
  status: {
    active: "#34D399", // Brighter green
    pending: "#FB923C", // Vibrant orange
    inactive: "#64748B", // Muted gray
    critical: "#F87171", // Softer red
  },

  // Health colors optimized for dark mode
  health: {
    excellent: "#34D399", // Bright green
    good: "#60A5FA", // Bright blue
    fair: "#FBBF24", // Soft yellow
    poor: "#FB923C", // Vibrant orange
    critical: "#F87171", // Soft red
  },

  // Severity colors for dark mode
  severity: {
    1: "#34D399", // Mild - Bright green
    2: "#FBBF24", // Mild-Moderate - Soft yellow
    3: "#FB923C", // Moderate - Vibrant orange
    4: "#F87171", // Severe - Soft red
    5: "#EF4444", // Critical - Bright red
  },
};

const DarkThemeColors = { ...Colors, ...DarkColors } as const;

export const Theme = {
  light: {
    colors: Colors,
    typography: Typography,
    spacing: Spacing,
    borderRadius: BorderRadius,
    shadows: Shadows,
  },
  dark: {
    colors: DarkThemeColors,
    typography: Typography,
    spacing: Spacing,
    borderRadius: BorderRadius,
    shadows: DarkShadows, // Use dark mode shadows
  },
} as const;

export default Theme;

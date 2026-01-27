/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist-Regular", "System"],
        regular: ["Geist-Regular", "System"],
        medium: ["Geist-Medium", "System"],
        semibold: ["Geist-SemiBold", "System"],
        bold: ["Geist-Bold", "System"],
        arabic: ["Cairo-Regular", "System"],
        "arabic-bold": ["Cairo-Bold", "System"],
      },
      colors: {
        // Semantic theme colors (use CSS variables for dark mode)
        surface: "var(--color-background)",
        "surface-secondary": "var(--color-background-secondary)",
        "surface-tertiary": "var(--color-background-tertiary)",
        "on-surface": "var(--color-text-primary)",
        "on-surface-secondary": "var(--color-text-secondary)",
        "on-surface-tertiary": "var(--color-text-tertiary)",
        "input-bg": "var(--color-input-bg)",
        "border-default": "var(--color-border)",
        // Primary Colors
        primary: {
          main: "#1E3A8A",
          light: "#3B82F6",
          dark: "#1E40AF",
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
        },
        // Secondary Colors
        secondary: {
          main: "#EA580C",
          light: "#FB923C",
          dark: "#C2410C",
          50: "#FFF7ED",
          100: "#FFEDD5",
          200: "#FED7AA",
        },
        // Accent Colors
        accent: {
          success: "#10B981",
          warning: "#F59E0B",
          error: "#EF4444",
          info: "#3B82F6",
        },
        // Health Colors
        health: {
          excellent: "#10B981",
          good: "#3B82F6",
          fair: "#F59E0B",
          poor: "#EA580C",
          critical: "#EF4444",
        },
        // Background Colors
        background: {
          primary: "#F8FAFC",
          secondary: "#FFFFFF",
          tertiary: "#F1F5F9",
        },
        // Text Colors
        text: {
          primary: "#1E293B",
          secondary: "#64748B",
          tertiary: "#94A3B8",
          inverse: "#FFFFFF",
        },
        // Border Colors
        border: {
          light: "#F1F5F9",
          medium: "#E2E8F0",
          dark: "#CBD5E1",
        },
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        base: "16px",
        lg: "20px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "48px",
        "4xl": "64px",
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};

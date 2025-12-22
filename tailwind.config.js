/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          main: "#2563EB",
          light: "#3B82F6",
          dark: "#1E40AF",
        },
        accent: {
          success: "#10B981",
          error: "#EF4444",
          warning: "#F59E0B",
        },
      },
      fontFamily: {
        regular: ["Geist-Regular", "sans-serif"],
        medium: ["Geist-Medium", "sans-serif"],
        semibold: ["Geist-SemiBold", "sans-serif"],
        bold: ["Geist-Bold", "sans-serif"],
      },
    },
  },
  plugins: [],
};


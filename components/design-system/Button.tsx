import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type TouchableOpacityProps } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export default function Button({ label, variant = "primary", size = "md", loading, style, disabled, ...props }: ButtonProps) {
  const { theme } = useTheme();

  const bgColors = {
    primary:   theme.colors.primary.main,
    secondary: "transparent",
    ghost:     "transparent",
    danger:    "#EF4444",
  };
  const textColors = {
    primary:   "#FFFFFF",
    secondary: theme.colors.primary.main,
    ghost:     theme.colors.text.secondary,
    danger:    "#FFFFFF",
  };
  const borderColors = {
    primary:   "transparent",
    secondary: theme.colors.primary.main,
    ghost:     "transparent",
    danger:    "transparent",
  };
  const paddings = { sm: { paddingVertical: 8, paddingHorizontal: 14 }, md: { paddingVertical: 12, paddingHorizontal: 20 }, lg: { paddingVertical: 16, paddingHorizontal: 28 } };
  const fontSizes = { sm: 13, md: 15, lg: 16 };

  return (
    <TouchableOpacity
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          backgroundColor: bgColors[variant],
          borderColor: borderColors[variant],
          borderWidth: variant === "secondary" ? 1.5 : 0,
          opacity: disabled ? 0.5 : 1,
          ...paddings[size],
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} size="small" />
      ) : (
        <Text style={[styles.label, { color: textColors[variant], fontSize: fontSizes[size] }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  label: { fontWeight: "700" },
});

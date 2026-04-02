import React from "react";
import { StyleSheet, Text as RNText, type TextProps, View, type ViewProps } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

// ── Text ──────────────────────────────────────────────────────────────────────
export function Text({ style, ...props }: TextProps) {
  const { theme } = useTheme();
  return <RNText style={[{ color: theme.colors.text.primary, fontSize: 14 }, style]} {...props} />;
}

// ── Heading ───────────────────────────────────────────────────────────────────
interface HeadingProps extends TextProps { level?: 1 | 2 | 3 | 4 }
export function Heading({ level = 1, style, ...props }: HeadingProps) {
  const { theme } = useTheme();
  const sizes = { 1: 28, 2: 22, 3: 18, 4: 15 };
  return (
    <RNText
      style={[{ color: theme.colors.text.primary, fontSize: sizes[level], fontWeight: "700" }, style]}
      {...props}
    />
  );
}

// ── Caption ───────────────────────────────────────────────────────────────────
export function Caption({ style, ...props }: TextProps) {
  const { theme } = useTheme();
  return <RNText style={[{ color: theme.colors.text.secondary, fontSize: 12 }, style]} {...props} />;
}

// ── Label ─────────────────────────────────────────────────────────────────────
export function Label({ style, ...props }: TextProps) {
  const { theme } = useTheme();
  return (
    <RNText
      style={[{ color: theme.colors.text.secondary, fontSize: 12, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 }, style]}
      {...props}
    />
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
interface BadgeProps extends ViewProps { label: string; color?: string }
export function Badge({ label, color = "#3B82F6", style, ...props }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}20` }, style]} {...props}>
      <RNText style={[styles.badgeText, { color }]}>{label}</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "700" },
});

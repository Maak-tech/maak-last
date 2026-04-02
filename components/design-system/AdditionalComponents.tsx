import React from "react";
import { Image, StyleSheet, Text, View, type ViewProps } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

// ── Badge ─────────────────────────────────────────────────────────────────────
interface BadgeProps extends ViewProps { label: string; color?: string; size?: "sm" | "md" }
export function Badge({ label, color = "#3B82F6", size = "md", style, ...props }: BadgeProps) {
  const padding = size === "sm" ? { paddingHorizontal: 6, paddingVertical: 2 } : { paddingHorizontal: 10, paddingVertical: 3 };
  const fontSize = size === "sm" ? 10 : 12;
  return (
    <View style={[styles.badge, { backgroundColor: `${color}20` }, padding, style]} {...props}>
      <Text style={[styles.badgeText, { color, fontSize }]}>{label}</Text>
    </View>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
interface AvatarProps {
  name?: string;
  uri?: string;
  size?: number;
  color?: string;
}
export function Avatar({ name, uri, size = 40, color }: AvatarProps) {
  const { theme } = useTheme();
  const bg = color ?? theme.colors.primary.main;
  const initials = name ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?";
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${bg}20` }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.avatarText, { color: bg, fontSize: size * 0.38 }]}>{initials}</Text>
      )}
    </View>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
interface DividerProps { color?: string; marginVertical?: number }
export function Divider({ color, marginVertical = 8 }: DividerProps) {
  const { isDark } = useTheme();
  const borderColor = color ?? (isDark ? "#334155" : "#E2E8F0");
  return <View style={[styles.divider, { borderBottomColor: borderColor, marginVertical }]} />;
}

const styles = StyleSheet.create({
  badge: { borderRadius: 20, alignSelf: "flex-start" },
  badgeText: { fontWeight: "700" },
  avatar: { justifyContent: "center", alignItems: "center" },
  avatarText: { fontWeight: "700" },
  divider: { borderBottomWidth: 1 },
});

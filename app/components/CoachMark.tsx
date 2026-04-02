import { X } from "lucide-react-native";
import { type RefObject, useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  title: string;
  body: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  onPrimaryAction?: () => void;
  onClose: () => void;
  /** Ref of the element the coach mark points to (used for positioning hints) */
  targetRef?: RefObject<View | null>;
  style?: ViewStyle;
}

/**
 * CoachMark — an overlay tip that highlights a UI element on first use.
 * Animates in from the bottom and can be dismissed or acted upon.
 */
export default function CoachMark({
  title,
  body,
  primaryActionLabel,
  secondaryActionLabel,
  onPrimaryAction,
  onClose,
  style,
}: Props) {
  const { theme, isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 12, duration: 160, useNativeDriver: true }),
    ]).start(onClose);
  };

  const card = isDark ? "#1E3A5F" : "#EFF6FF";
  const cardBorder = isDark ? "#2563EB40" : "#BFDBFE";

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ translateY }] },
        style,
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.card, { backgroundColor: card, borderColor: cardBorder }]}>
        {/* Dismiss button */}
        <TouchableOpacity onPress={dismiss} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X color={theme.colors.primary.main} size={16} />
        </TouchableOpacity>

        {/* Content */}
        <Text style={[styles.title, { color: theme.colors.primary.main }]}>{title}</Text>
        <Text style={[styles.body, { color: theme.colors.text.primary }]}>{body}</Text>

        {/* Actions */}
        {(primaryActionLabel || secondaryActionLabel) && (
          <View style={styles.actions}>
            {primaryActionLabel && (
              <TouchableOpacity
                onPress={() => { onPrimaryAction?.(); dismiss(); }}
                style={[styles.primaryBtn, { backgroundColor: theme.colors.primary.main }]}
              >
                <Text style={styles.primaryBtnText}>{primaryActionLabel}</Text>
              </TouchableOpacity>
            )}
            {secondaryActionLabel && (
              <TouchableOpacity onPress={dismiss} style={styles.secondaryBtn}>
                <Text style={[styles.secondaryBtnText, { color: theme.colors.primary.main }]}>
                  {secondaryActionLabel}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  closeBtn: { position: "absolute", top: 12, right: 12, zIndex: 1 },
  title: { fontSize: 15, fontWeight: "700", paddingRight: 24 },
  body: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4, flexWrap: "wrap" },
  primaryBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  primaryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  secondaryBtn: { paddingHorizontal: 12, paddingVertical: 9 },
  secondaryBtnText: { fontSize: 14, fontWeight: "600" },
});

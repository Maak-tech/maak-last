/**
 * WebNoticeBar
 *
 * A dismissible banner shown only on `Platform.OS === 'web'` to inform users
 * that some features (HealthKit sync, wearable sync, camera-based vitals,
 * biometric auth, push notifications) require the Nuralix mobile app.
 *
 * Usage:
 *   Place it at the top of any screen that relies on native-only capabilities.
 *   The dismissed state is stored per-session via React state (no storage
 *   needed — refreshing the page is a natural reset on web).
 *
 * Screens that should include this banner:
 *   - health-integrations.tsx  (HealthKit / Health Connect / wearable setup)
 *   - apple permissions / HealthConnect permissions screens
 *   - ppg-measure.tsx  (camera-based PPG)
 *   - fall-detection.tsx
 */

import { X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  /**
   * Override the default message shown in the banner.
   * Useful for screens with a more specific notice
   * (e.g. "Camera-based heart rate requires the mobile app").
   */
  message?: string;
  messageAr?: string;
};

export default function WebNoticeBar({ message, messageAr }: Props) {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const isRTL = i18n.language.startsWith("ar");

  const [dismissed, setDismissed] = useState(false);

  // Only render on web — on native platforms this component returns nothing.
  if (Platform.OS !== "web" || dismissed) return null;

  const defaultMessage =
    "Some features require the Nuralix mobile app — HealthKit sync, wearable sync, and camera vitals are not available in the browser. Your synced data is visible here in real time.";
  const defaultMessageAr =
    "بعض الميزات تتطلب تطبيق Nuralix للجوال — مزامنة HealthKit والأجهزة القابلة للارتداء وقياسات الكاميرا غير متاحة في المتصفح. بياناتك المزامنة مرئية هنا في الوقت الفعلي.";

  const displayMessage =
    isRTL
      ? (messageAr ?? defaultMessageAr)
      : (message ?? defaultMessage);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.primary.main + "18", // 10% opacity tint
          borderColor: theme.colors.primary.main + "40",     // 25% opacity border
          borderRadius: theme.borderRadius.md,
        },
      ]}
    >
      {/* Mobile phone icon ── simple unicode glyph, no icon dependency needed */}
      <Text style={[styles.icon, { color: theme.colors.primary.main }]}>📱</Text>

      <Text
        style={[
          styles.message,
          {
            color: theme.colors.text.secondary,
            textAlign: isRTL ? "right" : "left",
            flex: 1,
          },
        ]}
      >
        {displayMessage}
      </Text>

      <TouchableOpacity
        onPress={() => setDismissed(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Dismiss notice"
        style={styles.closeButton}
      >
        <X size={14} color={theme.colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
  },
  icon: {
    fontSize: 16,
    lineHeight: 20,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    paddingTop: 2,
  },
});

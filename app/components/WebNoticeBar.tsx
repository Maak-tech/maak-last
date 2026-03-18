/**
 * WebNoticeBar
 *
 * A persistent top banner shown only on web (Platform.OS === 'web') to inform
 * users that certain features — HealthKit sync, wearable data collection, and
 * camera-based vitals — require the Nuralix mobile app.
 *
 * All previously-synced data (vitals history, VHI, Nora chat, family dashboard,
 * medications, labs, genetics) is fully accessible on web.
 *
 * Usage:
 *   <WebNoticeBar />   — renders nothing on iOS / Android
 */

import { X } from "lucide-react-native";
import { useState } from "react";
import { Platform, TouchableOpacity, View, type ViewStyle } from "react-native";
import { Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";

export default function WebNoticeBar() {
  const { theme } = useTheme();
  const [dismissed, setDismissed] = useState(false);

  // Only render on web
  if (Platform.OS !== "web") return null;
  if (dismissed) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.primary.main + "18",
          borderBottomColor: theme.colors.primary.main + "40",
        },
      ]}
    >
      <View style={styles.content}>
        <Text
          style={{
            fontSize: 12,
            color: theme.colors.primary.main,
            flex: 1,
            lineHeight: 18,
          }}
        >
          {"💡 "}
          Some features require the Nuralix mobile app (HealthKit, wearable
          sync, camera vitals). Your synced data is visible here in real time.
        </Text>
        <TouchableOpacity
          onPress={() => setDismissed(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Dismiss notice"
        >
          <X color={theme.colors.primary.main} size={14} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = {
  container: {
    width: "100%" as const,
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  } as ViewStyle,
  content: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  } as ViewStyle,
};

/**
 * MLInsightsBadge
 *
 * A small, pulsing notification badge shown next to the home screen's
 * "Health Insights" section header when the ML pipeline has surfaced new
 * anomalies or discoveries. Tapping it navigates to Analytics.
 *
 * Usage:
 *   <MLInsightsBadge userId={user?.id} onPress={() => router.push('/analytics')} />
 */

import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, TouchableOpacity, View, type ViewStyle } from "react-native";
import { Caption } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import { useMLInsightsBadge } from "@/hooks/useMLInsightsBadge";
import { createThemedStyles } from "@/utils/styles";

type Props = {
  userId: string | undefined;
  /** Override press handler; defaults to router.push("/analytics") */
  onPress?: () => void;
};

export default function MLInsightsBadge({ userId, onPress }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const { badgeCount, hasCritical } = useMLInsightsBadge(userId);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation when critical
  useEffect(() => {
    if (!hasCritical) {
      pulseAnim.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [hasCritical, pulseAnim]);

  if (badgeCount === 0) return null;

  const styles = createThemedStyles((t) => ({
    touchable: {
      alignSelf: "center" as const,
    } as ViewStyle,
    bellWrap: {
      position: "relative" as const,
      width: 28,
      height: 28,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    } as ViewStyle,
    redDot: {
      position: "absolute" as const,
      top: 0,
      right: 0,
      minWidth: 15,
      height: 15,
      borderRadius: 8,
      paddingHorizontal: 3,
      backgroundColor: "#EF4444",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderWidth: 1.5,
      borderColor: t.colors.background.primary,
    } as ViewStyle,
  }))(theme);

  const bellColor = hasCritical ? "#EF4444" : theme.colors.text.secondary;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress ?? (() => router.push("/analytics" as never))}
      style={styles.touchable}
    >
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <View style={styles.bellWrap}>
          <Bell color={bellColor} size={20} />
          <View style={styles.redDot}>
            <Caption style={{ color: "#fff", fontSize: 9, fontWeight: "700", lineHeight: 13 }}>
              {badgeCount > 99 ? "99+" : badgeCount}
            </Caption>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

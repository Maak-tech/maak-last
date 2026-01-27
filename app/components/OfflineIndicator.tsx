import { Wifi, WifiOff } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, View } from "react-native";
import { Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import { offlineService } from "@/lib/services/offlineService";

export default function OfflineIndicator() {
  // Call all hooks unconditionally at the top - MUST be in same order every render
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const [isOnline, setIsOnline] = useState(true);
  const [queueLength, setQueueLength] = useState(0);
  const [slideAnim] = useState(() => new Animated.Value(-100));

  // Use ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  const isRTL = i18n.language === "ar";

  const checkStatus = useCallback(async () => {
    if (!isMountedRef.current) return;
    const status = await offlineService.getSyncStatus();
    if (isMountedRef.current) {
      setQueueLength(status.queueLength);
      setIsOnline(status.isOnline);
    }
  }, []);

  // Memoize the network status change handler to ensure stable reference
  const handleNetworkStatusChange = useCallback(
    (online: boolean) => {
      if (!isMountedRef.current) return;
      setIsOnline(online);
      if (online) {
        checkStatus();
      }
    },
    [checkStatus]
  );

  useEffect(() => {
    isMountedRef.current = true;

    // Check initial status
    checkStatus();

    // Subscribe to network changes
    const unsubscribe = offlineService.onNetworkStatusChange(
      handleNetworkStatusChange
    );

    // Poll queue length periodically
    const interval = setInterval(() => {
      if (isMountedRef.current) {
        checkStatus();
      }
    }, 5000);

    return () => {
      isMountedRef.current = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, [checkStatus, handleNetworkStatusChange]);

  useEffect(() => {
    // Animate slide in/out based on online status and queue
    if (!isOnline || queueLength > 0) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: -100,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    }
  }, [isOnline, queueLength, slideAnim]);

  // Always render to ensure hooks are called consistently
  // Hide visually when online and no queue
  const shouldShow = !isOnline || queueLength > 0;

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: isOnline
          ? theme.colors.accent.warning
          : theme.colors.accent.error,
        paddingHorizontal: 16,
        paddingVertical: 8,
        zIndex: 9999,
        transform: [{ translateY: slideAnim }],
        flexDirection: isRTL ? "row-reverse" : "row",
        alignItems: "center",
        justifyContent: "space-between",
        opacity: shouldShow ? 1 : 0,
        pointerEvents: shouldShow ? "auto" : "none",
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          gap: 8,
          flex: 1,
        }}
      >
        {isOnline ? (
          <Wifi color={theme.colors.neutral.white} size={16} />
        ) : (
          <WifiOff color={theme.colors.neutral.white} size={16} />
        )}
        <Text
          style={{
            color: theme.colors.neutral.white,
            fontSize: 12,
            fontWeight: "500",
          }}
        >
          {isOnline
            ? `${queueLength} ${t("pendingSync", "pending sync")}`
            : t("offlineMode", "Offline Mode")}
        </Text>
      </View>
    </Animated.View>
  );
}

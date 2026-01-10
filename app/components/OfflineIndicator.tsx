import { Wifi, WifiOff, RefreshCw } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { offlineService } from "@/lib/services/offlineService";
import { Caption, Text } from "@/components/design-system/Typography";

export default function OfflineIndicator() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [isOnline, setIsOnline] = useState(true);
  const [queueLength, setQueueLength] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    // Check initial status
    checkStatus();

    // Subscribe to network changes
    const unsubscribe = offlineService.onNetworkStatusChange((online) => {
      setIsOnline(online);
      if (online) {
        checkStatus();
      }
    });

    // Poll queue length periodically
    const interval = setInterval(() => {
      checkStatus();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

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
  }, [isOnline, queueLength]);

  const checkStatus = async () => {
    const status = await offlineService.getSyncStatus();
    setQueueLength(status.queueLength);
    setIsOnline(status.isOnline);
  };

  const handleSync = async () => {
    if (syncing || !isOnline) return;

    setSyncing(true);
    try {
      await offlineService.syncAll();
      await checkStatus();
    } finally {
      setSyncing(false);
    }
  };

  if (isOnline && queueLength === 0) {
    return null;
  }

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
          <Wifi size={16} color={theme.colors.neutral.white} />
        ) : (
          <WifiOff size={16} color={theme.colors.neutral.white} />
        )}
        <Text
          style={{
            color: theme.colors.neutral.white,
            fontSize: 12,
            fontWeight: "500",
          }}
        >
          {isOnline
            ? isRTL
              ? `${queueLength} عملية في الانتظار`
              : `${queueLength} pending sync`
            : isRTL
              ? "وضع عدم الاتصال"
              : "Offline Mode"}
        </Text>
      </View>
      {isOnline && queueLength > 0 && (
        <TouchableOpacity
          onPress={handleSync}
          disabled={syncing}
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <RefreshCw
            size={14}
            color={theme.colors.neutral.white}
            style={{
              opacity: syncing ? 0.5 : 1,
            }}
          />
          <Caption
            numberOfLines={1}
            style={{
              color: theme.colors.neutral.white,
              fontSize: 11,
            }}
          >
            {isRTL ? "مزامنة" : "Sync"}
          </Caption>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

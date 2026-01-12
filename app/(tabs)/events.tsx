import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { createThemedStyles, getTextStyle } from "@/utils/styles";
import { getUserHealthEvents } from "../../src/health/events/healthEventsService";
import { acknowledgeHealthEvent, resolveHealthEvent, escalateHealthEvent } from "../../src/health/events/createHealthEvent";
import type { HealthEvent } from "../../src/health/events/types";

export default function EventsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isRTL = i18n.language === "ar";

  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.base,
      backgroundColor: theme.colors.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    headerTitle: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.primary.main),
      fontSize: 28,
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.base,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.xl,
    },
    loadingText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      marginTop: theme.spacing.md,
    },
    eventCard: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      ...theme.shadows.sm,
    },
    eventHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.md,
    },
    eventType: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.text.primary),
    },
    eventStatus: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    statusBadge: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.md,
      ...getTextStyle(theme, "caption", "bold", theme.colors.neutral.white),
    },
    statusOpen: {
      backgroundColor: theme.colors.accent.error,
    },
    statusAcked: {
      backgroundColor: theme.colors.accent.warning,
    },
    statusResolved: {
      backgroundColor: theme.colors.accent.success,
    },
    statusEscalated: {
      backgroundColor: theme.colors.secondary.main,
    },
    eventReasons: {
      marginBottom: theme.spacing.md,
    },
    reasonItem: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
      marginBottom: theme.spacing.xs,
    },
    eventFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    eventTime: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
    },
    actionButtons: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    actionButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      ...getTextStyle(theme, "caption", "bold", theme.colors.neutral.white),
    },
    acknowledgeButton: {
      backgroundColor: theme.colors.accent.warning,
    },
    resolveButton: {
      backgroundColor: theme.colors.accent.success,
    },
    escalateButton: {
      backgroundColor: theme.colors.accent.error,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.xl,
    },
    emptyIcon: {
      marginBottom: theme.spacing.lg,
      opacity: 0.5,
    },
    emptyText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      textAlign: "center",
    },
    rtlText: {
      textAlign: "right",
    },
  }))(theme);

  const loadEvents = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const userEvents = await getUserHealthEvents(user.id);
      setEvents(userEvents);
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return "Just now";
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  const getStatusColor = (status: HealthEvent["status"]) => {
    switch (status) {
      case "OPEN":
        return styles.statusOpen;
      case "ACKED":
        return styles.statusAcked;
      case "RESOLVED":
        return styles.statusResolved;
      case "ESCALATED":
        return styles.statusEscalated;
      default:
        return styles.statusOpen;
    }
  };

  const getStatusText = (status: HealthEvent["status"]) => {
    switch (status) {
      case "OPEN":
        return "Open";
      case "ACKED":
        return "Acknowledged";
      case "RESOLVED":
        return "Resolved";
      case "ESCALATED":
        return "Escalated";
      default:
        return "Unknown";
    }
  };

  const handleAcknowledge = async (eventId: string) => {
    if (!user?.id) return;

    try {
      await acknowledgeHealthEvent(eventId, user.id);
      // Refresh events
      await loadEvents(true);
      Alert.alert(
        isRTL ? "تم" : "Success",
        isRTL ? "تم تأكيد الحدث" : "Event acknowledged"
      );
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في تأكيد الحدث" : "Failed to acknowledge event"
      );
    }
  };

  const handleResolve = async (eventId: string) => {
    if (!user?.id) return;

    try {
      await resolveHealthEvent(eventId, user.id);
      // Refresh events
      await loadEvents(true);
      Alert.alert(
        isRTL ? "تم" : "Success",
        isRTL ? "تم حل الحدث" : "Event resolved"
      );
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في حل الحدث" : "Failed to resolve event"
      );
    }
  };

  const handleEscalate = async (eventId: string) => {
    if (!user?.id) return;

    Alert.prompt(
      isRTL ? "تصعيد الحدث" : "Escalate Event",
      isRTL ? "أدخل سبب التصعيد:" : "Enter reason for escalation:",
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isRTL ? "تصعيد" : "Escalate",
          onPress: async (reason?: string) => {
            try {
              await escalateHealthEvent(eventId, user.id, reason || undefined);
              // Refresh events
              await loadEvents(true);
              Alert.alert(
                isRTL ? "تم" : "Success",
                isRTL ? "تم تصعيد الحدث" : "Event escalated"
              );
            } catch (error) {
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL ? "فشل في تصعيد الحدث" : "Failed to escalate event"
              );
            }
          }
        }
      ],
      "plain-text",
      "",
      "default"
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container as ViewStyle}>
        <View style={styles.header as ViewStyle}>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
            {isRTL ? "الأحداث الصحية" : "Health Events"}
          </Text>
        </View>
        <View style={styles.loadingContainer as ViewStyle}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
          <Text style={[styles.loadingText, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
            {isRTL ? "جاري التحميل..." : "Loading events..."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container as ViewStyle}>
      <View style={styles.header as ViewStyle}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
          {isRTL ? "الأحداث الصحية" : "Health Events"}
        </Text>
      </View>

      <ScrollView
        style={styles.content as ViewStyle}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadEvents(true)}
            tintColor={theme.colors.primary.main}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {events.length === 0 ? (
          <View style={styles.emptyContainer as ViewStyle}>
            <AlertTriangle
              size={64}
              color={theme.colors.text.secondary}
              style={styles.emptyIcon as ViewStyle}
            />
            <Text style={[styles.emptyText, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
              {isRTL ? "لا توجد أحداث صحية" : "No health events"}
            </Text>
          </View>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.eventCard as ViewStyle}>
              <View style={styles.eventHeader as ViewStyle}>
                <Text style={[styles.eventType, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
                  {event.type === "VITAL_ALERT"
                    ? (isRTL ? "تنبيه حيوي" : "Vital Alert")
                    : event.type}
                </Text>
                <View style={styles.eventStatus as ViewStyle}>
                  <View style={[styles.statusBadge, getStatusColor(event.status)] as StyleProp<ViewStyle>}>
                    <Text>{getStatusText(event.status)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.eventReasons as ViewStyle}>
                {event.reasons.map((reason, index) => (
                  <Text
                    key={index}
                    style={[styles.reasonItem, isRTL && styles.rtlText] as StyleProp<TextStyle>}
                  >
                    • {reason}
                  </Text>
                ))}
              </View>

              <View style={styles.eventFooter as ViewStyle}>
                <Text style={[styles.eventTime, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
                  {formatTime(event.createdAt)}
                </Text>

                {event.status === "OPEN" && (
                  <View style={styles.actionButtons as ViewStyle}>
                    <TouchableOpacity
                      onPress={() => handleAcknowledge(event.id!)}
                      style={[styles.actionButton, styles.acknowledgeButton] as StyleProp<ViewStyle>}
                    >
                      <Text>Acknowledge</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleEscalate(event.id!)}
                      style={[styles.actionButton, styles.escalateButton] as StyleProp<ViewStyle>}
                    >
                      <Text>Escalate</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(event.status === "OPEN" || event.status === "ACKED") && (
                  <TouchableOpacity
                    onPress={() => handleResolve(event.id!)}
                    style={[styles.actionButton, styles.resolveButton] as StyleProp<ViewStyle>}
                  >
                    <Text>Resolve</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
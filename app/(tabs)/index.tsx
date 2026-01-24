import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Heart,
  Phone,
  Pill,
  Settings,
  Smile,
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  type StyleProp,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// Design System Components
import DashboardWidgetSettings from "@/app/components/DashboardWidgetSettings";
import HealthInsightsCard from "@/app/components/HealthInsightsCard";
import ProactiveHealthSuggestions from "@/app/components/ProactiveHealthSuggestions";
import { Card } from "@/components/design-system";
import { Caption, Heading, Text } from "@/components/design-system/Typography";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useDailyNotificationScheduler } from "@/hooks/useSmartNotifications";
import { alertService } from "@/lib/services/alertService";
import {
  type DashboardConfig,
  dashboardWidgetService,
} from "@/lib/services/dashboardWidgetService";
import { medicationService } from "@/lib/services/medicationService";
import { symptomService } from "@/lib/services/symptomService";
import { userService } from "@/lib/services/userService";
import type { Medication, Symptom, User as UserType } from "@/types";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentSymptoms, setRecentSymptoms] = useState<Symptom[]>([]);
  const [todaysMedications, setTodaysMedications] = useState<Medication[]>([]);
  const [alertsCount, setAlertsCount] = useState(0);
  const [familyMembersCount, setFamilyMembersCount] = useState(0);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [userAlerts, setUserAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [markingMedication, setMarkingMedication] = useState<string | null>(
    null
  );
  const [stats, setStats] = useState({
    symptomsThisWeek: 0,
    avgSeverity: 0,
    medicationCompliance: 0,
  });
  const [familyMembers, setFamilyMembers] = useState<UserType[]>([]);
  const [dashboardConfig, setDashboardConfig] =
    useState<DashboardConfig | null>(null);
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);

  const isRTL = i18n.language === "ar";
  const isAdmin = user?.role === "admin";
  const hasFamily = Boolean(user?.familyId);

  // Initialize daily notification scheduler
  const notificationPrefs = (user as any)?.preferences?.notifications;
  const notificationsEnabled =
    typeof notificationPrefs === "object"
      ? notificationPrefs?.enabled !== false
      : notificationPrefs !== false;
  useDailyNotificationScheduler(notificationsEnabled);

  // Get notification scheduling functions
  const { scheduleRecurringMedicationReminder } = useNotifications();

  // Create themed styles
  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    content: {
      flex: 1,
    },
    contentInner: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.base,
    },
    header: {
      marginBottom: theme.spacing.xl,
    },
    welcomeText: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.primary.main),
      marginBottom: 4,
    },
    dateText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
    },
    dateTextRTL: {
      alignSelf: "flex-start" as const,
      textAlign: "left" as const,
    },
    statsContainer: {
      flexDirection: "row" as const,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
      marginBottom: theme.spacing.xl,
    },
    statCard: {
      width: Dimensions.get("window").width * 0.6,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      minHeight: 160,
      marginEnd: theme.spacing.md,
    },
    statCardContent: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
      padding: theme.spacing.lg,
      paddingTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
      width: "100%",
      flexWrap: "nowrap" as const,
    },
    statValue: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.secondary.main),
      fontSize: 32,
      marginTop: 0,
      marginBottom: theme.spacing.sm,
      textAlign: "center" as const,
      includeFontPadding: false,
      flexShrink: 1,
      minHeight: 40,
      paddingHorizontal: theme.spacing.xs,
      paddingTop: theme.spacing.xs,
    },
    statIcon: {
      marginBottom: theme.spacing.xl,
    },
    statLabel: {
      ...getTextStyle(theme, "body", "medium", theme.colors.text.secondary),
      fontSize: 14,
      textAlign: "center" as const,
      paddingHorizontal: theme.spacing.xs,
    },
    alertCard: {
      backgroundColor: theme.colors.accent.error + "10",
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.xl,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      borderStartWidth: 4,
      borderStartColor: theme.colors.accent.error,
    },
    alertContent: {
      marginStart: theme.spacing.md,
      flex: 1,
    },
    alertTitle: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.accent.error),
      marginBottom: 4,
    },
    alertText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.accent.error),
    },
    section: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.base,
      ...theme.shadows.md,
      alignItems: "stretch" as const,
    },
    sectionTitle: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.primary.main),
      marginBottom: theme.spacing.base,
    },
    sectionHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.base,
    },
    viewAllButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
    },
    viewAllText: {
      ...getTextStyle(theme, "body", "medium", theme.colors.primary.main),
    },
    medicationItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    medicationIcon: {
      width: 40,
      height: 40,
      backgroundColor: theme.colors.primary[50],
      borderRadius: 20,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginEnd: theme.spacing.md,
    },
    medicationInfo: {
      flex: 1,
    },
    medicationName: {
      ...getTextStyle(theme, "body", "semibold", theme.colors.text.primary),
      marginBottom: 4,
    },
    medicationDosage: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
    },
    medicationStatus: {
      alignItems: "center" as const,
    },
    statusCheckContainer: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    symptomItem: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    symptomInfo: {
      flex: 1,
    },
    symptomType: {
      ...getTextStyle(theme, "body", "semibold", theme.colors.text.primary),
      marginBottom: 4,
    },
    symptomTypeRTL: {
      alignSelf: "flex-start" as const,
      textAlign: "left" as const,
    },
    symptomTime: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
    },
    severityDisplay: {
      flexDirection: "row" as const,
      gap: 3,
    },
    severityDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    emptyText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.tertiary),
      textAlign: "center" as const,
      fontStyle: "italic" as const,
      paddingVertical: theme.spacing.lg,
    },
    emptyContainer: {
      paddingVertical: theme.spacing.lg,
      alignItems: "center" as const,
    },
    errorText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.accent.error),
      textAlign: "center" as const,
    },
    rtlText: {
      textAlign: "right" as const,
    },
    memberIndicator: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.secondary.main),
      marginTop: 2,
    },
    sosButton: {
      backgroundColor: theme.colors.accent.error,
      borderRadius: theme.borderRadius.full,
      width: 60,
      height: 60,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      position: "absolute" as const,
      bottom: theme.spacing.xl,
      ...theme.shadows.lg,
      zIndex: 1000,
    },
    sosButtonLTR: {
      right: theme.spacing.base,
    },
    sosButtonRTL: {
      left: theme.spacing.base,
    },
    sosButtonText: {
      ...getTextStyle(theme, "caption", "bold", theme.colors.neutral.white),
      fontSize: 10,
      marginTop: 2,
    },
    headerWithSOS: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "flex-start" as const,
      marginBottom: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
    },
    headerContent: {
      flex: 1,
    },
    sosHeaderButton: {
      backgroundColor: theme.colors.accent.error,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.spacing.sm,
      ...theme.shadows.md,
    },
    sosHeaderText: {
      ...getTextStyle(theme, "body", "bold", theme.colors.neutral.white),
    },
    onelineCard: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xl,
      marginBottom: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      ...theme.shadows.sm,
      alignItems: "center" as const,
    },
    onelineText: {
      ...getTextStyle(
        theme,
        "subheading",
        "medium",
        theme.colors.text.secondary
      ),
      fontStyle: "italic" as const,
      textAlign: "center" as const,
    },
    onelineSource: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.secondary.main),
      textAlign: "center" as const,
    },
    trackingSection: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
      ...theme.shadows.md,
    },
    trackingOptions: {
      flexDirection: "row" as const,
      gap: theme.spacing.md,
      flexWrap: "wrap" as const,
    },
    trackingCard: {
      flex: 1,
      minWidth: 140,
      backgroundColor: theme.colors.background.primary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      borderWidth: 2,
      borderColor: theme.colors.border.light,
      alignItems: "center" as const,
      ...theme.shadows.sm,
    },
    trackingCardIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.md,
    },
    trackingCardTitle: {
      ...getTextStyle(theme, "body", "bold", theme.colors.text.primary),
      marginBottom: theme.spacing.sm,
      textAlign: "center" as const,
    },
    trackingCardSubtitle: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
      textAlign: "center" as const,
      marginBottom: theme.spacing.md,
    },
    trackingCardButton: {
      backgroundColor: theme.colors.primary.main,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.spacing.xs,
    },
    trackingCardButtonText: {
      ...getTextStyle(theme, "caption", "bold", theme.colors.neutral.white),
    },
    quickActionsGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: theme.spacing.md,
      justifyContent: "flex-start" as const,
      alignItems: "stretch" as const,
    },
    quickActionCard: {
      flex: 1,
      minWidth: "45%",
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      alignItems: "center" as const,
      ...theme.shadows.sm,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
    },
    quickActionText: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.primary),
      marginTop: theme.spacing.sm,
      textAlign: "center" as const,
    },
  }))(theme);

  const loadDashboardConfig = async () => {
    if (!user) return;

    try {
      const config = await dashboardWidgetService.getDashboardConfig(user.id);
      setDashboardConfig(config);
    } catch (error) {
      // Handle error silently
    }
  };

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load dashboard config
      await loadDashboardConfig();

      // Always load family members first if user has family
      let members: UserType[] = [];
      if (user.familyId) {
        members = await userService.getFamilyMembers(user.familyId);
        setFamilyMembers(members);
        setFamilyMembersCount(members.length);
      }

      // Reset daily reminders first
      await medicationService.resetDailyReminders(user.id);

      // Load personal data
      const [symptoms, medications, alertsCountData, symptomStats] =
        await Promise.all([
          symptomService.getUserSymptoms(user.id, 5),
          medicationService.getTodaysMedications(user.id),
          alertService.getActiveAlertsCount(user.id),
          symptomService.getSymptomStats(user.id, 7),
        ]);

      setRecentSymptoms(symptoms);
      setTodaysMedications(medications);
      setAlertsCount(alertsCountData);

      // Schedule medication reminders for all active medications
      // This ensures reminders are scheduled even if they weren't scheduled when medication was added
      if (notificationsEnabled && scheduleRecurringMedicationReminder) {
        try {
          // Get all user medications (not just today's) to schedule all reminders
          const allMedications = await medicationService.getUserMedications(
            user.id
          );

          // Schedule reminders for each medication and reminder time
          for (const medication of allMedications) {
            if (!(medication.isActive && Array.isArray(medication.reminders))) {
              continue;
            }

            // Schedule each reminder time
            for (const reminder of medication.reminders) {
              if (reminder.time && reminder.time.trim()) {
                // Schedule reminder (this function handles deduplication)
                await scheduleRecurringMedicationReminder(
                  medication.name,
                  medication.dosage,
                  reminder.time
                ).catch(() => {
                  // Silently handle scheduling errors - don't block dashboard load
                });
              }
            }
          }
        } catch (error) {
          // Silently handle reminder scheduling errors - don't block dashboard load
        }
      }

      // Calculate personal medication compliance (optimized single pass)
      const today = new Date().toDateString();
      let totalReminders = 0;
      let takenReminders = 0;

      medications.forEach((med) => {
        const reminders = Array.isArray(med.reminders) ? med.reminders : [];
        totalReminders += reminders.length;

        reminders.forEach((r) => {
          if (r.taken && r.takenAt) {
            const takenDate = (r.takenAt as any).toDate
              ? (r.takenAt as any).toDate()
              : new Date(r.takenAt);
            if (takenDate.toDateString() === today) {
              takenReminders++;
            }
          }
        });
      });

      const compliance =
        totalReminders > 0 ? (takenReminders / totalReminders) * 100 : 100;

      setStats({
        symptomsThisWeek: symptomStats.totalSymptoms,
        avgSeverity: symptomStats.avgSeverity,
        medicationCompliance: Math.round(compliance),
      });
    } catch (error) {
      // Silently handle dashboard data load error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Memoize loadDashboardData to prevent unnecessary recreations
  const loadDashboardDataMemoized = useCallback(async () => {
    await loadDashboardData();
  }, [
    user?.id,
    user?.familyId,
    scheduleRecurringMedicationReminder,
    notificationsEnabled,
  ]);

  useEffect(() => {
    loadDashboardDataMemoized();
  }, [loadDashboardDataMemoized]);

  // Refresh data when tab is focused (only if not already loading)
  useFocusEffect(
    useCallback(() => {
      if (!(loading || refreshing)) {
        loadDashboardDataMemoized();
      }
    }, [loadDashboardDataMemoized, loading, refreshing])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const getSeverityColor = (severity: number) =>
    theme.colors.severity[severity as keyof typeof theme.colors.severity] ||
    theme.colors.neutral[500];

  // Find the next upcoming reminder for a medication that hasn't been taken
  const getNextUpcomingReminder = (medication: Medication) => {
    if (
      !Array.isArray(medication.reminders) ||
      medication.reminders.length === 0
    ) {
      return null;
    }

    const now = new Date();
    const today = now.toDateString();

    // Find reminders that haven't been taken today
    const untakenReminders = medication.reminders.filter((reminder) => {
      if (reminder.taken && reminder.takenAt) {
        const takenDate = (reminder.takenAt as any).toDate
          ? (reminder.takenAt as any).toDate()
          : new Date(reminder.takenAt);
        return takenDate.toDateString() !== today;
      }
      return !reminder.taken;
    });

    if (untakenReminders.length === 0) {
      return null;
    }

    // Find the next reminder time
    const reminderTimes = untakenReminders
      .filter((reminder) => {
        // Validate time format exists and is in expected format (HH:MM)
        return (
          reminder.time &&
          typeof reminder.time === "string" &&
          reminder.time.trim() &&
          reminder.time.includes(":")
        );
      })
      .map((reminder) => {
        const [hourStr, minuteStr] = reminder.time.split(":");
        const hour = Number.parseInt(hourStr, 10);
        const minute = Number.parseInt(minuteStr, 10);

        // Validate parsed values are valid numbers
        if (Number.isNaN(hour) || Number.isNaN(minute)) {
          return null;
        }

        const reminderTime = new Date();
        reminderTime.setHours(hour, minute, 0, 0);

        // If time has passed today, it's for tomorrow
        if (reminderTime < now) {
          reminderTime.setDate(reminderTime.getDate() + 1);
        }

        return { reminder, time: reminderTime };
      })
      .filter((item): item is { reminder: any; time: Date } => item !== null);

    // Sort by time and return the earliest
    reminderTimes.sort((a, b) => a.time.getTime() - b.time.getTime());
    return reminderTimes[0]?.reminder || null;
  };

  // Handle marking medication as taken
  const handleMarkMedicationTaken = async (medication: Medication) => {
    if (!user?.id) return;

    const nextReminder = getNextUpcomingReminder(medication);
    if (!nextReminder) {
      Alert.alert(
        isRTL ? "لا توجد تذكيرات" : "No Reminders",
        isRTL
          ? "جميع التذكيرات لهذا الدواء تم أخذها بالفعل"
          : "All reminders for this medication have already been taken"
      );
      return;
    }

    // Ensure reminder has an ID
    if (!nextReminder.id) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "التذكير لا يحتوي على معرف صالح"
          : "Reminder does not have a valid ID"
      );
      return;
    }

    try {
      setMarkingMedication(medication.id);
      await medicationService.markMedicationTaken(
        medication.id,
        nextReminder.id
      );

      // Refresh medications list
      await loadDashboardData();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "فشل في تسجيل تناول الدواء"
          : "Failed to mark medication as taken"
      );
    } finally {
      setMarkingMedication(null);
    }
  };

  const handleSOS = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
        // Silently fail if haptics is not available
      });
    } catch (error) {
      // Silently fail if haptics is not available
    }

    Alert.alert(
      isRTL ? "طوارئ" : "Emergency",
      isRTL
        ? "هل تريد الاتصال بخدمات الطوارئ؟"
        : "Do you want to call emergency services?",
      [
        {
          text: isRTL ? "إلغاء" : "Cancel",
          style: "cancel",
        },
        {
          text: isRTL ? "اتصال بـ 911" : "Call 911",
          style: "destructive",
          onPress: () => {
            Linking.openURL("tel:911").catch(() => {
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL ? "تعذر فتح تطبيق الهاتف" : "Unable to open phone app"
              );
            });
          },
        },
        {
          text: isRTL ? "إشعار العائلة" : "Notify Family",
          onPress: async () => {
            try {
              if (!user?.id) {
                Alert.alert(
                  isRTL ? "خطأ" : "Error",
                  isRTL ? "يجب تسجيل الدخول أولاً" : "You must be logged in"
                );
                return;
              }

              // Check if user has a family
              if (!user.familyId) {
                Alert.alert(
                  isRTL ? "لا توجد عائلة" : "No Family",
                  isRTL
                    ? "لا توجد عائلة مرتبطة بحسابك. يرجى إضافة أفراد العائلة أولاً."
                    : "No family is linked to your account. Please add family members first."
                );
                return;
              }

              // Check if there are any family members to notify
              const { userService } = await import(
                "@/lib/services/userService"
              );
              const familyMembers = await userService.getFamilyMembers(
                user.familyId
              );
              const membersToNotify = familyMembers.filter(
                (member) => member.id !== user.id
              );

              if (membersToNotify.length === 0) {
                Alert.alert(
                  isRTL ? "لا يوجد أفراد للتنبيه" : "No Family Members",
                  isRTL
                    ? "لا يوجد أفراد آخرين في عائلتك للتنبيه."
                    : "There are no other family members to notify."
                );
                return;
              }

              // Create emergency alert
              const userName =
                user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user.firstName || (isRTL ? "مستخدم" : "User");
              const alertData = {
                userId: user.id,
                type: "emergency" as const,
                severity: "critical" as const,
                message: isRTL
                  ? `${userName} بحاجة إلى مساعدة طارئة!`
                  : `${userName} needs emergency help!`,
                timestamp: new Date(),
                resolved: false,
                responders: [],
              };

              const alertId = await alertService.createAlert(alertData);

              // Send notification to family
              const { pushNotificationService } = await import(
                "@/lib/services/pushNotificationService"
              );
              await pushNotificationService.sendEmergencyAlert(
                user.id,
                alertData.message,
                alertId,
                user.familyId
              );

              Alert.alert(
                isRTL ? "تم إرسال الإشعار" : "Notification Sent",
                isRTL
                  ? `تم إرسال إشعار طوارئ إلى ${membersToNotify.length} ${membersToNotify.length === 1 ? "عضو" : "أعضاء"} من العائلة`
                  : `Emergency notification sent to ${membersToNotify.length} family ${membersToNotify.length === 1 ? "member" : "members"}`
              );
            } catch (error) {
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL
                  ? "فشل إرسال الإشعار. حاول مرة أخرى."
                  : "Failed to send notification. Please try again."
              );
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Get enabled widgets sorted by order
  // If config is not loaded yet, use default widgets to show something during initial load
  const enabledWidgets = dashboardConfig
    ? dashboardWidgetService.getEnabledWidgets(dashboardConfig)
    : dashboardWidgetService.getEnabledWidgets({
        userId: user?.id || "",
        widgets: [
          { id: "stats", enabled: true, order: 0 },
          { id: "todaysMedications", enabled: true, order: 1 },
          { id: "recentSymptoms", enabled: true, order: 2 },
          { id: "healthInsights", enabled: true, order: 3 },
          { id: "alerts", enabled: true, order: 4 },
          { id: "familyMembers", enabled: true, order: 5 },
          { id: "quickActions", enabled: true, order: 6 },
        ],
        updatedAt: new Date(),
      });

  // Widget render functions
  const renderWidget = (widgetId: string) => {
    switch (widgetId) {
      case "stats":
        return (
          <View key="stats">
            <ScrollView
              contentContainerStyle={styles.statsContainer as ViewStyle}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={
                isRTL
                  ? { marginStart: -theme.spacing.base, marginEnd: 0 }
                  : { marginHorizontal: -theme.spacing.base }
              }
            >
              <Card
                contentStyle={{ padding: 0 }}
                onPress={() => router.push("/(tabs)/symptoms")}
                pressable={true}
                style={styles.statCard as ViewStyle}
                variant="elevated"
              >
                <View style={styles.statCardContent as ViewStyle}>
                  <View style={styles.statIcon as ViewStyle}>
                    <Activity color={theme.colors.primary.main} size={32} />
                  </View>
                  <Text
                    adjustsFontSizeToFit={true}
                    color={theme.colors.secondary.main}
                    minimumFontScale={0.6}
                    numberOfLines={1}
                    size="large"
                    style={
                      [
                        styles.statValue,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                    weight="bold"
                  >
                    {stats.symptomsThisWeek}
                  </Text>
                  <Text
                    style={
                      [
                        styles.statLabel,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                    weight="medium"
                  >
                    {isRTL
                      ? "الأعراض الصحية هذا الأسبوع"
                      : "Symptoms This Week"}
                  </Text>
                </View>
              </Card>

              <Card
                contentStyle={{ padding: 0 }}
                onPress={() => router.push("/(tabs)/medications")}
                pressable={true}
                style={styles.statCard as ViewStyle}
                variant="elevated"
              >
                <View style={styles.statCardContent as ViewStyle}>
                  <View style={styles.statIcon as ViewStyle}>
                    <Pill color={theme.colors.accent.success} size={32} />
                  </View>
                  <Text
                    adjustsFontSizeToFit={true}
                    color={theme.colors.secondary.main}
                    minimumFontScale={0.7}
                    numberOfLines={1}
                    size="large"
                    style={
                      [
                        styles.statValue,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                    weight="bold"
                  >
                    {stats.medicationCompliance}%
                  </Text>
                  <Text
                    style={
                      [
                        styles.statLabel,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                    weight="medium"
                  >
                    {isRTL ? "الالتزام بالدواء" : "Med Compliance"}
                  </Text>
                </View>
              </Card>

              <Card
                contentStyle={{ padding: 0 }}
                onPress={() => router.push("/(tabs)/family")}
                pressable={true}
                style={styles.statCard as ViewStyle}
                variant="elevated"
              >
                <View style={styles.statCardContent as ViewStyle}>
                  <View style={styles.statIcon as ViewStyle}>
                    <Users color={theme.colors.secondary.main} size={32} />
                  </View>
                  <Text
                    adjustsFontSizeToFit={true}
                    color={theme.colors.secondary.main}
                    minimumFontScale={0.7}
                    numberOfLines={1}
                    size="large"
                    style={
                      [
                        styles.statValue,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                    weight="bold"
                  >
                    {familyMembersCount || 1}
                  </Text>
                  <Text
                    style={
                      [
                        styles.statLabel,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                    weight="medium"
                  >
                    {isRTL ? "أفراد العائلة" : "Family Members"}
                  </Text>
                </View>
              </Card>
            </ScrollView>
          </View>
        );

      case "todaysMedications":
        return (
          <View key="todaysMedications" style={styles.section as ViewStyle}>
            <View style={styles.sectionHeader as ViewStyle}>
              <Text
                style={
                  [
                    styles.sectionTitle,
                    isRTL && styles.rtlText,
                  ] as StyleProp<TextStyle>
                }
              >
                {isRTL ? "أدوية اليوم" : "Today's Medications"}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/medications")}
                style={styles.viewAllButton as ViewStyle}
              >
                <Text
                  style={
                    [
                      styles.viewAllText,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "عرض الكل" : "View All"}
                </Text>
                <ChevronRight color={theme.colors.primary.main} size={16} />
              </TouchableOpacity>
            </View>

            {todaysMedications.length > 0 ? (
              todaysMedications.slice(0, 3).map((medication) => {
                const nextReminder = getNextUpcomingReminder(medication);
                const hasUntakenReminders = nextReminder !== null;
                const allTaken =
                  Array.isArray(medication.reminders) &&
                  medication.reminders.length > 0 &&
                  medication.reminders.every((r) => {
                    if (!r.taken) return false;
                    if (r.takenAt) {
                      const takenDate = (r.takenAt as any).toDate
                        ? (r.takenAt as any).toDate()
                        : new Date(r.takenAt);
                      return (
                        takenDate.toDateString() === new Date().toDateString()
                      );
                    }
                    return r.taken;
                  });

                return (
                  <View
                    key={medication.id}
                    style={styles.medicationItem as ViewStyle}
                  >
                    <TouchableOpacity
                      onPress={() => router.push("/(tabs)/medications")}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <View style={styles.medicationIcon as ViewStyle}>
                        <Pill color={theme.colors.primary.main} size={20} />
                      </View>
                      <View style={styles.medicationInfo as ViewStyle}>
                        <Text
                          style={
                            [
                              styles.medicationName,
                              isRTL && styles.rtlText,
                            ] as StyleProp<TextStyle>
                          }
                        >
                          {medication.name}
                        </Text>
                        <Text
                          style={
                            [
                              styles.medicationDosage,
                              isRTL && styles.rtlText,
                            ] as StyleProp<TextStyle>
                          }
                        >
                          {medication.dosage} • {medication.frequency}
                          {nextReminder && (
                            <Text
                              style={
                                [
                                  styles.medicationDosage,
                                  isRTL && styles.rtlText,
                                  { marginTop: 2 },
                                ] as StyleProp<TextStyle>
                              }
                            >
                              {" • "}
                              {isRTL ? "التذكير التالي: " : "Next: "}
                              {nextReminder.time}
                            </Text>
                          )}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.medicationStatus as ViewStyle}>
                      {hasUntakenReminders ? (
                        <TouchableOpacity
                          disabled={markingMedication === medication.id}
                          onPress={() => handleMarkMedicationTaken(medication)}
                          style={
                            [
                              styles.statusCheckContainer,
                              {
                                backgroundColor:
                                  markingMedication === medication.id
                                    ? theme.colors.neutral[400]
                                    : theme.colors.accent.success,
                                opacity:
                                  markingMedication === medication.id ? 0.6 : 1,
                              },
                            ] as StyleProp<ViewStyle>
                          }
                        >
                          {markingMedication === medication.id ? (
                            <ActivityIndicator
                              color={theme.colors.neutral.white}
                              size={16}
                            />
                          ) : (
                            <Check
                              color={theme.colors.neutral.white}
                              size={16}
                              strokeWidth={3}
                            />
                          )}
                        </TouchableOpacity>
                      ) : allTaken ? (
                        <View
                          style={
                            [
                              styles.statusCheckContainer,
                              { backgroundColor: theme.colors.accent.success },
                            ] as StyleProp<ViewStyle>
                          }
                        >
                          <Check
                            color={theme.colors.neutral.white}
                            size={16}
                            strokeWidth={3}
                          />
                        </View>
                      ) : (
                        <View
                          style={
                            [
                              styles.statusCheckContainer,
                              {
                                backgroundColor:
                                  theme.colors.background.secondary,
                                borderColor: theme.colors.border.medium,
                                borderWidth: 2,
                              },
                            ] as StyleProp<ViewStyle>
                          }
                        >
                          <Check
                            color={theme.colors.text.tertiary}
                            size={16}
                            strokeWidth={2}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            ) : (
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/medications")}
                style={styles.emptyContainer as ViewStyle}
              >
                <Text
                  style={
                    [
                      styles.emptyText,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL
                    ? "لا توجد أدوية لليوم - اضغط لإضافة دواء"
                    : "No medications for today - tap to add"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case "recentSymptoms":
        return (
          <View key="recentSymptoms" style={styles.section as ViewStyle}>
            <View style={styles.sectionHeader as ViewStyle}>
              <Text
                style={
                  [
                    styles.sectionTitle,
                    isRTL && styles.rtlText,
                  ] as StyleProp<TextStyle>
                }
              >
                {isRTL ? "الأعراض الصحية الأخيرة" : "Recent Symptoms"}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/symptoms")}
                style={styles.viewAllButton as ViewStyle}
              >
                <Text
                  style={
                    [
                      styles.viewAllText,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "عرض الكل" : "View All"}
                </Text>
                <ChevronRight color={theme.colors.primary.main} size={16} />
              </TouchableOpacity>
            </View>

            {recentSymptoms.length > 0 ? (
              recentSymptoms.map((symptom) => (
                <TouchableOpacity
                  key={symptom.id}
                  onPress={() => router.push("/(tabs)/symptoms")}
                  style={[
                    styles.symptomItem as ViewStyle,
                    isRTL && { flexDirection: "row-reverse" as const },
                  ]}
                >
                  <View style={styles.symptomInfo as ViewStyle}>
                    <Text
                      style={
                        [
                          styles.symptomType,
                          isRTL && styles.rtlText,
                          isRTL && styles.symptomTypeRTL,
                        ] as StyleProp<TextStyle>
                      }
                    >
                      {t(symptom.type)}
                    </Text>
                    <Text
                      style={
                        [
                          styles.symptomTime,
                          isRTL && styles.rtlText,
                        ] as StyleProp<TextStyle>
                      }
                    >
                      {formatTime(symptom.timestamp)}
                    </Text>
                  </View>
                  <View style={styles.severityDisplay as ViewStyle}>
                    {[...Array(5)].map((_, i) => (
                      <View
                        key={i}
                        style={
                          [
                            styles.severityDot,
                            {
                              backgroundColor:
                                i < symptom.severity
                                  ? getSeverityColor(symptom.severity)
                                  : theme.colors.neutral[200],
                            },
                          ] as StyleProp<ViewStyle>
                        }
                      />
                    ))}
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/symptoms")}
                style={styles.emptyContainer as ViewStyle}
              >
                <Text
                  style={
                    [
                      styles.emptyText,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL
                    ? "لا توجد أعراض الصحية مسجلة - اضغط لإضافة أعراض صحية"
                    : "No symptoms recorded - tap to add"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case "alerts":
        if (alertsCount === 0) return null;
        return (
          <View key="alerts">
            <Card
              contentStyle={undefined}
              onPress={async () => {
                if (!user?.id) return;
                setShowAlertsModal(true);
                setLoadingAlerts(true);
                try {
                  const alerts = await alertService.getActiveAlerts(user.id);
                  setUserAlerts(alerts);
                } finally {
                  setLoadingAlerts(false);
                }
              }}
              style={styles.alertCard as ViewStyle}
              variant="elevated"
            >
              <AlertTriangle color={theme.colors.accent.error} size={24} />
              <View style={styles.alertContent as ViewStyle}>
                <Text
                  color={theme.colors.accent.error}
                  style={
                    [
                      styles.alertTitle,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                  weight="bold"
                >
                  {isRTL
                    ? "تنبيهات طوارئ صحية نشطة"
                    : "Active Emergency Alerts"}
                </Text>
                <Text
                  color={theme.colors.accent.error}
                  style={
                    [
                      styles.alertText,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL
                    ? `لديك ${alertsCount} تنبيه${
                        alertsCount > 1 ? "ات" : ""
                      } يتطلب الانتباه`
                    : `You have ${alertsCount} alert${
                        alertsCount > 1 ? "s" : ""
                      } requiring attention`}
                </Text>
              </View>
              <ChevronRight color={theme.colors.accent.error} size={20} />
            </Card>
          </View>
        );

      case "healthInsights":
        return (
          <View key="healthInsights" style={styles.section as ViewStyle}>
            <HealthInsightsCard />
            <ProactiveHealthSuggestions maxSuggestions={5} />
          </View>
        );

      case "familyMembers":
        // Family members are shown in stats widget, so this can be a no-op or show additional family info
        return null;

      case "quickActions":
        return (
          <View key="quickActions" style={styles.section as ViewStyle}>
            <View style={styles.sectionHeader as ViewStyle}>
              <Text
                style={
                  [
                    styles.sectionTitle,
                    isRTL && styles.rtlText,
                  ] as StyleProp<TextStyle>
                }
              >
                {isRTL ? "إجراءات سريعة" : "Quick Actions"}
              </Text>
            </View>

            <View style={styles.quickActionsGrid as ViewStyle}>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/track")}
                style={styles.quickActionCard as ViewStyle}
              >
                <Activity color={theme.colors.primary.main} size={24} />
                <Text
                  style={
                    [
                      styles.quickActionText,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "تتبع الصحة" : "Track Health"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/medications")}
                style={styles.quickActionCard as ViewStyle}
              >
                <Pill color={theme.colors.accent.success} size={24} />
                <Text
                  style={
                    [
                      styles.quickActionText,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "إدارة الأدوية" : "Medications"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/vitals")}
                style={styles.quickActionCard as ViewStyle}
              >
                <Heart color={theme.colors.secondary.main} size={24} />
                <Text
                  style={
                    [
                      styles.quickActionText,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "المؤشرات الحيوية" : "Vital Signs"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/family")}
                style={styles.quickActionCard as ViewStyle}
              >
                <Users color={theme.colors.primary.light} size={24} />
                <Text
                  style={
                    [
                      styles.quickActionText,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "إدارة العائلة" : "Manage Family"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container as ViewStyle}>
        <View style={styles.centerContainer as ViewStyle}>
          <Text
            color={theme.colors.accent.error}
            style={styles.errorText as TextStyle}
          >
            {t(
              "pleaseLogInToViewDashboard",
              "Please log in to view your dashboard"
            )}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container as ViewStyle}>
      <ScrollView
        contentContainerStyle={styles.contentInner as ViewStyle}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl onRefresh={onRefresh} refreshing={refreshing} />
        }
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.content as ViewStyle}
      >
        {/* Header with SOS Button */}
        <View style={styles.headerWithSOS as ViewStyle}>
          <View
            style={[
              styles.headerContent as ViewStyle,
              isRTL && { marginEnd: theme.spacing.md },
            ]}
          >
            <Heading
              color={theme.colors.primary.main}
              level={4}
              style={
                [
                  styles.welcomeText,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {isRTL
                ? `مرحباً، ${user.firstName || "User"}`
                : `Welcome, ${user.firstName || "User"}`}
            </Heading>
            <Caption
              color={theme.colors.text.secondary}
              numberOfLines={undefined}
              style={
                [
                  styles.dateText,
                  isRTL && styles.rtlText,
                  isRTL && styles.dateTextRTL,
                ] as StyleProp<TextStyle>
              }
            >
              {new Date().toLocaleDateString(
                isRTL ? "ar-u-ca-gregory" : "en-US",
                {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }
              )}
            </Caption>
          </View>
          <View
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              gap: 12,
              zIndex: 1001,
              flexShrink: 0,
            }}
          >
            {isAdmin && (
              <Pressable
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                    () => {}
                  );
                  setShowWidgetSettings(true);
                }}
                style={({ pressed }) => ({
                  backgroundColor: theme.colors.background.secondary,
                  borderRadius: 20,
                  padding: 10,
                  justifyContent: "center",
                  alignItems: "center",
                  zIndex: 1001,
                  elevation: 5,
                  minWidth: 40,
                  minHeight: 40,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Settings color={theme.colors.text.primary} size={20} />
              </Pressable>
            )}
            <TouchableOpacity
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={handleSOS}
              style={[
                styles.sosHeaderButton as ViewStyle,
                isRTL && { marginStart: theme.spacing.md },
              ]}
            >
              <Phone color={theme.colors.neutral.white} size={20} />
              <Text
                color={theme.colors.neutral.white}
                style={styles.sosHeaderText as StyleProp<TextStyle>}
                weight="bold"
              >
                {isRTL ? "SOS" : "SOS"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Render widgets dynamically based on config order (Admin only) */}
        {isAdmin && enabledWidgets.map((widget) => renderWidget(widget.id))}

        {/* Alerts Modal */}
        <Modal
          animationType="slide"
          onRequestClose={() => setShowAlertsModal(false)}
          transparent={true}
          visible={showAlertsModal}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                backgroundColor: theme.colors.background.primary,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                maxHeight: "80%",
                padding: theme.spacing.base,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: theme.spacing.base,
                }}
              >
                <Text
                  style={
                    [
                      getTextStyle(
                        theme,
                        "heading",
                        "bold",
                        theme.colors.text.primary
                      ),
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL
                    ? "التنبيهات الطوارئ الصحية الفعالة"
                    : "Active Emergency Alerts"}
                </Text>
                <TouchableOpacity onPress={() => setShowAlertsModal(false)}>
                  <Text
                    style={
                      getTextStyle(
                        theme,
                        "body",
                        "medium",
                        theme.colors.primary.main
                      ) as StyleProp<TextStyle>
                    }
                  >
                    {isRTL ? "إغلاق" : "Close"}
                  </Text>
                </TouchableOpacity>
              </View>

              {loadingAlerts ? (
                <View
                  style={{
                    paddingVertical: theme.spacing.xl,
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator
                    color={theme.colors.primary.main}
                    size="large"
                  />
                </View>
              ) : userAlerts.length === 0 ? (
                <View
                  style={{
                    paddingVertical: theme.spacing.xl,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={
                      [
                        getTextStyle(
                          theme,
                          "body",
                          "regular",
                          theme.colors.text.secondary
                        ),
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {isRTL
                      ? "لا توجد تنبيهات طوارئ صحية نشطة"
                      : "No active emergency alerts"}
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {userAlerts.map((alert) => (
                    <View
                      key={alert.id}
                      style={{
                        backgroundColor: theme.colors.background.secondary,
                        borderRadius: theme.borderRadius.lg,
                        padding: theme.spacing.base,
                        marginBottom: theme.spacing.md,
                        borderStartWidth: 4,
                        borderStartColor: theme.colors.accent.error,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: theme.spacing.sm,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={
                              [
                                getTextStyle(
                                  theme,
                                  "subheading",
                                  "bold",
                                  theme.colors.text.primary
                                ),
                                isRTL && styles.rtlText,
                              ] as StyleProp<TextStyle>
                            }
                          >
                            {alert.type === "fall"
                              ? isRTL
                                ? "تنبيه سقوط"
                                : "Fall Detection"
                              : alert.type === "emergency"
                                ? isRTL
                                  ? "طوارئ"
                                  : "Emergency"
                                : alert.type === "medication"
                                  ? isRTL
                                    ? "دواء"
                                    : "Medication"
                                  : isRTL
                                    ? "مؤشرات حيوية"
                                    : "Vitals"}
                          </Text>
                          <Text
                            style={
                              [
                                getTextStyle(
                                  theme,
                                  "caption",
                                  "regular",
                                  theme.colors.text.secondary
                                ),
                                isRTL && styles.rtlText,
                                { marginTop: 4 },
                              ] as StyleProp<TextStyle>
                            }
                          >
                            {alert.timestamp.toLocaleString()}
                          </Text>
                        </View>
                        <TouchableOpacity
                          disabled={loadingAlerts}
                          onPress={async () => {
                            try {
                              setLoadingAlerts(true);

                              await alertService.resolveAlert(
                                alert.id,
                                user.id
                              );

                              // Wait for Firestore to update
                              await new Promise((resolve) =>
                                setTimeout(resolve, 1500)
                              );

                              // Refresh alerts list
                              const updatedAlerts =
                                await alertService.getActiveAlerts(user.id);

                              setUserAlerts(updatedAlerts);
                              setAlertsCount(updatedAlerts.length);

                              // Refresh dashboard data
                              await loadDashboardData();

                              if (updatedAlerts.length === 0) {
                                setShowAlertsModal(false);
                                Alert.alert(
                                  isRTL ? "نجح" : "Success",
                                  isRTL
                                    ? "تم حل جميع التنبيهات الطوارئ الصحية الفعالة"
                                    : "All alerts resolved"
                                );
                              } else {
                                Alert.alert(
                                  isRTL ? "نجح" : "Success",
                                  isRTL ? "تم حل التنبيه" : "Alert resolved"
                                );
                              }
                            } catch (error: any) {
                              // Silently handle alert resolution error
                              Alert.alert(
                                isRTL ? "خطأ" : "Error",
                                isRTL
                                  ? `فشل في حل التنبيه: ${error.message || "خطأ غير معروف"}`
                                  : `Failed to resolve alert: ${error.message || "Unknown error"}`
                              );
                            } finally {
                              setLoadingAlerts(false);
                            }
                          }}
                          style={{
                            backgroundColor: loadingAlerts
                              ? theme.colors.neutral[400]
                              : theme.colors.accent.error,
                            paddingHorizontal: theme.spacing.md,
                            paddingVertical: theme.spacing.sm,
                            borderRadius: theme.borderRadius.md,
                            opacity: loadingAlerts ? 0.6 : 1,
                          }}
                        >
                          <Text
                            style={
                              getTextStyle(
                                theme,
                                "caption",
                                "bold",
                                theme.colors.neutral.white
                              ) as StyleProp<TextStyle>
                            }
                          >
                            {isRTL ? "حل" : "Resolve"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <Text
                        style={
                          [
                            getTextStyle(
                              theme,
                              "body",
                              "regular",
                              theme.colors.text.primary
                            ),
                            isRTL && styles.rtlText,
                            { marginTop: theme.spacing.sm },
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {alert.message}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Health Tracking Section for Regular Users */}
        {!isAdmin && (
          <View style={styles.trackingSection as ViewStyle}>
            <View style={styles.sectionHeader as ViewStyle}>
              <Text
                style={
                  [
                    styles.sectionTitle,
                    isRTL && styles.rtlText,
                  ] as StyleProp<TextStyle>
                }
              >
                {isRTL ? "تتبع الصحة اليومي" : "Daily Health Tracking"}
              </Text>
            </View>

            <View style={styles.trackingOptions as ViewStyle}>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/symptoms")}
                style={styles.trackingCard as ViewStyle}
              >
                <View
                  style={
                    [
                      styles.trackingCardIcon,
                      { backgroundColor: theme.colors.primary[50] },
                    ] as StyleProp<ViewStyle>
                  }
                >
                  <Activity color={theme.colors.primary.main} size={28} />
                </View>
                <Text
                  style={
                    [
                      styles.trackingCardTitle,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "الأعراض الصحية" : "Symptoms"}
                </Text>
                <Text
                  style={
                    [
                      styles.trackingCardSubtitle,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "تسجيل الأعراض الصحية" : "Log health symptoms"}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/symptoms")}
                  style={styles.trackingCardButton as ViewStyle}
                >
                  <Activity color={theme.colors.neutral.white} size={16} />
                  <Text
                    style={
                      styles.trackingCardButtonText as StyleProp<TextStyle>
                    }
                  >
                    {isRTL ? "تسجيل" : "Log"}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/medications")}
                style={styles.trackingCard as ViewStyle}
              >
                <View
                  style={
                    [
                      styles.trackingCardIcon,
                      { backgroundColor: theme.colors.accent.success + "20" },
                    ] as StyleProp<ViewStyle>
                  }
                >
                  <Pill color={theme.colors.accent.success} size={28} />
                </View>
                <Text
                  style={
                    [
                      styles.trackingCardTitle,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "الأدوية" : "Medications"}
                </Text>
                <Text
                  style={
                    [
                      styles.trackingCardSubtitle,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL
                    ? "إدارة الأدوية والتذكيرات"
                    : "Manage meds & reminders"}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/medications")}
                  style={styles.trackingCardButton as ViewStyle}
                >
                  <Pill color={theme.colors.neutral.white} size={16} />
                  <Text
                    style={
                      styles.trackingCardButtonText as StyleProp<TextStyle>
                    }
                  >
                    {isRTL ? "إدارة" : "Manage"}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/moods")}
                style={styles.trackingCard as ViewStyle}
              >
                <View
                  style={
                    [
                      styles.trackingCardIcon,
                      { backgroundColor: theme.colors.accent.warning + "20" },
                    ] as StyleProp<ViewStyle>
                  }
                >
                  <Smile color={theme.colors.accent.warning} size={28} />
                </View>
                <Text
                  style={
                    [
                      styles.trackingCardTitle,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "الحالة النفسية" : "Mood"}
                </Text>
                <Text
                  style={
                    [
                      styles.trackingCardSubtitle,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "تسجيل المزاج اليومي" : "Track daily mood"}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/moods")}
                  style={
                    [
                      styles.trackingCardButton,
                      { backgroundColor: theme.colors.accent.warning },
                    ] as StyleProp<ViewStyle>
                  }
                >
                  <Smile color={theme.colors.neutral.white} size={16} />
                  <Text
                    style={
                      styles.trackingCardButtonText as StyleProp<TextStyle>
                    }
                  >
                    {isRTL ? "تسجيل" : "Log"}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/vitals")}
                style={styles.trackingCard as ViewStyle}
              >
                <View
                  style={
                    [
                      styles.trackingCardIcon,
                      { backgroundColor: theme.colors.accent.info + "20" },
                    ] as StyleProp<ViewStyle>
                  }
                >
                  <Heart color={theme.colors.accent.info} size={28} />
                </View>
                <Text
                  style={
                    [
                      styles.trackingCardTitle,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "العلامات الحيوية" : "Vitals"}
                </Text>
                <Text
                  style={
                    [
                      styles.trackingCardSubtitle,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "قياس الضغط والنبض" : "Blood pressure & pulse"}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/vitals")}
                  style={
                    [
                      styles.trackingCardButton,
                      { backgroundColor: theme.colors.accent.info },
                    ] as StyleProp<ViewStyle>
                  }
                >
                  <Heart color={theme.colors.neutral.white} size={16} />
                  <Text
                    style={
                      styles.trackingCardButtonText as StyleProp<TextStyle>
                    }
                  >
                    {isRTL ? "قياس" : "Measure"}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Maak One-liner */}
        <View style={styles.onelineCard as ViewStyle}>
          <Text
            style={
              [
                styles.onelineText,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            {isRTL
              ? '"لأن الصحة تبدأ من المنزل"'
              : '"Because health starts at home."'}
          </Text>
        </View>

        {/* Widget Settings Modal */}
        <DashboardWidgetSettings
          onClose={() => setShowWidgetSettings(false)}
          onConfigChange={(config) => {
            // Update the dashboard config immediately with the saved config
            setDashboardConfig(config);
          }}
          visible={showWidgetSettings}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Heart,
  HelpCircle,
  Phone,
  Pill,
  Settings,
  Smile,
  Sparkles,
  Users,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  type StyleProp,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { alertService } from "@/lib/services/alertService";
import { medicationService } from "@/lib/services/medicationService";
import { symptomService } from "@/lib/services/symptomService";
import { userService } from "@/lib/services/userService";
import type { Medication, Symptom, User as UserType } from "@/types";
import { createThemedStyles, getTextStyle } from "@/utils/styles";
// Design System Components
import DashboardWidgetSettings from "@/app/components/DashboardWidgetSettings";
import HealthInsightsCard from "@/app/components/HealthInsightsCard";
import ProactiveHealthSuggestions from "@/app/components/ProactiveHealthSuggestions";
import { AIInsightsDashboard } from "@/app/components/AIInsightsDashboard";
import { Button, Card } from "@/components/design-system";
import { Heading, Text, Caption } from "@/components/design-system/Typography";
import { Badge } from "@/components/design-system/AdditionalComponents";
import {
  dashboardWidgetService,
  type DashboardConfig,
} from "@/lib/services/dashboardWidgetService";
import { useDailyNotificationScheduler } from "@/hooks/useSmartNotifications";

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
  const [stats, setStats] = useState({
    symptomsThisWeek: 0,
    avgSeverity: 0,
    medicationCompliance: 0,
  });
  const [familyMembers, setFamilyMembers] = useState<UserType[]>([]);
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig | null>(null);
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
    healthInsightsSection: {
      marginBottom: theme.spacing.xl,
    },
    healthInsightsGrid: {
      gap: theme.spacing.md,
    },
    healthInsightCard: {
      flexDirection: "row" as const,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      alignItems: "center" as const,
      ...theme.shadows.sm,
    },
    healthInsightIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginEnd: theme.spacing.md,
    },
    healthInsightContent: {
      flex: 1,
    },
    healthInsightTitle: {
      ...getTextStyle(theme, "body", "semibold", theme.colors.primary.main),
      marginBottom: 4,
    },
    healthInsightMessage: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      fontSize: 14,
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
  }, [user?.id, user?.familyId]);

  useEffect(() => {
    loadDashboardDataMemoized();
  }, [loadDashboardDataMemoized]);

  // Refresh data when tab is focused (only if not already loading)
  useFocusEffect(
    useCallback(() => {
      if (!loading && !refreshing) {
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

              // Send notification to family if user has family
              if (user.familyId) {
                const { pushNotificationService } = await import(
                  "@/lib/services/pushNotificationService"
                );
                await pushNotificationService.sendEmergencyAlert(
                  user.id,
                  alertData.message,
                  alertId,
                  user.familyId
                );
              }

              Alert.alert(
                isRTL ? "تم إرسال الإشعار" : "Notification Sent",
                isRTL
                  ? "تم إرسال إشعار طوارئ لجميع أفراد العائلة"
                  : "Emergency notification sent to all family members"
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
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statsContainer as ViewStyle}
              style={isRTL ? { marginStart: -theme.spacing.base, marginEnd: 0 } : { marginHorizontal: -theme.spacing.base }}
            >
              <Card 
                variant="elevated" 
                onPress={() => router.push("/(tabs)/symptoms")}
                pressable={true}
                style={styles.statCard as ViewStyle}
                contentStyle={{ padding: 0 }}
              >
                <View style={styles.statCardContent as ViewStyle}>
                  <View style={styles.statIcon as ViewStyle}>
                    <Activity color={theme.colors.primary.main} size={32} />
                  </View>
                  <Text
                    weight="bold"
                    size="large"
                    color={theme.colors.secondary.main}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.6}
                    style={
                      [
                        styles.statValue,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {stats.symptomsThisWeek}
                  </Text>
                  <Text
                    weight="medium"
                    style={
                      [
                        styles.statLabel,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {isRTL ? "الأعراض الصحية هذا الأسبوع" : "Symptoms This Week"}
                  </Text>
                </View>
              </Card>

              <Card 
                variant="elevated" 
                onPress={() => router.push("/(tabs)/medications")}
                pressable={true}
                style={styles.statCard as ViewStyle}
                contentStyle={{ padding: 0 }}
              >
                <View style={styles.statCardContent as ViewStyle}>
                  <View style={styles.statIcon as ViewStyle}>
                    <Pill color={theme.colors.accent.success} size={32} />
                  </View>
                  <Text
                    weight="bold"
                    size="large"
                    color={theme.colors.secondary.main}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                    style={
                      [
                        styles.statValue,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {stats.medicationCompliance}%
                  </Text>
                  <Text
                    weight="medium"
                    style={
                      [
                        styles.statLabel,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {isRTL ? "الالتزام بالدواء" : "Med Compliance"}
                  </Text>
                </View>
              </Card>

              <Card 
                variant="elevated" 
                onPress={() => router.push("/(tabs)/family")}
                pressable={true}
                style={styles.statCard as ViewStyle}
                contentStyle={{ padding: 0 }}
              >
                <View style={styles.statCardContent as ViewStyle}>
                  <View style={styles.statIcon as ViewStyle}>
                    <Users color={theme.colors.secondary.main} size={32} />
                  </View>
                  <Text
                    weight="bold"
                    size="large"
                    color={theme.colors.secondary.main}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                    style={
                      [
                        styles.statValue,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {familyMembersCount || 1}
                  </Text>
                  <Text
                    weight="medium"
                    style={
                      [
                        styles.statLabel,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
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
              todaysMedications.slice(0, 3).map((medication) => (
                <TouchableOpacity
                  key={medication.id}
                  onPress={() => router.push("/(tabs)/medications")}
                  style={styles.medicationItem as ViewStyle}
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
                    </Text>
                  </View>
                  <View style={styles.medicationStatus as ViewStyle}>
                    {Array.isArray(medication.reminders) &&
                    medication.reminders.some((r) => r.taken) ? (
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
                              backgroundColor: theme.colors.background.secondary,
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
                </TouchableOpacity>
              ))
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

      case "healthInsights":
        return (
          <View key="healthInsights" style={styles.section as ViewStyle}>
            <HealthInsightsCard />
            <ProactiveHealthSuggestions maxSuggestions={5} />
            <AIInsightsDashboard
              compact={true}
              onInsightPress={(insight) => {
                // Navigate to analytics tab for detailed view
                router.push("/analytics");
              }}
            />
          </View>
        );

      case "alerts":
        if (alertsCount === 0) return null;
        return (
          <View key="alerts">
            <Card
              variant="elevated"
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
              contentStyle={undefined}
            >
              <AlertTriangle color={theme.colors.accent.error} size={24} />
              <View style={styles.alertContent as ViewStyle}>
                <Text
                  weight="bold"
                  color={theme.colors.accent.error}
                  style={
                    [
                      styles.alertTitle,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "تنبيهات طوارئ صحية نشطة" : "Active Emergency Alerts"}
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
          <Text color={theme.colors.accent.error} style={styles.errorText as TextStyle}>
            Please log in to view your dashboard
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container as ViewStyle}>
      <ScrollView
        refreshControl={
          <RefreshControl onRefresh={onRefresh} refreshing={refreshing} />
        }
        showsVerticalScrollIndicator={false}
        style={styles.content as ViewStyle}
        contentContainerStyle={styles.contentInner as ViewStyle}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
      >
        {/* Header with SOS Button */}
        <View style={styles.headerWithSOS as ViewStyle}>
          <View style={[styles.headerContent as ViewStyle, isRTL && { marginEnd: theme.spacing.md }]}>
            <Heading
              level={4}
              color={theme.colors.primary.main}
              style={[
                styles.welcomeText,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>}
            >
              {isRTL
                ? `مرحباً، ${user.firstName || "User"}`
                : `Welcome, ${user.firstName || "User"}`}
            </Heading>
            <Caption
              color={theme.colors.text.secondary}
              style={
                [
                  styles.dateText,
                  isRTL && styles.rtlText,
                  isRTL && styles.dateTextRTL,
                ] as StyleProp<TextStyle>
              }
              numberOfLines={undefined}
            >
              {new Date().toLocaleDateString(isRTL ? "ar-u-ca-gregory" : "en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Caption>
          </View>
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 12, zIndex: 1001, flexShrink: 0 }}>
            {isAdmin && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setShowWidgetSettings(true);
                }}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
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
                isRTL && { marginStart: theme.spacing.md }
              ]}
            >
              <Phone color={theme.colors.neutral.white} size={20} />
              <Text weight="bold" color={theme.colors.neutral.white} style={styles.sosHeaderText as StyleProp<TextStyle>}>
                {isRTL ? "SOS" : "SOS"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Simple Health Insights for Regular Users */}
        {!isAdmin && (
          <View style={styles.healthInsightsSection as ViewStyle}>
            <Text
              style={
                [
                  styles.sectionTitle,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {t("healthInsights")}
            </Text>
            <View style={styles.healthInsightsGrid as ViewStyle}>
              {/* Medication Adherence Insight */}
              {stats.medicationCompliance < 80 && (
                <View style={styles.healthInsightCard as ViewStyle}>
                  <View
                    style={
                      [
                        styles.healthInsightIcon,
                        { backgroundColor: theme.colors.accent.warning + "20" },
                      ] as StyleProp<ViewStyle>
                    }
                  >
                    <Activity color={theme.colors.accent.warning} size={20} />
                  </View>
                  <View style={styles.healthInsightContent as ViewStyle}>
                    <Text
                      style={
                        [
                          styles.healthInsightTitle,
                          isRTL && styles.rtlText,
                        ] as StyleProp<TextStyle>
                      }
                    >
                      {isRTL ? "الالتزام بالدواء" : "Medication Adherence"}
                    </Text>
                    <Text
                      style={
                        [
                          styles.healthInsightMessage,
                          isRTL && styles.rtlText,
                        ] as StyleProp<TextStyle>
                      }
                    >
                      {isRTL
                        ? "حاول تناول أدويتك في الوقت المحدد"
                        : "Try taking your medications on time"}
                    </Text>
                  </View>
                </View>
              )}

              {/* Good Medication Adherence */}
              {stats.medicationCompliance >= 80 && (
                <View style={styles.healthInsightCard as ViewStyle}>
                  <View
                    style={
                      [
                        styles.healthInsightIcon,
                        { backgroundColor: theme.colors.accent.success + "20" },
                      ] as StyleProp<ViewStyle>
                    }
                  >
                    <Check color={theme.colors.accent.success} size={20} />
                  </View>
                  <View style={styles.healthInsightContent as ViewStyle}>
                    <Text
                      style={
                        [
                          styles.healthInsightTitle,
                          isRTL && styles.rtlText,
                        ] as StyleProp<TextStyle>
                      }
                    >
                      {isRTL ? "ممتاز!" : "Excellent!"}
                    </Text>
                    <Text
                      style={
                        [
                          styles.healthInsightMessage,
                          isRTL && styles.rtlText,
                        ] as StyleProp<TextStyle>
                      }
                    >
                      {isRTL
                        ? "الالتزام الجيد بالدواء - استمر!"
                        : "Great medication adherence - keep it up!"}
                    </Text>
                  </View>
                </View>
              )}

              {/* Symptom Tracking Reminder */}
              {recentSymptoms.length === 0 && (
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/symptoms")}
                  style={styles.healthInsightCard as ViewStyle}
                >
                  <View
                    style={
                      [
                        styles.healthInsightIcon,
                        { backgroundColor: theme.colors.primary[50] },
                      ] as StyleProp<ViewStyle>
                    }
                  >
                    <Activity color={theme.colors.primary.main} size={20} />
                  </View>
                  <View style={styles.healthInsightContent as ViewStyle}>
                    <Text
                      style={
                        [
                          styles.healthInsightTitle,
                          isRTL && styles.rtlText,
                        ] as StyleProp<TextStyle>
                      }
                    >
                      {isRTL ? "تتبع الأعراض" : "Track Symptoms"}
                    </Text>
                    <Text
                      style={
                        [
                          styles.healthInsightMessage,
                          isRTL && styles.rtlText,
                        ] as StyleProp<TextStyle>
                      }
                    >
                      {isRTL
                        ? "سجل أعراضك اليومية للحصول على رؤية صحية أفضل"
                        : "Log your daily symptoms for better insights"}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Exercise Suggestion */}
              <TouchableOpacity
                onPress={() => router.push("/ppg-measure")}
                style={styles.healthInsightCard as ViewStyle}
              >
                <View
                  style={
                    [
                      styles.healthInsightIcon,
                      { backgroundColor: theme.colors.secondary[50] },
                    ] as StyleProp<ViewStyle>
                  }
                >
                  <Heart color={theme.colors.secondary.main} size={20} />
                </View>
                <View style={styles.healthInsightContent as ViewStyle}>
                  <Text
                    style={
                      [
                        styles.healthInsightTitle,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {isRTL ? "حركة خفيفة" : "Light Exercise"}
                  </Text>
                  <Text
                    style={
                      [
                        styles.healthInsightMessage,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {isRTL
                      ? "جرب المشي لمدة 10 دقائق اليوم"
                      : "Try a 10-minute walk today"}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
                  {isRTL ? "التنبيهات الطوارئ الصحية الفعالة" : "Active Emergency Alerts"}
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
                    {isRTL ? "لا توجد تنبيهات طوارئ صحية نشطة" : "No active emergency alerts"}
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
                  {isRTL
                    ? "تسجيل الأعراض الصحية"
                    : "Log health symptoms"}
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
                  {isRTL
                    ? "قياس الضغط والنبض"
                    : "Blood pressure & pulse"}
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
          visible={showWidgetSettings}
          onClose={() => setShowWidgetSettings(false)}
          onConfigChange={(config) => {
            // Update the dashboard config immediately with the saved config
            setDashboardConfig(config);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

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
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  type StyleProp,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { alertService } from "@/lib/services/alertService";
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
  const [stats, setStats] = useState({
    symptomsThisWeek: 0,
    avgSeverity: 0,
    medicationCompliance: 0,
  });
  const [familyMembers, setFamilyMembers] = useState<UserType[]>([]);

  const isRTL = i18n.language === "ar";
  const isAdmin = user?.role === "admin";
  const hasFamily = Boolean(user?.familyId);

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
      padding: theme.spacing.base,
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
    statsContainer: {
      flexDirection: "row" as const,
      marginBottom: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.base,
      alignItems: "center" as const,
      ...theme.shadows.md,
    },
    statValue: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.secondary.main),
      marginTop: theme.spacing.sm,
      marginBottom: 4,
    },
    statLabel: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.secondary),
      textAlign: "center" as const,
    },
    alertCard: {
      backgroundColor: theme.colors.accent.error + "10",
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.xl,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.accent.error,
    },
    alertContent: {
      marginLeft: theme.spacing.md,
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
      marginRight: theme.spacing.md,
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
    healthScoreCard: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginTop: theme.spacing.base,
      marginBottom: theme.spacing.xl,
      ...theme.shadows.md,
    },
    healthScoreInfo: {
      marginLeft: theme.spacing.base,
      flex: 1,
    },
    healthScoreTitle: {
      ...getTextStyle(theme, "body", "medium", theme.colors.text.secondary),
      marginBottom: 4,
    },
    healthScoreValue: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.accent.success),
      fontSize: 32,
      lineHeight: 40,
    },
    healthScoreDesc: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
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
      right: theme.spacing.base,
      ...theme.shadows.lg,
      zIndex: 1000,
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
      backgroundColor: theme.colors.secondary[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.secondary.main,
      ...theme.shadows.sm,
    },
    onelineText: {
      ...getTextStyle(
        theme,
        "subheading",
        "semibold",
        theme.colors.primary.main
      ),
      fontStyle: "italic" as const,
      marginBottom: theme.spacing.sm,
      textAlign: "center" as const,
    },
    onelineSource: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.secondary.main),
      textAlign: "center" as const,
    },
    quickActionsGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: theme.spacing.md,
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

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);

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

  if (!user) {
    return (
      <SafeAreaView style={styles.container as ViewStyle}>
        <View style={styles.centerContainer as ViewStyle}>
          <Text style={styles.errorText as StyleProp<TextStyle>}>
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
      >
        {/* Header with SOS Button */}
        <View style={styles.headerWithSOS as ViewStyle}>
          <View style={styles.headerContent as ViewStyle}>
            <Text
              style={
                [
                  styles.welcomeText,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {isRTL
                ? `مرحباً، ${user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || "User"}`
                : `Welcome, ${user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || "User"}`}
            </Text>
            <Text
              style={
                [
                  styles.dateText,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {new Date().toLocaleDateString(isRTL ? "ar-SA" : "en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={handleSOS}
            style={styles.sosHeaderButton as ViewStyle}
          >
            <Phone color={theme.colors.neutral.white} size={20} />
            <Text style={styles.sosHeaderText as StyleProp<TextStyle>}>
              {isRTL ? "SOS" : "SOS"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer as ViewStyle}>
          <View style={styles.statCard as ViewStyle}>
            <Activity color={theme.colors.primary.main} size={24} />
            <Text
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
              style={
                [
                  styles.statLabel,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {isRTL ? "الأعراض هذا الأسبوع" : "Symptoms This Week"}
            </Text>
          </View>

          <View style={styles.statCard as ViewStyle}>
            <Pill color={theme.colors.accent.success} size={24} />
            <Text
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

          <TouchableOpacity
            onPress={() => router.push("/(tabs)/family")}
            style={styles.statCard as ViewStyle}
          >
            <Users color={theme.colors.secondary.main} size={24} />
            <Text
              style={
                [
                  styles.statValue,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {familyMembersCount}
            </Text>
            <Text
              style={
                [
                  styles.statLabel,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {isRTL ? "أفراد العائلة" : "Family Members"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Alerts */}
        {alertsCount > 0 && (
          <TouchableOpacity
            onPress={async () => {
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
          >
            <AlertTriangle color={theme.colors.accent.error} size={24} />
            <View style={styles.alertContent as ViewStyle}>
              <Text
                style={
                  [
                    styles.alertTitle,
                    isRTL && styles.rtlText,
                  ] as StyleProp<TextStyle>
                }
              >
                {isRTL ? "تنبيهات نشطة" : "Active Alerts"}
              </Text>
              <Text
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
          </TouchableOpacity>
        )}

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
                  {isRTL ? "التنبيهات النشطة" : "Active Alerts"}
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
                    {isRTL ? "لا توجد تنبيهات نشطة" : "No active alerts"}
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
                        borderLeftWidth: 4,
                        borderLeftColor: theme.colors.accent.error,
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
                                    ? "تم حل جميع التنبيهات"
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

        {/* Today's Medications */}
        <View style={styles.section as ViewStyle}>
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

        {/* Recent Symptoms */}
        <View style={styles.section as ViewStyle}>
          <View style={styles.sectionHeader as ViewStyle}>
            <Text
              style={
                [
                  styles.sectionTitle,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {isRTL ? "الأعراض الأخيرة" : "Recent Symptoms"}
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
                style={styles.symptomItem as ViewStyle}
              >
                <View style={styles.symptomInfo as ViewStyle}>
                  <Text
                    style={
                      [
                        styles.symptomType,
                        isRTL && styles.rtlText,
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
                  ? "لا توجد أعراض مسجلة - اضغط لإضافة عرض"
                  : "No symptoms recorded - tap to add"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Health Score with Maak One-liner */}
        <View style={styles.healthScoreCard as ViewStyle}>
          <Heart color={theme.colors.accent.error} size={32} />
          <View style={styles.healthScoreInfo as ViewStyle}>
            <Text
              style={
                [
                  styles.healthScoreTitle,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {isRTL ? "نقاط الصحة" : "Health Score"}
            </Text>
            <Text
              style={
                [
                  styles.healthScoreValue,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {Math.max(
                60,
                100 -
                  stats.symptomsThisWeek * 5 -
                  (100 - stats.medicationCompliance)
              )}
            </Text>
            <Text
              style={
                [
                  styles.healthScoreDesc,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {isRTL ? "نقاط من 100" : "out of 100"}
            </Text>
          </View>
        </View>

        {/* Quick Actions Hub */}
        <View style={styles.section as ViewStyle}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

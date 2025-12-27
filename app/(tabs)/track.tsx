import { router, useFocusEffect } from "expo-router";
import {
  Activity,
  ChevronRight,
  Droplet,
  FileText,
  Heart,
  Pill,
  Smile,
  Zap,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
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
import { healthDataService, type VitalSigns } from "@/lib/services/healthDataService";
import { medicalHistoryService } from "@/lib/services/medicalHistoryService";
import { medicationService } from "@/lib/services/medicationService";
import { moodService } from "@/lib/services/moodService";
import { symptomService } from "@/lib/services/symptomService";
import type {
  MedicalHistory,
  Medication,
  Mood,
  Symptom,
  User as UserType,
} from "@/types";
import { createThemedStyles, getTextStyle } from "@/utils/styles";
import BloodPressureEntry from "@/components/BloodPressureEntry";

// Lazy load PPG component to prevent tab from failing if component has issues
// Use the real vision camera version for actual PPG measurements
let PPGVitalMonitor: any = null;
let PPGVitalMonitorLoadError: Error | null = null;

// Try to load the real vision camera version first
try {
  const { Platform } = require("react-native");
  if (Platform.OS !== "web") {
    PPGVitalMonitor = require("@/components/PPGVitalMonitorVisionCamera").default;
    console.log("PPGVitalMonitorVisionCamera (real PPG) component loaded successfully");
  } else {
    // On web, use simulated version
    PPGVitalMonitor = require("@/components/PPGVitalMonitor").default;
    console.log("PPGVitalMonitor (simulated) component loaded for web platform");
  }
} catch (error) {
  PPGVitalMonitorLoadError = error as Error;
  console.error("PPGVitalMonitorVisionCamera component could not be loaded:", error);
  
  // Fallback to simulated version if vision camera fails
  try {
    PPGVitalMonitor = require("@/components/PPGVitalMonitor").default;
    console.log("Fell back to simulated PPGVitalMonitor component");
  } catch (fallbackError) {
    console.error("Fallback PPGVitalMonitor also failed:", fallbackError);
  }
}

export default function TrackScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentSymptoms, setRecentSymptoms] = useState<Symptom[]>([]);
  const [todaysMedications, setTodaysMedications] = useState<Medication[]>([]);
  const [recentMedicalHistory, setRecentMedicalHistory] = useState<
    MedicalHistory[]
  >([]);
  const [recentMoods, setRecentMoods] = useState<Mood[]>([]);
  const [latestVitals, setLatestVitals] = useState<VitalSigns | null>(null);
  const [showPPGMonitor, setShowPPGMonitor] = useState(false);
  const [showBloodPressureEntry, setShowBloodPressureEntry] = useState(false);
  const [stats, setStats] = useState({
    totalSymptoms: 0,
    totalMedications: 0,
    symptomsThisWeek: 0,
    medicationCompliance: 0,
    upcomingMedications: 0,
    totalConditions: 0,
    moodsThisWeek: 0,
    avgMoodIntensity: 0,
  });

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
    headerSubtitle: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      marginTop: 4,
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
    },
    summaryGrid: {
      flexDirection: "row" as const,
      gap: theme.spacing.md,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      alignItems: "center" as const,
      ...theme.shadows.md,
    },
    summaryIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.md,
    },
    summaryValue: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.text.primary),
      fontSize: 24,
      marginBottom: 4,
    },
    summaryLabel: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.secondary),
      textAlign: "center" as const,
    },
    trackingSection: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      ...theme.shadows.md,
    },
    sectionHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.lg,
    },
    sectionTitle: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.primary.main),
    },
    trackingOptions: {
      flexDirection: "row" as const,
      gap: theme.spacing.md,
    },
    trackingCard: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      borderWidth: 2,
      borderColor: theme.colors.border.light,
      alignItems: "center" as const,
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
    recentSection: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.lg,
      ...theme.shadows.md,
    },
    recentItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    recentIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginRight: theme.spacing.md,
    },
    recentInfo: {
      flex: 1,
    },
    recentTitle: {
      ...getTextStyle(theme, "body", "semibold", theme.colors.text.primary),
      marginBottom: 2,
    },
    recentSubtitle: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
    },
    viewAllButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
    },
    viewAllText: {
      ...getTextStyle(theme, "body", "medium", theme.colors.primary.main),
    },
    onelineCard: {
      backgroundColor: theme.colors.secondary[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.secondary.main,
      alignItems: "center" as const,
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
      textAlign: "center" as const,
      marginBottom: theme.spacing.sm,
    },
    onelineSource: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.secondary.main),
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingTop: 100,
    },
    loadingText: {
      ...getTextStyle(theme, "body", "medium", theme.colors.text.secondary),
      marginTop: theme.spacing.base,
    },
    rtlText: {
      textAlign: "right" as const,
    },
  }))(theme);

  const loadTrackingData = async (isRefresh = false) => {
    if (!user) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Load recent data for overview
      const [symptoms, medications, medicalHistory, moods, moodStats, vitals] =
        await Promise.all([
          symptomService.getUserSymptoms(user.id, 3),
          medicationService.getTodaysMedications(user.id),
          medicalHistoryService.getUserMedicalHistory(user.id),
          moodService.getUserMoods(user.id, 3),
          moodService.getMoodStats(user.id, 7),
          healthDataService.getLatestVitals(),
        ]);

      setRecentSymptoms(symptoms);
      setTodaysMedications(medications);
      setRecentMedicalHistory(medicalHistory.slice(0, 3)); // Get 3 most recent
      setRecentMoods(moods);
      setLatestVitals(vitals);

      // Calculate stats (optimized single pass)
      const totalSymptoms = symptoms.length;
      const totalMedications = medications.length;
      
      // Optimize date calculation for symptomsThisWeek
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const symptomsThisWeek = symptoms.filter(
        (s) => new Date(s.timestamp).getTime() > sevenDaysAgo
      ).length;

      // Single pass for medication reminders calculation
      let totalReminders = 0;
      let takenReminders = 0;
      medications.forEach((med) => {
        const reminders = Array.isArray(med.reminders) ? med.reminders : [];
        totalReminders += reminders.length;
        takenReminders += reminders.filter((r) => r.taken).length;
      });

      const compliance =
        totalReminders > 0 ? (takenReminders / totalReminders) * 100 : 100;
      const upcomingMedications = totalReminders - takenReminders;

      const totalConditions = medicalHistory.filter((h) => !h.isFamily).length;

      setStats({
        totalSymptoms,
        totalMedications,
        symptomsThisWeek,
        medicationCompliance: Math.round(compliance),
        upcomingMedications,
        totalConditions,
        moodsThisWeek: moodStats.totalMoods,
        avgMoodIntensity: moodStats.avgIntensity,
      });
    } catch (error) {
      // Silently handle error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTrackingData();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadTrackingData();
    }, [user])
  );

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const getMoodEmoji = (moodType: string) => {
    const moodMap: { [key: string]: string } = {
      veryHappy: "😄",
      happy: "😊",
      neutral: "😐",
      sad: "😔",
      verySad: "😢",
    };
    return moodMap[moodType] || "😐";
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container as ViewStyle}>
        <View style={styles.loadingContainer as ViewStyle}>
          <Text style={styles.loadingText as StyleProp<TextStyle>}>
            Please log in to track your health
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container as ViewStyle}>
      {/* Header */}
      <View style={styles.header as ViewStyle}>
        <Text
          style={
            [
              styles.headerTitle,
              isRTL && styles.rtlText,
            ] as StyleProp<TextStyle>
          }
        >
          {isRTL ? "تتبع الصحة" : "Health Tracking"}
        </Text>
        <Text
          style={
            [
              styles.headerSubtitle,
              isRTL && styles.rtlText,
            ] as StyleProp<TextStyle>
          }
        >
          {isRTL
            ? "راقب أعراضك وأدويتك"
            : "Monitor your symptoms and medications"}
        </Text>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            onRefresh={() => loadTrackingData(true)}
            refreshing={refreshing}
            tintColor={theme.colors.primary.main}
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.content as ViewStyle}
      >
        {/* Summary Stats */}
        {loading ? (
          <View style={styles.loadingContainer as ViewStyle}>
            <ActivityIndicator color={theme.colors.primary.main} size="large" />
            <Text
              style={
                [
                  styles.loadingText,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {isRTL ? "جاري التحميل..." : "Loading..."}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryGrid as ViewStyle}>
              <View style={styles.summaryCard as ViewStyle}>
                <View
                  style={
                    [
                      styles.summaryIcon,
                      { backgroundColor: theme.colors.primary[50] },
                    ] as StyleProp<ViewStyle>
                  }
                >
                  <Activity color={theme.colors.primary.main} size={24} />
                </View>
                <Text
                  style={
                    [
                      styles.summaryValue,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {stats.symptomsThisWeek}
                </Text>
                <Text
                  style={
                    [
                      styles.summaryLabel,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "أعراض هذا الأسبوع" : "Symptoms This Week"}
                </Text>
              </View>

              <View style={styles.summaryCard as ViewStyle}>
                <View
                  style={
                    [
                      styles.summaryIcon,
                      { backgroundColor: theme.colors.accent.success + "20" },
                    ] as StyleProp<ViewStyle>
                  }
                >
                  <Pill color={theme.colors.accent.success} size={24} />
                </View>
                <Text
                  style={
                    [
                      styles.summaryValue,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {stats.medicationCompliance}%
                </Text>
                <Text
                  style={
                    [
                      styles.summaryLabel,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>
                  }
                >
                  {isRTL ? "الالتزام بالدواء" : "Med Compliance"}
                </Text>
              </View>
            </View>

            {/* Tracking Options */}
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
                  {isRTL ? "خيارات التتبع" : "Tracking Options"}
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
                    {isRTL ? "الأعراض" : "Symptoms"}
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
                      ? "تسجيل ومراقبة الأعراض"
                      : "Log and monitor symptoms"}
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
                      {isRTL ? "تتبع" : "Track"}
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
                      : "Manage meds and reminders"}
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
              </View>

              {/* Mood Tracking */}
              <View
                style={
                  [
                    styles.trackingOptions,
                    { marginTop: theme.spacing.md },
                  ] as StyleProp<ViewStyle>
                }
              >
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
                    {isRTL ? "المزاج" : "Mood"}
                  </Text>
                  <Text
                    style={
                      [
                        styles.trackingCardSubtitle,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {isRTL ? "تسجيل ومراقبة المزاج" : "Track your mood"}
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
                      {isRTL ? "تتبع" : "Track"}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>

              {/* Medical History and Vitals - Side by Side */}
              <View
                style={
                  [
                    styles.trackingOptions,
                    { marginTop: theme.spacing.md },
                  ] as StyleProp<ViewStyle>
                }
              >
                <TouchableOpacity
                  onPress={() => router.push("/profile/medical-history")}
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
                    <FileText color={theme.colors.accent.info} size={28} />
                  </View>
                  <Text
                    style={
                      [
                        styles.trackingCardTitle,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {isRTL ? "التاريخ الطبي" : "Medical History"}
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
                      ? "تسجيل وإدارة الحالات الطبية"
                      : "Record and manage medical conditions"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/profile/medical-history")}
                    style={
                      [
                        styles.trackingCardButton,
                        { backgroundColor: theme.colors.accent.info },
                      ] as StyleProp<ViewStyle>
                    }
                  >
                    <FileText color={theme.colors.neutral.white} size={16} />
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
                  onPress={() => router.push("/(tabs)/vitals")}
                  style={styles.trackingCard as ViewStyle}
                >
                  <View
                    style={
                      [
                        styles.trackingCardIcon,
                        { backgroundColor: theme.colors.secondary.main + "20" },
                      ] as StyleProp<ViewStyle>
                    }
                  >
                    <Zap color={theme.colors.secondary.main} size={28} />
                  </View>
                  <Text
                    style={
                      [
                        styles.trackingCardTitle,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {isRTL ? "المؤشرات الحيوية" : "Vital Signs"}
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
                      ? "مراقبة النبض، الخطوات، النوم"
                      : "Monitor heart rate, steps, sleep"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/(tabs)/vitals")}
                    style={
                      [
                        styles.trackingCardButton,
                        { backgroundColor: theme.colors.secondary.main },
                      ] as StyleProp<ViewStyle>
                    }
                  >
                    <Heart color={theme.colors.neutral.white} size={16} />
                    <Text
                      style={
                        styles.trackingCardButtonText as StyleProp<TextStyle>
                      }
                    >
                      {isRTL ? "عرض" : "View"}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>

              {/* PPG Heart Rate Monitor and Blood Pressure Entry */}
              <View
                style={
                  [
                    styles.trackingOptions,
                    { marginTop: theme.spacing.md },
                  ] as StyleProp<ViewStyle>
                }
              >
                <View
                  style={styles.trackingCard as ViewStyle}
                >
                  <View
                    style={
                      [
                        styles.trackingCardIcon,
                        { backgroundColor: theme.colors.accent.error + "20" },
                      ] as StyleProp<ViewStyle>
                    }
                  >
                    <Heart color={theme.colors.accent.error} size={28} />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" }}>
                    <Text
                      style={
                        [
                          styles.trackingCardTitle,
                          isRTL && styles.rtlText,
                        ] as StyleProp<TextStyle>
                      }
                    >
                      {isRTL ? "مراقب العلامات الحيوية" : "Vital Signs Monitor"}
                    </Text>
                    <View style={{
                      backgroundColor: theme.colors.secondary.main,
                      paddingHorizontal: theme.spacing.sm,
                      paddingVertical: 2,
                      borderRadius: theme.borderRadius.md,
                    }}>
                      <Text style={{
                        ...getTextStyle(theme, "caption", "bold", theme.colors.neutral.white),
                        fontSize: 10,
                        letterSpacing: 0.5,
                      }}>
                        BETA
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={
                      [
                        styles.trackingCardSubtitle,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {isRTL
                      ? "قياس معدل ضربات القلب وHRV ومعدل التنفس باستخدام الكاميرا"
                      : "Measure heart rate, HRV & respiratory rate using camera"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      console.log("Measure button pressed");
                      setShowPPGMonitor(true);
                    }}
                    style={
                      [
                        styles.trackingCardButton,
                        { backgroundColor: theme.colors.accent.error },
                      ] as StyleProp<ViewStyle>
                    }
                    activeOpacity={0.7}
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
                </View>

                <TouchableOpacity
                  onPress={() => setShowBloodPressureEntry(true)}
                  style={styles.trackingCard as ViewStyle}
                >
                  <View
                    style={
                      [
                        styles.trackingCardIcon,
                        { backgroundColor: theme.colors.accent.error + "20" },
                      ] as StyleProp<ViewStyle>
                    }
                  >
                    <Droplet color={theme.colors.accent.error} size={28} />
                  </View>
                  <Text
                    style={
                      [
                        styles.trackingCardTitle,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                      }
                    >
                    {isRTL ? "ضغط الدم" : "Blood Pressure"}
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
                      ? "تسجيل ضغط الدم يدوياً وتصديره إلى HealthKit"
                      : "Manual entry & export to HealthKit"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowBloodPressureEntry(true)}
                    style={
                      [
                        styles.trackingCardButton,
                        { backgroundColor: theme.colors.accent.error },
                      ] as StyleProp<ViewStyle>
                    }
                  >
                    <Droplet color={theme.colors.neutral.white} size={16} />
                    <Text
                      style={
                        styles.trackingCardButtonText as StyleProp<TextStyle>
                      }
                    >
                      {isRTL ? "إدخال" : "Enter"}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            </View>

            {/* Recent Activity - Symptoms */}
            {recentSymptoms.length > 0 && (
              <View style={styles.recentSection as ViewStyle}>
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

                {recentSymptoms.slice(0, 3).map((symptom) => (
                  <TouchableOpacity
                    key={symptom.id}
                    onPress={() => router.push("/(tabs)/symptoms")}
                    style={styles.recentItem as ViewStyle}
                  >
                    <View
                      style={
                        [
                          styles.recentIcon,
                          { backgroundColor: theme.colors.primary[50] },
                        ] as StyleProp<ViewStyle>
                      }
                    >
                      <Activity color={theme.colors.primary.main} size={20} />
                    </View>
                    <View style={styles.recentInfo as ViewStyle}>
                      <Text
                        style={
                          [
                            styles.recentTitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {t(symptom.type)}
                      </Text>
                      <Text
                        style={
                          [
                            styles.recentSubtitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {formatTime(symptom.timestamp)} •{" "}
                        {isRTL ? "شدة" : "Severity"} {symptom.severity}/5
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Recent Activity - Moods */}
            {recentMoods.length > 0 && (
              <View style={styles.recentSection as ViewStyle}>
                <View style={styles.sectionHeader as ViewStyle}>
                  <Text
                    style={
                      [
                        styles.sectionTitle,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {isRTL ? "المزاجات الأخيرة" : "Recent Moods"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/(tabs)/moods")}
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

                {recentMoods.slice(0, 3).map((mood) => (
                  <TouchableOpacity
                    key={mood.id}
                    onPress={() => router.push("/(tabs)/moods")}
                    style={styles.recentItem as ViewStyle}
                  >
                    <View
                      style={
                        [
                          styles.recentIcon,
                          {
                            backgroundColor: theme.colors.accent.warning + "20",
                          },
                        ] as StyleProp<ViewStyle>
                      }
                    >
                      <Text style={{ fontSize: 20 }}>
                        {getMoodEmoji(mood.mood)}
                      </Text>
                    </View>
                    <View style={styles.recentInfo as ViewStyle}>
                      <Text
                        style={
                          [
                            styles.recentTitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {t(mood.mood)}
                      </Text>
                      <Text
                        style={
                          [
                            styles.recentSubtitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {formatTime(mood.timestamp)} •{" "}
                        {isRTL ? "شدة" : "Intensity"} {mood.intensity}/5
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Recent Activity - Medications */}
            {todaysMedications.length > 0 && (
              <View style={styles.recentSection as ViewStyle}>
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

                {todaysMedications.slice(0, 3).map((medication) => (
                  <TouchableOpacity
                    key={medication.id}
                    onPress={() => router.push("/(tabs)/medications")}
                    style={styles.recentItem as ViewStyle}
                  >
                    <View
                      style={
                        [
                          styles.recentIcon,
                          {
                            backgroundColor: theme.colors.accent.success + "20",
                          },
                        ] as StyleProp<ViewStyle>
                      }
                    >
                      <Pill color={theme.colors.accent.success} size={20} />
                    </View>
                    <View style={styles.recentInfo as ViewStyle}>
                      <Text
                        style={
                          [
                            styles.recentTitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {medication.name}
                      </Text>
                      <Text
                        style={
                          [
                            styles.recentSubtitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {medication.dosage} • {medication.frequency}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Recent Activity - Medical History */}
            {recentMedicalHistory.length > 0 && (
              <View style={styles.recentSection as ViewStyle}>
                <View style={styles.sectionHeader as ViewStyle}>
                  <Text
                    style={
                      [
                        styles.sectionTitle,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {isRTL ? "التاريخ الطبي الأخير" : "Recent Medical History"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/profile/medical-history")}
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

                {recentMedicalHistory.slice(0, 3).map((history) => (
                  <TouchableOpacity
                    key={history.id}
                    onPress={() => router.push("/profile/medical-history")}
                    style={styles.recentItem as ViewStyle}
                  >
                    <View
                      style={
                        [
                          styles.recentIcon,
                          { backgroundColor: theme.colors.accent.info + "20" },
                        ] as StyleProp<ViewStyle>
                      }
                    >
                      <FileText color={theme.colors.accent.info} size={20} />
                    </View>
                    <View style={styles.recentInfo as ViewStyle}>
                      <Text
                        style={
                          [
                            styles.recentTitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {history.condition}
                      </Text>
                      <Text
                        style={
                          [
                            styles.recentSubtitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {history.diagnosedDate
                          ? new Date(history.diagnosedDate).toLocaleDateString()
                          : isRTL
                            ? "بدون تاريخ"
                            : "No date"}{" "}
                        •{" "}
                        {history.severity
                          ? history.severity.charAt(0).toUpperCase() +
                            history.severity.slice(1)
                          : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Recent Activity - Vitals */}
            {latestVitals && (
              <View style={styles.recentSection as ViewStyle}>
                <View style={styles.sectionHeader as ViewStyle}>
                  <Text
                    style={
                      [
                        styles.sectionTitle,
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {isRTL ? "المؤشرات الحيوية الأخيرة" : "Latest Vital Signs"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/(tabs)/vitals")}
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

                {/* Heart Rate */}
                {latestVitals.heartRate !== undefined && (
                  <TouchableOpacity
                    onPress={() => router.push("/(tabs)/vitals")}
                    style={styles.recentItem as ViewStyle}
                  >
                    <View
                      style={
                        [
                          styles.recentIcon,
                          { backgroundColor: theme.colors.accent.error + "20" },
                        ] as StyleProp<ViewStyle>
                      }
                    >
                      <Heart color={theme.colors.accent.error} size={20} />
                    </View>
                    <View style={styles.recentInfo as ViewStyle}>
                      <Text
                        style={
                          [
                            styles.recentTitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {isRTL ? "معدل ضربات القلب" : "Heart Rate"}
                      </Text>
                      <Text
                        style={
                          [
                            styles.recentSubtitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {Math.round(latestVitals.heartRate)} BPM
                        {latestVitals.timestamp
                          ? ` • ${formatTime(latestVitals.timestamp)}`
                          : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Steps */}
                {latestVitals.steps !== undefined && (
                  <TouchableOpacity
                    onPress={() => router.push("/(tabs)/vitals")}
                    style={styles.recentItem as ViewStyle}
                  >
                    <View
                      style={
                        [
                          styles.recentIcon,
                          { backgroundColor: theme.colors.primary[50] },
                        ] as StyleProp<ViewStyle>
                      }
                    >
                      <Activity color={theme.colors.primary.main} size={20} />
                    </View>
                    <View style={styles.recentInfo as ViewStyle}>
                      <Text
                        style={
                          [
                            styles.recentTitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {isRTL ? "الخطوات" : "Steps"}
                      </Text>
                      <Text
                        style={
                          [
                            styles.recentSubtitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {latestVitals.steps.toLocaleString()} {isRTL ? "خطوة" : "steps"}
                        {latestVitals.timestamp
                          ? ` • ${formatTime(latestVitals.timestamp)}`
                          : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Sleep */}
                {latestVitals.sleepHours !== undefined && (
                  <TouchableOpacity
                    onPress={() => router.push("/(tabs)/vitals")}
                    style={styles.recentItem as ViewStyle}
                  >
                    <View
                      style={
                        [
                          styles.recentIcon,
                          { backgroundColor: theme.colors.accent.info + "20" },
                        ] as StyleProp<ViewStyle>
                      }
                    >
                      <Zap color={theme.colors.accent.info} size={20} />
                    </View>
                    <View style={styles.recentInfo as ViewStyle}>
                      <Text
                        style={
                          [
                            styles.recentTitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {isRTL ? "النوم" : "Sleep"}
                      </Text>
                      <Text
                        style={
                          [
                            styles.recentSubtitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {latestVitals.sleepHours.toFixed(1)} {isRTL ? "ساعة" : "hours"}
                        {latestVitals.timestamp
                          ? ` • ${formatTime(latestVitals.timestamp)}`
                          : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Blood Pressure */}
                {latestVitals.bloodPressure && (
                  <TouchableOpacity
                    onPress={() => router.push("/(tabs)/vitals")}
                    style={styles.recentItem as ViewStyle}
                  >
                    <View
                      style={
                        [
                          styles.recentIcon,
                          { backgroundColor: theme.colors.accent.warning + "20" },
                        ] as StyleProp<ViewStyle>
                      }
                    >
                      <Heart color={theme.colors.accent.warning} size={20} />
                    </View>
                    <View style={styles.recentInfo as ViewStyle}>
                      <Text
                        style={
                          [
                            styles.recentTitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {isRTL ? "ضغط الدم" : "Blood Pressure"}
                      </Text>
                      <Text
                        style={
                          [
                            styles.recentSubtitle,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {latestVitals.bloodPressure.systolic}/
                        {latestVitals.bloodPressure.diastolic} mmHg
                        {latestVitals.timestamp
                          ? ` • ${formatTime(latestVitals.timestamp)}`
                          : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
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
                {isRTL ? '"الصحة، تتجاوز الحدود"' : '"Health, beyond borders"'}
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* PPG Heart Rate Monitor Modal */}
      {user && PPGVitalMonitor && (
        <PPGVitalMonitor
          visible={showPPGMonitor}
          userId={user.id}
          onMeasurementComplete={(result) => {
            // Optionally refresh vitals data or show success message
            loadTrackingData();
          }}
          onClose={() => setShowPPGMonitor(false)}
        />
      )}

      {/* Blood Pressure Entry Modal */}
      <BloodPressureEntry
        visible={showBloodPressureEntry}
        onClose={() => setShowBloodPressureEntry(false)}
        onSave={() => {
          loadTrackingData();
        }}
      />
      
      {/* Show error modal if component failed to load */}
      {user && !PPGVitalMonitor && showPPGMonitor && (
        <Modal
          visible={showPPGMonitor}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowPPGMonitor(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.primary, padding: theme.spacing.xl }}>
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ ...getTextStyle(theme, "heading", "bold", theme.colors.text.primary), marginBottom: theme.spacing.md, textAlign: "center" }}>
                Component Not Available
              </Text>
              <Text style={{ ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary), textAlign: "center", marginBottom: theme.spacing.lg }}>
                {PPGVitalMonitorLoadError 
                  ? "The vital signs monitor component could not be loaded due to a compatibility issue. Please try restarting the app or updating to the latest version."
                  : "The vital signs monitor is not available on this platform."}
              </Text>
              {PPGVitalMonitorLoadError && (
                <Text style={{ ...getTextStyle(theme, "caption", "regular", theme.colors.text.tertiary), textAlign: "center", marginBottom: theme.spacing.lg, fontFamily: "monospace" }}>
                  {PPGVitalMonitorLoadError.message}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => setShowPPGMonitor(false)}
                style={{
                  backgroundColor: theme.colors.primary.main,
                  paddingHorizontal: theme.spacing.xl,
                  paddingVertical: theme.spacing.base,
                  borderRadius: theme.borderRadius.lg,
                  marginTop: theme.spacing.lg,
                }}
              >
                <Text style={{ ...getTextStyle(theme, "button", "bold", theme.colors.neutral.white) }}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: legacy dashboard screen with many sections. */
/* biome-ignore-all lint/style/noNestedTernary: UI copy branches will be refactored incrementally. */
/* biome-ignore-all lint/complexity/noForEach: existing array processing kept for readability in this batch. */
/* biome-ignore-all lint/nursery/noShadow: themed style callback uses established naming across the app. */
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Activity,
  AlertCircle,
  Brain,
  Clock,
  Droplet,
  FileText,
  Heart,
  Info,
  Pill,
  Plus,
  Stethoscope,
  TrendingUp,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  InteractionManager,
  RefreshControl,
  ScrollView,
  type StyleProp,
  Text,
  type TextStyle,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import CoachMark from "@/app/components/CoachMark";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { allergyService } from "@/lib/services/allergyService";
import { medicalHistoryService } from "@/lib/services/medicalHistoryService";
import { medicationService } from "@/lib/services/medicationService";
import { moodService } from "@/lib/services/moodService";
import { symptomService } from "@/lib/services/symptomService";
import type { Allergy, MedicalHistory, Mood, Symptom } from "@/types";
import { safeFormatTime } from "@/utils/dateFormat";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

const TRACK_DATA_STALE_MS = 45_000;
const TRACK_QUERY_TIMEOUT_MS = 7000;

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("track_query_timeout"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

export default function TrackScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ tour?: string }>();
  const { width, height } = useWindowDimensions();
  const isIphone16Pro =
    Math.round(Math.min(width, height)) === 393 &&
    Math.round(Math.max(width, height)) === 852;
  const contentPadding = isIphone16Pro ? 24 : theme.spacing.lg;
  const headerPadding = isIphone16Pro ? 28 : theme.spacing.xl;

  // All hooks must be called before any conditional returns
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentSymptoms, setRecentSymptoms] = useState<Symptom[]>([]);
  const [recentMedicalHistory, setRecentMedicalHistory] = useState<
    MedicalHistory[]
  >([]);
  const [recentMoods, setRecentMoods] = useState<Mood[]>([]);
  const [recentAllergies, setRecentAllergies] = useState<Allergy[]>([]);
  // PPG monitor now accessed via /ppg-measure route instead of modal
  const [showHowTo, setShowHowTo] = useState(false);
  const bloodPressureCardRef = useRef<View>(null);
  const hasLoadedOnceRef = useRef(false);
  const trackingLoadInFlightRef = useRef(false);
  const lastTrackingLoadAtRef = useRef<number | null>(null);
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
  const showBlockingLoading = loading && !hasLoadedOnceRef.current;

  // Memoize navigation handlers to prevent recreation on every render
  // All pass returnTo=track so back button returns to track tab
  const navigateToSymptoms = useCallback(() => {
    router.push("/(tabs)/symptoms?returnTo=track");
  }, []);

  const navigateToMedications = useCallback(() => {
    router.push("/(tabs)/medications?returnTo=track");
  }, []);

  const navigateToMoods = useCallback(() => {
    router.push("/(tabs)/moods?returnTo=track");
  }, []);

  const navigateToAllergies = useCallback(() => {
    router.push("/(tabs)/allergies?returnTo=track");
  }, []);

  const navigateToVitals = useCallback(() => {
    router.push("/(tabs)/vitals?returnTo=track");
  }, []);

  const navigateToMedicalHistory = useCallback(() => {
    router.push("/profile/medical-history?returnTo=track");
  }, []);

  const navigateToTimeline = useCallback(() => {
    router.push("/(tabs)/timeline?returnTo=track");
  }, []);

  const navigateToLabResults = useCallback(() => {
    router.push("/(tabs)/lab-results?returnTo=track");
  }, []);

  const navigateToPPGMeasure = useCallback(() => {
    router.push("/ppg-measure?returnTo=track");
  }, []);

  const handleBloodPressurePress = useCallback(() => {
    router.push("/(tabs)/blood-pressure?returnTo=track");
  }, [router]);

  const trackingCategories = [
    {
      icon: Activity,
      label: isRTL ? "???????" : "Tracked Symptoms",
      color: "#EF4444",
      description: isRTL ? "????? ??????? ??????" : "Log symptoms and severity",
      onPress: navigateToSymptoms,
    },
    {
      icon: Pill,
      label: isRTL ? "???????" : "Medications",
      color: "#10B981",
      description: isRTL ? "???? ????? ???????" : "Track medication intake",
      onPress: navigateToMedications,
    },
    {
      icon: Brain,
      label: isRTL ? "??????" : "Mood",
      color: "#8B5CF6",
      description: isRTL ? "????? ?????? ????????" : "Record emotional state",
      onPress: navigateToMoods,
    },
    {
      icon: AlertCircle,
      label: isRTL ? "????????" : "Allergies",
      color: "#F97316",
      description: isRTL ? "????? ??????? ????????" : "Manage allergy info",
      onPress: navigateToAllergies,
    },
    {
      icon: Heart,
      label: isRTL ? "??? ????" : "Blood Pressure",
      color: "#DC2626",
      description: isRTL ? "????? ?????? ?????" : "Monitor BP readings",
      onPress: handleBloodPressurePress,
    },
    {
      icon: Stethoscope,
      label: isRTL ? "???????? ???????" : "Vital Signs",
      color: "#3B82F6",
      description: isRTL
        ? "????? ???????? ???????"
        : "Record vital measurements",
      onPress: navigateToVitals,
    },
    {
      icon: FileText,
      label: isRTL ? "????? ?????" : "Medical History",
      color: "#6366F1",
      description: isRTL ? "????? ????? ?????" : "Document medical records",
      onPress: navigateToMedicalHistory,
    },
    {
      icon: TrendingUp,
      label: isRTL ? "?????? ????????" : "Vitals Monitor",
      color: "#14B8A6",
      description: isRTL ? "???? ???? ????????" : "Real-time vital tracking",
      onPress: navigateToPPGMeasure,
    },
    {
      icon: Clock,
      label: isRTL ? "???? ??????" : "Health Timeline",
      color: "#EC4899",
      description: isRTL ? "??? ?????? ??????" : "View health journey",
      onPress: navigateToTimeline,
    },
    {
      icon: Droplet,
      label: isRTL ? "????? ???????" : "Lab Results",
      color: "#0EA5E9",
      description: isRTL ? "????? ????? ????????" : "Store test results",
      onPress: navigateToLabResults,
    },
  ];

  const formatRelativeTime = (date: Date) => {
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) {
      return isRTL ? "????" : "Just now";
    }
    if (minutes < 60) {
      return isRTL ? `??? ${minutes} ?????` : `${minutes} min ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return isRTL ? `??? ${hours} ????` : `${hours} hours ago`;
    }
    const days = Math.floor(hours / 24);
    return isRTL ? `??? ${days} ???` : `${days} days ago`;
  };

  const entriesToday = () => {
    const today = new Date();
    const isSameDay = (value: Date) =>
      value.getFullYear() === today.getFullYear() &&
      value.getMonth() === today.getMonth() &&
      value.getDate() === today.getDate();

    let count = 0;
    recentSymptoms.forEach((item) => {
      if (isSameDay(new Date(item.timestamp))) {
        count += 1;
      }
    });
    recentMoods.forEach((item) => {
      if (isSameDay(new Date(item.timestamp))) {
        count += 1;
      }
    });
    recentAllergies.forEach((item) => {
      if (isSameDay(new Date(item.timestamp))) {
        count += 1;
      }
    });
    return count;
  };

  const recentActivityItems = () => {
    const items = [] as {
      id: string;
      title: string;
      detail: string;
      color: string;
      icon: any;
    }[];

    recentSymptoms.slice(0, 2).forEach((symptom) => {
      items.push({
        id: `symptom-${symptom.id}`,
        title: isRTL ? "?? ????? ???" : "Symptom logged",
        detail: `${formatRelativeTime(new Date(symptom.timestamp))}`,
        color: "#EF4444",
        icon: Activity,
      });
    });

    recentMoods.slice(0, 1).forEach((mood) => {
      items.push({
        id: `mood-${mood.id}`,
        title: isRTL ? "?? ????? ??????" : "Mood updated",
        detail: `${formatRelativeTime(new Date(mood.timestamp))}`,
        color: "#8B5CF6",
        icon: Brain,
      });
    });

    recentMedicalHistory.slice(0, 1).forEach((history) => {
      items.push({
        id: `history-${history.id}`,
        title: isRTL ? "??? ????? ??? ???" : "Medical history updated",
        detail: `${formatRelativeTime(new Date(history.diagnosedDate || new Date()))}`,
        color: "#6366F1",
        icon: FileText,
      });
    });

    recentAllergies.slice(0, 1).forEach((allergy) => {
      items.push({
        id: `allergy-${allergy.id}`,
        title: isRTL ? "?? ????? ??????" : "Allergy updated",
        detail: `${formatRelativeTime(new Date(allergy.timestamp))}`,
        color: "#F97316",
        icon: AlertCircle,
      });
    });

    return items.slice(0, 4);
  };

  useEffect(() => {
    if (params.tour === "1") {
      setShowHowTo(true);
    }
  }, [params.tour]);

  // Memoize styles to prevent recreation on every render
  const styles = useMemo(
    () =>
      createThemedStyles((theme) => ({
        container: {
          flex: 1,
          backgroundColor: "transparent",
        },
        headerWrapper: {
          marginHorizontal: -contentPadding,
          marginTop: -theme.spacing.sm,
          marginBottom: theme.spacing.md,
        },
        headerContent: {
          paddingHorizontal: headerPadding,
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.lg,
          minHeight: 200,
        },
        headerRow: {
          flexDirection: "row" as const,
          justifyContent: "space-between" as const,
          alignItems: "center" as const,
          gap: theme.spacing.sm,
        },
        headerTitle: {
          fontSize: 22,
          fontFamily: "Inter-Bold",
          color: "#FFFFFF",
        },
        headerSubtitle: {
          fontSize: 13,
          fontFamily: "Inter-SemiBold",
          color: "rgba(255, 255, 255, 0.85)",
          marginTop: 4,
        },
        helpButton: {
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: "center" as const,
          justifyContent: "center" as const,
          backgroundColor: "rgba(255, 255, 255, 0.5)",
        },
        content: {
          flex: 1,
        },
        contentInner: {
          paddingHorizontal: 20,
          paddingBottom: 140,
        },
        statsGrid: {
          flexDirection: "row" as const,
          gap: 12,
          marginBottom: 20,
        },
        statCard: {
          flex: 1,
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          paddingVertical: 16,
          paddingHorizontal: 12,
          alignItems: "center" as const,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 4,
        },
        statValue: {
          fontSize: 20,
          fontFamily: "Inter-Bold",
          color: "#0F766E",
          marginBottom: 4,
        },
        statLabel: {
          fontSize: 11,
          fontFamily: "Inter-SemiBold",
          color: "#64748B",
          textAlign: "center" as const,
        },
        section: {
          marginBottom: 20,
        },
        sectionHeaderRow: {
          flexDirection: "row" as const,
          justifyContent: "space-between" as const,
          alignItems: "center" as const,
          marginBottom: 12,
        },
        sectionTitle: {
          fontSize: 16,
          fontFamily: "Inter-Bold",
          color: "#0F172A",
        },
        viewAllButton: {
          flexDirection: "row" as const,
          alignItems: "center" as const,
        },
        viewAllText: {
          fontSize: 12,
          fontFamily: "Inter-SemiBold",
          color: "#0F766E",
        },
        categoriesGrid: {
          flexDirection: "row" as const,
          flexWrap: "wrap" as const,
          gap: 12,
        },
        categoryCard: {
          width: "48%",
          backgroundColor: "#FFFFFF",
          borderRadius: 18,
          padding: 16,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 4,
        },
        categoryCardInner: {
          flexDirection: "row" as const,
          gap: theme.spacing.sm,
          alignItems: "flex-start" as const,
        },
        categoryIconWrap: {
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: "center" as const,
          justifyContent: "center" as const,
          flexShrink: 0,
        },
        categoryText: {
          flex: 1,
        },
        categoryTitle: {
          fontSize: 13,
          fontFamily: "Inter-Bold",
          color: "#0F172A",
          marginBottom: 4,
        },
        categoryDescription: {
          fontSize: 11,
          fontFamily: "Inter-SemiBold",
          color: "#64748B",
        },
        activityList: {
          gap: 12,
        },
        activityCard: {
          backgroundColor: "#FFFFFF",
          borderRadius: 18,
          padding: 16,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 4,
        },
        activityRow: {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: theme.spacing.sm,
        },
        activityIcon: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center" as const,
          justifyContent: "center" as const,
        },
        activityText: {
          flex: 1,
        },
        activityTitle: {
          fontSize: 14,
          fontFamily: "Inter-Bold",
          color: "#0F172A",
          marginBottom: 2,
        },
        activityDetail: {
          fontSize: 11,
          fontFamily: "Inter-SemiBold",
          color: "#64748B",
        },
        fab: {
          position: "absolute" as const,
          right: theme.spacing.lg,
          bottom: 110,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "#EB9C0C",
          alignItems: "center" as const,
          justifyContent: "center" as const,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 14,
          elevation: 6,
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
          ...getTextStyle(
            theme,
            "caption",
            "medium",
            theme.colors.text.secondary
          ),
          textAlign: "center" as const,
        },
        trackingSection: {
          backgroundColor: "#FFFFFF",
          borderRadius: 18,
          padding: 16,
          marginBottom: 20,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 4,
        },
        sectionHeader: {
          flexDirection: isRTL ? "row-reverse" : "row",
          justifyContent: "space-between" as const,
          alignItems: "center" as const,
          marginBottom: 12,
        },
        sectionTitle: {
          fontSize: 16,
          fontFamily: "Inter-Bold",
          color: "#0F172A",
        },
        sectionTitleRTL: {
          textAlign: "right" as const,
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
          ...getTextStyle(
            theme,
            "caption",
            "regular",
            theme.colors.text.secondary
          ),
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
          marginEnd: theme.spacing.md,
        },
        recentInfo: {
          flex: 1,
        },
        recentTitle: {
          ...getTextStyle(theme, "body", "semibold", theme.colors.text.primary),
          marginBottom: 2,
        },
        recentSubtitle: {
          ...getTextStyle(
            theme,
            "caption",
            "regular",
            theme.colors.text.secondary
          ),
        },
        viewAllButton: {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: 4,
        },
        viewAllText: {
          fontSize: 12,
          fontFamily: "Inter-SemiBold",
          color: "#0F766E",
        },
        onelineCard: {
          backgroundColor: theme.colors.background.secondary,
          borderRadius: theme.borderRadius.xl,
          padding: theme.spacing.xl,
          marginBottom: theme.spacing.xl,
          alignItems: "center" as const,
          borderWidth: 1,
          borderColor: theme.colors.border.light,
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
          marginBottom: theme.spacing.sm,
          opacity: 0.8,
        },
        onelineSource: {
          ...getTextStyle(
            theme,
            "caption",
            "medium",
            theme.colors.secondary.main
          ),
        },
        loadingContainer: {
          flex: 1,
          justifyContent: "center" as const,
          alignItems: "center" as const,
          paddingTop: 100,
        },
        inlineLoadingContainer: {
          alignItems: "center" as const,
          justifyContent: "center" as const,
          paddingVertical: theme.spacing.lg,
        },
        loadingText: {
          ...getTextStyle(theme, "body", "medium", theme.colors.text.secondary),
          marginTop: theme.spacing.base,
        },
        rtlText: {
          textAlign: "right" as const,
        },
      }))(theme),
    [theme, isRTL, contentPadding, headerPadding]
  );

  // Memoize loadTrackingData to prevent recreation
  const loadTrackingData = useCallback(
    async (isRefresh = false, force = false) => {
      if (!user) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const now = Date.now();
      const isDataFresh =
        !(force || isRefresh) &&
        lastTrackingLoadAtRef.current !== null &&
        now - lastTrackingLoadAtRef.current < TRACK_DATA_STALE_MS;

      if (isDataFresh) {
        return;
      }

      if (trackingLoadInFlightRef.current) {
        if (isRefresh) {
          setRefreshing(false);
        }
        return;
      }

      try {
        trackingLoadInFlightRef.current = true;
        if (isRefresh) {
          setRefreshing(true);
        } else if (!hasLoadedOnceRef.current) {
          setLoading(true);
        }

        // Keep screen responsive: do not block everything on one slow query.
        const [
          medicationsResult,
          symptomsResult,
          medicalHistoryResult,
          moodsResult,
          allergiesResult,
        ] = await Promise.allSettled([
          withTimeout(
            medicationService.getTodaysMedications(user.id),
            TRACK_QUERY_TIMEOUT_MS
          ),
          withTimeout(
            symptomService.getUserSymptoms(user.id, 10),
            TRACK_QUERY_TIMEOUT_MS
          ),
          withTimeout(
            medicalHistoryService.getUserMedicalHistory(user.id, 3),
            TRACK_QUERY_TIMEOUT_MS
          ),
          withTimeout(
            moodService.getUserMoods(user.id, 21),
            TRACK_QUERY_TIMEOUT_MS
          ),
          withTimeout(
            allergyService.getUserAllergies(user.id, 3),
            TRACK_QUERY_TIMEOUT_MS
          ),
        ]);

        const medications =
          medicationsResult.status === "fulfilled"
            ? medicationsResult.value
            : [];
        const symptoms =
          symptomsResult.status === "fulfilled" ? symptomsResult.value : null;
        const medicalHistory =
          medicalHistoryResult.status === "fulfilled"
            ? medicalHistoryResult.value
            : null;
        const moods =
          moodsResult.status === "fulfilled" ? moodsResult.value : null;
        const allergies =
          allergiesResult.status === "fulfilled" ? allergiesResult.value : null;

        if (symptoms) {
          setRecentSymptoms(symptoms.slice(0, 3));
        }
        if (medicalHistory) {
          setRecentMedicalHistory(medicalHistory);
        }
        if (moods) {
          setRecentMoods(moods.slice(0, 3));
        }
        if (allergies) {
          setRecentAllergies(allergies);
        }

        // Calculate stats (optimized single pass)
        const totalMedications = medications.length;

        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const symptomsThisWeek = symptoms
          ? symptoms.filter(
              (s) => new Date(s.timestamp).getTime() > sevenDaysAgo
            ).length
          : null;

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

        const totalConditions = medicalHistory
          ? medicalHistory.filter((h) => !h.isFamily).length
          : null;
        const recentMoodsInRange = moods
          ? moods.filter((m) => m.timestamp.getTime() >= sevenDaysAgo)
          : null;
        const moodsThisWeek = recentMoodsInRange
          ? recentMoodsInRange.length
          : null;
        const avgMoodIntensity =
          recentMoodsInRange && recentMoodsInRange.length > 0
            ? recentMoodsInRange.reduce((sum, m) => sum + m.intensity, 0) /
              recentMoodsInRange.length
            : null;

        setStats((previous) => ({
          totalSymptoms: symptoms ? symptoms.length : previous.totalSymptoms,
          totalMedications,
          symptomsThisWeek:
            symptomsThisWeek !== null
              ? symptomsThisWeek
              : previous.symptomsThisWeek,
          medicationCompliance: Math.round(compliance),
          upcomingMedications,
          totalConditions:
            totalConditions !== null
              ? totalConditions
              : previous.totalConditions,
          moodsThisWeek:
            moodsThisWeek !== null ? moodsThisWeek : previous.moodsThisWeek,
          avgMoodIntensity:
            avgMoodIntensity !== null
              ? Math.round(avgMoodIntensity * 10) / 10
              : previous.avgMoodIntensity,
        }));
        lastTrackingLoadAtRef.current = Date.now();
      } catch (_error) {
        // Silently handle error
      } finally {
        trackingLoadInFlightRef.current = false;
        hasLoadedOnceRef.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        loadTrackingData(false, true);
      }
    });

    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [loadTrackingData]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id || trackingLoadInFlightRef.current) {
        return;
      }

      const lastLoadedAt = lastTrackingLoadAtRef.current;
      if (lastLoadedAt && Date.now() - lastLoadedAt < TRACK_DATA_STALE_MS) {
        return;
      }

      let cancelled = false;
      const task = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) {
          loadTrackingData(false, false);
        }
      });

      return () => {
        cancelled = true;
        task.cancel?.();
      };
    }, [loadTrackingData, user?.id])
  );

  const formatTime = (
    timestamp:
      | Date
      | string
      | { toDate?: () => Date; seconds?: number }
      | null
      | undefined
  ) => {
    if (!timestamp) {
      return "";
    }
    let date: Date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === "string") {
      date = new Date(timestamp);
    } else if (
      timestamp &&
      typeof timestamp === "object" &&
      "toDate" in timestamp &&
      timestamp.toDate
    ) {
      date = timestamp.toDate();
    } else if (
      timestamp &&
      typeof timestamp === "object" &&
      "seconds" in timestamp &&
      timestamp.seconds !== undefined
    ) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      return "";
    }
    return safeFormatTime(date, undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

  const handleShowHowTo = useCallback(() => {
    setShowHowTo(true);
  }, []);

  if (!user) {
    return (
      <GradientScreen
        edges={["top"]}
        pointerEvents="box-none"
        style={styles.container as ViewStyle}
      >
        <View style={styles.loadingContainer as ViewStyle}>
          <Text style={styles.loadingText as StyleProp<TextStyle>}>
            Please log in to track your health
          </Text>
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container as ViewStyle}
    >
      {/* Header */}
      <View style={styles.headerWrapper as ViewStyle}>
        <WavyBackground curve="home" height={220} variant="teal">
          <View style={styles.headerContent as ViewStyle}>
            <View
              style={[
                styles.headerRow,
                isRTL && { flexDirection: "row-reverse" as const },
              ]}
            >
              <Text
                style={[
                  styles.headerTitle,
                  isRTL && { textAlign: "left" as const },
                ]}
              >
                {isRTL ? "تتبع الصحة" : "Health Tracking"}
              </Text>
              <TouchableOpacity
                onPress={handleShowHowTo}
                style={styles.helpButton as ViewStyle}
              >
                <Info color={theme.colors.neutral.white} size={18} />
              </TouchableOpacity>
            </View>
            <Text
              style={[
                styles.headerSubtitle,
                isRTL && { textAlign: "left" as const },
              ]}
            >
              {isRTL
                ? "راقب أعراضك الصحية وأدويتك"
                : "Monitor your symptoms and medications"}
            </Text>
          </View>
        </WavyBackground>
      </View>

      <ScrollView
        contentContainerStyle={styles.contentInner as ViewStyle}
        refreshControl={
          <RefreshControl
            onRefresh={() => loadTrackingData(true, true)}
            refreshing={refreshing}
            tintColor={theme.colors.primary.main}
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.content as ViewStyle}
      >
        {showBlockingLoading ? (
          <View style={styles.loadingContainer as ViewStyle}>
            <ActivityIndicator color={theme.colors.primary.main} size="large" />
            <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
              {isRTL ? "???? ???????..." : "Loading..."}
            </Text>
          </View>
        ) : (
          <>
            {loading ? (
              <View style={styles.inlineLoadingContainer as ViewStyle}>
                <ActivityIndicator
                  color={theme.colors.primary.main}
                  size="small"
                />
                <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
                  {isRTL ? "???? ???????..." : "Updating..."}
                </Text>
              </View>
            ) : null}

            <View style={styles.statsGrid as ViewStyle}>
              <View style={styles.statCard as ViewStyle}>
                <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                  {entriesToday()}
                </Text>
                <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "??????? ?????" : "Entries Today"}
                </Text>
              </View>
              <View style={styles.statCard as ViewStyle}>
                <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                  {trackingCategories.length}
                </Text>
                <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "??????" : "Categories"}
                </Text>
              </View>
              <View style={styles.statCard as ViewStyle}>
                <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                  {stats.medicationCompliance}%
                </Text>
                <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "????????" : "Compliance"}
                </Text>
              </View>
            </View>

            <View style={styles.section as ViewStyle}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                {isRTL ? "???? ??????" : "Tracking Categories"}
              </Text>
              <View style={styles.categoriesGrid as ViewStyle}>
                {trackingCategories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      key={category.label}
                      onPress={category.onPress}
                      style={styles.categoryCard as ViewStyle}
                    >
                      <View style={styles.categoryCardInner as ViewStyle}>
                        <View
                          style={[
                            styles.categoryIconWrap,
                            { backgroundColor: `${category.color}15` },
                          ]}
                        >
                          <Icon color={category.color} size={22} />
                        </View>
                        <View style={styles.categoryText as ViewStyle}>
                          <Text
                            style={[
                              styles.categoryTitle,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {category.label}
                          </Text>
                          <Text
                            style={[
                              styles.categoryDescription,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {category.description}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.section as ViewStyle}>
              <View style={styles.sectionHeaderRow as ViewStyle}>
                <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "?????? ??????" : "Recent Activity"}
                </Text>
                <TouchableOpacity
                  onPress={navigateToTimeline}
                  style={styles.viewAllButton as ViewStyle}
                >
                  <Text style={[styles.viewAllText, isRTL && styles.rtlText]}>
                    {isRTL ? "??? ????" : "View All"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.activityList as ViewStyle}>
                {recentActivityItems().length > 0 ? (
                  recentActivityItems().map((item) => {
                    const Icon = item.icon;
                    return (
                      <View
                        key={item.id}
                        style={styles.activityCard as ViewStyle}
                      >
                        <View style={styles.activityRow as ViewStyle}>
                          <View
                            style={[
                              styles.activityIcon,
                              { backgroundColor: `${item.color}15` },
                            ]}
                          >
                            <Icon color={item.color} size={18} />
                          </View>
                          <View style={styles.activityText as ViewStyle}>
                            <Text
                              style={[
                                styles.activityTitle,
                                isRTL && styles.rtlText,
                              ]}
                            >
                              {item.title}
                            </Text>
                            <Text
                              style={[
                                styles.activityDetail,
                                isRTL && styles.rtlText,
                              ]}
                            >
                              {item.detail}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                    {isRTL ? "?? ???? ???? ????" : "No recent activity"}
                  </Text>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={navigateToSymptoms}
        style={styles.fab as ViewStyle}
      >
        <Plus color="#FFFFFF" size={22} />
      </TouchableOpacity>

      <CoachMark
        body={
          isRTL
            ? "اضغط هنا لإدخال المقاييس الصحية مثل ضغط الدم."
            : "Tap here to input health metrics like blood pressure."
        }
        isRTL={isRTL}
        onClose={() => setShowHowTo(false)}
        onPrimaryAction={handleBloodPressurePress}
        primaryActionLabel={isRTL ? "إدخال" : "Enter"}
        secondaryActionLabel={isRTL ? "تم" : "Got it"}
        targetRef={bloodPressureCardRef}
        title={isRTL ? "إدخال المقاييس الصحية" : "Input health metrics"}
        visible={showHowTo}
      />

      {/* PPG Heart Rate Monitor now accessed via /ppg-measure route */}

      {/* Blood Pressure screen handles entry */}
    </GradientScreen>
  );
}

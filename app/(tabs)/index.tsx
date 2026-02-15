/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Legacy screen pending modular refactor. */
/* biome-ignore-all lint/suspicious/noExplicitAny: Legacy data sources are heterogenous and typed incrementally. */
/* biome-ignore-all lint/style/noNestedTernary: Existing UI copy selection logic uses nested ternaries. */
/* biome-ignore-all lint/suspicious/noArrayIndexKey: Static guided-tour indicators use positional keys. */
/* biome-ignore-all lint/nursery/noShadow: Legacy callback variable naming retained to minimize churn. */
/* biome-ignore-all lint/nursery/noLeakedRender: Existing conditional rendering patterns retained in this patch. */
/* biome-ignore-all lint/complexity/noForEach: Existing loops retained pending larger refactor. */
/* biome-ignore-all lint/correctness/useExhaustiveDependencies: Intentional hook dependency omissions are preserved. */
/* biome-ignore-all lint/suspicious/noEmptyBlockStatements: Intentional no-op catch handlers for non-critical side effects. */
/* biome-ignore-all lint/performance/noNamespaceImport: Namespace import kept for compatibility with current usage. */
/* biome-ignore-all lint/nursery/noIncrementDecrement: Existing incremental counters retained in legacy logic. */
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Activity,
  AlertCircle,
  Check,
  ChevronRight,
  Heart,
  MoreVertical,
  Phone,
  Pill,
  Smile,
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  type StyleProp,
  type TextStyle,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Design System Components
import ProactiveHealthSuggestions from "@/app/components/ProactiveHealthSuggestions";
import { Card } from "@/components/design-system";
import { Heading, Text } from "@/components/design-system/Typography";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useDailyNotificationScheduler } from "@/hooks/useSmartNotifications";
import { alertService } from "@/lib/services/alertService";
import { medicationService } from "@/lib/services/medicationService";
import { symptomService } from "@/lib/services/symptomService";
import { userService } from "@/lib/services/userService";
import { logger } from "@/lib/utils/logger";
import type { Medication, Symptom, User as UserType } from "@/types";
import { coerceToDate } from "@/utils/dateCoercion";
import {
  safeFormatDate,
  safeFormatDateTime,
  safeFormatTime,
} from "@/utils/dateFormat";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentSymptoms, setRecentSymptoms] = useState<Symptom[]>([]);
  const [todaysMedications, setTodaysMedications] = useState<Medication[]>([]);
  const [alertsCount, setAlertsCount] = useState(0);
  const [familyMembersCount, setFamilyMembersCount] = useState(0);
  const [activeTrackingTab, setActiveTrackingTab] = useState<
    "symptoms" | "medications" | "moods" | "vitals"
  >("symptoms");
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
  const [_familyMembers, setFamilyMembers] = useState<UserType[]>([]);
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourOverride, setTourOverride] = useState(false);
  const tourRequestedRef = useRef(false);
  const tourParamHandledRef = useRef(false);
  const tourTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const medicationReminderSyncKeyRef = useRef<string | null>(null);
  const params = useLocalSearchParams<{ tour?: string }>();
  const { width, height } = useWindowDimensions();

  const isRTL = i18n.language.toLowerCase().startsWith("ar");
  const isAdmin = user?.role === "admin";
  const _hasFamily = Boolean(user?.familyId);
  const isIphone16Pro =
    Math.round(Math.min(width, height)) === 393 &&
    Math.round(Math.max(width, height)) === 852;
  const contentPadding = isIphone16Pro ? 24 : theme.spacing.lg;
  const headerPadding = isIphone16Pro ? 28 : theme.spacing.xl;

  // Initialize daily notification scheduler
  const notificationPrefs = (user as any)?.preferences?.notifications;
  const notificationsEnabled =
    typeof notificationPrefs === "object"
      ? notificationPrefs?.enabled !== false
      : notificationPrefs !== false;
  useDailyNotificationScheduler(notificationsEnabled);

  // Get notification scheduling functions
  const { scheduleRecurringMedicationReminder } = useNotifications();

  // Memoize themed styles to prevent recreation on every render
  const styles = useMemo(
    () =>
      createThemedStyles((theme) => ({
        container: {
          flex: 1,
          backgroundColor: "transparent",
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
          paddingHorizontal: contentPadding,
          paddingVertical: theme.spacing.base,
          paddingBottom: 100, // Extra padding for tab bar
        },
        header: {
          marginBottom: theme.spacing.xl,
        },
        welcomeText: {
          ...getTextStyle(theme, "heading", "bold", theme.colors.neutral.white),
          marginBottom: theme.spacing.xs,
          fontSize: 30,
          lineHeight: 38,
          flexShrink: 1,
        },
        welcomeTextRTL: {
          fontSize: 26,
          lineHeight: 34,
        },
        dateText: {
          ...getTextStyle(theme, "body", "bold", theme.colors.primary.main),
          fontSize: 18,
          lineHeight: 28,
        },
        dateTextRTL: {
          alignSelf: "flex-start" as const,
          textAlign: "left" as const,
        },
        wavyHeaderWrapper: {
          marginHorizontal: -contentPadding,
          marginTop: -theme.spacing.base,
          marginBottom: theme.spacing.lg,
        },
        wavyHeaderContent: {
          paddingHorizontal: headerPadding,
          paddingTop: headerPadding,
          paddingBottom: headerPadding,
          minHeight: 230,
          justifyContent: "space-between" as const,
        },
        wavyHeaderTopRow: {
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "flex-start" as const,
          justifyContent: "space-between" as const,
        },
        wavyHeaderActions: {
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center" as const,
          gap: theme.spacing.md,
        },
        wavyHeaderActionsRTL: {
          gap: theme.spacing.sm,
        },
        headerDateRow: {
          marginTop: theme.spacing.lg,
        },
        alertBadgeButton: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: theme.colors.secondary.main,
          alignItems: "center" as const,
          justifyContent: "center" as const,
          ...theme.shadows.md,
        },
        alertBadgeText: {
          ...getTextStyle(theme, "body", "bold", theme.colors.neutral.white),
          fontSize: 16,
        },
        statsSection: {
          marginBottom: theme.spacing.xl,
        },
        statsScrollContent: {
          flexDirection: "row" as const,
          gap: theme.spacing.lg,
          paddingRight: contentPadding,
        },
        statGridCard: {
          flex: 0,
          alignItems: "center" as const,
          justifyContent: "flex-start" as const,
          minHeight: 160,
          borderRadius: theme.borderRadius.xl,
          backgroundColor: theme.colors.background.secondary,
          borderWidth: 1,
          borderColor: theme.colors.border.light,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.lg,
          paddingHorizontal: theme.spacing.md,
          ...theme.shadows.md,
        },
        statGridCardHorizontal: {
          width: 166,
          minHeight: 194,
        },
        statGridIconWrap: {
          width: 44,
          height: 44,
          alignItems: "center" as const,
          justifyContent: "center" as const,
          marginTop: theme.spacing.xs,
          marginBottom: theme.spacing.sm,
          alignSelf: "center" as const,
        },
        statGridValue: {
          ...getTextStyle(
            theme,
            "heading",
            "bold",
            theme.colors.secondary.main
          ),
          fontSize: 32,
          lineHeight: 36,
          marginBottom: theme.spacing.xs,
          textAlign: "center" as const,
        },
        statGridValueRTL: {
          // Arabic numerals/% glyphs can clip with tight line-height on Android.
          lineHeight: 48,
          minHeight: 48,
          paddingTop: 6,
          paddingBottom: 2,
          includeFontPadding: true,
        },
        statGridLabel: {
          ...getTextStyle(
            theme,
            "body",
            "regular",
            theme.colors.text.secondary
          ),
          textAlign: "center" as const,
          fontSize: 14,
          lineHeight: 20,
          width: "100%",
          flexShrink: 1,
          paddingHorizontal: theme.spacing.xs,
        },
        statGridLabelRTL: {
          fontSize: 12,
          lineHeight: 18,
          textAlign: "center" as const,
          writingDirection: "rtl" as const,
        },
        alertCard: {
          backgroundColor: "#FEE2E2",
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          borderStartWidth: 4,
          borderStartColor: "#DC2626",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        },
        alertCardInner: {
          flexDirection: "row" as const,
          gap: 12,
        },
        alertIconWrap: {
          marginTop: 2,
        },
        alertContent: {
          flex: 1,
          minWidth: 0,
        },
        alertTitle: {
          fontSize: 15,
          fontFamily: "Inter-SemiBold",
          color: "#1A1D1F",
          marginBottom: 4,
        },
        alertText: {
          fontSize: 14,
          fontFamily: "Inter-Regular",
          color: "#4E5661",
          marginBottom: 6,
        },
        alertTimestamp: {
          fontSize: 12,
          fontFamily: "Inter-Regular",
          color: "#6C7280",
        },
        section: {
          marginBottom: theme.spacing.lg,
        },
        sectionTitle: {
          ...getTextStyle(
            theme,
            "subheading",
            "bold",
            theme.colors.primary.main
          ),
          marginBottom: theme.spacing.base,
        },
        sectionHeader: {
          flexDirection: isRTL ? "row-reverse" : "row",
          justifyContent: "space-between" as const,
          alignItems: "center" as const,
          marginBottom: theme.spacing.base,
        },
        sectionHeaderRTL: {
          flexDirection: "row-reverse" as const,
        },
        viewAllButton: {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: 4,
        },
        viewAllText: {
          ...getTextStyle(theme, "body", "medium", theme.colors.primary.main),
          fontSize: 14,
        },
        sectionHeaderRow: {
          flexDirection: "row" as const,
          justifyContent: "space-between" as const,
          alignItems: "center" as const,
          marginBottom: theme.spacing.sm,
        },
        sectionTitlePrimary: {
          ...getTextStyle(
            theme,
            "subheading",
            "bold",
            theme.colors.primary.main
          ),
        },
        sectionCard: {
          backgroundColor: theme.colors.background.secondary,
          borderRadius: theme.borderRadius.xl,
          padding: theme.spacing.lg,
          borderWidth: 1,
          borderColor: theme.colors.border.light,
          ...theme.shadows.md,
        },
        medicationRow: {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.base,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border.light,
        },
        medicationIconWrap: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.colors.neutral[100],
          alignItems: "center" as const,
          justifyContent: "center" as const,
        },
        medicationAction: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: theme.colors.primary.main,
          alignItems: "center" as const,
          justifyContent: "center" as const,
          ...theme.shadows.sm,
        },
        medicationActionDisabled: {
          opacity: 0.6,
        },
        symptomRow: {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          justifyContent: "space-between" as const,
          paddingVertical: theme.spacing.base,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border.light,
        },
        symptomDots: {
          flexDirection: "row" as const,
          gap: 6,
          marginHorizontal: theme.spacing.sm,
        },
        symptomDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
        },
        symptomMoreButton: {
          padding: 4,
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
          minWidth: 0,
        },
        medicationName: {
          ...getTextStyle(theme, "body", "semibold", theme.colors.text.primary),
          marginBottom: 4,
          fontSize: 18,
          lineHeight: 26,
        },
        medicationNameRTL: {
          textAlign: "right" as const,
        },
        medicationDosage: {
          ...getTextStyle(
            theme,
            "caption",
            "regular",
            theme.colors.text.secondary
          ),
          lineHeight: 20,
        },
        medicationDosageRTL: {
          textAlign: "right" as const,
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
        symptomInfoRTL: {
          alignItems: "flex-end" as const,
        },
        symptomType: {
          ...getTextStyle(theme, "body", "semibold", theme.colors.text.primary),
          marginBottom: 4,
        },
        symptomTypeRTL: {
          textAlign: "right" as const,
        },
        symptomTime: {
          ...getTextStyle(
            theme,
            "caption",
            "regular",
            theme.colors.text.secondary
          ),
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
          writingDirection: "rtl" as const,
        },
        memberIndicator: {
          ...getTextStyle(
            theme,
            "caption",
            "medium",
            theme.colors.secondary.main
          ),
          marginTop: 2,
        },
        headerContent: {
          flex: 1,
          minWidth: 0,
          flexShrink: 1,
          flexGrow: 1,
          flexBasis: 0,
          paddingEnd: theme.spacing.sm,
          paddingStart: theme.spacing.xs,
        },
        headerContentRTL: {
          paddingEnd: 0,
          paddingStart: theme.spacing.sm,
        },
        sosHeaderButton: {
          backgroundColor: theme.colors.accent.error,
          borderRadius: theme.borderRadius.full,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          minHeight: 44,
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: theme.spacing.sm,
          ...theme.shadows.md,
        },
        sosHeaderButtonRTL: {
          paddingHorizontal: theme.spacing.md,
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
          ...getTextStyle(
            theme,
            "caption",
            "medium",
            theme.colors.secondary.main
          ),
          textAlign: "center" as const,
        },
        trackingSection: {
          backgroundColor: theme.colors.background.secondary,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.lg,
          marginBottom: theme.spacing.xl,
          ...theme.shadows.md,
        },
        trackingTabsRow: {
          marginBottom: theme.spacing.md,
        },
        trackingTabsContent: {
          flexDirection: "row" as const,
          gap: theme.spacing.sm,
          paddingRight: contentPadding,
        },
        trackingTab: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: theme.colors.border.light,
          backgroundColor: theme.colors.background.primary,
        },
        trackingTabActive: {
          backgroundColor: theme.colors.primary.main,
          borderColor: theme.colors.primary.main,
        },
        trackingTabText: {
          ...getTextStyle(
            theme,
            "caption",
            "medium",
            theme.colors.text.secondary
          ),
        },
        trackingTabTextActive: {
          color: theme.colors.neutral.white,
        },
        trackingOptions: {
          flexDirection: "row" as const,
          gap: theme.spacing.md,
          flexWrap: "nowrap" as const,
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
          ...getTextStyle(
            theme,
            "caption",
            "medium",
            theme.colors.text.primary
          ),
          marginTop: theme.spacing.sm,
          textAlign: "center" as const,
        },
        tourOverlay: {
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          justifyContent: "center",
          padding: theme.spacing.xl,
        },
        tourCard: {
          backgroundColor: theme.colors.background.primary,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.lg,
          ...theme.shadows.lg,
        },
        tourTitle: {
          ...getTextStyle(
            theme,
            "subheading",
            "bold",
            theme.colors.text.primary
          ),
          marginBottom: theme.spacing.sm,
          textAlign: "center" as const,
        },
        tourBody: {
          ...getTextStyle(
            theme,
            "body",
            "regular",
            theme.colors.text.secondary
          ),
          textAlign: "center" as const,
          marginBottom: theme.spacing.lg,
        },
        tourProgressRow: {
          flexDirection: "row" as const,
          justifyContent: "space-between" as const,
          alignItems: "center" as const,
          marginBottom: theme.spacing.base,
        },
        tourProgressText: {
          ...getTextStyle(
            theme,
            "caption",
            "medium",
            theme.colors.text.tertiary
          ),
        },
        tourDots: {
          flexDirection: "row" as const,
          gap: theme.spacing.xs,
        },
        tourDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: theme.colors.border.light,
        },
        tourDotActive: {
          backgroundColor: theme.colors.primary.main,
        },
        tourFooter: {
          flexDirection: "row" as const,
          justifyContent: "space-between" as const,
          alignItems: "center" as const,
          gap: theme.spacing.sm,
        },
        tourActions: {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: theme.spacing.sm,
        },
        tourButton: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1,
          borderColor: theme.colors.border.light,
          backgroundColor: theme.colors.background.secondary,
        },
        tourButtonPrimary: {
          borderColor: theme.colors.primary.main,
          backgroundColor: theme.colors.primary.main,
        },
        tourButtonText: {
          ...getTextStyle(theme, "caption", "bold", theme.colors.text.primary),
        },
        tourButtonTextPrimary: {
          color: theme.colors.neutral.white,
        },
      }))(theme),
    [theme, isRTL, contentPadding, headerPadding]
  );

  // Memoize navigation handlers to prevent recreation on every render
  const navigateToSymptoms = useCallback(() => {
    router.push("/(tabs)/symptoms");
  }, []);

  const navigateToMedications = useCallback(() => {
    router.push("/(tabs)/medications");
  }, []);

  const navigateToFamily = useCallback(() => {
    router.push("/(tabs)/family");
  }, []);

  const navigateToVitals = useCallback(() => {
    router.push("/(tabs)/vitals");
  }, []);

  const navigateToMoods = useCallback(() => {
    router.push("/(tabs)/moods");
  }, []);

  const navigateToTrack = useCallback(() => {
    router.push("/(tabs)/track");
  }, []);

  const trackingTabs = useMemo(
    () => [
      {
        id: "symptoms",
        label: isRTL ? "الأعراض الصحية" : "Symptoms",
        description: isRTL ? "تسجيل الأعراض الصحية" : "Log health symptoms",
        ctaLabel: isRTL ? "تسجيل" : "Log",
        icon: Activity,
        iconColor: theme.colors.primary.main,
        iconBackground: theme.colors.primary[50],
        ctaColor: theme.colors.primary.main,
        onPress: navigateToSymptoms,
      },
      {
        id: "medications",
        label: isRTL ? "الأدوية" : "Medications",
        description: isRTL
          ? "إدارة الأدوية والتذكيرات"
          : "Manage meds & reminders",
        ctaLabel: isRTL ? "إدارة" : "Manage",
        icon: Pill,
        iconColor: theme.colors.accent.success,
        iconBackground: `${theme.colors.accent.success}20`,
        ctaColor: theme.colors.accent.success,
        onPress: navigateToMedications,
      },
      {
        id: "moods",
        label: isRTL ? "الحالة النفسية" : "Mood",
        description: isRTL ? "تسجيل المزاج اليومي" : "Track daily mood",
        ctaLabel: isRTL ? "تسجيل" : "Log",
        icon: Smile,
        iconColor: theme.colors.accent.warning,
        iconBackground: `${theme.colors.accent.warning}20`,
        ctaColor: theme.colors.accent.warning,
        onPress: navigateToMoods,
      },
      {
        id: "vitals",
        label: isRTL ? "العلامات الحيوية" : "Vitals",
        description: isRTL ? "قياس الضغط والنبض" : "Blood pressure & pulse",
        ctaLabel: isRTL ? "قياس" : "Measure",
        icon: Heart,
        iconColor: theme.colors.accent.info,
        iconBackground: `${theme.colors.accent.info}20`,
        ctaColor: theme.colors.accent.info,
        onPress: navigateToVitals,
      },
    ],
    [
      isRTL,
      theme,
      navigateToSymptoms,
      navigateToMedications,
      navigateToMoods,
      navigateToVitals,
    ]
  );

  const activeTrackingTabData =
    trackingTabs.find((tab) => tab.id === activeTrackingTab) ?? trackingTabs[0];
  const ActiveTrackingIcon = activeTrackingTabData?.icon ?? Activity;

  const loadDashboardData = useCallback(async () => {
    if (!user) {
      return;
    }

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

      // Schedule medication reminders for all active medications
      // This ensures reminders are scheduled even if they weren't scheduled when medication was added
      if (notificationsEnabled && scheduleRecurringMedicationReminder) {
        try {
          const todayKey = `${user.id}:${new Date().toDateString()}`;
          const shouldSyncReminders =
            medicationReminderSyncKeyRef.current !== todayKey;

          if (shouldSyncReminders) {
            // Get all user medications (not just today's) to schedule all reminders
            const allMedications = await medicationService.getUserMedications(
              user.id
            );

            // Schedule reminders for each medication and reminder time
            for (const medication of allMedications) {
              if (
                !(medication.isActive && Array.isArray(medication.reminders))
              ) {
                continue;
              }

              // Schedule each reminder time
              for (const reminder of medication.reminders) {
                if (reminder.time?.trim()) {
                  // Schedule reminder (this function handles deduplication)
                  await scheduleRecurringMedicationReminder(
                    medication.name,
                    medication.dosage,
                    reminder.time,
                    {
                      medicationId: medication.id,
                      reminderId: reminder.id,
                    }
                  ).catch(() => {
                    // Silently handle scheduling errors - don't block dashboard load
                  });
                }
              }
            }

            medicationReminderSyncKeyRef.current = todayKey;
          }
        } catch (_error) {
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
            const takenDate = coerceToDate(r.takenAt);
            if (takenDate?.toDateString() === today) {
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
    } catch (_error) {
      // Silently handle dashboard data load error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    user?.id,
    user?.familyId,
    notificationsEnabled,
    scheduleRecurringMedicationReminder,
  ]);

  // Memoize loadDashboardData to prevent unnecessary recreations
  const loadDashboardDataMemoized = useCallback(async () => {
    await loadDashboardData();
  }, [loadDashboardData]);

  const scheduleDashboardLoad = useCallback(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      loadDashboardDataMemoized();
    });

    return () => {
      handle.cancel?.();
    };
  }, [loadDashboardDataMemoized]);

  useEffect(() => {
    const cancel = scheduleDashboardLoad();
    return cancel;
  }, [scheduleDashboardLoad]);

  // Refresh data when tab is focused (only if not already loading)
  useFocusEffect(
    useCallback(() => {
      if (loading || refreshing) {
        return;
      }

      return scheduleDashboardLoad();
    }, [loading, refreshing, scheduleDashboardLoad])
  );

  useEffect(() => {
    tourRequestedRef.current = false;
    tourParamHandledRef.current = false;
    setShowTour(false);
    setTourStep(0);
  }, [user?.id]);

  useEffect(() => {
    if (tourParamHandledRef.current) {
      return;
    }
    if (params.tour !== "1") {
      return;
    }
    tourParamHandledRef.current = true;
    setTourOverride(true);
  }, [params.tour]);

  useEffect(() => {
    let isMounted = true;
    const readTourOverride = async () => {
      try {
        const AsyncStorage = await import(
          "@react-native-async-storage/async-storage"
        );
        const shouldTrigger =
          (await AsyncStorage.default.getItem("triggerDashboardTour")) ===
          "true";
        if (!(isMounted && shouldTrigger)) {
          return;
        }
        await AsyncStorage.default.removeItem("triggerDashboardTour");
        setTourOverride(true);
      } catch {
        // Ignore storage errors
      }
    };

    readTourOverride();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.id || tourRequestedRef.current) {
      return;
    }
    if (!user.onboardingCompleted) {
      return;
    }
    if (!tourOverride && user.dashboardTourCompleted) {
      return;
    }

    tourRequestedRef.current = true;
    tourTimeoutRef.current = setTimeout(() => {
      setShowTour(true);
    }, 800);

    return () => {
      if (tourTimeoutRef.current) {
        clearTimeout(tourTimeoutRef.current);
      }
    };
  }, [
    tourOverride,
    user?.dashboardTourCompleted,
    user?.id,
    user?.onboardingCompleted,
  ]);

  const tourSteps = useMemo(() => {
    const tabsCopy = isAdmin
      ? isRTL
        ? "استخدم الشريط السفلي للتنقل بين الصفحة الرئيسية، التتبع، زينة، العائلة، والملف الشخصي."
        : "Use the bottom tabs to switch between Home, Track, Zeina, Family, and Profile."
      : isRTL
        ? "استخدم الشريط السفلي للتنقل بين الصفحة الرئيسية، زينة، والملف الشخصي."
        : "Use the bottom tabs to switch between Home, Zeina, and Profile.";

    return [
      {
        title: isRTL ? "مرحباً بك في لوحة التحكم" : "Welcome to your dashboard",
        body: isRTL
          ? "هذه الصفحة تلخص أهم المعلومات الصحية لديك في لمحة واحدة."
          : "This screen summarizes your most important health info at a glance.",
      },
      {
        title: isRTL ? "زر SOS للطوارئ" : "SOS emergency button",
        body: isRTL
          ? "اضغط SOS للاتصال بالطوارئ أو تنبيه العائلة بسرعة."
          : "Tap SOS to call emergency services or notify family quickly.",
      },
      {
        title: t("statsCards"),
        body: isRTL
          ? "تعرض نشاطك الأسبوعي والالتزام بالأدوية ولمحة عن العائلة."
          : "See weekly activity, medication compliance, and family overview.",
      },
      {
        title: isRTL ? "أدوية اليوم" : "Today's medications",
        body: isRTL
          ? "راجع الأدوية القادمة وسجل ما تم تناوله بنقرة واحدة."
          : "Review upcoming meds and mark them as taken in one tap.",
      },
      {
        title: t("recentSymptomsTitle"),
        body: isRTL
          ? "سجل أعراضك وتابع شدتها وتوقيتها هنا."
          : "Log symptoms and track their timing and severity here.",
      },
      {
        title: t("quickActions"),
        body: isRTL
          ? "اختصارات لإضافة أعراض، أدوية، العلامات الحيوية، والمزيد."
          : "Shortcuts to log symptoms, manage meds, record vitals, and more.",
      },
      {
        title: t("navigationTabs"),
        body: tabsCopy,
      },
    ];
  }, [isAdmin, isRTL]);

  const handleTourFinish = async () => {
    setShowTour(false);
    setTourStep(0);
    if (!user?.id) {
      return;
    }
    try {
      await updateUser({ dashboardTourCompleted: true });
    } catch {
      // Silently fail - the tour has already been dismissed
    }
  };

  const handleTourNext = () => {
    if (tourStep >= tourSteps.length - 1) {
      handleTourFinish();
      return;
    }
    setTourStep((prevStep) => prevStep + 1);
  };

  const handleTourBack = () => {
    setTourStep((prevStep) => Math.max(0, prevStep - 1));
  };

  const activeTourStep = tourSteps[tourStep] ?? tourSteps[0];

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const formatTime = (date: Date | string | any) => {
    // Convert to Date object if needed
    let dateObj: Date;
    if (date instanceof Date) {
      dateObj = date;
    } else if (date?.toDate && typeof date.toDate === "function") {
      dateObj = date.toDate();
    } else {
      dateObj = new Date(date);
    }

    // Validate date
    if (Number.isNaN(dateObj.getTime())) {
      return "";
    }

    return safeFormatTime(dateObj, undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date | string | any) => {
    // Convert to Date object if needed
    let dateObj: Date;
    if (date instanceof Date) {
      dateObj = date;
    } else if (date?.toDate && typeof date.toDate === "function") {
      dateObj = date.toDate();
    } else {
      dateObj = new Date(date);
    }

    // Validate date
    if (Number.isNaN(dateObj.getTime())) {
      return "";
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const symptomDate = new Date(
      dateObj.getFullYear(),
      dateObj.getMonth(),
      dateObj.getDate()
    );

    if (symptomDate.getTime() === today.getTime()) {
      return isRTL ? "اليوم" : "Today";
    }
    if (symptomDate.getTime() === yesterday.getTime()) {
      return isRTL ? "أمس" : "Yesterday";
    }
    return safeFormatDate(dateObj, isRTL ? "ar-u-ca-gregory" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (date: Date | string | any) => {
    let dateObj: Date;
    if (date instanceof Date) {
      dateObj = date;
    } else if (date?.toDate && typeof date.toDate === "function") {
      dateObj = date.toDate();
    } else {
      dateObj = new Date(date);
    }

    if (Number.isNaN(dateObj.getTime())) {
      return "";
    }

    return safeFormatDateTime(dateObj, isRTL ? "ar" : "en-US");
  };

  const getSeverityColor = (severity: number) =>
    theme.colors.severity[severity as keyof typeof theme.colors.severity] ||
    theme.colors.neutral[500];

  const isSameLocalDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  const isReminderTakenToday = (
    reminder: Medication["reminders"][number],
    todayDate: Date
  ) => {
    if (!reminder.taken) {
      return false;
    }

    const takenDate = coerceToDate(reminder.takenAt);
    return !!takenDate && isSameLocalDay(takenDate, todayDate);
  };

  // Find the next upcoming reminder for a medication that hasn't been taken
  const getNextUpcomingReminder = (medication: Medication) => {
    if (
      !Array.isArray(medication.reminders) ||
      medication.reminders.length === 0
    ) {
      return null;
    }

    const now = new Date();

    // Find reminders that haven't been taken today
    const untakenReminders = medication.reminders.filter(
      (reminder) => !isReminderTakenToday(reminder, now)
    );

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
    if (!user?.id) {
      return;
    }

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
    } catch (_error) {
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
    } catch (_error) {
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
            } catch (_error) {
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

  const handleAlertsBadgePress = async () => {
    if (!user?.id || alertsCount === 0) {
      return;
    }
    setShowAlertsModal(true);
    setLoadingAlerts(true);
    try {
      const alerts = await alertService.getActiveAlerts(user.id);
      setUserAlerts(alerts);
    } finally {
      setLoadingAlerts(false);
    }
  };

  // Default widget order
  const enabledWidgets = [
    "stats",
    "alerts",
    "healthInsights",
    "todaysMedications",
    "recentSymptoms",
  ];

  // Widget render functions
  const renderWidget = (widgetId: string) => {
    switch (widgetId) {
      case "stats":
        return (
          <View key="stats" style={styles.statsSection as ViewStyle}>
            <ScrollView
              contentContainerStyle={styles.statsScrollContent as ViewStyle}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
            >
              <Card
                contentStyle={{ padding: 0, overflow: "visible" }}
                onPress={navigateToSymptoms}
                pressable={true}
                style={[
                  styles.statGridCard as ViewStyle,
                  styles.statGridCardHorizontal as ViewStyle,
                  {
                    paddingTop: theme.spacing.md,
                    overflow: "visible" as const,
                  },
                ]}
                variant="elevated"
              >
                <View
                  style={[
                    styles.statGridIconWrap as ViewStyle,
                    { marginTop: 0, marginBottom: theme.spacing.xs },
                  ]}
                >
                  <Activity color={theme.colors.primary.main} size={28} />
                </View>
                <Text
                  adjustsFontSizeToFit={true}
                  color={theme.colors.secondary.main}
                  minimumFontScale={0.7}
                  numberOfLines={1}
                  size="large"
                  style={[
                    styles.statGridValue,
                    isRTL && styles.statGridValueRTL,
                    { marginTop: theme.spacing.sm },
                  ]}
                  weight="bold"
                >
                  {stats.symptomsThisWeek}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.statGridLabel,
                    isRTL && styles.statGridLabelRTL,
                  ]}
                  weight="medium"
                >
                  {isRTL ? "أعراض الأسبوع" : "Symptoms This Week"}
                </Text>
              </Card>

              <Card
                contentStyle={{ padding: 0, overflow: "visible" }}
                onPress={navigateToMedications}
                pressable={true}
                style={[
                  styles.statGridCard as ViewStyle,
                  styles.statGridCardHorizontal as ViewStyle,
                  {
                    paddingTop: theme.spacing.md,
                    overflow: "visible" as const,
                  },
                ]}
                variant="elevated"
              >
                <View
                  style={[
                    styles.statGridIconWrap as ViewStyle,
                    { marginTop: 0, marginBottom: theme.spacing.xs },
                  ]}
                >
                  <Pill color={theme.colors.accent.success} size={28} />
                </View>
                <Text
                  adjustsFontSizeToFit={true}
                  color={theme.colors.secondary.main}
                  minimumFontScale={0.7}
                  numberOfLines={1}
                  size="large"
                  style={[
                    styles.statGridValue,
                    isRTL && styles.statGridValueRTL,
                    { marginTop: theme.spacing.sm },
                  ]}
                  weight="bold"
                >
                  {stats.medicationCompliance}%
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.statGridLabel,
                    isRTL && styles.statGridLabelRTL,
                  ]}
                  weight="medium"
                >
                  {isRTL ? "التزام الدواء" : "Med Compliance"}
                </Text>
              </Card>

              <Card
                contentStyle={{ padding: 0, overflow: "visible" }}
                onPress={navigateToFamily}
                pressable={true}
                style={[
                  styles.statGridCard as ViewStyle,
                  styles.statGridCardHorizontal as ViewStyle,
                  {
                    paddingTop: theme.spacing.md,
                    overflow: "visible" as const,
                  },
                ]}
                variant="elevated"
              >
                <View
                  style={[
                    styles.statGridIconWrap as ViewStyle,
                    { marginTop: 0, marginBottom: theme.spacing.xs },
                  ]}
                >
                  <Users color={theme.colors.primary.main} size={28} />
                </View>
                <Text
                  adjustsFontSizeToFit={true}
                  color={theme.colors.secondary.main}
                  minimumFontScale={0.7}
                  numberOfLines={1}
                  size="large"
                  style={[
                    styles.statGridValue,
                    isRTL && styles.statGridValueRTL,
                    { marginTop: theme.spacing.sm },
                  ]}
                  weight="bold"
                >
                  {familyMembersCount}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.statGridLabel,
                    isRTL && styles.statGridLabelRTL,
                  ]}
                  weight="medium"
                >
                  {isRTL ? "العائلة" : "Family Members"}
                </Text>
              </Card>
            </ScrollView>
          </View>
        );

      case "todaysMedications":
        return (
          <View key="todaysMedications" style={styles.section as ViewStyle}>
            <View style={styles.sectionHeaderRow as ViewStyle}>
              <Text
                style={[
                  styles.sectionTitlePrimary,
                  isRTL && styles.rtlText,
                  isRTL && { textAlign: "right" as const },
                ]}
              >
                {isRTL ? "أدوية اليوم" : "Today's Medications"}
              </Text>
              <TouchableOpacity
                onPress={navigateToMedications}
                style={styles.viewAllButton as ViewStyle}
              >
                <Text style={[styles.viewAllText, isRTL && styles.rtlText]}>
                  {isRTL ? "عرض الكل" : "View All"}
                </Text>
                <ChevronRight color={theme.colors.primary.main} size={16} />
              </TouchableOpacity>
            </View>

            <View style={styles.sectionCard as ViewStyle}>
              {todaysMedications.length > 0 ? (
                todaysMedications.slice(0, 2).map((medication) => {
                  const todayDate = new Date();
                  const nextReminder = getNextUpcomingReminder(medication);
                  const hasUntakenReminders = nextReminder !== null;
                  const allTaken =
                    Array.isArray(medication.reminders) &&
                    medication.reminders.length > 0 &&
                    medication.reminders.every((r) =>
                      isReminderTakenToday(r, todayDate)
                    );

                  return (
                    <View
                      key={medication.id}
                      style={styles.medicationRow as ViewStyle}
                    >
                      <View style={styles.medicationIconWrap as ViewStyle}>
                        <Pill color={theme.colors.primary.main} size={20} />
                      </View>
                      <View style={styles.medicationInfo as ViewStyle}>
                        <Text
                          numberOfLines={2}
                          style={[
                            styles.medicationName,
                            isRTL && styles.medicationNameRTL,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {medication.name}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={[
                            styles.medicationDosage,
                            isRTL && styles.medicationDosageRTL,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {medication.dosage || ""} •{" "}
                          {medication.frequency || ""}
                          {nextReminder && (
                            <Text
                              style={[
                                styles.medicationDosage,
                                isRTL && styles.rtlText,
                                { marginTop: 2 },
                              ]}
                            >
                              {" • "}
                              {isRTL ? "التالي: " : "Next: "}
                              {nextReminder.time}
                            </Text>
                          )}
                        </Text>
                      </View>
                      <TouchableOpacity
                        disabled={markingMedication === medication.id}
                        onPress={() => handleMarkMedicationTaken(medication)}
                        style={[
                          styles.medicationAction,
                          markingMedication === medication.id &&
                            styles.medicationActionDisabled,
                        ]}
                      >
                        {hasUntakenReminders ? (
                          markingMedication === medication.id ? (
                            <ActivityIndicator
                              color={theme.colors.neutral.white}
                              size={16}
                            />
                          ) : (
                            <Pill
                              color={theme.colors.neutral.white}
                              size={16}
                            />
                          )
                        ) : allTaken ? (
                          <Check
                            color={theme.colors.neutral.white}
                            size={16}
                            strokeWidth={3}
                          />
                        ) : (
                          <Check
                            color={theme.colors.neutral.white}
                            size={16}
                            strokeWidth={2}
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })
              ) : (
                <TouchableOpacity
                  onPress={navigateToMedications}
                  style={styles.emptyContainer as ViewStyle}
                >
                  <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                    {isRTL
                      ? "لا توجد أدوية لليوم - اضغط للإضافة"
                      : "No medications for today - tap to add"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );

      case "recentSymptoms":
        return (
          <View key="recentSymptoms" style={styles.section as ViewStyle}>
            <View style={styles.sectionHeaderRow as ViewStyle}>
              <Text
                style={[
                  styles.sectionTitlePrimary,
                  isRTL && styles.rtlText,
                  isRTL && { textAlign: "right" as const },
                ]}
              >
                {isRTL ? "الأعراض الأخيرة" : "Recent Symptoms"}
              </Text>
              <TouchableOpacity
                onPress={navigateToSymptoms}
                style={styles.viewAllButton as ViewStyle}
              >
                <Text style={[styles.viewAllText, isRTL && styles.rtlText]}>
                  {isRTL ? "عرض الكل" : "View All"}
                </Text>
                <ChevronRight color={theme.colors.primary.main} size={16} />
              </TouchableOpacity>
            </View>

            <View style={styles.sectionCard as ViewStyle}>
              {recentSymptoms.length > 0 ? (
                recentSymptoms.slice(0, 3).map((symptom) => (
                  <View key={symptom.id} style={styles.symptomRow as ViewStyle}>
                    <View style={styles.symptomInfo as ViewStyle}>
                      <Text
                        style={[styles.symptomType, isRTL && styles.rtlText]}
                      >
                        {t(symptom.type)}
                      </Text>
                      <Text
                        style={[styles.symptomTime, isRTL && styles.rtlText]}
                      >
                        {formatDate(symptom.timestamp) || ""} •{" "}
                        {formatTime(symptom.timestamp) || ""}
                      </Text>
                    </View>
                    <View style={styles.symptomDots as ViewStyle}>
                      {[...new Array(4)].map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.symptomDot,
                            {
                              backgroundColor:
                                i < symptom.severity
                                  ? getSeverityColor(symptom.severity)
                                  : theme.colors.neutral[200],
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <TouchableOpacity
                      onPress={navigateToSymptoms}
                      style={styles.symptomMoreButton as ViewStyle}
                    >
                      <MoreVertical
                        color={theme.colors.text.secondary}
                        size={18}
                      />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <TouchableOpacity
                  onPress={navigateToSymptoms}
                  style={styles.emptyContainer as ViewStyle}
                >
                  <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                    {isRTL
                      ? "لا توجد أعراض مسجلة - اضغط للإضافة"
                      : "No symptoms recorded - tap to add"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );

      case "alerts":
        if (alertsCount === 0) {
          return null;
        }
        return (
          <View key="alerts">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={async () => {
                if (!user?.id) {
                  return;
                }
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
              <View style={styles.alertCardInner as ViewStyle}>
                <View style={styles.alertIconWrap as ViewStyle}>
                  <AlertCircle color="#DC2626" size={20} />
                </View>
                <View style={styles.alertContent as ViewStyle}>
                  <Text style={[styles.alertTitle, isRTL && styles.rtlText]}>
                    {isRTL
                      ? "تنبيهات طوارئ صحية نشطة"
                      : "Active Emergency Alerts"}
                  </Text>
                  <Text style={[styles.alertText, isRTL && styles.rtlText]}>
                    {isRTL
                      ? `لديك ${alertsCount} تنبيه${
                          alertsCount > 1 ? "ات" : ""
                        } يتطلب الانتباه`
                      : `You have ${alertsCount} alert${
                          alertsCount > 1 ? "s" : ""
                        } requiring attention`}
                  </Text>
                  <Text
                    style={[styles.alertTimestamp, isRTL && styles.rtlText]}
                  >
                    {isRTL ? "اضغط للعرض" : "Tap to view"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        );

      case "healthInsights":
        return (
          <View key="healthInsights" style={styles.section as ViewStyle}>
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
                style={[
                  styles.sectionTitle,
                  isRTL && styles.rtlText,
                  isRTL && { textAlign: "right" as const },
                ]}
              >
                {isRTL ? "إجراءات سريعة" : "Quick Actions"}
              </Text>
            </View>

            <View style={styles.quickActionsGrid as ViewStyle}>
              <TouchableOpacity
                onPress={navigateToTrack}
                style={styles.quickActionCard as ViewStyle}
              >
                <Activity color={theme.colors.primary.main} size={24} />
                <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                  {isRTL ? "تتبع الصحة" : "Track Health"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={navigateToMedications}
                style={styles.quickActionCard as ViewStyle}
              >
                <Pill color={theme.colors.accent.success} size={24} />
                <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                  {isRTL ? "إدارة الأدوية" : "Medications"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={navigateToVitals}
                style={styles.quickActionCard as ViewStyle}
              >
                <Heart color={theme.colors.secondary.main} size={24} />
                <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                  {isRTL ? "المؤشرات الحيوية" : "Vital Signs"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={navigateToFamily}
                style={styles.quickActionCard as ViewStyle}
              >
                <Users color={theme.colors.primary.light} size={24} />
                <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
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
      <GradientScreen
        edges={["top"]}
        pointerEvents="box-none"
        style={styles.container as ViewStyle}
      >
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
      </GradientScreen>
    );
  }

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container as ViewStyle}
    >
      <View style={{ flex: 1, marginBottom: 80 }}>
        <ScrollView
          contentContainerStyle={[
            styles.contentInner as ViewStyle,
            { paddingBottom: 20 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl onRefresh={onRefresh} refreshing={refreshing} />
          }
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          style={styles.content as ViewStyle}
        >
          {/* Wavy Header */}
          <View style={styles.wavyHeaderWrapper as ViewStyle}>
            <WavyBackground curve="home" height={240} variant="teal">
              <View style={styles.wavyHeaderContent as ViewStyle}>
                <View style={styles.wavyHeaderTopRow as ViewStyle}>
                  <View
                    style={[
                      styles.headerContent as ViewStyle,
                      isRTL && (styles.headerContentRTL as ViewStyle),
                    ]}
                  >
                    <Heading
                      color={theme.colors.neutral.white}
                      level={2}
                      numberOfLines={isRTL ? 3 : 2}
                      style={[
                        styles.welcomeText,
                        isRTL && styles.welcomeTextRTL,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL
                        ? `مرحباً، ${user.firstName || "User"}`
                        : `Welcome, ${user.firstName || "User"}`}
                    </Heading>
                  </View>

                  <View
                    style={[
                      styles.wavyHeaderActions as ViewStyle,
                      isRTL && (styles.wavyHeaderActionsRTL as ViewStyle),
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={handleSOS}
                      style={[
                        styles.sosHeaderButton as ViewStyle,
                        isRTL && (styles.sosHeaderButtonRTL as ViewStyle),
                      ]}
                    >
                      <Phone color={theme.colors.neutral.white} size={18} />
                      <Text
                        color={theme.colors.neutral.white}
                        style={styles.sosHeaderText as StyleProp<TextStyle>}
                        weight="bold"
                      >
                        SOS
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={handleAlertsBadgePress}
                      style={styles.alertBadgeButton as ViewStyle}
                    >
                      <Text
                        color={theme.colors.neutral.white}
                        style={styles.alertBadgeText as StyleProp<TextStyle>}
                        weight="bold"
                      >
                        {alertsCount}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.headerDateRow as ViewStyle}>
                  <Text
                    color={theme.colors.primary.main}
                    numberOfLines={isRTL ? 2 : 1}
                    size="medium"
                    style={[styles.dateText, isRTL && styles.rtlText]}
                    weight="bold"
                  >
                    {safeFormatDate(
                      new Date(),
                      isRTL ? "ar-u-ca-gregory" : "en-US",
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </Text>
                </View>
              </View>
            </WavyBackground>
          </View>

          {/* Render widgets dynamically */}
          {isAdmin && enabledWidgets.map((widgetId) => renderWidget(widgetId))}

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
                  backgroundColor: "#FFFFFF",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  maxHeight: "80%",
                  padding: 20,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 20,
                  }}
                >
                  <Text
                    style={[
                      {
                        fontSize: 20,
                        fontFamily: "Inter-SemiBold",
                        color: "#1A1D1F",
                      },
                      isRTL && styles.rtlText,
                    ]}
                  >
                    {isRTL
                      ? "التنبيهات الطوارئ الصحية الفعالة"
                      : "Active Emergency Alerts"}
                  </Text>
                  <TouchableOpacity onPress={() => setShowAlertsModal(false)}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: "Inter-Medium",
                        color: "#003543",
                      }}
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
                    <ActivityIndicator color="#003543" size="large" />
                  </View>
                ) : userAlerts.length === 0 ? (
                  <View
                    style={{
                      paddingVertical: 32,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={[
                        {
                          fontSize: 14,
                          fontFamily: "Inter-Regular",
                          color: "#6C7280",
                        },
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL
                        ? "لا توجد تنبيهات طوارئ صحية نشطة"
                        : "No active emergency alerts"}
                    </Text>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {userAlerts.map((alert) => {
                      const severityConfig = {
                        emergency: {
                          bg: "#FEE2E2",
                          border: "#DC2626",
                          icon: "#DC2626",
                        },
                        fall: {
                          bg: "#FEE2E2",
                          border: "#DC2626",
                          icon: "#DC2626",
                        },
                        medication: {
                          bg: "#FEF3C7",
                          border: "#F59E0B",
                          icon: "#F59E0B",
                        },
                        vitals: {
                          bg: "#DBEAFE",
                          border: "#3B82F6",
                          icon: "#3B82F6",
                        },
                      };
                      const config =
                        severityConfig[
                          alert.type as keyof typeof severityConfig
                        ] || severityConfig.emergency;

                      return (
                        <View
                          key={alert.id}
                          style={{
                            backgroundColor: config.bg,
                            borderRadius: 16,
                            padding: 16,
                            marginBottom: 12,
                            borderStartWidth: 4,
                            borderStartColor: config.border,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 2,
                            elevation: 1,
                          }}
                        >
                          <View style={{ flexDirection: "row", gap: 12 }}>
                            <View style={{ marginTop: 2 }}>
                              <AlertCircle color={config.icon} size={20} />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                style={[
                                  {
                                    fontSize: 15,
                                    fontFamily: "Inter-SemiBold",
                                    color: "#1A1D1F",
                                    marginBottom: 4,
                                  },
                                  isRTL && styles.rtlText,
                                ]}
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
                                style={[
                                  {
                                    fontSize: 14,
                                    fontFamily: "Inter-Regular",
                                    color: "#4E5661",
                                    marginBottom: 6,
                                  },
                                  isRTL && styles.rtlText,
                                ]}
                              >
                                {alert.message}
                              </Text>
                              <View
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <Text
                                  style={[
                                    {
                                      fontSize: 12,
                                      fontFamily: "Inter-Regular",
                                      color: "#6C7280",
                                    },
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  {formatDateTime(alert.timestamp)}
                                </Text>
                                <TouchableOpacity
                                  disabled={loadingAlerts}
                                  onPress={async () => {
                                    try {
                                      setLoadingAlerts(true);

                                      await alertService.resolveAlert(
                                        alert.id,
                                        user.id
                                      );

                                      await new Promise((resolve) =>
                                        setTimeout(resolve, 1500)
                                      );

                                      const updatedAlerts =
                                        await alertService.getActiveAlerts(
                                          user.id
                                        );

                                      setUserAlerts(updatedAlerts);
                                      setAlertsCount(updatedAlerts.length);

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
                                          t("success"),
                                          t("alertResolvedSuccessfully")
                                        );
                                      }
                                    } catch (error: any) {
                                      logger.error(
                                        "Failed to resolve alert",
                                        error,
                                        "HomeScreen"
                                      );

                                      const errorMessage =
                                        error?.message || t("unknownError");
                                      let displayMessage = errorMessage;

                                      if (
                                        errorMessage.includes(
                                          "permission-denied"
                                        ) ||
                                        errorMessage.includes("permission")
                                      ) {
                                        displayMessage = isRTL
                                          ? "ليس لديك الصلاحية لحل هذا التنبيه"
                                          : "You don't have permission to resolve this alert";
                                      } else if (
                                        errorMessage.includes(
                                          "does not exist"
                                        ) ||
                                        errorMessage.includes("not found")
                                      ) {
                                        displayMessage = isRTL
                                          ? "التنبيه غير موجود"
                                          : "Alert not found";
                                      }

                                      Alert.alert(
                                        isRTL ? "خطأ" : "Error",
                                        isRTL
                                          ? `فشل في حل التنبيه: ${displayMessage}`
                                          : `Failed to resolve alert: ${displayMessage}`
                                      );
                                    } finally {
                                      setLoadingAlerts(false);
                                    }
                                  }}
                                  style={{
                                    backgroundColor: loadingAlerts
                                      ? "#9CA3AF"
                                      : "#003543",
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 8,
                                    opacity: loadingAlerts ? 0.6 : 1,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      fontFamily: "Inter-SemiBold",
                                      color: "#FFFFFF",
                                    }}
                                  >
                                    {isRTL ? "حل" : "Resolve"}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>

          <Modal
            animationType="fade"
            onRequestClose={handleTourFinish}
            transparent={true}
            visible={showTour && tourSteps.length > 0}
          >
            <View style={styles.tourOverlay as ViewStyle}>
              <View style={styles.tourCard as ViewStyle}>
                <Text
                  style={[styles.tourTitle, isRTL && styles.rtlText]}
                  weight="bold"
                >
                  {activeTourStep.title}
                </Text>
                <Text style={[styles.tourBody, isRTL && styles.rtlText]}>
                  {activeTourStep.body}
                </Text>
                <View style={styles.tourProgressRow as ViewStyle}>
                  <Text style={styles.tourProgressText as StyleProp<TextStyle>}>
                    {tourStep + 1}/{tourSteps.length}
                  </Text>
                  <View style={styles.tourDots as ViewStyle}>
                    {tourSteps.map((_, index) => (
                      <View
                        key={`tour-dot-${index}`}
                        style={[
                          styles.tourDot,
                          index === tourStep && styles.tourDotActive,
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <View style={styles.tourFooter as ViewStyle}>
                  <Pressable
                    onPress={handleTourFinish}
                    style={styles.tourButton as ViewStyle}
                  >
                    <Text style={styles.tourButtonText as StyleProp<TextStyle>}>
                      {isRTL ? "تخطي" : "Skip"}
                    </Text>
                  </Pressable>
                  <View style={styles.tourActions as ViewStyle}>
                    {tourStep > 0 && (
                      <Pressable
                        onPress={handleTourBack}
                        style={styles.tourButton as ViewStyle}
                      >
                        <Text
                          style={styles.tourButtonText as StyleProp<TextStyle>}
                        >
                          {isRTL ? "رجوع" : "Back"}
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={handleTourNext}
                      style={[styles.tourButton, styles.tourButtonPrimary]}
                    >
                      <Text
                        style={[
                          styles.tourButtonText,
                          styles.tourButtonTextPrimary,
                        ]}
                      >
                        {tourStep >= tourSteps.length - 1
                          ? isRTL
                            ? "إنهاء"
                            : "Done"
                          : isRTL
                            ? "التالي"
                            : "Next"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </Modal>

          {/* Health Tracking Section for Regular Users */}
          {!isAdmin && (
            <View style={styles.trackingSection as ViewStyle}>
              <View style={styles.sectionHeader as ViewStyle}>
                <Text
                  style={[
                    styles.sectionTitle,
                    isRTL && styles.rtlText,
                    isRTL && { textAlign: "right" as const },
                  ]}
                >
                  {isRTL ? "تتبع الصحة اليومي" : "Daily Health Tracking"}
                </Text>
              </View>

              <View style={styles.trackingTabsRow as ViewStyle}>
                <ScrollView
                  contentContainerStyle={
                    styles.trackingTabsContent as ViewStyle
                  }
                  horizontal={true}
                  showsHorizontalScrollIndicator={false}
                >
                  {trackingTabs.map((tab) => {
                    const isActive = tab.id === activeTrackingTab;
                    return (
                      <TouchableOpacity
                        key={tab.id}
                        onPress={() => setActiveTrackingTab(tab.id)}
                        style={[
                          styles.trackingTab as ViewStyle,
                          isActive && styles.trackingTabActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.trackingTabText,
                            isActive && styles.trackingTabTextActive,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {activeTrackingTabData ? (
                <View style={styles.trackingOptions as ViewStyle}>
                  <TouchableOpacity
                    onPress={activeTrackingTabData.onPress}
                    style={styles.trackingCard as ViewStyle}
                  >
                    <View
                      style={[
                        styles.trackingCardIcon,
                        {
                          backgroundColor: activeTrackingTabData.iconBackground,
                        },
                      ]}
                    >
                      <ActiveTrackingIcon
                        color={activeTrackingTabData.iconColor}
                        size={28}
                      />
                    </View>
                    <Text
                      style={[
                        styles.trackingCardTitle,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {activeTrackingTabData.label}
                    </Text>
                    <Text
                      style={[
                        styles.trackingCardSubtitle,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {activeTrackingTabData.description}
                    </Text>
                    <TouchableOpacity
                      onPress={activeTrackingTabData.onPress}
                      style={[
                        styles.trackingCardButton,
                        { backgroundColor: activeTrackingTabData.ctaColor },
                      ]}
                    >
                      <ActiveTrackingIcon
                        color={theme.colors.neutral.white}
                        size={16}
                      />
                      <Text
                        style={
                          styles.trackingCardButtonText as StyleProp<TextStyle>
                        }
                      >
                        {activeTrackingTabData.ctaLabel}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}

          {/* Maak One-liner */}
          <View style={styles.onelineCard as ViewStyle}>
            <Text style={[styles.onelineText, isRTL && styles.rtlText]}>
              {isRTL
                ? '"لأن الصحة تبدأ من المنزل"'
                : '"Because health starts at home."'}
            </Text>
          </View>
        </ScrollView>
      </View>
    </GradientScreen>
  );
}

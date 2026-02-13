/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: legacy screen flow kept intact for this batch. */
/* biome-ignore-all lint/style/noNestedTernary: existing localized UI copy branches retained for now. */
/* biome-ignore-all lint/complexity/noForEach: existing iteration style preserved in this file. */
/* biome-ignore-all lint/nursery/noShadow: style factory callback naming follows established local pattern. */
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Activity,
  ArrowLeft,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  Droplet,
  Dumbbell,
  Flame,
  Gauge,
  Heart,
  Info,
  Minus,
  Moon,
  RefreshCw,
  Route,
  Scale,
  TestTube,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react-native";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  type StyleProp,
  Switch,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CoachMark from "@/app/components/CoachMark";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getAllGroups,
  getAvailableMetricsForProvider,
  type HealthMetric,
} from "@/lib/health/healthMetricsCatalog";
import {
  saveProviderConnection,
  syncHealthData,
} from "@/lib/health/healthSync";
import type { ProviderConnection } from "@/lib/health/healthTypes";
import {
  type HealthDataSummary,
  healthDataService,
  type VitalSigns,
} from "@/lib/services/healthDataService";
import { safeFormatNumber, safeFormatTime } from "@/utils/dateFormat";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type VitalCard = {
  key: string;
  title: string;
  titleAr: string;
  icon: ComponentType<{ color?: string; size?: number }>;
  color: string;
  value: string;
  unit: string;
  trend?: "up" | "down" | "stable";
  status?: "normal" | "warning" | "critical";
};

export default function VitalsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string; tour?: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [vitals, setVitals] = useState<VitalSigns | null>(null);
  const [summary, setSummary] = useState<HealthDataSummary | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Health metrics selection state
  const [showMetricSelection, setShowMetricSelection] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    new Set()
  );
  const [availableMetrics, setAvailableMetrics] = useState<HealthMetric[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [healthKitAvailable, setHealthKitAvailable] = useState<boolean | null>(
    null
  );
  const [healthConnectAvailable, setHealthConnectAvailable] = useState<
    boolean | null
  >(null);
  const [availabilityReason, setAvailabilityReason] = useState<
    string | undefined
  >();
  const [authorizing, setAuthorizing] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const syncButtonRef = useRef<View>(null);
  const integrationButtonRef = useRef<View>(null);
  const initialLoadCompleted = useRef(false);
  const INITIAL_LOAD_DELAY_MS = 1500;
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  const isRTL = i18n.language === "ar";

  useEffect(() => {
    if (params.tour === "1") {
      setShowHowTo(true);
    }
  }, [params.tour]);

  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    figmaVitalsHeaderWrap: {
      marginHorizontal: -20,
      marginTop: -20,
      marginBottom: 12,
    },
    figmaVitalsHeaderContent: {
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 16,
    },
    figmaVitalsHeaderRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.spacing.sm,
    },
    figmaVitalsBackButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "rgba(255, 255, 255, 0.5)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    figmaVitalsHeaderTitle: {
      flex: 1,
    },
    figmaVitalsTitleRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.spacing.xs,
      marginBottom: 4,
    },
    figmaVitalsTitle: {
      fontSize: 22,
      fontFamily: "Inter-Bold",
      color: "#FFFFFF",
    },
    figmaVitalsSubtitle: {
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: "rgba(0, 53, 67, 0.85)",
    },
    figmaVitalsHeaderActions: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.spacing.sm,
    },
    figmaVitalsSyncRow: {
      marginTop: theme.spacing.base,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.spacing.xs,
      backgroundColor: "rgba(255, 255, 255, 0.6)",
      alignSelf: "flex-start" as const,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 999,
    },
    figmaVitalsSyncText: {
      fontSize: 12,
      fontFamily: "Inter-SemiBold",
      color: "#003543",
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
    headerActions: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginTop: theme.spacing.base,
    },
    headerButtons: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.spacing.sm,
    },
    helpButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: theme.colors.background.primary,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
    },
    syncInfo: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.spacing.xs,
    },
    syncText: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.tertiary),
    },
    syncButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: theme.colors.primary.main,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      gap: theme.spacing.xs,
    },
    syncButtonText: {
      ...getTextStyle(theme, "caption", "bold", theme.colors.neutral.white),
    },
    content: {
      flex: 1,
    },
    contentInner: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.base,
    },
    permissionCard: {
      backgroundColor: "#FFF4E6", // Light orange background
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.xl,
      margin: theme.spacing.lg,
      alignItems: "center" as const,
      borderWidth: 2,
      borderColor: "#FF8C42", // Orange border
    },
    permissionIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "#FF8C42", // Orange background
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.lg,
    },
    permissionTitle: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.primary.main),
      textAlign: "center" as const,
      marginBottom: theme.spacing.base,
    },
    permissionDescription: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      textAlign: "center" as const,
      lineHeight: 22,
      marginBottom: theme.spacing.xl,
    },
    enableButton: {
      backgroundColor: "#FF8C42", // Orange button
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.base,
      borderRadius: theme.borderRadius.lg,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.spacing.sm,
    },
    enableButtonText: {
      ...getTextStyle(theme, "button", "bold", theme.colors.neutral.white),
    },
    vitalsGrid: {
      paddingTop: theme.spacing.lg,
    },
    vitalsRow: {
      flexDirection: "row" as const,
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    vitalCard: {
      flex: 1,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      ...theme.shadows.md,
      minWidth: 0, // Allow flex items to shrink below content size for proper text wrapping
    },
    vitalHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.md,
    },
    vitalIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    vitalTrend: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 2,
    },
    vitalTitle: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.secondary),
      marginBottom: 4,
    },
    vitalValue: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.text.primary),
      fontSize: 24,
      flexShrink: 1,
    },
    vitalUnit: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.tertiary),
      marginTop: 2,
    },
    statusIndicator: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    },
    statusText: {
      ...getTextStyle(theme, "caption", "medium"),
      fontSize: 12,
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
    onelineCard: {
      backgroundColor: theme.colors.secondary[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginVertical: theme.spacing.lg,
      borderStartWidth: 4,
      borderStartColor: theme.colors.secondary.main,
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
    rtlText: {
      textAlign: "right" as const,
    },
    backButton: {
      position: "absolute",
      left: theme.spacing.lg,
      top: theme.spacing.lg,
      padding: theme.spacing.sm,
      zIndex: 10,
    },
    selectAllSection: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.base,
    },
    selectAllButton: {
      padding: theme.spacing.base,
      borderRadius: theme.borderRadius.md,
      alignItems: "center" as const,
      borderWidth: 1,
    },
    selectAllText: {
      fontSize: 15,
    },
    metricsSection: {
      padding: theme.spacing.lg,
      paddingTop: 0,
    },
    groupCard: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      marginBottom: theme.spacing.base,
      overflow: "hidden" as const,
    },
    groupHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      padding: theme.spacing.base,
    },
    groupHeaderLeft: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      flex: 1,
    },
    groupTitle: {
      fontSize: 17,
      fontWeight: "600",
      marginStart: theme.spacing.base,
    },
    groupTitleRTL: {
      textAlign: "right" as const,
    },
    groupCount: {
      fontSize: 14,
      marginStart: theme.spacing.xs,
    },
    metricsList: {
      paddingHorizontal: theme.spacing.base,
      paddingBottom: theme.spacing.base,
    },
    metricItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      marginTop: theme.spacing.xs,
    },
    metricLeft: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      flex: 1,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginEnd: theme.spacing.base,
    },
    metricInfo: {
      flex: 1,
    },
    metricName: {
      fontSize: 15,
      fontWeight: "500",
      marginBottom: 2,
    },
    metricUnit: {
      fontSize: 13,
    },
    infoSection: {
      padding: theme.spacing.lg,
      paddingTop: 0,
    },
    infoRow: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
    },
    infoText: {
      fontSize: 13,
      lineHeight: 18,
      marginStart: theme.spacing.sm,
      flex: 1,
    },
    ctaSection: {
      padding: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
    },
    primaryButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      padding: theme.spacing.base,
      borderRadius: theme.borderRadius.lg,
    },
    disabledButton: {
      opacity: 0.5,
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 17,
      fontWeight: "600",
      marginEnd: theme.spacing.sm,
    },
  }))(theme);

  const loadVitalsData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        // Check permissions first
        const permissions = await healthDataService.hasHealthPermissions();
        setHasPermissions(permissions);

        if (permissions) {
          // Get latest vitals and summary
          const [vitalsData, summaryData] = await Promise.all([
            healthDataService.getLatestVitals(),
            healthDataService.getHealthSummary(),
          ]);

          setVitals(vitalsData);
          setSummary(summaryData);
          setLastSync(new Date());

          // Automatically sync to Firestore so family members can see the data
          // Only sync if app is active to prevent crashes when backgrounded
          const appState = AppState.currentState;
          if (appState === "active") {
            const provider =
              Platform.OS === "ios" ? "apple_health" : "health_connect";
            syncHealthData(provider).catch(() => {
              // Silently fail - sync is not critical for displaying vitals
            });
          }
        } else {
          // Clear stale vitals when no active provider permissions are found.
          setVitals(null);
          setSummary(null);
          setLastSync(null);
        }

        // Mark initial load as completed
        initialLoadCompleted.current = true;
      } catch (_error) {
        Alert.alert(
          isRTL ? "خطأ" : "Error",
          isRTL
            ? "حدث خطأ في تحميل البيانات الصحية"
            : "Error loading health data"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isRTL]
  );

  useEffect(() => {
    // Small delay to avoid early native-module access while keeping vitals responsive.
    const timer = setTimeout(() => {
      loadVitalsData();
    }, INITIAL_LOAD_DELAY_MS);

    return () => clearTimeout(timer);
  }, [loadVitalsData, INITIAL_LOAD_DELAY_MS]);

  useFocusEffect(
    useCallback(() => {
      // Refresh on re-focus once the initial load flow has completed.
      if (initialLoadCompleted.current) {
        loadVitalsData();
      }
    }, [loadVitalsData])
  );

  const _loadAvailableMetrics = () => {
    if (Platform.OS === "ios") {
      const metrics = getAvailableMetricsForProvider("apple_health");
      setAvailableMetrics(metrics);
      // Expand first group by default
      if (metrics.length > 0) {
        setExpandedGroups(new Set([metrics[0].group]));
      }
    } else if (Platform.OS === "android") {
      const metrics = getAvailableMetricsForProvider("health_connect");
      setAvailableMetrics(metrics);
      // Expand first group by default
      if (metrics.length > 0) {
        setExpandedGroups(new Set([metrics[0].group]));
      }
    }
  };

  const _checkHealthKitAvailability = async () => {
    if (Platform.OS === "ios") {
      try {
        // CRITICAL: Add delay before accessing native modules to prevent crashes
        // Wait for React Native bridge to be fully ready
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay

        // Lazy import to prevent early native module loading
        const { appleHealthService } = await import(
          "@/lib/services/appleHealthService"
        );

        // Retry logic for native bridge readiness
        let availability: { available?: boolean; reason?: string } | null =
          null;
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
          try {
            availability = await appleHealthService.checkAvailability();
            break; // Success, exit retry loop
          } catch (bridgeError: unknown) {
            retries += 1;
            const errorMsg = getErrorMessage(bridgeError, String(bridgeError));
            if (
              (errorMsg.includes("RCTModuleMethod") ||
                errorMsg.includes("invokewithbridge") ||
                errorMsg.includes("invokeWithBridge")) &&
              retries < maxRetries
            ) {
              // Native bridge not ready yet, wait and retry
              await new Promise((resolve) => setTimeout(resolve, 1500));
            } else {
              throw bridgeError; // Re-throw if not a bridge error or max retries reached
            }
          }
        }

        setHealthKitAvailable(availability?.available ?? false);
        setAvailabilityReason(availability?.reason);
      } catch (error: unknown) {
        setHealthKitAvailable(false);
        setAvailabilityReason(
          getErrorMessage(error, "Failed to check HealthKit availability")
        );
      }
    }
  };

  const _checkHealthConnectAvailability = async () => {
    if (Platform.OS === "android") {
      try {
        // Lazy import to prevent early native module loading
        const { healthConnectService } = await import(
          "@/lib/services/healthConnectService"
        );
        const availability = await healthConnectService.checkAvailability();
        setHealthConnectAvailable(availability.available);
        setAvailabilityReason(availability.reason);
      } catch (error: unknown) {
        setHealthConnectAvailable(false);
        setAvailabilityReason(
          getErrorMessage(error, "Failed to check Health Connect availability")
        );
      }
    }
  };

  const _handleEnableHealthData = () => {
    if (Platform.OS === "ios") {
      // Navigate to Apple Health intro screen immediately
      // Don't check availability here to prevent crashes - let the permission screen handle it
      router.push("/(settings)/health/apple");
    } else if (Platform.OS === "android") {
      // Navigate to Health Connect intro screen
      router.push("/(settings)/health/healthconnect");
    } else {
      // For other platforms, use the old flow
      handleEnableHealthDataLegacy();
    }
  };

  const handleEnableHealthDataLegacy = async () => {
    try {
      setLoading(true);
      const granted = await healthDataService.requestHealthPermissions();

      if (granted) {
        setHasPermissions(true);
        await loadVitalsData();
        Alert.alert(
          isRTL ? "تم التفعيل" : "Enabled",
          isRTL
            ? "تم تفعيل دمج البيانات الصحية بنجاح"
            : "Health data integration enabled successfully"
        );
      } else {
        Alert.alert(
          isRTL ? "فشل التفعيل" : "Permission Denied",
          isRTL
            ? "يرجى السماح بالوصول للبيانات الصحية في الإعدادات"
            : "Please allow access to health data in Settings"
        );
      }
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "حدث خطأ في تفعيل دمج البيانات الصحية"
          : "Error enabling health data integration"
      );
    } finally {
      setLoading(false);
    }
  };

  const _toggleMetric = (metricKey: string) => {
    const newSelected = new Set(selectedMetrics);
    if (newSelected.has(metricKey)) {
      newSelected.delete(metricKey);
    } else {
      newSelected.add(metricKey);
    }
    setSelectedMetrics(newSelected);
  };

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  const selectAllMetrics = () => {
    // Use "all" to request all HealthKit types, not just catalog metrics
    setSelectedMetrics(new Set(["all"]));
  };

  const clearAllMetrics = () => {
    setSelectedMetrics(new Set());
  };

  const handleAuthorizeMetrics = async () => {
    if (selectedMetrics.size === 0) {
      Alert.alert(
        isRTL ? "لا توجد مقاييس محددة" : "No Metrics Selected",
        isRTL
          ? "يرجى تحديد مقياس واحد على الأقل للمتابعة"
          : "Please select at least one metric to continue."
      );
      return;
    }

    setAuthorizing(true);
    try {
      let granted: string[] = [];
      let denied: string[] = [];
      let provider: "apple_health" | "health_connect" = "apple_health";

      if (Platform.OS === "ios") {
        // Check availability before proceeding - wrap in try-catch to prevent native crashes
        try {
          // Add extra delay for first-time native module access
          // This ensures the native bridge is fully ready
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Lazy import to prevent early native module loading
          const { appleHealthService } = await import(
            "@/lib/services/appleHealthService"
          );

          // Retry logic for native bridge readiness
          let availability: { available?: boolean; reason?: string } | null =
            null;
          let retries = 0;
          const maxRetries = 3;

          while (retries < maxRetries) {
            try {
              availability = await appleHealthService.checkAvailability();
              break; // Success, exit retry loop
            } catch (bridgeError: unknown) {
              retries += 1;
              const errorMsg = getErrorMessage(
                bridgeError,
                String(bridgeError)
              );
              if (
                (errorMsg.includes("RCTModuleMethod") ||
                  errorMsg.includes("invokewithbridge") ||
                  errorMsg.includes("invokeWithBridge")) &&
                retries < maxRetries
              ) {
                // Native bridge not ready yet, wait and retry
                await new Promise((resolve) => setTimeout(resolve, 1500));
              } else {
                throw bridgeError; // Re-throw if not a bridge error or max retries reached
              }
            }
          }

          if (!availability?.available) {
            Alert.alert(
              isRTL ? "HealthKit غير متاح" : "HealthKit Not Available",
              availability?.reason ||
                (isRTL ? "HealthKit غير متاح." : "HealthKit is not available.")
            );
            return;
          }

          // CRITICAL: Wait for bridge to stabilize after isAvailable() before requesting authorization
          // This prevents RCTModuleMethod invokeWithBridge errors
          await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 second delay

          // Request HealthKit permissions for selected metrics
          // If "all" is selected, request all HealthKit types
          const metricsToRequest = selectedMetrics.has("all")
            ? ["all"]
            : Array.from(selectedMetrics);

          const success = await appleHealthService.authorize(metricsToRequest);
          granted = success ? metricsToRequest : [];
          denied = success ? [] : metricsToRequest;
          provider = "apple_health";
        } catch (healthKitError: unknown) {
          const errorMsg = getErrorMessage(
            healthKitError,
            String(healthKitError)
          );
          const isBridgeError =
            errorMsg.includes("RCTModuleMethod") ||
            errorMsg.includes("invokewithbridge") ||
            errorMsg.includes("invokeWithBridge") ||
            errorMsg.includes("invokeinner") ||
            errorMsg.includes("invokeInner") ||
            errorMsg.toLowerCase().includes("invoke") ||
            errorMsg.includes("bridge");

          Alert.alert(
            isRTL ? "خطأ في HealthKit" : "HealthKit Error",
            isBridgeError
              ? isRTL
                ? "جسر React Native غير جاهز. يرجى المحاولة مرة أخرى بعد بضع ثوانٍ أو إعادة بناء التطبيق."
                : "React Native bridge is not ready. Please try again in a few seconds or rebuild the app."
              : getErrorMessage(healthKitError, "") ||
                  (isRTL
                    ? "فشل الاتصال بـ HealthKit."
                    : "Failed to connect to HealthKit.")
          );
          setAuthorizing(false);
          return;
        }
      } else if (Platform.OS === "android") {
        // Check availability before proceeding - wrap in try-catch
        try {
          // Lazy import to prevent early native module loading
          const { healthConnectService } = await import(
            "@/lib/services/healthConnectService"
          );
          const availability = await healthConnectService.checkAvailability();
          if (!availability.available) {
            Alert.alert(
              isRTL
                ? "Health Connect غير متاح"
                : "Health Connect Not Available",
              availability.reason ||
                (isRTL
                  ? "Health Connect غير متاح. يرجى التأكد من تثبيت تطبيق Health Connect من متجر Play."
                  : "Health Connect is not available. Please ensure Health Connect app is installed from Play Store.")
            );
            // Offer to open Play Store
            if (availability.requiresInstall) {
              Alert.alert(
                isRTL ? "تثبيت Health Connect" : "Install Health Connect",
                isRTL
                  ? "هل تريد فتح متجر Play لتثبيت Health Connect؟"
                  : "Would you like to open Play Store to install Health Connect?",
                [
                  { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
                  {
                    text: isRTL ? "فتح" : "Open",
                    onPress: () => {
                      const installUrl =
                        availability.installUrl ||
                        "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";
                      Linking.openURL(installUrl);
                    },
                  },
                ]
              );
            }
            return;
          }

          // Request Health Connect permissions (reuse healthConnectService from above)
          const { getHealthConnectPermissionsForMetrics } = await import(
            "@/lib/health/healthMetricsCatalog"
          );

          // Expand "all" to actual metric keys
          const allAvailableMetrics = getAvailableMetricsForProvider(
            "health_connect"
          ).map((m) => m.key);
          const expandedSelected = selectedMetrics.has("all")
            ? allAvailableMetrics
            : Array.from(selectedMetrics);

          const _permissions =
            getHealthConnectPermissionsForMetrics(expandedSelected);
          const authorized =
            await healthConnectService.authorize(expandedSelected);

          // Health Connect returns boolean, but we need to map back to permissions
          // For now, if authorized is true, assume all requested permissions were granted
          // In a real implementation, you'd check each permission individually
          granted = authorized ? expandedSelected : [];
          denied = authorized ? [] : expandedSelected;
          provider = "health_connect";
        } catch (healthConnectError: unknown) {
          Alert.alert(
            isRTL ? "خطأ في Health Connect" : "Health Connect Error",
            getErrorMessage(healthConnectError, "") ||
              (isRTL
                ? "فشل الاتصال بـ Health Connect."
                : "Failed to connect to Health Connect.")
          );
          return;
        }
      }

      // Expand "all" to actual metric keys before storing
      // Use the dynamically determined provider instead of hardcoding "apple_health"
      const allAvailableMetrics = getAvailableMetricsForProvider(provider).map(
        (m) => m.key
      );
      const expandedSelected = selectedMetrics.has("all")
        ? allAvailableMetrics
        : Array.from(selectedMetrics);
      const expandedGranted = granted.includes("all")
        ? allAvailableMetrics
        : granted;
      const expandedDenied = denied.includes("all")
        ? allAvailableMetrics // Expand "all" to all available metrics when denied
        : denied;

      // Save connection
      const connection: ProviderConnection = {
        provider,
        connected: expandedGranted.length > 0,
        connectedAt: new Date().toISOString(),
        selectedMetrics: expandedSelected,
        grantedMetrics: expandedGranted,
        deniedMetrics: expandedDenied,
      };

      await saveProviderConnection(connection);

      // Also save permission status to AsyncStorage for backward compatibility
      await healthDataService.savePermissionStatus(expandedGranted.length > 0);

      // Update permissions status using expandedGranted to match the stored connection
      setHasPermissions(expandedGranted.length > 0);
      setShowMetricSelection(false);

      if (expandedGranted.length > 0) {
        await loadVitalsData();
        Alert.alert(
          isRTL ? "تم التفعيل" : "Enabled",
          isRTL
            ? "تم تفعيل دمج البيانات الصحية بنجاح"
            : "Health data integration enabled successfully"
        );
      } else {
        Alert.alert(
          isRTL ? "فشل التفعيل" : "Permission Denied",
          isRTL
            ? "يرجى السماح بالوصول للبيانات الصحية في الإعدادات"
            : "Please allow access to health data in Settings"
        );
      }
    } catch (error: unknown) {
      Alert.alert(
        isRTL ? "خطأ في أذن البيانات الصحية" : "Permission Error",
        getErrorMessage(error, "") ||
          (isRTL
            ? Platform.OS === "ios"
              ? "فشل طلب أذن HealthKit."
              : "فشل طلب أذن Health Connect."
            : Platform.OS === "ios"
              ? "Failed to request HealthKit permissions. Please try again."
              : "Failed to request Health Connect permissions. Please try again.")
      );
    } finally {
      setAuthorizing(false);
    }
  };

  const handleSyncData = async () => {
    try {
      setRefreshing(true);
      await healthDataService.syncHealthData();
      await loadVitalsData(true);
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "حدث خطأ في مزامنة البيانات الصحية"
          : "Error syncing health data"
      );
    }
  };

  const getVitalCards = (): VitalCard[] => {
    if (!(vitals && summary)) {
      return [];
    }

    const _formatted = healthDataService.formatVitalSigns(vitals);
    const cards: VitalCard[] = [];

    // Helper to get value or "N/A"
    const getValue = (
      val: number | undefined,
      formatter: (v: number) => string = (v) => v.toString()
    ): string => (val !== undefined ? formatter(val) : "N/A");

    // Helper to get status
    const getStatus = (
      val: number | undefined,
      check: (v: number) => boolean
    ): "normal" | "warning" => {
      if (val === undefined) {
        return "normal";
      }
      return check(val) ? "warning" : "normal";
    };

    // Heart Rate (1/24)
    // Medical guideline: Normal 60-100 bpm, Needs attention: <60 or >100
    cards.push({
      key: "heartRate",
      title: "Heart Rate",
      titleAr: "معدل ضربات القلب",
      icon: Heart,
      color: theme.colors.accent.error,
      value: getValue(vitals.heartRate),
      unit: "BPM",
      trend: summary.heartRate?.trend || "stable",
      status: getStatus(vitals.heartRate, (v) => v < 60 || v > 100),
    });

    // Steps (2/24)
    cards.push({
      key: "steps",
      title: "Steps Today",
      titleAr: "خطوات اليوم",
      icon: Activity,
      color: theme.colors.primary.main,
      value: getValue(vitals.steps, (v) => {
        // Format large numbers more compactly to prevent truncation
        if (v >= 1_000_000) {
          return `${(v / 1_000_000).toFixed(1)}M`;
        }
        if (v >= 1000) {
          return `${(v / 1000).toFixed(1)}k`;
        }
        return safeFormatNumber(v);
      }),
      unit: "steps",
      trend: "stable",
      status: getStatus(
        vitals.steps,
        (v) => v < (summary.steps?.goal || 10_000)
      ),
    });

    // Sleep (3/24)
    cards.push({
      key: "sleep",
      title: "Sleep Last Night",
      titleAr: "النوم الليلة الماضية",
      icon: Moon,
      color: theme.colors.accent.info,
      value: getValue(vitals.sleepHours, (v) => v.toFixed(1)),
      unit: "hours",
      trend: "stable",
      status: getStatus(vitals.sleepHours, (v) => v < 7),
    });

    // Weight (4/24)
    cards.push({
      key: "weight",
      title: "Weight",
      titleAr: "الوزن",
      icon: Scale,
      color: theme.colors.accent.success,
      value: getValue(vitals.weight, (v) => v.toFixed(1)),
      unit: "kg",
      trend: summary.weight?.trend || "stable",
      status: "normal",
    });

    // Blood Pressure Systolic (5/24)
    // Medical guideline: Normal <120, Needs attention: ≥140
    cards.push({
      key: "bloodPressureSystolic",
      title: "BP Systolic",
      titleAr: "الضغط الانقباضي",
      icon: Gauge,
      color: theme.colors.accent.warning,
      value: vitals.bloodPressure
        ? vitals.bloodPressure.systolic.toString()
        : "N/A",
      unit: "mmHg",
      trend: "stable",
      status: vitals.bloodPressure
        ? vitals.bloodPressure.systolic >= 140
          ? "warning"
          : "normal"
        : "normal",
    });

    // Blood Pressure Diastolic (6/24)
    // Medical guideline: Normal <80, Needs attention: ≥90
    cards.push({
      key: "bloodPressureDiastolic",
      title: "BP Diastolic",
      titleAr: "الضغط الانبساطي",
      icon: Gauge,
      color: theme.colors.accent.warning,
      value: vitals.bloodPressure
        ? vitals.bloodPressure.diastolic.toString()
        : "N/A",
      unit: "mmHg",
      trend: "stable",
      status: vitals.bloodPressure
        ? vitals.bloodPressure.diastolic >= 90
          ? "warning"
          : "normal"
        : "normal",
    });

    // Body Temperature (7/24)
    // Medical guideline: Normal 36.1-37.2°C, Needs attention: <36.1°C (hypothermia) or ≥38°C (fever)
    cards.push({
      key: "bodyTemperature",
      title: "Body Temperature",
      titleAr: "درجة حرارة الجسم",
      icon: Thermometer,
      color: theme.colors.accent.error,
      value: getValue(vitals.bodyTemperature, (v) => v.toFixed(1)),
      unit: "°C",
      trend: "stable",
      status: getStatus(vitals.bodyTemperature, (v) => v >= 38 || v < 36.1),
    });

    // Oxygen Saturation (8/24)
    // Medical guideline: Normal ≥95%, Needs attention: <95%
    cards.push({
      key: "oxygenSaturation",
      title: "Blood Oxygen",
      titleAr: "تشبع الأكسجين",
      icon: Droplet,
      color: theme.colors.accent.info,
      value: getValue(vitals.oxygenSaturation, (v) => v.toFixed(1)),
      unit: "%",
      trend: "stable",
      status: getStatus(vitals.oxygenSaturation, (v) => v < 95),
    });

    // Height (9/24)
    cards.push({
      key: "height",
      title: "Height",
      titleAr: "الطول",
      icon: Activity,
      color: theme.colors.accent.success,
      value: getValue(vitals.height, (v) => (v / 100).toFixed(2)), // Convert cm to m
      unit: "m",
      trend: "stable",
      status: "normal",
    });

    // Resting Heart Rate (10/24)
    // Medical guideline: Normal 60-100 bpm, Needs attention: <60 or >100
    cards.push({
      key: "restingHeartRate",
      title: "Resting Heart Rate",
      titleAr: "معدل ضربات القلب أثناء الراحة",
      icon: Heart,
      color: theme.colors.accent.error,
      value: getValue(vitals.restingHeartRate),
      unit: "BPM",
      trend: "stable",
      status: getStatus(vitals.restingHeartRate, (v) => v < 60 || v > 100),
    });

    // Heart Rate Variability (11/24)
    cards.push({
      key: "heartRateVariability",
      title: "Heart Rate Variability",
      titleAr: "تغير معدل ضربات القلب",
      icon: Activity,
      color: theme.colors.accent.info,
      value: getValue(vitals.heartRateVariability, (v) => v.toFixed(0)),
      unit: "ms",
      trend: "stable",
      status: "normal",
    });

    // Walking Heart Rate Average (12/24)
    cards.push({
      key: "walkingHeartRateAverage",
      title: "Walking Heart Rate",
      titleAr: "معدل ضربات القلب أثناء المشي",
      icon: Activity,
      color: theme.colors.primary.main,
      value: getValue(vitals.walkingHeartRateAverage),
      unit: "BPM",
      trend: "stable",
      status: "normal",
    });

    // Respiratory Rate (13/24)
    // Medical guideline: Normal 12-20/min, Needs attention: <12 or >20
    cards.push({
      key: "respiratoryRate",
      title: "Respiratory Rate",
      titleAr: "معدل التنفس",
      icon: Activity,
      color: theme.colors.accent.info,
      value: getValue(vitals.respiratoryRate, (v) => v.toFixed(1)),
      unit: "breaths/min",
      trend: "stable",
      status: getStatus(vitals.respiratoryRate, (v) => v < 12 || v > 20),
    });

    // Body Mass Index (14/24)
    cards.push({
      key: "bodyMassIndex",
      title: "BMI",
      titleAr: "مؤشر كتلة الجسم",
      icon: Scale,
      color: theme.colors.accent.success,
      value: getValue(vitals.bodyMassIndex, (v) => v.toFixed(1)),
      unit: "kg/m²",
      trend: "stable",
      status: getStatus(vitals.bodyMassIndex, (v) => v > 30 || v < 18.5),
    });

    // Body Fat Percentage (15/24)
    cards.push({
      key: "bodyFatPercentage",
      title: "Body Fat",
      titleAr: "نسبة الدهون في الجسم",
      icon: Scale,
      color: theme.colors.accent.success,
      value: getValue(vitals.bodyFatPercentage, (v) => v.toFixed(1)),
      unit: "%",
      trend: "stable",
      status: "normal",
    });

    // Active Energy (16/24)
    cards.push({
      key: "activeEnergy",
      title: "Active Energy",
      titleAr: "الطاقة النشطة",
      icon: Zap,
      color: theme.colors.accent.warning,
      value: getValue(vitals.activeEnergy, (v) => v.toFixed(0)),
      unit: "kcal",
      trend: "stable",
      status: "normal",
    });

    // Basal Energy (17/24)
    cards.push({
      key: "basalEnergy",
      title: "Basal Energy",
      titleAr: "الطاقة الأساسية",
      icon: Flame,
      color: theme.colors.accent.warning,
      value: getValue(vitals.basalEnergy, (v) => v.toFixed(0)),
      unit: "kcal",
      trend: "stable",
      status: "normal",
    });

    // Distance Walking/Running (18/24)
    cards.push({
      key: "distanceWalkingRunning",
      title: "Distance",
      titleAr: "المسافة",
      icon: Route,
      color: theme.colors.primary.main,
      value: getValue(vitals.distanceWalkingRunning, (v) => v.toFixed(2)),
      unit: "km",
      trend: "stable",
      status: "normal",
    });

    // Flights Climbed (19/24)
    cards.push({
      key: "flightsClimbed",
      title: "Flights Climbed",
      titleAr: "السلالم المتسلقة",
      icon: Activity,
      color: theme.colors.primary.main,
      value: getValue(vitals.flightsClimbed),
      unit: "flights",
      trend: "stable",
      status: "normal",
    });

    // Exercise Minutes (20/24)
    cards.push({
      key: "exerciseMinutes",
      title: "Exercise Time",
      titleAr: "وقت التمرين",
      icon: Dumbbell,
      color: theme.colors.primary.main,
      value: getValue(vitals.exerciseMinutes),
      unit: "min",
      trend: "stable",
      status: getStatus(vitals.exerciseMinutes, (v) => v < 30),
    });

    // Stand Time (21/24)
    cards.push({
      key: "standTime",
      title: "Stand Time",
      titleAr: "وقت الوقوف",
      icon: Clock,
      color: theme.colors.primary.main,
      value: getValue(vitals.standTime),
      unit: "min",
      trend: "stable",
      status: getStatus(vitals.standTime, (v) => v < 60),
    });

    // Workouts (22/24)
    cards.push({
      key: "workouts",
      title: "Workouts",
      titleAr: "التمارين",
      icon: Dumbbell,
      color: theme.colors.primary.main,
      value: getValue(vitals.workouts),
      unit: "sessions",
      trend: "stable",
      status: "normal",
    });

    // Water Intake (23/24)
    cards.push({
      key: "waterIntake",
      title: "Water Intake",
      titleAr: "استهلاك الماء",
      icon: Waves,
      color: theme.colors.accent.info,
      value: getValue(vitals.waterIntake, (v) => v.toFixed(0)),
      unit: "ml",
      trend: "stable",
      status: getStatus(vitals.waterIntake, (v) => v < 2000),
    });

    // Blood Glucose (24/24)
    cards.push({
      key: "bloodGlucose",
      title: "Blood Glucose",
      titleAr: "سكر الدم",
      icon: TestTube,
      color: theme.colors.accent.error,
      value: getValue(vitals.bloodGlucose, (v) => v.toFixed(0)),
      unit: "mg/dL",
      trend: "stable",
      status: getStatus(vitals.bloodGlucose, (v) => v > 140 || v < 70),
    });

    // Sort cards: vitals with data first, then vitals without data (N/A)
    cards.sort((a, b) => {
      const aHasData = a.value !== "N/A";
      const bHasData = b.value !== "N/A";

      if (aHasData && !bHasData) {
        return -1; // a comes first
      }
      if (!aHasData && bHasData) {
        return 1; // b comes first
      }
      return 0; // Keep original order for items with same data status
    });

    return cards;
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case "up":
        return TrendingUp;
      case "down":
        return TrendingDown;
      default:
        return Minus;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "normal":
        return theme.colors.accent.success;
      case "warning":
        return theme.colors.secondary.main;
      case "critical":
        return theme.colors.accent.error;
      default:
        return theme.colors.text.tertiary;
    }
  };

  if (!user) {
    return (
      <SafeAreaView
        edges={["top"]}
        pointerEvents="box-none"
        style={styles.container as ViewStyle}
      >
        <View style={styles.loadingContainer as ViewStyle}>
          <Text style={styles.loadingText as StyleProp<TextStyle>}>
            Please log in to view vitals
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show pre-permission metric selection screen for iOS/Android when permissions not granted
  // This is shown BEFORE the iOS HealthKit permission screen
  if (
    !hasPermissions &&
    (Platform.OS === "ios" || Platform.OS === "android") &&
    showMetricSelection
  ) {
    const groups = getAllGroups();
    const allSelected =
      selectedMetrics.has("all") ||
      selectedMetrics.size === availableMetrics.length;

    // Show error if HealthKit/Health Connect is not available
    if (
      (Platform.OS === "ios" && healthKitAvailable === false) ||
      (Platform.OS === "android" && healthConnectAvailable === false)
    ) {
      return (
        <SafeAreaView
          edges={["top"]}
          pointerEvents="box-none"
          style={styles.container as ViewStyle}
        >
          <View
            style={
              [
                styles.header,
                {
                  position: "relative" as const,
                  alignItems: "center" as const,
                },
              ] as StyleProp<ViewStyle>
            }
          >
            <TouchableOpacity
              onPress={() => setShowMetricSelection(false)}
              style={styles.backButton as ViewStyle}
            >
              <ChevronRight
                color={theme.colors.text.primary}
                size={24}
                style={{ transform: [{ rotate: isRTL ? "0deg" : "180deg" }] }}
              />
            </TouchableOpacity>
            <Heart color={theme.colors.primary.main} size={48} />
            <Text
              style={
                [
                  styles.headerTitle,
                  isRTL && styles.rtlText,
                  { marginTop: theme.spacing.base },
                ] as StyleProp<TextStyle>
              }
            >
              {isRTL
                ? Platform.OS === "ios"
                  ? "HealthKit غير متاح"
                  : "Health Connect غير متاح"
                : Platform.OS === "ios"
                  ? "HealthKit Not Available"
                  : "Health Connect Not Available"}
            </Text>
          </View>
          <View style={styles.permissionCard as ViewStyle}>
            <Text
              style={
                [
                  styles.permissionDescription,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {availabilityReason ||
                (isRTL ? "HealthKit غير متاح" : "HealthKit is not available")}
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView
        edges={["top"]}
        pointerEvents="box-none"
        style={styles.container as ViewStyle}
      >
        <ScrollView
          contentContainerStyle={styles.contentInner as ViewStyle}
          showsVerticalScrollIndicator={false}
          style={styles.content as ViewStyle}
        >
          {/* Header */}
          <View
            style={
              [
                styles.header,
                {
                  position: "relative" as const,
                  alignItems: "center" as const,
                },
              ] as StyleProp<ViewStyle>
            }
          >
            <TouchableOpacity
              onPress={() => setShowMetricSelection(false)}
              style={styles.backButton as ViewStyle}
            >
              <ChevronRight
                color={theme.colors.text.primary}
                size={24}
                style={{ transform: [{ rotate: isRTL ? "0deg" : "180deg" }] }}
              />
            </TouchableOpacity>
            <Heart color={theme.colors.primary.main} size={48} />
            <Text
              style={
                [
                  styles.headerTitle,
                  isRTL && styles.rtlText,
                  { marginTop: theme.spacing.base },
                ] as StyleProp<TextStyle>
              }
            >
              {isRTL ? "اختر المقاييس" : "Select Metrics"}
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
                ? Platform.OS === "ios"
                  ? "اختر المقاييس الصحية التي تريد الوصول إليها. سيتم عرض شاشة أذونات iOS بعد ذلك."
                  : "اختر المقاييس الصحية التي تريد مزامنتها من Health Connect"
                : Platform.OS === "ios"
                  ? "Select which health metrics you want to access. The iOS permission screen will appear next."
                  : "Choose which health metrics to sync from Health Connect"}
            </Text>
          </View>

          {/* Select All Toggle */}
          <View style={styles.selectAllSection as ViewStyle}>
            <TouchableOpacity
              onPress={allSelected ? clearAllMetrics : selectAllMetrics}
              style={
                [
                  styles.selectAllButton,
                  {
                    backgroundColor: allSelected
                      ? "#FF8C4220" // Light orange when selected
                      : "#FFF4E6", // Light orange background
                    borderWidth: 1,
                    borderColor: "#FF8C42", // Orange border
                  },
                ] as StyleProp<ViewStyle>
              }
            >
              <Text
                style={
                  [
                    styles.selectAllText,
                    {
                      color: allSelected
                        ? theme.colors.primary.main
                        : theme.colors.text.primary,
                      fontWeight: allSelected ? "600" : "500",
                    },
                  ] as StyleProp<TextStyle>
                }
              >
                {allSelected
                  ? isRTL
                    ? "✓ تم تحديد الكل"
                    : "✓ All Selected"
                  : isRTL
                    ? "تحديد الكل"
                    : "Select All"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Metric Groups */}
          <View style={styles.metricsSection as ViewStyle}>
            {groups.map((group) => {
              const groupMetrics = availableMetrics.filter(
                (m) => m.group === group
              );
              if (groupMetrics.length === 0) {
                return null;
              }

              const isExpanded = expandedGroups.has(group);
              const groupSelected = groupMetrics.every((m) =>
                selectedMetrics.has(m.key)
              );
              const _someSelected = groupMetrics.some((m) =>
                selectedMetrics.has(m.key)
              );

              return (
                <View
                  key={group}
                  style={
                    [
                      styles.groupCard,
                      {
                        backgroundColor: "#FFF4E6", // Light orange background
                        borderColor: "#FF8C42", // Orange border
                      },
                    ] as StyleProp<ViewStyle>
                  }
                >
                  {/* Group Header */}
                  <TouchableOpacity
                    onPress={() => toggleGroup(group)}
                    style={styles.groupHeader as ViewStyle}
                  >
                    <View style={styles.groupHeaderLeft as ViewStyle}>
                      <Switch
                        onValueChange={(value) => {
                          const newSelected = new Set(selectedMetrics);
                          // Remove "all" if selecting individual groups
                          newSelected.delete("all");
                          groupMetrics.forEach((m) => {
                            if (value) {
                              newSelected.add(m.key);
                            } else {
                              newSelected.delete(m.key);
                            }
                          });
                          setSelectedMetrics(newSelected);
                        }}
                        thumbColor="#FFFFFF"
                        trackColor={{
                          false: "#E0E0E0",
                          true: "#FF8C42", // Orange when on
                        }}
                        value={groupSelected}
                      />
                      <Text
                        style={
                          [
                            styles.groupTitle,
                            { color: theme.colors.text.primary },
                            isRTL && styles.groupTitleRTL,
                            isRTL && styles.rtlText,
                          ] as StyleProp<TextStyle>
                        }
                      >
                        {t(`healthMetrics.${group}`)}
                      </Text>
                      <Text
                        style={
                          [
                            styles.groupCount,
                            { color: theme.colors.text.secondary },
                          ] as StyleProp<TextStyle>
                        }
                      >
                        ({groupMetrics.length})
                      </Text>
                    </View>
                    <ChevronRight
                      color={theme.colors.text.secondary}
                      size={20}
                      style={{
                        transform: [{ rotate: isExpanded ? "90deg" : "0deg" }],
                      }}
                    />
                  </TouchableOpacity>

                  {/* Group Metrics */}
                  {isExpanded ? (
                    <View style={styles.metricsList as ViewStyle}>
                      {groupMetrics.map((metric) => {
                        const isSelected = selectedMetrics.has(metric.key);
                        return (
                          <TouchableOpacity
                            key={metric.key}
                            onPress={() => {
                              const newSelected = new Set(selectedMetrics);
                              // Remove "all" if selecting individual metrics
                              newSelected.delete("all");
                              if (newSelected.has(metric.key)) {
                                newSelected.delete(metric.key);
                              } else {
                                newSelected.add(metric.key);
                              }
                              setSelectedMetrics(newSelected);
                            }}
                            style={
                              [
                                styles.metricItem,
                                isSelected && {
                                  backgroundColor: "#FF8C4220", // Light orange when selected
                                },
                              ] as StyleProp<ViewStyle>
                            }
                          >
                            <View style={styles.metricLeft as ViewStyle}>
                              {isSelected ? (
                                <View
                                  style={
                                    [
                                      styles.checkbox,
                                      { backgroundColor: "#FF8C42" }, // Orange checkbox
                                    ] as StyleProp<ViewStyle>
                                  }
                                >
                                  <Check color="#FFFFFF" size={14} />
                                </View>
                              ) : (
                                <View
                                  style={
                                    [
                                      styles.checkbox,
                                      {
                                        borderColor: "#FF8C42", // Orange border
                                      },
                                    ] as StyleProp<ViewStyle>
                                  }
                                />
                              )}
                              <View style={styles.metricInfo as ViewStyle}>
                                <Text
                                  style={
                                    [
                                      styles.metricName,
                                      { color: theme.colors.text.primary },
                                      isRTL && styles.rtlText,
                                    ] as StyleProp<TextStyle>
                                  }
                                >
                                  {t(`healthMetrics.${metric.key}`) ||
                                    metric.displayName}
                                </Text>
                                {metric.unit ? (
                                  <Text
                                    style={
                                      [
                                        styles.metricUnit,
                                        { color: theme.colors.text.secondary },
                                      ] as StyleProp<TextStyle>
                                    }
                                  >
                                    {metric.unit}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                            {/* Remove "all" if selecting individual metrics */}
                            {selectedMetrics.has("all") ? (
                              <TouchableOpacity
                                onPress={() => {
                                  const newSelected = new Set(selectedMetrics);
                                  newSelected.delete("all");
                                  newSelected.add(metric.key);
                                  setSelectedMetrics(newSelected);
                                }}
                                style={{ padding: 4 }}
                              >
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: theme.colors.primary.main,
                                  }}
                                >
                                  {isRTL ? "اختر" : "Select"}
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* Info */}
          <View style={styles.infoSection as ViewStyle}>
            <View style={styles.infoRow as ViewStyle}>
              <Info color={theme.colors.text.secondary} size={16} />
              <Text
                style={
                  [
                    styles.infoText,
                    { color: theme.colors.text.secondary },
                  ] as StyleProp<TextStyle>
                }
              >
                {isRTL
                  ? Platform.OS === "ios"
                    ? 'بعد النقر على "تفويض"، ستظهر شاشة أذن البيانات الصحية على iOS حيث يمكنك اختيار المقاييس المحددة. يمكنك تغيير اذن البيانات الصحية لاحقًا في إعدادات iOS → الخصوصية والأمان → الصحة'
                    : "يمكنك تغيير اذن البيانات الصحية لاحقًا في تطبيق Health Connect → الاذونات"
                  : Platform.OS === "ios"
                    ? 'After clicking "Authorize", the iOS permission screen will appear where you can grant access to the selected metrics. You can change these permissions later in iOS Settings → Privacy & Security → Health'
                    : "You can change these permissions later in the Health Connect app → Permissions"}
              </Text>
            </View>
          </View>

          {/* CTA */}
          <View style={styles.ctaSection as ViewStyle}>
            <TouchableOpacity
              disabled={authorizing || selectedMetrics.size === 0}
              onPress={handleAuthorizeMetrics}
              style={
                [
                  styles.primaryButton,
                  {
                    backgroundColor:
                      selectedMetrics.size > 0
                        ? "#FF8C42" // Orange button
                        : "#CCCCCC", // Gray when disabled
                  },
                  selectedMetrics.size === 0 && styles.disabledButton,
                ] as StyleProp<ViewStyle>
              }
            >
              {authorizing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text
                    style={styles.primaryButtonText as StyleProp<TextStyle>}
                  >
                    {isRTL
                      ? selectedMetrics.has("all")
                        ? "تفويض جميع المقاييس"
                        : `تفويض ${selectedMetrics.size} مقياس`
                      : selectedMetrics.has("all")
                        ? "Authorize All Metrics"
                        : `Authorize ${selectedMetrics.size} Metric${selectedMetrics.size !== 1 ? "s" : ""}`}
                  </Text>
                  <ChevronRight color="#FFFFFF" size={20} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Show simple permission card for Android or when not showing metric selection
  if (!hasPermissions) {
    return (
      <SafeAreaView
        edges={["top"]}
        pointerEvents="box-none"
        style={styles.container as ViewStyle}
      >
        <View style={styles.permissionCard as ViewStyle}>
          <View
            style={{ alignSelf: "flex-end", marginBottom: theme.spacing.sm }}
          >
            <TouchableOpacity
              onPress={() => setShowHowTo(true)}
              style={styles.helpButton as ViewStyle}
            >
              <Info color={theme.colors.text.secondary} size={18} />
            </TouchableOpacity>
          </View>
          <View style={styles.permissionIcon as ViewStyle}>
            <Heart color={theme.colors.neutral.white} size={40} />
          </View>
          <Text
            style={
              [
                styles.permissionTitle,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            {isRTL ? "دمج البيانات الصحية" : "Health Data Integration"}
          </Text>
          <Text
            style={
              [
                styles.permissionDescription,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            {isRTL
              ? `ادمج بياناتك الصحية من ${Platform.OS === "ios" ? "تطبيق الصحة" : "Health Connect"} لمراقبة أفضل لصحتك ومعرفة المؤشرات الحيوية`
              : `Connect your health data from ${Platform.OS === "ios" ? "Health App" : "Health Connect"} to get comprehensive health monitoring and vital signs tracking`}
          </Text>
          <View collapsable={false} ref={integrationButtonRef}>
            <TouchableOpacity
              disabled={authorizing || loading}
              onPress={() => {
                // Navigate to health integrations section in profile
                router.push("/profile/health-integrations");
              }}
              style={styles.enableButton as ViewStyle}
            >
              {authorizing || loading ? (
                <ActivityIndicator
                  color={theme.colors.neutral.white}
                  size="small"
                />
              ) : (
                <Heart color={theme.colors.neutral.white} size={20} />
              )}
              <Text style={styles.enableButtonText as StyleProp<TextStyle>}>
                {isRTL ? "إعداد التكامل" : "Set Up Integration"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text
            style={
              [
                styles.permissionDescription,
                { marginTop: theme.spacing.lg, fontSize: 12 },
              ] as StyleProp<TextStyle>
            }
          >
            {isRTL
              ? "انقر للانتقال إلى إعدادات التكامل الصحية في الملف الشخصي"
              : "Click to go to Health Integrations in your profile settings"}
          </Text>
        </View>
        <CoachMark
          body={
            isRTL
              ? "اضغط هنا لإضافة تكامل البيانات الصحية وتفعيل مزامنة المؤشرات الحيوية."
              : "Tap here to add health integrations and enable vitals sync."
          }
          isRTL={isRTL}
          onClose={() => setShowHowTo(false)}
          onPrimaryAction={() => router.push("/profile/health-integrations")}
          primaryActionLabel={isRTL ? "افتح الإعدادات" : "Open setup"}
          secondaryActionLabel={isRTL ? "تم" : "Got it"}
          targetRef={integrationButtonRef}
          title={
            isRTL ? "تكامل المؤشرات الحيوية" : "Health vitals integrations"
          }
          visible={showHowTo}
        />
      </SafeAreaView>
    );
  }

  const vitalCards = getVitalCards();

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container as ViewStyle}
    >
      {/* Header */}
      <View style={styles.figmaVitalsHeaderWrap as ViewStyle}>
        <WavyBackground curve="home" height={210} variant="teal">
          <View style={styles.figmaVitalsHeaderContent as ViewStyle}>
            <View style={styles.figmaVitalsHeaderRow as ViewStyle}>
              <TouchableOpacity
                onPress={() =>
                  params.returnTo === "track"
                    ? router.push("/(tabs)/track")
                    : router.back()
                }
                style={styles.figmaVitalsBackButton as ViewStyle}
              >
                <ArrowLeft color="#003543" size={20} />
              </TouchableOpacity>
              <View style={styles.figmaVitalsHeaderTitle as ViewStyle}>
                <View style={styles.figmaVitalsTitleRow as ViewStyle}>
                  <Activity color="#0F766E" size={20} />
                  <Text style={styles.figmaVitalsTitle as TextStyle}>
                    Vital Signs
                  </Text>
                </View>
                <Text style={styles.figmaVitalsSubtitle as TextStyle}>
                  Monitor your health from multiple sources
                </Text>
              </View>
              <View style={styles.figmaVitalsHeaderActions as ViewStyle}>
                <TouchableOpacity
                  onPress={() => setShowHowTo(true)}
                  style={styles.helpButton as ViewStyle}
                >
                  <Info color={theme.colors.text.secondary} size={18} />
                </TouchableOpacity>
                <View collapsable={false} ref={syncButtonRef}>
                  <TouchableOpacity
                    disabled={refreshing}
                    onPress={handleSyncData}
                    style={styles.syncButton as ViewStyle}
                  >
                    {refreshing ? (
                      <ActivityIndicator
                        color={theme.colors.neutral.white}
                        size="small"
                      />
                    ) : (
                      <RefreshCw color={theme.colors.neutral.white} size={16} />
                    )}
                    <Text style={styles.syncButtonText as StyleProp<TextStyle>}>
                      {refreshing ? "Syncing..." : "Sync"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            {lastSync ? (
              <View style={styles.figmaVitalsSyncRow as ViewStyle}>
                <CheckCircle color="#0F766E" size={12} />
                <Text style={styles.figmaVitalsSyncText as TextStyle}>
                  Last sync:{" "}
                  {safeFormatTime(lastSync, "en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            ) : null}
          </View>
        </WavyBackground>
      </View>

      <ScrollView
        contentContainerStyle={styles.contentInner as ViewStyle}
        refreshControl={
          <RefreshControl
            onRefresh={() => loadVitalsData(true)}
            refreshing={refreshing}
            tintColor={theme.colors.primary.main}
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.content as ViewStyle}
      >
        {loading ? (
          <View style={styles.inlineLoadingContainer as ViewStyle}>
            <ActivityIndicator color={theme.colors.primary.main} size="small" />
            <Text
              style={
                [
                  styles.loadingText,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {isRTL
                ? "جاري تحميل البيانات الصحية..."
                : "Loading health data..."}
            </Text>
          </View>
        ) : null}
        {/* Vitals Grid */}
        <View style={styles.vitalsGrid as ViewStyle}>
          {/* Render all vital cards dynamically in rows of 2 */}
          {Array.from({ length: Math.ceil(vitalCards.length / 2) }).map(
            (_, rowIndex) => {
              const startIndex = rowIndex * 2;
              const rowCards = vitalCards.slice(startIndex, startIndex + 2);

              return (
                <View
                  key={rowCards.map((card) => card.key).join("-")}
                  style={styles.vitalsRow as ViewStyle}
                >
                  {rowCards.map((vital) => {
                    const IconComponent = vital.icon;
                    const TrendIcon = getTrendIcon(vital.trend);
                    return (
                      <View
                        key={vital.key}
                        style={[styles.vitalCard] as StyleProp<ViewStyle>}
                      >
                        <View style={styles.vitalHeader as ViewStyle}>
                          <View
                            style={
                              [
                                styles.vitalIcon,
                                { backgroundColor: `${vital.color}20` },
                              ] as StyleProp<ViewStyle>
                            }
                          >
                            <IconComponent color={vital.color} size={20} />
                          </View>
                          <View style={styles.vitalTrend as ViewStyle}>
                            <TrendIcon
                              color={getStatusColor(vital.status)}
                              size={12}
                            />
                          </View>
                        </View>

                        <Text
                          style={
                            [
                              styles.vitalTitle,
                              isRTL && styles.rtlText,
                            ] as StyleProp<TextStyle>
                          }
                        >
                          {isRTL ? vital.titleAr : vital.title}
                        </Text>

                        <View style={{ flexShrink: 1, minWidth: 0 }}>
                          <Text
                            adjustsFontSizeToFit={true}
                            minimumFontScale={0.6}
                            numberOfLines={3}
                            style={
                              [
                                styles.vitalValue,
                                isRTL && styles.rtlText,
                              ] as StyleProp<TextStyle>
                            }
                          >
                            {vital.value}
                          </Text>
                        </View>

                        <Text
                          style={
                            [
                              styles.vitalUnit,
                              isRTL && styles.rtlText,
                            ] as StyleProp<TextStyle>
                          }
                        >
                          {vital.unit}
                        </Text>

                        <View style={styles.statusIndicator as ViewStyle}>
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: getStatusColor(vital.status),
                            }}
                          />
                          <Text
                            style={
                              [
                                styles.statusText,
                                { color: getStatusColor(vital.status) },
                                isRTL && styles.rtlText,
                              ] as StyleProp<TextStyle>
                            }
                          >
                            {vital.status === "normal"
                              ? isRTL
                                ? "طبيعي"
                                : "Normal"
                              : vital.status === "warning"
                                ? isRTL
                                  ? "انتباه"
                                  : "Attention"
                                : isRTL
                                  ? "خطر"
                                  : "Critical"}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            }
          )}
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
            {isRTL ? '"خليهم دايمًا معك"' : '"Health starts at home"'}
          </Text>
          <Text
            style={
              [
                styles.onelineSource,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            - Maak
          </Text>
        </View>
      </ScrollView>
      <CoachMark
        body={
          isRTL
            ? "اضغط هنا لمزامنة أحدث المؤشرات الحيوية من مصادر الصحة."
            : "Tap here to sync the latest vitals from your health sources."
        }
        isRTL={isRTL}
        onClose={() => setShowHowTo(false)}
        secondaryActionLabel={isRTL ? "تم" : "Got it"}
        targetRef={syncButtonRef}
        title={isRTL ? "مزامنة المؤشرات الحيوية" : "Sync health vitals"}
        visible={showHowTo}
      />
    </GradientScreen>
  );
}

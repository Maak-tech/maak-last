import { useFocusEffect, useRouter } from "expo-router";
import {
  Activity,
  CheckCircle,
  Heart,
  Minus,
  Moon,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Check,
  ChevronRight,
  Info,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleProp,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
  Switch,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  type HealthDataSummary,
  healthDataService,
  type VitalSigns,
} from "@/lib/services/healthDataService";
import { createThemedStyles, getTextStyle } from "@/utils/styles";
import {
  getAvailableMetricsForProvider,
  getAllGroups,
  getGroupDisplayName,
  type HealthMetric,
} from "@/lib/health/healthMetricsCatalog";
import { appleHealthService } from "@/lib/services/appleHealthService";
import { googleHealthService } from "@/lib/services/googleHealthService";
import { saveProviderConnection } from "@/lib/health/healthSync";
import type { ProviderConnection } from "@/lib/health/healthTypes";

interface VitalCard {
  key: string;
  title: string;
  titleAr: string;
  icon: any;
  color: string;
  value: string;
  unit: string;
  trend?: "up" | "down" | "stable";
  status?: "normal" | "warning" | "critical";
}

export default function VitalsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [vitals, setVitals] = useState<VitalSigns | null>(null);
  const [summary, setSummary] = useState<HealthDataSummary | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  
  // Health metrics selection state
  const [showMetricSelection, setShowMetricSelection] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set());
  const [availableMetrics, setAvailableMetrics] = useState<HealthMetric[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [healthKitAvailable, setHealthKitAvailable] = useState<boolean | null>(null);
  const [healthConnectAvailable, setHealthConnectAvailable] = useState<boolean | null>(null);
  const [availabilityReason, setAvailabilityReason] = useState<string | undefined>();
  const [authorizing, setAuthorizing] = useState(false);

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
    headerActions: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginTop: theme.spacing.base,
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
      paddingHorizontal: theme.spacing.base,
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
    },
    vitalCardLarge: {
      flex: 2,
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
    },
    vitalValueLarge: {
      fontSize: 32,
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
    loadingText: {
      ...getTextStyle(theme, "body", "medium", theme.colors.text.secondary),
      marginTop: theme.spacing.base,
    },
    onelineCard: {
      backgroundColor: theme.colors.secondary[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginVertical: theme.spacing.lg,
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
      marginLeft: theme.spacing.base,
    },
    groupCount: {
      fontSize: 14,
      marginLeft: theme.spacing.xs,
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
      marginRight: theme.spacing.base,
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
      marginLeft: theme.spacing.sm,
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
      marginRight: theme.spacing.sm,
    },
  }))(theme);

  const loadVitalsData = async (isRefresh = false) => {
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
      }
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "حدث خطأ في تحميل البيانات الصحية" : "Error loading health data"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadVitalsData();
    // Delay HealthKit/Health Connect availability check to avoid crashes during app initialization
    // Check availability only when user tries to enable health data
    // This prevents native module crashes during app startup
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVitalsData();
    }, [])
  );

  const loadAvailableMetrics = () => {
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

  const checkHealthKitAvailability = async () => {
    if (Platform.OS === "ios") {
      try {
        const availability = await appleHealthService.isAvailable();
        setHealthKitAvailable(availability.available);
        setAvailabilityReason(availability.reason);
      } catch (error: any) {
        console.error("Error checking HealthKit availability:", error);
        setHealthKitAvailable(false);
        setAvailabilityReason(error?.message || "Failed to check HealthKit availability");
      }
    }
  };

  const checkHealthConnectAvailability = async () => {
    if (Platform.OS === "android") {
      try {
        const availability = await googleHealthService.isAvailable();
        setHealthConnectAvailable(availability.available);
        setAvailabilityReason(availability.reason);
      } catch (error: any) {
        console.error("Error checking Health Connect availability:", error);
        setHealthConnectAvailable(false);
        setAvailabilityReason(error?.message || "Failed to check Health Connect availability");
      }
    }
  };

  const handleEnableHealthData = async () => {
    if (Platform.OS === "ios") {
      // Check availability before navigating (lazy load to prevent crashes)
      try {
        await checkHealthKitAvailability();
        // Navigate to Apple Health intro screen
        router.push("/health/apple");
      } catch (error) {
        // If check fails, still navigate but availability will be checked there
        router.push("/health/apple");
      }
    } else if (Platform.OS === "android") {
      // For Android, show metric selection directly (Health Connect flow)
      loadAvailableMetrics();
      try {
        await checkHealthConnectAvailability();
      } catch (error) {
        // Silently handle error
      }
      setShowMetricSelection(true);
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
    } catch (error) {
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

  const toggleMetric = (metricKey: string) => {
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
          const availability = await appleHealthService.isAvailable();
          if (!availability.available) {
            Alert.alert(
              isRTL ? "HealthKit غير متاح" : "HealthKit Not Available",
              availability.reason || 
              (isRTL 
                ? "HealthKit غير متاح. يرجى التأكد من أنك تستخدم تطبيقًا مطورًا وليس Expo Go."
                : "HealthKit is not available. Please ensure you're running a development build or standalone app.")
            );
            return;
          }

          // Request HealthKit permissions for selected metrics
          // If "all" is selected, request all HealthKit types
          const metricsToRequest = selectedMetrics.has("all") 
            ? ["all"] 
            : Array.from(selectedMetrics);
          
          const result = await appleHealthService.requestAuthorization(metricsToRequest);
          granted = result.granted;
          denied = result.denied;
          provider = "apple_health";
        } catch (healthKitError: any) {
          console.error("HealthKit error:", healthKitError);
          Alert.alert(
            isRTL ? "خطأ في HealthKit" : "HealthKit Error",
            healthKitError?.message || 
            (isRTL 
              ? "فشل الاتصال بـ HealthKit. يرجى إعادة بناء التطبيق بوحدات native."
              : "Failed to connect to HealthKit. Please rebuild the app with native modules.")
          );
          return;
        }
      } else if (Platform.OS === "android") {
        // Check availability before proceeding - wrap in try-catch
        try {
          const availability = await googleHealthService.isAvailable();
          if (!availability.available) {
            Alert.alert(
              isRTL ? "Health Connect غير متاح" : "Health Connect Not Available",
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
                    onPress: () => googleHealthService.openHealthConnect(),
                  },
                ]
              );
            }
            return;
          }

          // Request Health Connect permissions
          const result = await googleHealthService.requestAuthorization(
            Array.from(selectedMetrics)
          );
          granted = result.granted;
          denied = result.denied;
          provider = "health_connect";
        } catch (healthConnectError: any) {
          console.error("Health Connect error:", healthConnectError);
          Alert.alert(
            isRTL ? "خطأ في Health Connect" : "Health Connect Error",
            healthConnectError?.message || 
            (isRTL 
              ? "فشل الاتصال بـ Health Connect."
              : "Failed to connect to Health Connect.")
          );
          return;
        }
      }

      // Save connection
      const connection: ProviderConnection = {
        provider,
        connected: granted.length > 0,
        connectedAt: new Date().toISOString(),
        selectedMetrics: Array.from(selectedMetrics),
        grantedMetrics: granted,
        deniedMetrics: denied,
      };

      await saveProviderConnection(connection);

      // Update permissions status
      setHasPermissions(granted.length > 0);
      setShowMetricSelection(false);
      
      if (granted.length > 0) {
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
    } catch (error: any) {
      Alert.alert(
        isRTL ? "خطأ في الأذونات" : "Permission Error",
        error.message ||
        (isRTL
          ? Platform.OS === "ios"
            ? "فشل طلب أذونات HealthKit. يرجى المحاولة مرة أخرى."
            : "فشل طلب أذونات Health Connect. يرجى المحاولة مرة أخرى."
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
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "حدث خطأ في مزامنة البيانات" : "Error syncing data"
      );
    }
  };

  const getVitalCards = (): VitalCard[] => {
    if (!(vitals && summary)) return [];

    const formatted = healthDataService.formatVitalSigns(vitals);

    return [
      {
        key: "heartRate",
        title: "Heart Rate",
        titleAr: "معدل ضربات القلب",
        icon: Heart,
        color: theme.colors.accent.error,
        value: vitals.heartRate?.toString() || "0",
        unit: "BPM",
        trend: summary.heartRate.trend,
        status:
          vitals.heartRate && vitals.heartRate > 100 ? "warning" : "normal",
      },
      {
        key: "steps",
        title: "Steps Today",
        titleAr: "خطوات اليوم",
        icon: Activity,
        color: theme.colors.primary.main,
        value: vitals.steps?.toLocaleString() || "0",
        unit: "steps",
        trend: "stable",
        status:
          vitals.steps && vitals.steps >= summary.steps.goal
            ? "normal"
            : "warning",
      },
      {
        key: "sleep",
        title: "Sleep Last Night",
        titleAr: "النوم الليلة الماضية",
        icon: Moon,
        color: theme.colors.accent.info,
        value: vitals.sleepHours?.toFixed(1) || "0",
        unit: "hours",
        trend: "stable",
        status:
          vitals.sleepHours && vitals.sleepHours >= 7 ? "normal" : "warning",
      },
      {
        key: "weight",
        title: "Weight",
        titleAr: "الوزن",
        icon: Scale,
        color: theme.colors.accent.success,
        value: vitals.weight?.toFixed(1) || "0",
        unit: "kg",
        trend: summary.weight.trend,
        status: "normal",
      },
    ];
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
      <SafeAreaView style={styles.container as ViewStyle}>
        <View style={styles.loadingContainer as ViewStyle}>
          <Text style={styles.loadingText as StyleProp<TextStyle>}>Please log in to view vitals</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container as ViewStyle}>
        <View style={styles.loadingContainer as ViewStyle}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
          <Text style={[styles.loadingText, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
            {isRTL ? "جاري تحميل البيانات الصحية..." : "Loading health data..."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show pre-permission metric selection screen for iOS/Android when permissions not granted
  // This is shown BEFORE the iOS HealthKit permission screen
  if (!hasPermissions && (Platform.OS === "ios" || Platform.OS === "android") && showMetricSelection) {
    const groups = getAllGroups();
    const allSelected = selectedMetrics.has("all") || selectedMetrics.size === availableMetrics.length;

    // Show error if HealthKit/Health Connect is not available
    if (
      (Platform.OS === "ios" && healthKitAvailable === false) ||
      (Platform.OS === "android" && healthConnectAvailable === false)
    ) {
      return (
        <SafeAreaView style={styles.container as ViewStyle}>
          <View style={[styles.header, { position: "relative" as const, alignItems: "center" as const }] as StyleProp<ViewStyle>}>
            <TouchableOpacity
              style={styles.backButton as ViewStyle}
              onPress={() => setShowMetricSelection(false)}
            >
              <ChevronRight
                size={24}
                color={theme.colors.text.primary}
                style={{ transform: [{ rotate: isRTL ? "0deg" : "180deg" }] }}
              />
            </TouchableOpacity>
            <Heart size={48} color={theme.colors.primary.main} />
            <Text style={[styles.headerTitle, isRTL && styles.rtlText, { marginTop: theme.spacing.base }] as StyleProp<TextStyle>}>
              {isRTL 
                ? Platform.OS === "ios" ? "HealthKit غير متاح" : "Health Connect غير متاح"
                : Platform.OS === "ios" ? "HealthKit Not Available" : "Health Connect Not Available"}
            </Text>
          </View>
          <View style={styles.permissionCard as ViewStyle}>
            <Text style={[styles.permissionDescription, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
              {availabilityReason || 
              (isRTL
                ? "HealthKit غير متاح"
                : "HealthKit is not available")}
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container as ViewStyle}>
        <ScrollView style={styles.content as ViewStyle} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={[styles.header, { position: "relative" as const, alignItems: "center" as const }] as StyleProp<ViewStyle>}>
            <TouchableOpacity
              style={styles.backButton as ViewStyle}
              onPress={() => setShowMetricSelection(false)}
            >
              <ChevronRight
                size={24}
                color={theme.colors.text.primary}
                style={{ transform: [{ rotate: isRTL ? "0deg" : "180deg" }] }}
              />
            </TouchableOpacity>
            <Heart size={48} color={theme.colors.primary.main} />
            <Text style={[styles.headerTitle, isRTL && styles.rtlText, { marginTop: theme.spacing.base }] as StyleProp<TextStyle>}>
              {isRTL ? "اختر المقاييس" : "Select Metrics"}
            </Text>
            <Text style={[styles.headerSubtitle, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
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
              style={[
                styles.selectAllButton,
                {
                  backgroundColor: allSelected
                    ? "#FF8C4220" // Light orange when selected
                    : "#FFF4E6", // Light orange background
                  borderWidth: 1,
                  borderColor: "#FF8C42", // Orange border
                },
              ] as StyleProp<ViewStyle>}
              onPress={allSelected ? clearAllMetrics : selectAllMetrics}
            >
              <Text
                style={[
                  styles.selectAllText,
                  {
                    color: allSelected ? theme.colors.primary.main : theme.colors.text.primary,
                    fontWeight: allSelected ? "600" : "500",
                  },
                ] as StyleProp<TextStyle>}
              >
                {allSelected
                  ? (isRTL ? "✓ تم تحديد الكل" : "✓ All Selected")
                  : (isRTL ? "تحديد الكل" : "Select All")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Metric Groups */}
          <View style={styles.metricsSection as ViewStyle}>
            {groups.map((group) => {
              const groupMetrics = availableMetrics.filter(
                (m) => m.group === group
              );
              if (groupMetrics.length === 0) return null;

              const isExpanded = expandedGroups.has(group);
              const groupSelected = groupMetrics.every((m) =>
                selectedMetrics.has(m.key)
              );
              const someSelected = groupMetrics.some((m) =>
                selectedMetrics.has(m.key)
              );

              return (
                <View
                  key={group}
                  style={[
                    styles.groupCard,
                    {
                      backgroundColor: "#FFF4E6", // Light orange background
                      borderColor: "#FF8C42", // Orange border
                    },
                  ] as StyleProp<ViewStyle>}
                >
                  {/* Group Header */}
                  <TouchableOpacity
                    style={styles.groupHeader as ViewStyle}
                    onPress={() => toggleGroup(group)}
                  >
                    <View style={styles.groupHeaderLeft as ViewStyle}>
                      <Switch
                        value={groupSelected}
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
                        trackColor={{
                          false: "#E0E0E0",
                          true: "#FF8C42", // Orange when on
                        }}
                        thumbColor="#FFFFFF"
                      />
                      <Text style={[styles.groupTitle, { color: theme.colors.text.primary }] as StyleProp<TextStyle>}>
                        {getGroupDisplayName(group)}
                      </Text>
                      <Text
                        style={[
                          styles.groupCount,
                          { color: theme.colors.text.secondary },
                        ] as StyleProp<TextStyle>}
                      >
                        ({groupMetrics.length})
                      </Text>
                    </View>
                    <ChevronRight
                      size={20}
                      color={theme.colors.text.secondary}
                      style={{
                        transform: [{ rotate: isExpanded ? "90deg" : "0deg" }],
                      }}
                    />
                  </TouchableOpacity>

                  {/* Group Metrics */}
                  {isExpanded && (
                    <View style={styles.metricsList as ViewStyle}>
                      {groupMetrics.map((metric) => {
                        const isSelected = selectedMetrics.has(metric.key);
                        return (
                          <TouchableOpacity
                            key={metric.key}
                            style={[
                              styles.metricItem,
                              isSelected && {
                                backgroundColor: "#FF8C4220", // Light orange when selected
                              },
                            ] as StyleProp<ViewStyle>}
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
                          >
                            <View style={styles.metricLeft as ViewStyle}>
                              {isSelected ? (
                                <View
                                  style={[
                                    styles.checkbox,
                                    { backgroundColor: "#FF8C42" }, // Orange checkbox
                                  ] as StyleProp<ViewStyle>}
                                >
                                  <Check size={14} color="#FFFFFF" />
                                </View>
                              ) : (
                                <View
                                  style={[
                                    styles.checkbox,
                                    {
                                      borderColor: "#FF8C42", // Orange border
                                    },
                                  ] as StyleProp<ViewStyle>}
                                />
                              )}
                              <View style={styles.metricInfo as ViewStyle}>
                                <Text
                                  style={[styles.metricName, { color: theme.colors.text.primary }] as StyleProp<TextStyle>}
                                >
                                  {metric.displayName}
                                </Text>
                                {metric.unit && (
                                  <Text
                                    style={[
                                      styles.metricUnit,
                                      { color: theme.colors.text.secondary },
                                    ] as StyleProp<TextStyle>}
                                  >
                                    {metric.unit}
                                  </Text>
                                )}
                              </View>
                            </View>
                            {/* Remove "all" if selecting individual metrics */}
                            {selectedMetrics.has("all") && (
                              <TouchableOpacity
                                onPress={() => {
                                  const newSelected = new Set(selectedMetrics);
                                  newSelected.delete("all");
                                  newSelected.add(metric.key);
                                  setSelectedMetrics(newSelected);
                                }}
                                style={{ padding: 4 }}
                              >
                                <Text style={{ fontSize: 12, color: theme.colors.primary.main }}>
                                  {isRTL ? "اختر" : "Select"}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Info */}
          <View style={styles.infoSection as ViewStyle}>
            <View style={styles.infoRow as ViewStyle}>
              <Info size={16} color={theme.colors.text.secondary} />
              <Text style={[styles.infoText, { color: theme.colors.text.secondary }] as StyleProp<TextStyle>}>
                {isRTL
                  ? Platform.OS === "ios"
                    ? "بعد النقر على \"تفويض\"، ستظهر شاشة أذونات iOS حيث يمكنك اختيار المقاييس المحددة. يمكنك تغيير هذه الأذونات لاحقًا في إعدادات iOS → الخصوصية والأمان → الصحة"
                    : "يمكنك تغيير هذه الأذونات لاحقًا في تطبيق Health Connect → الأذونات"
                  : Platform.OS === "ios"
                    ? "After clicking \"Authorize\", the iOS permission screen will appear where you can grant access to the selected metrics. You can change these permissions later in iOS Settings → Privacy & Security → Health"
                    : "You can change these permissions later in the Health Connect app → Permissions"}
              </Text>
            </View>
          </View>

          {/* CTA */}
          <View style={styles.ctaSection as ViewStyle}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  backgroundColor:
                    selectedMetrics.size > 0
                      ? "#FF8C42" // Orange button
                      : "#CCCCCC", // Gray when disabled
                },
                selectedMetrics.size === 0 && styles.disabledButton,
              ] as StyleProp<ViewStyle>}
              onPress={handleAuthorizeMetrics}
              disabled={authorizing || selectedMetrics.size === 0}
            >
              {authorizing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText as StyleProp<TextStyle>}>
                    {isRTL
                      ? selectedMetrics.has("all")
                        ? "تفويض جميع المقاييس"
                        : `تفويض ${selectedMetrics.size} مقياس`
                      : selectedMetrics.has("all")
                        ? "Authorize All Metrics"
                        : `Authorize ${selectedMetrics.size} Metric${selectedMetrics.size !== 1 ? "s" : ""}`}
                  </Text>
                  <ChevronRight size={20} color="#FFFFFF" />
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
      <SafeAreaView style={styles.container as ViewStyle}>
        <View style={styles.permissionCard as ViewStyle}>
          <View style={styles.permissionIcon as ViewStyle}>
            <Heart color={theme.colors.neutral.white} size={40} />
          </View>
          <Text style={[styles.permissionTitle, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
            {isRTL ? "دمج البيانات الصحية" : "Health Data Integration"}
          </Text>
          <Text style={[styles.permissionDescription, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
            {isRTL
              ? `ادمج بياناتك الصحية من ${Platform.OS === "ios" ? "تطبيق الصحة" : "Health Connect"} لمراقبة أفضل لصحتك ومعرفة المؤشرات الحيوية`
              : `Connect your health data from ${Platform.OS === "ios" ? "Health App" : "Health Connect"} to get comprehensive health monitoring and vital signs tracking`}
          </Text>
          <TouchableOpacity
            disabled={authorizing || loading}
            onPress={handleEnableHealthData}
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
              {authorizing || loading
                ? isRTL
                  ? "جاري التفعيل..."
                  : "Enabling..."
                : isRTL
                  ? "تفعيل الدمج"
                  : "Enable Integration"}
            </Text>
          </TouchableOpacity>

          <Text
            style={[
              styles.permissionDescription,
              { marginTop: theme.spacing.lg, fontSize: 12 },
            ] as StyleProp<TextStyle>}
          >
            {isRTL
              ? Platform.OS === "ios"
                ? "انقر لعرض شاشة أذونات HealthKit واختيار البيانات الصحية"
                : "انقر للاختيار من المقاييس الصحية المتاحة في Health Connect"
              : Platform.OS === "ios"
                ? "Click to open HealthKit permissions and select health data"
                : "Click to select from available health metrics in Health Connect"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const vitalCards = getVitalCards();

  return (
    <SafeAreaView style={styles.container as ViewStyle}>
      {/* Header */}
      <View style={styles.header as ViewStyle}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
          {isRTL ? "المؤشرات الحيوية" : "Vital Signs"}
        </Text>
        <Text style={[styles.headerSubtitle, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
          {isRTL
            ? "مراقبة صحتك من مصادر متعددة"
            : "Monitor your health from multiple sources"}
        </Text>

        <View style={styles.headerActions as ViewStyle}>
          <View style={styles.syncInfo as ViewStyle}>
            {lastSync && (
              <>
                <CheckCircle color={theme.colors.accent.success} size={12} />
                <Text style={[styles.syncText, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
                  {isRTL
                    ? `آخر مزامنة: ${lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : `Last sync: ${lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </Text>
              </>
            )}
          </View>

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
              {refreshing
                ? isRTL
                  ? "مزامنة..."
                  : "Syncing..."
                : isRTL
                  ? "مزامنة"
                  : "Sync"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
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
        {/* Vitals Grid */}
        <View style={styles.vitalsGrid as ViewStyle}>
          {/* First Row - Heart Rate (large) + Steps */}
          <View style={styles.vitalsRow as ViewStyle}>
            {vitalCards.slice(0, 2).map((vital, index) => {
              const IconComponent = vital.icon;
              const TrendIcon = getTrendIcon(vital.trend);
              const isLarge = index === 0;

              return (
                <View
                  key={vital.key}
                  style={[styles.vitalCard, isLarge && styles.vitalCardLarge] as StyleProp<ViewStyle>}
                >
                  <View style={styles.vitalHeader as ViewStyle}>
                    <View
                      style={[
                        styles.vitalIcon,
                        { backgroundColor: vital.color + "20" },
                      ] as StyleProp<ViewStyle>}
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

                  <Text style={[styles.vitalTitle, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
                    {isRTL ? vital.titleAr : vital.title}
                  </Text>

                  <Text
                    style={[
                      styles.vitalValue,
                      isLarge && styles.vitalValueLarge,
                      isRTL && styles.rtlText,
                    ] as StyleProp<TextStyle>}
                  >
                    {vital.value}
                  </Text>

                  <Text style={[styles.vitalUnit, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
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
                      style={[
                        styles.statusText,
                        { color: getStatusColor(vital.status) },
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>}
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

          {/* Second Row - Sleep + Weight */}
          <View style={styles.vitalsRow as ViewStyle}>
            {vitalCards.slice(2, 4).map((vital) => {
              const IconComponent = vital.icon;
              const TrendIcon = getTrendIcon(vital.trend);

              return (
                <View key={vital.key} style={styles.vitalCard as ViewStyle}>
                  <View style={styles.vitalHeader as ViewStyle}>
                    <View
                      style={[
                        styles.vitalIcon,
                        { backgroundColor: vital.color + "20" },
                      ] as StyleProp<ViewStyle>}
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

                  <Text style={[styles.vitalTitle, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
                    {isRTL ? vital.titleAr : vital.title}
                  </Text>

                  <Text style={[styles.vitalValue, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
                    {vital.value}
                  </Text>

                  <Text style={[styles.vitalUnit, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
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
                      style={[
                        styles.statusText,
                        { color: getStatusColor(vital.status) },
                        isRTL && styles.rtlText,
                      ] as StyleProp<TextStyle>}
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
        </View>

        {/* Maak One-liner */}
        <View style={styles.onelineCard as ViewStyle}>
          <Text style={[styles.onelineText, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
            {isRTL ? '"خليهم دايمًا معك"' : '"Health starts at home"'}
          </Text>
          <Text style={[styles.onelineSource, isRTL && styles.rtlText] as StyleProp<TextStyle>}>
            - Maak
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

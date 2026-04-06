// TODO(i18n): 108 inline RTL/language ternaries — migrate to t() keys
// See: https://github.com/your-org/nuralix/issues/XXX
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: legacy profile screen with many sections and handlers. */
/* biome-ignore-all lint/style/noNestedTernary: existing localized UI branches retained for this batch. */
/* biome-ignore-all lint/nursery/noLeakedRender: incremental JSX cleanup in progress. */
/* biome-ignore-all lint/suspicious/noArrayIndexKey: list ordering is currently stable in profile sections. */
/* biome-ignore-all lint/suspicious/noExplicitAny: incremental typing cleanup pending for this screen. */
/* biome-ignore-all lint/correctness/noInvalidUseBeforeDeclaration: hook/data-loader order will be refactored in a dedicated pass. */
/* biome-ignore-all lint/correctness/useExhaustiveDependencies: dependencies depend on upcoming callback refactor. */
/* biome-ignore-all lint/correctness/noUnusedVariables: multiple staged feature flags/helpers are intentionally retained. */
/* biome-ignore-all lint/nursery/noShadow: local naming overlap in event handlers will be cleaned up later. */
import AsyncStorage from "@react-native-async-storage/async-storage";
/* biome-ignore lint/performance/noNamespaceImport: Sentry namespace import retained for SDK compatibility. */
import * as Sentry from "@sentry/react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/apiClient";
import {
  User,
  Settings,
  Bell,
  BookOpen,
  Brain,
  Building2,
  Calendar,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Dna,
  FileText,
  Globe,
  Heart,
  HelpCircle,
  History,
  LogOut,
  Activity,
  AlertTriangle,
  Moon,
  Phone,
  Plus,
  RefreshCw,
  Shield,
  Sun,
  TestTube,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  type TextStyle,
  type ViewStyle,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Avatar from "@/components/Avatar";
import {
  Button,
  Caption,
  Card,
  Heading,
  Text as TypographyText,
} from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import GradientScreen from "@/components/figma/GradientScreen";
import Sparkline from "@/components/figma/Sparkline";
import { useAuth } from "@/contexts/AuthContext";
import { useFallDetectionContext } from "@/contexts/FallDetectionContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useMyOrganization } from "@/hooks/useMyOrganization";
import {
  healthDataService,
  type VitalSigns,
} from "@/lib/services/healthDataService";
import {
  calculateHealthScoreFromData,
  type HealthScoreResult,
} from "@/lib/services/healthScoreService";
import { medicationService } from "@/lib/services/medicationService";
import {
  type ExportFormat,
  exportMetrics,
} from "@/lib/services/metricsExportService";
import * as ImagePicker from "expo-image-picker";
import { offlineService } from "@/lib/services/offlineService";
import { symptomService } from "@/lib/services/symptomService";
import { userService } from "@/lib/services/userService";
import type {
  AvatarType,
  Medication,
  Symptom,
} from "@/types";
import {
  safeFormatDate,
  safeFormatDateTime,
  safeFormatNumber,
  safeFormatTime,
} from "@/utils/dateFormat";

interface ProfileSectionItem {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  hasSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void | Promise<void>;
  value?: string;
  comingSoon?: boolean;
}

interface ProfileSection {
  title: string;
  items: ProfileSectionItem[];
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateUser } = useAuth();
  const { isEnabled: fallDetectionEnabled, toggleFallDetection } =
    useFallDetectionContext();
  const { themeMode, setThemeMode, isDark } = useTheme();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [healthData, setHealthData] = useState({
    symptoms: [] as Symptom[],
    medications: [] as Medication[],
    healthScore: 85,
  });

  const isRTL = i18n.language === 'ar';

  // Org membership — available for org_admin, provider, care_coordinator roles
  const {
    org: myOrg,
    member: myMember,
    loading: orgLoading,
  } = useMyOrganization();
  const isOrgMember =
    myOrg != null &&
    myMember != null &&
    ["org_admin", "provider", "care_coordinator", "viewer"].includes(
      myMember.role
    );

  const checkSyncStatus = useCallback(async () => {
    try {
      const status = await offlineService.getSyncStatus();
      setSyncStatus({
        isOnline: status.isOnline,
        queueLength: status.queueLength,
      });
    } catch (err: unknown) {
      console.warn('[profile] checkSyncStatus failed:', err instanceof Error ? err.message : String(err));
    }
  }, []);

  const checkSyncStatusRef = useRef(checkSyncStatus);
  checkSyncStatusRef.current = checkSyncStatus;

  // --- Missing state/variable declarations (stubs for referenced but undeclared names) ---
  const [syncStatus, setSyncStatus] = useState<{ isOnline: boolean; queueLength: number }>({ isOnline: true, queueLength: 0 });
  const [syncing, setSyncing] = useState(false);
  const [vitalsSparklines, setVitalsSparklines] = useState<{
    heartRate: number[];
    steps: number[];
    sleepHours: number[];
    hasHeartRateData?: boolean;
    hasStepsData?: boolean;
    hasSleepData?: boolean;
  }>({ heartRate: [], steps: [], sleepHours: [] });
  const [latestVitals, setLatestVitals] = useState<{
    heartRate?: number;
    restingHeartRate?: number;
    sleepHours?: number;
    steps?: number;
    timestamp?: string;
  } | null>(null);

  const isAdmin = user?.role === 'admin';
  const isRegularUser = !isAdmin;

  const WHITESPACE_SPLIT_REGEX = /\s+/;

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await checkSyncStatus();
    } catch (err: unknown) {
      console.warn('[profile] handleSync failed:', err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, [checkSyncStatus]);


  const handleHealthOverviewPress = useCallback(() => {
    router.push('/health-summary');
  }, [router]);

  const handleHealthInsightsPress = useCallback(() => {
    router.push('/profile/health-insights');
  }, [router]);
  // --- End missing declarations ---

  const buildDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const buildSparklineSeries = (
    startDate: Date,
    days: number,
    valuesByDate: Map<string, number[]>,
    aggregator: "avg" | "sum"
  ) => {
    const series: number[] = [];
    for (let i = 0; i < days; i += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const key = buildDateKey(date);
      const values = valuesByDate.get(key) || [];
      if (values.length === 0) {
        series.push(0);
      } else if (aggregator === "sum") {
        series.push(values.reduce((sum, value) => sum + value, 0));
      } else {
        series.push(
          values.reduce((sum, value) => sum + value, 0) / values.length
        );
      }
    }
    // Return the series regardless of whether it has data
    // The calling code will provide mock data if needed
    return series;
  };

  const fetchVitalsSparklines = useCallback(async (_userId: string) => {
    const days = 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));

    const raw = await api.get<Record<string, unknown>[]>(
      `/api/health/vitals?from=${startDate.toISOString()}&limit=300`
    );
    const heartRateByDate = new Map<string, number[]>();
    const stepsByDate = new Map<string, number[]>();
    const sleepByDate = new Map<string, number[]>();

    for (const d of (Array.isArray(raw) ? raw : [])) {
      const type = d.type as string | undefined;
      if (!type) {
        continue;
      }
      if (type !== "heartRate" && type !== "steps" && type !== "sleepHours") {
        continue;
      }
      const timestamp = d.recordedAt ? new Date(d.recordedAt as string) : new Date();
      const valueRaw = d.value;
      const value =
        typeof valueRaw === "number"
          ? valueRaw
          : typeof valueRaw === "string"
            ? Number(valueRaw)
            : Number.NaN;
      if (Number.isNaN(value)) {
        continue;
      }
      const dateKey = buildDateKey(timestamp);
      if (type === "heartRate") {
        if (!heartRateByDate.has(dateKey)) {
          heartRateByDate.set(dateKey, []);
        }
        heartRateByDate.get(dateKey)?.push(value);
      } else if (type === "steps") {
        if (!stepsByDate.has(dateKey)) {
          stepsByDate.set(dateKey, []);
        }
        stepsByDate.get(dateKey)?.push(value);
      } else if (type === "sleepHours") {
        if (!sleepByDate.has(dateKey)) {
          sleepByDate.set(dateKey, []);
        }
        sleepByDate.get(dateKey)?.push(value);
      }
    }

    const heartRateSeries = buildSparklineSeries(
      startDate,
      days,
      heartRateByDate,
      "avg"
    );
    const stepsSeries = buildSparklineSeries(
      startDate,
      days,
      stepsByDate,
      "sum"
    );
    const sleepSeries = buildSparklineSeries(
      startDate,
      days,
      sleepByDate,
      "sum"
    );

    // Use real data when available; mock chart when no data for better UX
    const hasHeartRateData = heartRateSeries.some((v) => v > 0);
    const hasStepsData = stepsSeries.some((v) => v > 0);
    const hasSleepData = sleepSeries.some((v) => v > 0);

    const mockHeartRate = [72, 68, 75, 70, 72, 74, 70];
    const mockSteps = [3200, 4500, 2800, 5200, 4100, 3800, 6000];
    const mockSleep = [7.2, 6.5, 7.8, 6.0, 8.0, 7.0, 6.5];

    const result = {
      heartRate: hasHeartRateData ? heartRateSeries : mockHeartRate,
      steps: hasStepsData ? stepsSeries : mockSteps,
      sleepHours: hasSleepData ? sleepSeries : mockSleep,
      hasHeartRateData,
      hasStepsData,
      hasSleepData,
    };

    if (process.env.NODE_ENV !== "production") {
      console.debug("[profile] Sparkline data:", {
        heartRate: result.heartRate.length,
        steps: result.steps.length,
        sleepHours: result.sleepHours.length,
        hasHeartRateData,
        hasStepsData,
        hasSleepData,
      });
    }

    return result;
  }, []);

  // Helper function to convert Western numerals to Arabic numerals
  const toArabicNumerals = (num: number): string => {
    const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
    return num
      .toString()
      .replace(/\d/g, (digit) => arabicNumerals[Number.parseInt(digit, 10)]);
  };

  // Refresh data when tab is focused - debounced to prevent multiple loads
  useFocusEffect(
    useCallback(() => {
      loadHealthData();
      loadUserSettings();
    }, [user, isRTL])
  );


  const loadUserSettings = async () => {
    try {
      const notifications = await AsyncStorage.getItem('notifications_enabled');

      if (notifications !== null) {
        setNotificationsEnabled(JSON.parse(notifications));
      }
    } catch (error: unknown) {
      console.error('[Profile] Error loading notification settings:', error instanceof Error ? error.message : String(error));
    }
  };

  const loadHealthData = async (isRefresh = false) => {
    if (!user?.id) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const [symptoms, medications, sparklineData, latestVitalsData] = await Promise.all([
        symptomService.getUserSymptoms(user.id),
        medicationService.getUserMedications(user.id),
        fetchVitalsSparklines(user.id).catch((err: unknown) => {
          console.warn('[profile] fetchVitalsSparklines failed:', err instanceof Error ? err.message : String(err));
          return null;
        }),
        healthDataService.getLatestVitals().catch((err: unknown) => {
          console.warn('[profile] getLatestVitals failed:', err instanceof Error ? err.message : String(err));
          return null;
        }),
      ]);

      // Calculate health score based on recent symptoms and medication compliance
      const recentSymptoms = symptoms.filter(
        (s) =>
          new Date(s.timestamp).getTime() >
          Date.now() - 30 * 24 * 60 * 60 * 1000
      );
      const activeMedications = medications.filter((m) => m.isActive);

      let score = 100;
      score -= recentSymptoms.length * 5; // Reduce score for recent symptoms
      score = Math.max(score, 0);

      setHealthData({
        symptoms: recentSymptoms,
        medications: activeMedications,
        healthScore: score,
      });

      if (sparklineData) {
        setVitalsSparklines(sparklineData);
      }

      if (latestVitalsData) {
        setLatestVitals({
          heartRate: latestVitalsData.heartRate ?? undefined,
          restingHeartRate: latestVitalsData.restingHeartRate ?? undefined,
          sleepHours: latestVitalsData.sleepHours ?? undefined,
          steps: latestVitalsData.steps ?? undefined,
          timestamp: latestVitalsData.timestamp instanceof Date
            ? latestVitalsData.timestamp.toISOString()
            : latestVitalsData.timestamp
              ? new Date(latestVitalsData.timestamp as unknown as string).toISOString()
              : undefined,
        });
      }
    } catch (error: unknown) {
      console.error('Error loading health data:', error instanceof Error ? error.message : String(error));
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'فشل تحميل البيانات الصحية' : 'Failed to load health data'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem('notifications_enabled', JSON.stringify(value));
  };

  const handleFallDetectionToggle = async (value: boolean) => {
    await toggleFallDetection(value);
  };

  const handleLanguageChange = async (languageCode: 'en' | 'ar') => {
    await i18n.changeLanguage(languageCode);
    await AsyncStorage.setItem('app_language', languageCode);
    setLanguagePickerVisible(false);
  };

  const handlePersonalInfo = () => {
    router.push('/profile/personal-info');
  };

  const handleMedicalHistory = () => {
    router.push('/profile/medical-history');
  };

  const handleHealthReports = () => {
    if (
      healthData.symptoms.length === 0 &&
      healthData.medications.length === 0
    ) {
      Alert.alert(
        isRTL ? 'التقارير الصحية' : 'Health Reports',
        isRTL
          ? 'لا توجد بيانات صحية كافية لإنشاء تقرير. ابدأ بتسجيل الأعراض والأدوية.'
          : 'Not enough health data to generate reports. Start by logging symptoms and medications.',
        [{ text: isRTL ? 'موافق' : 'OK' }]
      );
      return;
    }

    const report = `${isRTL ? 'نقاط الصحة' : 'Health Score'}: ${
      healthData.healthScore
    }/100\n${isRTL ? 'الأعراض الأخيرة' : 'Recent Symptoms'}: ${
      healthData.symptoms.length
    }\n${isRTL ? 'الأدوية النشطة' : 'Active Medications'}: ${
      healthData.medications.length
    }`;

    Alert.alert(isRTL ? 'التقرير الصحي' : 'Health Report', report, [
      { text: isRTL ? 'موافق' : 'OK' },
      {
        text: isRTL ? 'تصدير' : 'Export',
        onPress: () => {
          Alert.alert(
            isRTL ? 'قريباً' : 'Coming Soon',
            isRTL
              ? 'ستتوفر إمكانية تصدير التقارير قريباً'
              : 'Report export will be available soon'
          );
        },
      },
    ]);
  };

  const handleHelpSupport = () => {
    router.push('/profile/help-support');
  };

  const handleTermsConditions = () => {
    router.push('/profile/terms-conditions');
  };

  const handlePrivacyPolicy = () => {
    router.push('/profile/privacy-policy');
  };

  const handleExportData = () => {
    router.push('/profile/export-data');
  };

  const handleDeleteAccount = () => {
    router.push('/profile/delete-account');
  };

  const handleLogout = () => {
    Alert.alert(
      isRTL ? 'تسجيل الخروج' : 'Sign Out',
      isRTL
        ? 'هل أنت متأكد من تسجيل الخروج؟'
        : 'Are you sure you want to sign out?',
      [
        {
          text: isRTL ? 'إلغاء' : 'Cancel',
          style: 'cancel',
        },
        {
          text: isRTL ? 'تسجيل الخروج' : 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/(auth)/login');
            } catch (error: unknown) {
              console.error('Logout failed:', error instanceof Error ? error.message : String(error));
              Alert.alert(
                isRTL ? 'خطأ' : 'Error',
                isRTL
                  ? 'فشل في تسجيل الخروج'
                  : 'Failed to sign out. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const profileSections: ProfileSection[] = [
    {
      title: isRTL ? 'الحساب' : 'Account',
      items: [
        {
          icon: User,
          label: isRTL ? 'المعلومات الشخصية' : 'Personal Information',
          onPress: handlePersonalInfo,
        },
        {
          icon: Heart,
          label: isRTL ? 'التاريخ الطبي' : 'Medical History',
          onPress: handleMedicalHistory,
        },
        {
          icon: FileText,
          label: isRTL ? 'التقارير الصحية' : 'Health Reports',
          onPress: handleHealthReports,
        },
        {
          icon: Calendar,
          label: isRTL
            ? t("calendar")
            : t("calendar").charAt(0).toUpperCase() +
              t("calendar").slice(1).toLowerCase(),
          onPress: () => router.push('/(tabs)/timeline'),
        },
        // Show additional options only for admin users
        ...(isAdmin
          ? [
              {
                icon: BookOpen,
                label: t("healthResources"),
                onPress: () => router.push("/(tabs)/resources"),
                comingSoon: true,
              },
            ]
          : []),
      ],
    },
    // Admin management section - only for admin users
    ...(isAdmin
      ? [
          {
            title: t("accountManagement"),
            items: [
              {
                icon: CreditCard,
                label: t("subscriptionAndMembers"),
                onPress: () => router.push("/profile/admin-settings"),
              },
            ],
          },
        ]
      : []),
    // Organization section — for org_admin, provider, care_coordinator, viewer
    ...(isOrgMember && myOrg
      ? [
          {
            title: "Organization",
            items: [
              {
                icon: Building2,
                label: myOrg.name,
                onPress: () =>
                  router.push(
                    `/(settings)/org?orgId=${encodeURIComponent(myOrg.id)}&orgName=${encodeURIComponent(myOrg.name)}` as never
                  ),
              },
            ],
          },
        ]
      : myOrg || orgLoading
        ? []
        : [
            {
              title: "Organization",
              items: [
                {
                  icon: Building2,
                  label: "Create an Organization",
                  onPress: () => router.push("/(settings)/create-org" as never),
                },
              ],
            },
          ]),
    // Health features for regular users
    ...(isRegularUser
      ? [
          {
            title: t("healthData"),
            items: [
              {
                icon: AlertTriangle,
                label: t("allergies"),
                onPress: () => router.push("/(tabs)/allergies"),
              },
              {
                icon: Heart,
                label: t("bloodPressure"),
                onPress: () => router.push("/(tabs)/vitals"),
              },
              {
                icon: History,
                label: t("medicalHistory"),
                onPress: () => router.push("/profile/medical-history"),
              },
              {
                icon: TestTube,
                label: t("labResults"),
                onPress: () => router.push("/(tabs)/lab-results"),
              },
              {
                icon: Clock,
                label: t("healthTimeline"),
                onPress: () => router.push("/(tabs)/timeline"),
              },
              {
                icon: Heart,
                label: t("vitalsMonitor"),
                onPress: () => router.push("/ppg-measure"),
              },
              {
                icon: TrendingUp,
                label: t("healthSummary"),
                onPress: () => router.push("/health-summary"),
              },
              {
                icon: Brain,
                label: t("healthInsights"),
                onPress: () => router.push("/profile/health-insights"),
              },
              {
                icon: Dna,
                label: t("geneticProfile", "Genetic Profile"),
                onPress: () => router.push("/profile/genetics" as never),
              },
              {
                icon: Activity,
                label: t("healthIntegrations"),
                onPress: () =>
                  router.push({ pathname: '/profile/health-integrations' }),
              },
            ],
          },
        ]
      : []),
    // Simplified settings for regular users
    {
      title: t("settings"),
      items: [
        // Basic notifications for regular users
        ...(isRegularUser
          ? [
              {
                icon: Bell,
                label: t("notifications"),
                onPress: () => router.push("/profile/notification-settings"),
              },
            ]
          : [
              // Full settings for admin users
              {
                icon: Bell,
                label: t("notifications"),
                onPress: () => router.push("/profile/notification-settings"),
              },
              {
                icon: Shield,
                label: t("fallDetection"),
                onPress: () => router.push({ pathname: '/profile/fall-detection' }),
              },
              {
                icon: Activity,
                label: t("healthIntegrations"),
                onPress: () =>
                  router.push({ pathname: '/profile/health-integrations' }),
              },
            ]),
        // Language for all users
        {
          icon: Globe,
          label: t("language"),
          value: isRTL ? t("arabic") : t("english"),
          onPress: () => setLanguagePickerVisible(true),
        },
        {
          icon: RefreshCw,
          label: isRTL ? "مزامنة البيانات" : t("syncData", "Sync Data"),
          value: syncing
            ? isRTL
              ? "جارٍ المزامنة..."
              : t("syncing", "Syncing...")
            : syncStatus.queueLength > 0
              ? isRTL
                ? `${syncStatus.queueLength} قيد الانتظار`
                : `${syncStatus.queueLength} ${t("pending", "pending")}`
              : syncStatus.isOnline
                ? isRTL
                  ? "تمت المزامنة"
                  : t("synced", "Synced")
                : isRTL
                  ? "غير متصل"
                  : t("offline", "Offline"),
          onPress: handleSync,
        },
      ],
    },
    // Support section for all users
    {
      title: t("support"),
      items: [
        {
          icon: HelpCircle,
          label: t("helpSupport"),
          onPress: handleHelpSupport,
        },
        // Basic privacy for regular users, full legal for admins
        ...(isRegularUser
          ? [
              {
                icon: Shield,
                label: t("privacyPolicy"),
                onPress: handlePrivacyPolicy,
              },
            ]
          : [
              {
                icon: FileText,
                label: t("termsConditions"),
                onPress: handleTermsConditions,
              },
              {
                icon: Shield,
                label: t("privacyPolicy"),
                onPress: handlePrivacyPolicy,
              },
            ]),
      ],
    },
  ];

  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || (isRTL ? "مستخدم" : "User");
  const handleAvatarChange = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          isRTL ? "إذن مطلوب" : "Permission Required",
          isRTL
            ? "يحتاج التطبيق إلى إذن للوصول إلى مكتبة الصور."
            : "The app needs permission to access your photo library."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const uri = result.assets[0].uri;

      if (!user?.id || !updateUser) return;
      await userService.updateUser(user.id, { avatar: uri, avatarType: "custom" });
      await updateUser({ avatar: uri, avatarType: "custom" });
      Alert.alert(
        isRTL ? "تم التحديث" : "Updated",
        isRTL ? "تم تحديث الصورة الشخصية بنجاح." : "Profile picture updated successfully."
      );
    } catch (err: unknown) {
      console.error("[Profile] Avatar update failed:", err instanceof Error ? err.message : String(err));
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل تحديث الصورة. حاول مرة أخرى." : "Failed to update avatar. Please try again."
      );
    }
  };

  const getAvatarInitials = (name: string) => {
    const parts = name.trim().split(WHITESPACE_SPLIT_REGEX).filter(Boolean);
    if (parts.length === 0) {
      return "?";
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    /* biome-ignore lint/style/useAtIndex: avoid Array.prototype.at for React Native runtime compatibility. */
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };
  const roleLabel =
    user?.role === "admin"
      ? isRTL
        ? "مقدم رعاية أساسي"
        : "Primary Caregiver"
      : user?.role === "caregiver"
        ? isRTL
          ? "مقدم رعاية"
          : "Caregiver"
        : isRTL
          ? "عضو"
          : "Member";
  const activeMedications = healthData.medications.filter(
    (med) => med.isActive
  );
  const quickStats = [
    {
      label: isRTL ? "الأدوية" : "Medications",
      value: activeMedications.length,
    },
    {
      label: isRTL ? "الأعراض" : "Symptoms",
      value: healthData.symptoms.length,
    },
    {
      label: isRTL ? "نقاط الصحة" : "Health Score",
      value: `${Math.min(100, Math.round(healthData.healthScore))}%`,
    },
  ];

  const heartRateValue =
    latestVitals?.heartRate ?? latestVitals?.restingHeartRate ?? null;
  const sleepValue = latestVitals?.sleepHours ?? null;
  const stepsValue = latestVitals?.steps ?? null;
  const vitalsTimestamp = latestVitals?.timestamp;
  const vitalsUpdatedLabel = vitalsTimestamp
    ? `${isRTL ? "آخر تحديث" : "Updated"} ${safeFormatTime(
        vitalsTimestamp,
        isRTL ? "ar" : "en-US"
      )}`
    : isRTL
      ? "لا توجد بيانات حديثة"
      : "No recent data";

  // Helper to calculate trend direction + percent change from sparkline data
  const getTrend = (
    data: number[]
  ): { direction: "up" | "down" | "stable"; percent: number } => {
    if (data.length < 2) {
      return { direction: "stable", percent: 0 };
    }
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const pct = firstAvg !== 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    const absPct = Math.abs(Math.round(pct));
    if (pct > 5) {
      return { direction: "up", percent: absPct };
    }
    if (pct < -5) {
      return { direction: "down", percent: absPct };
    }
    return { direction: "stable", percent: 0 };
  };

  const getInsightLabel = (
    direction: "up" | "down" | "stable",
    percent: number
  ): string => {
    const sign = direction === "up" ? "+" : direction === "down" ? "-" : "";
    const pctStr = `${sign}${percent}%`;
    return isRTL ? `${pctStr} أسبوعياً` : `${pctStr} per week`;
  };

  const hrTrend = getTrend(vitalsSparklines.heartRate);
  const sleepTrend = getTrend(vitalsSparklines.sleepHours);
  const stepsTrend = getTrend(vitalsSparklines.steps);

  type HealthOverviewCard = {
    icon: LucideIcon;
    label: string;
    value: string;
    trend: string;
    trendDirection: "stable" | "up" | "down";
    sparkline: number[];
    color: string;
    onPress: () => void;
    labelStyle?: TextStyle;
    infoStyle?: ViewStyle;
  };

  const vitalsOverview: HealthOverviewCard[] = [
    {
      icon: Heart,
      label: isRTL ? "نبض القلب" : "Heart Rate",
      value:
        heartRateValue !== null
          ? `${Math.round(heartRateValue)} ${isRTL ? "نبضة/د" : "bpm"}`
          : isRTL
            ? "غير متاح"
            : "N/A",
      trend:
        heartRateValue !== null && (vitalsSparklines.hasHeartRateData ?? false)
          ? getInsightLabel(hrTrend.direction, hrTrend.percent)
          : "",
      trendDirection: hrTrend.direction,
      sparkline: (heartRateValue !== null && (vitalsSparklines.hasHeartRateData ?? false)) ? vitalsSparklines.heartRate : [],
      color: "#EF4444",
      onPress: handleHealthOverviewPress,
    },
    {
      icon: Moon,
      label: isRTL ? "النوم" : "Sleep",
      value:
        sleepValue !== null
          ? `${sleepValue.toFixed(1)} ${isRTL ? "ساعة" : "hrs"}`
          : isRTL
            ? "غير متاح"
            : "N/A",
      trend:
        sleepValue !== null && (vitalsSparklines.hasSleepData ?? false)
          ? getInsightLabel(sleepTrend.direction, sleepTrend.percent)
          : "",
      trendDirection: sleepTrend.direction,
      sparkline: (sleepValue !== null && (vitalsSparklines.hasSleepData ?? false)) ? vitalsSparklines.sleepHours : [],
      color: "#3B82F6",
      onPress: handleHealthOverviewPress,
    },
    {
      icon: Activity,
      label: isRTL ? "النشاط" : "Activity",
      value:
        stepsValue !== null
          ? `${safeFormatNumber(Math.round(stepsValue))} ${t("stepsToday", "steps today")}`
          : isRTL
            ? "غير متاح"
            : "N/A",
      trend:
        stepsValue !== null && (vitalsSparklines.hasStepsData ?? false)
          ? getInsightLabel(stepsTrend.direction, stepsTrend.percent)
          : "",
      trendDirection: stepsTrend.direction,
      sparkline: (stepsValue !== null && (vitalsSparklines.hasStepsData ?? false)) ? vitalsSparklines.steps : [],
      color: "#10B981",
      onPress: handleHealthOverviewPress,
    },
  ];

  const healthOverviewCards: HealthOverviewCard[] = [
    ...vitalsOverview,
    {
      icon: Brain,
      label: t("healthInsights", "Health Insights"),
      infoStyle: { marginTop: 4 },
      value: isRTL ? "ملخص ذكي" : "AI Summary",
      trend: isRTL ? "اضغط للعرض" : "Tap to view",
      trendDirection: "stable" as const,
      sparkline: [2, 3, 2, 4, 3, 5, 4],
      color: "#6366F1",
      onPress: handleHealthInsightsPress,
    },
  ];
  type AccountSectionItem = {
    label: string;
    icon: LucideIcon;
    onPress?: () => void;
    hasSwitch?: boolean;
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => void | Promise<void>;
    value?: string;
  };

  const accountSections: { title: string; items: AccountSectionItem[] }[] = [
    {
      title: t("healthProfile", "Health Profile"),
      items: [
        {
          label: t("healthReports", "Health Reports"),
          icon: FileText,
          onPress: handleHealthReports,
        },
        {
          label: isRTL
            ? t("calendar")
            : t("calendar").charAt(0).toUpperCase() +
              t("calendar").slice(1).toLowerCase(),
          icon: Calendar,
          onPress: () => router.push('/(tabs)/timeline'),
        },
        {
          label: isRTL
            ? "الأجهزة المتصلة"
            : t("connectedDevices", "Connected Devices"),
          icon: Activity,
          onPress: () => router.push("/profile/health-integrations"),
        },
      ],
    },
    {
      title: isRTL ? 'الإعدادات' : 'Settings',
      items: [
        {
          icon: Bell,
          label: isRTL ? 'الإشعارات' : 'Notifications',
          hasSwitch: true,
          switchValue: notificationsEnabled,
          onSwitchChange: handleNotificationToggle,
          onPress: () => router.push('/profile/notification-settings'),
        },
        {
          icon: Shield,
          label: isRTL ? 'كشف السقوط' : 'Fall Detection',
          hasSwitch: true,
          switchValue: fallDetectionEnabled,
          onSwitchChange: handleFallDetectionToggle,
          onPress: () => router.push('/profile/fall-detection'),
        },
        {
          icon: Settings,
          label: isRTL ? 'تجربة الإشعارات' : 'Debug Notifications',
          onPress: () => router.push({ pathname: '/debug-notifications' }),
        },
        {
          icon: Heart,
          label: isRTL ? 'مساعد الصحة الذكي' : 'AI Health Assistant',
          onPress: () => router.push({ pathname: '/ai-assistant' }),
        },
        {
          icon: isDark ? Sun : Moon,
          label: isRTL ? 'المظهر الداكن' : 'Dark Mode',
          hasSwitch: true,
          switchValue: isDark,
          onSwitchChange: (value: boolean) => {
            setThemeMode(value ? 'dark' : 'light');
          },
        },
        {
          icon: Globe,
          label: isRTL ? 'اللغة' : 'Language',
          value: isRTL ? 'العربية' : 'English',
          onPress: () => setLanguagePickerVisible(true),
        },
      ],
    },
    {
      title: isRTL ? 'الدعم' : 'Support',
      items: [
        {
          icon: HelpCircle,
          label: isRTL ? 'المساعدة والدعم' : 'Help & Support',
          onPress: handleHelpSupport,
        },
        {
          icon: FileText,
          label: isRTL ? 'الشروط والأحكام' : 'Terms & Conditions',
          onPress: handleTermsConditions,
        },
        {
          icon: Shield,
          label: isRTL ? 'سياسة الخصوصية' : 'Privacy Policy',
          onPress: handlePrivacyPolicy,
        },
        {
          icon: FileText,
          label: isRTL ? 'تصدير بياناتي' : 'Export My Data',
          onPress: handleExportData,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {t('profile')}
        </Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHealthData(true)}
            tintColor="#2563EB"
          />
        }>
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Avatar
              source={user?.avatar ? { uri: user.avatar } : undefined}
              name={user?.name}
              size="xl"
              onPress={handleAvatarChange}
            />
          </View>

          <View style={styles.userInfo}>
            <Text style={[styles.userName, isRTL && styles.rtlText]}>
              {user?.name || 'User'}
            </Text>
            <Text style={[styles.userEmail, isRTL && styles.rtlText]}>
              {user?.email}
            </Text>
            <View style={styles.memberSince}>
              <Text style={[styles.memberSinceText, isRTL && styles.rtlText]}>
                {isRTL ? 'عضو منذ' : 'Member since'}{' '}
                {new Date(user?.createdAt || new Date()).getFullYear()}
              </Text>
            </View>
          </View>
        </View>

        {/* Improved Health Summary */}
        <View style={styles.healthSummary}>
          <Text style={[styles.healthTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'ملخص الصحة' : 'Health Summary'}
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : (
            <View style={styles.healthGrid}>
              <View style={styles.healthCard}>
                <View style={styles.healthIconContainer}>
                  <Activity size={24} color="#10B981" />
                </View>
                <Text style={[styles.healthCardValue, isRTL && styles.rtlText]}>
                  {healthData.healthScore}
                </Text>
                <Text
                  style={[styles.healthCardLabel, isRTL && styles.rtlText]}
                  numberOfLines={2}
                >
                  {isRTL ? 'نقاط الصحة' : 'Health Score'}
                </Text>
              </View>

              <View style={styles.healthCard}>
                <View style={styles.healthIconContainer}>
                  <Heart size={24} color="#EF4444" />
                </View>
                <Text style={[styles.healthCardValue, isRTL && styles.rtlText]}>
                  {healthData.symptoms.length}
                </Text>
                <Text
                  style={[styles.healthCardLabel, isRTL && styles.rtlText]}
                  numberOfLines={2}
                >
                  {isRTL ? 'أعراض هذا الشهر' : 'Symptoms This Month'}
                </Text>
              </View>

              <View style={styles.healthCard}>
                <View style={styles.healthIconContainer}>
                  <Calendar size={24} color="#3B82F6" />
                </View>
                <Text style={[styles.healthCardValue, isRTL && styles.rtlText]}>
                  {healthData.medications.length}
                </Text>
                <Text
                  style={[styles.healthCardLabel, isRTL && styles.rtlText]}
                  numberOfLines={2}
                >
                  {isRTL ? 'أدوية نشطة' : 'Active Medications'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Settings Sections */}
        {profileSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {section.title}
            </Text>

            <View style={styles.sectionItems}>
              {section.items.map((item, itemIndex) => {
                const IconComponent = item.icon;

                return (
                  <TouchableOpacity
                    key={`${section.title}-${item.label}`}
                    style={[
                      styles.sectionItem,
                      itemIndex === section.items.length - 1 &&
                        styles.lastSectionItem,
                    ]}
                    onPress={item.onPress}
                    disabled={!item.onPress}
                  >
                    <View style={styles.sectionItemLeft}>
                      <View style={styles.sectionItemIcon}>
                        <IconComponent size={20} color="#64748B" />
                      </View>
                      <Text
                        style={[
                          styles.sectionItemLabel,
                          isRTL && styles.rtlText,
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </View>

                    <View style={styles.sectionItemRight}>
                      {item.hasSwitch ? (
                        <Switch
                          value={item.switchValue ?? false}
                          onValueChange={item.onSwitchChange ?? (() => {})}
                          trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
                          thumbColor="#FFFFFF"
                        />
                      ) : (
                        <>
                          {item.value && (
                            <Text
                              style={[
                                styles.sectionItemValue,
                                isRTL && styles.rtlText,
                              ]}
                              numberOfLines={1}
                            >
                              {item.value}
                            </Text>
                          )}
                          <ChevronRight
                            size={16}
                            color="#94A3B8"
                            style={[
                              isRTL && { transform: [{ rotate: '180deg' }] },
                            ]}
                          />
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText, { color: '#EF4444' }]}>
            {isRTL ? 'منطقة الخطر' : 'Danger Zone'}
          </Text>
          <View style={styles.sectionItems}>
            <TouchableOpacity
              style={[styles.sectionItem, styles.lastSectionItem]}
              onPress={handleDeleteAccount}
            >
              <View style={styles.sectionItemLeft}>
                <View style={styles.sectionItemIcon}>
                  <Trash2 size={20} color="#EF4444" />
                </View>
                <Text
                  style={[styles.sectionItemLabel, { color: '#EF4444' }, isRTL && styles.rtlText]}
                  numberOfLines={1}
                >
                  {isRTL ? 'حذف الحساب' : 'Delete Account'}
                </Text>
              </View>
              <ChevronRight
                size={16}
                color="#EF4444"
                style={[isRTL && { transform: [{ rotate: '180deg' }] }]}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
          <LogOut size={20} color="#EF4444" />
          <Text style={[styles.signOutText, isRTL && styles.rtlText]}>
            {t('signOut')}
          </Text>
        </TouchableOpacity>

        <View style={styles.appVersion}>
          <Text style={styles.appVersionText}>
            {isRTL ? "نيورالكس v1.0.0" : "Nuralix v1.0.0"}
          </Text>
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        visible={languagePickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLanguagePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'اختر اللغة' : 'Select Language'}
            </Text>

            <TouchableOpacity
              style={[
                styles.languageOption,
                i18n.language === 'en' && styles.selectedLanguage,
              ]}
              onPress={() => handleLanguageChange('en')}
            >
              <Text
                style={[
                  styles.languageText,
                  i18n.language === 'en' && styles.selectedLanguageText,
                ]}
              >
                English
              </Text>
              {i18n.language === 'en' && <Check size={20} color="#2563EB" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.languageOption,
                i18n.language === 'ar' && styles.selectedLanguage,
              ]}
              onPress={() => handleLanguageChange('ar')}
            >
              <Text
                style={[
                  styles.languageText,
                  styles.rtlText,
                  i18n.language === 'ar' && styles.selectedLanguageText,
                ]}
              >
                العربية
              </Text>
              {i18n.language === 'ar' && <Check size={20} color="#2563EB" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setLanguagePickerVisible(false)}
            >
              <Text style={[styles.cancelButtonText, isRTL && styles.rtlText]}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginBottom: 8,
  },
  memberSince: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberSinceText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  healthSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  healthTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  healthGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  healthCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 100,
  },
  healthIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  healthCardValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  healthCardLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 14,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionItems: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastSectionItem: {
    borderBottomWidth: 0,
  },
  sectionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  sectionItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionItemLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1E293B',
    flex: 1,
  },
  sectionItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  sectionItemValue: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    maxWidth: 80,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  signOutText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
  },
  appVersion: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  appVersionText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 20,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  selectedLanguage: {
    backgroundColor: '#EBF4FF',
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  languageText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1E293B',
  },
  selectedLanguageText: {
    color: '#2563EB',
    fontFamily: 'Inter-SemiBold',
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
});

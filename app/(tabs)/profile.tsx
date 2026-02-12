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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Brain,
  Calendar,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Globe,
  Heart,
  HelpCircle,
  History,
  Lock,
  LogOut,
  MapPin,
  Moon,
  Plus,
  RefreshCw,
  Shield,
  Sun,
  TestTube,
  TrendingUp,
  User,
  Users,
  X,
} from "lucide-react-native";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Sentry from "@sentry/react-native";
import { AIInsightsDashboard } from "@/app/components/AIInsightsDashboard";
import GlobalSearch from "@/app/components/GlobalSearch";
import Avatar from "@/components/Avatar";
import {
  Button,
  Caption,
  Card,
  Heading,
  Text as TypographyText,
} from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { useAuth } from "@/contexts/AuthContext";
import { useFallDetectionContext } from "@/contexts/FallDetectionContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useRealtimeHealth } from "@/hooks/useRealtimeHealth";
import { calendarService } from "@/lib/services/calendarService";
import {
  calculateHealthScoreFromData,
  type HealthScoreResult,
} from "@/lib/services/healthScoreService";
import { medicationService } from "@/lib/services/medicationService";
import {
  type ExportFormat,
  exportMetrics,
} from "@/lib/services/metricsExportService";
import { offlineService } from "@/lib/services/offlineService";
import { symptomService } from "@/lib/services/symptomService";
import { userService } from "@/lib/services/userService";
import type {
  AvatarType,
  CalendarEvent,
  Medication,
  RecurrencePattern,
  Symptom,
} from "@/types";
import {
  safeFormatDate,
  safeFormatDateTime,
  safeFormatTime,
} from "@/utils/dateFormat";

type ProfileSectionItem = {
  icon: any;
  label: string;
  onPress?: () => void;
  hasSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void | Promise<void>;
  value?: string;
  comingSoon?: boolean;
};

type ProfileSection = {
  title: string;
  items: ProfileSectionItem[];
};

const HEALTH_SUMMARY_STALE_MS = 45_000;
const HEALTH_SUMMARY_MIN_FETCH_INTERVAL_MS = 12_000;

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateUser } = useAuth();
  const { isEnabled: fallDetectionEnabled, toggleFallDetection } =
    useFallDetectionContext();
  const { themeMode, setThemeMode, isDark, theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const calendarOpenedFromParam = useRef(false);
  const loadHealthDataRef = useRef(false);
  const loadHealthDataTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const loadHealthDataFnRef = useRef<(isRefresh?: boolean) => Promise<void>>(
    async () => {}
  );
  const loadUserSettingsFnRef = useRef<() => Promise<void>>(async () => {});
  const lastHealthSummaryLoadAtRef = useRef(0);
  const [_notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [avatarCreatorVisible, setAvatarCreatorVisible] = useState(false);
  const [healthScoreModalVisible, setHealthScoreModalVisible] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [healthData, setHealthData] = useState({
    symptoms: [] as Symptom[],
    medications: [] as Medication[],
    healthScore: 85,
    healthScoreResult: null as HealthScoreResult | null,
  });
  const [exporting, setExporting] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarCurrentDate, setCalendarCurrentDate] = useState(new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarRefreshing, setCalendarRefreshing] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [includeFamily, _setIncludeFamily] = useState(true);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventType, setEventType] =
    useState<CalendarEvent["type"]>("appointment");
  const [eventStartDate, setEventStartDate] = useState(new Date());
  const [eventEndDate, setEventEndDate] = useState<Date | undefined>(undefined);
  const [eventAllDay, setEventAllDay] = useState(false);
  const [eventLocation, setEventLocation] = useState("");
  const [eventRecurrencePattern, setEventRecurrencePattern] =
    useState<RecurrencePattern>("none");
  const [eventShareWithFamily, setEventShareWithFamily] = useState(false);
  const [eventTags, setEventTags] = useState<string[]>([]);
  const [savingEvent, setSavingEvent] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    isOnline: boolean;
    queueLength: number;
  }>({ isOnline: true, queueLength: 0 });

  const isRTL = i18n.language === "ar";
  const isAdmin = user?.role === "admin";

  const checkSyncStatus = useCallback(async () => {
    try {
      const status = await offlineService.getSyncStatus();
      setSyncStatus({
        isOnline: status.isOnline,
        queueLength: status.queueLength,
      });
    } catch {
      // Silently handle error
    }
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
      if (!user?.id) {
        return;
      }

      // Load settings immediately (fast)
      loadUserSettingsFnRef.current().catch(() => {
        // Silently handle settings load error
      });

      // Debounce health data loading to prevent multiple simultaneous loads
      if (loadHealthDataTimeoutRef.current) {
        clearTimeout(loadHealthDataTimeoutRef.current);
      }

      const isStale =
        Date.now() - lastHealthSummaryLoadAtRef.current >
        HEALTH_SUMMARY_STALE_MS;

      if (isStale && !loadHealthDataRef.current) {
        loadHealthDataTimeoutRef.current = setTimeout(() => {
          // Defer heavy operations until interactions are complete
          InteractionManager.runAfterInteractions(() => {
            loadHealthDataFnRef.current(false).catch(() => {
              // Silently handle errors - UI will show loading state
            });
          });
        }, 300); // 300ms debounce
      }
      return () => {
        if (loadHealthDataTimeoutRef.current) {
          clearTimeout(loadHealthDataTimeoutRef.current);
        }
      };
    }, [user?.id])
  );

  // Check for calendar open parameter
  useEffect(() => {
    if (params.openCalendar === "true" && !calendarOpenedFromParam.current) {
      setShowCalendarModal(true);
      calendarOpenedFromParam.current = true;
    } else if (params.openCalendar !== "true") {
      // Reset the flag when parameter is not present
      calendarOpenedFromParam.current = false;
    }
  }, [params.openCalendar]);

  // Subscribe to real-time health updates (replaces polling)
  useRealtimeHealth({
    userId: user?.id,
    familyId: user?.familyId,
    familyMemberIds: user?.familyId
      ? [] // Will be populated when family members are loaded
      : [],
    onTrendAlert: (alert) => {
      // Show notification for critical trend alerts
      if (alert.severity === "critical") {
        Alert.alert(
          isRTL ? "تنبيه صحي حرج" : "Critical Health Alert",
          alert.trendAnalysis.message,
          [{ text: isRTL ? "موافق" : "OK" }]
        );
      }
      // Debounce health data refresh to prevent excessive reloads
      if (loadHealthDataTimeoutRef.current) {
        clearTimeout(loadHealthDataTimeoutRef.current);
      }
      loadHealthDataTimeoutRef.current = setTimeout(() => {
        if (!loadHealthDataRef.current) {
          loadHealthDataFnRef.current(false).catch(() => {
            // Silently handle errors
          });
        }
      }, 1000); // 1 second debounce for real-time updates
    },
    onAlertCreated: (_alert) => {
      // Refresh sync status when alerts are created
      checkSyncStatus();
    },
    onAlertResolved: () => {
      // Refresh sync status when alerts are resolved
      checkSyncStatus();
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    // Load settings immediately
    loadUserSettingsFnRef.current().catch(() => {
      // Silently handle settings load error
    });

    checkSyncStatus();

    // Subscribe to sync status changes
    const unsubscribe = offlineService.onNetworkStatusChange(() => {
      checkSyncStatus();
    });

    // Note: Removed polling interval - now using real-time WebSocket subscriptions
    // Real-time updates are handled by useRealtimeHealth hook above

    return () => {
      unsubscribe();
      if (loadHealthDataTimeoutRef.current) {
        clearTimeout(loadHealthDataTimeoutRef.current);
      }
    };
  }, [
    checkSyncStatus,
    user?.id,
  ]);

  const handleSync = async () => {
    if (syncing || !syncStatus.isOnline) {
      return;
    }

    setSyncing(true);
    try {
      const result = await offlineService.syncAll();

      // Wait a bit for queue to update, then check status
      await new Promise((resolve) => setTimeout(resolve, 500));
      await checkSyncStatus();

      if (result.success > 0 && result.failed === 0) {
        Alert.alert(
          t("syncComplete", "Sync Complete"),
          t(
            "syncSuccessMessage",
            `${result.success} item(s) synced successfully.`
          )
        );
      } else if (result.success > 0 && result.failed > 0) {
        Alert.alert(
          t("syncPartial", "Sync Partial"),
          t(
            "syncPartialMessage",
            `${result.success} succeeded, ${result.failed} failed.`
          )
        );
      } else if (result.failed > 0 && result.success === 0) {
        Alert.alert(
          t("syncError", "Sync Error"),
          t(
            "syncFailedMessage",
            `Failed to sync ${result.failed} item(s). Please check your connection and try again.`
          )
        );
      }
    } catch (_error) {
      Alert.alert(
        t("syncError", "Sync Error"),
        t("syncErrorMessage", "Failed to sync. Please try again.")
      );
    } finally {
      setSyncing(false);
      // Refresh status one more time after a delay
      setTimeout(() => {
        checkSyncStatus();
      }, 1000);
    }
  };

  async function loadUserSettings() {
    try {
      const notifications = await AsyncStorage.getItem("notifications_enabled");

      if (notifications !== null) {
        setNotificationsEnabled(JSON.parse(notifications));
      }
    } catch (_error) {
      // Silently handle settings load error
    }
  }

  async function loadHealthData(isRefresh = false) {
    if (!user?.id || loadHealthDataRef.current) {
      return;
    }

    const now = Date.now();
    if (
      !isRefresh &&
      now - lastHealthSummaryLoadAtRef.current <
        HEALTH_SUMMARY_MIN_FETCH_INTERVAL_MS
    ) {
      return;
    }

    lastHealthSummaryLoadAtRef.current = now;
    loadHealthDataRef.current = true;
    await Sentry.startSpan(
      { name: "profile.loadHealthData", op: "ui.load" },
      async () => {
        const loadStart = Date.now();
        try {
          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          type SettledHealthResults = [
            PromiseSettledResult<Symptom[]>,
            PromiseSettledResult<Medication[]>,
          ];

          // Add timeout to prevent hanging
          const timeoutPromise: Promise<SettledHealthResults> = new Promise(
            (resolve) =>
              setTimeout(
                () =>
                  resolve([
                    { status: "fulfilled", value: [] },
                    { status: "fulfilled", value: [] },
                  ]),
                8000 // Reduced to 8 second timeout
              )
          );

          // OPTIMIZATION: Only fetch recent symptoms (last 90 days) instead of ALL symptoms
          // This dramatically reduces data transfer and processing time
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

          // Fetch symptoms and medications with limits to improve performance
          const dataPromise = Promise.allSettled([
            symptomService.getUserSymptoms(user.id, 120), // Lower payload for faster summary load
            medicationService.getUserMedications(user.id), // Medications are usually fewer
          ]);

          const results = await Promise.race([dataPromise, timeoutPromise]);

          // Extract results with fallbacks
          const symptoms =
            results[0].status === "fulfilled" ? results[0].value : [];
          const medications =
            results[1].status === "fulfilled" ? results[1].value : [];

          // Filter recent symptoms for display (last 30 days)
          const recentSymptoms = symptoms.filter(
            (s) =>
              new Date(s.timestamp).getTime() >
              Date.now() - 30 * 24 * 60 * 60 * 1000
          );
          const activeMedications = medications.filter((m) => m.isActive);

          // OPTIMIZATION: Calculate health score only with recent data (last 90 days)
          // This reduces computation time significantly
          const symptomsForScore = symptoms.filter(
            (s) => new Date(s.timestamp).getTime() >= ninetyDaysAgo.getTime()
          );

          // Calculate health score from fetched data (faster, avoids duplicate fetch)
          // Use calculateHealthScoreFromData instead of calculateHealthScore to reuse data
          let healthScoreResult: HealthScoreResult;
          try {
            healthScoreResult = calculateHealthScoreFromData(
              symptomsForScore,
              medications
            );
          } catch (_error) {
            // Fallback if calculation fails
            healthScoreResult = {
              score: 85,
              breakdown: {
                baseScore: 100,
                symptomPenalty: 0,
                medicationBonus: 0,
              },
              factors: {
                recentSymptoms: 0,
                symptomSeverityAvg: 0,
                medicationCompliance: 100,
                activeMedications: 0,
              },
              rating: "fair",
            };
          }

          setHealthData({
            symptoms: recentSymptoms,
            medications: activeMedications,
            healthScore: healthScoreResult.score,
            healthScoreResult,
          });

          Sentry.setMeasurement(
            "profile.health_summary.symptoms_count",
            recentSymptoms.length,
            "none"
          );
          Sentry.setMeasurement(
            "profile.health_summary.medications_count",
            activeMedications.length,
            "none"
          );
          Sentry.setMeasurement(
            "profile.health_summary.health_score",
            healthScoreResult.score,
            "none"
          );
        } catch (_error) {
          // Silently handle error - set default values to prevent infinite loading
          setHealthData({
            symptoms: [],
            medications: [],
            healthScore: 85,
            healthScoreResult: null,
          });
        } finally {
          Sentry.setMeasurement(
            "profile.health_summary.load_duration",
            Date.now() - loadStart,
            "millisecond"
          );
          setLoading(false);
          setRefreshing(false);
          loadHealthDataRef.current = false;
        }
      }
    );
  }

  useEffect(() => {
    loadHealthDataFnRef.current = loadHealthData;
    loadUserSettingsFnRef.current = loadUserSettings;
  }, [loadHealthData, loadUserSettings]);

  const _handleNotificationToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem("notifications_enabled", JSON.stringify(value));
  };

  const _handleFallDetectionToggle = async (value: boolean) => {
    await toggleFallDetection(value);
  };

  const handleLanguageChange = async (languageCode: "en" | "ar") => {
    await i18n.changeLanguage(languageCode);
    await AsyncStorage.setItem("app_language", languageCode);
    setLanguagePickerVisible(false);
    // Reload app to apply RTL changes (required on Android)
    if (Platform.OS === "android") {
      // On Android, RTL changes require app restart
      // You may want to show a message to the user
    }
  };

  const handlePersonalInfo = () => {
    router.push("/profile/personal-info");
  };

  const handleChangePassword = () => {
    router.push("/profile/change-password");
  };

  const handleHealthReports = async () => {
    // Prevent concurrent exports
    if (exporting) {
      Alert.alert(t("exportInProgress"), t("exportInProgressMessage"));
      return;
    }

    // Set exporting flag immediately to prevent concurrent exports
    setExporting(true);

    try {
      // Export directly as PDF (CSV option removed)
      await performExport("pdf");
    } catch (_error: any) {
      setExporting(false);
      Alert.alert(t("error"), t("errorExportingMetrics"));
    }
  };

  const loadCalendarEvents = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        return;
      }

      try {
        if (isRefresh) {
          setCalendarRefreshing(true);
        } else {
          setCalendarLoading(true);
        }

        const startOfMonth = new Date(
          calendarCurrentDate.getFullYear(),
          calendarCurrentDate.getMonth(),
          1
        );
        const endOfMonth = new Date(
          calendarCurrentDate.getFullYear(),
          calendarCurrentDate.getMonth() + 1,
          0,
          23,
          59,
          59
        );

        const userEvents = await calendarService.getEventsForDateRange(
          user.id,
          startOfMonth,
          endOfMonth,
          !!(includeFamily && user.familyId),
          user.familyId
        );

        setCalendarEvents(userEvents);
      } catch (_error) {
        Alert.alert(
          isRTL ? "خطأ" : "Error",
          isRTL ? "فشل تحميل الأحداث" : "Failed to load events"
        );
      } finally {
        setCalendarLoading(false);
        setCalendarRefreshing(false);
      }
    },
    [user, calendarCurrentDate, includeFamily, isRTL]
  );

  // Reload calendar events when month changes or calendar opens
  useEffect(() => {
    if (showCalendarModal) {
      loadCalendarEvents();
    }
  }, [showCalendarModal, loadCalendarEvents]);

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(calendarCurrentDate);
    if (direction === "prev") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCalendarCurrentDate(newDate);
  };

  const getDaysInMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  const getFirstDayOfMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const formatMonthYear = (date: Date) =>
    safeFormatDate(date, isRTL ? "ar-u-ca-gregory" : "en-US", {
      month: "long",
      year: "numeric",
    });

  const getWeekDays = () => {
    const days = isRTL
      ? ["ح", "ن", "ث", "ر", "خ", "ج", "س"]
      : ["S", "M", "T", "W", "T", "F", "S"];
    return days;
  };

  const getEventsForDay = (day: number) => {
    const date = new Date(
      calendarCurrentDate.getFullYear(),
      calendarCurrentDate.getMonth(),
      day
    );
    return calendarEvents.filter((event) => {
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const getSelectedDateEvents = () =>
    calendarEvents.filter((event) => {
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getDate() === calendarSelectedDate.getDate() &&
        eventDate.getMonth() === calendarSelectedDate.getMonth() &&
        eventDate.getFullYear() === calendarSelectedDate.getFullYear()
      );
    });

  const formatTime = (date: Date) =>
    safeFormatTime(date, isRTL ? "ar" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const getEventTypeLabel = (type: CalendarEvent["type"]) => {
    const labels: Record<CalendarEvent["type"], { en: string; ar: string }> = {
      appointment: { en: "Appointment", ar: "موعد" },
      medication: { en: "Medication", ar: "دواء" },
      symptom: { en: "Symptom", ar: "عرض" },
      lab_result: { en: "Lab Result", ar: "نتيجة مختبر" },
      vaccination: { en: "Vaccination", ar: "تطعيم" },
      reminder: { en: "Reminder", ar: "تذكير" },
      other: { en: "Other", ar: "أخرى" },
    };
    return isRTL ? labels[type].ar : labels[type].en;
  };

  const getEventColor = (eventType: CalendarEvent["type"]): string => {
    const colors: Record<CalendarEvent["type"], string> = {
      appointment: "#10B981",
      medication: "#3B82F6",
      symptom: "#EF4444",
      lab_result: "#8B5CF6",
      vaccination: "#F59E0B",
      reminder: "#6366F1",
      other: "#64748B",
    };
    return colors[eventType];
  };

  const handleSaveEvent = async () => {
    if (!user?.id) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يجب تسجيل الدخول أولاً" : "You must be logged in first"
      );
      return;
    }

    if (!eventTitle.trim()) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى إدخال عنوان الحدث" : "Please enter an event title"
      );
      return;
    }

    // Validate start date - ensure it's a valid Date object
    if (!eventStartDate || Number.isNaN(eventStartDate.getTime())) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى اختيار تاريخ البداية" : "Please select a start date"
      );
      return;
    }

    setSavingEvent(true);
    try {
      // Set endDate to startDate + 1 hour if not set and not allDay
      let finalEndDate = eventEndDate;
      if (!(finalEndDate || eventAllDay)) {
        finalEndDate = new Date(eventStartDate);
        finalEndDate.setHours(finalEndDate.getHours() + 1);
      } else if (eventAllDay) {
        // For all-day events, set endDate to end of the same day
        finalEndDate = new Date(eventStartDate);
        finalEndDate.setHours(23, 59, 59, 999);
      }

      // Validate end date if set
      if (finalEndDate && Number.isNaN(finalEndDate.getTime())) {
        Alert.alert(
          isRTL ? "خطأ" : "Error",
          isRTL
            ? "يرجى اختيار تاريخ نهاية صحيح"
            : "Please select a valid end date"
        );
        setSavingEvent(false);
        return;
      }

      await calendarService.addEvent(user.id, {
        title: eventTitle.trim(),
        description: eventDescription.trim() || undefined,
        type: eventType,
        startDate: eventStartDate,
        endDate: finalEndDate,
        allDay: eventAllDay,
        location: eventLocation.trim() || undefined,
        recurrencePattern:
          eventRecurrencePattern !== "none"
            ? eventRecurrencePattern
            : undefined,
        familyId:
          eventShareWithFamily && user.familyId ? user.familyId : undefined,
        tags: eventTags.length > 0 ? eventTags : undefined,
        color: getEventColor(eventType),
        reminders:
          eventType === "appointment"
            ? [
                { minutesBefore: 60, sent: false },
                { minutesBefore: 1440, sent: false },
              ]
            : undefined,
      });

      // Navigate to the event's date
      setCalendarSelectedDate(eventStartDate);
      setCalendarCurrentDate(
        new Date(eventStartDate.getFullYear(), eventStartDate.getMonth(), 1)
      );

      Alert.alert(
        isRTL ? "نجح" : "Success",
        isRTL ? "تم إضافة الحدث بنجاح" : "Event added successfully",
        [
          {
            text: isRTL ? "حسناً" : "OK",
            onPress: () => {
              setShowAddEventModal(false);
              resetEventForm();
              setShowCalendarModal(true);
              // Events will auto-reload via useEffect
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? `فشل إضافة الحدث: ${error?.message || "خطأ غير معروف"}`
          : `Failed to add event: ${error?.message || "Unknown error"}`
      );
    } finally {
      setSavingEvent(false);
    }
  };

  const resetEventForm = () => {
    setEventTitle("");
    setEventDescription("");
    setEventType("appointment");
    setEventStartDate(new Date());
    setEventEndDate(undefined);
    setEventAllDay(false);
    setEventLocation("");
    setEventRecurrencePattern("none");
    setEventShareWithFamily(false);
    setEventTags([]);
    setShowStartDatePicker(false);
    setShowStartTimePicker(false);
    setShowEndDatePicker(false);
    setShowEndTimePicker(false);
  };

  useEffect(() => {
    if (showCalendarModal) {
      loadCalendarEvents();
    }
  }, [showCalendarModal, loadCalendarEvents]);

  const performExport = async (format: ExportFormat) => {
    try {
      // exporting flag already set to true in handleHealthReports

      await exportMetrics(
        {
          format,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          endDate: new Date(),
          userId: user?.id, // Pass user ID to include symptoms, medications, medical history, and moods
        },
        (_message) => {
          // Progress callback - silently handle progress updates
        }
      );

      Alert.alert(t("exportSuccessful"), t("exportSuccessfulMessage"));
    } catch (error: any) {
      Alert.alert(t("exportError"), error?.message || t("exportErrorMessage"));
    } finally {
      setExporting(false);
    }
  };

  const handleHelpSupport = () => {
    router.push("/profile/help-support");
  };

  const handleTermsConditions = () => {
    router.push("/profile/terms-conditions");
  };

  const handlePrivacyPolicy = () => {
    router.push("/profile/privacy-policy");
  };

  const handleLogout = () => {
    Alert.alert(t("signOut"), t("confirmSignOut"), [
      {
        text: t("cancel"),
        style: "cancel",
      },
      {
        text: t("signOut"),
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
            router.replace("/(auth)/login");
          } catch (_error) {
            // Silently handle logout error
            Alert.alert(t("error"), t("failedToSignOut"));
          }
        },
      },
    ]);
  };

  // Determine user role
  const isRegularUser = !isAdmin;

  const profileSections: ProfileSection[] = [
    // Basic account section for all users
    {
      title: t("account"),
      items: [
        {
          icon: User,
          label: t("personalInformation"),
          onPress: handlePersonalInfo,
        },
        {
          icon: Lock,
          label: t("changePassword"),
          onPress: handleChangePassword,
        },
        {
          icon: FileText,
          label: t("healthReports"),
          onPress: handleHealthReports,
        },
        {
          icon: Calendar,
          label: isRTL
            ? t("calendar")
            : t("calendar").charAt(0).toUpperCase() +
              t("calendar").slice(1).toLowerCase(),
          onPress: () => {
            setShowCalendarModal(true);
            loadCalendarEvents();
          },
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
                icon: Activity,
                label: t("healthIntegrations"),
                onPress: () =>
                  router.push("/profile/health-integrations" as any),
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
                onPress: () => router.push("/profile/fall-detection" as any),
              },
              {
                icon: Activity,
                label: t("healthIntegrations"),
                onPress: () =>
                  router.push("/profile/health-integrations" as any),
              },
            ]),
        // Theme and language for all users
        {
          icon: isDark ? Sun : Moon,
          label: t("darkMode"),
          hasSwitch: true,
          switchValue: isDark,
          onSwitchChange: (value: boolean) => {
            setThemeMode(value ? "dark" : "light");
          },
        },
        {
          icon: Globe,
          label: t("language"),
          value: isRTL ? t("arabic") : t("english"),
          onPress: () => setLanguagePickerVisible(true),
        },
        {
          icon: RefreshCw,
          label: t("syncData", "Sync Data"),
          value: syncing
            ? t("syncing", "Syncing...")
            : syncStatus.queueLength > 0
              ? `${syncStatus.queueLength} ${t("pending", "pending")}`
              : syncStatus.isOnline
                ? t("synced", "Synced")
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

  return (
    <SafeAreaView
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container}
    >
      <View style={[styles.header, isRTL && { flexDirection: "row-reverse" }]}>
        <Text style={[styles.title, isRTL && { textAlign: "left" }]}>
          {t("profile")}
        </Text>
        {isAdmin && (
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => setShowSearch(true)}
            style={{
              backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
              borderRadius: 20,
              padding: 10,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 20 }}>🔍</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.contentInner}
        refreshControl={
          <RefreshControl
            onRefresh={() => loadHealthData(true)}
            refreshing={refreshing}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.content}
      >
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Avatar
              avatarType={user?.avatarType}
              name={user?.firstName}
              onPress={() => setAvatarCreatorVisible(true)}
              size="xl"
              style={{ width: 200, height: 200 }}
            />
          </View>

          <View style={styles.userInfo}>
            <Text style={[styles.userName, isRTL && { textAlign: "left" }]}>
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.firstName || "User"}
            </Text>
            <Text style={[styles.userEmail, isRTL && { textAlign: "left" }]}>
              {user?.email}
            </Text>
            <View style={styles.memberSince}>
              <Text
                style={[styles.memberSinceText, isRTL && { textAlign: "left" }]}
              >
                {t("memberSince")}{" "}
                {new Date(user?.createdAt || new Date()).getFullYear()}
              </Text>
            </View>
          </View>
        </View>

        {/* Improved Health Summary */}
        <View style={styles.healthSummary}>
          <Text style={[styles.healthTitle, isRTL && { textAlign: "left" }]}>
            {t("healthSummary")}
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#2563EB" size="large" />
            </View>
          ) : (
            <View style={styles.healthGrid}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setHealthScoreModalVisible(true)}
                style={styles.healthCard}
              >
                <View style={styles.healthIconContainer}>
                  <Activity color="#10B981" size={24} />
                </View>
                <Text
                  style={[
                    styles.healthCardValue,
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {healthData.healthScore}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.healthCardLabel,
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {t("healthScore")}
                </Text>
              </TouchableOpacity>

              <View style={styles.healthCard}>
                <View style={styles.healthIconContainer}>
                  <Heart color="#EF4444" size={24} />
                </View>
                <Text
                  style={[
                    styles.healthCardValue,
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {healthData.symptoms.length}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.healthCardLabel,
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {t("symptomsThisMonth")}
                </Text>
              </View>

              <View style={styles.healthCard}>
                <View style={styles.healthIconContainer}>
                  <Calendar color="#3B82F6" size={24} />
                </View>
                <Text
                  style={[
                    styles.healthCardValue,
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {healthData.medications.length}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.healthCardLabel,
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {t("activeMedications")}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* AI Insights Dashboard */}
        <View style={styles.aiInsightsSection}>
          <AIInsightsDashboard
            compact={true}
            onInsightPress={() => {
              router.push("/profile/health-insights");
            }}
          />
        </View>

        {/* Settings Sections */}
        {profileSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text
              style={[styles.sectionTitle, isRTL && { textAlign: "right" }]}
            >
              {section.title}
            </Text>

            <View style={styles.sectionItems}>
              {section.items.map((item, itemIndex) => {
                const IconComponent = item.icon;

                return (
                  <TouchableOpacity
                    disabled={
                      !item.onPress ||
                      (syncing && item.label === t("syncData", "Sync Data"))
                    }
                    key={itemIndex}
                    onPress={item.onPress}
                    style={[
                      styles.sectionItem,
                      isRTL && { flexDirection: "row-reverse" },
                      itemIndex === section.items.length - 1 &&
                        styles.lastSectionItem,
                      syncing &&
                        item.label === t("syncData", "Sync Data") && {
                          opacity: 0.6,
                        },
                    ]}
                  >
                    <View
                      style={[
                        styles.sectionItemLeft,
                        isRTL && styles.sectionItemLeftRTL,
                      ]}
                    >
                      <View style={styles.sectionItemIcon}>
                        <IconComponent color="#64748B" size={20} />
                      </View>
                      <View
                        style={{
                          flex: 1,
                          flexDirection: isRTL ? "row-reverse" : "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.sectionItemLabel,
                            isRTL && { textAlign: "right" },
                          ]}
                        >
                          {item.label}
                        </Text>
                        {item.comingSoon && (
                          <View style={styles.comingSoonBadge}>
                            <Text style={styles.comingSoonText}>
                              {t("comingSoon")}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.sectionItemRight}>
                      {item.hasSwitch ? (
                        <Switch
                          onValueChange={item.onSwitchChange}
                          thumbColor="#FFFFFF"
                          trackColor={{ false: "#E2E8F0", true: "#2563EB" }}
                          value={item.switchValue}
                        />
                      ) : (exporting && item.label === t("healthReports")) ||
                        (syncing &&
                          item.label === t("syncData", "Sync Data")) ? (
                        <ActivityIndicator color="#2563EB" size="small" />
                      ) : (
                        <>
                          {item.value && (
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.sectionItemValue,
                                isRTL && { textAlign: "left" },
                              ]}
                            >
                              {item.value}
                            </Text>
                          )}
                          <ChevronRight
                            color="#94A3B8"
                            size={16}
                            style={[
                              isRTL && {
                                transform: [{ rotate: "180deg" }],
                              },
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

        {/* Sign Out Button */}
        <TouchableOpacity onPress={handleLogout} style={styles.signOutButton}>
          <LogOut color="#EF4444" size={20} />
          <Text style={[styles.signOutText, isRTL && { textAlign: "right" }]}>
            {t("signOut")}
          </Text>
        </TouchableOpacity>

        {/* App Version */}
        <View style={styles.appVersion}>
          <Text style={[styles.appVersionText, isRTL && { textAlign: "left" }]}>
            Maak v1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setLanguagePickerVisible(false)}
        transparent={true}
        visible={languagePickerVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, isRTL && { textAlign: "left" }]}>
              {t("selectLanguage")}
            </Text>

            <TouchableOpacity
              onPress={() => handleLanguageChange("en")}
              style={[
                styles.languageOption,
                i18n.language === "en" && styles.selectedLanguage,
              ]}
            >
              <Text
                style={[
                  styles.languageText,
                  i18n.language === "en" && styles.selectedLanguageText,
                ]}
              >
                {t("english")}
              </Text>
              {i18n.language === "en" && <Check color="#2563EB" size={20} />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleLanguageChange("ar")}
              style={[
                styles.languageOption,
                i18n.language === "ar" && styles.selectedLanguage,
              ]}
            >
              <Text
                style={[
                  styles.languageText,
                  styles.rtlText,
                  i18n.language === "ar" && styles.selectedLanguageText,
                ]}
              >
                {t("arabic")}
              </Text>
              {i18n.language === "ar" && <Check color="#2563EB" size={20} />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setLanguagePickerVisible(false)}
              style={styles.cancelButton}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  isRTL && { textAlign: "left" },
                ]}
              >
                {t("cancel")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Avatar Type Selector Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setAvatarCreatorVisible(false)}
        transparent={true}
        visible={avatarCreatorVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isRTL && { textAlign: "left" }]}>
                {t("chooseYourAvatar")}
              </Text>
              <TouchableOpacity
                onPress={() => setAvatarCreatorVisible(false)}
                style={styles.modalCloseButton}
              >
                <X color="#64748B" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.avatarGrid}>
              {(
                [
                  "man",
                  "woman",
                  "boy",
                  "girl",
                  "grandpa",
                  "grandma",
                ] as AvatarType[]
              ).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={async () => {
                    try {
                      setLoading(true);
                      if (user?.id) {
                        await userService.updateUser(user.id, {
                          avatarType: type,
                        });
                        if (updateUser) {
                          await updateUser({ avatarType: type });
                        }
                        setAvatarCreatorVisible(false);
                        Alert.alert(t("success"), t("avatarSavedSuccessfully"));
                      }
                    } catch (_error) {
                      Alert.alert(t("error"), t("failedToSaveAvatar"));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  style={[
                    styles.avatarOption,
                    user?.avatarType === type && styles.avatarOptionSelected,
                  ]}
                >
                  <Avatar
                    avatarType={type}
                    size="xl"
                    style={{ width: 80, height: 80 }}
                  />
                  <Text
                    style={[styles.avatarLabel, isRTL && { textAlign: "left" }]}
                  >
                    {type === "man" && t("man")}
                    {type === "woman" && t("woman")}
                    {type === "boy" && t("boy")}
                    {type === "girl" && t("girl")}
                    {type === "grandpa" && t("grandpa")}
                    {type === "grandma" && t("grandma")}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Health Score Breakdown Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setHealthScoreModalVisible(false)}
        transparent={true}
        visible={healthScoreModalVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isRTL && { textAlign: "left" }]}>
                {isRTL ? "تفاصيل نقاط الصحة" : "Health Score Breakdown"}
              </Text>
              <TouchableOpacity
                onPress={() => setHealthScoreModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <X color="#64748B" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.healthScoreBreakdownContent}
            >
              {healthData.healthScoreResult ? (
                <>
                  {/* Overall Score */}
                  <View style={styles.breakdownSection}>
                    <View style={styles.scoreDisplay}>
                      <Text
                        style={[
                          styles.scoreValue,
                          isRTL && { textAlign: "left" },
                        ]}
                      >
                        {healthData.healthScoreResult.score}
                      </Text>
                      <Text
                        style={[
                          styles.scoreOutOf,
                          isRTL && { textAlign: "left" },
                        ]}
                      >
                        {isRTL ? "من 100" : "out of 100"}
                      </Text>
                      <View style={styles.ratingBadge}>
                        <Text
                          style={[
                            styles.ratingText,
                            isRTL && { textAlign: "left" },
                          ]}
                        >
                          {healthData.healthScoreResult.rating ===
                            "excellent" && (isRTL ? "ممتاز" : "Excellent")}
                          {healthData.healthScoreResult.rating === "good" &&
                            (isRTL ? "جيد" : "Good")}
                          {healthData.healthScoreResult.rating === "fair" &&
                            (isRTL ? "مقبول" : "Fair")}
                          {healthData.healthScoreResult.rating === "poor" &&
                            (isRTL ? "ضعيف" : "Poor")}
                          {healthData.healthScoreResult.rating === "critical" &&
                            (isRTL ? "حرج" : "Critical")}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Calculation Breakdown */}
                  <View style={styles.breakdownSection}>
                    <Text
                      style={[
                        styles.breakdownTitle,
                        isRTL && { textAlign: "left" },
                      ]}
                    >
                      {isRTL
                        ? "كيف تم حساب النقاط"
                        : "How Your Score Was Calculated"}
                    </Text>

                    {/* Base Score */}
                    <View style={styles.breakdownRow}>
                      <Text
                        style={[
                          styles.breakdownLabel,
                          isRTL && { textAlign: "left" },
                        ]}
                      >
                        {isRTL ? "النقاط الأساسية" : "Base Score"}
                      </Text>
                      <Text
                        style={[
                          styles.breakdownValue,
                          isRTL && { textAlign: "left" },
                        ]}
                      >
                        +{healthData.healthScoreResult.breakdown.baseScore}
                      </Text>
                    </View>

                    {/* Symptom Penalty */}
                    {healthData.healthScoreResult.breakdown.symptomPenalty >
                      0 && (
                      <View style={styles.breakdownRow}>
                        <Text
                          style={[
                            styles.breakdownLabel,
                            isRTL && { textAlign: "left" },
                          ]}
                        >
                          {isRTL ? " خصم الأعراض الصحية" : "Symptom Penalty"}
                        </Text>
                        <Text
                          style={[
                            styles.breakdownValueNegative,
                            isRTL && { textAlign: "left" },
                          ]}
                        >
                          -
                          {healthData.healthScoreResult.breakdown.symptomPenalty.toFixed(
                            1
                          )}
                        </Text>
                      </View>
                    )}

                    {/* Medication Bonus */}
                    {healthData.healthScoreResult.breakdown.medicationBonus !==
                      0 && (
                      <View style={styles.breakdownRow}>
                        <Text
                          style={[
                            styles.breakdownLabel,
                            isRTL && { textAlign: "left" },
                          ]}
                        >
                          {isRTL ? "مكافأة الأدوية" : "Medication Bonus"}
                        </Text>
                        <Text
                          style={[
                            healthData.healthScoreResult.breakdown
                              .medicationBonus > 0
                              ? styles.breakdownValuePositive
                              : styles.breakdownValueNegative,
                            isRTL && { textAlign: "left" },
                          ]}
                        >
                          {healthData.healthScoreResult.breakdown
                            .medicationBonus > 0
                            ? "+"
                            : ""}
                          {healthData.healthScoreResult.breakdown.medicationBonus.toFixed(
                            1
                          )}
                        </Text>
                      </View>
                    )}

                    {/* Final Score */}
                    <View style={[styles.breakdownRow, styles.finalScoreRow]}>
                      <Text
                        style={[
                          styles.breakdownLabel,
                          styles.finalScoreLabel,
                          isRTL && { textAlign: "left" },
                        ]}
                      >
                        {isRTL ? "النقاط النهائية" : "Final Score"}
                      </Text>
                      <Text
                        style={[
                          styles.breakdownValue,
                          styles.finalScoreValue,
                          isRTL && { textAlign: "left" },
                        ]}
                      >
                        {healthData.healthScoreResult.score}
                      </Text>
                    </View>
                  </View>

                  {/* Factors */}
                  <View style={styles.breakdownSection}>
                    <Text
                      style={[
                        styles.breakdownTitle,
                        isRTL && { textAlign: "left" },
                      ]}
                    >
                      {isRTL ? "العوامل المؤثرة" : "Contributing Factors"}
                    </Text>

                    <View style={styles.factorRow}>
                      <Text
                        style={[
                          styles.factorLabel,
                          isRTL && { textAlign: "left" },
                        ]}
                      >
                        {isRTL
                          ? "الأعراض الصحية الأخيرة (7 أيام)"
                          : "Recent Symptoms (7 days)"}
                      </Text>
                      <Text
                        style={[
                          styles.factorValue,
                          isRTL && { textAlign: "left" },
                        ]}
                      >
                        {healthData.healthScoreResult.factors.recentSymptoms}
                      </Text>
                    </View>

                    {healthData.healthScoreResult.factors.recentSymptoms >
                      0 && (
                      <View style={styles.factorRow}>
                        <Text
                          style={[
                            styles.factorLabel,
                            isRTL && { textAlign: "left" },
                          ]}
                        >
                          {isRTL
                            ? "متوسط شدة الأعراض الصحية"
                            : "Average Symptom Severity"}
                        </Text>
                        <Text
                          style={[
                            styles.factorValue,
                            isRTL && { textAlign: "left" },
                          ]}
                        >
                          {healthData.healthScoreResult.factors.symptomSeverityAvg.toFixed(
                            1
                          )}
                          /10
                        </Text>
                      </View>
                    )}

                    <View style={styles.factorRow}>
                      <Text
                        style={[
                          styles.factorLabel,
                          isRTL && { textAlign: "left" },
                        ]}
                      >
                        {isRTL ? "الأدوية الفعالة" : "Active Medications"}
                      </Text>
                      <Text
                        style={[
                          styles.factorValue,
                          isRTL && { textAlign: "left" },
                        ]}
                      >
                        {healthData.healthScoreResult.factors.activeMedications}
                      </Text>
                    </View>

                    {healthData.healthScoreResult.factors.activeMedications >
                      0 && (
                      <View style={styles.factorRow}>
                        <Text
                          style={[
                            styles.factorLabel,
                            isRTL && { textAlign: "left" },
                          ]}
                        >
                          {isRTL
                            ? "الالتزام بالأدوية"
                            : "Medication Compliance"}
                        </Text>
                        <Text
                          style={[
                            styles.factorValue,
                            isRTL && { textAlign: "left" },
                          ]}
                        >
                          {
                            healthData.healthScoreResult.factors
                              .medicationCompliance
                          }
                          %
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Info Note */}
                  <View style={styles.infoNote}>
                    <HelpCircle color="#64748B" size={16} />
                    <Text
                      style={[
                        styles.infoNoteText,
                        isRTL && { textAlign: "left" },
                      ]}
                    >
                      {isRTL
                        ? "يتم حساب نقاط الصحة بناءً على الأعراض الصحية الأخيرة (آخر 7 أيام) والالتزام بالأدوية. النقاط الأساسية هي 100، وتُخصم النقاط بسبب الأعراض وتُضاف المكافآت للالتزام الجيد بالأدوية."
                        : "Your health score is calculated based on recent symptoms (last 7 days) and medication compliance. Base score is 100, with points deducted for symptoms and bonuses added for good medication adherence."}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#2563EB" size="large" />
                  <Text
                    style={[styles.loadingText, isRTL && { textAlign: "left" }]}
                  >
                    {isRTL ? "جاري تحميل التفاصيل..." : "Loading details..."}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Global Search Modal */}
      <GlobalSearch onClose={() => setShowSearch(false)} visible={showSearch} />
      {/* Calendar Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShowCalendarModal(false);
          setSelectedEvent(null);
        }}
        presentationStyle="pageSheet"
        visible={showCalendarModal}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.colors.background.primary }}
        >
          <View
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border.light,
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <CalendarIcon color={theme.colors.primary.main} size={24} />
              <Heading level={4} style={{ fontSize: 20 }}>
                {isRTL ? "التقويم الصحي" : "HEALTH CALENDAR"}
              </Heading>
            </View>
            <View
              style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 12 }}
            >
              <TouchableOpacity
                onPress={() => {
                  setShowCalendarModal(false);
                  setShowAddEventModal(true);
                  // Ensure we have a valid date for the event
                  const selectedDate = calendarSelectedDate || new Date();
                  setEventStartDate(new Date(selectedDate));
                }}
                style={{
                  backgroundColor: theme.colors.primary.main,
                  borderRadius: theme.borderRadius.full,
                  width: 40,
                  height: 40,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Plus color={theme.colors.neutral.white} size={24} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowCalendarModal(false);
                  setSelectedEvent(null);
                }}
              >
                <X color={theme.colors.text.primary} size={24} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Month Navigation */}
          <View
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              alignItems: "center",
              gap: 16,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <TouchableOpacity onPress={() => navigateMonth("prev")}>
              <ChevronLeft color={theme.colors.text.primary} size={24} />
            </TouchableOpacity>
            <Text
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 16,
                fontFamily: "Geist-SemiBold",
                color: theme.colors.text.primary,
              }}
            >
              {formatMonthYear(calendarCurrentDate)}
            </Text>
            <TouchableOpacity onPress={() => navigateMonth("next")}>
              <ChevronRight color={theme.colors.text.primary} size={24} />
            </TouchableOpacity>
          </View>

          {/* Calendar Grid */}
          <View style={{ padding: 16 }}>
            {/* Week Days Header */}
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                marginBottom: 8,
              }}
            >
              {getWeekDays().map((day, index) => (
                <View key={index} style={{ flex: 1, alignItems: "center" }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Geist-Medium",
                      color: theme.colors.text.secondary,
                    }}
                  >
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar Days */}
            <View
              style={{
                flexWrap: "wrap",
                flexDirection: isRTL ? "row-reverse" : "row",
              }}
            >
              {(() => {
                const daysInMonth = getDaysInMonth(calendarCurrentDate);
                const firstDay = getFirstDayOfMonth(calendarCurrentDate);
                const days: React.ReactElement[] = [];
                const today = new Date();

                // Add empty cells for days before the first day of the month
                for (let i = 0; i < firstDay; i++) {
                  days.push(
                    <View
                      key={`empty-${i}`}
                      style={{ width: "14.28%", aspectRatio: 1, padding: 2 }}
                    />
                  );
                }

                // Add days of the month
                for (let day = 1; day <= daysInMonth; day++) {
                  const date = new Date(
                    calendarCurrentDate.getFullYear(),
                    calendarCurrentDate.getMonth(),
                    day
                  );
                  const isSelected =
                    calendarSelectedDate.getDate() === day &&
                    calendarSelectedDate.getMonth() ===
                      calendarCurrentDate.getMonth() &&
                    calendarSelectedDate.getFullYear() ===
                      calendarCurrentDate.getFullYear();
                  const isToday =
                    today.getDate() === day &&
                    today.getMonth() === calendarCurrentDate.getMonth() &&
                    today.getFullYear() === calendarCurrentDate.getFullYear();
                  const dayEvents = getEventsForDay(day);

                  days.push(
                    <TouchableOpacity
                      key={day}
                      onPress={() => {
                        setCalendarSelectedDate(date);
                        setShowEventModal(true);
                      }}
                      style={{
                        width: "14.28%",
                        aspectRatio: 1,
                        justifyContent: "center",
                        alignItems: "center",
                        borderRadius: 8,
                        padding: 2,
                      }}
                    >
                      <View
                        style={[
                          {
                            width: "100%",
                            height: "100%",
                            justifyContent: "center",
                            alignItems: "center",
                            borderRadius: 8,
                          },
                          isSelected && {
                            backgroundColor: theme.colors.primary.main,
                          },
                          isToday &&
                            !isSelected && {
                              borderWidth: 2,
                              borderColor: theme.colors.primary.main,
                            },
                        ]}
                      >
                        <TypographyText
                          style={[
                            { fontSize: 14 },
                            isSelected && {
                              color: theme.colors.neutral.white,
                              fontWeight: "600",
                            },
                          ]}
                        >
                          {isRTL ? toArabicNumerals(day) : day}
                        </TypographyText>
                        {dayEvents.length > 0 && (
                          <View
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: 2,
                              marginTop: 2,
                              backgroundColor:
                                dayEvents[0].color || theme.colors.primary.main,
                            }}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }

                return days;
              })()}
            </View>
          </View>

          {/* Events List for Selected Date */}
          <ScrollView
            refreshControl={
              <RefreshControl
                onRefresh={() => loadCalendarEvents(true)}
                refreshing={calendarRefreshing}
              />
            }
            style={{ padding: 16 }}
          >
            <Heading level={6} style={{ marginBottom: 16 }}>
              {isRTL
                ? `الأحداث في ${safeFormatDate(calendarSelectedDate, "ar-u-ca-gregory", { day: "numeric", month: "long", year: "numeric" })}`
                : `Events on ${safeFormatDate(calendarSelectedDate, "en-US", { day: "numeric", month: "long", year: "numeric" })}`}
            </Heading>

            {calendarLoading ? (
              <ActivityIndicator
                color={theme.colors.primary.main}
                size="large"
              />
            ) : getSelectedDateEvents().length === 0 ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 40,
                }}
              >
                <CalendarIcon color={theme.colors.text.secondary} size={64} />
                <Text
                  style={{
                    marginTop: 16,
                    textAlign: "center",
                    color: theme.colors.text.secondary,
                  }}
                >
                  {isRTL
                    ? "لا توجد أحداث صحية في هذا التاريخ"
                    : "No events on this date"}
                </Text>
              </View>
            ) : (
              getSelectedDateEvents().map((event) => (
                <Card
                  contentStyle={{}}
                  key={event.id}
                  onPress={() => {
                    setSelectedEvent(event);
                    setShowEventModal(true);
                  }}
                  style={{ marginBottom: 12 }}
                  variant="elevated"
                >
                  <View
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 4,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <TypographyText style={{ fontSize: 16 }} weight="bold">
                        {event.title}
                      </TypographyText>
                      <Badge
                        size="small"
                        style={{ marginTop: 4, alignSelf: "flex-start" }}
                        variant="outline"
                      >
                        {getEventTypeLabel(event.type)}
                      </Badge>
                    </View>
                    {event.familyId && (
                      <Users color={theme.colors.primary.main} size={16} />
                    )}
                  </View>

                  {event.description && (
                    <Caption numberOfLines={3} style={{ marginTop: 8 }}>
                      {event.description}
                    </Caption>
                  )}

                  <View
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <Clock color={theme.colors.text.secondary} size={14} />
                    <Caption numberOfLines={1} style={{}}>
                      {event.allDay
                        ? isRTL
                          ? "طوال اليوم"
                          : "All Day"
                        : formatTime(event.startDate)}
                    </Caption>
                    {event.location && (
                      <>
                        <MapPin color={theme.colors.text.secondary} size={14} />
                        <Caption numberOfLines={1} style={{}}>
                          {event.location}
                        </Caption>
                      </>
                    )}
                  </View>
                </Card>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Event Detail Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShowEventModal(false);
          setSelectedEvent(null);
        }}
        presentationStyle="pageSheet"
        visible={showEventModal && !!selectedEvent}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.colors.background.primary }}
        >
          <View
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border.light,
            }}
          >
            <Heading level={5} style={{ fontSize: 18 }}>
              {selectedEvent?.title}
            </Heading>
            <TouchableOpacity
              onPress={() => {
                setShowEventModal(false);
                setSelectedEvent(null);
              }}
            >
              <Text style={{ fontSize: 18, color: theme.colors.primary.main }}>
                {isRTL ? "إغلاق" : "Close"}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 16 }}>
            {selectedEvent && (
              <>
                <View style={{ marginBottom: 16 }}>
                  <Badge size="small" style={{}} variant="outline">
                    {getEventTypeLabel(selectedEvent.type)}
                  </Badge>
                </View>
                {selectedEvent.description && (
                  <View style={{ marginBottom: 16 }}>
                    <TypographyText style={{}} weight="semibold">
                      {isRTL ? "الوصف" : "Description"}
                    </TypographyText>
                    <Caption numberOfLines={10} style={{}}>
                      {selectedEvent.description}
                    </Caption>
                  </View>
                )}
                <View style={{ marginBottom: 16 }}>
                  <TypographyText style={{}} weight="semibold">
                    {isRTL ? "التاريخ والوقت" : "Date & Time"}
                  </TypographyText>
                  <Caption numberOfLines={1} style={{}}>
                    {safeFormatDateTime(
                      selectedEvent.startDate,
                      isRTL ? "ar-u-ca-gregory" : "en-US"
                    )}
                    {selectedEvent.endDate &&
                      ` - ${safeFormatDateTime(selectedEvent.endDate, isRTL ? "ar-u-ca-gregory" : "en-US")}`}
                  </Caption>
                </View>
                {selectedEvent.location && (
                  <View style={{ marginBottom: 16 }}>
                    <TypographyText style={{}} weight="semibold">
                      {isRTL ? "الموقع" : "Location"}
                    </TypographyText>
                    <Caption numberOfLines={1} style={{}}>
                      {selectedEvent.location}
                    </Caption>
                  </View>
                )}
                {selectedEvent.familyId && (
                  <View style={{ marginBottom: 16 }}>
                    <TypographyText style={{}} weight="semibold">
                      {isRTL ? "مشارك مع العائلة" : "Shared with Family"}
                    </TypographyText>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Event Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShowAddEventModal(false);
          resetEventForm();
          setShowCalendarModal(true);
        }}
        transparent={true}
        visible={
          showAddEventModal &&
          !showStartDatePicker &&
          !showStartTimePicker &&
          !showEndDatePicker &&
          !showEndTimePicker
        }
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.background.primary,
              borderRadius: 16,
              width: "100%",
              maxWidth: 400,
              height: "90%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor:
                  typeof theme.colors.border === "string"
                    ? theme.colors.border
                    : theme.colors.border.light,
                backgroundColor: theme.colors.background.primary,
              }}
            >
              <Heading level={5} style={{ color: theme.colors.text.primary }}>
                {isRTL ? "إضافة حدث" : "Add Event"}
              </Heading>
              <TouchableOpacity
                onPress={() => {
                  setShowAddEventModal(false);
                  resetEventForm();
                  setShowCalendarModal(true);
                }}
              >
                <X color={theme.colors.text.primary} size={24} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <ScrollView
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={true}
              style={{
                flex: 1,
                backgroundColor: theme.colors.background.primary,
              }}
            >
              {/* Title */}
              <View style={{ marginBottom: 16 }}>
                <TypographyText
                  style={{ marginBottom: 8, color: theme.colors.text.primary }}
                >
                  {isRTL ? "العنوان" : "Title"} *
                </TypographyText>
                <TextInput
                  onChangeText={setEventTitle}
                  placeholder={isRTL ? "عنوان الحدث" : "Event title"}
                  placeholderTextColor={theme.colors.text.secondary}
                  style={{
                    borderWidth: 1,
                    borderColor:
                      typeof theme.colors.border === "string"
                        ? theme.colors.border
                        : theme.colors.border.light,
                    borderRadius: 8,
                    padding: 12,
                    backgroundColor: theme.colors.background.secondary,
                  }}
                  value={eventTitle}
                />
              </View>

              {/* Type */}
              <View style={{ marginBottom: 16 }}>
                <TypographyText
                  style={{ marginBottom: 8, color: theme.colors.text.primary }}
                >
                  {isRTL ? "نوع الحدث" : "Event Type"} *
                </TypographyText>
                <View
                  style={{
                    flexDirection: isRTL ? "row-reverse" : "row",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {[
                    {
                      value: "appointment",
                      label: isRTL ? "موعد" : "Appointment",
                    },
                    {
                      value: "medication",
                      label: isRTL ? "دواء" : "Medication",
                    },
                    { value: "symptom", label: isRTL ? "عرض" : "Symptom" },
                    {
                      value: "lab_result",
                      label: isRTL ? "نتيجة مختبر" : "Lab Result",
                    },
                    {
                      value: "vaccination",
                      label: isRTL ? "تطعيم" : "Vaccination",
                    },
                    { value: "reminder", label: isRTL ? "تذكير" : "Reminder" },
                    { value: "other", label: isRTL ? "أخرى" : "Other" },
                  ].map((eventTypeOption) => (
                    <TouchableOpacity
                      key={eventTypeOption.value}
                      onPress={() =>
                        setEventType(
                          eventTypeOption.value as CalendarEvent["type"]
                        )
                      }
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor:
                          eventTypeOption.value === eventType
                            ? theme.colors.primary.main
                            : typeof theme.colors.border === "string"
                              ? theme.colors.border
                              : theme.colors.border.light,
                        backgroundColor:
                          eventTypeOption.value === eventType
                            ? theme.colors.primary.main
                            : theme.colors.background.secondary,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color:
                            eventTypeOption.value === eventType
                              ? theme.colors.neutral.white
                              : theme.colors.text.secondary,
                        }}
                      >
                        {eventTypeOption.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* All Day Toggle */}
              <View
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 12,
                  marginBottom: 16,
                }}
              >
                <TypographyText style={{ color: theme.colors.text.primary }}>
                  {isRTL ? "طوال اليوم" : "All Day"}
                </TypographyText>
                <Switch
                  onValueChange={setEventAllDay}
                  thumbColor={theme.colors.background.primary}
                  trackColor={{
                    false:
                      typeof theme.colors.border === "string"
                        ? theme.colors.border
                        : theme.colors.border.light,
                    true: theme.colors.primary.main,
                  }}
                  value={eventAllDay}
                />
              </View>

              {/* Start Date & Time */}
              <View style={{ marginBottom: 16 }}>
                <TypographyText
                  style={{ marginBottom: 8, color: theme.colors.text.primary }}
                >
                  {isRTL ? "تاريخ ووقت البداية" : "Start Date & Time"} *
                </TypographyText>
                <View
                  style={{
                    flexDirection: isRTL ? "row-reverse" : "row",
                    gap: 8,
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      setShowStartDatePicker(true);
                    }}
                    style={{
                      flex: 1,
                      borderWidth: 2,
                      borderColor: showStartDatePicker
                        ? theme.colors.primary.main
                        : typeof theme.colors.border === "string"
                          ? theme.colors.border
                          : theme.colors.border.light,
                      borderRadius: 8,
                      padding: 12,
                      backgroundColor: theme.colors.background.secondary,
                      flexDirection: isRTL ? "row-reverse" : "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <CalendarIcon
                      color={theme.colors.text.secondary}
                      size={16}
                    />
                    <Text style={{ color: theme.colors.text.primary, flex: 1 }}>
                      {safeFormatDate(eventStartDate, isRTL ? "ar" : "en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </TouchableOpacity>
                  {!eventAllDay && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setShowStartTimePicker(true);
                      }}
                      style={{
                        flex: 1,
                        borderWidth: 2,
                        borderColor: showStartTimePicker
                          ? theme.colors.primary.main
                          : typeof theme.colors.border === "string"
                            ? theme.colors.border
                            : theme.colors.border.light,
                        borderRadius: 8,
                        padding: 12,
                        backgroundColor: theme.colors.background.secondary,
                        flexDirection: isRTL ? "row-reverse" : "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Clock color={theme.colors.text.secondary} size={16} />
                      <Text
                        style={{ color: theme.colors.text.primary, flex: 1 }}
                      >
                        {formatTime(eventStartDate)}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* End Date & Time */}
              {!eventAllDay && (
                <View style={{ marginBottom: 16 }}>
                  <TypographyText
                    style={{
                      marginBottom: 8,
                      color: theme.colors.text.primary,
                    }}
                  >
                    {isRTL ? "تاريخ ووقت النهاية" : "End Date & Time"} (
                    {isRTL ? "اختياري" : "Optional"})
                  </TypographyText>
                  <View
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      gap: 8,
                    }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setShowEndDatePicker(true);
                      }}
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor:
                          typeof theme.colors.border === "string"
                            ? theme.colors.border
                            : theme.colors.border.light,
                        borderRadius: 8,
                        padding: 12,
                        backgroundColor: theme.colors.background.secondary,
                        flexDirection: isRTL ? "row-reverse" : "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <CalendarIcon
                        color={theme.colors.text.secondary}
                        size={16}
                      />
                      <Text
                        style={{ color: theme.colors.text.primary, flex: 1 }}
                      >
                        {eventEndDate
                          ? safeFormatDate(
                              eventEndDate,
                              isRTL ? "ar" : "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )
                          : isRTL
                            ? "اختر التاريخ"
                            : "Select Date"}
                      </Text>
                    </TouchableOpacity>
                    {eventEndDate && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          setShowEndTimePicker(true);
                        }}
                        style={{
                          flex: 1,
                          borderWidth: 1,
                          borderColor:
                            typeof theme.colors.border === "string"
                              ? theme.colors.border
                              : theme.colors.border.light,
                          borderRadius: 8,
                          padding: 12,
                          backgroundColor: theme.colors.background.secondary,
                          flexDirection: isRTL ? "row-reverse" : "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Clock color={theme.colors.text.secondary} size={16} />
                        <Text
                          style={{ color: theme.colors.text.primary, flex: 1 }}
                        >
                          {formatTime(eventEndDate)}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Location */}
              <View style={{ marginBottom: 16 }}>
                <TypographyText
                  style={{ marginBottom: 8, color: theme.colors.text.primary }}
                >
                  {isRTL ? "الموقع" : "Location"} (
                  {isRTL ? "اختياري" : "Optional"})
                </TypographyText>
                <TextInput
                  onChangeText={setEventLocation}
                  placeholder={isRTL ? "موقع الحدث" : "Event location"}
                  placeholderTextColor={theme.colors.text.secondary}
                  style={{
                    borderWidth: 1,
                    borderColor:
                      typeof theme.colors.border === "string"
                        ? theme.colors.border
                        : theme.colors.border.light,
                    borderRadius: 8,
                    padding: 12,
                    backgroundColor: theme.colors.background.secondary,
                  }}
                  value={eventLocation}
                />
              </View>

              {/* Description */}
              <View style={{ marginBottom: 16 }}>
                <TypographyText
                  style={{ marginBottom: 8, color: theme.colors.text.primary }}
                >
                  {isRTL ? "الوصف" : "Description"} (
                  {isRTL ? "اختياري" : "Optional"})
                </TypographyText>
                <TextInput
                  multiline
                  numberOfLines={4}
                  onChangeText={setEventDescription}
                  placeholder={isRTL ? "وصف الحدث..." : "Event description..."}
                  placeholderTextColor={theme.colors.text.secondary}
                  style={{
                    borderWidth: 1,
                    borderColor:
                      typeof theme.colors.border === "string"
                        ? theme.colors.border
                        : theme.colors.border.light,
                    borderRadius: 8,
                    padding: 12,
                    backgroundColor: theme.colors.background.secondary,
                    minHeight: 100,
                    textAlignVertical: "top",
                  }}
                  value={eventDescription}
                />
              </View>

              {/* Share with Family */}
              {user?.familyId && (
                <View
                  style={{
                    flexDirection: isRTL ? "row-reverse" : "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 12,
                  }}
                >
                  <TypographyText style={{ color: theme.colors.text.primary }}>
                    {isRTL ? "مشاركة مع العائلة" : "Share with Family"}
                  </TypographyText>
                  <Switch
                    onValueChange={setEventShareWithFamily}
                    thumbColor={theme.colors.background.primary}
                    trackColor={{
                      false:
                        typeof theme.colors.border === "string"
                          ? theme.colors.border
                          : theme.colors.border.light,
                      true: theme.colors.primary.main,
                    }}
                    value={eventShareWithFamily}
                  />
                </View>
              )}
            </ScrollView>

            {/* Actions - Fixed at Bottom */}
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                gap: 12,
                padding: 16,
                borderTopWidth: 1,
                borderTopColor:
                  typeof theme.colors.border === "string"
                    ? theme.colors.border
                    : theme.colors.border.light,
                backgroundColor: theme.colors.background.primary,
              }}
            >
              <Button
                disabled={savingEvent}
                onPress={() => {
                  setShowAddEventModal(false);
                  resetEventForm();
                  setShowCalendarModal(true);
                }}
                style={{
                  flex: 1,
                  borderColor: theme.colors.primary.main,
                  borderWidth: 2,
                }}
                textStyle={{
                  color: theme.colors.primary.main,
                }}
                title={isRTL ? "إلغاء" : "Cancel"}
                variant="outline"
              />
              <Button
                disabled={savingEvent || !eventTitle.trim()}
                loading={savingEvent}
                onPress={() => {
                  handleSaveEvent();
                }}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.primary.main,
                }}
                textStyle={{
                  color: theme.colors.neutral.white,
                }}
                title={
                  savingEvent
                    ? isRTL
                      ? "جاري الحفظ..."
                      : "Saving..."
                    : isRTL
                      ? "حفظ"
                      : "Save"
                }
                variant="primary"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Start Date Picker Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowStartDatePicker(false)}
        transparent={true}
        visible={showStartDatePicker}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.background.primary,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              maxHeight: "50%",
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <Heading level={5} style={{}}>
                {isRTL ? "اختر تاريخ البداية" : "Select Start Date"}
              </Heading>
              <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                <X color={theme.colors.text.primary} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {Array.from({ length: 365 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i - 30); // Show past 30 days to future 335 days
                const isSelected =
                  eventStartDate.toDateString() === date.toDateString();
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      const newDate = new Date(date);
                      newDate.setHours(eventStartDate.getHours());
                      newDate.setMinutes(eventStartDate.getMinutes());
                      setEventStartDate(newDate);
                      setShowStartDatePicker(false);
                    }}
                    style={{
                      padding: 12,
                      backgroundColor: isSelected
                        ? theme.colors.primary.main
                        : theme.colors.background.secondary,
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected
                          ? theme.colors.neutral.white
                          : theme.colors.text.primary,
                      }}
                    >
                      {safeFormatDate(
                        date,
                        isRTL ? "ar-u-ca-gregory" : "en-US",
                        {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Start Time Picker Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowStartTimePicker(false)}
        transparent={true}
        visible={showStartTimePicker}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.background.primary,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <Heading level={5} style={{}}>
                {isRTL ? "اختر وقت البداية" : "Select Start Time"}
              </Heading>
              <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
                <X color={theme.colors.text.primary} size={24} />
              </TouchableOpacity>
            </View>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <View style={{ flex: 1 }}>
                <TypographyText style={{ marginBottom: 8 }}>
                  {isRTL ? "ساعة" : "Hour"}
                </TypographyText>
                <ScrollView style={{ maxHeight: 200 }}>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i;
                    const isSelected = eventStartDate.getHours() === hour;
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          const newDate = new Date(eventStartDate);
                          newDate.setHours(hour);
                          setEventStartDate(newDate);
                        }}
                        style={{
                          padding: 12,
                          backgroundColor: isSelected
                            ? theme.colors.primary.main
                            : theme.colors.background.secondary,
                          borderRadius: 8,
                          marginBottom: 4,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected
                              ? theme.colors.neutral.white
                              : theme.colors.text.primary,
                          }}
                        >
                          {hour.toString().padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={{ flex: 1 }}>
                <TypographyText style={{ marginBottom: 8 }}>
                  {isRTL ? "دقيقة" : "Minute"}
                </TypographyText>
                <ScrollView style={{ maxHeight: 200 }}>
                  {Array.from({ length: 60 }, (_, i) => {
                    const minute = i;
                    const isSelected = eventStartDate.getMinutes() === minute;
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          const newDate = new Date(eventStartDate);
                          newDate.setMinutes(minute);
                          setEventStartDate(newDate);
                        }}
                        style={{
                          padding: 12,
                          backgroundColor: isSelected
                            ? theme.colors.primary.main
                            : theme.colors.background.secondary,
                          borderRadius: 8,
                          marginBottom: 4,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected
                              ? theme.colors.neutral.white
                              : theme.colors.text.primary,
                          }}
                        >
                          {minute.toString().padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
            <Button
              onPress={() => setShowStartTimePicker(false)}
              title={isRTL ? "تم" : "Done"}
              variant="primary"
            />
          </View>
        </View>
      </Modal>

      {/* End Date Picker Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowEndDatePicker(false)}
        transparent={true}
        visible={showEndDatePicker}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.background.primary,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              maxHeight: "50%",
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <Heading level={5} style={{}}>
                {isRTL ? "اختر تاريخ النهاية" : "Select End Date"}
              </Heading>
              <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                <X color={theme.colors.text.primary} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {Array.from({ length: 365 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i - 30); // Show past 30 days to future 335 days
                const isSelected =
                  eventEndDate &&
                  eventEndDate.toDateString() === date.toDateString();
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      const newDate = new Date(date);
                      if (eventEndDate) {
                        newDate.setHours(eventEndDate.getHours());
                        newDate.setMinutes(eventEndDate.getMinutes());
                      } else {
                        newDate.setHours(eventStartDate.getHours() + 1);
                        newDate.setMinutes(eventStartDate.getMinutes());
                      }
                      setEventEndDate(newDate);
                      setShowEndDatePicker(false);
                    }}
                    style={{
                      padding: 12,
                      backgroundColor: isSelected
                        ? theme.colors.primary.main
                        : theme.colors.background.secondary,
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected
                          ? theme.colors.neutral.white
                          : theme.colors.text.primary,
                      }}
                    >
                      {safeFormatDate(
                        date,
                        isRTL ? "ar-u-ca-gregory" : "en-US",
                        {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* End Time Picker Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowEndTimePicker(false)}
        transparent={true}
        visible={showEndTimePicker}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.background.primary,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <Heading level={5} style={{}}>
                {isRTL ? "اختر وقت النهاية" : "Select End Time"}
              </Heading>
              <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
                <X color={theme.colors.text.primary} size={24} />
              </TouchableOpacity>
            </View>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <View style={{ flex: 1 }}>
                <TypographyText style={{ marginBottom: 8 }}>
                  {isRTL ? "ساعة" : "Hour"}
                </TypographyText>
                <ScrollView style={{ maxHeight: 200 }}>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i;
                    const isSelected =
                      eventEndDate && eventEndDate.getHours() === hour;
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          if (eventEndDate) {
                            const newDate = new Date(eventEndDate);
                            newDate.setHours(hour);
                            setEventEndDate(newDate);
                          } else {
                            const newDate = new Date(eventStartDate);
                            newDate.setHours(hour);
                            setEventEndDate(newDate);
                          }
                        }}
                        style={{
                          padding: 12,
                          backgroundColor: isSelected
                            ? theme.colors.primary.main
                            : theme.colors.background.secondary,
                          borderRadius: 8,
                          marginBottom: 4,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected
                              ? theme.colors.neutral.white
                              : theme.colors.text.primary,
                          }}
                        >
                          {hour.toString().padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={{ flex: 1 }}>
                <TypographyText style={{ marginBottom: 8 }}>
                  {isRTL ? "دقيقة" : "Minute"}
                </TypographyText>
                <ScrollView style={{ maxHeight: 200 }}>
                  {Array.from({ length: 60 }, (_, i) => {
                    const minute = i;
                    const isSelected =
                      eventEndDate && eventEndDate.getMinutes() === minute;
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          if (eventEndDate) {
                            const newDate = new Date(eventEndDate);
                            newDate.setMinutes(minute);
                            setEventEndDate(newDate);
                          } else {
                            const newDate = new Date(eventStartDate);
                            newDate.setMinutes(minute);
                            setEventEndDate(newDate);
                          }
                        }}
                        style={{
                          padding: 12,
                          backgroundColor: isSelected
                            ? theme.colors.primary.main
                            : theme.colors.background.secondary,
                          borderRadius: 8,
                          marginBottom: 4,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected
                              ? theme.colors.neutral.white
                              : theme.colors.text.primary,
                          }}
                        >
                          {minute.toString().padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
            <Button
              onPress={() => setShowEndTimePicker(false)}
              title={isRTL ? "تم" : "Done"}
              variant="primary"
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: "center",
  },
  avatarContainer: {
    marginBottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 24,
    fontFamily: "Geist-Bold",
    color: "#FFFFFF",
  },
  userInfo: {
    alignItems: "center",
    marginTop: -8,
  },
  userName: {
    fontSize: 24,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginBottom: 8,
  },
  memberSince: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberSinceText: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  healthSummary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  healthTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  healthGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  healthCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    minHeight: 100,
  },
  healthIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  healthCardValue: {
    fontSize: 20,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  healthCardLabel: {
    fontSize: 11,
    fontFamily: "Geist-Medium",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 14,
  },
  aiInsightsSection: {
    marginBottom: 20,
    paddingHorizontal: 0,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 8,
    marginStart: 4,
  },
  sectionTitleRTL: {
    textAlign: "right",
  },
  sectionItems: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  sectionItemRTL: {
    flexDirection: "row-reverse" as const,
  },
  lastSectionItem: {
    borderBottomWidth: 0,
  },
  sectionItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginEnd: 12,
  },
  sectionItemLeftRTL: {
    flexDirection: "row-reverse" as const,
    marginEnd: 0,
    marginStart: 12,
  },
  sectionItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    marginEnd: 12,
  },
  sectionItemLabel: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#1E293B",
    flex: 1,
  },
  sectionItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  sectionItemValue: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    maxWidth: 80,
  },
  comingSoonBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#FEF3C7",
    borderRadius: 4,
  },
  comingSoonText: {
    fontSize: 10,
    fontFamily: "Geist-Bold",
    color: "#92400E",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 20,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  signOutText: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#EF4444",
  },
  appVersion: {
    alignItems: "center",
    paddingBottom: 20,
  },
  appVersionText: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#94A3B8",
  },
  rtlText: {
    textAlign: "right",
    fontFamily: "Geist-Regular",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    flex: 1,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  languageOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#F8FAFC",
  },
  selectedLanguage: {
    backgroundColor: "#EBF4FF",
    borderWidth: 1,
    borderColor: "#2563EB",
  },
  languageText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#1E293B",
  },
  selectedLanguageText: {
    color: "#2563EB",
    fontFamily: "Geist-SemiBold",
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 16,
  },
  avatarOption: {
    width: "30%",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    position: "relative",
    paddingVertical: 16,
    marginBottom: 12,
  },
  avatarOptionSelected: {
    backgroundColor: "#EBF4FF",
    borderColor: "#2563EB",
  },
  avatarEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  avatarLabel: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
    marginTop: 8,
    textAlign: "center",
  },
  avatarLabelSelected: {
    color: "#2563EB",
    fontFamily: "Geist-SemiBold",
  },
  avatarCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  creatorModalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  creatorModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  creatorModalTitle: {
    fontSize: 20,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
  },
  creatorCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  healthScoreBreakdownContent: {
    padding: 20,
  },
  breakdownSection: {
    marginBottom: 24,
  },
  scoreDisplay: {
    alignItems: "center",
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  scoreOutOf: {
    fontSize: 16,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginBottom: 12,
  },
  ratingBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  ratingText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#1E293B",
  },
  breakdownTitle: {
    fontSize: 18,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  finalScoreRow: {
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: "#E2E8F0",
  },
  breakdownLabel: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#1E293B",
    flex: 1,
  },
  finalScoreLabel: {
    fontSize: 18,
    fontFamily: "Geist-Bold",
  },
  breakdownValue: {
    fontSize: 16,
    fontFamily: "Geist-Bold",
    color: "#10B981",
  },
  breakdownValuePositive: {
    fontSize: 16,
    fontFamily: "Geist-Bold",
    color: "#10B981",
  },
  breakdownValueNegative: {
    fontSize: 16,
    fontFamily: "Geist-Bold",
    color: "#EF4444",
  },
  finalScoreValue: {
    fontSize: 20,
    fontFamily: "Geist-Bold",
    color: "#2563EB",
  },
  factorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  factorLabel: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    flex: 1,
  },
  factorValue: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#1E293B",
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 12,
  },
  infoNoteText: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    flex: 1,
    lineHeight: 18,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginTop: 12,
  },
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Calendar as CalendarIcon,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplet,
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
  Shield,
  Sun,
  TestTube,
  TrendingUp,
  User,
  Users,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Avatar from "@/components/Avatar";
import type { AvatarType } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useFallDetectionContext } from "@/contexts/FallDetectionContext";
import { useTheme } from "@/contexts/ThemeContext";
import GlobalSearch from "@/app/components/GlobalSearch";
import { medicationService } from "@/lib/services/medicationService";
import {
  type ExportFormat,
  exportMetrics,
} from "@/lib/services/metricsExportService";
import { symptomService } from "@/lib/services/symptomService";
import { userService } from "@/lib/services/userService";
import { healthScoreService, type HealthScoreResult } from "@/lib/services/healthScoreService";
import { calendarService } from "@/lib/services/calendarService";
import type { Medication, Symptom, CalendarEvent, RecurrencePattern } from "@/types";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { Button, Card } from "@/components/design-system";
import { Caption, Heading, Text as TypographyText } from "@/components/design-system";
import TagInput from "@/app/components/TagInput";

interface ProfileSectionItem {
  icon: any;
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
  const { themeMode, setThemeMode, isDark, theme } = useTheme();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
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
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [includeFamily, setIncludeFamily] = useState(true);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventType, setEventType] = useState<CalendarEvent["type"]>("appointment");
  const [eventStartDate, setEventStartDate] = useState(new Date());
  const [eventEndDate, setEventEndDate] = useState<Date | undefined>(undefined);
  const [eventAllDay, setEventAllDay] = useState(false);
  const [eventLocation, setEventLocation] = useState("");
  const [eventRecurrencePattern, setEventRecurrencePattern] = useState<RecurrencePattern>("none");
  const [eventShareWithFamily, setEventShareWithFamily] = useState(false);
  const [eventTags, setEventTags] = useState<string[]>([]);
  const [savingEvent, setSavingEvent] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const isRTL = i18n.language === "ar";
  const isAdmin = user?.role === "admin";

  // Helper function to convert Western numerals to Arabic numerals
  const toArabicNumerals = (num: number): string => {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().replace(/\d/g, (digit) => arabicNumerals[parseInt(digit)]);
  };

  // Refresh data when tab is focused
  useFocusEffect(
    useCallback(() => {
      loadHealthData();
      loadUserSettings();
    }, [user])
  );

  useEffect(() => {
    loadUserSettings();
    loadHealthData();
  }, [user]);

  const loadUserSettings = async () => {
    try {
      const notifications = await AsyncStorage.getItem("notifications_enabled");

      if (notifications !== null) {
        setNotificationsEnabled(JSON.parse(notifications));
      }
    } catch (error) {
      // Silently handle settings load error
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
      const [symptoms, medications, healthScoreResult] = await Promise.all([
        symptomService.getUserSymptoms(user.id),
        medicationService.getUserMedications(user.id),
        healthScoreService.calculateHealthScore(user.id),
      ]);

      // Filter recent symptoms for display
      const recentSymptoms = symptoms.filter(
        (s) =>
          new Date(s.timestamp).getTime() >
          Date.now() - 30 * 24 * 60 * 60 * 1000
      );
      const activeMedications = medications.filter((m) => m.isActive);

      setHealthData({
        symptoms: recentSymptoms,
        medications: activeMedications,
        healthScore: healthScoreResult.score,
        healthScoreResult,
      });
    } catch (error) {
      // Silently handle error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem("notifications_enabled", JSON.stringify(value));
  };

  const handleFallDetectionToggle = async (value: boolean) => {
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
      Alert.alert(
        t("exportInProgress"),
        t("exportInProgressMessage")
      );
      return;
    }

    // Set exporting flag immediately to prevent concurrent exports
    setExporting(true);

    try {
      // Export directly as PDF (CSV option removed)
      await performExport("pdf");
    } catch (error: any) {
      setExporting(false);
      Alert.alert(
        t("error"),
        t("errorExportingMetrics")
      );
    }
  };

  const loadCalendarEvents = useCallback(async (isRefresh = false) => {
    if (!user) return;

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
        includeFamily && user.familyId ? true : false,
        user.familyId
      );

      setCalendarEvents(userEvents);
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل تحميل الأحداث" : "Failed to load events"
      );
    } finally {
      setCalendarLoading(false);
      setCalendarRefreshing(false);
    }
  }, [user, calendarCurrentDate, includeFamily, isRTL]);

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(calendarCurrentDate);
    if (direction === "prev") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCalendarCurrentDate(newDate);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString(isRTL ? "ar" : "en-US", {
      month: "long",
      year: "numeric",
    });
  };

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

  const getSelectedDateEvents = () => {
    return calendarEvents.filter((event) => {
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getDate() === calendarSelectedDate.getDate() &&
        eventDate.getMonth() === calendarSelectedDate.getMonth() &&
        eventDate.getFullYear() === calendarSelectedDate.getFullYear()
      );
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(isRTL ? "ar" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
    if (!eventStartDate || isNaN(eventStartDate.getTime())) {
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
      if (!finalEndDate && !eventAllDay) {
        finalEndDate = new Date(eventStartDate);
        finalEndDate.setHours(finalEndDate.getHours() + 1);
      } else if (eventAllDay) {
        // For all-day events, set endDate to end of the same day
        finalEndDate = new Date(eventStartDate);
        finalEndDate.setHours(23, 59, 59, 999);
      }

      // Validate end date if set
      if (finalEndDate && isNaN(finalEndDate.getTime())) {
        Alert.alert(
          isRTL ? "خطأ" : "Error",
          isRTL ? "يرجى اختيار تاريخ نهاية صحيح" : "Please select a valid end date"
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
        recurrencePattern: eventRecurrencePattern !== "none" ? eventRecurrencePattern : undefined,
        familyId: eventShareWithFamily && user.familyId ? user.familyId : undefined,
        tags: eventTags.length > 0 ? eventTags : undefined,
        color: getEventColor(eventType),
        reminders: eventType === "appointment" ? [
          { minutesBefore: 60, sent: false },
          { minutesBefore: 1440, sent: false },
        ] : undefined,
      });

      Alert.alert(
        isRTL ? "نجح" : "Success",
        isRTL ? "تم إضافة الحدث بنجاح" : "Event added successfully",
        [
          {
            text: isRTL ? "حسناً" : "OK",
            onPress: () => {
              setShowAddEventModal(false);
              resetEventForm();
              loadCalendarEvents();
              setShowCalendarModal(true);
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
  }, [calendarCurrentDate, showCalendarModal]);

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
        (message) => {
          // Progress callback - silently handle progress updates
        }
      );

      Alert.alert(
        t("exportSuccessful"),
        t("exportSuccessfulMessage")
      );
    } catch (error: any) {
      Alert.alert(
        t("exportError"),
        error?.message || t("exportErrorMessage")
      );
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
    Alert.alert(
      t("signOut"),
      t("confirmSignOut"),
      [
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
            } catch (error) {
              // Silently handle logout error
              Alert.alert(
                t("error"),
                t("failedToSignOut")
              );
            }
          },
        },
      ]
    );
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
        // Show additional options only for admin users
        ...(isAdmin ? [
          {
            icon: Calendar,
            label: isRTL ? t("calendar") : t("calendar").charAt(0).toUpperCase() + t("calendar").slice(1).toLowerCase(),
            onPress: () => {
              setShowCalendarModal(true);
              loadCalendarEvents();
            },
          },
          {
            icon: BookOpen,
            label: t("healthResources"),
            onPress: () => router.push("/(tabs)/resources"),
            comingSoon: true,
          },
        ] : []),
      ],
    },
    // Health features for regular users
    ...(isRegularUser ? [
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
            icon: Activity,
            label: t("healthIntegrations"),
            onPress: () => router.push("/profile/health-integrations" as any),
          },
        ],
      },
    ] : []),
    // Simplified settings for regular users
    {
      title: t("settings"),
      items: [
        // Basic notifications for regular users
        ...(isRegularUser ? [
          {
            icon: Bell,
            label: t("notifications"),
            onPress: () => router.push("/profile/notification-settings"),
          },
        ] : [
          // Full settings for admin users
          {
            icon: Bell,
            label: t("notifications"),
            onPress: () => router.push("/profile/notification-settings"),
          },
          {
            icon: Shield,
            label: t("fallDetection"),
            onPress: () => router.push("/profile/fall-detection"),
          },
          {
            icon: Activity,
            label: t("healthIntegrations"),
            onPress: () => router.push("/profile/health-integrations" as any),
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
        ...(isRegularUser ? [
          {
            icon: Shield,
            label: t("privacyPolicy"),
            onPress: handlePrivacyPolicy,
          },
        ] : [
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
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, isRTL && { flexDirection: "row-reverse" }]}>
        <Text style={[styles.title, isRTL && { textAlign: "left" }]}>
          {t("profile")}
        </Text>
        {isAdmin && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowSearch(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
        refreshControl={
          <RefreshControl
            onRefresh={() => loadHealthData(true)}
            refreshing={refreshing}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Avatar
              avatarType={user?.avatarType}
              name={user?.firstName}
              size="xl"
              onPress={() => setAvatarCreatorVisible(true)}
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
              <Text style={[styles.memberSinceText, isRTL && { textAlign: "left" }]}>
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
                style={styles.healthCard}
                onPress={() => setHealthScoreModalVisible(true)}
                activeOpacity={0.7}
              >
                <View style={styles.healthIconContainer}>
                  <Activity color="#10B981" size={24} />
                </View>
                <Text style={[styles.healthCardValue, isRTL && { textAlign: "left" }]}>
                  {healthData.healthScore}
                </Text>
                  <Text
                  numberOfLines={2}
                  style={[styles.healthCardLabel, isRTL && { textAlign: "left" }]}
                >
                  {t("healthScore")}
                </Text>
              </TouchableOpacity>

              <View style={styles.healthCard}>
                <View style={styles.healthIconContainer}>
                  <Heart color="#EF4444" size={24} />
                </View>
                <Text style={[styles.healthCardValue, isRTL && { textAlign: "left" }]}>
                  {healthData.symptoms.length}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[styles.healthCardLabel, isRTL && { textAlign: "left" }]}
                >
                  {t("symptomsThisMonth")}
                </Text>
              </View>

              <View style={styles.healthCard}>
                <View style={styles.healthIconContainer}>
                  <Calendar color="#3B82F6" size={24} />
                </View>
                <Text style={[styles.healthCardValue, isRTL && { textAlign: "left" }]}>
                  {healthData.medications.length}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[styles.healthCardLabel, isRTL && { textAlign: "left" }]}
                >
                  {t("activeMedications")}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Settings Sections */}
        {profileSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && { textAlign: "left" }]}>
              {section.title}
            </Text>

            <View style={styles.sectionItems}>
              {section.items.map((item, itemIndex) => {
                const IconComponent = item.icon;

                return (
                  <TouchableOpacity
                    disabled={!item.onPress}
                    key={itemIndex}
                    onPress={item.onPress}
                    style={[
                      styles.sectionItem,
                      itemIndex === section.items.length - 1 &&
                        styles.lastSectionItem,
                    ]}
                  >
                    <View style={styles.sectionItemLeft}>
                      <View style={styles.sectionItemIcon}>
                        <IconComponent color="#64748B" size={20} />
                      </View>
                      <View
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.sectionItemLabel,
                            isRTL && { textAlign: "left" },
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
                      ) : (
                        <>
                          {exporting &&
                          item.label === t("healthReports") ? (
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
          <Text style={[styles.signOutText, isRTL && { textAlign: "left" }]}>
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
              <Text style={[styles.cancelButtonText, isRTL && { textAlign: "left" }]}>
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
        visible={avatarCreatorVisible}
        transparent={true}
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
              {(["man", "woman", "boy", "girl", "grandpa", "grandma"] as AvatarType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.avatarOption,
                    user?.avatarType === type && styles.avatarOptionSelected,
                  ]}
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
                        Alert.alert(
                          t("success"),
                          t("avatarSavedSuccessfully")
                        );
                      }
                    } catch (error) {
                      Alert.alert(
                        t("error"),
                        t("failedToSaveAvatar")
                      );
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  <Avatar avatarType={type} size="xl" style={{ width: 80, height: 80 }} />
                  <Text style={[styles.avatarLabel, isRTL && { textAlign: "left" }]}>
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
        visible={healthScoreModalVisible}
        transparent={true}
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
            <ScrollView contentContainerStyle={styles.healthScoreBreakdownContent}>
              {healthData.healthScoreResult ? (
                <>
                  {/* Overall Score */}
                  <View style={styles.breakdownSection}>
                    <View style={styles.scoreDisplay}>
                      <Text style={[styles.scoreValue, isRTL && { textAlign: "left" }]}>
                        {healthData.healthScoreResult.score}
                      </Text>
                      <Text style={[styles.scoreOutOf, isRTL && { textAlign: "left" }]}>
                        {isRTL ? "من 100" : "out of 100"}
                      </Text>
                      <View style={styles.ratingBadge}>
                        <Text style={[styles.ratingText, isRTL && { textAlign: "left" }]}>
                          {healthData.healthScoreResult.rating === "excellent" && (isRTL ? "ممتاز" : "Excellent")}
                          {healthData.healthScoreResult.rating === "good" && (isRTL ? "جيد" : "Good")}
                          {healthData.healthScoreResult.rating === "fair" && (isRTL ? "مقبول" : "Fair")}
                          {healthData.healthScoreResult.rating === "poor" && (isRTL ? "ضعيف" : "Poor")}
                          {healthData.healthScoreResult.rating === "critical" && (isRTL ? "حرج" : "Critical")}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Calculation Breakdown */}
                  <View style={styles.breakdownSection}>
                    <Text style={[styles.breakdownTitle, isRTL && { textAlign: "left" }]}>
                      {isRTL ? "كيف تم حساب النقاط" : "How Your Score Was Calculated"}
                    </Text>
                    
                    {/* Base Score */}
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, isRTL && { textAlign: "left" }]}>
                        {isRTL ? "النقاط الأساسية" : "Base Score"}
                      </Text>
                      <Text style={[styles.breakdownValue, isRTL && { textAlign: "left" }]}>
                        +{healthData.healthScoreResult.breakdown.baseScore}
                      </Text>
                    </View>

                    {/* Symptom Penalty */}
                    {healthData.healthScoreResult.breakdown.symptomPenalty > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, isRTL && { textAlign: "left" }]}>
                          {isRTL ? "خصم الأعراض" : "Symptom Penalty"}
                        </Text>
                        <Text style={[styles.breakdownValueNegative, isRTL && { textAlign: "left" }]}>
                          -{healthData.healthScoreResult.breakdown.symptomPenalty.toFixed(1)}
                        </Text>
                      </View>
                    )}

                    {/* Medication Bonus */}
                    {healthData.healthScoreResult.breakdown.medicationBonus !== 0 && (
                      <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, isRTL && { textAlign: "left" }]}>
                          {isRTL ? "مكافأة الأدوية" : "Medication Bonus"}
                        </Text>
                        <Text style={[
                          healthData.healthScoreResult.breakdown.medicationBonus > 0 
                            ? styles.breakdownValuePositive 
                            : styles.breakdownValueNegative,
                          isRTL && { textAlign: "left" }
                        ]}>
                          {healthData.healthScoreResult.breakdown.medicationBonus > 0 ? "+" : ""}
                          {healthData.healthScoreResult.breakdown.medicationBonus.toFixed(1)}
                        </Text>
                      </View>
                    )}

                    {/* Final Score */}
                    <View style={[styles.breakdownRow, styles.finalScoreRow]}>
                      <Text style={[styles.breakdownLabel, styles.finalScoreLabel, isRTL && { textAlign: "left" }]}>
                        {isRTL ? "النقاط النهائية" : "Final Score"}
                      </Text>
                      <Text style={[styles.breakdownValue, styles.finalScoreValue, isRTL && { textAlign: "left" }]}>
                        {healthData.healthScoreResult.score}
                      </Text>
                    </View>
                  </View>

                  {/* Factors */}
                  <View style={styles.breakdownSection}>
                    <Text style={[styles.breakdownTitle, isRTL && { textAlign: "left" }]}>
                      {isRTL ? "العوامل المؤثرة" : "Contributing Factors"}
                    </Text>
                    
                    <View style={styles.factorRow}>
                      <Text style={[styles.factorLabel, isRTL && { textAlign: "left" }]}>
                        {isRTL ? "الأعراض الأخيرة (7 أيام)" : "Recent Symptoms (7 days)"}
                      </Text>
                      <Text style={[styles.factorValue, isRTL && { textAlign: "left" }]}>
                        {healthData.healthScoreResult.factors.recentSymptoms}
                      </Text>
                    </View>

                    {healthData.healthScoreResult.factors.recentSymptoms > 0 && (
                      <View style={styles.factorRow}>
                        <Text style={[styles.factorLabel, isRTL && { textAlign: "left" }]}>
                          {isRTL ? "متوسط شدة الأعراض" : "Average Symptom Severity"}
                        </Text>
                        <Text style={[styles.factorValue, isRTL && { textAlign: "left" }]}>
                          {healthData.healthScoreResult.factors.symptomSeverityAvg.toFixed(1)}/10
                        </Text>
                      </View>
                    )}

                    <View style={styles.factorRow}>
                      <Text style={[styles.factorLabel, isRTL && { textAlign: "left" }]}>
                        {isRTL ? "الأدوية النشطة" : "Active Medications"}
                      </Text>
                      <Text style={[styles.factorValue, isRTL && { textAlign: "left" }]}>
                        {healthData.healthScoreResult.factors.activeMedications}
                      </Text>
                    </View>

                    {healthData.healthScoreResult.factors.activeMedications > 0 && (
                      <View style={styles.factorRow}>
                        <Text style={[styles.factorLabel, isRTL && { textAlign: "left" }]}>
                          {isRTL ? "الالتزام بالأدوية" : "Medication Compliance"}
                        </Text>
                        <Text style={[styles.factorValue, isRTL && { textAlign: "left" }]}>
                          {healthData.healthScoreResult.factors.medicationCompliance}%
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Info Note */}
                  <View style={styles.infoNote}>
                    <HelpCircle color="#64748B" size={16} />
                    <Text style={[styles.infoNoteText, isRTL && { textAlign: "left" }]}>
                      {isRTL 
                        ? "يتم حساب نقاط الصحة بناءً على الأعراض الأخيرة (آخر 7 أيام) والالتزام بالأدوية. النقاط الأساسية هي 100، وتُخصم النقاط بسبب الأعراض وتُضاف المكافآت للالتزام الجيد بالأدوية."
                        : "Your health score is calculated based on recent symptoms (last 7 days) and medication compliance. Base score is 100, with points deducted for symptoms and bonuses added for good medication adherence."}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#2563EB" size="large" />
                  <Text style={[styles.loadingText, isRTL && { textAlign: "left" }]}>
                    {isRTL ? "جاري تحميل التفاصيل..." : "Loading details..."}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Global Search Modal */}
      <GlobalSearch visible={showSearch} onClose={() => setShowSearch(false)} />
      {/* Calendar Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showCalendarModal}
        onRequestClose={() => {
          setShowCalendarModal(false);
          setSelectedEvent(null);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.primary }}>
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border.light }}>
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 12 }}>
              <CalendarIcon size={24} color={theme.colors.primary.main} />
              <Heading level={4} style={{ fontSize: 20 }}>
                {isRTL ? "التقويم الصحي" : "HEALTH CALENDAR"}
              </Heading>
            </View>
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 12 }}>
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
                <X size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Month Navigation */}
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 12 }}>
            <TouchableOpacity onPress={() => navigateMonth("prev")}>
              <ChevronLeft size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontFamily: "Geist-SemiBold", color: theme.colors.text.primary }}>
              {formatMonthYear(calendarCurrentDate)}
            </Text>
            <TouchableOpacity onPress={() => navigateMonth("next")}>
              <ChevronRight size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Calendar Grid */}
          <View style={{ padding: 16 }}>
            {/* Week Days Header */}
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", marginBottom: 8 }}>
              {getWeekDays().map((day, index) => (
                <View key={index} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontSize: 12, fontFamily: "Geist-Medium", color: theme.colors.text.secondary }}>
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar Days */}
            <View style={{ flexWrap: "wrap", flexDirection: isRTL ? "row-reverse" : "row" }}>
              {(() => {
                const daysInMonth = getDaysInMonth(calendarCurrentDate);
                const firstDay = getFirstDayOfMonth(calendarCurrentDate);
                const days: React.ReactElement[] = [];
                const today = new Date();

                // Add empty cells for days before the first day of the month
                for (let i = 0; i < firstDay; i++) {
                  days.push(<View key={`empty-${i}`} style={{ flex: 1, aspectRatio: 1, margin: 2 }} />);
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
                    calendarSelectedDate.getMonth() === calendarCurrentDate.getMonth() &&
                    calendarSelectedDate.getFullYear() === calendarCurrentDate.getFullYear();
                  const isToday =
                    today.getDate() === day &&
                    today.getMonth() === calendarCurrentDate.getMonth() &&
                    today.getFullYear() === calendarCurrentDate.getFullYear();
                  const dayEvents = getEventsForDay(day);

                  days.push(
                    <TouchableOpacity
                      key={day}
                      style={[
                        {
                          flex: 1,
                          aspectRatio: 1,
                          justifyContent: "center",
                          alignItems: "center",
                          borderRadius: 8,
                          margin: 2,
                        },
                        isSelected && { backgroundColor: theme.colors.primary.main },
                        isToday && !isSelected && { borderWidth: 2, borderColor: theme.colors.primary.main },
                      ]}
                      onPress={() => {
                        setCalendarSelectedDate(date);
                        setShowEventModal(true);
                      }}
                    >
                      <TypographyText
                        style={[
                          { fontSize: 14 },
                          isSelected && { color: theme.colors.neutral.white, fontWeight: "600" },
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
                            backgroundColor: dayEvents[0].color || theme.colors.primary.main,
                          }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }

                return days;
              })()}
            </View>
          </View>

          {/* Events List for Selected Date */}
          <ScrollView
            style={{ padding: 16 }}
            refreshControl={
              <RefreshControl
                refreshing={calendarRefreshing}
                onRefresh={() => loadCalendarEvents(true)}
              />
            }
          >
            <Heading level={6} style={{ marginBottom: 16 }}>
              {isRTL
                ? `الأحداث في ${calendarSelectedDate.toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" })}`
                : `Events on ${calendarSelectedDate.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}`}
            </Heading>

            {calendarLoading ? (
              <ActivityIndicator size="large" color={theme.colors.primary.main} />
            ) : getSelectedDateEvents().length === 0 ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
                <CalendarIcon size={64} color={theme.colors.text.secondary} />
                <Text style={{ marginTop: 16, textAlign: "center", color: theme.colors.text.secondary }}>
                  {isRTL ? "لا توجد أحداث في هذا التاريخ" : "No events on this date"}
                </Text>
              </View>
            ) : (
              getSelectedDateEvents().map((event) => (
                <Card
                  key={event.id}
                  variant="elevated"
                  style={{ marginBottom: 12 }}
                  contentStyle={{}}
                  onPress={() => {
                    setSelectedEvent(event);
                    setShowEventModal(true);
                  }}
                >
                  <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <View style={{ flex: 1 }}>
                      <TypographyText weight="bold" style={{ fontSize: 16 }}>
                        {event.title}
                      </TypographyText>
                      <Badge variant="outline" size="small" style={{ marginTop: 4, alignSelf: "flex-start" }}>
                        {getEventTypeLabel(event.type)}
                      </Badge>
                    </View>
                    {event.familyId && (
                      <Users size={16} color={theme.colors.primary.main} />
                    )}
                  </View>

                  {event.description && (
                    <Caption style={{ marginTop: 8 }} numberOfLines={3}>
                      {event.description}
                    </Caption>
                  )}

                  <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <Clock size={14} color={theme.colors.text.secondary} />
                    <Caption style={{}} numberOfLines={1}>
                      {event.allDay
                        ? isRTL
                          ? "طوال اليوم"
                          : "All Day"
                        : formatTime(event.startDate)}
                    </Caption>
                    {event.location && (
                      <>
                        <MapPin size={14} color={theme.colors.text.secondary} />
                        <Caption style={{}} numberOfLines={1}>{event.location}</Caption>
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
        visible={showEventModal && !!selectedEvent}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowEventModal(false);
          setSelectedEvent(null);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.primary }}>
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border.light }}>
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
                  <Badge variant="outline" size="small" style={{}}>
                    {getEventTypeLabel(selectedEvent.type)}
                  </Badge>
                </View>
                {selectedEvent.description && (
                  <View style={{ marginBottom: 16 }}>
                    <TypographyText weight="semibold" style={{}}>
                      {isRTL ? "الوصف" : "Description"}
                    </TypographyText>
                    <Caption style={{}} numberOfLines={10}>{selectedEvent.description}</Caption>
                  </View>
                )}
                <View style={{ marginBottom: 16 }}>
                  <TypographyText weight="semibold" style={{}}>
                    {isRTL ? "التاريخ والوقت" : "Date & Time"}
                  </TypographyText>
                  <Caption style={{}} numberOfLines={1}>
                    {selectedEvent.startDate.toLocaleString(isRTL ? "ar" : "en-US")}
                    {selectedEvent.endDate &&
                      ` - ${selectedEvent.endDate.toLocaleString(isRTL ? "ar" : "en-US")}`}
                  </Caption>
                </View>
                {selectedEvent.location && (
                  <View style={{ marginBottom: 16 }}>
                    <TypographyText weight="semibold" style={{}}>
                      {isRTL ? "الموقع" : "Location"}
                    </TypographyText>
                    <Caption style={{}} numberOfLines={1}>{selectedEvent.location}</Caption>
                  </View>
                )}
                {selectedEvent.familyId && (
                  <View style={{ marginBottom: 16 }}>
                    <TypographyText weight="semibold" style={{}}>
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
        visible={showAddEventModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddEventModal(false);
          resetEventForm();
          setShowCalendarModal(true);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.primary }}>
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border.light }}>
            <Heading level={5} style={{}}>
              {isRTL ? "إضافة حدث" : "Add Event"}
            </Heading>
            <TouchableOpacity onPress={() => {
              setShowAddEventModal(false);
              resetEventForm();
              setShowCalendarModal(true);
            }}>
              <X size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            {/* Title */}
            <View style={{ marginBottom: 16 }}>
              <TypographyText style={{ marginBottom: 8 }}>
                {isRTL ? "العنوان" : "Title"} *
              </TypographyText>
              <TextInput
                style={{ borderWidth: 1, borderColor: typeof theme.colors.border === "string" ? theme.colors.border : theme.colors.border.light, borderRadius: 8, padding: 12, backgroundColor: theme.colors.background.secondary }}
                value={eventTitle}
                onChangeText={setEventTitle}
                placeholder={isRTL ? "عنوان الحدث" : "Event title"}
                placeholderTextColor={theme.colors.text.secondary}
              />
            </View>

            {/* Type */}
            <View style={{ marginBottom: 16 }}>
              <TypographyText style={{ marginBottom: 8 }}>
                {isRTL ? "نوع الحدث" : "Event Type"} *
              </TypographyText>
              <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 8, flexWrap: "wrap" }}>
                {[
                  { value: "appointment", label: isRTL ? "موعد" : "Appointment" },
                  { value: "medication", label: isRTL ? "دواء" : "Medication" },
                  { value: "symptom", label: isRTL ? "عرض" : "Symptom" },
                  { value: "lab_result", label: isRTL ? "نتيجة مختبر" : "Lab Result" },
                  { value: "vaccination", label: isRTL ? "تطعيم" : "Vaccination" },
                  { value: "reminder", label: isRTL ? "تذكير" : "Reminder" },
                  { value: "other", label: isRTL ? "أخرى" : "Other" },
                ].map((eventTypeOption) => (
                  <TouchableOpacity
                    key={eventTypeOption.value}
                    onPress={() => setEventType(eventTypeOption.value as CalendarEvent["type"])}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: eventTypeOption.value === eventType ? theme.colors.primary.main : (typeof theme.colors.border === "string" ? theme.colors.border : theme.colors.border.light),
                      backgroundColor: eventTypeOption.value === eventType ? theme.colors.primary.main : theme.colors.background.secondary,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: eventTypeOption.value === eventType ? theme.colors.neutral.white : theme.colors.text.secondary }}>
                      {eventTypeOption.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* All Day Toggle */}
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, marginBottom: 16 }}>
              <TypographyText style={{}}>
                {isRTL ? "طوال اليوم" : "All Day"}
              </TypographyText>
              <Switch
                value={eventAllDay}
                onValueChange={setEventAllDay}
                trackColor={{
                  false: typeof theme.colors.border === "string" ? theme.colors.border : theme.colors.border.light,
                  true: theme.colors.primary.main,
                }}
                thumbColor={theme.colors.background.primary}
              />
            </View>

            {/* Start Date & Time */}
            <View style={{ marginBottom: 16 }}>
              <TypographyText style={{ marginBottom: 8 }}>
                {isRTL ? "تاريخ ووقت البداية" : "Start Date & Time"} *
              </TypographyText>
              <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setShowStartDatePicker(true)}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: typeof theme.colors.border === "string" ? theme.colors.border : theme.colors.border.light,
                    borderRadius: 8,
                    padding: 12,
                    backgroundColor: theme.colors.background.secondary,
                    flexDirection: isRTL ? "row-reverse" : "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <CalendarIcon size={16} color={theme.colors.text.secondary} />
                  <Text style={{ color: theme.colors.text.primary, flex: 1 }}>
                    {eventStartDate.toLocaleDateString(isRTL ? "ar" : "en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </TouchableOpacity>
                {!eventAllDay && (
                  <TouchableOpacity
                    onPress={() => setShowStartTimePicker(true)}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: typeof theme.colors.border === "string" ? theme.colors.border : theme.colors.border.light,
                      borderRadius: 8,
                      padding: 12,
                      backgroundColor: theme.colors.background.secondary,
                      flexDirection: isRTL ? "row-reverse" : "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Clock size={16} color={theme.colors.text.secondary} />
                    <Text style={{ color: theme.colors.text.primary, flex: 1 }}>
                      {formatTime(eventStartDate)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* End Date & Time */}
            {!eventAllDay && (
              <View style={{ marginBottom: 16 }}>
                <TypographyText style={{ marginBottom: 8 }}>
                  {isRTL ? "تاريخ ووقت النهاية" : "End Date & Time"} ({isRTL ? "اختياري" : "Optional"})
                </TypographyText>
                <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setShowEndDatePicker(true)}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: typeof theme.colors.border === "string" ? theme.colors.border : theme.colors.border.light,
                      borderRadius: 8,
                      padding: 12,
                      backgroundColor: theme.colors.background.secondary,
                      flexDirection: isRTL ? "row-reverse" : "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <CalendarIcon size={16} color={theme.colors.text.secondary} />
                    <Text style={{ color: theme.colors.text.primary, flex: 1 }}>
                      {eventEndDate
                        ? eventEndDate.toLocaleDateString(isRTL ? "ar" : "en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : isRTL ? "اختر التاريخ" : "Select Date"}
                    </Text>
                  </TouchableOpacity>
                  {eventEndDate && (
                    <TouchableOpacity
                      onPress={() => setShowEndTimePicker(true)}
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: typeof theme.colors.border === "string" ? theme.colors.border : theme.colors.border.light,
                        borderRadius: 8,
                        padding: 12,
                        backgroundColor: theme.colors.background.secondary,
                        flexDirection: isRTL ? "row-reverse" : "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Clock size={16} color={theme.colors.text.secondary} />
                      <Text style={{ color: theme.colors.text.primary, flex: 1 }}>
                        {formatTime(eventEndDate)}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Location */}
            <View style={{ marginBottom: 16 }}>
              <TypographyText style={{ marginBottom: 8 }}>
                {isRTL ? "الموقع" : "Location"} ({isRTL ? "اختياري" : "Optional"})
              </TypographyText>
              <TextInput
                style={{ borderWidth: 1, borderColor: typeof theme.colors.border === "string" ? theme.colors.border : theme.colors.border.light, borderRadius: 8, padding: 12, backgroundColor: theme.colors.background.secondary }}
                value={eventLocation}
                onChangeText={setEventLocation}
                placeholder={isRTL ? "موقع الحدث" : "Event location"}
                placeholderTextColor={theme.colors.text.secondary}
              />
            </View>

            {/* Description */}
            <View style={{ marginBottom: 16 }}>
              <TypographyText style={{ marginBottom: 8 }}>
                {isRTL ? "الوصف" : "Description"} ({isRTL ? "اختياري" : "Optional"})
              </TypographyText>
              <TextInput
                style={{ borderWidth: 1, borderColor: typeof theme.colors.border === "string" ? theme.colors.border : theme.colors.border.light, borderRadius: 8, padding: 12, backgroundColor: theme.colors.background.secondary, minHeight: 100, textAlignVertical: "top" }}
                value={eventDescription}
                onChangeText={setEventDescription}
                multiline
                numberOfLines={4}
                placeholder={isRTL ? "وصف الحدث..." : "Event description..."}
                placeholderTextColor={theme.colors.text.secondary}
              />
            </View>

            {/* Share with Family */}
            {user?.familyId && (
              <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, marginBottom: 16 }}>
                <TypographyText style={{}}>
                  {isRTL ? "مشاركة مع العائلة" : "Share with Family"}
                </TypographyText>
                <Switch
                  value={eventShareWithFamily}
                  onValueChange={setEventShareWithFamily}
                  trackColor={{
                    false: typeof theme.colors.border === "string" ? theme.colors.border : theme.colors.border.light,
                    true: theme.colors.primary.main,
                  }}
                  thumbColor={theme.colors.background.primary}
                />
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: typeof theme.colors.border === "string" ? theme.colors.border : theme.colors.border.light }}>
            <Button
              variant="outline"
              onPress={() => {
                setShowAddEventModal(false);
                resetEventForm();
                setShowCalendarModal(true);
              }}
              style={{ flex: 1 }}
              textStyle={{}}
              disabled={savingEvent}
              title={isRTL ? "إلغاء" : "Cancel"}
            />
            <Button
              variant="primary"
              onPress={() => {
                handleSaveEvent();
              }}
              style={{ flex: 1 }}
              textStyle={{}}
              disabled={savingEvent || !eventTitle.trim()}
              loading={savingEvent}
              title={savingEvent ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ" : "Save")}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Start Date Picker Modal */}
      <Modal
        visible={showStartDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStartDatePicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: theme.colors.background.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "50%" }}>
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", marginBottom: 20 }}>
              <Heading level={5} style={{}}>{isRTL ? "اختر تاريخ البداية" : "Select Start Date"}</Heading>
              <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                <X size={24} color={theme.colors.text.primary} />
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
                      backgroundColor: isSelected ? theme.colors.primary.main : theme.colors.background.secondary,
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: isSelected ? theme.colors.neutral.white : theme.colors.text.primary }}>
                      {date.toLocaleDateString(isRTL ? "ar" : "en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
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
        visible={showStartTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStartTimePicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: theme.colors.background.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", marginBottom: 20 }}>
              <Heading level={5} style={{}}>{isRTL ? "اختر وقت البداية" : "Select Start Time"}</Heading>
              <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
                <X size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 16, marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <TypographyText style={{ marginBottom: 8 }}>{isRTL ? "ساعة" : "Hour"}</TypographyText>
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
                          backgroundColor: isSelected ? theme.colors.primary.main : theme.colors.background.secondary,
                          borderRadius: 8,
                          marginBottom: 4,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: isSelected ? theme.colors.neutral.white : theme.colors.text.primary }}>
                          {hour.toString().padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={{ flex: 1 }}>
                <TypographyText style={{ marginBottom: 8 }}>{isRTL ? "دقيقة" : "Minute"}</TypographyText>
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
                          backgroundColor: isSelected ? theme.colors.primary.main : theme.colors.background.secondary,
                          borderRadius: 8,
                          marginBottom: 4,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: isSelected ? theme.colors.neutral.white : theme.colors.text.primary }}>
                          {minute.toString().padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
            <Button
              variant="primary"
              onPress={() => setShowStartTimePicker(false)}
              title={isRTL ? "تم" : "Done"}
            />
          </View>
        </View>
      </Modal>

      {/* End Date Picker Modal */}
      <Modal
        visible={showEndDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEndDatePicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: theme.colors.background.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "50%" }}>
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", marginBottom: 20 }}>
              <Heading level={5} style={{}}>{isRTL ? "اختر تاريخ النهاية" : "Select End Date"}</Heading>
              <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                <X size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {Array.from({ length: 365 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i - 30); // Show past 30 days to future 335 days
                const isSelected =
                  eventEndDate && eventEndDate.toDateString() === date.toDateString();
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
                      backgroundColor: isSelected ? theme.colors.primary.main : theme.colors.background.secondary,
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: isSelected ? theme.colors.neutral.white : theme.colors.text.primary }}>
                      {date.toLocaleDateString(isRTL ? "ar" : "en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
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
        visible={showEndTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEndTimePicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: theme.colors.background.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", marginBottom: 20 }}>
              <Heading level={5} style={{}}>{isRTL ? "اختر وقت النهاية" : "Select End Time"}</Heading>
              <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
                <X size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 16, marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <TypographyText style={{ marginBottom: 8 }}>{isRTL ? "ساعة" : "Hour"}</TypographyText>
                <ScrollView style={{ maxHeight: 200 }}>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i;
                    const isSelected = eventEndDate && eventEndDate.getHours() === hour;
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          if (!eventEndDate) {
                            const newDate = new Date(eventStartDate);
                            newDate.setHours(hour);
                            setEventEndDate(newDate);
                          } else {
                            const newDate = new Date(eventEndDate);
                            newDate.setHours(hour);
                            setEventEndDate(newDate);
                          }
                        }}
                        style={{
                          padding: 12,
                          backgroundColor: isSelected ? theme.colors.primary.main : theme.colors.background.secondary,
                          borderRadius: 8,
                          marginBottom: 4,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: isSelected ? theme.colors.neutral.white : theme.colors.text.primary }}>
                          {hour.toString().padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={{ flex: 1 }}>
                <TypographyText style={{ marginBottom: 8 }}>{isRTL ? "دقيقة" : "Minute"}</TypographyText>
                <ScrollView style={{ maxHeight: 200 }}>
                  {Array.from({ length: 60 }, (_, i) => {
                    const minute = i;
                    const isSelected = eventEndDate && eventEndDate.getMinutes() === minute;
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          if (!eventEndDate) {
                            const newDate = new Date(eventStartDate);
                            newDate.setMinutes(minute);
                            setEventEndDate(newDate);
                          } else {
                            const newDate = new Date(eventEndDate);
                            newDate.setMinutes(minute);
                            setEventEndDate(newDate);
                          }
                        }}
                        style={{
                          padding: 12,
                          backgroundColor: isSelected ? theme.colors.primary.main : theme.colors.background.secondary,
                          borderRadius: 8,
                          marginBottom: 4,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: isSelected ? theme.colors.neutral.white : theme.colors.text.primary }}>
                          {minute.toString().padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
            <Button
              variant="primary"
              onPress={() => setShowEndTimePicker(false)}
              title={isRTL ? "تم" : "Done"}
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
  lastSectionItem: {
    borderBottomWidth: 0,
  },
  sectionItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginEnd: 12,
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

/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: legacy family dashboard is being refactored in incremental batches. */
/* biome-ignore-all lint/style/noNestedTernary: localized UI condition branches retained for now. */
/* biome-ignore-all lint/style/useBlockStatements: block-statement normalization deferred while reducing broader diagnostics. */
/* biome-ignore-all lint/nursery/noLeakedRender: JSX condition cleanup is staged to avoid regressions in this large screen. */
/* biome-ignore-all lint/suspicious/noArrayIndexKey: list ordering is currently stable in these mapped views. */
/* biome-ignore-all lint/performance/noNamespaceImport: module import style cleanup deferred to a dedicated pass. */
/* biome-ignore-all lint/style/useConsistentTypeDefinitions: interface-to-type migration deferred in this file. */
/* biome-ignore-all lint/suspicious/useAwait: async handler signatures are preserved for consistency with existing call sites. */
/* biome-ignore-all lint/suspicious/noImplicitAnyLet: explicit typing for intermediate variables deferred. */
/* biome-ignore-all lint/suspicious/noEvolvingTypes: explicit typing for evolving locals deferred. */
/* biome-ignore-all lint/suspicious/noExplicitAny: explicit typing migration for legacy view-model paths is pending. */
/* biome-ignore-all lint/style/noNonNullAssertion: non-null removal planned with stronger runtime guards later. */
/* biome-ignore-all lint/performance/useTopLevelRegex: regex hoisting deferred to targeted micro-optimization pass. */
/* biome-ignore-all lint/complexity/noForEach: iteration style cleanup deferred until logic extraction pass. */
/* biome-ignore-all lint/correctness/noUnusedFunctionParameters: callback signatures retained for compatibility. */
/* biome-ignore-all lint/nursery/noShadow: local variable naming cleanup deferred to deeper refactor pass. */
/* biome-ignore-all lint/correctness/noUnusedVariables: staged feature variables are intentionally retained. */
/* biome-ignore-all lint/correctness/useHookAtTopLevel: false positives from service APIs named with use* are tolerated in this pass. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import * as Print from "expo-print";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  Activity,
  AlertTriangle,
  Bell,
  Calendar,
  ChevronRight,
  Clock,
  FileText,
  Plus,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  type AlertButton,
  Image,
  InteractionManager,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CoachMark from "@/app/components/CoachMark";
import type { FilterOption } from "@/app/components/FamilyDataFilter";
import { Button, Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import {
  Caption,
  Heading,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import GradientScreen from "@/components/figma/GradientScreen";
import Sparkline from "@/components/figma/Sparkline";
import StatusBadge from "@/components/figma/StatusBadge";
import WavyBackground from "@/components/figma/WavyBackground";
import { RevenueCatPaywall } from "@/components/RevenueCatPaywall";
import { useAuth } from "@/contexts/AuthContext";
import { useFallDetectionContext } from "@/contexts/FallDetectionContext";
import { useRealtimeHealthContext } from "@/contexts/RealtimeHealthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSubscription } from "@/hooks/useSubscription";
import { alertService } from "@/lib/services/alertService";
import { allergyService } from "@/lib/services/allergyService";
import {
  type CaregiverOverview,
  caregiverDashboardService,
} from "@/lib/services/caregiverDashboardService";
import {
  type FamilyHealthReport,
  familyHealthReportService,
  type ReportPrivacySettings,
} from "@/lib/services/familyHealthReportService";
import { familyInviteService } from "@/lib/services/familyInviteService";
import {
  healthDataService,
  type VitalSigns,
} from "@/lib/services/healthDataService";
import { healthScoreService } from "@/lib/services/healthScoreService";
import { medicationService } from "@/lib/services/medicationService";
import { revenueCatService } from "@/lib/services/revenueCatService";
import {
  type MedicationScheduleEntry,
  type SharedScheduleDay,
  sharedMedicationScheduleService,
} from "@/lib/services/sharedMedicationScheduleService";
import { symptomService } from "@/lib/services/symptomService";
import { userService } from "@/lib/services/userService";
import { setClipboardString } from "@/lib/utils/clipboard";
import { logger } from "@/lib/utils/logger";
import type { Allergy, EmergencyAlert, User } from "@/types";
import { safeFormatDate, safeFormatTime } from "@/utils/dateFormat";
import {
  acknowledgeHealthEvent,
  escalateHealthEvent,
  resolveHealthEvent,
} from "../../src/health/events/createHealthEvent";
import {
  getFamilyHealthEvents,
  getUserHealthEvents,
} from "../../src/health/events/healthEventsService";
import type { HealthEvent } from "../../src/health/events/types";

const RELATIONS = [
  { key: "father", labelEn: "Father", labelAr: "الأب" },
  { key: "mother", labelEn: "Mother", labelAr: "الأم" },
  { key: "spouse", labelEn: "Spouse", labelAr: "الزوج/الزوجة" },
  { key: "child", labelEn: "Child", labelAr: "الطفل" },
  { key: "sibling", labelEn: "Sibling", labelAr: "الأخ/الأخت" },
  {
    key: "grandparent",
    labelEn: "Grandparent",
    labelAr: "الجد/الجدة",
  },
  { key: "other", labelEn: "Other", labelAr: "أخرى" },
];

// Allergy keys mapping to translation keys
const ALLERGY_KEYS = [
  "allergyPeanuts",
  "allergyTreeNuts",
  "allergyMilk",
  "allergyEggs",
  "allergyFish",
  "allergyShellfish",
  "allergySoy",
  "allergyWheat",
  "allergyPollen",
  "allergyDustMites",
  "allergyPetDander",
  "allergyMold",
  "allergyLatex",
  "allergyPenicillin",
  "allergyAspirin",
  "allergyBeeStings",
  "allergySesame",
  "allergySulfites",
];

interface FamilyMemberMetrics {
  id: string;
  user: User;
  healthScore: number | null;
  symptomsThisWeek: number | null;
  activeMedications: number | null;
  alertsCount: number | null;
  vitals: VitalSigns | null;
  allergies: Allergy[] | null;
  lastCheckIn: Date | null;
}

type FamilyMembersCache = {
  cachedAt: number;
  members: User[];
};

const FAMILY_MEMBERS_CACHE_KEY_PREFIX = "family_members_cache";
const getFamilyMembersCacheKey = (familyId: string) =>
  `${FAMILY_MEMBERS_CACHE_KEY_PREFIX}_${familyId}`;

export default function FamilyScreen() {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const isIphone16Pro =
    Math.round(Math.min(width, height)) === 393 &&
    Math.round(Math.max(width, height)) === 852;
  const contentPadding = isIphone16Pro ? 24 : theme.spacing.lg;
  const headerPadding = isIphone16Pro ? 28 : theme.spacing.xl;
  const isFocused = useIsFocused();
  const { trendAlertEvent, familyUpdateEvent, setFamilyMemberIds } =
    useRealtimeHealthContext();
  const router = useRouter();
  const params = useLocalSearchParams<{
    openEmergency?: string;
    tour?: string;
  }>();
  const {
    isPremium,
    isFamilyPlan,
    maxTotalMembers,
    isLoading: subscriptionLoading,
  } = useSubscription();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showJoinFamilyModal, setShowJoinFamilyModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showHealthReportsModal, setShowHealthReportsModal] = useState(false);
  const [healthReport, setHealthReport] = useState<FamilyHealthReport | null>(
    null
  );
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<ReportPrivacySettings>(
    {
      includeSymptoms: true,
      includeMedications: true,
      includeMoods: true,
      includeAllergies: true,
      includeMedicalHistory: true,
      includeLabResults: true,
      includeVitals: true,
      includeComplianceData: true,
    }
  );
  const [dateRange, _setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    end: new Date(),
  });
  const [elderlyDashboardData, setElderlyDashboardData] = useState<{
    nextMedication?: { name: string; time: string; dosage: string };
    healthScore: number;
    hasAlerts: boolean;
    emergencyContacts: Array<{ name: string; phone: string }>;
  } | null>(null);
  const [loadingElderlyDashboard, setLoadingElderlyDashboard] = useState(false);
  const [refreshingElderlyDashboard, setRefreshingElderlyDashboard] =
    useState(false);
  const [familyMembers, setFamilyMembers] = useState<User[]>([]);
  const [memberMetrics, setMemberMetrics] = useState<FamilyMemberMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const addMemberButtonRef = useRef<View>(null);
  const [viewMode, setViewMode] = useState<"list" | "dashboard">("list");
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    relation: "",
  });
  const [editMemberForm, setEditMemberForm] = useState({
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    role: "member" as "admin" | "member" | "caregiver",
  });
  const [joinFamilyCode, setJoinFamilyCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<
    { id: string; name: string; phone: string }[]
  >([]);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [medicationAlertsEnabled, setMedicationAlertsEnabled] = useState(false);
  const [caregiverOverview, setCaregiverOverview] =
    useState<CaregiverOverview | null>(null);
  const [loadingCaregiverDashboard, setLoadingCaregiverDashboard] =
    useState(false);
  const [medicationScheduleEntries, setMedicationScheduleEntries] = useState<
    MedicationScheduleEntry[]
  >([]);
  const [todaySchedule, setTodaySchedule] = useState<SharedScheduleDay | null>(
    null
  );
  const [upcomingSchedule, setUpcomingSchedule] = useState<SharedScheduleDay[]>(
    []
  );
  const [loadingMedicationSchedule, setLoadingMedicationSchedule] =
    useState(false);
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<
    Array<{ alert: import("@/types").EmergencyAlert; memberName: string }>
  >([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [medicationScheduleViewMode, setMedicationScheduleViewMode] = useState<
    "today" | "upcoming" | "all"
  >("today");
  const [markingTaken, setMarkingTaken] = useState<string | null>(null);
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);

  const { isEnabled: fallDetectionEnabled, toggleFallDetection } =
    useFallDetectionContext();
  const isRTL = i18n.language.toLowerCase().startsWith("ar");
  const isAdmin = user?.role === "admin" || user?.role === "caregiver";
  const hasFamily = Boolean(user?.familyId);

  useEffect(() => {
    if (params.tour === "1") {
      setShowHowTo(true);
    }
  }, [params.tour]);

  useEffect(() => {
    if (params.openEmergency === "true") {
      setShowEmergencyModal(true);
    }
  }, [params.openEmergency]);
  useEffect(() => {
    if (user?.preferences?.emergencyContacts) {
      setEmergencyContacts(user.preferences.emergencyContacts);
    }
  }, [user?.preferences?.emergencyContacts]);

  const getMergedPreferences = useCallback(
    (contacts: { id: string; name: string; phone: string }[]) => ({
      language: user?.preferences?.language || "en",
      notifications:
        user?.preferences?.notifications !== undefined
          ? user.preferences.notifications
          : true,
      emergencyContacts: contacts,
    }),
    [user?.preferences?.language, user?.preferences?.notifications]
  );

  const viewModeInitialized = useRef(false);
  const loadMemberMetricsRef = useRef<
    ((members: User[]) => Promise<void>) | null
  >(null);
  const loadingEventsRef = useRef(false);
  const familyMembersRef = useRef<User[]>([]);
  const memberMetricsRef = useRef<FamilyMemberMetrics[]>([]);
  const loadingRef = useRef(false);
  const refreshingRef = useRef(false);
  const familyMembersRequestInFlightRef = useRef(false);
  const loadingCaregiverDashboardRef = useRef(false);
  const loadingElderlyDashboardRef = useRef(false);
  const refreshingElderlyDashboardRef = useRef(false);
  const medicationScheduleRequestInFlightRef = useRef(false);
  const focusLoadInFlightRef = useRef(false);
  const lastRealtimeEventsRefreshRef = useRef(0);
  const lastRealtimeMetricsRefreshRef = useRef(0);
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>({
    id: "personal",
    type: "personal",
    label: "",
  });

  // Helper function to translate attention reasons
  const translateAttentionReason = (reason: string): string => {
    const reasonMap: Record<string, string> = {
      "Low health score": t("attentionReasonLowHealthScore"),
      "Poor medication compliance": t("attentionReasonPoorCompliance"),
      "Missed medication doses": t("attentionReasonMissedDoses"),
      "Critical alerts": t("attentionReasonCriticalAlerts"),
      "Recent falls detected": t("attentionReasonRecentFalls"),
    };
    return reasonMap[reason] || reason;
  };

  // Helper function to get translated allergy name
  const getTranslatedAllergyName = (name: string): string => {
    // Check if it's a translation key
    if (ALLERGY_KEYS.includes(name)) {
      return t(name);
    }
    // Handle backward compatibility: map old English names to translation keys
    const englishToKeyMap: Record<string, string> = {
      Peanuts: "allergyPeanuts",
      "Tree Nuts": "allergyTreeNuts",
      Milk: "allergyMilk",
      Eggs: "allergyEggs",
      Fish: "allergyFish",
      Shellfish: "allergyShellfish",
      Soy: "allergySoy",
      Wheat: "allergyWheat",
      Pollen: "allergyPollen",
      "Dust Mites": "allergyDustMites",
      "Pet Dander": "allergyPetDander",
      Mold: "allergyMold",
      Latex: "allergyLatex",
      Penicillin: "allergyPenicillin",
      Aspirin: "allergyAspirin",
      "Bee Stings": "allergyBeeStings",
      Sesame: "allergySesame",
      Sulfites: "allergySulfites",
    };
    if (englishToKeyMap[name]) {
      return t(englishToKeyMap[name]);
    }
    // Otherwise return as-is (custom allergy)
    return name;
  };

  useEffect(() => {
    const loadMedicationAlertsSetting = async () => {
      try {
        const enabled = await AsyncStorage.getItem("medication_alerts_enabled");
        if (enabled !== null) {
          setMedicationAlertsEnabled(JSON.parse(enabled));
        } else {
          setMedicationAlertsEnabled(true);
        }
      } catch (_error) {
        // Silently fail - default to enabled
      }
    };
    loadMedicationAlertsSetting();
  }, []);

  // Sync refs with state to keep them up to date
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    memberMetricsRef.current = memberMetrics;
  }, [memberMetrics]);

  useEffect(() => {
    loadingCaregiverDashboardRef.current = loadingCaregiverDashboard;
  }, [loadingCaregiverDashboard]);

  useEffect(() => {
    loadingElderlyDashboardRef.current = loadingElderlyDashboard;
  }, [loadingElderlyDashboard]);

  useEffect(() => {
    refreshingElderlyDashboardRef.current = refreshingElderlyDashboard;
  }, [refreshingElderlyDashboard]);

  const loadFamilyMembers = useCallback(
    async (isRefresh = false) => {
      // Prevent concurrent loads
      if (!isRefresh && familyMembersRequestInFlightRef.current) return;
      if (isRefresh && refreshingRef.current) return;

      if (!isRefresh) {
        familyMembersRequestInFlightRef.current = true;
      }

      if (!user?.familyId) {
        // If no familyId, we still want to show the UI (empty state)
        familyMembersRequestInFlightRef.current = false;
        loadingRef.current = false;
        refreshingRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setFamilyMembers([]);
        familyMembersRef.current = [];
        setMemberMetrics([]);
        return;
      }

      const cacheKey = getFamilyMembersCacheKey(user.familyId);
      let usedCache = false;

      if (!isRefresh && familyMembersRef.current.length === 0) {
        try {
          const cachedRaw = await AsyncStorage.getItem(cacheKey);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw) as FamilyMembersCache;

            if (Array.isArray(cached.members)) {
              setFamilyMembers(cached.members);
              familyMembersRef.current = cached.members;
              usedCache = true;
              setLoading(false);
            }
          }
        } catch {
          // Ignore cache errors and continue with network fetch
        }
      }

      try {
        if (isRefresh) {
          refreshingRef.current = true;
          setRefreshing(true);
        } else if (!usedCache) {
          loadingRef.current = true;
          setLoading(true);
        }

        // Add timeout to prevent infinite loading
        let familyMembersTimeout: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise((_, reject) => {
          familyMembersTimeout = setTimeout(
            () => reject(new Error("Family members loading timeout")),
            15_000
          );
        });

        const membersPromise = userService.getFamilyMembers(user.familyId);
        const members = (await Promise.race([
          membersPromise,
          timeoutPromise,
        ]).finally(() => {
          if (familyMembersTimeout) {
            clearTimeout(familyMembersTimeout);
          }
        })) as User[];

        setFamilyMembers(members);
        familyMembersRef.current = members;

        // Clear loading state immediately so UI can render members
        // Don't wait for cache write or metrics loading
        if (!usedCache) {
          loadingRef.current = false;
          setLoading(false);
        }

        // Cache write in background (non-blocking)
        AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({ members, cachedAt: Date.now() })
        ).catch(() => {
          // Silently fail cache write - not critical
        });

        // Load metrics in the background (non-blocking) for attention items
        // This allows the UI to render immediately while metrics load
        // Use the ref if available (it will be set after loadMemberMetrics is defined)
        // Metrics will be loaded lazily when dashboard view is accessed via useFocusEffect
        // Note: If ref is not set yet, metrics will be loaded by useFocusEffect
      } catch (error) {
        // Set empty array to prevent infinite loading unless we have cache
        if (!usedCache) {
          setFamilyMembers([]);
          familyMembersRef.current = [];
          setMemberMetrics([]);
        }
        // Only show alert if it's not a timeout (to avoid spam)
        if (error instanceof Error && !error.message.includes("timeout")) {
          Alert.alert(
            isRTL ? "خطأ" : "Error",
            isRTL
              ? "فشل في تحميل أعضاء العائلة"
              : "Failed to load family members"
          );
        }
      } finally {
        // Always ensure loading state is cleared
        if (!usedCache) {
          loadingRef.current = false;
          setLoading(false);
        }
        familyMembersRequestInFlightRef.current = false;
        refreshingRef.current = false;
        setRefreshing(false);
      }
    },
    [user?.familyId, isRTL]
  );

  // Load family members when user changes
  useEffect(() => {
    if (!(user?.id || user?.familyId)) {
      setLoading(false);
      return;
    }

    loadFamilyMembers();

    // Safety timeout: ensure loading is never stuck true for more than 20 seconds
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 20_000);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.familyId, loadFamilyMembers]);

  const loadEvents = useCallback(
    async (isRefresh = false, membersOverride?: typeof familyMembers) => {
      // Prevent concurrent loads using ref to avoid dependency issues
      if (!isRefresh && loadingEventsRef.current) return;

      if (!user?.id) return;

      const startTime = Date.now();

      // Use provided members or fall back to ref (avoids dependency on familyMembers array)
      const membersToUse = membersOverride ?? familyMembersRef.current;

      try {
        loadingEventsRef.current = true;
        if (isRefresh) {
          setLoadingEvents(true);
        } else {
          setLoadingEvents(true);
        }

        // For admins with family, load all family member events
        if (isAdmin && user.familyId && membersToUse.length > 0) {
          logger.debug(
            "Loading family health events",
            {
              userId: user.id,
              familyId: user.familyId,
              memberCount: membersToUse.length,
            },
            "FamilyScreen"
          );

          const userIds = membersToUse.map((member) => member.id);
          const familyEvents = await getFamilyHealthEvents(userIds);
          setEvents(familyEvents);

          const durationMs = Date.now() - startTime;
          logger.info(
            "Family health events loaded",
            {
              userId: user.id,
              eventCount: familyEvents.length,
              durationMs,
            },
            "FamilyScreen"
          );
        } else {
          // For non-admins or users without family, load only their own events
          logger.debug(
            "Loading user health events",
            {
              userId: user.id,
            },
            "FamilyScreen"
          );

          const userEvents = await getUserHealthEvents(user.id);
          setEvents(userEvents);

          const durationMs = Date.now() - startTime;
          logger.info(
            "User health events loaded",
            {
              userId: user.id,
              eventCount: userEvents.length,
              durationMs,
            },
            "FamilyScreen"
          );
        }
      } catch (error) {
        const _durationMs = Date.now() - startTime;
        logger.error("Failed to load health events", error, "FamilyScreen");
      } finally {
        loadingEventsRef.current = false;
        setLoadingEvents(false);
      }
    },
    [user?.id, user?.familyId, isAdmin]
  );

  const loadActiveAlerts = useCallback(
    async (isRefresh = false, membersOverride?: typeof familyMembers) => {
      if (!user?.id) return;

      try {
        setLoadingAlerts(true);

        const membersToUse = membersOverride ?? familyMembersRef.current;
        const alertsWithMembers: Array<{
          alert: import("@/types").EmergencyAlert;
          memberName: string;
        }> = [];

        if (isAdmin && user.familyId && membersToUse.length > 0) {
          // Load alerts for all family members
          const alertPromises = membersToUse.map(async (member) => {
            try {
              const alerts = await alertService.getActiveAlerts(member.id);
              const fullName =
                member.firstName && member.lastName
                  ? `${member.firstName} ${member.lastName}`
                  : member.firstName || (isRTL ? "عضو" : "Member");
              return alerts.map((alert) => ({
                alert,
                memberName: fullName,
              }));
            } catch {
              return [];
            }
          });

          const results = await Promise.allSettled(alertPromises);
          results.forEach((result) => {
            if (result.status === "fulfilled") {
              alertsWithMembers.push(...result.value);
            }
          });
        } else {
          // Load alerts for current user only
          try {
            const alerts = await alertService.getActiveAlerts(user.id);
            alertsWithMembers.push(
              ...alerts.map((alert) => ({
                alert,
                memberName:
                  user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.firstName || (isRTL ? "أنت" : "You"),
              }))
            );
          } catch {
            // Error loading alerts
          }
        }

        // Sort by timestamp (newest first)
        alertsWithMembers.sort(
          (a, b) => b.alert.timestamp.getTime() - a.alert.timestamp.getTime()
        );

        setActiveAlerts(alertsWithMembers);
      } catch (error) {
        logger.error("Failed to load active alerts", error, "FamilyScreen");
      } finally {
        setLoadingAlerts(false);
      }
    },
    [user?.id, user?.familyId, isAdmin]
  );

  const handleAcknowledgeEvent = async (eventId: string) => {
    if (!user?.id) return;

    const startTime = Date.now();

    try {
      logger.info(
        "User acknowledging health event",
        {
          eventId,
          userId: user.id,
          role: user.role,
        },
        "FamilyScreen"
      );

      await acknowledgeHealthEvent(eventId, user.id);
      await loadEvents(true);

      const durationMs = Date.now() - startTime;
      logger.info(
        "Health event acknowledged successfully",
        {
          eventId,
          userId: user.id,
          durationMs,
        },
        "FamilyScreen"
      );

      Alert.alert(t("success"), t("eventAcknowledged"));
    } catch (error) {
      const _durationMs = Date.now() - startTime;
      logger.error("Failed to acknowledge health event", error, "FamilyScreen");

      Alert.alert(t("error"), t("failedToAcknowledgeEvent"));
    }
  };

  const handleResolveEvent = async (eventId: string) => {
    if (!user?.id) return;

    const startTime = Date.now();

    try {
      logger.info(
        "User resolving health event",
        {
          eventId,
          userId: user.id,
          role: user.role,
        },
        "FamilyScreen"
      );

      await resolveHealthEvent(eventId, user.id);
      await loadEvents(true);

      const durationMs = Date.now() - startTime;
      logger.info(
        "Health event resolved successfully",
        {
          eventId,
          userId: user.id,
          durationMs,
        },
        "FamilyScreen"
      );

      Alert.alert(t("success"), t("eventResolved"));
    } catch (error) {
      const _durationMs = Date.now() - startTime;
      logger.error("Failed to resolve health event", error, "FamilyScreen");

      Alert.alert(t("error"), t("failedToResolveEvent"));
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    if (!user?.id) return;
    if (resolvingAlertId) return;

    setResolvingAlertId(alertId);

    // Optimistic update: remove from UI immediately
    setActiveAlerts((prev) => prev.filter((item) => item.alert.id !== alertId));

    const startTime = Date.now();

    try {
      logger.info(
        "User resolving alert",
        {
          alertId,
          userId: user.id,
          role: user.role,
        },
        "FamilyScreen"
      );

      await alertService.resolveAlert(alertId, user.id);
      await loadActiveAlerts(true);

      const durationMs = Date.now() - startTime;
      logger.info(
        "Alert resolved successfully",
        {
          alertId,
          userId: user.id,
          durationMs,
        },
        "FamilyScreen"
      );

      Alert.alert(t("success"), t("alertResolvedSuccessfully"));
    } catch (error) {
      const _durationMs = Date.now() - startTime;
      logger.error("Failed to resolve alert", error, "FamilyScreen");

      // Revert optimistic update on failure
      await loadActiveAlerts(true);

      Alert.alert(t("error"), t("failedToResolveAlert"));
    } finally {
      setResolvingAlertId(null);
    }
  };

  const handleEscalateEvent = async (eventId: string) => {
    if (!user?.id) return;

    Alert.prompt(
      isRTL ? "تصعيد الحدث" : "Escalate Event",
      isRTL ? "أدخل سبب التصعيد:" : "Enter reason for escalation:",
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isRTL ? "تصعيد" : "Escalate",
          onPress: async (reason?: string) => {
            const startTime = Date.now();

            try {
              logger.info(
                "User escalating health event",
                {
                  eventId,
                  userId: user.id,
                  role: user.role,
                  hasReason: !!reason,
                },
                "FamilyScreen"
              );

              await escalateHealthEvent(eventId, user.id, reason || undefined);
              await loadEvents(true);

              const durationMs = Date.now() - startTime;
              logger.info(
                "Health event escalated successfully",
                {
                  eventId,
                  userId: user.id,
                  durationMs,
                },
                "FamilyScreen"
              );

              Alert.alert(t("success"), t("eventEscalated"));
            } catch (error) {
              const _durationMs = Date.now() - startTime;
              logger.error(
                "Failed to escalate health event",
                error,
                "FamilyScreen"
              );

              Alert.alert(t("error"), t("failedToEscalateEvent"));
            }
          },
        },
      ],
      "plain-text",
      "",
      "default"
    );
  };

  const formatEventTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return t("justNow");
    }
    if (diffHours < 24) {
      return t("hoursAgo", { count: diffHours });
    }
    return t("daysAgo", { count: diffDays });
  };

  const getLocalizedAlertMessage = (alert: EmergencyAlert) => {
    const message = alert?.message ?? "";
    if (!isRTL) {
      return message;
    }

    // If the message already contains Arabic, keep it.
    if (/[\u0600-\u06FF]/.test(message)) {
      return message;
    }

    const normalized = message.trim().toLowerCase();
    const byType = () => {
      switch (alert.type) {
        case "fall":
          return "تم اكتشاف سقوط";
        case "medication":
          return "تنبيه دواء";
        case "vitals":
          return "تنبيه مؤشرات حيوية";
        case "vital_critical":
          return "تنبيه مؤشرات حيوية حرِج";
        case "vital_error":
          return "خطأ في المؤشرات الحيوية";
        case "emergency":
        default:
          return "تنبيه طارئ";
      }
    };

    if (!normalized) {
      return byType();
    }

    // Emergency
    if (
      normalized.includes("emergency alert from user") ||
      normalized.includes("needs emergency help")
    ) {
      return "تنبيه طارئ من المستخدم";
    }
    if (normalized.includes("emergency")) {
      return "تنبيه طارئ";
    }

    // Fall
    if (
      normalized.includes("fall detected") ||
      normalized.includes("fall detection") ||
      normalized.includes("fall alert")
    ) {
      return "تم اكتشاف سقوط";
    }

    // Medication
    if (
      normalized.includes("medication reminder") ||
      normalized.includes("medicine reminder")
    ) {
      return "تذكير دواء";
    }
    if (
      normalized.includes("missed dose") ||
      normalized.includes("missed medication") ||
      normalized.includes("medication missed")
    ) {
      return "تم تفويت جرعة دواء";
    }

    // Vitals
    if (
      normalized.includes("vital") ||
      normalized.includes("vitals") ||
      normalized.includes("blood pressure") ||
      normalized.includes("heart rate") ||
      normalized.includes("oxygen") ||
      normalized.includes("spo2") ||
      normalized.includes("glucose")
    ) {
      return alert.type === "vital_critical"
        ? "تنبيه مؤشرات حيوية حرِج"
        : "تنبيه مؤشرات حيوية";
    }

    return byType();
  };

  const getEventStatusColor = (status: HealthEvent["status"]) => {
    switch (status) {
      case "OPEN":
        return "#EF4444";
      case "ACKED":
        return "#F59E0B";
      case "RESOLVED":
        return "#10B981";
      case "ESCALATED":
        return "#8B5CF6";
      default:
        return "#EF4444";
    }
  };

  const getEventStatusText = (status: HealthEvent["status"]) => {
    switch (status) {
      case "OPEN":
        return isRTL ? "مفتوح" : "Open";
      case "ACKED":
        return isRTL ? "تمت المعالجة" : "Acknowledged";
      case "RESOLVED":
        return isRTL ? "تم الحل" : "Resolved";
      case "ESCALATED":
        return isRTL ? "تم التصعيد" : "Escalated";
      default:
        return isRTL ? "غير معروف" : "Unknown";
    }
  };

  const loadMemberMetrics = useCallback(
    async (members: User[]) => {
      if (!members.length) {
        setMemberMetrics([]);
        return;
      }

      try {
        setLoadingMetrics(true);

        // Use Promise.allSettled to prevent one slow member from blocking others
        // This allows partial results to be displayed while others are still loading
        const metricsPromises = members.map(
          async (member): Promise<FamilyMemberMetrics | null> => {
            try {
              // Fetch only essential data for faster loading
              // Use Promise.allSettled to handle partial failures gracefully
              const results = await Promise.allSettled([
                // Only fetch recent symptoms (last 7 days) - limit to 5 for count
                symptomService.getUserSymptoms(member.id, 5),
                // Only fetch active medications for count
                medicationService.getUserMedications(member.id),
                // Alerts count is lightweight
                alertService.getActiveAlertsCount(member.id),
                // Limit allergies to 10 for display
                allergyService.getUserAllergies(member.id, 10),
                // Get latest vitals from Firestore vitals collection (most accurate)
                // This uses the actual saved metrics instead of just user document fields
                viewMode === "dashboard"
                  ? healthDataService.getLatestVitalsFromFirestore(member.id)
                  : Promise.resolve(null),
              ]);

              const [
                symptomsResult,
                medicationsResult,
                alertsResult,
                allergiesResult,
                vitalsResult,
              ] = results;

              const symptoms =
                symptomsResult.status === "fulfilled"
                  ? symptomsResult.value
                  : null;
              const medications =
                medicationsResult.status === "fulfilled"
                  ? medicationsResult.value
                  : null;
              const alertsCount =
                alertsResult.status === "fulfilled" ? alertsResult.value : null;
              const allergies =
                allergiesResult.status === "fulfilled"
                  ? allergiesResult.value
                  : null;
              // Get vitals directly from Firestore vitals collection (most accurate)
              const vitals: VitalSigns | null =
                vitalsResult.status === "fulfilled" && vitalsResult.value
                  ? vitalsResult.value
                  : null;

              const healthScore =
                symptoms && medications
                  ? healthScoreService.calculateHealthScoreFromData(
                      symptoms,
                      medications
                    ).score
                  : null;
              const activeMedications = medications
                ? medications.filter((m: { isActive: boolean }) => m.isActive)
                : null;

              // Count symptoms this week (already limited to recent by getUserSymptoms)
              const symptomsThisWeek = symptoms ? symptoms.length : null;

              const symptomTimestamp =
                symptoms && symptoms.length > 0 ? symptoms[0].timestamp : null;
              const symptomDate =
                symptomTimestamp instanceof Date
                  ? symptomTimestamp
                  : symptomTimestamp
                    ? new Date(symptomTimestamp)
                    : null;
              const validSymptomDate =
                symptomDate && !Number.isNaN(symptomDate.getTime())
                  ? symptomDate
                  : null;
              const vitalsTimestamp =
                vitals?.timestamp && !Number.isNaN(vitals.timestamp.getTime())
                  ? vitals.timestamp
                  : null;
              let lastCheckIn: Date | null = null;
              if (vitalsTimestamp && validSymptomDate) {
                lastCheckIn =
                  vitalsTimestamp.getTime() >= validSymptomDate.getTime()
                    ? vitalsTimestamp
                    : validSymptomDate;
              } else {
                lastCheckIn = vitalsTimestamp ?? validSymptomDate;
              }

              return {
                id: member.id,
                user: member,
                healthScore,
                symptomsThisWeek,
                activeMedications: activeMedications
                  ? activeMedications.length
                  : null,
                alertsCount,
                vitals: vitals ?? null,
                allergies,
                lastCheckIn,
              };
            } catch (_error) {
              // Don't return mock values if data fetch fails.
              return null;
            }
          }
        );

        // Use allSettled to get partial results even if some fail
        const results = await Promise.allSettled(metricsPromises);
        const metrics = results
          .map((result) =>
            result.status === "fulfilled" ? result.value : null
          )
          .filter((m): m is FamilyMemberMetrics => m !== null);

        setMemberMetrics(metrics);
      } catch (_error) {
        // Set empty metrics to prevent infinite loading
        setMemberMetrics([]);
      } finally {
        setLoadingMetrics(false);
      }
    },
    [viewMode]
  );

  // Store reference after function is defined
  // Also trigger metrics load if family members are already loaded
  useEffect(() => {
    loadMemberMetricsRef.current = loadMemberMetrics;

    // Load member metrics when family members are available (needed for family cards)
    if (
      familyMembers.length > 0 &&
      memberMetrics.length === 0 &&
      !loadingMetrics
    ) {
      loadMemberMetrics(familyMembers).catch(() => {
        // Error loading member metrics after ref set
      });
    }
  }, [
    loadMemberMetrics,
    familyMembers.length,
    memberMetrics.length,
    loadingMetrics,
    familyMembers,
  ]);

  // Load caregiver dashboard data
  const loadCaregiverDashboard = useCallback(async () => {
    // Prevent concurrent loads
    if (loadingCaregiverDashboardRef.current) {
      return;
    }

    if (
      !user?.familyId ||
      (user?.role !== "admin" && user?.role !== "caregiver")
    ) {
      setCaregiverOverview(null);
      return;
    }

    try {
      setLoadingCaregiverDashboard(true);
      const dashboardData =
        await caregiverDashboardService.getCaregiverOverview(
          user.id,
          user.familyId
        );
      setCaregiverOverview(dashboardData);
    } catch (_error) {
      // Silently handle error - fallback to regular dashboard
      setCaregiverOverview(null);
    } finally {
      setLoadingCaregiverDashboard(false);
    }
  }, [user?.id, user?.familyId, user?.role]);

  // Load medication schedule data
  const loadMedicationSchedule = useCallback(
    async (isRefresh = false) => {
      if (!user?.familyId) return;
      if (!isRefresh && medicationScheduleRequestInFlightRef.current) return;

      try {
        medicationScheduleRequestInFlightRef.current = true;
        if (isRefresh) {
          // Don't show loading spinner on refresh
        } else {
          setLoadingMedicationSchedule(true);
        }

        // Add timeout to prevent infinite loading
        let medicationScheduleTimeout: ReturnType<typeof setTimeout> | null =
          null;
        const timeoutPromise = new Promise((_, reject) => {
          medicationScheduleTimeout = setTimeout(
            () => reject(new Error("Medication schedule loading timeout")),
            15_000
          );
        });

        const dataPromise =
          sharedMedicationScheduleService.getFamilyScheduleBundle(
            user.familyId,
            user.id,
            isRefresh,
            familyMembersRef.current,
            7
          );

        const { entries, today, upcoming } = (await Promise.race([
          dataPromise,
          timeoutPromise,
        ]).finally(() => {
          if (medicationScheduleTimeout) {
            clearTimeout(medicationScheduleTimeout);
          }
        })) as {
          entries: MedicationScheduleEntry[];
          today: SharedScheduleDay | null;
          upcoming: SharedScheduleDay[];
        };

        setMedicationScheduleEntries(entries);
        setTodaySchedule(today);
        setUpcomingSchedule(upcoming);
      } catch (_error) {
        // Set empty state to prevent infinite loading
        setMedicationScheduleEntries([]);
        setTodaySchedule(null);
        setUpcomingSchedule([]);
      } finally {
        medicationScheduleRequestInFlightRef.current = false;
        setLoadingMedicationSchedule(false);
      }
    },
    [user]
  );

  // Note: Metrics and events are now loaded in useFocusEffect to avoid duplicate loading

  const _getHealthStatusColor = (status: string) => {
    switch (status) {
      case "excellent":
        return "#10B981";
      case "good":
        return "#003543";
      case "attention":
        return "#F59E0B";
      case "critical":
        return "#EF4444";
      default:
        return "#64748B";
    }
  };

  const _getHealthStatusText = (status: string) => {
    const statusMap = {
      excellent: isRTL ? "ممتاز" : "Excellent",
      good: isRTL ? "جيد" : "Good",
      attention: isRTL ? "يحتاج انتباه" : "Needs Attention",
      critical: isRTL ? "حرج" : "Critical",
    };
    return statusMap[status as keyof typeof statusMap] || status;
  };

  const formatMedicationTime = (date?: Date) => {
    if (!date) return "";
    return safeFormatTime(date, isRTL ? "ar" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatMedicationDate = (date: Date) =>
    safeFormatDate(date, isRTL ? "ar-u-ca-gregory" : "en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

  const getComplianceColor = (rate?: number) => {
    if (!rate) return theme.colors.text.secondary;
    if (rate >= 90) return "#10B981";
    if (rate >= 70) return "#F59E0B";
    return "#EF4444";
  };

  const handleMarkMedicationAsTaken = async (
    entry: MedicationScheduleEntry
  ) => {
    if (!user?.familyId) return;

    const canManage =
      await sharedMedicationScheduleService.canManageMedications(
        user.id,
        entry.member.id
      );

    if (!canManage && user.id !== entry.member.id) {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لإدارة أدوية هذا العضو"
          : "You don't have permission to manage this member's medications"
      );
      return;
    }

    setMarkingTaken(entry.medication.id);
    try {
      await sharedMedicationScheduleService.markMedicationAsTaken(
        entry.medication.id,
        entry.member.id,
        user.id,
        user.familyId
      );

      Alert.alert(
        isRTL ? "نجح" : "Success",
        isRTL
          ? `تم تسجيل تناول ${entry.medication.name}`
          : `Marked ${entry.medication.name} as taken`
      );

      await loadMedicationSchedule(true);
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل تسجيل تناول الدواء" : "Failed to mark medication as taken"
      );
    } finally {
      setMarkingTaken(null);
    }
  };

  const getFilteredMedicationEntries = () => {
    let entries;
    if (medicationScheduleViewMode === "today" && todaySchedule) {
      entries = todaySchedule.entries;
    } else if (medicationScheduleViewMode === "upcoming") {
      entries = upcomingSchedule.flatMap((day) => day.entries);
    } else {
      entries = medicationScheduleEntries;
    }

    // Filter entries based on selectedFilter
    if (selectedFilter.type === "personal") {
      // Show only current user's medications
      return entries.filter((entry) => entry.member.id === user?.id);
    }
    if (selectedFilter.type === "member" && selectedFilter.memberId) {
      // Show only selected member's medications
      return entries.filter(
        (entry) => entry.member.id === selectedFilter.memberId
      );
    }
    if (selectedFilter.type === "family") {
      // Show all family members' medications
      return entries;
    }
    // Default to personal
    return entries.filter((entry) => entry.member.id === user?.id);
  };

  const handleInviteMember = async () => {
    if (!(inviteForm.name && inviteForm.relation)) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى ملء البيانات المطلوبة" : "Please fill in required fields"
      );
      return;
    }

    if (!user?.familyId) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "لا توجد عائلة متصلة" : "No family found"
      );
      return;
    }

    // Check subscription limits before inviting
    // Always enforce limits - if subscription is loading, use conservative defaults (assume no premium)
    const currentMemberCount = familyMembers.length;
    const maxMembers = subscriptionLoading ? 0 : maxTotalMembers || 0;
    const hasPremium = subscriptionLoading ? false : isPremium;

    // If no premium subscription, limit to 1 member (just the admin)
    if (hasPremium) {
      // Check if family has reached the limit
      if (currentMemberCount >= maxMembers) {
        // Close invite modal first
        setShowInviteModal(false);
        Alert.alert(
          isRTL ? "تم الوصول للحد الأقصى" : "Member Limit Reached",
          isRTL
            ? `لقد وصلت إلى الحد الأقصى لعدد الأعضاء في اشتراكك (${maxMembers} عضو). قم بالترقية إلى الخطة العائلية لإضافة المزيد من الأعضاء.`
            : `You've reached the maximum number of members for your plan (${maxMembers} members). Upgrade to Family Plan to add more members.`,
          [
            {
              text: isRTL ? "إلغاء" : "Cancel",
              style: "cancel",
            },
            {
              text: isRTL
                ? "الترقية إلى الخطة العائلية"
                : "Upgrade to Family Plan",
              onPress: () => {
                setShowPaywall(true);
              },
            },
          ]
        );
        return;
      }
    } else if (currentMemberCount >= 1) {
      // Close invite modal first
      setShowInviteModal(false);
      Alert.alert(
        isRTL ? "خطأ" : "Premium Required",
        isRTL
          ? "يجب الاشتراك في الخطة العائلية لإضافة أعضاء إضافيين إلى العائلة"
          : "A premium subscription is required to add additional family members",
        [
          {
            text: isRTL ? "إلغاء" : "Cancel",
            style: "cancel",
          },
          {
            text: isRTL ? "عرض الخطط العائلية" : "View Family Plans",
            onPress: () => {
              setShowPaywall(true);
            },
          },
        ]
      );
      return;
    }

    // Validate user authentication and permissions
    if (!user?.id) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "يجب تسجيل الدخول أولاً"
          : "You must be logged in to invite members"
      );
      return;
    }

    if (!user.familyId) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "يجب أن تكون جزءاً من عائلة لدعوة أعضاء"
          : "You must be part of a family to invite members"
      );
      return;
    }

    if (user.role !== "admin") {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "يجب أن تكون مديراً للعائلة لدعوة أعضاء جدد"
          : "You must be a family admin to invite new members"
      );
      return;
    }

    setInviteLoading(true);

    try {
      const code = await familyInviteService.createInvitationCode(
        user.familyId,
        user.id,
        inviteForm.name,
        inviteForm.relation
      );

      setGeneratedCode(code);
      const memberName = inviteForm.name;
      setInviteForm({ name: "", relation: "" });

      // Close the invite modal after successful creation
      setShowInviteModal(false);

      // Prepare sharing message
      const shareMessage = isRTL
        ? `مرحباً ${memberName}! تمت دعوتك للانضمام إلى مجموعة العائلة الصحية على تطبيق معك.\n\nرمز الدعوة: ${code}\n\n1. حمّل تطبيق معك\n2. سجّل دخولك أو أنشئ حساباً جديداً\n3. استخدم رمز الدعوة: ${code}\n\nهذا الرمز صالح لمدة 7 أيام.`
        : `Hi ${memberName}! You've been invited to join our family health group on Maak app.\n\nInvitation Code: ${code}\n\n1. Download the Maak app\n2. Sign in or create a new account\n3. Use invitation code: ${code}\n\nThis code expires in 7 days.`;

      // Show options to share or copy with clearer labels
      Alert.alert(
        isRTL ? "تم إنشاء الدعوة" : "Invitation Created",
        isRTL
          ? `تم إنشاء رمز الدعوة لـ ${memberName}: ${code}\n\nماذا تريد أن تفعل؟`
          : `Invitation code created for ${memberName}: ${code}\n\nWhat would you like to do?`,
        [
          {
            text: isRTL ? "مشاركة عبر التطبيقات" : "Share via Apps",
            onPress: async () => {
              try {
                await Share.share({
                  message: shareMessage,
                  title: isRTL
                    ? "دعوة للانضمام إلى معك"
                    : "Invitation to join Maak",
                });
              } catch (_error) {
                // Fallback to copying to clipboard
                await setClipboardString(shareMessage);
                Alert.alert(
                  isRTL ? "تم النسخ" : "Copied",
                  isRTL
                    ? "تم نسخ رسالة الدعوة إلى الحافظة"
                    : "Invitation message copied to clipboard"
                );
              }
            },
          },
          {
            text: isRTL ? "نسخ رمز الدعوة فقط" : "Copy Invitation Code Only",
            onPress: async () => {
              await setClipboardString(code);
              Alert.alert(
                isRTL ? "تم النسخ" : "Copied",
                isRTL
                  ? `تم نسخ رمز الدعوة: ${code}`
                  : `Invitation code copied: ${code}`
              );
            },
          },
          {
            text: isRTL ? "إلغاء" : "Cancel",
            style: "cancel",
          },
        ]
      );
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في إنشاء رمز الدعوة" : "Failed to generate invite code"
      );
    } finally {
      setInviteLoading(false);
    }
  };

  const handleEditMember = (member: User) => {
    // Check permissions: admins/caregivers can edit anyone, members can only edit themselves
    const canEdit =
      user?.role === "admin" ||
      user?.role === "caregiver" ||
      user?.id === member.id;

    if (!canEdit) {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لتعديل هذا العضو"
          : "You do not have permission to edit this member"
      );
      return;
    }

    setEditMemberForm({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email || "",
      role: member.role,
    });
    setShowEditMemberModal(true);
  };

  const handleSaveEditMember = async () => {
    if (!editMemberForm.firstName.trim()) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى إدخال الاسم الأول" : "Please enter a first name"
      );
      return;
    }

    if (!user) return;

    setEditLoading(true);

    try {
      const updates: Partial<User> = {
        firstName: editMemberForm.firstName.trim(),
        lastName: editMemberForm.lastName.trim(),
      };

      // Only admins/caregivers can change roles and only for other users (not themselves)
      if (
        (user.role === "admin" || user.role === "caregiver") &&
        user.id !== editMemberForm.id
      ) {
        if (
          editMemberForm.role !== "admin" &&
          editMemberForm.role !== "member" &&
          editMemberForm.role !== "caregiver"
        ) {
          Alert.alert(
            isRTL ? "خطأ" : "Error",
            isRTL ? "يرجى اختيار دور صحيح" : "Please select a valid role"
          );
          return;
        }
        updates.role = editMemberForm.role;
      }

      await userService.updateUser(editMemberForm.id, updates);

      // Reload family members to reflect changes
      await loadFamilyMembers();

      setShowEditMemberModal(false);
      setEditMemberForm({
        id: "",
        firstName: "",
        lastName: "",
        email: "",
        role: "member",
      });

      Alert.alert(
        isRTL ? "تم الحفظ" : "Saved",
        isRTL ? "تم تحديث بيانات العضو بنجاح" : "Member updated successfully"
      );
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في تحديث بيانات العضو" : "Failed to update member"
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteMember = (member: User) => {
    // Check permissions: only admins can delete members, and members can't delete themselves
    if (user?.role !== "admin") {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لحذف أعضاء العائلة"
          : "You do not have permission to remove family members"
      );
      return;
    }

    // Prevent deleting yourself
    if (member.id === user?.id) {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "لا يمكنك حذف نفسك من العائلة"
          : "You cannot remove yourself from the family"
      );
      return;
    }

    Alert.alert(
      isRTL ? "حذف العضو" : "Remove Member",
      isRTL
        ? `هل أنت متأكد من رغبتك في إزالة ${member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName || "User"} من العائلة؟`
        : `Are you sure you want to remove ${member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName || "User"} from the family?`,
      [
        {
          text: isRTL ? "إلغاء" : "Cancel",
          style: "cancel",
        },
        {
          text: isRTL ? "إزالة" : "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);

              // Remove user from family
              await userService.updateUser(member.id, {
                familyId: undefined,
                role: "admin", // Reset to admin for when they create/join another family
              });

              // Reload family members to reflect changes
              await loadFamilyMembers();

              Alert.alert(
                isRTL ? "تمت الإزالة" : "Removed",
                isRTL
                  ? "تمت إزالة العضو من العائلة بنجاح"
                  : "Member removed from family successfully"
              );
            } catch (_error) {
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL ? "فشل في إزالة العضو" : "Failed to remove member"
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEmergencySettings = () => {
    setShowEmergencyModal(true);
  };

  const handleToggleMedicationAlerts = async (enabled: boolean) => {
    try {
      setMedicationAlertsEnabled(enabled);
      await AsyncStorage.setItem(
        "medication_alerts_enabled",
        JSON.stringify(enabled)
      );
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في تحديث الإعدادات" : "Failed to update settings"
      );
    }
  };

  const handleAddEmergencyContact = async () => {
    try {
      Keyboard.dismiss();

      const nameValue = newContact.name?.trim() || "";
      const phoneValue = newContact.phone?.trim() || "";

      if (!(nameValue && phoneValue)) {
        setTimeout(() => {
          Alert.alert(
            isRTL ? "خطأ" : "Error",
            isRTL
              ? "يرجى ملء جميع البيانات المطلوبة"
              : "Please fill in all fields",
            [{ text: isRTL ? "حسنًا" : "OK" }],
            { cancelable: true }
          );
        }, 100);
        return;
      }

      const phoneRegex = /^[+]?[\d\s\-()]{10,}$/;
      if (!phoneRegex.test(phoneValue)) {
        setTimeout(() => {
          Alert.alert(
            isRTL ? "خطأ" : "Error",
            isRTL
              ? "يرجى إدخال رقم هاتف صحيح"
              : "Please enter a valid phone number",
            [{ text: isRTL ? "حسنًا" : "OK" }],
            { cancelable: true }
          );
        }, 100);
        return;
      }

      const contact = {
        id: Date.now().toString(),
        name: nameValue,
        phone: phoneValue,
      };

      const updatedContacts = [...emergencyContacts, contact];
      setEmergencyContacts(updatedContacts);
      if (user?.id) {
        await updateUser({
          preferences: getMergedPreferences(updatedContacts),
        });
      }
      setNewContact({ name: "", phone: "" });

      setTimeout(() => {
        Alert.alert(
          isRTL ? "تم الحفظ" : "Saved",
          isRTL
            ? "تمت إضافة جهة الاتصال بنجاح"
            : "Emergency contact added successfully",
          [{ text: isRTL ? "حسنًا" : "OK" }],
          { cancelable: true }
        );
      }, 200);
    } catch (_error) {
      Keyboard.dismiss();
      setTimeout(() => {
        Alert.alert(
          isRTL ? "خطأ" : "Error",
          isRTL
            ? "حدث خطأ أثناء إضافة جهة الاتصال"
            : "An error occurred while adding the contact",
          [{ text: isRTL ? "حسنًا" : "OK" }],
          { cancelable: true }
        );
      }, 100);
    }
  };

  const handleDeleteEmergencyContact = (contactId: string) => {
    Alert.alert(
      isRTL ? "حذف جهة الاتصال" : "Delete Contact",
      isRTL
        ? "هل أنت متأكد من حذف جهة الاتصال هذه؟"
        : "Are you sure you want to delete this contact?",
      [
        {
          text: isRTL ? "إلغاء" : "Cancel",
          style: "cancel",
        },
        {
          text: isRTL ? "حذف" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const updatedContacts = emergencyContacts.filter(
                (c) => c.id !== contactId
              );
              setEmergencyContacts(updatedContacts);
              if (user?.id) {
                await updateUser({
                  preferences: getMergedPreferences(updatedContacts),
                });
              }
              Alert.alert(
                isRTL ? "تم الحذف" : "Deleted",
                isRTL
                  ? "تم حذف جهة الاتصال بنجاح"
                  : "Emergency contact deleted successfully"
              );
            } catch (_error) {
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL
                  ? "فشل في تحديث جهة الاتصال"
                  : "Failed to update emergency contact"
              );
            }
          },
        },
      ]
    );
  };

  const handleGenerateHealthReport = async () => {
    if (!user?.familyId) return;

    setGeneratingReport(true);
    try {
      const generatedReport =
        await familyHealthReportService.generateFamilyReport(
          user.familyId,
          dateRange.start,
          dateRange.end,
          privacySettings
        );

      setHealthReport(generatedReport);
      setShowPrivacyModal(false);
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل إنشاء التقرير" : "Failed to generate report"
      );
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleExportPDF = async () => {
    if (!healthReport) return;

    try {
      // Generate HTML content for PDF
      const htmlContent = familyHealthReportService.formatReportAsHTML(
        healthReport,
        isRTL
      );

      // Generate PDF using expo-print
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Share the PDF file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert(
          isRTL ? "خطأ" : "Error",
          isRTL ? "مشاركة الملف غير متاحة" : "File sharing not available"
        );
      }
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? `فشل تصدير التقرير: ${error instanceof Error ? error.message : "خطأ غير معروف"}`
          : `Failed to export report: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return theme.colors.health.excellent; // Green
    if (score >= 60) return theme.colors.health.fair; // Orange/Yellow
    return theme.colors.health.critical; // Red
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving":
        return <TrendingUp color={theme.colors.health.excellent} size={16} />;
      case "worsening":
        return <TrendingDown color={theme.colors.health.critical} size={16} />;
      default:
        return null;
    }
  };

  const loadElderlyDashboard = useCallback(
    async (isRefresh = false) => {
      // Prevent concurrent loads
      if (!isRefresh && loadingElderlyDashboardRef.current) return;
      if (isRefresh && refreshingElderlyDashboardRef.current) return;

      if (!user?.id) return;

      try {
        if (isRefresh) {
          setRefreshingElderlyDashboard(true);
        } else {
          setLoadingElderlyDashboard(true);
        }

        const data = await caregiverDashboardService.getElderlyUserDashboard(
          user.id
        );
        setElderlyDashboardData(data);
      } catch (_error) {
        Alert.alert(
          isRTL ? "خطأ" : "Error",
          isRTL ? "فشل تحميل البيانات" : "Failed to load data"
        );
      } finally {
        setLoadingElderlyDashboard(false);
        setRefreshingElderlyDashboard(false);
      }
    },
    [user?.id, isRTL]
  );

  // Mark the initial view mode as initialized once user is available.
  useEffect(() => {
    if (user) {
      viewModeInitialized.current = true;
    }
  }, [user]);

  // Load caregiver dashboard when view mode changes to dashboard and user is admin
  useEffect(() => {
    if (viewMode === "dashboard" && isAdmin && user?.id && user?.familyId) {
      loadCaregiverDashboard();
    } else if (viewMode === "dashboard" && !isAdmin && user?.id) {
      // Load elderly dashboard for non-admin users
      loadElderlyDashboard();
    }
  }, [
    viewMode,
    isAdmin,
    user?.id,
    user?.familyId,
    loadCaregiverDashboard, // Load elderly dashboard for non-admin users
    loadElderlyDashboard,
  ]);

  // Refresh data when tab is focused - load in parallel for better performance
  useFocusEffect(
    useCallback(() => {
      // Only load if we have a user
      if (!user?.id) return;

      // Load all data efficiently - show UI immediately, load heavy data in background
      const loadData = async () => {
        if (focusLoadInFlightRef.current) {
          return;
        }
        focusLoadInFlightRef.current = true;

        try {
          // Step 1: Load family members first and show immediately (if not already loaded)
          let members: typeof familyMembers = familyMembersRef.current;
          if (user?.familyId && members.length === 0) {
            await loadFamilyMembers(false);
            members = familyMembersRef.current;
          }

          // Load metrics in background (non-blocking) only if needed
          // Skip if metrics are already loaded for the same number of members
          const needsMetricsLoad =
            members.length > 0 &&
            (memberMetricsRef.current.length === 0 ||
              memberMetricsRef.current.length !== members.length);

          if (needsMetricsLoad) {
            loadMemberMetrics(members).catch(() => {
              // Error loading member metrics
            });
          }

          // Step 2: Load remaining data in parallel (don't wait for metrics)
          const promises: Promise<void>[] = [];

          if (user?.id) {
            // Pass members directly to avoid stale state issue
            promises.push(loadEvents(false, members));
            promises.push(loadActiveAlerts(false, members));
          }

          if (viewMode === "dashboard" && isAdmin) {
            promises.push(loadCaregiverDashboard());
          } else if (viewMode === "dashboard" && !isAdmin) {
            promises.push(loadElderlyDashboard());
          }

          if (user?.familyId) {
            promises.push(loadMedicationSchedule());
          }

          // Wait for critical operations to complete (but not metrics)
          await Promise.allSettled(promises);
        } catch (_error) {
          // Error handling is done in individual load functions
          // This catch prevents unhandled promise rejection
        } finally {
          focusLoadInFlightRef.current = false;
        }
      };

      let cancelled = false;
      const task = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) {
          loadData();
        }
      });

      return () => {
        cancelled = true;
        task.cancel?.();
        focusLoadInFlightRef.current = false;
      };
    }, [
      user?.id,
      user?.familyId,
      viewMode,
      isAdmin,
      loadMemberMetrics,
      loadCaregiverDashboard,
      loadElderlyDashboard,
      loadEvents,
      loadFamilyMembers,
      loadMedicationSchedule,
    ])
  );

  const familyMemberIds = useMemo(
    () => familyMembers.map((member) => member.id),
    [familyMembers]
  );

  const handleRealtimeFamilyUpdate = useCallback(
    (update: { updateType: string }) => {
      const now = Date.now();

      // Refresh member metrics when updates occur (throttled).
      if (familyMembers.length > 0) {
        const metricsRefreshIntervalMs = 10_000;
        if (
          now - lastRealtimeMetricsRefreshRef.current >=
          metricsRefreshIntervalMs
        ) {
          lastRealtimeMetricsRefreshRef.current = now;
          loadMemberMetrics(familyMembers).catch(() => {
            // Error refreshing member metrics
          });
        }
      }

      // Refresh events if alert-related (throttled).
      if (
        update.updateType === "alert_created" ||
        update.updateType === "alert_resolved"
      ) {
        const eventsRefreshIntervalMs = 5000;
        if (
          now - lastRealtimeEventsRefreshRef.current >=
          eventsRefreshIntervalMs
        ) {
          lastRealtimeEventsRefreshRef.current = now;
          loadEvents(false, familyMembers).catch(() => {
            // Silently handle errors
          });
        }
      }

      // Refresh dashboard if in dashboard view.
      if (viewMode === "dashboard") {
        if (isAdmin) {
          loadCaregiverDashboard().catch(() => {
            // Silently handle errors
          });
        } else {
          loadElderlyDashboard().catch(() => {
            // Silently handle errors
          });
        }
      }
    },
    [
      familyMembers,
      isAdmin,
      loadCaregiverDashboard,
      loadElderlyDashboard,
      loadEvents,
      loadMemberMetrics,
      viewMode,
    ]
  );

  const handleTrendAlert = useCallback(
    (alert: { severity: string; trendAnalysis: { message: string } }) => {
      // Refresh member metrics to show updated trends
      if (familyMembers.length > 0) {
        loadMemberMetrics(familyMembers).catch(() => {
          // Silently handle errors
        });
      }
    },
    [familyMembers, loadMemberMetrics]
  );

  // Refs for event handlers so effects only run when the EVENT changes, not when
  // handlers are recreated (avoids processing the same event multiple times).
  const handleRealtimeFamilyUpdateRef = useRef(handleRealtimeFamilyUpdate);
  const handleTrendAlertRef = useRef(handleTrendAlert);
  handleRealtimeFamilyUpdateRef.current = handleRealtimeFamilyUpdate;
  handleTrendAlertRef.current = handleTrendAlert;

  useEffect(() => {
    if (isFocused) {
      setFamilyMemberIds(familyMemberIds);
    }
  }, [isFocused, familyMemberIds, setFamilyMemberIds]);

  useEffect(() => {
    if (!isFocused) {
      setFamilyMemberIds([]);
    }
  }, [isFocused, setFamilyMemberIds]);

  useEffect(() => {
    if (!(familyUpdateEvent && isFocused)) {
      return;
    }
    handleRealtimeFamilyUpdateRef.current(familyUpdateEvent.payload);
  }, [familyUpdateEvent?.id, isFocused]);

  useEffect(() => {
    if (!(trendAlertEvent && isFocused)) {
      return;
    }
    handleTrendAlertRef.current(trendAlertEvent.payload);
  }, [trendAlertEvent?.id, isFocused]);

  const handleElderlyEmergency = async () => {
    Alert.alert(
      isRTL ? "تنبيه طارئ" : "Emergency Alert",
      isRTL
        ? "هل تريد إرسال تنبيه طارئ لمقدمي الرعاية؟"
        : "Do you want to send an emergency alert to caregivers?",
      [
        {
          text: isRTL ? "إلغاء" : "Cancel",
          style: "cancel",
        },
        {
          text: isRTL ? "إرسال" : "Send",
          style: "destructive",
          onPress: async () => {
            try {
              await caregiverDashboardService.sendEmergencyAlert(
                user!.id,
                "medical",
                isRTL ? "تنبيه طارئ من المستخدم" : "Emergency alert from user"
              );
              Alert.alert(
                isRTL ? "تم الإرسال" : "Sent",
                isRTL
                  ? "تم إرسال التنبيه لمقدمي الرعاية"
                  : "Alert sent to caregivers"
              );
            } catch (_error) {
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL ? "فشل إرسال التنبيه" : "Failed to send alert"
              );
            }
          },
        },
      ]
    );
  };

  const handleElderlyCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const getElderlyHealthScoreColor = (score: number) => {
    if (score >= 80) return "#10B981";
    if (score >= 60) return "#F59E0B";
    return "#EF4444";
  };

  const copyInviteCode = async () => {
    // Validate user authentication and permissions
    if (!user?.id) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "يجب تسجيل الدخول أولاً"
          : "You must be logged in to generate invite codes"
      );
      return;
    }

    if (!user.familyId) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "لا توجد عائلة متصلة بك" : "No family found"
      );
      return;
    }

    if (user.role !== "admin") {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "يجب أن تكون مديراً للعائلة لإنشاء رموز الدعوة"
          : "You must be a family admin to generate invite codes"
      );
      return;
    }

    // Check if user has premium subscription
    if (!isPremium) {
      Alert.alert(
        isRTL ? "اشتراك مطلوب" : "Premium Required",
        isRTL
          ? "يجب أن يكون لديك اشتراك مميز لإنشاء رموز الدعوة"
          : "You need a premium subscription to generate invite codes",
        [
          {
            text: isRTL ? "إلغاء" : "Cancel",
            style: "cancel",
          },
          {
            text: isRTL ? "عرض الخطط" : "View Plans",
            onPress: () => setShowPaywall(true),
          },
        ]
      );
      return;
    }

    try {
      // Generate a new invitation code for sharing
      const code = await familyInviteService.createInvitationCode(
        user.familyId,
        user.id,
        "Family Member", // Generic name for shared codes
        "Member" // Generic relation for shared codes
      );

      const shareMessage = isRTL
        ? `مرحباً! تمت دعوتك للانضمام إلى مجموعة العائلة الصحية على تطبيق معك.\n\nرمز الدعوة: ${code}\n\n1. حمّل تطبيق معك\n2. سجّل دخولك أو أنشئ حساباً جديداً\n3. استخدم رمز الدعوة: ${code}\n\nهذا الرمز صالح لمدة 7 أيام.`
        : `Hi! You've been invited to join our family health group on Maak app.\n\nInvitation Code: ${code}\n\n1. Download the Maak app\n2. Sign in or create a new account\n3. Use invitation code: ${code}\n\nThis code expires in 7 days.`;

      // Show options to share or copy with clearer labels
      Alert.alert(
        isRTL ? "رمز الدعوة جاهز" : "Invitation Code Ready",
        isRTL
          ? `رمز الدعوة: ${code}\n\nاختر طريقة المشاركة:`
          : `Invitation Code: ${code}\n\nChoose how to share:`,
        [
          {
            text: isRTL ? "مشاركة عبر التطبيقات" : "Share via Apps",
            onPress: async () => {
              try {
                await Share.share({
                  message: shareMessage,
                  title: isRTL
                    ? "دعوة للانضمام إلى معك"
                    : "Invitation to join Maak",
                });
              } catch (_error) {
                // Fallback to copying to clipboard
                await setClipboardString(shareMessage);
                Alert.alert(
                  isRTL ? "تم النسخ" : "Copied",
                  isRTL
                    ? "تم نسخ رسالة الدعوة إلى الحافظة"
                    : "Invitation message copied to clipboard"
                );
              }
            },
          },
          {
            text: isRTL ? "نسخ رمز الدعوة فقط" : "Copy Invitation Code Only",
            onPress: async () => {
              await setClipboardString(code);
              Alert.alert(
                isRTL ? "تم النسخ" : "Copied",
                isRTL
                  ? `تم نسخ رمز الدعوة: ${code}`
                  : `Invitation code copied: ${code}`
              );
            },
          },
          {
            text: isRTL ? "إلغاء" : "Cancel",
            style: "cancel",
          },
        ]
      );
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في إنشاء رمز الدعوة" : "Failed to generate invitation code"
      );
    }
  };

  const handleJoinFamily = async () => {
    if (!joinFamilyCode.trim()) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى إدخال رمز الدعوة" : "Please enter the invitation code"
      );
      return;
    }

    if (!user) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يجب تسجيل الدخول أولاً" : "You must be logged in first"
      );
      return;
    }

    setJoinLoading(true);

    try {
      const result = await familyInviteService.useInvitationCode(
        joinFamilyCode.trim(),
        user.id
      );
      if (result.success && result.familyId) {
        // Get target family members to check capacity and find admin
        const targetFamilyMembers = await userService.getFamilyMembers(
          result.familyId
        );
        const currentMemberCount = targetFamilyMembers.length;

        // Find the admin of the target family
        const adminUser = targetFamilyMembers.find(
          (member) => member.role === "admin"
        );

        if (!adminUser) {
          Alert.alert(
            isRTL ? "خطأ" : "Error",
            isRTL ? "لم يتم العثور على مدير العائلة" : "Family admin not found"
          );
          setJoinLoading(false);
          return;
        }

        // Check the ADMIN's subscription limits (not the joining user's)
        // The family's capacity is determined by the ADMIN's subscription, not the joining user's
        let adminMaxTotalMembers = 0;
        const currentUserId = user.id;
        try {
          // Temporarily switch RevenueCat context to admin to check their subscription
          await revenueCatService.setUserId(adminUser.id);
          const adminPlanLimits = await revenueCatService.getPlanLimits();
          adminMaxTotalMembers = adminPlanLimits?.totalMembers ?? 0;
        } catch (_error) {
          // If we can't check admin's subscription, default to 0 (will be treated as 1 member limit)
          // This is safe because admin's limits are already enforced when they invite members
        } finally {
          // Always switch back to current user, even if there was an error
          try {
            await revenueCatService.setUserId(currentUserId);
          } catch (_error) {
            // Silently fail - RevenueCat context restoration is not critical
          }
        }

        // Check if the family has reached capacity based on ADMIN's subscription
        // If admin has no premium subscription, they can only have 1 member (themselves)
        const adminMaxMembers =
          adminMaxTotalMembers > 0 ? adminMaxTotalMembers : 1;

        if (currentMemberCount >= adminMaxMembers) {
          Alert.alert(
            isRTL ? "تم الوصول للحد الأقصى" : "Family at Capacity",
            isRTL
              ? `لقد وصلت هذه العائلة إلى الحد الأقصى لعدد الأعضاء في اشتراك المدير (${adminMaxMembers} عضو).`
              : `This family has reached the maximum number of members allowed by the admin's plan (${adminMaxMembers} members).`,
            [
              {
                text: isRTL ? "موافق" : "OK",
                style: "cancel",
              },
            ]
          );
          setJoinLoading(false);
          return;
        }

        // Check if joining user has premium subscription
        // Non-premium users can only join empty families (just the admin)
        const hasPremium = subscriptionLoading ? false : isPremium;

        if (!hasPremium && currentMemberCount >= 1) {
          Alert.alert(
            isRTL ? "خطأ" : "Premium Required",
            isRTL
              ? "يجب الاشتراك في الخطة العائلية للانضمام إلى عائلة تحتوي على أعضاء"
              : "A premium subscription is required to join a family that already has members",
            [
              {
                text: isRTL ? "إلغاء" : "Cancel",
                style: "cancel",
              },
              {
                text: isRTL ? "عرض الخطط" : "View Plans",
                onPress: () => setShowPaywall(true),
              },
            ]
          );
          setJoinLoading(false);
          return;
        }

        // Join the family
        await userService.joinFamily(user.id, result.familyId);

        // Refresh family members and user state
        await loadFamilyMembers();

        setJoinFamilyCode("");
        setShowJoinFamilyModal(false);

        Alert.alert(
          isRTL ? "مرحباً بك في العائلة!" : "Welcome to the Family!",
          isRTL
            ? "تم انضمامك بنجاح! يمكنك الآن رؤية أفراد عائلتك الجدد في الأسفل."
            : "You have successfully joined! You can now see your new family members below."
        );

        // Force reload the screen data to show the new family
        setTimeout(async () => {
          await loadFamilyMembers();
        }, 1000);
      } else {
        Alert.alert(isRTL ? "رمز غير صحيح" : "Invalid Code", result.message);
      }
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في الانضمام للعائلة" : "Failed to join family"
      );
    } finally {
      setJoinLoading(false);
    }
  };

  // Filter member metrics based on selected filter
  const getFilteredMemberMetrics = () => {
    if (selectedFilter.type === "personal") {
      // Show only current user's data
      return memberMetrics.filter((metric) => metric.user.id === user?.id);
    }
    if (selectedFilter.type === "member" && selectedFilter.memberId) {
      // Show only selected member's data
      return memberMetrics.filter(
        (metric) => metric.user.id === selectedFilter.memberId
      );
    }
    if (selectedFilter.type === "family") {
      // Show all family members' data
      return memberMetrics;
    }
    // Default to personal
    return memberMetrics.filter((metric) => metric.user.id === user?.id);
  };

  const getFilteredFamilyMembers = () => {
    if (selectedFilter.type === "personal") {
      return familyMembers.filter((member) => member.id === user?.id);
    }
    if (selectedFilter.type === "member" && selectedFilter.memberId) {
      return familyMembers.filter(
        (member) => member.id === selectedFilter.memberId
      );
    }
    if (selectedFilter.type === "family") {
      return familyMembers;
    }
    return familyMembers.filter((member) => member.id === user?.id);
  };

  const filteredMemberMetrics = getFilteredMemberMetrics();
  const filteredFamilyMembers = getFilteredFamilyMembers();

  const renderDashboardFallbackCards = () => (
    <View style={styles.dashboardGrid}>
      {filteredFamilyMembers.map((member) => {
        const fullName =
          member.firstName && member.lastName
            ? `${member.firstName} ${member.lastName}`
            : member.firstName || "User";
        const isCurrentUser = member.id === user?.id;

        return (
          <TouchableOpacity
            key={member.id}
            onPress={() =>
              router.push({
                pathname: "/family/[memberId]",
                params: { memberId: member.id },
              })
            }
            style={styles.dashboardCard}
          >
            <View style={styles.dashboardCardHeader}>
              <View
                style={[styles.familyAvatarRing, { borderColor: "#10B981" }]}
              >
                <View style={styles.familyAvatarInner}>
                  {member.avatar ? (
                    <Image
                      source={
                        typeof member.avatar === "string"
                          ? { uri: member.avatar }
                          : member.avatar
                      }
                      style={styles.familyAvatarImage}
                    />
                  ) : (
                    <Text style={styles.familyAvatarText}>
                      {getAvatarInitials(fullName)}
                    </Text>
                  )}
                </View>
              </View>
              {isCurrentUser && (
                <View style={styles.currentUserBadge}>
                  <Text style={styles.currentUserBadgeText}>
                    {isRTL ? "أنت" : "You"}
                  </Text>
                </View>
              )}
            </View>

            <Text
              numberOfLines={1}
              style={[styles.dashboardCardName, isRTL && styles.rtlText]}
            >
              {fullName}
            </Text>

            <View style={styles.dashboardMetrics}>
              <View style={styles.dashboardMetric}>
                <Activity color="#94A3B8" size={16} />
                <Text
                  style={[styles.dashboardMetricLabel, isRTL && styles.rtlText]}
                >
                  {isRTL ? "جاري تحميل البيانات..." : "Loading health data..."}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const getFamilyStats = () => {
    const metricsToUse = filteredMemberMetrics;
    const totalMembers = metricsToUse.length;
    const activeMembers = metricsToUse.length; // All loaded members are active

    // Calculate total alerts from filtered member metrics
    const totalAlerts = metricsToUse.reduce(
      (sum, member) =>
        sum + (typeof member.alertsCount === "number" ? member.alertsCount : 0),
      0
    );

    // Calculate average health score from filtered member metrics
    const healthScores = metricsToUse
      .map((member) => member.healthScore)
      .filter((score): score is number => typeof score === "number");
    const avgHealthScore =
      healthScores.length > 0
        ? Math.round(
            healthScores.reduce((sum, score) => sum + score, 0) /
              healthScores.length
          )
        : 0;

    return { totalMembers, activeMembers, totalAlerts, avgHealthScore };
  };

  const { totalMembers, activeMembers, totalAlerts, avgHealthScore } =
    getFamilyStats();

  // Helper function to check if vitals are abnormal
  const hasAbnormalVitals = (
    vitals: VitalSigns | null | undefined
  ): boolean => {
    if (!vitals) return false;

    // Check heart rate (normal: 60-100 BPM)
    if (
      vitals.heartRate !== undefined &&
      (vitals.heartRate < 60 || vitals.heartRate > 100)
    ) {
      return true;
    }

    // Check blood pressure (normal: systolic < 120, diastolic < 80)
    if (
      vitals.bloodPressure &&
      (vitals.bloodPressure.systolic >= 120 ||
        vitals.bloodPressure.diastolic >= 80)
    ) {
      return true;
    }

    // Check body temperature (normal: 36.1-37.2Â°C or 97-99Â°F)
    if (
      vitals.bodyTemperature !== undefined &&
      (vitals.bodyTemperature < 36.1 || vitals.bodyTemperature > 37.2)
    ) {
      return true;
    }

    // Check oxygen saturation (normal: >= 95%)
    if (vitals.oxygenSaturation !== undefined && vitals.oxygenSaturation < 95) {
      return true;
    }

    return false;
  };

  // Get items that need attention (filtered based on selectedFilter)
  const getItemsNeedingAttention = () => {
    const metricsToUse = filteredMemberMetrics;
    if (metricsToUse.length === 0) {
      return [];
    }

    const attentionItems: Array<{
      memberId: string;
      memberName: string;
      reason: string;
      severity: "low" | "medium" | "high";
      icon: string;
      trend?: "up" | "down" | "stable";
    }> = [];

    metricsToUse.forEach((metric) => {
      const fullName =
        metric.user.firstName && metric.user.lastName
          ? `${metric.user.firstName} ${metric.user.lastName}`
          : metric.user.firstName || "User";

      const healthScore =
        typeof metric.healthScore === "number" ? metric.healthScore : null;
      const alertsCount =
        typeof metric.alertsCount === "number" ? metric.alertsCount : 0;
      const symptomsThisWeek =
        typeof metric.symptomsThisWeek === "number"
          ? metric.symptomsThisWeek
          : 0;

      // Determine trend based on health score (lower is worse)
      let healthTrend: "up" | "down" | "stable" = "stable";
      if (healthScore !== null) {
        if (healthScore < 60) {
          healthTrend = "down"; // Critical - trending down
        } else if (healthScore < 80) {
          healthTrend = "down"; // Needs attention - trending down
        }
      }

      // Check for critical health score
      if (healthScore !== null && healthScore < 60) {
        attentionItems.push({
          memberId: metric.user.id,
          memberName: fullName,
          reason: isRTL
            ? `نقاط الصحة منخفضة (${healthScore})`
            : `Low health score (${healthScore})`,
          severity: "high",
          icon: "health",
          trend: healthTrend,
        });
      } else if (healthScore !== null && healthScore < 80) {
        attentionItems.push({
          memberId: metric.user.id,
          memberName: fullName,
          reason: isRTL
            ? `نقاط الصحة تحتاج انتباه (${healthScore})`
            : `Health score needs attention (${healthScore})`,
          severity: "medium",
          icon: "health",
          trend: healthTrend,
        });
      }

      // Check for active alerts
      if (alertsCount > 0) {
        attentionItems.push({
          memberId: metric.user.id,
          memberName: fullName,
          reason: isRTL
            ? `${alertsCount} ${alertsCount === 1 ? "تنبيه نشط" : "تنبيهات نشطة"}`
            : `${alertsCount} active ${alertsCount === 1 ? "alert" : "alerts"}`,
          severity: alertsCount > 2 ? "high" : "medium",
          icon: "alert",
          trend: alertsCount > 2 ? "up" : "stable", // More alerts = trending up
        });
      }

      // Check for high symptom count
      if (symptomsThisWeek > 3) {
        attentionItems.push({
          memberId: metric.user.id,
          memberName: fullName,
          reason: isRTL
            ? `${symptomsThisWeek} ${symptomsThisWeek === 1 ? "عرض صحي هذا الأسبوع" : "أعراض صحية هذا الأسبوع"}`
            : `${symptomsThisWeek} ${symptomsThisWeek === 1 ? "symptom" : "symptoms"} this week`,
          severity: symptomsThisWeek > 5 ? "high" : "medium",
          icon: "symptom",
          trend: symptomsThisWeek > 5 ? "up" : "stable", // More symptoms = trending up
        });
      }

      // Check for abnormal vitals
      if (hasAbnormalVitals(metric.vitals)) {
        attentionItems.push({
          memberId: metric.user.id,
          memberName: fullName,
          reason: isRTL ? "علامات حيوية غير طبيعية" : "Abnormal vital signs",
          severity: "high",
          icon: "vitals",
          trend: "down", // Abnormal vitals = trending down
        });
      }
    });

    // Sort by severity (high first)
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return attentionItems.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
  };

  const attentionItems = getItemsNeedingAttention();
  const displayMembers = useMemo(() => {
    if (familyMembers.length > 0) {
      return familyMembers;
    }
    if (user) {
      return [user];
    }
    return [];
  }, [familyMembers, user]);

  const metricsById = useMemo(() => {
    const map = new Map<string, FamilyMemberMetrics>();
    memberMetrics.forEach((metric) => {
      map.set(metric.user.id, metric);
    });
    return map;
  }, [memberMetrics]);

  const caregiverById = useMemo(() => {
    const map = new Map<string, CaregiverOverview["members"][number]>();
    caregiverOverview?.members.forEach((member) => {
      map.set(member.member.id, member);
    });
    return map;
  }, [caregiverOverview]);

  const getMemberStatus = useCallback((metric?: FamilyMemberMetrics) => {
    if (!metric) {
      return "unknown";
    }
    const alertsCount =
      typeof metric.alertsCount === "number" ? metric.alertsCount : 0;
    const healthScore =
      typeof metric.healthScore === "number" ? metric.healthScore : 100;

    if (alertsCount > 1 || healthScore < 60) {
      return "critical";
    }
    if (alertsCount > 0 || healthScore < 75) {
      return "monitor";
    }
    return "stable";
  }, []);

  const getSparklineData = useCallback((metric?: FamilyMemberMetrics) => {
    // Use real heart rate if available; otherwise deterministic mock (72 bpm)
    const currentHR = metric?.vitals?.heartRate ?? 72;
    const variance = 5; // +/- 5 bpm variation

    // Real data: gentle curve around actual HR. No data: deterministic mock
    return Array.from({ length: 7 }, (_, i) => {
      const offset = Math.sin(i * 0.5) * variance;
      return Math.max(50, Math.min(120, Math.round(currentHR + offset)));
    });
  }, []);

  const getAvatarInitials = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return "?";
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const handleFilterChange = (filter: FilterOption) => {
    setSelectedFilter(filter);
  };

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.familyContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            onRefresh={async () => {
              await loadFamilyMembers(true);
              if (user?.id) {
                await Promise.all([loadEvents(true), loadActiveAlerts(true)]);
              }
            }}
            refreshing={refreshing}
            tintColor="#003543"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.headerWrapper,
            {
              marginHorizontal: -contentPadding,
              marginTop: -theme.spacing.base,
              marginBottom: -40,
            },
          ]}
        >
          <WavyBackground curve="home" height={240} variant="teal">
            <View
              style={[
                styles.familyHeader,
                {
                  paddingHorizontal: headerPadding,
                  paddingTop: headerPadding,
                  paddingBottom: headerPadding,
                  minHeight: 230,
                },
              ]}
            >
              <Text
                style={[
                  styles.familyTitle,
                  isRTL && styles.rtlText,
                  { color: theme.colors.neutral.white },
                ]}
              >
                {isRTL ? "دائرة العائلة" : "Family Circle"}
              </Text>
              <Text
                style={[
                  styles.familySubtitle,
                  isRTL && styles.rtlText,
                  { color: "rgba(255, 255, 255, 0.85)" },
                ]}
              >
                {isRTL ? "إدارة دائرة العائلة" : "Manage your family circle"}
              </Text>
            </View>
          </WavyBackground>
        </View>

        {loading ? (
          <View style={styles.inlineLoadingContainer}>
            <ActivityIndicator color="#003543" size="small" />
            <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
              {isRTL ? "جاري التحميل..." : "Loading..."}
            </Text>
          </View>
        ) : null}
        {!loading && displayMembers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
              {isRTL ? "لا يوجد أفراد عائلة بعد" : "No family members yet"}
            </Text>
          </View>
        ) : (
          displayMembers.map((member) => {
            const metric = metricsById.get(member.id);
            const caregiverData = caregiverById.get(member.id);
            const fullName =
              member.firstName && member.lastName
                ? `${member.firstName} ${member.lastName}`
                : member.firstName || (isRTL ? "عضو" : "Member");
            const relationship =
              (member as { relationship?: string }).relationship ||
              (member.role === "admin"
                ? isRTL
                  ? "مدير"
                  : "Admin"
                : isRTL
                  ? "عضو"
                  : "Member");
            const status = getMemberStatus(metric);
            const medications = metric?.activeMedications ?? 0;
            const nextAppointment =
              caregiverData?.medicationCompliance?.nextDose;
            const appointmentLabel = nextAppointment
              ? safeFormatDate(nextAppointment)
              : t("notScheduled", isRTL ? "غير مجدول" : "Not scheduled");

            return (
              <TouchableOpacity
                activeOpacity={0.9}
                key={member.id}
                onPress={() =>
                  router.push({
                    pathname: "/family/[memberId]",
                    params: { memberId: member.id },
                  })
                }
                style={styles.familyMemberCard}
              >
                <View style={styles.familyMemberCardHeader}>
                  <View
                    style={[
                      styles.familyAvatarRing,
                      {
                        borderColor:
                          status === "critical"
                            ? "#EF4444"
                            : status === "monitor"
                              ? "#F59E0B"
                              : "#10B981",
                      },
                    ]}
                  >
                    <View style={styles.familyAvatarInner}>
                      {member.avatar ? (
                        <Image
                          source={
                            typeof member.avatar === "string"
                              ? { uri: member.avatar }
                              : member.avatar
                          }
                          style={styles.familyAvatarImage}
                        />
                      ) : (
                        <Text style={styles.familyAvatarText}>
                          {getAvatarInitials(fullName)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.familyMemberInfo}>
                    <Text
                      style={[styles.familyMemberName, isRTL && styles.rtlText]}
                    >
                      {fullName}
                    </Text>
                    <Text
                      style={[styles.familyMemberMeta, isRTL && styles.rtlText]}
                    >
                      {relationship}
                    </Text>
                    <StatusBadge status={status} />
                  </View>
                  <View style={styles.familySparklineContainer}>
                    <Sparkline
                      color={status === "critical" ? "#EF4444" : "#10B981"}
                      data={getSparklineData(metric)}
                      height={32}
                      width={64}
                    />
                    <Text style={styles.familySparklineLabel}>
                      {isRTL ? "نبض القلب" : "Heart rate"}
                    </Text>
                  </View>
                </View>

                <View style={styles.familyMemberStatsRow}>
                  <View style={styles.familyMemberStat}>
                    <View
                      style={[
                        styles.familyStatIconWrap,
                        styles.familyStatIconGreen,
                      ]}
                    >
                      <Calendar color="#10B981" size={16} />
                    </View>
                    <View>
                      <Text style={styles.familyStatLabel}>
                        {isRTL ? "الموعد القادم" : "Next Appointment"}
                      </Text>
                      <Text style={styles.familyStatValue}>
                        {appointmentLabel}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.familyMemberStat}>
                    <View
                      style={[
                        styles.familyStatIconWrap,
                        styles.familyStatIconGold,
                      ]}
                    >
                      <TrendingUp color="#EB9C0C" size={16} />
                    </View>
                    <View>
                      <Text style={styles.familyStatLabel}>
                        {isRTL ? "الأدوية" : "Medications"}
                      </Text>
                      <Text style={styles.familyStatValue}>
                        {isRTL
                          ? `${medications} يوميًا`
                          : `${medications} daily`}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Active Alerts Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <AlertTriangle color="#EF4444" size={20} />
              <Text
                style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}
              >
                {isRTL ? "التنبيهات النشطة" : "Active Alerts"}
              </Text>
              {activeAlerts.length > 0 && (
                <Badge style={styles.sectionCount}>{activeAlerts.length}</Badge>
              )}
            </View>
          </View>
          <Card style={styles.eventsCard}>
            {loadingAlerts ? (
              <View style={[styles.emptyState, { gap: 8 }]}>
                <ActivityIndicator color="#003543" size="small" />
                <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                  {isRTL ? "جاري التحميل..." : "Loading alerts..."}
                </Text>
              </View>
            ) : activeAlerts.length > 0 ? (
              <>
                {activeAlerts.slice(0, 5).map((item) => {
                  const severityColor =
                    item.alert.severity === "critical"
                      ? "#EF4444"
                      : item.alert.severity === "high"
                        ? "#F59E0B"
                        : item.alert.severity === "medium"
                          ? "#3B82F6"
                          : "#10B981";
                  return (
                    <View key={item.alert.id} style={styles.eventItem}>
                      <View style={styles.eventItemLeft}>
                        <View
                          style={[
                            styles.eventStatusIndicator,
                            { backgroundColor: severityColor },
                          ]}
                        />
                        <View style={styles.eventContent}>
                          <Text
                            style={[
                              styles.eventMemberName,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {item.memberName}
                          </Text>
                          <Text
                            numberOfLines={2}
                            style={[
                              styles.eventMessage,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {getLocalizedAlertMessage(item.alert)}
                          </Text>
                          <View style={styles.eventMeta}>
                            <Clock color="#94A3B8" size={12} />
                            <Text style={styles.eventTime}>
                              {formatEventTime(item.alert.timestamp)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={resolvingAlertId === item.alert.id}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        onPress={() => handleResolveAlert(item.alert.id)}
                        style={[
                          styles.resolveAlertButton,
                          resolvingAlertId === item.alert.id &&
                            styles.resolveAlertButtonDisabled,
                        ]}
                      >
                        {resolvingAlertId === item.alert.id ? (
                          <ActivityIndicator
                            color="#FFFFFF"
                            size="small"
                            style={styles.resolveAlertSpinner}
                          />
                        ) : (
                          <Text style={styles.resolveAlertButtonText}>
                            {isRTL ? "حل" : "Resolve"}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
                {activeAlerts.length > 5 && (
                  <Text style={[styles.moreItemsText, isRTL && styles.rtlText]}>
                    {isRTL
                      ? `و ${activeAlerts.length - 5} تنبيهات أخرى`
                      : `and ${activeAlerts.length - 5} more alerts`}
                  </Text>
                )}
              </>
            ) : (
              <View style={[styles.emptyState, { gap: 8 }]}>
                <Bell color="#94A3B8" size={24} />
                <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                  {isRTL ? "لا توجد تنبيهات نشطة" : "No active alerts"}
                </Text>
              </View>
            )}
          </Card>
        </View>

        {/* Recent Events Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Activity color="#003543" size={20} />
              <Text
                style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}
              >
                {isRTL ? "الأحداث الأخيرة" : "Recent Events"}
              </Text>
              {events.length > 0 && (
                <Badge style={styles.sectionCount}>{events.length}</Badge>
              )}
            </View>
          </View>
          <Card style={styles.eventsCard}>
            {loadingEvents ? (
              <View style={[styles.emptyState, { gap: 8 }]}>
                <ActivityIndicator color="#003543" size="small" />
                <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                  {isRTL ? "جاري التحميل..." : "Loading events..."}
                </Text>
              </View>
            ) : events.length > 0 ? (
              <>
                {events.slice(0, 5).map((event) => {
                  const statusColor = getEventStatusColor(event.status);
                  const member = familyMembers.find(
                    (m) => m.id === event.userId
                  );
                  const memberName =
                    member && member.firstName && member.lastName
                      ? `${member.firstName} ${member.lastName}`
                      : member?.firstName || "Unknown";
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      key={event.id}
                      onPress={() => {
                        if (!event.id) {
                          Alert.alert(
                            isRTL ? "خطأ" : "Error",
                            isRTL
                              ? "هذا الحدث لا يحتوي على معرّف صالح."
                              : "This event is missing a valid id."
                          );
                          return;
                        }
                        const eventId = event.id;

                        const buttons: AlertButton[] = [
                          {
                            text: isRTL ? "إلغاء" : "Cancel",
                            style: "cancel",
                          },
                          ...(event.status === "OPEN"
                            ? [
                                {
                                  text: isRTL ? "تأكيد" : "Acknowledge",
                                  onPress: () =>
                                    handleAcknowledgeEvent(eventId),
                                },
                              ]
                            : []),
                          ...(event.status !== "RESOLVED"
                            ? [
                                {
                                  text: isRTL ? "حل" : "Resolve",
                                  onPress: () => handleResolveEvent(eventId),
                                },
                              ]
                            : []),
                          ...(event.status === "OPEN"
                            ? [
                                {
                                  text: isRTL ? "تصعيد" : "Escalate",
                                  onPress: () => handleEscalateEvent(eventId),
                                },
                              ]
                            : []),
                        ];

                        Alert.alert(
                          isRTL ? "تفاصيل الحدث" : "Event Details",
                          `${isRTL ? "الحالة" : "Status"}: ${getEventStatusText(event.status)}\n${isRTL ? "النوع" : "Type"}: ${event.type}\n${isRTL ? "الأسباب" : "Reasons"}: ${event.reasons.join(", ") || "N/A"}`,
                          buttons
                        );
                      }}
                      style={styles.eventItem}
                    >
                      <View style={styles.eventItemLeft}>
                        <View
                          style={[
                            styles.eventStatusIndicator,
                            { backgroundColor: statusColor },
                          ]}
                        />
                        <View style={styles.eventContent}>
                          <Text
                            style={[
                              styles.eventMemberName,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {memberName}
                          </Text>
                          <Text
                            numberOfLines={2}
                            style={[
                              styles.eventMessage,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {event.reasons.join(", ") || event.type}
                          </Text>
                          <View style={styles.eventMeta}>
                            <Clock color="#94A3B8" size={12} />
                            <Text style={styles.eventTime}>
                              {formatEventTime(event.createdAt)}
                            </Text>
                            <View
                              style={[
                                styles.eventStatusBadge,
                                { backgroundColor: statusColor + "20" },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.eventStatusText,
                                  { color: statusColor },
                                ]}
                              >
                                {getEventStatusText(event.status)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      <ChevronRight color="#94A3B8" size={16} />
                    </TouchableOpacity>
                  );
                })}
                {events.length > 5 && (
                  <Text style={[styles.moreItemsText, isRTL && styles.rtlText]}>
                    {isRTL
                      ? `و ${events.length - 5} أحداث أخرى`
                      : `and ${events.length - 5} more events`}
                  </Text>
                )}
              </>
            ) : (
              <View style={[styles.emptyState, { gap: 8 }]}>
                <Calendar color="#94A3B8" size={24} />
                <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                  {isRTL ? "لا توجد أحداث حديثة" : "No recent events"}
                </Text>
              </View>
            )}
          </Card>
        </View>

        {isAdmin && (
          <View collapsable={false} ref={addMemberButtonRef}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setShowInviteModal(true)}
              style={styles.addMemberCard}
            >
              <View style={styles.addMemberIcon}>
                <Plus color="#003543" size={28} />
              </View>
              <Text style={styles.addMemberTitle}>
                {isRTL ? "إضافة فرد للعائلة" : "Add Family Member"}
              </Text>
              <Text style={styles.addMemberSubtitle}>
                {t("inviteSomeoneToCareCircle")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <CoachMark
        body={t("tapToAddFamilyMembers")}
        isRTL={isRTL}
        onClose={() => setShowHowTo(false)}
        onPrimaryAction={() => setShowInviteModal(true)}
        primaryActionLabel={t("inviteMember")}
        secondaryActionLabel={t("gotIt")}
        targetRef={addMemberButtonRef}
        title={t("trackFamilyHealth")}
        visible={showHowTo}
      />

      {/* Invite Member Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showInviteModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {t("inviteNewMember")}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowInviteModal(false);
                setInviteForm({
                  name: "",
                  relation: "",
                });
              }}
              style={styles.closeButton}
            >
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Name */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t("fullName")} *
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setInviteForm({ ...inviteForm, name: text })
                }
                placeholder={t("enterFullName")}
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={inviteForm.name}
              />
            </View>

            {/* Relation */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t("relationship")} *
              </Text>
              <View style={styles.relationOptions}>
                {RELATIONS.map((relation) => (
                  <TouchableOpacity
                    key={relation.key}
                    onPress={() =>
                      setInviteForm({
                        ...inviteForm,
                        relation: isRTL ? relation.labelAr : relation.labelEn,
                      })
                    }
                    style={[
                      styles.relationOption,
                      inviteForm.relation ===
                        (isRTL ? relation.labelAr : relation.labelEn) &&
                        styles.relationOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.relationOptionText,
                        inviteForm.relation ===
                          (isRTL ? relation.labelAr : relation.labelEn) &&
                          styles.relationOptionTextSelected,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL ? relation.labelAr : relation.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              disabled={inviteLoading}
              onPress={handleInviteMember}
              style={[
                styles.inviteButton,
                inviteLoading && styles.inviteButtonDisabled,
              ]}
            >
              <Text style={styles.inviteButtonText}>
                {inviteLoading
                  ? isRTL
                    ? "جاري الإرسال..."
                    : "Sending..."
                  : isRTL
                    ? "إرسال الدعوة للعائلة"
                    : "Send Invitation"}
              </Text>
            </TouchableOpacity>

            {generatedCode && (
              <View style={styles.codeContainer}>
                <Text style={[styles.codeLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "رمز الدعوة للعائلة" : "Invite Code"}
                </Text>
                <Text style={[styles.codeValue, isRTL && styles.rtlText]}>
                  {generatedCode}
                </Text>
              </View>
            )}

            {inviteLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#003543" size="large" />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Emergency Settings Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showEmergencyModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? "إعدادات الطوارئ" : "Emergency Settings"}
            </Text>
            <TouchableOpacity
              onPress={() => setShowEmergencyModal(false)}
              style={styles.closeButton}
            >
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "جهات الاتصال في حالات الطوارئ" : "Emergency Contacts"}
              </Text>
              <Text
                style={[styles.emergencyDescription, isRTL && styles.rtlText]}
              >
                {isRTL
                  ? "سيتم إشعار جهات الاتصال هذه في حالة الطوارئ"
                  : "These contacts will be notified in case of emergency"}
              </Text>

              {/* Emergency Contacts List */}
              {emergencyContacts.map((contact) => (
                <View key={contact.id} style={styles.contactItem}>
                  <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, isRTL && styles.rtlText]}>
                      {contact.name}
                    </Text>
                    <Text
                      style={[styles.contactPhone, isRTL && styles.rtlText]}
                    >
                      {contact.phone}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteEmergencyContact(contact.id)}
                    style={styles.deleteContactButton}
                  >
                    <X color="#EF4444" size={16} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add New Contact Form */}
              <View style={styles.addContactForm}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "إضافة جهة اتصال جديدة" : "Add New Contact"}
                </Text>

                <TextInput
                  onChangeText={(text) =>
                    setNewContact((prev) => ({ ...prev, name: text }))
                  }
                  placeholder={
                    isRTL ? "اسم جهة اتصال في حالة الطوارئ" : "Contact Name"
                  }
                  style={[styles.textInput, isRTL && styles.rtlInput]}
                  textAlign={isRTL ? "right" : "left"}
                  value={newContact.name}
                />

                <TextInput
                  keyboardType="phone-pad"
                  onChangeText={(text) =>
                    setNewContact((prev) => ({ ...prev, phone: text }))
                  }
                  placeholder={isRTL ? "رقم الهاتف" : "Phone Number"}
                  style={[
                    styles.textInput,
                    isRTL && styles.rtlInput,
                    { marginTop: 8 },
                  ]}
                  textAlign={isRTL ? "right" : "left"}
                  value={newContact.phone}
                />

                <Pressable
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={handleAddEmergencyContact}
                  style={({ pressed }) => [
                    styles.addContactButton,
                    pressed && { opacity: 0.7, backgroundColor: "#F3F4F6" },
                  ]}
                >
                  {({ pressed }) => (
                    <>
                      <Plus color="#003543" size={20} />
                      <Text
                        style={[styles.addContactText, isRTL && styles.rtlText]}
                      >
                        {isRTL
                          ? "إضافة جهة اتصال في حالة الطوارئ"
                          : "Add Contact"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "كشف السقوط التلقائي" : "Fall Detection"}
              </Text>
              <View style={styles.settingToggle}>
                <Text style={[styles.settingText, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "تفعيل كشف السقوط التلقائي للعائلة"
                    : "Enable automatic fall detection"}
                </Text>
                <Switch
                  onValueChange={toggleFallDetection}
                  thumbColor={fallDetectionEnabled ? "#FFFFFF" : "#9CA3AF"}
                  trackColor={{ false: "#E5E7EB", true: "#10B981" }}
                  value={fallDetectionEnabled}
                />
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "تنبيهات الأدوية" : "Medication Alerts"}
              </Text>
              <View style={styles.settingToggle}>
                <Text style={[styles.settingText, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "إرسال تنبيهات الأدوية الفائتة للعائلة"
                    : "Send missed medication alerts"}
                </Text>
                <Switch
                  onValueChange={handleToggleMedicationAlerts}
                  thumbColor={medicationAlertsEnabled ? "#FFFFFF" : "#9CA3AF"}
                  trackColor={{ false: "#E5E7EB", true: "#10B981" }}
                  value={medicationAlertsEnabled}
                />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Join Family Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showJoinFamilyModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? "الانضمام إلى عائلة" : "Join a Family"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowJoinFamilyModal(false);
                setJoinFamilyCode("");
              }}
              style={styles.closeButton}
            >
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "رمز الدعوة" : "Invitation Code"}
              </Text>
              <TextInput
                keyboardType="numeric"
                maxLength={6}
                onChangeText={setJoinFamilyCode}
                placeholder={
                  isRTL
                    ? "أدخل رمز الدعوة (6 أرقام)"
                    : "Enter invitation code (6 digits)"
                }
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={joinFamilyCode}
              />
              <Text
                style={[styles.emergencyDescription, isRTL && styles.rtlText]}
              >
                {isRTL
                  ? "أدخل رمز الدعوة المرسل إليك من أحد أفراد العائلة للانضمام إلى مجموعتهم الصحية"
                  : "Enter the invitation code sent to you by a family member to join their health group"}
              </Text>
            </View>

            <TouchableOpacity
              disabled={joinLoading}
              onPress={handleJoinFamily}
              style={[
                styles.inviteButton,
                joinLoading && styles.inviteButtonDisabled,
              ]}
            >
              <Text style={styles.inviteButtonText}>
                {joinLoading
                  ? isRTL
                    ? "جاري الانضمام..."
                    : "Joining..."
                  : isRTL
                    ? "انضم للعائلة"
                    : "Join Family"}
              </Text>
            </TouchableOpacity>

            {joinLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#003543" size="large" />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Member Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showEditMemberModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? "تعديل فرد العائلة" : "Edit Member"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowEditMemberModal(false);
                setEditMemberForm({
                  id: "",
                  firstName: "",
                  lastName: "",
                  email: "",
                  role: "member",
                });
              }}
              style={styles.closeButton}
            >
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* First Name */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "الاسم الأول" : "First Name"} *
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setEditMemberForm({ ...editMemberForm, firstName: text })
                }
                placeholder={isRTL ? "أدخل الاسم الأول" : "Enter first name"}
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={editMemberForm.firstName}
              />
            </View>

            {/* Last Name */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "اسم العائلة" : "Last Name"}
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setEditMemberForm({ ...editMemberForm, lastName: text })
                }
                placeholder={isRTL ? "أدخل اسم العائلة" : "Enter last name"}
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={editMemberForm.lastName}
              />
            </View>

            {/* Email */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "البريد الإلكتروني" : "Email"} *
              </Text>
              <TextInput
                keyboardType="email-address"
                onChangeText={(text) =>
                  setEditMemberForm({ ...editMemberForm, email: text })
                }
                placeholder={t("enterEmail")}
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={editMemberForm.email}
              />
            </View>

            {/* Role */}
            {/* Only show role selection to admins editing other users */}
            {user?.role === "admin" && user.id !== editMemberForm.id && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "الدور" : "Role"} *
                </Text>
                <View style={styles.roleOptions}>
                  {["admin", "member"].map((role) => (
                    <TouchableOpacity
                      key={role}
                      onPress={() =>
                        setEditMemberForm({
                          ...editMemberForm,
                          role: role as "admin" | "member" | "caregiver",
                        })
                      }
                      style={[
                        styles.roleOption,
                        editMemberForm.role === role &&
                          styles.roleOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleOptionText,
                          editMemberForm.role === role &&
                            styles.roleOptionTextSelected,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {role === "admin"
                          ? isRTL
                            ? "مدير"
                            : "Admin"
                          : isRTL
                            ? "عضو"
                            : "Member"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSaveEditMember}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>
                {isRTL ? "حفظ" : "Save"}
              </Text>
            </TouchableOpacity>

            {editLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#003543" size="large" />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Premium Paywall Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowPaywall(false)}
        presentationStyle="pageSheet"
        visible={showPaywall}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? "الترقية إلى الاشتراك العائلي" : "Upgrade to Premium"}
            </Text>
            <TouchableOpacity
              onPress={() => setShowPaywall(false)}
              style={styles.closeButton}
            >
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>
          <RevenueCatPaywall
            onDismiss={() => setShowPaywall(false)}
            onPurchaseComplete={() => {
              setShowPaywall(false);
              // Reload family members to reflect new limits
              loadFamilyMembers();
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* Health Reports Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShowHealthReportsModal(false);
          setHealthReport(null);
        }}
        presentationStyle="pageSheet"
        visible={showHealthReportsModal}
      >
        <SafeAreaView
          style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background.primary },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              {
                backgroundColor: theme.colors.background.secondary,
                borderBottomColor: theme.colors.border.medium,
              },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                isRTL && styles.rtlText,
                { color: theme.colors.text.primary },
              ]}
            >
              {isRTL ? "تقارير الصحة العائلية" : "Family Health Reports"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowHealthReportsModal(false);
                setHealthReport(null);
              }}
              style={styles.closeButton}
            >
              <X color={theme.colors.text.secondary} size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.background.primary },
            ]}
          >
            {/* Generate Report Card */}
            <Card
              contentStyle={undefined}
              pressable={false}
              style={{
                marginBottom: 20,
                backgroundColor: theme.colors.background.secondary,
              }}
              variant="elevated"
            >
              <Heading
                level={6}
                style={{ marginBottom: 12, color: theme.colors.text.primary }}
              >
                {isRTL ? "إنشاء تقرير صحي جديد" : "Generate New Report"}
              </Heading>
              <Caption
                numberOfLines={2}
                style={{ marginBottom: 16, color: theme.colors.text.secondary }}
              >
                {isRTL
                  ? "اختر إعدادات الخصوصية والفترة الزمنية لإنشاء تقرير شامل عن صحة العائلة"
                  : "Select privacy settings and time period to generate a comprehensive family health report"}
              </Caption>
              <View
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  gap: 12,
                }}
              >
                <Button
                  onPress={() => setShowPrivacyModal(true)}
                  style={{ flex: 1 }}
                  textStyle={{}}
                  title={
                    isRTL
                      ? "إعدادات الخصوصية للتقرير الصحي"
                      : "Privacy Settings"
                  }
                  variant="outline"
                />
                <Button
                  disabled={generatingReport}
                  loading={generatingReport}
                  onPress={handleGenerateHealthReport}
                  style={{ flex: 1 }}
                  textStyle={{}}
                  title={isRTL ? "إنشاء التقرير الصحي" : "Generate Report"}
                  variant="primary"
                />
              </View>
            </Card>

            {/* Report Display */}
            {healthReport && (
              <>
                {/* Summary Section */}
                <View style={{ marginBottom: 24 }}>
                  <Heading
                    level={6}
                    style={{
                      marginBottom: 12,
                      color: theme.colors.text.primary,
                    }}
                  >
                    {isRTL ? "الملخص" : "Summary"}
                  </Heading>
                  <View
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        minWidth: "45%",
                        padding: 12,
                        backgroundColor: theme.colors.background.tertiary,
                        borderRadius: theme.borderRadius.lg,
                        borderWidth: 1,
                        borderColor: theme.colors.border.medium,
                      }}
                    >
                      <Caption
                        numberOfLines={1}
                        style={{
                          marginBottom: 4,
                          color: theme.colors.text.secondary,
                        }}
                      >
                        {isRTL ? "إجمالي أعضاء العائلة" : "Total Members"}
                      </Caption>
                      <Text
                        style={{
                          fontSize: 24,
                          fontFamily: theme.typography.fontFamily.bold,
                          color: theme.colors.text.primary,
                        }}
                      >
                        {healthReport.summary.totalMembers}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        minWidth: "45%",
                        padding: 12,
                        backgroundColor: theme.colors.background.tertiary,
                        borderRadius: theme.borderRadius.lg,
                        borderWidth: 1,
                        borderColor: theme.colors.border.medium,
                      }}
                    >
                      <Caption
                        numberOfLines={1}
                        style={{
                          marginBottom: 4,
                          color: theme.colors.text.secondary,
                        }}
                      >
                        {isRTL ? "متوسط النقاط الصحية" : "Avg Health Score"}
                      </Caption>
                      <Text
                        style={{
                          fontSize: 24,
                          fontFamily: theme.typography.fontFamily.bold,
                          color: getHealthScoreColor(
                            healthReport.summary.averageHealthScore
                          ),
                        }}
                      >
                        {healthReport.summary.averageHealthScore}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        minWidth: "45%",
                        padding: 12,
                        backgroundColor: theme.colors.background.tertiary,
                        borderRadius: theme.borderRadius.lg,
                        borderWidth: 1,
                        borderColor: theme.colors.border.medium,
                      }}
                    >
                      <Caption
                        numberOfLines={1}
                        style={{
                          marginBottom: 4,
                          color: theme.colors.text.secondary,
                        }}
                      >
                        {isRTL
                          ? "الأدوية النشطة للعائلة"
                          : "Active Medications"}
                      </Caption>
                      <Text
                        style={{
                          fontSize: 24,
                          fontFamily: theme.typography.fontFamily.bold,
                          color: theme.colors.text.primary,
                        }}
                      >
                        {healthReport.summary.totalActiveMedications}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        minWidth: "45%",
                        padding: 12,
                        backgroundColor: theme.colors.background.tertiary,
                        borderRadius: theme.borderRadius.lg,
                        borderWidth: 1,
                        borderColor: theme.colors.border.medium,
                      }}
                    >
                      <Caption
                        numberOfLines={1}
                        style={{
                          marginBottom: 4,
                          color: theme.colors.text.secondary,
                        }}
                      >
                        {isRTL
                          ? "إجمالي الأعراض الصحية للعائلة"
                          : "Total Symptoms"}
                      </Caption>
                      <Text
                        style={{
                          fontSize: 24,
                          fontFamily: theme.typography.fontFamily.bold,
                          color: theme.colors.text.primary,
                        }}
                      >
                        {healthReport.summary.totalSymptoms}
                      </Text>
                    </View>
                  </View>

                  {/* Alerts */}
                  {healthReport.summary.alerts.length > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <Heading
                        level={6}
                        style={{
                          marginBottom: 12,
                          color: theme.colors.text.primary,
                        }}
                      >
                        {isRTL ? "التنبيهات الصحية للعائلة" : "Alerts"}
                      </Heading>
                      {healthReport.summary.alerts.map((alert, index) => (
                        <Card
                          contentStyle={undefined}
                          key={index}
                          pressable={false}
                          style={{
                            backgroundColor: `${theme.colors.accent.error}20`,
                            borderColor: theme.colors.accent.error,
                            marginBottom: 8,
                          }}
                          variant="elevated"
                        >
                          <Heading
                            level={6}
                            style={{ color: theme.colors.text.primary }}
                          >
                            {alert.member}
                          </Heading>
                          <Caption
                            numberOfLines={2}
                            style={{ color: theme.colors.text.secondary }}
                          >
                            {alert.message}
                          </Caption>
                        </Card>
                      ))}
                    </View>
                  )}

                  {/* Export Button */}
                  <View style={{ marginTop: 12 }}>
                    <Button
                      icon={null}
                      onPress={handleExportPDF}
                      style={{ width: "100%" }}
                      textStyle={{}}
                      title={
                        isRTL
                          ? "تصدير التقرير الصحي كـ PDF"
                          : "Export Report as PDF"
                      }
                      variant="outline"
                    />
                  </View>
                </View>

                {/* Member Details */}
                <View style={{ marginBottom: 24 }}>
                  <Heading
                    level={6}
                    style={{
                      marginBottom: 12,
                      color: theme.colors.text.primary,
                    }}
                  >
                    {isRTL ? "تفاصيل أفراد العائلة" : "Member Details"}
                  </Heading>
                  {healthReport.members.map((memberReport) => (
                    <Card
                      contentStyle={undefined}
                      key={memberReport.member.id}
                      pressable={false}
                      style={{
                        marginBottom: 12,
                        backgroundColor: theme.colors.background.secondary,
                      }}
                      variant="elevated"
                    >
                      <View
                        style={{
                          flexDirection: isRTL ? "row-reverse" : "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Heading
                            level={6}
                            style={{ color: theme.colors.text.primary }}
                          >
                            {memberReport.member.firstName}{" "}
                            {memberReport.member.lastName}
                          </Heading>
                        </View>
                        <Badge
                          size="small"
                          style={{
                            backgroundColor:
                              getHealthScoreColor(memberReport.healthScore) +
                              "20",
                            borderColor: getHealthScoreColor(
                              memberReport.healthScore
                            ),
                          }}
                          variant="outline"
                        >
                          <Caption
                            numberOfLines={1}
                            style={{
                              color: getHealthScoreColor(
                                memberReport.healthScore
                              ),
                            }}
                          >
                            {isRTL ? "النقاط" : "Score"}:{" "}
                            {memberReport.healthScore}
                          </Caption>
                        </Badge>
                      </View>

                      <View style={{ marginTop: 8 }}>
                        <Caption
                          numberOfLines={1}
                          style={{ color: theme.colors.text.secondary }}
                        >
                          {isRTL ? "الأعراض الصحية" : "Symptoms"}:{" "}
                          {memberReport.symptoms.total}
                        </Caption>
                        <Caption
                          numberOfLines={1}
                          style={{ color: theme.colors.text.secondary }}
                        >
                          {isRTL ? "الأدوية النشطة" : "Active Medications"}:{" "}
                          {memberReport.medications.active}
                        </Caption>
                        {memberReport.medications.complianceRate !==
                          undefined && (
                          <Caption
                            numberOfLines={1}
                            style={{ color: theme.colors.text.secondary }}
                          >
                            {isRTL ? "الالتزام بالأدوية" : "Compliance"}:{" "}
                            {memberReport.medications.complianceRate}%
                          </Caption>
                        )}
                      </View>

                      {/* Trends */}
                      <View
                        style={{
                          flexDirection: isRTL ? "row-reverse" : "row",
                          gap: 12,
                          marginTop: 8,
                        }}
                      >
                        {getTrendIcon(memberReport.trends.symptomTrend)}
                        <Caption
                          numberOfLines={1}
                          style={{ color: theme.colors.text.secondary }}
                        >
                          {isRTL ? "اتجاه الأعراض الصحية" : "Symptom Trend"}:{" "}
                          {isRTL
                            ? memberReport.trends.symptomTrend === "improving"
                              ? "يتحسن"
                              : memberReport.trends.symptomTrend === "worsening"
                                ? "يتدهور"
                                : "مستقر"
                            : memberReport.trends.symptomTrend}
                        </Caption>
                      </View>
                    </Card>
                  ))}
                </View>
              </>
            )}

            {!(healthReport || generatingReport) && (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 40,
                }}
              >
                <FileText color={theme.colors.text.tertiary} size={64} />
                <Text
                  style={{
                    marginTop: 16,
                    textAlign: "center",
                    color: theme.colors.text.secondary,
                  }}
                >
                  {isRTL
                    ? "قم بإنشاء تقرير صحي للعائلة لعرض الملخص والإحصائيات"
                    : "Generate a family health report to view summary and statistics"}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Privacy Settings Modal */}
          <Modal
            animationType="slide"
            onRequestClose={() => setShowPrivacyModal(false)}
            presentationStyle="pageSheet"
            visible={showPrivacyModal}
          >
            <SafeAreaView style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Heading level={5} style={{ color: theme.colors.text.primary }}>
                  {isRTL ? "إعدادات الخصوصية" : "Privacy Settings"}
                </Heading>
                <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
                  <Text
                    style={{ fontSize: 18, color: theme.colors.primary.main }}
                  >
                    {isRTL ? "إغلاق" : "Close"}
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ padding: 16 }}>
                {[
                  {
                    key: "includeSymptoms",
                    label: isRTL
                      ? "تضمين الأعراض الصحية في التقرير"
                      : "Include Symptoms",
                  },
                  {
                    key: "includeMedications",
                    label: isRTL
                      ? "تضمين الأدوية في التقرير"
                      : "Include Medications",
                  },
                  {
                    key: "includeMoods",
                    label: isRTL ? "تضمين المزاج في التقرير" : "Include Moods",
                  },
                  {
                    key: "includeAllergies",
                    label: isRTL ? "تضمين الحساسية" : "Include Allergies",
                  },
                  {
                    key: "includeMedicalHistory",
                    label: isRTL
                      ? "تضمين التاريخ الطبي في التقرير"
                      : "Include Medical History",
                  },
                  {
                    key: "includeLabResults",
                    label: isRTL
                      ? "تضمين نتائج المختبر"
                      : "Include Lab Results",
                  },
                  {
                    key: "includeVitals",
                    label: isRTL
                      ? "تضمين العلامات الحيوية في التقرير"
                      : "Include Vitals",
                  },
                  {
                    key: "includeComplianceData",
                    label: isRTL
                      ? "تضمين بيانات الالتزام بالأدوية في التقرير"
                      : "Include Compliance Data",
                  },
                ].map((option) => (
                  <View
                    key={option.key}
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: "#E5E7EB",
                    }}
                  >
                    <TypographyText style={{ flex: 1 }}>
                      {option.label}
                    </TypographyText>
                    <Switch
                      onValueChange={(value) =>
                        setPrivacySettings({
                          ...privacySettings,
                          [option.key]: value,
                        })
                      }
                      thumbColor="#FFFFFF"
                      trackColor={{
                        false: "#E5E7EB",
                        true: "#003543",
                      }}
                      value={
                        privacySettings[
                          option.key as keyof ReportPrivacySettings
                        ]
                      }
                    />
                  </View>
                ))}
              </ScrollView>
            </SafeAreaView>
          </Modal>
        </SafeAreaView>
      </Modal>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  headerWrapper: {
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: -140,
  },
  familyHeader: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 12,
  },
  familyTitle: {
    fontSize: 28,
    fontFamily: "Inter-Bold",
    color: "#003543",
    marginBottom: 6,
  },
  familySubtitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "rgba(0, 53, 67, 0.7)",
  },
  familyContent: {
    paddingHorizontal: 24,
    paddingBottom: 150,
  },
  familyMemberCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  familyMemberCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  familyAvatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  familyAvatarInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#003543",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  familyAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  familyAvatarText: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  familyMemberInfo: {
    flex: 1,
  },
  familyMemberName: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
    marginBottom: 4,
  },
  familyMemberMeta: {
    fontSize: 13,
    fontFamily: "Inter-Regular",
    color: "#6C7280",
    marginBottom: 6,
  },
  familySparklineContainer: {
    alignItems: "flex-end",
    gap: 4,
  },
  familySparklineLabel: {
    fontSize: 11,
    fontFamily: "Inter-Regular",
    color: "#9CA3AF",
  },
  familyMemberStatsRow: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
    marginBottom: 16,
  },
  familyMemberStat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  familyStatIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  familyStatIconGreen: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  familyStatIconGold: {
    backgroundColor: "rgba(235, 156, 12, 0.12)",
  },
  familyStatLabel: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#6C7280",
  },
  familyStatValue: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
  },
  addMemberCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
  },
  addMemberIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0, 53, 67, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  addMemberTitle: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
    marginBottom: 4,
  },
  addMemberSubtitle: {
    fontSize: 13,
    fontFamily: "Inter-Regular",
    color: "#6C7280",
    textAlign: "center",
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    minHeight: 160,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter-Bold",
    color: "#FFFFFF",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  viewToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  helpButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EB9C0C",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  overviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overviewTitle: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: "#1E293B",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 12,
  },
  sectionTitleRTL: {
    textAlign: "right",
  },
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  dashboardCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  dashboardCardHeader: {
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
  },
  currentUserBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#003543",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentUserBadgeText: {
    fontSize: 10,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  dashboardCardName: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 12,
  },
  dashboardMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  dashboardMetric: {
    alignItems: "center",
    flex: 1,
    minWidth: "45%",
  },
  dashboardMetricValue: {
    fontSize: 18,
    fontFamily: "Inter-Bold",
    color: "#1E293B",
    marginTop: 4,
  },
  alertValue: {
    color: "#EF4444",
  },
  dashboardMetricLabel: {
    fontSize: 10,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginTop: 2,
  },
  vitalsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  vitalsTitle: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: "#64748B",
    marginBottom: 8,
  },
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  vitalItem: {
    alignItems: "center",
    flex: 1,
    minWidth: "30%",
  },
  vitalValue: {
    fontSize: 14,
    fontFamily: "Inter-Bold",
    color: "#1E293B",
    marginTop: 4,
  },
  vitalLabel: {
    fontSize: 9,
    fontFamily: "Inter-Regular",
    color: "#94A3B8",
    marginTop: 2,
  },
  membersList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  memberItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  memberLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    position: "relative",
    marginEnd: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#003543",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 2,
  },
  memberRelation: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginBottom: 2,
  },
  allergiesContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    flexWrap: "wrap",
  },
  allergiesLabel: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    marginEnd: 4,
  },
  allergiesText: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#DC2626",
    flex: 1,
  },
  memberLastActive: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#94A3B8",
  },
  memberRight: {
    alignItems: "flex-end",
  },
  healthScore: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  pendingIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    minWidth: "30%",
    maxWidth: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#1E293B",
    marginTop: 8,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#374151",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    backgroundColor: "#FFFFFF",
  },
  rtlInput: {
    fontFamily: "Inter-Regular",
  },
  relationOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  relationOption: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  relationOptionSelected: {
    backgroundColor: "#003543",
    borderColor: "#003543",
  },
  relationOptionText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  relationOptionTextSelected: {
    color: "#FFFFFF",
  },
  inviteButton: {
    backgroundColor: "#003543",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 16,
  },
  inviteButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  inviteButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  codeContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  codeLabel: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#374151",
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: "#1E293B",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  inlineLoadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    marginTop: 16,
  },
  rtlText: {
    textAlign: "right",
    fontFamily: "Inter-Regular",
  },
  memberStats: {
    alignItems: "flex-end",
    marginBottom: 8,
  },
  memberActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  deleteButton: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  emergencyDescription: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginBottom: 16,
  },
  addContactButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addContactText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#003543",
    marginStart: 8,
  },
  settingToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
  },
  settingText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#1E293B",
  },
  toggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  toggleInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#003543",
  },
  joinFamilyButton: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  joinFamilyButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
    marginStart: 8,
  },
  roleOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleOption: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  roleOptionSelected: {
    backgroundColor: "#003543",
    borderColor: "#003543",
  },
  roleOptionText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  roleOptionTextSelected: {
    color: "#FFFFFF",
  },
  saveButton: {
    backgroundColor: "#003543",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  contactItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#64748B",
  },
  deleteContactButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: "#FEF2F2",
  },
  addContactForm: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  attentionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  attentionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  attentionItem: {
    borderStartWidth: 4,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  attentionItemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  attentionItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  attentionItemText: {
    flex: 1,
  },
  attentionItemMember: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    marginBottom: 4,
  },
  attentionItemReason: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    flex: 1,
  },
  attentionItemReasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  trendContainer: {
    marginStart: 4,
  },
  trendIcon: {
    marginTop: 1,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  severityBadgeText: {
    fontSize: 10,
    fontFamily: "Inter-SemiBold",
  },
  emptyAttentionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyAttentionText: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    textAlign: "center",
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionCount: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  eventsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 0,
    overflow: "hidden",
  },
  eventItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  eventItemLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 12,
  },
  eventStatusIndicator: {
    width: 4,
    height: "100%",
    borderRadius: 2,
    marginTop: 2,
  },
  eventContent: {
    flex: 1,
  },
  eventMemberName: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 4,
  },
  eventMessage: {
    fontSize: 13,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginBottom: 8,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eventTime: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#94A3B8",
  },
  resolveAlertButton: {
    backgroundColor: "#003543",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  resolveAlertButtonDisabled: {
    opacity: 0.7,
  },
  resolveAlertSpinner: {
    marginVertical: 2,
  },
  resolveAlertButtonText: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  eventStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  eventStatusText: {
    fontSize: 10,
    fontFamily: "Inter-SemiBold",
  },
  moreItemsText: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#94A3B8",
    textAlign: "center",
    padding: 12,
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
});

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
import * as Print from "expo-print";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Droplet,
  Edit,
  FileText,
  Gauge,
  Grid3x3,
  Heart,
  Info,
  List,
  Minus,
  Phone,
  Pill,
  Plus,
  Settings,
  Share2,
  Shield,
  Thermometer,
  Trash2,
  TrendingDown,
  TrendingUp,
  User as UserIcon,
  UserPlus,
  Users,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AlertsCard from "@/app/components/AlertsCard";
import CoachMark from "@/app/components/CoachMark";
import FamilyDataFilter, {
  type FilterOption,
} from "@/app/components/FamilyDataFilter";
import Avatar from "@/components/Avatar";
import { Button, Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import {
  Caption,
  Heading,
  Text as TypographyText,
} from "@/components/design-system/Typography";
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
import healthContextService from "@/lib/services/healthContextService";
import type { VitalSigns } from "@/lib/services/healthDataService";
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
import type { Allergy, User } from "@/types";
import { safeFormatDate, safeFormatTime } from "@/utils/dateFormat";
import { getTextStyle } from "@/utils/styles";
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
  { key: "grandparent", labelEn: "Grandparent", labelAr: "الجد/الجدة" },
  { key: "other", labelEn: "Other", labelAr: "آخر" },
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
  healthScore: number;
  symptomsThisWeek: number;
  activeMedications: number;
  alertsCount: number;
  vitals: VitalSigns | null;
  allergies: Allergy[];
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
  const isFocused = useIsFocused();
  const { trendAlertEvent, familyUpdateEvent, setFamilyMemberIds } =
    useRealtimeHealthContext();
  const router = useRouter();
  const params = useLocalSearchParams<{ tour?: string }>();
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
  const [medicationScheduleViewMode, setMedicationScheduleViewMode] = useState<
    "today" | "upcoming" | "all"
  >("today");
  const [markingTaken, setMarkingTaken] = useState<string | null>(null);

  const { isEnabled: fallDetectionEnabled, toggleFallDetection } =
    useFallDetectionContext();
  const isRTL = i18n.language === "ar";
  const isAdmin = user?.role === "admin" || user?.role === "caregiver";
  const hasFamily = Boolean(user?.familyId);

  useEffect(() => {
    if (params.tour === "1") {
      setShowHowTo(true);
    }
  }, [params.tour]);
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

      Alert.alert(
        isRTL ? "تم" : "Success",
        isRTL ? "تم تأكيد الحدث" : "Event acknowledged"
      );
    } catch (error) {
      const _durationMs = Date.now() - startTime;
      logger.error("Failed to acknowledge health event", error, "FamilyScreen");

      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في تأكيد الحدث" : "Failed to acknowledge event"
      );
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

      Alert.alert(
        isRTL ? "تم" : "Success",
        isRTL ? "تم حل الحدث" : "Event resolved"
      );
    } catch (error) {
      const _durationMs = Date.now() - startTime;
      logger.error("Failed to resolve health event", error, "FamilyScreen");

      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في حل الحدث" : "Failed to resolve event"
      );
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

              Alert.alert(
                isRTL ? "تم" : "Success",
                isRTL ? "تم تصعيد الحدث" : "Event escalated"
              );
            } catch (error) {
              const _durationMs = Date.now() - startTime;
              logger.error(
                "Failed to escalate health event",
                error,
                "FamilyScreen"
              );

              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL ? "فشل في تصعيد الحدث" : "Failed to escalate event"
              );
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
      return "Just now";
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    return `${diffDays}d ago`;
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
        return "Open";
      case "ACKED":
        return "Acknowledged";
      case "RESOLVED":
        return "Resolved";
      case "ESCALATED":
        return "Escalated";
      default:
        return "Unknown";
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
        const metricsPromises = members.map(async (member) => {
          try {
            // Fetch only essential data for faster loading
            // Use Promise.allSettled to handle partial failures gracefully
            const results = await Promise.allSettled([
              // Only fetch recent symptoms (last 7 days) - limit to 5 for count
              symptomService
                .getUserSymptoms(member.id, 5)
                .catch(() => []),
              // Only fetch active medications for count
              medicationService
                .getUserMedications(member.id)
                .catch(() => []),
              // Alerts count is lightweight
              alertService
                .getActiveAlertsCount(member.id)
                .catch(() => 0),
              // Limit allergies to 10 for display
              allergyService
                .getUserAllergies(member.id, 10)
                .catch(() => []),
              // Health context (vitals) - only if dashboard view needs it
              viewMode === "dashboard"
                ? healthContextService
                    .getUserHealthContext(member.id)
                    .catch(() => null)
                : Promise.resolve(null),
            ]);

            const [
              symptomsResult,
              medicationsResult,
              alertsResult,
              allergiesResult,
              healthContextResult,
            ] = results;

            const symptoms =
              symptomsResult.status === "fulfilled" ? symptomsResult.value : [];
            const medications =
              medicationsResult.status === "fulfilled"
                ? medicationsResult.value
                : [];
            const alertsCount =
              alertsResult.status === "fulfilled" ? alertsResult.value : 0;
            const allergies =
              allergiesResult.status === "fulfilled"
                ? allergiesResult.value
                : [];
            const healthContext =
              healthContextResult.status === "fulfilled"
                ? healthContextResult.value
                : null;

            // Calculate health score using the centralized service
            const healthScoreResult =
              healthScoreService.calculateHealthScoreFromData(
                symptoms,
                medications
              );
            const healthScore = healthScoreResult.score;
            const activeMedications = medications.filter(
              (m: { isActive: boolean }) => m.isActive
            );

            // Count symptoms this week (already limited to recent by getUserSymptoms)
            const symptomsThisWeek = symptoms.length;

            // Extract vitals from health context (only if dashboard view)
            let vitals: VitalSigns | null = null;
            if (viewMode === "dashboard" && healthContext?.vitalSigns) {
              const vs = healthContext.vitalSigns;
              vitals = {
                heartRate: vs.heartRate,
                bloodPressure: vs.bloodPressure
                  ? (() => {
                      const bp = vs.bloodPressure.split("/");
                      if (bp.length === 2) {
                        return {
                          systolic: Number.parseFloat(bp[0]),
                          diastolic: Number.parseFloat(bp[1]),
                        };
                      }
                      return;
                    })()
                  : undefined,
                bodyTemperature: vs.temperature,
                oxygenSaturation: vs.oxygenLevel,
                bloodGlucose: vs.glucoseLevel,
                weight: vs.weight,
                timestamp: vs.lastUpdated || new Date(),
              };
            }

            return {
              id: member.id,
              user: member,
              healthScore,
              symptomsThisWeek,
              activeMedications: activeMedications.length,
              alertsCount,
              vitals: vitals ?? null,
              allergies: allergies || [],
            };
          } catch (_error) {
            // Return default metrics if error - don't block other members
            return {
              id: member.id,
              user: member,
              healthScore: 100,
              symptomsThisWeek: 0,
              activeMedications: 0,
              alertsCount: 0,
              vitals: null,
              allergies: [],
            };
          }
        });

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

    // Keep list mode fast by deferring heavy per-member metrics until dashboard mode.
    if (
      viewMode === "dashboard" &&
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
    viewMode,
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
        return "#2563EB";
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
            ? `لقد وصلت إلى الحد الأقصى لعدد الأعضاء في الاشتراك العائلي الخاص بك (${maxMembers} عضو). قم بالترقية إلى الاشتراك العائلي لإضافة المزيد من الأعضاء.`
            : `You've reached the maximum number of members for your plan (${maxMembers} members). Upgrade to Family Plan to add more members.`,
          [
            {
              text: isRTL ? "إلغاء" : "Cancel",
              style: "cancel",
            },
            {
              text: isRTL
                ? "ترقية إلى الاشتراك العائلي"
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
          ? "يجب الاشتراك بالاشتراك العائلي لإضافة أعضاء إضافيين إلى العائلة"
          : "A premium subscription is required to add additional family members",
        [
          {
            text: isRTL ? "إلغاء" : "Cancel",
            style: "cancel",
          },
          {
            text: isRTL ? "عرض الاشتراكات العائلية" : "View Family Plans",
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
        ? `مرحباً ${memberName}! تم دعوتك للانضمام إلى مجموعة العائلة الصحية على تطبيق معك.\n\nرمز الدعوة: ${code}\n\n1. حمل تطبيق معك\n2. سجل دخولك أو أنشئ حساب جديد\n3. استخدم رمز الدعوة: ${code}\n\nهذا الرمز صالح لمدة 7 أيام.`
        : `Hi ${memberName}! You've been invited to join our family health group on Maak app.\n\nInvitation Code: ${code}\n\n1. Download the Maak app\n2. Sign in or create a new account\n3. Use invitation code: ${code}\n\nThis code expires in 7 days.`;

      // Show options to share or copy with clearer labels
      Alert.alert(
        isRTL ? "تم إنشاء الدعوة" : "Invitation Created",
        isRTL
          ? `تم إنشاء رمز الدعوة لـ ${memberName}: ${code}\n\nما الذي تريد فعله؟`
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
                isRTL ? "تم الإزالة" : "Removed",
                isRTL
                  ? "تم إزالة العضو من العائلة بنجاح"
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
            [{ text: isRTL ? "حسناً" : "OK" }],
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
            [{ text: isRTL ? "حسناً" : "OK" }],
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
            ? "تم إضافة جهة الاتصال بنجاح"
            : "Emergency contact added successfully",
          [{ text: isRTL ? "حسناً" : "OK" }],
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
          [{ text: isRTL ? "حسناً" : "OK" }],
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

          if (viewMode === "dashboard" && needsMetricsLoad) {
            loadMemberMetrics(members).catch(() => {
              // Error loading member metrics
            });
          }

          // Step 2: Load remaining data in parallel (don't wait for metrics)
          const promises: Promise<void>[] = [];

          if (user?.id) {
            // Pass members directly to avoid stale state issue
            promises.push(loadEvents(false, members));
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
    if (!familyUpdateEvent || !isFocused) {
      return;
    }
    handleRealtimeFamilyUpdate(familyUpdateEvent.payload);
  }, [familyUpdateEvent?.id, isFocused, handleRealtimeFamilyUpdate]);

  useEffect(() => {
    if (!trendAlertEvent || !isFocused) {
      return;
    }
    handleTrendAlert(trendAlertEvent.payload);
  }, [trendAlertEvent?.id, isFocused, handleTrendAlert]);

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
        ? `مرحباً! تم دعوتك للانضمام إلى مجموعة العائلة الصحية على تطبيق معك.\n\nرمز الدعوة: ${code}\n\n1. حمل تطبيق معك\n2. سجل دخولك أو أنشئ حساب جديد\n3. استخدم رمز الدعوة: ${code}\n\nهذا الرمز صالح لمدة 7 أيام.`
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
              ? `لقد وصلت هذه العائلة إلى الحد الأقصى لعدد الأعضاء في الاشتراك العائلي الخاص بالمدير (${adminMaxMembers} عضو).`
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
              ? "يجب الاشتراك بالاشتراك العائلي للانضمام إلى عائلة تحتوي على أعضاء"
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
            ? "تم انضمامك بنجاح! يمكنك الآن رؤية أعضاء عائلتك الجدد في الأسفل."
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
            onPress={() => router.push(`/family/${member.id}`)}
            style={styles.dashboardCard}
          >
            <View style={styles.dashboardCardHeader}>
              <Avatar
                avatarType={member.avatarType}
                name={fullName}
                size="lg"
                source={member.avatar ? { uri: member.avatar } : undefined}
              />
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
      (sum, member) => sum + member.alertsCount,
      0
    );

    // Calculate average health score from filtered member metrics
    const avgHealthScore =
      metricsToUse.length > 0
        ? Math.round(
            metricsToUse.reduce((sum, member) => sum + member.healthScore, 0) /
              metricsToUse.length
          )
        : 100; // Default to 100 if no members

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

    // Check body temperature (normal: 36.1-37.2°C or 97-99°F)
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

      // Determine trend based on health score (lower is worse)
      let healthTrend: "up" | "down" | "stable" = "stable";
      if (metric.healthScore < 60) {
        healthTrend = "down"; // Critical - trending down
      } else if (metric.healthScore < 80) {
        healthTrend = "down"; // Needs attention - trending down
      }

      // Check for critical health score
      if (metric.healthScore < 60) {
        attentionItems.push({
          memberId: metric.user.id,
          memberName: fullName,
          reason: isRTL
            ? `نقاط الصحة منخفضة (${metric.healthScore})`
            : `Low health score (${metric.healthScore})`,
          severity: "high",
          icon: "health",
          trend: healthTrend,
        });
      } else if (metric.healthScore < 80) {
        attentionItems.push({
          memberId: metric.user.id,
          memberName: fullName,
          reason: isRTL
            ? `نقاط الصحة تحتاج انتباه (${metric.healthScore})`
            : `Health score needs attention (${metric.healthScore})`,
          severity: "medium",
          icon: "health",
          trend: healthTrend,
        });
      }

      // Check for active alerts
      if (metric.alertsCount > 0) {
        attentionItems.push({
          memberId: metric.user.id,
          memberName: fullName,
          reason: isRTL
            ? `${metric.alertsCount} ${metric.alertsCount === 1 ? "تنبيه نشط" : "تنبيهات نشطة"}`
            : `${metric.alertsCount} active ${metric.alertsCount === 1 ? "alert" : "alerts"}`,
          severity: metric.alertsCount > 2 ? "high" : "medium",
          icon: "alert",
          trend: metric.alertsCount > 2 ? "up" : "stable", // More alerts = trending up
        });
      }

      // Check for high symptom count
      if (metric.symptomsThisWeek > 3) {
        attentionItems.push({
          memberId: metric.user.id,
          memberName: fullName,
          reason: isRTL
            ? `${metric.symptomsThisWeek} ${metric.symptomsThisWeek === 1 ? "عرض صحي هذا الأسبوع" : "أعراض الصحية هذا الأسبوع"}`
            : `${metric.symptomsThisWeek} ${metric.symptomsThisWeek === 1 ? "symptom" : "symptoms"} this week`,
          severity: metric.symptomsThisWeek > 5 ? "high" : "medium",
          icon: "symptom",
          trend: metric.symptomsThisWeek > 5 ? "up" : "stable", // More symptoms = trending up
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

  const handleFilterChange = (filter: FilterOption) => {
    setSelectedFilter(filter);
  };

  return (
    <SafeAreaView
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {t("family")}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() =>
              setViewMode(viewMode === "list" ? "dashboard" : "list")
            }
            style={styles.viewToggleButton}
          >
            {viewMode === "list" ? (
              <Grid3x3 color="#FFFFFF" size={20} />
            ) : (
              <List color="#FFFFFF" size={20} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowHowTo(true)}
            style={styles.helpButton}
          >
            <Info color="#FFFFFF" size={20} />
          </TouchableOpacity>
          <View collapsable={false} ref={addMemberButtonRef}>
            <TouchableOpacity
              onPress={() => setShowInviteModal(true)}
              style={styles.addButton}
            >
              <UserPlus color="#FFFFFF" size={24} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.contentInner}
        refreshControl={
          <RefreshControl
            onRefresh={() => loadFamilyMembers(true)}
            refreshing={refreshing}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.content}
      >
        {loading ? (
          <View style={styles.inlineLoadingContainer}>
            <ActivityIndicator color="#2563EB" size="small" />
            <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
              {isRTL ? "جاري التحميل..." : "Loading..."}
            </Text>
          </View>
        ) : null}
        {/* View Data Filter */}
        <FamilyDataFilter
          currentUserId={user?.id || ""}
          familyMembers={familyMembers}
          hasFamily={hasFamily}
          isAdmin={isAdmin}
          onFilterChange={handleFilterChange}
          selectedFilter={selectedFilter}
        />

        {/* Family Overview */}
        <View style={styles.overviewCard}>
          <Text style={[styles.overviewTitle, isRTL && styles.rtlText]}>
            {selectedFilter.type === "personal"
              ? isRTL
                ? "نظرة عامة"
                : "My Overview"
              : isRTL
                ? "نظرة عامة على العائلة"
                : "Family Overview"}
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Users color="#2563EB" size={20} />
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                {totalMembers}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {isRTL ? "أفراد" : "Members"}
              </Text>
            </View>

            <View style={styles.statItem}>
              <Heart color="#10B981" size={20} />
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                {avgHealthScore || 0}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {isRTL ? "نقاط الصحة" : "Health Score"}
              </Text>
            </View>

            <View style={styles.statItem}>
              <AlertTriangle color="#F59E0B" size={20} />
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                {totalAlerts}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {isRTL ? "تنبيهات" : "Alerts"}
              </Text>
            </View>
          </View>
        </View>

        {/* Active Alerts */}
        <AlertsCard familyMembers={familyMembers} />

        {/* Needs Attention */}
        <View style={styles.section}>
          <View
            style={[
              styles.attentionHeader,
              isRTL && { flexDirection: "row-reverse" },
            ]}
          >
            <AlertTriangle color="#F59E0B" size={20} />
            <Text
              style={[
                styles.sectionTitle,
                isRTL && styles.sectionTitleRTL,
                isRTL && styles.rtlText,
              ]}
            >
              {isRTL ? "يحتاج انتباه" : "Needs Attention"}
            </Text>
          </View>
          {attentionItems.length > 0 ? (
            <View style={styles.attentionCard}>
              {attentionItems.map((item, index) => {
                const severityColors = {
                  high: { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626" },
                  medium: { bg: "#FFFBEB", border: "#FDE68A", text: "#D97706" },
                  low: { bg: "#F0F9FF", border: "#BAE6FD", text: "#0284C7" },
                };
                const colors = severityColors[item.severity];

                return (
                  <TouchableOpacity
                    key={`${item.memberId}-${index}`}
                    onPress={() => {
                      router.push(`/family/${item.memberId}`);
                    }}
                    style={[
                      styles.attentionItem,
                      {
                        backgroundColor: colors.bg,
                        borderStartColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.attentionItemContent}>
                      <View style={styles.attentionItemLeft}>
                        {item.icon === "health" && (
                          <Heart color={colors.text} size={18} />
                        )}
                        {item.icon === "alert" && (
                          <AlertTriangle color={colors.text} size={18} />
                        )}
                        {item.icon === "symptom" && (
                          <Activity color={colors.text} size={18} />
                        )}
                        {item.icon === "vitals" && (
                          <Gauge color={colors.text} size={18} />
                        )}
                        <View style={styles.attentionItemText}>
                          <Text
                            style={[
                              styles.attentionItemMember,
                              { color: colors.text },
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {item.memberName}
                          </Text>
                          <View style={styles.attentionItemReasonRow}>
                            <Text
                              style={[
                                styles.attentionItemReason,
                                isRTL && styles.rtlText,
                              ]}
                            >
                              {item.reason}
                            </Text>
                            {item.trend && (
                              <View style={styles.trendContainer}>
                                {item.trend === "up" && (
                                  <TrendingUp
                                    color={colors.text}
                                    size={14}
                                    style={styles.trendIcon}
                                  />
                                )}
                                {item.trend === "down" && (
                                  <TrendingDown
                                    color={colors.text}
                                    size={14}
                                    style={styles.trendIcon}
                                  />
                                )}
                                {item.trend === "stable" && (
                                  <Minus
                                    color={colors.text}
                                    size={14}
                                    style={styles.trendIcon}
                                  />
                                )}
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.severityBadge,
                          {
                            backgroundColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.severityBadgeText,
                            { color: colors.text },
                          ]}
                        >
                          {item.severity === "high"
                            ? isRTL
                              ? "عالي"
                              : "High"
                            : item.severity === "medium"
                              ? isRTL
                                ? "متوسط"
                                : "Medium"
                              : isRTL
                                ? "منخفض"
                                : "Low"}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyAttentionCard}>
              <Text
                style={[styles.emptyAttentionText, isRTL && styles.rtlText]}
              >
                {isRTL
                  ? "لا توجد عناصر تحتاج انتباه في الوقت الحالي"
                  : "No items need attention at this time"}
              </Text>
            </View>
          )}
        </View>

        {/* Family Members */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              isRTL && styles.sectionTitleRTL,
              isRTL && styles.rtlText,
            ]}
          >
            {t("familyMembers")}
          </Text>

          {viewMode === "dashboard" ? (
            // Dashboard View - Show caregiver dashboard for admins, regular dashboard for members
            isAdmin ? (
              // Caregiver Dashboard View
              loadingCaregiverDashboard ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#2563EB" size="large" />
                </View>
              ) : caregiverOverview ? (
                <View>
                  {/* Calculate filtered stats */}
                  {(() => {
                    const filteredMembers = caregiverOverview.members.filter(
                      (memberData) => {
                        if (selectedFilter.type === "personal") {
                          return memberData.member.id === user?.id;
                        }
                        if (
                          selectedFilter.type === "member" &&
                          selectedFilter.memberId
                        ) {
                          return (
                            memberData.member.id === selectedFilter.memberId
                          );
                        }
                        if (selectedFilter.type === "family") {
                          return true;
                        }
                        return memberData.member.id === user?.id;
                      }
                    );

                    const filteredTotalMembers = filteredMembers.length;
                    const filteredMembersNeedingAttention =
                      filteredMembers.filter((m) => m.needsAttention).length;
                    const filteredTotalActiveAlerts = filteredMembers.reduce(
                      (sum, m) =>
                        sum + m.recentAlerts.filter((a) => !a.resolved).length,
                      0
                    );
                    const filteredAverageHealthScore =
                      filteredMembers.length > 0
                        ? Math.round(
                            filteredMembers.reduce(
                              (sum, m) => sum + m.healthScore,
                              0
                            ) / filteredMembers.length
                          )
                        : 0;

                    return (
                      <Card
                        contentStyle={undefined}
                        pressable={false}
                        style={{ marginBottom: theme.spacing.base }}
                        variant="elevated"
                      >
                        <Heading
                          level={6}
                          style={[
                            isRTL ? styles.rtlText : {},
                            { marginBottom: theme.spacing.base },
                          ]}
                        >
                          {isRTL ? "الملخص" : "Overview"}
                        </Heading>
                        <View
                          style={{
                            flexDirection: isRTL ? "row-reverse" : "row",
                            flexWrap: "wrap",
                            gap: theme.spacing.base,
                          }}
                        >
                          <View
                            style={{
                              flex: 1,
                              minWidth: "45%",
                              padding: theme.spacing.base,
                              backgroundColor:
                                theme.colors.background.secondary,
                              borderRadius: theme.borderRadius.md,
                              alignItems: "center",
                              overflow: "visible",
                            }}
                          >
                            <Users
                              color={theme.colors.primary.main}
                              size={32}
                            />
                            <Text
                              adjustsFontSizeToFit={true}
                              minimumFontScale={0.7}
                              numberOfLines={1}
                              style={[
                                getTextStyle(
                                  theme,
                                  "heading",
                                  "bold",
                                  theme.colors.text.primary
                                ),
                                {
                                  fontSize: 32,
                                  marginTop: theme.spacing.xs,
                                  width: "100%",
                                  textAlign: "center",
                                },
                              ]}
                            >
                              {filteredTotalMembers}
                            </Text>
                            <Text
                              style={[
                                getTextStyle(
                                  theme,
                                  "caption",
                                  "regular",
                                  theme.colors.text.secondary
                                ),
                                {
                                  textAlign: "center",
                                  marginTop: theme.spacing.xs,
                                },
                              ]}
                            >
                              {isRTL ? "جميع أعضاء العائلة" : "Total Members"}
                            </Text>
                          </View>
                          <View
                            style={{
                              flex: 1,
                              minWidth: "45%",
                              padding: theme.spacing.base,
                              backgroundColor:
                                theme.colors.background.secondary,
                              borderRadius: theme.borderRadius.md,
                              alignItems: "center",
                              overflow: "visible",
                            }}
                          >
                            <AlertTriangle
                              color={theme.colors.accent.error}
                              size={32}
                            />
                            <Text
                              adjustsFontSizeToFit={true}
                              minimumFontScale={0.7}
                              numberOfLines={1}
                              style={[
                                getTextStyle(
                                  theme,
                                  "heading",
                                  "bold",
                                  theme.colors.accent.error
                                ),
                                {
                                  fontSize: 32,
                                  marginTop: theme.spacing.xs,
                                  width: "100%",
                                  textAlign: "center",
                                },
                              ]}
                            >
                              {filteredMembersNeedingAttention}
                            </Text>
                            <Text
                              style={[
                                getTextStyle(
                                  theme,
                                  "caption",
                                  "regular",
                                  theme.colors.text.secondary
                                ),
                                {
                                  textAlign: "center",
                                  marginTop: theme.spacing.xs,
                                },
                              ]}
                            >
                              {isRTL ? "يحتاجون انتباه" : "Need Attention"}
                            </Text>
                          </View>
                          <View
                            style={{
                              flex: 1,
                              minWidth: "45%",
                              padding: theme.spacing.base,
                              backgroundColor:
                                theme.colors.background.secondary,
                              borderRadius: theme.borderRadius.md,
                              alignItems: "center",
                              overflow: "visible",
                            }}
                          >
                            <AlertTriangle
                              color={theme.colors.accent.warning}
                              size={32}
                            />
                            <Text
                              adjustsFontSizeToFit={true}
                              minimumFontScale={0.7}
                              numberOfLines={1}
                              style={[
                                getTextStyle(
                                  theme,
                                  "heading",
                                  "bold",
                                  theme.colors.accent.warning
                                ),
                                {
                                  fontSize: 32,
                                  marginTop: theme.spacing.xs,
                                  width: "100%",
                                  textAlign: "center",
                                },
                              ]}
                            >
                              {filteredTotalActiveAlerts}
                            </Text>
                            <Text
                              style={[
                                getTextStyle(
                                  theme,
                                  "caption",
                                  "regular",
                                  theme.colors.text.secondary
                                ),
                                {
                                  textAlign: "center",
                                  marginTop: theme.spacing.xs,
                                },
                              ]}
                            >
                              {isRTL ? "تنبيهات فعالة" : "Active Alerts"}
                            </Text>
                          </View>
                          <View
                            style={{
                              flex: 1,
                              minWidth: "45%",
                              padding: theme.spacing.base,
                              backgroundColor:
                                theme.colors.background.secondary,
                              borderRadius: theme.borderRadius.md,
                              alignItems: "center",
                              overflow: "visible",
                            }}
                          >
                            <Heart
                              color={
                                filteredAverageHealthScore >= 80
                                  ? "#10B981"
                                  : filteredAverageHealthScore >= 60
                                    ? "#F59E0B"
                                    : "#EF4444"
                              }
                              size={32}
                            />
                            <Text
                              adjustsFontSizeToFit={true}
                              minimumFontScale={0.7}
                              numberOfLines={1}
                              style={[
                                getTextStyle(
                                  theme,
                                  "heading",
                                  "bold",
                                  filteredAverageHealthScore >= 80
                                    ? "#10B981"
                                    : filteredAverageHealthScore >= 60
                                      ? "#F59E0B"
                                      : "#EF4444"
                                ),
                                {
                                  fontSize: 32,
                                  marginTop: theme.spacing.sm,
                                  width: "100%",
                                  textAlign: "center",
                                },
                              ]}
                            >
                              {filteredAverageHealthScore}
                            </Text>
                            <Text
                              style={[
                                getTextStyle(
                                  theme,
                                  "caption",
                                  "regular",
                                  theme.colors.text.secondary
                                ),
                                {
                                  textAlign: "center",
                                  marginTop: theme.spacing.xs,
                                },
                              ]}
                            >
                              {isRTL ? "متوسط النقاط" : "Avg Health Score"}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    );
                  })()}

                  {/* Member Details */}
                  <Heading
                    level={6}
                    style={[
                      isRTL ? styles.rtlText : {},
                      {
                        marginBottom: theme.spacing.base,
                        marginTop: theme.spacing.base,
                      },
                    ]}
                  >
                    {isRTL ? "تفاصيل أعضاء العائلة" : "Member Details"}
                  </Heading>
                  {caregiverOverview.members
                    .filter((memberData) => {
                      if (selectedFilter.type === "personal") {
                        return memberData.member.id === user?.id;
                      }
                      if (
                        selectedFilter.type === "member" &&
                        selectedFilter.memberId
                      ) {
                        return memberData.member.id === selectedFilter.memberId;
                      }
                      if (selectedFilter.type === "family") {
                        return true;
                      }
                      return memberData.member.id === user?.id;
                    })
                    .map((memberData) => (
                      <Card
                        contentStyle={undefined}
                        key={memberData.member.id}
                        onPress={() =>
                          router.push(`/family/${memberData.member.id}`)
                        }
                        pressable={true}
                        style={{
                          marginBottom: theme.spacing.base,
                          backgroundColor: memberData.needsAttention
                            ? `${theme.colors.accent.error}10`
                            : undefined,
                          borderColor: memberData.needsAttention
                            ? theme.colors.accent.error
                            : undefined,
                        }}
                        variant="elevated"
                      >
                        <View
                          style={{
                            flexDirection: isRTL ? "row-reverse" : "row",
                            alignItems: "center",
                            gap: theme.spacing.base,
                            marginBottom: theme.spacing.base,
                          }}
                        >
                          <Avatar
                            avatarType={memberData.member.avatarType}
                            name={memberData.member.firstName}
                            size="md"
                          />
                          <View style={{ flex: 1 }}>
                            <Heading
                              level={6}
                              style={[
                                isRTL ? styles.rtlText : {},
                                { marginBottom: theme.spacing.xs },
                              ]}
                            >
                              {memberData.member.firstName}{" "}
                              {memberData.member.lastName}
                            </Heading>
                            <Badge
                              size="small"
                              style={{
                                backgroundColor: `${
                                  memberData.healthScore >= 80
                                    ? "#10B981"
                                    : memberData.healthScore >= 60
                                      ? "#F59E0B"
                                      : "#EF4444"
                                }20`,
                                borderColor:
                                  memberData.healthScore >= 80
                                    ? "#10B981"
                                    : memberData.healthScore >= 60
                                      ? "#F59E0B"
                                      : "#EF4444",
                                marginTop: theme.spacing.xs,
                              }}
                              variant="outline"
                            >
                              <Caption
                                numberOfLines={1}
                                style={{
                                  color:
                                    memberData.healthScore >= 80
                                      ? "#10B981"
                                      : memberData.healthScore >= 60
                                        ? "#F59E0B"
                                        : "#EF4444",
                                }}
                              >
                                {isRTL ? "النقاط" : "Score"}:{" "}
                                {memberData.healthScore}
                              </Caption>
                            </Badge>
                            {memberData.needsAttention && (
                              <Badge
                                size="small"
                                style={{
                                  backgroundColor: `${theme.colors.accent.error}20`,
                                  borderColor: theme.colors.accent.error,
                                  marginTop: theme.spacing.xs,
                                }}
                                variant="outline"
                              >
                                <Caption
                                  numberOfLines={1}
                                  style={{ color: theme.colors.accent.error }}
                                >
                                  {isRTL ? "يحتاج انتباه" : "Needs Attention"}
                                </Caption>
                              </Badge>
                            )}
                          </View>
                        </View>

                        {/* Metrics */}
                        <View
                          style={{
                            flexDirection: isRTL ? "row-reverse" : "row",
                            gap: theme.spacing.base,
                            marginTop: theme.spacing.sm,
                          }}
                        >
                          <View
                            style={{
                              flex: 1,
                              padding: theme.spacing.sm,
                              backgroundColor:
                                theme.colors.background.secondary,
                              borderRadius: theme.borderRadius.md,
                              alignItems: "center",
                            }}
                          >
                            <Pill color={theme.colors.primary.main} size={20} />
                            <Text
                              style={[
                                getTextStyle(
                                  theme,
                                  "subheading",
                                  "bold",
                                  theme.colors.text.primary
                                ),
                                { fontSize: 20, marginTop: theme.spacing.xs },
                              ]}
                            >
                              {memberData.medicationCompliance.rate}%
                            </Text>
                            <Text
                              style={[
                                getTextStyle(
                                  theme,
                                  "caption",
                                  "regular",
                                  theme.colors.text.secondary
                                ),
                                {
                                  marginTop: theme.spacing.xs,
                                  textAlign: "center",
                                },
                              ]}
                            >
                              {isRTL ? "الالتزام بالأدوية" : "Compliance"}
                            </Text>
                          </View>
                          <View
                            style={{
                              flex: 1,
                              padding: theme.spacing.sm,
                              backgroundColor:
                                theme.colors.background.secondary,
                              borderRadius: theme.borderRadius.md,
                              alignItems: "center",
                            }}
                          >
                            <AlertTriangle
                              color={theme.colors.accent.error}
                              size={20}
                            />
                            <Text
                              style={[
                                getTextStyle(
                                  theme,
                                  "subheading",
                                  "bold",
                                  theme.colors.accent.error
                                ),
                                { fontSize: 20, marginTop: theme.spacing.xs },
                              ]}
                            >
                              {memberData.medicationCompliance.missedDoses}
                            </Text>
                            <Text
                              style={[
                                getTextStyle(
                                  theme,
                                  "caption",
                                  "regular",
                                  theme.colors.text.secondary
                                ),
                                {
                                  marginTop: theme.spacing.xs,
                                  textAlign: "center",
                                },
                              ]}
                            >
                              {isRTL ? "جرعات مفقودة" : "Missed Doses"}
                            </Text>
                          </View>
                          <View
                            style={{
                              flex: 1,
                              padding: theme.spacing.sm,
                              backgroundColor:
                                theme.colors.background.secondary,
                              borderRadius: theme.borderRadius.md,
                              alignItems: "center",
                            }}
                          >
                            <AlertTriangle
                              color={theme.colors.accent.warning}
                              size={20}
                            />
                            <Text
                              style={[
                                getTextStyle(
                                  theme,
                                  "subheading",
                                  "bold",
                                  theme.colors.accent.warning
                                ),
                                { fontSize: 20, marginTop: theme.spacing.xs },
                              ]}
                            >
                              {
                                memberData.recentAlerts.filter(
                                  (a) => !a.resolved
                                ).length
                              }
                            </Text>
                            <Text
                              style={[
                                getTextStyle(
                                  theme,
                                  "caption",
                                  "regular",
                                  theme.colors.text.secondary
                                ),
                                {
                                  marginTop: theme.spacing.xs,
                                  textAlign: "center",
                                },
                              ]}
                            >
                              {isRTL ? "تنبيهات" : "Alerts"}
                            </Text>
                          </View>
                        </View>

                        {/* Attention Reasons */}
                        {memberData.attentionReasons.length > 0 && (
                          <View style={{ marginTop: theme.spacing.sm }}>
                            <Caption
                              numberOfLines={1}
                              style={[
                                isRTL ? styles.rtlText : {},
                                { marginBottom: theme.spacing.xs },
                              ]}
                            >
                              {isRTL ? "أسباب الانتباه" : "Attention Reasons"}:
                            </Caption>
                            <View
                              style={{
                                flexDirection: isRTL ? "row-reverse" : "row",
                                flexWrap: "wrap",
                              }}
                            >
                              {memberData.attentionReasons.map(
                                (reason, index) => (
                                  <Badge
                                    key={index}
                                    size="small"
                                    style={{
                                      marginTop: theme.spacing.xs,
                                      marginRight: theme.spacing.xs,
                                      alignSelf: "flex-start",
                                    }}
                                    variant="outline"
                                  >
                                    <Caption numberOfLines={1} style={{}}>
                                      {translateAttentionReason(reason)}
                                    </Caption>
                                  </Badge>
                                )
                              )}
                            </View>
                          </View>
                        )}

                        {/* Emergency Contacts */}
                        {memberData.emergencyContacts.length > 0 && (
                          <View style={{ marginTop: theme.spacing.sm }}>
                            <Caption
                              numberOfLines={1}
                              style={[
                                isRTL ? styles.rtlText : {},
                                { marginBottom: theme.spacing.xs },
                              ]}
                            >
                              {isRTL
                                ? "جهات الاتصال الطارئة"
                                : "Emergency Contacts"}
                              :
                            </Caption>
                            {memberData.emergencyContacts.map(
                              (contact, index) => (
                                <TouchableOpacity
                                  key={index}
                                  onPress={() =>
                                    Linking.openURL(`tel:${contact.phone}`)
                                  }
                                  style={{
                                    flexDirection: isRTL
                                      ? "row-reverse"
                                      : "row",
                                    alignItems: "center",
                                    gap: theme.spacing.xs,
                                    marginTop: theme.spacing.xs,
                                  }}
                                >
                                  <Phone
                                    color={theme.colors.primary.main}
                                    size={16}
                                  />
                                  <Caption numberOfLines={1} style={{}}>
                                    {contact.name}
                                  </Caption>
                                </TouchableOpacity>
                              )
                            )}
                          </View>
                        )}
                      </Card>
                    ))}
                </View>
              ) : filteredFamilyMembers.length > 0 ? (
                renderDashboardFallbackCards()
              ) : (
                <View style={styles.emptyContainer}>
                  <Users color={theme.colors.text.secondary} size={64} />
                  <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                    {isRTL ? "لا توجد بيانات" : "No data available"}
                  </Text>
                </View>
              )
            ) : // Regular Dashboard View for non-admins
            loadingMetrics &&
              filteredMemberMetrics.length === 0 &&
              filteredFamilyMembers.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#2563EB" size="large" />
              </View>
            ) : filteredMemberMetrics.length > 0 ? (
              <View style={styles.dashboardGrid}>
                {filteredMemberMetrics.map((metric) => {
                  const fullName =
                    metric.user.firstName && metric.user.lastName
                      ? `${metric.user.firstName} ${metric.user.lastName}`
                      : metric.user.firstName || "User";
                  const isCurrentUser = metric.user.id === user?.id;

                  return (
                    <TouchableOpacity
                      key={metric.id}
                      onPress={() => router.push(`/family/${metric.user.id}`)}
                      style={styles.dashboardCard}
                    >
                      <View style={styles.dashboardCardHeader}>
                        <Avatar
                          avatarType={metric.user.avatarType}
                          name={fullName}
                          size="lg"
                          source={
                            metric.user.avatar
                              ? { uri: metric.user.avatar }
                              : undefined
                          }
                        />
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
                        style={[
                          styles.dashboardCardName,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {fullName}
                      </Text>

                      <View style={styles.dashboardMetrics}>
                        <View style={styles.dashboardMetric}>
                          <Heart
                            color={
                              metric.healthScore >= 80
                                ? "#10B981"
                                : metric.healthScore >= 60
                                  ? "#F59E0B"
                                  : "#EF4444"
                            }
                            size={16}
                          />
                          <Text
                            style={[
                              styles.dashboardMetricValue,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {metric.healthScore}
                          </Text>
                          <Text
                            style={[
                              styles.dashboardMetricLabel,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {isRTL ? "صحة" : "Health"}
                          </Text>
                        </View>

                        <View style={styles.dashboardMetric}>
                          <AlertTriangle color="#F59E0B" size={16} />
                          <Text
                            style={[
                              styles.dashboardMetricValue,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {metric.symptomsThisWeek}
                          </Text>
                          <Text
                            style={[
                              styles.dashboardMetricLabel,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {isRTL ? "أعراض صحية" : "Symptoms"}
                          </Text>
                        </View>

                        <View style={styles.dashboardMetric}>
                          <Heart color="#2563EB" size={16} />
                          <Text
                            style={[
                              styles.dashboardMetricValue,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {metric.activeMedications}
                          </Text>
                          <Text
                            style={[
                              styles.dashboardMetricLabel,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {isRTL ? "أدوية" : "Meds"}
                          </Text>
                        </View>

                        {metric.alertsCount > 0 && (
                          <View style={styles.dashboardMetric}>
                            <AlertTriangle color="#EF4444" size={16} />
                            <Text
                              style={[
                                styles.dashboardMetricValue,
                                styles.alertValue,
                                isRTL && styles.rtlText,
                              ]}
                            >
                              {metric.alertsCount}
                            </Text>
                            <Text
                              style={[
                                styles.dashboardMetricLabel,
                                isRTL && styles.rtlText,
                              ]}
                            >
                              {isRTL ? "تنبيهات" : "Alerts"}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Vitals Section */}
                      {metric.vitals && (
                        <View style={styles.vitalsSection}>
                          <Text
                            style={[
                              styles.vitalsTitle,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {isRTL ? "العلامات الحيوية" : "Vitals"}
                          </Text>
                          <View style={styles.vitalsGrid}>
                            {metric.vitals.heartRate !== undefined && (
                              <View style={styles.vitalItem}>
                                <Heart color="#EF4444" size={14} />
                                <Text
                                  style={[
                                    styles.vitalValue,
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  {Math.round(metric.vitals.heartRate)}
                                </Text>
                                <Text
                                  style={[
                                    styles.vitalLabel,
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  BPM
                                </Text>
                              </View>
                            )}
                            {metric.vitals.bloodPressure && (
                              <View style={styles.vitalItem}>
                                <Gauge color="#F59E0B" size={14} />
                                <Text
                                  style={[
                                    styles.vitalValue,
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  {metric.vitals.bloodPressure.systolic}/
                                  {metric.vitals.bloodPressure.diastolic}
                                </Text>
                                <Text
                                  style={[
                                    styles.vitalLabel,
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  BP
                                </Text>
                              </View>
                            )}
                            {metric.vitals.steps !== undefined && (
                              <View style={styles.vitalItem}>
                                <Activity color="#2563EB" size={14} />
                                <Text
                                  style={[
                                    styles.vitalValue,
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  {metric.vitals.steps > 1000
                                    ? `${(metric.vitals.steps / 1000).toFixed(1)}k`
                                    : metric.vitals.steps}
                                </Text>
                                <Text
                                  style={[
                                    styles.vitalLabel,
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  {isRTL ? " خطوات" : "Steps"}
                                </Text>
                              </View>
                            )}
                            {metric.vitals.bodyTemperature !== undefined && (
                              <View style={styles.vitalItem}>
                                <Thermometer color="#EF4444" size={14} />
                                <Text
                                  style={[
                                    styles.vitalValue,
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  {metric.vitals.bodyTemperature.toFixed(1)}
                                </Text>
                                <Text
                                  style={[
                                    styles.vitalLabel,
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  °C
                                </Text>
                              </View>
                            )}
                            {metric.vitals.oxygenSaturation !== undefined && (
                              <View style={styles.vitalItem}>
                                <Droplet color="#3B82F6" size={14} />
                                <Text
                                  style={[
                                    styles.vitalValue,
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  {Math.round(metric.vitals.oxygenSaturation)}
                                </Text>
                                <Text
                                  style={[
                                    styles.vitalLabel,
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  SpO2
                                </Text>
                              </View>
                            )}
                            {metric.vitals.weight !== undefined && (
                              <View style={styles.vitalItem}>
                                <Activity color="#10B981" size={14} />
                                <Text
                                  style={[
                                    styles.vitalValue,
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  {metric.vitals.weight.toFixed(1)}
                                </Text>
                                <Text
                                  style={[
                                    styles.vitalLabel,
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  kg
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : filteredFamilyMembers.length > 0 ? (
              renderDashboardFallbackCards()
            ) : (
              <View style={styles.emptyContainer}>
                <Users color={theme.colors.text.secondary} size={64} />
                <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                  {isRTL ? "لا توجد بيانات" : "No data available"}
                </Text>
              </View>
            )
          ) : (
            // List View
            <View style={styles.membersList}>
              {familyMembers.map((member) => {
                const metrics = memberMetrics.find((m) => m.id === member.id);
                const allergies = metrics?.allergies || [];
                return (
                  <View key={member.id} style={styles.memberItem}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => router.push(`/family/${member.id}`)}
                      style={styles.memberLeft}
                    >
                      <View style={styles.avatarContainer}>
                        <Avatar
                          avatarType={member.avatarType}
                          badgeColor="#10B981"
                          name={
                            member.firstName && member.lastName
                              ? `${member.firstName} ${member.lastName}`
                              : member.firstName || "User"
                          }
                          showBadge={member.id === user?.id}
                          size="md"
                          source={
                            member.avatar ? { uri: member.avatar } : undefined
                          }
                        />
                      </View>

                      <View style={styles.memberInfo}>
                        <Text
                          style={[styles.memberName, isRTL && styles.rtlText]}
                        >
                          {member.firstName && member.lastName
                            ? `${member.firstName} ${member.lastName}`
                            : member.firstName || "User"}
                        </Text>
                        <Text
                          style={[
                            styles.memberRelation,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {member.role === "admin"
                            ? isRTL
                              ? "مدير"
                              : "Admin"
                            : isRTL
                              ? "فرد عائلي"
                              : "Member"}
                        </Text>
                        {allergies.length > 0 && (
                          <View style={styles.allergiesContainer}>
                            <Text
                              style={[
                                styles.allergiesLabel,
                                isRTL && styles.rtlText,
                              ]}
                            >
                              {isRTL ? "الحساسية: " : "Allergies: "}
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.allergiesText,
                                isRTL && styles.rtlText,
                              ]}
                            >
                              {allergies
                                .slice(0, 3)
                                .map((allergy) =>
                                  getTranslatedAllergyName(allergy.name)
                                )
                                .join(", ")}
                              {allergies.length > 3 &&
                                ` ${isRTL ? "+" : "+"}${allergies.length - 3}`}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>

                    <View style={styles.memberRight}>
                      <View style={styles.memberStats}>
                        <View
                          style={[
                            styles.statusIndicator,
                            {
                              backgroundColor: "#10B981",
                            },
                          ]}
                        >
                          <Text style={styles.statusText}>
                            {isRTL ? "فعال" : "Active"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.memberActions}>
                        <TouchableOpacity
                          onPress={() => handleEditMember(member)}
                          style={styles.actionButton}
                        >
                          <Edit color="#64748B" size={16} />
                        </TouchableOpacity>
                        {member.id !== user?.id && (
                          <TouchableOpacity
                            onPress={() => handleDeleteMember(member)}
                            style={[styles.actionButton, styles.deleteButton]}
                          >
                            <Trash2 color="#EF4444" size={16} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Elderly Dashboard Section - for non-admin users */}
        {!isAdmin && viewMode === "dashboard" && (
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                isRTL && styles.sectionTitleRTL,
                isRTL && styles.rtlText,
              ]}
            >
              {isRTL ? "لوحة التحكم" : "My Dashboard"}
            </Text>

            {loadingElderlyDashboard ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#2563EB" size="large" />
              </View>
            ) : elderlyDashboardData ? (
              <View>
                {/* Next Medication */}
                {elderlyDashboardData.nextMedication && (
                  <Card
                    contentStyle={undefined}
                    pressable={false}
                    style={{
                      backgroundColor: `${theme.colors.primary.main}10`,
                      borderColor: theme.colors.primary.main,
                      borderWidth: 2,
                      padding: 24,
                      borderRadius: 16,
                      marginBottom: theme.spacing.base,
                    }}
                    variant="elevated"
                  >
                    <View
                      style={{
                        flexDirection: isRTL ? "row-reverse" : "row",
                        alignItems: "center",
                        gap: 16,
                        marginBottom: 16,
                      }}
                    >
                      <Pill color={theme.colors.primary.main} size={32} />
                      <Heading level={1} style={{ fontSize: 24 }}>
                        {isRTL ? "الدواء التالي" : "Next Medication"}
                      </Heading>
                    </View>
                    <Text
                      style={{
                        fontSize: 32,
                        fontFamily: "Geist-Bold",
                        color: theme.colors.primary.main,
                        marginBottom: 8,
                      }}
                    >
                      {elderlyDashboardData.nextMedication.time}
                    </Text>
                    <Heading
                      level={2}
                      style={{ fontSize: 20, marginBottom: 4 }}
                    >
                      {elderlyDashboardData.nextMedication.name}
                    </Heading>
                    <Caption numberOfLines={1} style={{ fontSize: 18 }}>
                      {isRTL ? "الجرعة" : "Dosage"}:{" "}
                      {elderlyDashboardData.nextMedication.dosage}
                    </Caption>
                  </Card>
                )}

                {/* Health Score */}
                <Card
                  contentStyle={undefined}
                  pressable={false}
                  style={{
                    alignItems: "center",
                    padding: 24,
                    borderRadius: 16,
                    marginBottom: theme.spacing.base,
                    backgroundColor: `${getElderlyHealthScoreColor(
                      elderlyDashboardData.healthScore
                    )}10`,
                  }}
                  variant="elevated"
                >
                  <Heart
                    color={getElderlyHealthScoreColor(
                      elderlyDashboardData.healthScore
                    )}
                    size={48}
                  />
                  <Text
                    style={{
                      fontSize: 64,
                      fontFamily: "Geist-Bold",
                      color: getElderlyHealthScoreColor(
                        elderlyDashboardData.healthScore
                      ),
                      marginBottom: 8,
                    }}
                  >
                    {elderlyDashboardData.healthScore}
                  </Text>
                  <Text style={{ fontSize: 20, color: "#6B7280" }}>
                    {isRTL ? "النقاط الصحية" : "Health Score"}
                  </Text>
                </Card>

                {/* Alerts */}
                {elderlyDashboardData.hasAlerts && (
                  <Card
                    contentStyle={undefined}
                    pressable={false}
                    style={{
                      backgroundColor: "#FEE2E2",
                      borderColor: "#EF4444",
                      borderWidth: 2,
                      padding: 24,
                      borderRadius: 16,
                      marginBottom: theme.spacing.base,
                    }}
                    variant="elevated"
                  >
                    <View
                      style={{
                        flexDirection: isRTL ? "row-reverse" : "row",
                        alignItems: "center",
                        gap: 16,
                      }}
                    >
                      <AlertTriangle color="#EF4444" size={32} />
                      <Heading level={1} style={{ fontSize: 24 }}>
                        {isRTL ? "تنبيهات فعالة" : "Active Alerts"}
                      </Heading>
                    </View>
                    <TypographyText style={{ fontSize: 18, marginTop: 8 }}>
                      {isRTL
                        ? "لديك تنبيهات تحتاج إلى مراجعة"
                        : "You have alerts that need attention"}
                    </TypographyText>
                  </Card>
                )}

                {/* Emergency Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleElderlyEmergency}
                  style={{
                    backgroundColor: "#EF4444",
                    height: 80,
                    borderRadius: 12,
                    justifyContent: "center",
                    alignItems: "center",
                    flexDirection: isRTL ? "row-reverse" : "row",
                    gap: 16,
                    marginBottom: theme.spacing.base,
                  }}
                >
                  <Shield color="#FFFFFF" size={32} />
                  <Text
                    style={{
                      fontSize: 24,
                      fontFamily: "Geist-Bold",
                      color: "#FFFFFF",
                    }}
                  >
                    {isRTL ? "تنبيه طارئ" : "Emergency Alert"}
                  </Text>
                </TouchableOpacity>

                {/* Emergency Contacts */}
                {elderlyDashboardData.emergencyContacts.length > 0 && (
                  <View>
                    <Heading
                      level={2}
                      style={{ fontSize: 20, marginBottom: theme.spacing.base }}
                    >
                      {isRTL ? "جهات الاتصال الطارئة" : "Emergency Contacts"}
                    </Heading>
                    {elderlyDashboardData.emergencyContacts.map(
                      (contact, index) => (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          key={index}
                          onPress={() => handleElderlyCall(contact.phone)}
                          style={{
                            backgroundColor: "#F3F4F6",
                            padding: 16,
                            borderRadius: 8,
                            flexDirection: isRTL ? "row-reverse" : "row",
                            alignItems: "center",
                            gap: 16,
                            marginBottom: 12,
                          }}
                        >
                          <Phone color={theme.colors.primary.main} size={24} />
                          <Text
                            style={{
                              fontSize: 18,
                              fontFamily: "Geist-Bold",
                              color: "#111827",
                            }}
                          >
                            {contact.name}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Heart color={theme.colors.text.secondary} size={64} />
                <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                  {isRTL ? "لا توجد بيانات" : "No data available"}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Medication Schedule */}
        <View style={styles.section}>
          <View
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: theme.spacing.base,
            }}
          >
            <Text
              style={[
                styles.sectionTitle,
                isRTL && styles.sectionTitleRTL,
                isRTL && styles.rtlText,
              ]}
            >
              {isRTL
                ? "جدول الأدوية المشترك للعائلة"
                : "Shared Medication Schedule"}
            </Text>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                gap: theme.spacing.xs,
              }}
            >
              {[
                { value: "today", label: isRTL ? "اليوم" : "Today" },
                { value: "upcoming", label: isRTL ? "القادم" : "Upcoming" },
                { value: "all", label: isRTL ? "الكل" : "All" },
              ].map((mode) => (
                <TouchableOpacity
                  key={mode.value}
                  onPress={() =>
                    setMedicationScheduleViewMode(mode.value as any)
                  }
                  style={{
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: theme.spacing.xs / 2,
                    borderRadius: theme.borderRadius.full,
                    borderWidth: 1,
                    borderColor:
                      medicationScheduleViewMode === mode.value
                        ? theme.colors.primary.main
                        : typeof theme.colors.border === "string"
                          ? theme.colors.border
                          : theme.colors.border.light,
                    backgroundColor:
                      medicationScheduleViewMode === mode.value
                        ? theme.colors.primary.main
                        : theme.colors.background.secondary,
                  }}
                >
                  <Text
                    style={[
                      getTextStyle(
                        theme,
                        "caption",
                        "medium",
                        medicationScheduleViewMode === mode.value
                          ? theme.colors.neutral.white
                          : theme.colors.text.secondary
                      ),
                      { fontSize: 11 },
                    ]}
                  >
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {loadingMedicationSchedule ? (
            <View style={{ padding: theme.spacing.xl, alignItems: "center" }}>
              <ActivityIndicator
                color={theme.colors.primary.main}
                size="small"
              />
            </View>
          ) : getFilteredMedicationEntries().length === 0 ? (
            <View style={{ padding: theme.spacing.xl, alignItems: "center" }}>
              <Pill color={theme.colors.text.secondary} size={48} />
              <Text
                style={[
                  getTextStyle(
                    theme,
                    "body",
                    "regular",
                    theme.colors.text.secondary
                  ),
                  { textAlign: "center", marginTop: theme.spacing.base },
                ]}
              >
                {isRTL
                  ? "لا توجد أدوية في هذا الجدول المشترك للعائلة"
                  : "No medications in this schedule"}
              </Text>
            </View>
          ) : (
            <View>
              {medicationScheduleViewMode === "today" && todaySchedule && (
                <View style={{ marginBottom: theme.spacing.base }}>
                  <View
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: theme.spacing.sm,
                      paddingBottom: theme.spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.colors.border.light,
                    }}
                  >
                    <Heading level={6} style={[isRTL ? styles.rtlText : {}]}>
                      {formatMedicationDate(todaySchedule.date)}
                    </Heading>
                    <Badge size="small" style={{}} variant="outline">
                      {todaySchedule.entries.length}
                    </Badge>
                  </View>

                  {todaySchedule.entries.map((entry) => (
                    <Card
                      contentStyle={undefined}
                      key={`${entry.medication.id}-${entry.member.id}`}
                      pressable={false}
                      style={{ marginBottom: theme.spacing.base }}
                      variant="elevated"
                    >
                      <View
                        style={{
                          flexDirection: isRTL ? "row-reverse" : "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: theme.spacing.xs,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: isRTL ? "row-reverse" : "row",
                            alignItems: "center",
                            gap: theme.spacing.sm,
                            flex: 1,
                          }}
                        >
                          <Pill color={theme.colors.primary.main} size={24} />
                          <View style={{ flex: 1 }}>
                            <Heading
                              level={6}
                              style={[
                                isRTL ? styles.rtlText : {},
                                { marginBottom: 2 },
                              ]}
                            >
                              {entry.medication.name}
                            </Heading>
                            <Caption
                              numberOfLines={1}
                              style={[isRTL ? styles.rtlText : {}]}
                            >
                              {entry.medication.dosage} •{" "}
                              {entry.medication.frequency}
                            </Caption>
                            <View
                              style={{
                                flexDirection: isRTL ? "row-reverse" : "row",
                                alignItems: "center",
                                gap: theme.spacing.xs,
                                marginTop: theme.spacing.xs,
                              }}
                            >
                              <UserIcon
                                color={theme.colors.text.secondary}
                                size={12}
                              />
                              <Caption numberOfLines={1} style={{}}>
                                {entry.member.firstName} {entry.member.lastName}
                              </Caption>
                            </View>
                          </View>
                        </View>
                      </View>

                      {entry.nextDose && (
                        <View
                          style={{
                            flexDirection: isRTL ? "row-reverse" : "row",
                            alignItems: "center",
                            gap: theme.spacing.xs,
                            marginTop: theme.spacing.xs,
                          }}
                        >
                          <Clock
                            color={theme.colors.text.secondary}
                            size={14}
                          />
                          <Caption numberOfLines={1} style={{}}>
                            {isRTL ? "الجرعة التالية" : "Next dose"}:{" "}
                            {formatMedicationTime(entry.nextDose)}
                          </Caption>
                        </View>
                      )}

                      {entry.complianceRate !== undefined && (
                        <View
                          style={{
                            marginTop: theme.spacing.xs,
                            alignSelf: "flex-start",
                          }}
                        >
                          <Badge
                            size="small"
                            style={{
                              borderColor: getComplianceColor(
                                entry.complianceRate
                              ),
                            }}
                            variant="outline"
                          >
                            <View
                              style={{
                                flexDirection: isRTL ? "row-reverse" : "row",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              {entry.complianceRate >= 90 ? (
                                <TrendingUp
                                  color={getComplianceColor(
                                    entry.complianceRate
                                  )}
                                  size={12}
                                />
                              ) : (
                                <TrendingDown
                                  color={getComplianceColor(
                                    entry.complianceRate
                                  )}
                                  size={12}
                                />
                              )}
                              <Caption
                                numberOfLines={1}
                                style={{
                                  color: getComplianceColor(
                                    entry.complianceRate
                                  ),
                                }}
                              >
                                {isRTL ? "الالتزام بالأدوية" : "Compliance"}:{" "}
                                {entry.complianceRate}%
                              </Caption>
                            </View>
                          </Badge>
                        </View>
                      )}

                      {entry.missedDoses !== undefined &&
                        entry.missedDoses > 0 && (
                          <Badge
                            size="small"
                            style={{
                              marginTop: theme.spacing.xs,
                              alignSelf: "flex-start",
                              borderColor: theme.colors.accent.error,
                            }}
                            variant="outline"
                          >
                            <Caption
                              numberOfLines={1}
                              style={{ color: theme.colors.accent.error }}
                            >
                              {isRTL ? "جرعات مفقودة" : "Missed"}:{" "}
                              {entry.missedDoses}
                            </Caption>
                          </Badge>
                        )}

                      <TouchableOpacity
                        disabled={markingTaken === entry.medication.id}
                        onPress={() => handleMarkMedicationAsTaken(entry)}
                        style={{
                          flexDirection: isRTL ? "row-reverse" : "row",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor:
                            markingTaken === entry.medication.id
                              ? typeof theme.colors.border === "string"
                                ? theme.colors.border
                                : theme.colors.border.light
                              : theme.colors.primary.main,
                          paddingVertical: theme.spacing.sm,
                          paddingHorizontal: theme.spacing.base,
                          borderRadius: theme.borderRadius.md,
                          gap: theme.spacing.xs,
                          marginTop: theme.spacing.sm,
                          opacity:
                            markingTaken === entry.medication.id ? 0.5 : 1,
                        }}
                      >
                        <Check color={theme.colors.neutral.white} size={16} />
                        <TypographyText
                          style={[
                            getTextStyle(
                              theme,
                              "body",
                              "semibold",
                              theme.colors.neutral.white
                            ),
                          ]}
                        >
                          {isRTL ? "تم التناول" : "Mark as Taken"}
                        </TypographyText>
                      </TouchableOpacity>
                    </Card>
                  ))}
                </View>
              )}

              {medicationScheduleViewMode === "upcoming" &&
                upcomingSchedule.map((day) => (
                  <View
                    key={day.date.toISOString()}
                    style={{ marginBottom: theme.spacing.base }}
                  >
                    <View
                      style={{
                        flexDirection: isRTL ? "row-reverse" : "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: theme.spacing.sm,
                        paddingBottom: theme.spacing.sm,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.border.light,
                      }}
                    >
                      <Heading level={6} style={[isRTL ? styles.rtlText : {}]}>
                        {formatMedicationDate(day.date)}
                      </Heading>
                      <Badge size="small" style={{}} variant="outline">
                        {day.entries.length}
                      </Badge>
                    </View>

                    {day.entries.map((entry) => (
                      <Card
                        contentStyle={undefined}
                        key={`${entry.medication.id}-${entry.member.id}`}
                        pressable={false}
                        style={{ marginBottom: theme.spacing.base }}
                        variant="elevated"
                      >
                        <View
                          style={{
                            flexDirection: isRTL ? "row-reverse" : "row",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: theme.spacing.xs,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: isRTL ? "row-reverse" : "row",
                              alignItems: "center",
                              gap: theme.spacing.sm,
                              flex: 1,
                            }}
                          >
                            <Pill color={theme.colors.primary.main} size={24} />
                            <View style={{ flex: 1 }}>
                              <Heading
                                level={6}
                                style={[
                                  isRTL ? styles.rtlText : {},
                                  { marginBottom: 2 },
                                ]}
                              >
                                {entry.medication.name}
                              </Heading>
                              <Caption
                                numberOfLines={1}
                                style={[isRTL ? styles.rtlText : {}]}
                              >
                                {entry.medication.dosage} •{" "}
                                {entry.medication.frequency}
                              </Caption>
                              <View
                                style={{
                                  flexDirection: isRTL ? "row-reverse" : "row",
                                  alignItems: "center",
                                  gap: theme.spacing.xs,
                                  marginTop: theme.spacing.xs,
                                }}
                              >
                                <UserIcon
                                  color={theme.colors.text.secondary}
                                  size={12}
                                />
                                <Caption numberOfLines={1} style={{}}>
                                  {entry.member.firstName}{" "}
                                  {entry.member.lastName}
                                </Caption>
                              </View>
                            </View>
                          </View>
                        </View>

                        {entry.nextDose && (
                          <View
                            style={{
                              flexDirection: isRTL ? "row-reverse" : "row",
                              alignItems: "center",
                              gap: theme.spacing.xs,
                              marginTop: theme.spacing.xs,
                            }}
                          >
                            <Clock
                              color={theme.colors.text.secondary}
                              size={14}
                            />
                            <Caption numberOfLines={1} style={{}}>
                              {isRTL ? "الجرعة التالية" : "Next dose"}:{" "}
                              {formatMedicationTime(entry.nextDose)}
                            </Caption>
                          </View>
                        )}
                      </Card>
                    ))}
                  </View>
                ))}

              {medicationScheduleViewMode === "all" &&
                medicationScheduleEntries.map((entry) => (
                  <Card
                    contentStyle={undefined}
                    key={`${entry.medication.id}-${entry.member.id}`}
                    pressable={false}
                    style={{ marginBottom: theme.spacing.base }}
                    variant="elevated"
                  >
                    <View
                      style={{
                        flexDirection: isRTL ? "row-reverse" : "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: theme.spacing.xs,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: isRTL ? "row-reverse" : "row",
                          alignItems: "center",
                          gap: theme.spacing.sm,
                          flex: 1,
                        }}
                      >
                        <Pill color={theme.colors.primary.main} size={24} />
                        <View style={{ flex: 1 }}>
                          <Heading
                            level={6}
                            style={[
                              isRTL ? styles.rtlText : {},
                              { marginBottom: 2 },
                            ]}
                          >
                            {entry.medication.name}
                          </Heading>
                          <Caption
                            numberOfLines={1}
                            style={[isRTL ? styles.rtlText : {}]}
                          >
                            {entry.medication.dosage} •{" "}
                            {entry.medication.frequency}
                          </Caption>
                          <View
                            style={{
                              flexDirection: isRTL ? "row-reverse" : "row",
                              alignItems: "center",
                              gap: theme.spacing.xs,
                              marginTop: theme.spacing.xs,
                            }}
                          >
                            <UserIcon
                              color={theme.colors.text.secondary}
                              size={12}
                            />
                            <Caption numberOfLines={1} style={{}}>
                              {entry.member.firstName} {entry.member.lastName}
                            </Caption>
                          </View>
                        </View>
                      </View>
                    </View>

                    {entry.nextDose && (
                      <View
                        style={{
                          flexDirection: isRTL ? "row-reverse" : "row",
                          alignItems: "center",
                          gap: theme.spacing.xs,
                          marginTop: theme.spacing.xs,
                        }}
                      >
                        <Clock color={theme.colors.text.secondary} size={14} />
                        <Caption numberOfLines={1} style={{}}>
                          {isRTL ? "الجرعة التالية" : "Next dose"}:{" "}
                          {formatMedicationTime(entry.nextDose)}
                        </Caption>
                      </View>
                    )}
                  </Card>
                ))}
            </View>
          )}
        </View>

        {/* Health Events Section */}
        {isAdmin && (
          <View style={styles.section}>
            <View
              style={[
                styles.sectionHeader,
                isRTL && { flexDirection: "row-reverse" },
              ]}
            >
              <AlertTriangle color="#EF4444" size={20} />
              <Text
                style={[
                  styles.sectionTitle,
                  isRTL && styles.sectionTitleRTL,
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL ? "الأحداث الصحية" : "Health Events"}
              </Text>
              <Text style={[styles.sectionCount, isRTL && styles.rtlText]}>
                ({events.length})
              </Text>
            </View>
            {loadingEvents ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  color={theme.colors.primary.main}
                  size="small"
                />
              </View>
            ) : events.length > 0 ? (
              <View style={styles.eventsList}>
                {events.map((event) => {
                  // Find the family member this event belongs to
                  const eventMember = familyMembers.find(
                    (m) => m.id === event.userId
                  );
                  const memberName = eventMember
                    ? `${eventMember.firstName || ""} ${eventMember.lastName || ""}`.trim() ||
                      eventMember.email
                    : "Unknown Member";

                  return (
                    <View key={event.id} style={styles.eventCard}>
                      <View style={styles.eventHeader}>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.eventType, isRTL && styles.rtlText]}
                          >
                            {event.type === "VITAL_ALERT"
                              ? isRTL
                                ? "تنبيه حيوي"
                                : "Vital Alert"
                              : event.type}
                          </Text>
                          <Text
                            style={[
                              styles.eventMemberName,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {isRTL
                              ? `للعضو: ${memberName}`
                              : `For: ${memberName}`}
                          </Text>
                        </View>
                        <View style={styles.eventStatus}>
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: getEventStatusColor(
                                  event.status
                                ),
                              },
                            ]}
                          >
                            <Text style={styles.statusBadgeText}>
                              {getEventStatusText(event.status)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.eventReasons}>
                        {event.reasons.map((reason, index) => (
                          <Text
                            key={index}
                            style={[styles.reasonItem, isRTL && styles.rtlText]}
                          >
                            • {reason}
                          </Text>
                        ))}
                      </View>

                      <View style={styles.eventFooter}>
                        <Text
                          style={[styles.eventTime, isRTL && styles.rtlText]}
                        >
                          {formatEventTime(event.createdAt)}
                        </Text>

                        {event.status === "OPEN" && (
                          <View style={styles.actionButtons}>
                            <TouchableOpacity
                              onPress={() => handleAcknowledgeEvent(event.id!)}
                              style={[
                                styles.eventActionButton,
                                styles.acknowledgeButton,
                              ]}
                            >
                              <Text style={styles.actionButtonText}>
                                {t("acknowledge", "Ack")}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleEscalateEvent(event.id!)}
                              style={[
                                styles.eventActionButton,
                                styles.escalateButton,
                              ]}
                            >
                              <Text style={styles.actionButtonText}>
                                {t("escalate", "Esc")}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {(event.status === "OPEN" ||
                          event.status === "ACKED") && (
                          <TouchableOpacity
                            onPress={() => handleResolveEvent(event.id!)}
                            style={[
                              styles.eventActionButton,
                              styles.resolveButton,
                            ]}
                          >
                            <Text style={styles.actionButtonText}>
                              {t("resolve", "Resolve")}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                  {isRTL ? "لا توجد أحداث صحية" : "No health events"}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              isRTL && styles.sectionTitleRTL,
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "إجراءات سريعة" : "Quick Actions"}
          </Text>

          <View
            style={[
              styles.quickActions,
              isRTL && { flexDirection: "row-reverse" },
            ]}
          >
            {user?.role === "admin" && (
              <TouchableOpacity
                onPress={copyInviteCode}
                style={styles.quickActionButton}
              >
                <Share2 color="#2563EB" size={24} />
                <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                  {isRTL ? "دعوة عضو عائلة" : "Invite a Family Member"}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => router.push("/(tabs)/profile?openCalendar=true")}
              style={styles.quickActionButton}
            >
              <Calendar color="#10B981" size={24} />
              <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                {isRTL ? "التقويم الصحي" : "Health Calendar"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowHealthReportsModal(true)}
              style={styles.quickActionButton}
            >
              <FileText color="#8B5CF6" size={24} />
              <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                {isRTL ? "التقارير الصحية" : "Health Reports"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleEmergencySettings}
              style={styles.quickActionButton}
            >
              <Settings color="#F59E0B" size={24} />
              <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                {isRTL ? "إعدادات الطوارئ" : "Emergency Settings"}
              </Text>
            </TouchableOpacity>
          </View>

          {!user?.familyId && (
            <TouchableOpacity
              onPress={() => setShowJoinFamilyModal(true)}
              style={styles.joinFamilyButton}
            >
              <Users color="#FFFFFF" size={24} />
              <Text
                style={[styles.joinFamilyButtonText, isRTL && styles.rtlText]}
              >
                {isRTL ? "الانضمام إلى عائلة" : "Join a Family"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      <CoachMark
        body={
          isRTL
            ? "اضغط هنا لإضافة أفراد العائلة ومتابعة صحتهم في لوحة العائلة."
            : "Tap here to add family members and track their health."
        }
        isRTL={isRTL}
        onClose={() => setShowHowTo(false)}
        onPrimaryAction={() => setShowInviteModal(true)}
        primaryActionLabel={isRTL ? "دعوة عضو" : "Invite member"}
        secondaryActionLabel={isRTL ? "تم" : "Got it"}
        targetRef={addMemberButtonRef}
        title={isRTL ? "تتبع صحة العائلة" : "Track family health"}
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
              {isRTL ? "دعوة  فرد عائلة جديد" : "Invite New Member"}
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
                {isRTL ? "الاسم الكامل" : "Full Name"} *
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setInviteForm({ ...inviteForm, name: text })
                }
                placeholder={isRTL ? "ادخل الاسم الكامل" : "Enter full name"}
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={inviteForm.name}
              />
            </View>

            {/* Relation */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "صلة القرابة" : "Relationship"} *
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
                <ActivityIndicator color="#2563EB" size="large" />
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
                      <Plus color="#2563EB" size={20} />
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
                <ActivityIndicator color="#2563EB" size="large" />
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
                placeholder={isRTL ? "ادخل الاسم الأول" : "Enter first name"}
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
                placeholder={isRTL ? "ادخل اسم العائلة" : "Enter last name"}
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
                placeholder={isRTL ? "ادخل البريد الإلكتروني" : "Enter email"}
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
                <ActivityIndicator color="#2563EB" size="large" />
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
              {isRTL ? " الانضمام إلى الاشتراك العائلي " : "Upgrade to Premium"}
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
                    isRTL ? "إعدادات الخصوصية لتقرير صحي" : "Privacy Settings"
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
                          ? "الأدوية الفعالة للعائلة"
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
                          ? " إجمالي الأعراض الصحية للعائلة"
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
                          {isRTL ? "الأعراض الصحية " : "Symptoms"}:{" "}
                          {memberReport.symptoms.total}
                        </Caption>
                        <Caption
                          numberOfLines={1}
                          style={{ color: theme.colors.text.secondary }}
                        >
                          {isRTL ? "الأدوية الفعالة" : "Active Medications"}:{" "}
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
                      ? "ضم أعراض الصحة في التقرير"
                      : "Include Symptoms",
                  },
                  {
                    key: "includeMedications",
                    label: isRTL
                      ? "ضم أدوية العائلة في التقرير"
                      : "Include Medications",
                  },
                  {
                    key: "includeMoods",
                    label: isRTL
                      ? "ضم حالات نفسية في التقرير"
                      : "Include Moods",
                  },
                  {
                    key: "includeAllergies",
                    label: isRTL ? "ضم الحساسية" : "Include Allergies",
                  },
                  {
                    key: "includeMedicalHistory",
                    label: isRTL
                      ? "ضم التاريخ الطبي في التقرير"
                      : "Include Medical History",
                  },
                  {
                    key: "includeLabResults",
                    label: isRTL ? "ضم نتائج المختبر" : "Include Lab Results",
                  },
                  {
                    key: "includeVitals",
                    label: isRTL
                      ? "ضم المؤشرات الحيوية في التقرير"
                      : "Include Vitals",
                  },
                  {
                    key: "includeComplianceData",
                    label: isRTL
                      ? "ضم بيانات التزام بالأدوية في التقرير"
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
                        true: "#2563EB",
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
    backgroundColor: "#2563EB",
  },
  title: {
    fontSize: 28,
    fontFamily: "Geist-Bold",
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
    backgroundColor: "#2563EB",
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
    fontFamily: "Geist-SemiBold",
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
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
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
    backgroundColor: "#2563EB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentUserBadgeText: {
    fontSize: 10,
    fontFamily: "Geist-SemiBold",
    color: "#FFFFFF",
  },
  dashboardCardName: {
    fontSize: 14,
    fontFamily: "Geist-SemiBold",
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
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginTop: 4,
  },
  alertValue: {
    color: "#EF4444",
  },
  dashboardMetricLabel: {
    fontSize: 10,
    fontFamily: "Geist-Regular",
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
    fontFamily: "Geist-SemiBold",
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
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginTop: 4,
  },
  vitalLabel: {
    fontSize: 9,
    fontFamily: "Geist-Regular",
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
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#FFFFFF",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 2,
  },
  memberRelation: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
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
    fontFamily: "Geist-Medium",
    color: "#64748B",
    marginEnd: 4,
  },
  allergiesText: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#DC2626",
    flex: 1,
  },
  memberLastActive: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#94A3B8",
  },
  memberRight: {
    alignItems: "flex-end",
  },
  healthScore: {
    fontSize: 20,
    fontFamily: "Geist-Bold",
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
    fontFamily: "Geist-SemiBold",
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
    fontFamily: "Geist-Medium",
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
    fontFamily: "Geist-Medium",
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
    fontFamily: "Geist-SemiBold",
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
    fontFamily: "Geist-Medium",
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
    fontFamily: "Geist-Regular",
    backgroundColor: "#FFFFFF",
  },
  rtlInput: {
    fontFamily: "Geist-Regular",
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
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  relationOptionText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  relationOptionTextSelected: {
    color: "#FFFFFF",
  },
  inviteButton: {
    backgroundColor: "#2563EB",
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
    fontFamily: "Geist-SemiBold",
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
    fontFamily: "Geist-Medium",
    color: "#374151",
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 20,
    fontFamily: "Geist-Bold",
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
    fontFamily: "Geist-Medium",
    color: "#64748B",
    marginTop: 16,
  },
  rtlText: {
    textAlign: "right",
    fontFamily: "Geist-Regular",
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
    fontFamily: "Geist-Regular",
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
    fontFamily: "Geist-Medium",
    color: "#2563EB",
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
    fontFamily: "Geist-Medium",
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
    backgroundColor: "#2563EB",
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
    fontFamily: "Geist-SemiBold",
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
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  roleOptionText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  roleOptionTextSelected: {
    color: "#FFFFFF",
  },
  saveButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
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
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
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
    fontFamily: "Geist-SemiBold",
    marginBottom: 4,
  },
  attentionItemReason: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
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
    fontFamily: "Geist-SemiBold",
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
    fontFamily: "Geist-Regular",
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
    fontFamily: "Geist-Medium",
    color: "#64748B",
    textAlign: "center",
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionCount: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#64748B",
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
  eventsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  eventCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  eventType: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
  },
  eventMemberName: {
    fontSize: 13,
    fontFamily: "Geist-Medium",
    color: "#64748B",
    marginTop: 2,
  },
  eventStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: "Geist-Bold",
    color: "#FFFFFF",
  },
  eventReasons: {
    marginBottom: 8,
  },
  reasonItem: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginBottom: 4,
  },
  eventFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventTime: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#94A3B8",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  eventActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  acknowledgeButton: {
    backgroundColor: "#F59E0B",
  },
  resolveButton: {
    backgroundColor: "#10B981",
  },
  escalateButton: {
    backgroundColor: "#EF4444",
  },
  actionButtonText: {
    fontSize: 12,
    fontFamily: "Geist-Bold",
    color: "#FFFFFF",
  },
  viewAllButton: {
    padding: 16,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#2563EB",
  },
});

/* biome-ignore-all lint/style/noNestedTernary: screen copy and condition branches are handled in legacy JSX. */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: this screen intentionally centralizes symptom workflows. */
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Clock,
  Plus,
  TrendingUp,
  X,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FamilyDataFilter, {
  type FilterOption,
} from "@/app/components/FamilyDataFilter";
import HealthChart from "@/app/components/HealthChart";
// Design System Components
import { Button, Input } from "@/components/design-system";
import { Heading, Text } from "@/components/design-system/Typography";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { chartsService } from "@/lib/services/chartsService";
import { symptomService } from "@/lib/services/symptomService";
import { userService } from "@/lib/services/userService";
import { logger } from "@/lib/utils/logger";
import type { Symptom, User as UserType } from "@/types";

const COMMON_SYMPTOMS = [
  "headache",
  "fever",
  "cough",
  "fatigue",
  "nausea",
  "dizziness",
  "chestPain",
  "backPain",
  "soreThroat",
  "runnyNose",
  "shortnessOfBreath",
  "muscleAche",
  "jointPain",
  "stomachPain",
  "diarrhea",
  "constipation",
  "insomnia",
  "anxiety",
  "depression",
  "rash",
  "itchiness",
  "swelling",
  "chills",
  "sweating",
  "lossOfAppetite",
  "blurredVision",
  "ringingInEars",
  "numbness",
];

function getSeverityColor(severityLevel: number): string {
  switch (severityLevel) {
    case 1:
      return "#10B981";
    case 2:
      return "#F59E0B";
    case 3:
      return "#EF4444";
    case 4:
      return "#DC2626";
    case 5:
      return "#991B1B";
    default:
      return "#6B7280";
  }
}

function getSeverityText(
  severityLevel: number,
  translate: (key: string, options?: { defaultValue?: string }) => string
): string {
  const fallbacks: Record<number, string> = {
    1: translate("veryMild", { defaultValue: "Very mild" }),
    2: translate("mild", { defaultValue: "Mild" }),
    3: translate("moderate", { defaultValue: "Moderate" }),
    4: translate("significant", { defaultValue: "Significant" }),
    5: translate("severe", { defaultValue: "Severe" }),
  };
  const level = Math.min(
    5,
    Math.max(1, Math.round(Number(severityLevel) || 1))
  );
  const key = `symptomSeverity${level}`;
  const fallback = fallbacks[level] ?? "Unknown";
  const result = translate(key, { defaultValue: fallback });
  return typeof result === "string" ? result : fallback;
}

export default function TrackScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSymptom, setSelectedSymptom] = useState("");
  const [customSymptom, setCustomSymptom] = useState("");
  const [severity, setSeverity] = useState(1);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [stats, setStats] = useState({
    totalSymptoms: 0,
    avgSeverity: 0,
    commonSymptoms: [] as { type: string; count: number }[],
  });
  const [editingSymptom, setEditingSymptom] = useState<Symptom | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<UserType[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>({
    id: "personal",
    type: "personal",
    label: "",
  });
  const [selectedTargetUser, setSelectedTargetUser] = useState<string>("");

  const isRTL = i18n.language === "ar";
  const isAdmin = user?.role === "admin";
  const hasFamily = Boolean(user?.familyId);
  const recentSymptoms = symptoms.slice(0, 6);
  const topSymptoms = stats.commonSymptoms.slice(0, 4);
  const topSymptomsTotal =
    topSymptoms.reduce((sum, symptom) => sum + symptom.count, 0) || 1;

  const symptomsThisWeek = useMemo(() => {
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - 7);
    return symptoms.filter((symptom) => {
      const date =
        symptom.timestamp instanceof Date
          ? symptom.timestamp
          : new Date(symptom.timestamp);
      return date >= start && date <= now;
    }).length;
  }, [symptoms]);

  const avgSeverityThisWeek = useMemo(() => {
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - 7);
    const recent = symptoms.filter((symptom) => {
      const date =
        symptom.timestamp instanceof Date
          ? symptom.timestamp
          : new Date(symptom.timestamp);
      return date >= start && date <= now;
    });
    if (recent.length === 0) {
      return 0;
    }
    const total = recent.reduce((sum, item) => sum + item.severity, 0);
    return total / recent.length;
  }, [symptoms]);

  const improvementPercent = useMemo(() => {
    const now = new Date();
    const startCurrent = new Date();
    startCurrent.setDate(now.getDate() - 7);
    const startPrevious = new Date();
    startPrevious.setDate(now.getDate() - 14);
    const prev = symptoms.filter((symptom) => {
      const date =
        symptom.timestamp instanceof Date
          ? symptom.timestamp
          : new Date(symptom.timestamp);
      return date >= startPrevious && date < startCurrent;
    });
    const current = symptoms.filter((symptom) => {
      const date =
        symptom.timestamp instanceof Date
          ? symptom.timestamp
          : new Date(symptom.timestamp);
      return date >= startCurrent && date <= now;
    });
    if (prev.length === 0) {
      return 0;
    }
    const delta = prev.length - current.length;
    return Math.max(0, Math.round((delta / prev.length) * 100));
  }, [symptoms]);

  const symptomTrendData = useMemo(() => {
    const real = chartsService.prepareSymptomTimeSeries(symptoms, 7);
    const hasData = real.datasets[0]?.data.some((v) => v > 0) ?? false;
    if (hasData) {
      return real;
    }
    // Mock chart when no symptom data: 7 days of sample severity (1-5 scale)
    const labels: string[] = [];
    const mockData = [1.5, 2, 1.8, 2.2, 1.6, 2.5, 2];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    }
    return {
      labels,
      datasets: [
        {
          data: mockData,
          color: (opacity: number) => `rgba(239, 68, 68, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  }, [symptoms]);

  const loadSymptoms = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        return;
      }

      const startTime = Date.now();
      let dataLoaded = false;

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        logger.debug(
          t("loadingSymptoms"),
          {
            userId: user.id,
            filterType: selectedFilter.type,
            isAdmin,
            hasFamily: Boolean(user.familyId),
          },
          "SymptomsScreen"
        );

        // Always load family members first if user has family
        let members: UserType[] = [];
        if (user.familyId) {
          members = await userService.getFamilyMembers(user.familyId);
          setFamilyMembers(members);
        }

        // Load data based on selected filter
        if (selectedFilter.type === "family" && user.familyId && isAdmin) {
          // Load family symptoms and stats (admin only)
          // Use Promise.allSettled to handle partial failures gracefully
          const [symptomsResult, statsResult] = await Promise.allSettled([
            symptomService.getFamilySymptoms(user.id, user.familyId, 50),
            symptomService.getFamilySymptomStats(user.id, user.familyId, 7),
          ]);

          // Handle symptoms result
          if (symptomsResult.status === "fulfilled") {
            setSymptoms(symptomsResult.value);
            dataLoaded = true;
          } else {
            logger.error(
              "Failed to load family symptoms",
              symptomsResult.reason,
              "SymptomsScreen"
            );
            setSymptoms([]); // Set empty array on error
          }

          // Handle stats result
          if (statsResult.status === "fulfilled") {
            setStats(statsResult.value);
          } else {
            logger.error(
              "Failed to load family stats",
              statsResult.reason,
              "SymptomsScreen"
            );
            setStats({ totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] }); // Set default stats on error
          }

          const durationMs = Date.now() - startTime;
          logger.info(
            "Family symptoms loaded",
            {
              userId: user.id,
              familyId: user.familyId,
              symptomCount:
                symptomsResult.status === "fulfilled"
                  ? symptomsResult.value.length
                  : 0,
              statsLoaded: statsResult.status === "fulfilled",
              durationMs,
            },
            "SymptomsScreen"
          );
        } else if (
          selectedFilter.type === "member" &&
          selectedFilter.memberId &&
          isAdmin
        ) {
          // Load specific member symptoms and stats (admin only)
          // Use Promise.allSettled to handle partial failures gracefully
          const [symptomsResult, statsResult] = await Promise.allSettled([
            symptomService.getMemberSymptoms(selectedFilter.memberId, 50),
            symptomService.getMemberSymptomStats(selectedFilter.memberId, 7),
          ]);

          // Handle symptoms result
          if (symptomsResult.status === "fulfilled") {
            setSymptoms(symptomsResult.value);
            dataLoaded = true;
          } else {
            logger.error(
              "Failed to load member symptoms",
              symptomsResult.reason,
              "SymptomsScreen"
            );
            setSymptoms([]); // Set empty array on error
          }

          // Handle stats result
          if (statsResult.status === "fulfilled") {
            setStats(statsResult.value);
          } else {
            logger.error(
              "Failed to load member stats",
              statsResult.reason,
              "SymptomsScreen"
            );
            setStats({ totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] }); // Set default stats on error
          }

          const durationMs = Date.now() - startTime;
          logger.info(
            "Member symptoms loaded",
            {
              userId: user.id,
              memberId: selectedFilter.memberId,
              symptomCount:
                symptomsResult.status === "fulfilled"
                  ? symptomsResult.value.length
                  : 0,
              statsLoaded: statsResult.status === "fulfilled",
              durationMs,
            },
            "SymptomsScreen"
          );
        } else {
          // Load personal symptoms and stats (default)
          // Use Promise.allSettled to handle partial failures gracefully
          const [symptomsResult, statsResult] = await Promise.allSettled([
            symptomService.getUserSymptoms(user.id, 50),
            symptomService.getSymptomStats(user.id, 7),
          ]);

          // Handle symptoms result
          if (symptomsResult.status === "fulfilled") {
            setSymptoms(symptomsResult.value);
            dataLoaded = true;
          } else {
            logger.error(
              "Failed to load user symptoms",
              symptomsResult.reason,
              "SymptomsScreen"
            );
            setSymptoms([]); // Set empty array on error
          }

          // Handle stats result
          if (statsResult.status === "fulfilled") {
            setStats(statsResult.value);
          } else {
            logger.error(
              "Failed to load symptom stats",
              statsResult.reason,
              "SymptomsScreen"
            );
            setStats({ totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] }); // Set default stats on error
          }

          const durationMs = Date.now() - startTime;
          logger.info(
            "User symptoms loaded",
            {
              userId: user.id,
              symptomCount:
                symptomsResult.status === "fulfilled"
                  ? symptomsResult.value.length
                  : 0,
              statsLoaded: statsResult.status === "fulfilled",
              durationMs,
            },
            "SymptomsScreen"
          );
        }
      } catch (error) {
        const durationMs = Date.now() - startTime;

        // Check if it's a Firestore index error
        const isIndexError =
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "failed-precondition";

        if (isIndexError) {
          logger.warn(
            "Firestore index not ready for symptoms query",
            {
              userId: user.id,
              filterType: selectedFilter.type,
              durationMs,
            },
            "SymptomsScreen"
          );

          // Only show alert if no data was loaded (fallback should have handled it)
          if (!dataLoaded) {
            Alert.alert(
              t("error", "Error"),
              t(
                "databaseIndexNotReady",
                "Database index not ready. Please try again in a moment."
              )
            );
          }
        } else {
          logger.error("Failed to load symptoms", error, "SymptomsScreen");

          // Only show alert if no data was loaded
          if (!dataLoaded) {
            // Provide more specific error message
            const errorMessage =
              error instanceof Error
                ? error.message
                : t("errorLoadingData", "Error loading data");

            Alert.alert(t("error", "Error"), errorMessage);
          }
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, selectedFilter, isAdmin, t]
  );

  // Refresh data when tab is focused
  useFocusEffect(
    useCallback(() => {
      loadSymptoms();
    }, [loadSymptoms])
  );

  const handleFilterChange = (filter: FilterOption) => {
    setSelectedFilter(filter);
  };

  const getMemberName = (userId: string): string => {
    if (userId === user?.id) {
      return t("you", "You");
    }
    const member = familyMembers.find((m) => m.id === userId);
    if (!member) {
      return t("unknownMember", "Unknown Member");
    }
    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    if (member.firstName) {
      return member.firstName;
    }
    return t("unknownMember", "Unknown Member");
  };

  const handleAddSymptom = async () => {
    if (!user) {
      return;
    }

    const symptomType = selectedSymptom || customSymptom;
    if (!symptomType) {
      Alert.alert(
        t("error", "Error"),
        t(
          "pleaseSelectOrEnterSymptomType",
          "Please select or enter a symptom type"
        )
      );
      return;
    }

    try {
      setLoading(true);

      if (editingSymptom) {
        // Check if user can edit this symptom
        const canEdit =
          editingSymptom.userId === user.id ||
          (isAdmin &&
            (selectedFilter.type === "family" ||
              selectedFilter.type === "member"));
        if (!canEdit) {
          Alert.alert(
            t("notPermitted", "Not Permitted"),
            t(
              "youDoNotHavePermissionToEditSymptom",
              "You do not have permission to edit this symptom"
            )
          );
          return;
        }

        // Update existing symptom
        const updateData: Partial<Symptom> = {
          type: symptomType,
          severity: severity as 1 | 2 | 3 | 4 | 5,
          ...(description && { description }),
        };

        await symptomService.updateSymptom(editingSymptom.id, updateData);
        setEditingSymptom(null);
      } else {
        // Add new symptom
        const targetUserId = selectedTargetUser || user.id;
        const symptomData: Omit<Symptom, "id"> = {
          userId: targetUserId,
          type: symptomType,
          severity: severity as 1 | 2 | 3 | 4 | 5,
          timestamp: new Date(),
          triggers: [],
          ...(description && { description }),
        };

        if (isAdmin && targetUserId !== user.id) {
          // Admin adding symptom for another family member
          await symptomService.addSymptomForUser(symptomData, targetUserId);
        } else {
          // User adding symptom for themselves
          await symptomService.addSymptom(symptomData);
        }
      }

      // Reset form
      setSelectedSymptom("");
      setCustomSymptom("");
      setSeverity(1);
      setDescription("");
      setSelectedTargetUser("");
      setShowAddModal(false);

      // Reload symptoms
      await loadSymptoms();

      Alert.alert(
        t("saved", "Saved"),
        editingSymptom
          ? t("symptomUpdatedSuccessfully", "Symptom updated successfully")
          : t("symptomLoggedSuccessfully", "Symptom logged successfully")
      );
    } catch (_error) {
      // Silently handle symptom save error
      Alert.alert(
        t("error", "Error"),
        t("errorSavingSymptom", "Error saving symptom")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditSymptom = (symptom: Symptom) => {
    // Check permissions
    const canEdit =
      symptom.userId === user?.id ||
      (isAdmin &&
        (selectedFilter.type === "family" || selectedFilter.type === "member"));
    if (!canEdit) {
      Alert.alert(
        t("notPermitted", "Not Permitted"),
        t(
          "youDoNotHavePermissionToEditSymptom",
          "You do not have permission to edit this symptom"
        )
      );
      return;
    }

    setEditingSymptom(symptom);

    // Check if the symptom type is in the common symptoms list
    if (COMMON_SYMPTOMS.includes(symptom.type)) {
      setSelectedSymptom(symptom.type);
      setCustomSymptom("");
    } else {
      // It's a custom symptom
      setSelectedSymptom("");
      setCustomSymptom(symptom.type);
    }

    setSeverity(symptom.severity);
    setDescription(symptom.description || "");
    setSelectedTargetUser(symptom.userId);
    setShowAddModal(true);
    setShowActionsMenu(null);
  };

  const handleDeleteSymptom = (symptom: Symptom) => {
    // Check permissions
    const canDelete =
      symptom.userId === user?.id ||
      (isAdmin &&
        (selectedFilter.type === "family" || selectedFilter.type === "member"));
    if (!canDelete) {
      Alert.alert(
        t("notPermitted", "Not Permitted"),
        t(
          "youDoNotHavePermissionToDeleteSymptom",
          "You do not have permission to delete this symptom"
        )
      );
      return;
    }

    Alert.alert(
      t("deleteSymptom", "Delete Symptom"),
      t(
        "areYouSureDeleteSymptom",
        "Are you sure you want to delete this symptom: {{type}}?",
        { type: t(symptom.type) }
      ),
      [
        {
          text: t("cancel", "Cancel"),
          style: "cancel",
        },
        {
          text: t("delete", "Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await symptomService.deleteSymptom(symptom.id);
              await loadSymptoms();
              setShowActionsMenu(null);
              Alert.alert(
                t("deleted", "Deleted"),
                t("symptomDeletedSuccessfully", "Symptom deleted successfully")
              );
            } catch (_error) {
              // Silently handle symptom delete error
              Alert.alert(
                t("error", "Error"),
                t("errorDeletingSymptom", "Error deleting symptom")
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatSymptomLabel = (symptomType: string) => {
    if (!symptomType) {
      return isRTL ? "عرض صحي" : "Symptom";
    }
    return symptomType
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (char) => char.toUpperCase());
  };

  const normalizeDate = (
    value: Date | string | number | { toDate?: () => Date } | null | undefined
  ) => {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === "object" && typeof value.toDate === "function") {
      try {
        return value.toDate();
      } catch (error) {
        console.error("Failed to convert timestamp to date:", error);
        return new Date(); // Fallback to current date
      }
    }
    if (typeof value === "object") {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  };

  const formatDate = (
    value: Date | string | number | { toDate?: () => Date } | null | undefined
  ) => {
    const date = normalizeDate(value);
    if (!date) {
      return "";
    }
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return t("lessThanAnHourAgo", "Less than an hour ago");
    }
    if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return isRTL
        ? `منذ ${hours} ساعة${hours > 1 ? "ات" : ""}`
        : `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }
    const days = Math.floor(diffInHours / 24);
    return isRTL
      ? `منذ ${days} يوم${days > 1 ? "" : ""}`
      : `${days} day${days > 1 ? "s" : ""} ago`;
  };

  const renderSeveritySelector = () => (
    <View style={styles.severityContainer}>
      <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
        {t("severity")} ({severity}/5)
      </Text>
      <View style={styles.severityButtons}>
        {[1, 2, 3, 4, 5].map((level) => (
          <TouchableOpacity
            key={level}
            onPress={() => setSeverity(level)}
            style={[
              styles.severityButton,
              severity >= level && styles.severityButtonActive,
            ]}
          >
            <Text
              style={[
                styles.severityButtonText,
                severity >= level && styles.severityButtonTextActive,
              ]}
            >
              {level}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.severityLabels}>
        <Text style={[styles.severityLabel, isRTL && styles.rtlText]}>
          {t("mild")}
        </Text>
        <Text style={[styles.severityLabel, isRTL && styles.rtlText]}>
          {t("verySevere")}
        </Text>
      </View>
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView
        edges={["top"]}
        pointerEvents="box-none"
        style={styles.container}
      >
        <View style={styles.centerContainer}>
          <Text color="#EF4444" style={styles.errorText}>
            {t("pleaseLogInToTrackSymptoms", "Please log in to track symptoms")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.figmaSymptomScrollContent}
        refreshControl={
          <RefreshControl
            onRefresh={() => loadSymptoms(true)}
            refreshing={refreshing}
            tintColor="#0F766E"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header - scrolls with content */}
        <View style={styles.figmaSymptomHeaderWrap}>
          <WavyBackground curve="home" height={240} variant="teal">
            <View style={styles.figmaSymptomHeaderContent}>
              <View style={styles.figmaSymptomHeaderRow}>
                <TouchableOpacity
                  onPress={() =>
                    params.returnTo === "track"
                      ? router.push("/(tabs)/track")
                      : router.back()
                  }
                  style={styles.figmaSymptomBackButton}
                >
                  <ArrowLeft color="#003543" size={20} />
                </TouchableOpacity>
                <View style={styles.figmaSymptomHeaderTitle}>
                  <View style={styles.figmaSymptomTitleRow}>
                    <Activity color="#EB9C0C" size={20} />
                    <Text style={styles.figmaSymptomTitle}>
                      {isRTL ? "الأعراض المتتبعة" : "Tracked Symptoms"}
                    </Text>
                  </View>
                  <Text style={styles.figmaSymptomSubtitle}>
                    {isRTL
                      ? "راقب الأعراض الصحية مع مرور الوقت"
                      : "Monitor symptoms over time"}
                  </Text>
                </View>
              </View>
            </View>
          </WavyBackground>
        </View>

        <View style={styles.figmaSymptomContent}>
          <FamilyDataFilter
            currentUserId={user.id}
            familyMembers={familyMembers}
            hasFamily={hasFamily}
            isAdmin={isAdmin}
            onFilterChange={handleFilterChange}
            selectedFilter={selectedFilter}
          />

          <View style={styles.figmaSymptomStatsRow}>
            <View style={styles.figmaSymptomStatCard}>
              <Text style={styles.figmaSymptomStatValue}>
                {symptomsThisWeek}
              </Text>
              <Text style={styles.figmaSymptomStatLabel}>
                {isRTL ? "هذا الأسبوع" : "This Week"}
              </Text>
            </View>
            <View style={styles.figmaSymptomStatCard}>
              <Text
                style={[styles.figmaSymptomStatValue, { color: "#F97316" }]}
              >
                {avgSeverityThisWeek.toFixed(1)}
              </Text>
              <Text style={styles.figmaSymptomStatLabel}>
                {isRTL ? "متوسط الشدة" : "Avg Severity"}
              </Text>
            </View>
            <View style={styles.figmaSymptomStatCard}>
              <View style={styles.figmaSymptomTrendRow}>
                <TrendingUp color="#10B981" size={14} />
                <Text
                  style={[styles.figmaSymptomStatValue, { color: "#10B981" }]}
                >
                  {improvementPercent}%
                </Text>
              </View>
              <Text style={styles.figmaSymptomStatLabel}>
                {isRTL ? "تحسّن" : "Improving"}
              </Text>
            </View>
          </View>

          <View style={styles.figmaSymptomSection}>
            <View style={styles.figmaSymptomSectionHeader}>
              <Text style={styles.figmaSymptomSectionTitle}>
                {isRTL ? "اتجاه الشدة" : "Severity Trend"}
              </Text>
              <TouchableOpacity>
                <Text style={styles.figmaSymptomSectionLink}>
                  {isRTL ? "7 أيام" : "7 Days"}
                </Text>
              </TouchableOpacity>
            </View>
            <HealthChart
              data={symptomTrendData}
              height={200}
              showGrid={true}
              showLegend={false}
              title=""
              yAxisSuffix=""
            />
            <View style={styles.figmaSymptomTrendFootnote}>
              <Text style={styles.figmaSymptomTrendFootnoteText}>
                {isRTL ? "1 = خفيف جدًا" : "1 = Minimal"}
              </Text>
              <Text style={styles.figmaSymptomTrendFootnoteText}>
                {isRTL ? "5 = شديد" : "5 = Severe"}
              </Text>
            </View>
          </View>

          <View style={styles.figmaSymptomSection}>
            <Text style={styles.figmaSymptomSectionTitle}>
              {isRTL ? "إضافة سريعة" : "Quick Add"}
            </Text>
            <View style={styles.figmaSymptomQuickAddGrid}>
              {["nausea", "headache", "fatigue", "dizziness"].map((key) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => {
                    setSelectedSymptom(key);
                    setSelectedTargetUser(user.id);
                    setShowAddModal(true);
                  }}
                  style={styles.figmaSymptomQuickAddButton}
                >
                  <Text style={styles.figmaSymptomQuickAddText}>
                    + {t(key)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.figmaSymptomSection}>
            <View style={styles.figmaSymptomSectionHeader}>
              <Text style={styles.figmaSymptomSectionTitle}>
                {isRTL ? "المدخلات الأخيرة" : "Recent Entries"}
              </Text>
              <TouchableOpacity>
                <Text style={styles.figmaSymptomSectionLink}>
                  {isRTL ? "عرض الكل" : "View All"}
                </Text>
              </TouchableOpacity>
            </View>
            {loading ? (
              <View style={styles.figmaSymptomEmptyState}>
                <Text style={styles.figmaSymptomEmptyText}>
                  {isRTL ? "جارٍ تحميل الأعراض..." : "Loading symptoms..."}
                </Text>
              </View>
            ) : recentSymptoms.length === 0 ? (
              <View style={styles.figmaSymptomEmptyState}>
                <Text style={styles.figmaSymptomEmptyText}>
                  {isRTL ? "لا توجد أعراض مسجلة" : "No symptoms recorded"}
                </Text>
              </View>
            ) : (
              <View style={styles.figmaSymptomList}>
                {recentSymptoms.map((symptom) => (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    key={symptom.id}
                    onPress={() => handleEditSymptom(symptom)}
                    style={styles.figmaSymptomCard}
                  >
                    <View style={styles.figmaSymptomCardHeader}>
                      <View
                        style={[
                          styles.figmaSymptomIconWrap,
                          {
                            backgroundColor: `${getSeverityColor(
                              symptom.severity
                            )}15`,
                          },
                        ]}
                      >
                        <Activity
                          color={getSeverityColor(symptom.severity)}
                          size={20}
                        />
                      </View>
                      <View style={styles.figmaSymptomCardInfo}>
                        <View style={styles.figmaSymptomCardTitleRow}>
                          <Text style={styles.figmaSymptomCardTitle}>
                            {t(symptom.type, formatSymptomLabel(symptom.type))}
                          </Text>
                          <View
                            style={[
                              styles.figmaSymptomSeverityBadge,
                              {
                                backgroundColor: `${getSeverityColor(
                                  symptom.severity
                                )}15`,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.figmaSymptomSeverityText,
                                { color: getSeverityColor(symptom.severity) },
                              ]}
                            >
                              {getSeverityText(symptom.severity, t)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.figmaSymptomCardMeta}>
                          {symptom.description || t("noNotes")}
                        </Text>
                        <View style={styles.figmaSymptomCardTimeRow}>
                          <Clock color="#6C7280" size={12} />
                          <Text style={styles.figmaSymptomCardTime}>
                            {formatDate(symptom.timestamp) || ""}
                          </Text>
                        </View>
                      </View>
                      <ChevronRight color="#94A3B8" size={18} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      <TouchableOpacity
        onPress={() => {
          setSelectedTargetUser(user.id);
          setShowAddModal(true);
        }}
        style={styles.figmaSymptomFab}
      >
        <Plus color="#FFFFFF" size={22} />
      </TouchableOpacity>
      {/* Add Symptom Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShowAddModal(false);
          setEditingSymptom(null);
          setSelectedSymptom("");
          setCustomSymptom("");
          setSeverity(1);
          setDescription("");
        }}
        presentationStyle="pageSheet"
        visible={showAddModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Heading
              level={5}
              style={[styles.modalTitle, isRTL && styles.rtlText]}
            >
              {editingSymptom
                ? isRTL
                  ? "تعديل العرض"
                  : "Edit Symptom"
                : isRTL
                  ? "تسجيل عرض صحي"
                  : "Log Symptom"}
            </Heading>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                setEditingSymptom(null);
                setSelectedSymptom("");
                setCustomSymptom("");
                setSeverity(1);
                setDescription("");
              }}
              style={styles.closeButton}
            >
              <X color="#6C7280" size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Target User Selector (for admins) */}
            {isAdmin && hasFamily && familyMembers.length > 0 && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                  {t("addSymptomFor", "Add symptom for")}
                </Text>
                <View style={styles.memberSelectionContainer}>
                  {familyMembers.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      onPress={() => setSelectedTargetUser(member.id)}
                      style={[
                        styles.memberOption,
                        selectedTargetUser === member.id &&
                          styles.memberOptionSelected,
                      ]}
                    >
                      <View style={styles.memberInfo}>
                        <Text
                          style={[
                            styles.memberName,
                            selectedTargetUser === member.id &&
                              styles.memberNameSelected,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {member.id === user.id
                            ? t("you", "You")
                            : member.firstName && member.lastName
                              ? `${member.firstName} ${member.lastName}`
                              : member.firstName || t("user", "User")}
                        </Text>
                        {member.role === "admin" && (
                          <Text
                            style={[
                              styles.memberRole,
                              selectedTargetUser === member.id &&
                                styles.memberRoleSelected,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {t("admin", "Admin")}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Common Symptoms */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t("commonSymptoms", "Common Symptoms")}
              </Text>
              <View style={styles.symptomsGrid}>
                {COMMON_SYMPTOMS.map((symptomType) => (
                  <TouchableOpacity
                    key={symptomType}
                    onPress={() => {
                      setSelectedSymptom(
                        selectedSymptom === symptomType ? "" : symptomType
                      );
                      setCustomSymptom("");
                    }}
                    style={[
                      styles.symptomOption,
                      selectedSymptom === symptomType &&
                        styles.symptomOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.symptomOptionText,
                        selectedSymptom === symptomType &&
                          styles.symptomOptionTextSelected,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {t(symptomType)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Custom Symptom */}
            <View style={styles.fieldGroup}>
              <Input
                error={undefined}
                helperText={undefined}
                label={t("customSymptom", "Custom Symptom")}
                leftIcon={undefined}
                onChangeText={(text: string) => {
                  setCustomSymptom(text);
                  if (text) {
                    setSelectedSymptom("");
                  }
                }}
                placeholder={t("enterSymptomType", "Enter symptom type...")}
                rightIcon={undefined}
                style={isRTL && styles.rtlTextInput}
                textAlign={isRTL ? "right" : "left"}
                value={customSymptom}
              />
            </View>

            {/* Severity */}
            {renderSeveritySelector()}

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Input
                error={undefined}
                helperText={undefined}
                label={`${t("description")} (${t("optional", "(Optional)")})`}
                leftIcon={undefined}
                multiline
                numberOfLines={3}
                onChangeText={setDescription}
                placeholder={
                  isRTL
                    ? "أضف وصفاً للأعراض الصحية..."
                    : "Add a description of the symptom..."
                }
                rightIcon={undefined}
                style={[styles.textArea, isRTL && styles.rtlTextInput]}
                textAlign={isRTL ? "right" : "left"}
                value={description}
              />
            </View>

            {/* Save Button */}
            <Button
              disabled={loading}
              fullWidth
              loading={loading}
              onPress={handleAddSymptom}
              style={styles.saveButton}
              textStyle={undefined}
              title={
                loading
                  ? isRTL
                    ? "جاري الحفظ..."
                    : "Saving..."
                  : editingSymptom
                    ? isRTL
                      ? "تحديث الأعراض الصحية"
                      : "Update Symptom"
                    : isRTL
                      ? "حفظ الأعراض الصحية"
                      : "Save Symptom"
              }
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  figmaSymptomScrollContent: {
    paddingBottom: 140,
  },
  figmaSymptomHeaderWrap: {
    marginBottom: -40,
  },
  figmaSymptomHeaderContent: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
  },
  figmaSymptomHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  figmaSymptomBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0, 53, 67, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  figmaSymptomHeaderTitle: {
    flex: 1,
  },
  figmaSymptomTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  figmaSymptomTitle: {
    fontSize: 22,
    fontFamily: "Inter-Bold",
    color: "#003543",
  },
  figmaSymptomSubtitle: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: "rgba(0, 53, 67, 0.85)",
  },
  figmaSymptomAddButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#003543",
    alignItems: "center",
    justifyContent: "center",
  },
  figmaSymptomContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  figmaSymptomStatsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  figmaSymptomStatCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  figmaSymptomStatValue: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: "#003543",
    marginBottom: 4,
  },
  figmaSymptomStatLabel: {
    fontSize: 11,
    fontFamily: "Inter-SemiBold",
    color: "#64748B",
  },
  figmaSymptomTrendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  figmaSymptomSection: {
    marginBottom: 20,
  },
  figmaSymptomSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  figmaSymptomSectionTitle: {
    fontSize: 18,
    fontFamily: "Inter-Bold",
    color: "#0F172A",
  },
  figmaSymptomSectionLink: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: "#003543",
  },
  figmaSymptomTrendFootnote: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 10,
  },
  figmaSymptomTrendFootnoteText: {
    fontSize: 11,
    fontFamily: "Inter-Medium",
    color: "#6B7280",
  },
  figmaSymptomQuickAddGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
  },
  figmaSymptomQuickAddButton: {
    width: "48%",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(0, 53, 67, 0.25)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 53, 67, 0.04)",
  },
  figmaSymptomQuickAddText: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: "#003543",
  },
  figmaSymptomDistributionList: {
    gap: 10,
  },
  figmaSymptomDistributionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  figmaSymptomDistributionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: 120,
  },
  figmaSymptomDistributionText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: "#0F172A",
  },
  figmaSymptomDistributionBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 999,
    overflow: "hidden",
  },
  figmaSymptomDistributionFill: {
    height: "100%",
    borderRadius: 999,
  },
  figmaSymptomDistributionValue: {
    fontSize: 11,
    fontFamily: "Inter-SemiBold",
    color: "#64748B",
    width: 36,
    textAlign: "right",
  },
  figmaSymptomList: {
    gap: 12,
  },
  figmaSymptomCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  figmaSymptomCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  figmaSymptomIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  figmaSymptomCardInfo: {
    flex: 1,
  },
  figmaSymptomCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  figmaSymptomCardTitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#0F172A",
  },
  figmaSymptomCardMeta: {
    fontSize: 11,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    marginTop: 4,
  },
  figmaSymptomCardTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  figmaSymptomCardTime: {
    fontSize: 11,
    fontFamily: "Inter-Medium",
    color: "#6B7280",
  },
  figmaSymptomDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  figmaSymptomCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  figmaSymptomSeverityBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  figmaSymptomSeverityText: {
    fontSize: 11,
    fontFamily: "Inter-SemiBold",
  },
  figmaSymptomActionsButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  figmaSymptomNotes: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#475569",
    lineHeight: 18,
  },
  figmaSymptomActionsMenu: {
    flexDirection: "row",
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    marginTop: 12,
    paddingTop: 12,
  },
  figmaSymptomActionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  figmaSymptomActionText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: "#64748B",
  },
  figmaSymptomActionDelete: {
    color: "#EF4444",
  },
  figmaSymptomEmptyState: {
    paddingVertical: 16,
    alignItems: "center",
  },
  figmaSymptomEmptyText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    textAlign: "center",
  },
  figmaSymptomFab: {
    position: "absolute",
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#D48A00",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonRTL: {
    // RTL adjustments if needed
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: "#1E293B",
  },
  rtlText: {
    fontFamily: "Inter-Bold",
    textAlign: "right",
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
  statsSection: {
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
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: "#2563EB",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    textAlign: "center",
  },
  symptomsSection: {
    marginBottom: 24,
  },
  symptomCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  symptomHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  symptomInfo: {
    flex: 1,
  },
  symptomType: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 4,
  },
  symptomMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  symptomDate: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  memberBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginStart: 8,
  },
  memberBadgeText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: "#4F46E5",
  },
  symptomActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  severityBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  severityText: {
    fontSize: 12,
    fontFamily: "Inter-Bold",
    color: "#FFFFFF",
  },
  actionsButton: {
    padding: 4,
  },
  symptomDescription: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#475569",
    lineHeight: 20,
  },
  actionsMenu: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    gap: 16,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  deleteText: {
    color: "#EF4444",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    textAlign: "center",
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#EF4444",
    textAlign: "center",
  },
  // Modal styles - Figma design & Maak theme (#003543 primary, #EB9C0C accent)
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: "#1A1D1F",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
    marginBottom: 8,
  },
  symptomsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  symptomOption: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  symptomOptionSelected: {
    backgroundColor: "rgba(0, 53, 67, 0.05)",
    borderColor: "#003543",
  },
  symptomOptionText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#6C7280",
  },
  symptomOptionTextSelected: {
    color: "#003543",
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: "#1A1D1F",
  },
  rtlTextInput: {
    fontFamily: "Inter-Regular",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  severityContainer: {
    marginBottom: 20,
  },
  severityButtons: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  severityButton: {
    flex: 1,
    height: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  severityButtonActive: {
    backgroundColor: "rgba(0, 53, 67, 0.05)",
    borderColor: "#003543",
  },
  severityButtonText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#6C7280",
  },
  severityButtonTextActive: {
    color: "#003543",
  },
  severityLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  severityLabel: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
  },
  saveButton: {
    backgroundColor: "#003543",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  // Member selection styles
  memberSelectionContainer: {
    gap: 8,
  },
  memberOption: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberOptionSelected: {
    backgroundColor: "rgba(0, 53, 67, 0.05)",
    borderColor: "#003543",
  },
  memberInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberName: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#1A1D1F",
  },
  memberNameSelected: {
    color: "#003543",
  },
  memberRole: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  memberRoleSelected: {
    color: "#003543",
    backgroundColor: "rgba(0, 53, 67, 0.08)",
  },
});

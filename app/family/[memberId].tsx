import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Droplet,
  Flame,
  Footprints,
  Gauge,
  Heart,
  History,
  Info,
  Moon,
  Pill,
  Route,
  Ruler,
  Scale,
  ShieldAlert,
  Thermometer,
  Users,
  Waves,
  Wind,
  XCircle,
  Zap,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Avatar from "@/components/Avatar";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { alertService } from "@/lib/services/alertService";
import { allergyService } from "@/lib/services/allergyService";
import healthContextService from "@/lib/services/healthContextService";
import {
  healthDataService,
  type VitalSigns,
} from "@/lib/services/healthDataService";
import {
  healthInsightsService,
  type PatternInsight,
  type WeeklySummary,
} from "@/lib/services/healthInsightsService";
import { medicalHistoryService } from "@/lib/services/medicalHistoryService";
import { medicationService } from "@/lib/services/medicationService";
import { symptomService } from "@/lib/services/symptomService";
import { userService } from "@/lib/services/userService";
import type {
  Allergy,
  EmergencyAlert,
  MedicalHistory,
  Medication,
  Symptom,
  User,
} from "@/types";
import { coerceToDate } from "@/utils/dateCoercion";
import { safeFormatDate, safeFormatTime } from "@/utils/dateFormat";

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const getAlertSeverityColor = (
  severity: EmergencyAlert["severity"]
): string => {
  if (severity === "critical") {
    return "#EF4444";
  }
  if (severity === "high") {
    return "#F59E0B";
  }
  return "#2563EB";
};

const getHistorySeverityColor = (
  severity: MedicalHistory["severity"]
): string => {
  if (severity === "severe") {
    return "#EF4444";
  }
  if (severity === "moderate") {
    return "#F59E0B";
  }
  return "#10B981";
};

const getHistorySeverityLabel = (
  severity: MedicalHistory["severity"],
  isRTL: boolean
): string => {
  if (severity === "severe") {
    return isRTL ? "شديد" : "Severe";
  }
  if (severity === "moderate") {
    return isRTL ? "متوسط" : "Moderate";
  }
  return isRTL ? "خفيف" : "Mild";
};

const getAllergySeverityColor = (severity: Allergy["severity"]): string => {
  if (severity === "severe-life-threatening") {
    return "#7F1D1D";
  }
  if (severity === "severe") {
    return "#DC2626";
  }
  if (severity === "moderate") {
    return "#F59E0B";
  }
  return "#10B981";
};

const getAllergySeverityLabel = (
  severity: Allergy["severity"],
  isRTL: boolean
) => {
  if (severity === "severe-life-threatening") {
    return isRTL ? "خطير جداً" : "Life-threatening";
  }
  if (severity === "severe") {
    return isRTL ? "شديد" : "Severe";
  }
  if (severity === "moderate") {
    return isRTL ? "متوسط" : "Moderate";
  }
  return isRTL ? "خفيف" : "Mild";
};

const INSIGHTS_CACHE_TTL_MS = 5 * 60 * 1000;
const INSIGHTS_TIMEOUT_MS = 12_000;

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Insights request timed out"));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Large screen to be split into sections in a separate refactor. */
export default function FamilyMemberHealthView() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const router = useRouter();
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [member, setMember] = useState<User | null>(null);
  const [relationship, setRelationship] = useState<string>("");
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [vitals, setVitals] = useState<VitalSigns | null>(null);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [insightsSummary, setInsightsSummary] = useState<WeeklySummary | null>(
    null
  );
  const [insights, setInsights] = useState<PatternInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const insightsCacheRef = useRef<
    Record<
      string,
      {
        cachedAt: number;
        summary: WeeklySummary;
        insights: PatternInsight[];
      }
    >
  >({});

  const loadMemberHealthData = useCallback(
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Data loading flow will be extracted into dedicated hooks.
    async (isRefresh = false) => {
      if (!memberId) {
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        // Load member data
        const memberData = await userService.getUser(memberId);
        setMember(memberData);

        // Get relationship from user document (might be stored as relationship or relation)
        if (memberData) {
          const userDoc = await getDoc(doc(db, "users", memberId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const rel = userData.relationship || userData.relation || "";
            setRelationship(rel || "");
          } else {
            // Fallback to empty string - will show role in UI
            setRelationship("");
          }
        }

        // Load core health data only (insights are loaded separately to avoid blocking render)
        const [
          memberSymptomsResult,
          memberMedicalHistoryResult,
          memberMedicationsResult,
          memberAllergiesResult,
          memberAlertsResult,
          healthContextResult,
        ] = await Promise.allSettled([
          symptomService.getUserSymptoms(memberId, 30),
          medicalHistoryService.getUserMedicalHistory(memberId),
          medicationService.getUserMedications(memberId),
          allergyService.getUserAllergies(memberId),
          alertService.getActiveAlerts(memberId),
          healthContextService.getUserHealthContext(memberId),
        ]);

        const memberSymptoms =
          memberSymptomsResult.status === "fulfilled"
            ? memberSymptomsResult.value
            : [];
        const memberMedicalHistory =
          memberMedicalHistoryResult.status === "fulfilled"
            ? memberMedicalHistoryResult.value
            : [];
        const memberMedications =
          memberMedicationsResult.status === "fulfilled"
            ? memberMedicationsResult.value
            : [];
        const memberAllergies =
          memberAllergiesResult.status === "fulfilled"
            ? memberAllergiesResult.value
            : [];
        const memberAlerts =
          memberAlertsResult.status === "fulfilled"
            ? memberAlertsResult.value
            : [];
        const healthContext =
          healthContextResult.status === "fulfilled"
            ? healthContextResult.value
            : null;

        setSymptoms(memberSymptoms);
        setMedicalHistory(memberMedicalHistory);
        setMedications(memberMedications.filter((m) => m.isActive));
        setAllergies(memberAllergies);
        setAlerts(memberAlerts);

        // Extract vitals from health context, with fallback to healthDataService
        let loadedVitals: VitalSigns | null = null;

        if (healthContext?.vitalSigns) {
          const vs = healthContext.vitalSigns;
          loadedVitals = {
            heartRate: vs.heartRate,
            restingHeartRate: vs.restingHeartRate,
            walkingHeartRateAverage: vs.walkingHeartRateAverage,
            heartRateVariability: vs.heartRateVariability,
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
            respiratoryRate: vs.respiratoryRate,
            bodyTemperature: vs.temperature,
            oxygenSaturation: vs.oxygenLevel,
            bloodGlucose: vs.glucoseLevel,
            weight: vs.weight,
            height: vs.height,
            bodyFatPercentage: vs.bodyFatPercentage,
            steps: vs.steps,
            sleepHours: vs.sleepHours,
            activeEnergy: vs.activeEnergy,
            distanceWalkingRunning: vs.distanceWalkingRunning,
            waterIntake: vs.waterIntake,
            timestamp: vs.lastUpdated || new Date(),
          };
        }

        // Fallback: Try loading from healthDataService if healthContext didn't have vitals
        if (!loadedVitals || Object.keys(loadedVitals).length === 0) {
          try {
            const latestVitals =
              await healthDataService.getLatestVitalsFromFirestore(memberId);
            if (latestVitals) {
              loadedVitals = latestVitals;
            }
          } catch {
            // Silently fail - vitals might not be available
          }
        }

        setVitals(loadedVitals);
      } catch (_error) {
        // Silently handle error
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [memberId]
  );

  const loadMemberInsights = useCallback(
    async (forceRefresh = false) => {
      if (!memberId) {
        return;
      }

      const localeKey = isRTL ? "ar" : "en";
      const cacheKey = `${memberId}:${localeKey}`;
      const cached = insightsCacheRef.current[cacheKey];
      const isFreshCache =
        !!cached && Date.now() - cached.cachedAt < INSIGHTS_CACHE_TTL_MS;

      if (!forceRefresh && isFreshCache) {
        setInsightsSummary(cached.summary);
        setInsights(cached.insights);
        return;
      }

      try {
        setInsightsLoading(true);
        const summary = await withTimeout(
          healthInsightsService.getWeeklySummary(memberId, undefined, isRTL),
          INSIGHTS_TIMEOUT_MS
        );
        const topInsights = Array.isArray(summary.insights)
          ? summary.insights.slice(0, 4)
          : [];

        setInsightsSummary(summary);
        setInsights(topInsights);
        insightsCacheRef.current[cacheKey] = {
          cachedAt: Date.now(),
          summary,
          insights: topInsights,
        };
      } catch {
        if (!cached) {
          setInsightsSummary(null);
          setInsights([]);
        }
      } finally {
        setInsightsLoading(false);
      }
    },
    [memberId, isRTL]
  );

  useEffect(() => {
    loadMemberHealthData();
    loadMemberInsights();
  }, [loadMemberHealthData, loadMemberInsights]);

  const formatDate = (date: Date | string) =>
    safeFormatDate(date, isRTL ? "ar-u-ca-gregory" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatTime = (date: Date | string) =>
    safeFormatTime(date, isRTL ? "ar-u-ca-gregory" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const getSeverityColor = (severity: number) => {
    if (severity >= 4) {
      return "#EF4444";
    }
    if (severity >= 3) {
      return "#F59E0B";
    }
    return "#10B981";
  };

  const getSeverityLabel = (severity: number) => {
    if (severity >= 4) {
      return isRTL ? "شديد" : "Severe";
    }
    if (severity >= 3) {
      return isRTL ? "متوسط" : "Moderate";
    }
    return isRTL ? "خفيف" : "Mild";
  };

  const getInsightColor = (confidence: number) => {
    if (confidence >= 85) {
      return "#DC2626";
    }
    if (confidence >= 70) {
      return "#F59E0B";
    }
    return "#2563EB";
  };

  const getInsightIcon = (type: PatternInsight["type"]) => {
    if (type === "ml") {
      return <Gauge color="#7C3AED" size={16} />;
    }
    if (type === "trend") {
      return <Activity color="#2563EB" size={16} />;
    }
    if (type === "correlation") {
      return <Route color="#0EA5E9" size={16} />;
    }
    if (type === "temporal") {
      return <Calendar color="#14B8A6" size={16} />;
    }
    return <Info color="#64748B" size={16} />;
  };

  const changeMemberRole = async (
    targetUserId: string,
    newRole: "member" | "caregiver"
  ) => {
    if (!user?.id) {
      return;
    }

    try {
      await userService.updateUserRole(targetUserId, newRole, user.id);

      // Update local member state
      setMember((prev) => (prev ? { ...prev, role: newRole } : null));

      Alert.alert(
        isRTL ? "نجح" : "Success",
        isRTL
          ? "تم تحديث دور فردالعائلة بنجاح"
          : "Family member role updated successfully"
      );
    } catch (error: unknown) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        getErrorMessage(
          error,
          isRTL
            ? "فشل في تحديث دور فردالعائلة"
            : "Failed to update family member role"
        )
      );
    }
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Prompt flow will be replaced with a dedicated composer screen.
  const sendCaregiverAlert = () => {
    if (!(user?.id && member?.id)) {
      return;
    }

    const familyId = user.familyId;
    if (!familyId) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "لا توجد عائلة" : "No family"
      );
      return;
    }

    Alert.prompt(
      isRTL ? "إرسال تنبيه لمدير العائلة" : "Send Alert to Admin",
      isRTL
        ? "اكتب رسالة التنبيه لمدير العائلة:"
        : "Enter alert message for admin:",
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isRTL ? "إرسال" : "Send",
          /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Prompt callback will be extracted with prompt UI migration. */
          onPress: async (message?: string) => {
            if (!message?.trim()) {
              return;
            }

            try {
              await alertService.createCaregiverAlert(
                user.id,
                familyId,
                message.trim()
              );

              Alert.alert(
                isRTL ? "تم الإرسال" : "Sent",
                isRTL
                  ? "تم إرسال التنبيه لجميع مديري العائلة"
                  : "Alert sent to all admins"
              );
            } catch (error: unknown) {
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                getErrorMessage(
                  error,
                  isRTL
                    ? "فشل في إرسال التنبيه الصحي لمدير العائلة"
                    : "Failed to send alert to admin"
                )
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

  if (loading) {
    return (
      <GradientScreen
        edges={["top"]}
        pointerEvents="box-none"
        style={styles.container}
      >
        <View style={styles.figmaHeaderWrapper}>
          <WavyBackground curve="home" height={240} variant="teal">
            <View style={styles.figmaHeaderContent}>
              <View style={styles.figmaHeaderRow}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.figmaBackButton}
                >
                  <ArrowLeft color="#003543" size={20} />
                </TouchableOpacity>
                <View style={styles.figmaHeaderTitle}>
                  <Text style={styles.figmaHeaderTitleText}>
                    {isRTL ? "جاري التحميل..." : "Loading..."}
                  </Text>
                </View>
              </View>
            </View>
          </WavyBackground>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#0F766E" size="large" />
        </View>
      </GradientScreen>
    );
  }

  if (!member) {
    return (
      <GradientScreen
        edges={["top"]}
        pointerEvents="box-none"
        style={styles.container}
      >
        <View style={styles.figmaHeaderWrapper}>
          <WavyBackground curve="home" height={240} variant="teal">
            <View style={styles.figmaHeaderContent}>
              <View style={styles.figmaHeaderRow}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.figmaBackButton}
                >
                  <ArrowLeft color="#003543" size={20} />
                </TouchableOpacity>
                <View style={styles.figmaHeaderTitle}>
                  <Text style={styles.figmaHeaderTitleText}>
                    {isRTL ? "فرد العائلة غير موجود" : "Member Not Found"}
                  </Text>
                </View>
              </View>
            </View>
          </WavyBackground>
        </View>
      </GradientScreen>
    );
  }

  const memberName =
    member.firstName && member.lastName
      ? `${member.firstName} ${member.lastName}`
      : member.firstName || "User";

  // Map relationship keys to labels
  const RELATIONS = [
    { key: "father", labelEn: "Father", labelAr: "الأب" },
    { key: "mother", labelEn: "Mother", labelAr: "الأم" },
    { key: "spouse", labelEn: "Spouse", labelAr: "الزوج/الزوجة" },
    { key: "child", labelEn: "Child", labelAr: "الطفل" },
    { key: "sibling", labelEn: "Sibling", labelAr: "الأخ/الأخت" },
    { key: "grandparent", labelEn: "Grandparent", labelAr: "الجد/الجدة" },
    { key: "other", labelEn: "Other", labelAr: "آخر" },
  ];

  const getRelationshipLabel = (rel: string) => {
    if (!rel) {
      return "";
    }
    const relation = RELATIONS.find((r) => r.key === rel.toLowerCase());
    if (relation) {
      return isRTL ? relation.labelAr : relation.labelEn;
    }
    // If it's already a label, return as is
    return rel;
  };

  let displayRelationship = getRelationshipLabel(relationship);
  if (!displayRelationship) {
    if (member.role === "admin") {
      displayRelationship = isRTL ? "مدير العائلة" : "Admin";
    } else {
      displayRelationship = isRTL ? "فرد العائلة" : "Member";
    }
  }

  const recentSymptoms = symptoms
    .filter(
      (s) =>
        new Date(s.timestamp).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
    )
    .slice(0, 10);
  const predictiveInsight = insights.find(
    (insight) =>
      insight.type === "ml" && typeof insight.data?.riskScore === "number"
  );

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container}
    >
      <View style={styles.figmaHeaderWrapper}>
        <WavyBackground curve="home" height={240} variant="teal">
          <View style={styles.figmaHeaderContent}>
            <View style={styles.figmaHeaderRow}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.figmaBackButton}
              >
                <ArrowLeft color="#003543" size={20} />
              </TouchableOpacity>
              <View style={styles.figmaHeaderTitle}>
                <View style={styles.figmaHeaderTitleRow}>
                  <Users color="#EB9C0C" size={20} />
                  <Text style={styles.figmaHeaderTitleText}>{memberName}</Text>
                </View>
                <Text
                  style={[styles.figmaHeaderSubtitle, isRTL && styles.rtlText]}
                >
                  {isRTL ? "عرض الصحة الكامل" : "Full Health View"}
                </Text>
              </View>
            </View>
          </View>
        </WavyBackground>
      </View>

      <ScrollView
        contentContainerStyle={styles.figmaContent}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              loadMemberHealthData(true);
              loadMemberInsights(true);
            }}
            refreshing={refreshing}
            tintColor="#0F766E"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Member Info Card */}
        <View style={styles.memberCard}>
          <Avatar
            avatarType={member.avatarType}
            name={memberName}
            size="xl"
            source={member.avatar ? { uri: member.avatar } : undefined}
          />
          <Text style={[styles.memberName, isRTL && styles.rtlText]}>
            {memberName}
          </Text>
          <Text style={[styles.memberRelationship, isRTL && styles.rtlText]}>
            {displayRelationship}
          </Text>

          {/* Role Management for Admins */}
          {user?.role === "admin" && user?.id !== memberId && (
            <View style={styles.roleManagement}>
              <Text style={[styles.roleLabel, isRTL && styles.rtlText]}>
                {isRTL ? "الدور" : "Role"}
              </Text>
              <View style={styles.roleButtons}>
                <TouchableOpacity
                  onPress={() => changeMemberRole(memberId, "member")}
                  style={[
                    styles.roleButton,
                    member.role === "member" && styles.roleButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleButtonText,
                      member.role === "member" && styles.roleButtonTextActive,
                    ]}
                  >
                    {isRTL ? "فرد العائلة" : "Member"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => changeMemberRole(memberId, "caregiver")}
                  style={[
                    styles.roleButton,
                    member.role === "caregiver" && styles.roleButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleButtonText,
                      member.role === "caregiver" &&
                        styles.roleButtonTextActive,
                    ]}
                  >
                    {isRTL ? "مرافق صحي" : "Caregiver"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Caregiver Alert Button */}
          {user?.role === "caregiver" &&
            user?.familyId === member?.familyId && (
              <TouchableOpacity
                onPress={() => sendCaregiverAlert()}
                style={styles.caregiverAlertButton}
              >
                <AlertTriangle color="#FFFFFF" size={20} />
                <Text style={styles.caregiverAlertText}>
                  {isRTL ? "إرسال تنبيه لمدير العائلة" : "Send Alert to Admin"}
                </Text>
              </TouchableOpacity>
            )}
        </View>

        {/* Vitals Section - Always show, positioned prominently */}
        <View style={styles.section}>
          <View
            style={[
              styles.sectionHeader,
              isRTL && { flexDirection: "row-reverse" },
            ]}
          >
            <Gauge color="#2563EB" size={20} />
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {isRTL ? "العلامات الحيوية" : "Vital Signs"}
            </Text>
          </View>
          {vitals && Object.keys(vitals).length > 0 ? (
            <>
              <View style={styles.vitalsGrid}>
                {vitals.heartRate !== undefined && (
                  <View style={styles.vitalCard}>
                    <Heart color="#EF4444" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {Math.round(vitals.heartRate)}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      BPM
                    </Text>
                  </View>
                )}
                {vitals.restingHeartRate !== undefined && (
                  <View style={styles.vitalCard}>
                    <Heart color="#EC4899" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {Math.round(vitals.restingHeartRate)}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      {isRTL ? "استراحة" : "Resting"}
                    </Text>
                  </View>
                )}
                {vitals.walkingHeartRateAverage !== undefined && (
                  <View style={styles.vitalCard}>
                    <Footprints color="#F97316" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {Math.round(vitals.walkingHeartRateAverage)}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      {isRTL ? "مشي" : "Walking"}
                    </Text>
                  </View>
                )}
                {vitals.heartRateVariability !== undefined && (
                  <View style={styles.vitalCard}>
                    <Zap color="#A855F7" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {Math.round(vitals.heartRateVariability)}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      HRV
                    </Text>
                  </View>
                )}
                {vitals.bloodPressure ? (
                  <View style={styles.vitalCard}>
                    <Gauge color="#F59E0B" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {vitals.bloodPressure.systolic}/
                      {vitals.bloodPressure.diastolic}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      BP
                    </Text>
                  </View>
                ) : null}
                {vitals.respiratoryRate !== undefined && (
                  <View style={styles.vitalCard}>
                    <Wind color="#06B6D4" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {Math.round(vitals.respiratoryRate)}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      {isRTL ? "تنفس/د" : "Resp"}
                    </Text>
                  </View>
                )}
                {vitals.bodyTemperature !== undefined && (
                  <View style={styles.vitalCard}>
                    <Thermometer color="#EF4444" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {vitals.bodyTemperature.toFixed(1)}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      °C
                    </Text>
                  </View>
                )}
                {vitals.oxygenSaturation !== undefined && (
                  <View style={styles.vitalCard}>
                    <Droplet color="#3B82F6" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {Math.round(vitals.oxygenSaturation)}%
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      SpO2
                    </Text>
                  </View>
                )}
                {vitals.bloodGlucose !== undefined && (
                  <View style={styles.vitalCard}>
                    <Activity color="#10B981" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {vitals.bloodGlucose.toFixed(1)}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      {isRTL ? "جلوكوز" : "Glucose"}
                    </Text>
                  </View>
                )}
                {vitals.weight !== undefined && (
                  <View style={styles.vitalCard}>
                    <Scale color="#8B5CF6" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {vitals.weight.toFixed(1)}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      kg
                    </Text>
                  </View>
                )}
                {vitals.height !== undefined && (
                  <View style={styles.vitalCard}>
                    <Ruler color="#6366F1" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {vitals.height.toFixed(0)}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      cm
                    </Text>
                  </View>
                )}
                {vitals.bodyFatPercentage !== undefined && (
                  <View style={styles.vitalCard}>
                    <Activity color="#EC4899" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {vitals.bodyFatPercentage.toFixed(1)}%
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      {isRTL ? "دهون" : "Body Fat"}
                    </Text>
                  </View>
                )}
                {vitals.steps !== undefined && (
                  <View style={styles.vitalCard}>
                    <Footprints color="#22C55E" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {vitals.steps > 1000
                        ? `${(vitals.steps / 1000).toFixed(1)}k`
                        : vitals.steps}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      {isRTL ? "خطوات" : "Steps"}
                    </Text>
                  </View>
                )}
                {vitals.sleepHours !== undefined && (
                  <View style={styles.vitalCard}>
                    <Moon color="#6366F1" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {vitals.sleepHours.toFixed(1)}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      {isRTL ? "ساعات" : "hrs"}
                    </Text>
                  </View>
                )}
                {vitals.activeEnergy !== undefined && (
                  <View style={styles.vitalCard}>
                    <Flame color="#F97316" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {Math.round(vitals.activeEnergy)}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      kcal
                    </Text>
                  </View>
                )}
                {vitals.distanceWalkingRunning !== undefined && (
                  <View style={styles.vitalCard}>
                    <Route color="#14B8A6" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {vitals.distanceWalkingRunning.toFixed(1)}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      km
                    </Text>
                  </View>
                )}
                {vitals.waterIntake !== undefined && (
                  <View style={styles.vitalCard}>
                    <Waves color="#06B6D4" size={24} />
                    <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                      {vitals.waterIntake > 1000
                        ? `${(vitals.waterIntake / 1000).toFixed(1)}L`
                        : `${Math.round(vitals.waterIntake)}ml`}
                    </Text>
                    <Text style={[styles.vitalLabel, isRTL && styles.rtlText]}>
                      {isRTL ? "ماء" : "Water"}
                    </Text>
                  </View>
                )}
              </View>
              {vitals.timestamp ? (
                <Text style={[styles.vitalsTimestamp, isRTL && styles.rtlText]}>
                  {isRTL ? "آخر تحديث: " : "Last updated: "}
                  {formatDate(vitals.timestamp) || ""} •{" "}
                  {formatTime(vitals.timestamp) || ""}
                </Text>
              ) : null}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Gauge color="#94A3B8" size={32} />
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                {isRTL
                  ? "لا توجد بيانات العلامات الحيوية متاحة حالياً"
                  : "No vital signs data available at this time"}
              </Text>
            </View>
          )}
        </View>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <View style={styles.section}>
            <View
              style={[
                styles.sectionHeader,
                isRTL && { flexDirection: "row-reverse" },
              ]}
            >
              <AlertTriangle color="#EF4444" size={20} />
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                {isRTL ? "التنبيهات الصحية الفعالة" : "Active Alerts"}
              </Text>
            </View>
            <View style={styles.alertsList}>
              {alerts.map((alert) => (
                <View key={alert.id} style={styles.alertItem}>
                  <AlertTriangle
                    color={getAlertSeverityColor(alert.severity)}
                    size={18}
                  />
                  <View style={styles.alertContent}>
                    <Text
                      style={[styles.alertMessage, isRTL && styles.rtlText]}
                    >
                      {alert.message}
                    </Text>
                    <Text style={[styles.alertTime, isRTL && styles.rtlText]}>
                      {formatTime(alert.timestamp)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Health Insights Section */}
        <View style={styles.section}>
          <View
            style={[
              styles.sectionHeader,
              isRTL && { flexDirection: "row-reverse" },
            ]}
          >
            <Info color="#7C3AED" size={20} />
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {isRTL ? "الرؤى الصحية" : "Health Insights"}
            </Text>
            <Text style={[styles.sectionCount, isRTL && styles.rtlText]}>
              ({insights.length})
            </Text>
          </View>

          {insightsSummary ? (
            <View style={styles.insightSummaryCard}>
              <View style={styles.insightSummaryItem}>
                <Text style={styles.insightSummaryValue}>
                  {insightsSummary.medications.compliance}%
                </Text>
                <Text
                  style={[styles.insightSummaryLabel, isRTL && styles.rtlText]}
                >
                  {isRTL ? "الالتزام" : "Adherence"}
                </Text>
              </View>
              <View style={styles.insightSummaryItem}>
                <Text style={styles.insightSummaryValue}>
                  {insightsSummary.symptoms.total}
                </Text>
                <Text
                  style={[styles.insightSummaryLabel, isRTL && styles.rtlText]}
                >
                  {isRTL ? "الأعراض" : "Symptoms"}
                </Text>
              </View>
              <View style={styles.insightSummaryItem}>
                <Text style={styles.insightSummaryValue}>
                  {predictiveInsight?.data?.riskScore ?? "--"}
                </Text>
                <Text
                  style={[styles.insightSummaryLabel, isRTL && styles.rtlText]}
                >
                  {isRTL ? "مخاطر" : "Risk"}
                </Text>
              </View>
            </View>
          ) : null}

          {insightsLoading && insights.length === 0 ? (
            <View style={styles.insightsLoadingContainer}>
              <ActivityIndicator color="#7C3AED" size="small" />
              <Text
                style={[styles.insightsLoadingText, isRTL && styles.rtlText]}
              >
                {isRTL
                  ? "جارٍ تحليل الرؤى الصحية..."
                  : "Analyzing health insights..."}
              </Text>
            </View>
          ) : insights.length > 0 ? (
            <View style={styles.insightsList}>
              {insights.map((insight, index) => (
                <View
                  key={`${insight.type}-${index}`}
                  style={styles.insightItem}
                >
                  <View style={styles.insightHeader}>
                    <View style={styles.insightTitleRow}>
                      {getInsightIcon(insight.type)}
                      <Text
                        style={[styles.insightTitle, isRTL && styles.rtlText]}
                      >
                        {insight.title}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.insightConfidenceBadge,
                        { borderColor: getInsightColor(insight.confidence) },
                      ]}
                    >
                      <Text
                        style={[
                          styles.insightConfidenceText,
                          { color: getInsightColor(insight.confidence) },
                        ]}
                      >
                        {insight.confidence}%
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[styles.insightDescription, isRTL && styles.rtlText]}
                  >
                    {insight.description}
                  </Text>
                  {insight.recommendation ? (
                    <Text
                      style={[
                        styles.insightRecommendation,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL ? "التوصية: " : "Recommendation: "}
                      {insight.recommendation}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                {isRTL
                  ? "لا توجد رؤى كافية بعد. استمر في تسجيل المؤشرات والأعراض."
                  : "Not enough insights yet. Keep logging vitals and symptoms."}
              </Text>
            </View>
          )}
        </View>

        {/* Symptoms Section */}
        <View style={styles.section}>
          <View
            style={[
              styles.sectionHeader,
              isRTL && { flexDirection: "row-reverse" },
            ]}
          >
            <Activity color="#F59E0B" size={20} />
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {isRTL ? "الأعراض الصحية المراقبة" : "Tracked Symptoms"}
            </Text>
            <Text style={[styles.sectionCount, isRTL && styles.rtlText]}>
              ({recentSymptoms.length})
            </Text>
          </View>
          {recentSymptoms.length > 0 ? (
            <View style={styles.symptomsList}>
              {recentSymptoms.map((symptom) => (
                <View key={symptom.id} style={styles.symptomItem}>
                  <View
                    style={[
                      styles.severityIndicator,
                      { backgroundColor: getSeverityColor(symptom.severity) },
                    ]}
                  />
                  <View style={styles.symptomContent}>
                    <View style={styles.symptomHeader}>
                      <Text
                        style={[styles.symptomType, isRTL && styles.rtlText]}
                      >
                        {symptom.type}
                      </Text>
                      <View
                        style={[
                          styles.severityBadge,
                          {
                            backgroundColor: getSeverityColor(symptom.severity),
                          },
                        ]}
                      >
                        <Text style={styles.severityBadgeText}>
                          {getSeverityLabel(symptom.severity)}
                        </Text>
                      </View>
                    </View>
                    {Boolean(symptom.description) && (
                      <Text
                        style={[
                          styles.symptomDescription,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {symptom.description}
                      </Text>
                    )}
                    <Text style={[styles.symptomTime, isRTL && styles.rtlText]}>
                      {formatDate(symptom.timestamp) || ""} •{" "}
                      {formatTime(symptom.timestamp) || ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                {isRTL
                  ? "لا توجد أعراض صحية مسجلة مؤخراً"
                  : "No recent symptoms recorded"}
              </Text>
            </View>
          )}
        </View>

        {/* Medications Section */}
        <View style={styles.section}>
          <View
            style={[
              styles.sectionHeader,
              isRTL && { flexDirection: "row-reverse" },
            ]}
          >
            <Pill color="#2563EB" size={20} />
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {isRTL ? "الأدوية" : "Medications"}
            </Text>
            <Text style={[styles.sectionCount, isRTL && styles.rtlText]}>
              ({medications.length})
            </Text>
          </View>
          {medications.length > 0 ? (
            <View style={styles.medicationsList}>
              {medications.map((medication) => {
                const today = new Date().toDateString();
                const remindersToday = medication.reminders.filter(
                  (reminder) => {
                    if (!reminder.takenAt) {
                      return false;
                    }
                    return (
                      coerceToDate(reminder.takenAt)?.toDateString() === today
                    );
                  }
                );

                return (
                  <View key={medication.id} style={styles.medicationItem}>
                    <View style={styles.medicationHeader}>
                      <Text
                        style={[styles.medicationName, isRTL && styles.rtlText]}
                      >
                        {medication.name}
                      </Text>
                      <View style={styles.medicationStatus}>
                        {remindersToday.length > 0 ? (
                          <CheckCircle2 color="#10B981" size={18} />
                        ) : (
                          <XCircle color="#94A3B8" size={18} />
                        )}
                      </View>
                    </View>
                    <Text
                      style={[styles.medicationDosage, isRTL && styles.rtlText]}
                    >
                      {medication.dosage} - {medication.frequency}
                    </Text>
                    {medication.reminders.length > 0 && (
                      <View style={styles.remindersList}>
                        <Text
                          style={[
                            styles.remindersTitle,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {isRTL ? "جرعات اليوم" : "Today's Doses"}:
                        </Text>
                        {medication.reminders.map((reminder) => {
                          const isToday =
                            reminder.takenAt &&
                            coerceToDate(reminder.takenAt)?.toDateString() ===
                              today;
                          return (
                            <View key={reminder.id} style={styles.reminderItem}>
                              <Text
                                style={[
                                  styles.reminderTime,
                                  isRTL && styles.rtlText,
                                ]}
                              >
                                {reminder.time}
                              </Text>
                              {isToday ? (
                                <CheckCircle2 color="#10B981" size={16} />
                              ) : (
                                <XCircle color="#94A3B8" size={16} />
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                    {Boolean(medication.notes) && (
                      <Text
                        style={[
                          styles.medicationNotes,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {medication.notes}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                {isRTL ? "لا توجد أدوية فعالة" : "No active medications"}
              </Text>
            </View>
          )}
        </View>

        {/* Medical History Section */}
        <View style={styles.section}>
          <View
            style={[
              styles.sectionHeader,
              isRTL && { flexDirection: "row-reverse" },
            ]}
          >
            <History color="#8B5CF6" size={20} />
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {isRTL ? "التاريخ الطبي" : "Medical History"}
            </Text>
            <Text style={[styles.sectionCount, isRTL && styles.rtlText]}>
              ({medicalHistory.length})
            </Text>
          </View>
          {medicalHistory.length > 0 ? (
            <View style={styles.historyList}>
              {medicalHistory.map((history) => (
                <View key={history.id} style={styles.historyItem}>
                  <View style={styles.historyHeader}>
                    <Text
                      style={[styles.historyCondition, isRTL && styles.rtlText]}
                    >
                      {history.condition}
                    </Text>
                    {Boolean(history.severity) && (
                      <View
                        style={[
                          styles.severityBadge,
                          {
                            backgroundColor: getHistorySeverityColor(
                              history.severity
                            ),
                          },
                        ]}
                      >
                        <Text style={styles.severityBadgeText}>
                          {getHistorySeverityLabel(history.severity, isRTL)}
                        </Text>
                      </View>
                    )}
                  </View>
                  {history.diagnosedDate ? (
                    <View style={styles.historyDate}>
                      <Calendar color="#64748B" size={14} />
                      <Text
                        style={[
                          styles.historyDateText,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {isRTL ? "تم التشخيص: " : "Diagnosed: "}
                        {formatDate(history.diagnosedDate) || ""}
                      </Text>
                    </View>
                  ) : null}
                  {Boolean(history.notes) && (
                    <Text
                      style={[styles.historyNotes, isRTL && styles.rtlText]}
                    >
                      {history.notes}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                {isRTL
                  ? "لا يوجد تاريخ طبي مسجل"
                  : "No medical history recorded"}
              </Text>
            </View>
          )}
        </View>

        {/* Allergies Section */}
        <View style={styles.section}>
          <View
            style={[
              styles.sectionHeader,
              isRTL && { flexDirection: "row-reverse" },
            ]}
          >
            <ShieldAlert color="#DC2626" size={20} />
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {isRTL ? "الحساسية" : "Allergies"}
            </Text>
            <Text style={[styles.sectionCount, isRTL && styles.rtlText]}>
              ({allergies.length})
            </Text>
          </View>
          {allergies.length > 0 ? (
            <View style={styles.allergiesList}>
              {allergies.map((allergy) => (
                <View key={allergy.id} style={styles.allergyItem}>
                  <View style={styles.allergyHeader}>
                    <Text style={[styles.allergyName, isRTL && styles.rtlText]}>
                      {allergy.name}
                    </Text>
                    <View
                      style={[
                        styles.severityBadge,
                        {
                          backgroundColor: getAllergySeverityColor(
                            allergy.severity
                          ),
                        },
                      ]}
                    >
                      <Text style={styles.severityBadgeText}>
                        {getAllergySeverityLabel(allergy.severity, isRTL)}
                      </Text>
                    </View>
                  </View>
                  {Boolean(allergy.reaction) && (
                    <Text
                      style={[styles.allergyReaction, isRTL && styles.rtlText]}
                    >
                      {isRTL ? "رد الفعل: " : "Reaction: "}
                      {allergy.reaction}
                    </Text>
                  )}
                  {Boolean(allergy.notes) && (
                    <Text
                      style={[styles.allergyNotes, isRTL && styles.rtlText]}
                    >
                      {allergy.notes}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                {isRTL ? "لا توجد حساسية مسجلة" : "No allergies recorded"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  figmaHeaderWrapper: {
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: 12,
  },
  figmaHeaderContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  figmaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  figmaBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  figmaHeaderTitle: {
    flex: 1,
  },
  figmaHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  figmaHeaderTitleText: {
    fontSize: 22,
    fontFamily: "Inter-Bold",
    color: "#FFFFFF",
  },
  figmaHeaderSubtitle: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: "rgba(0, 53, 67, 0.85)",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  figmaContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  memberCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 24,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  memberName: {
    fontSize: 22,
    fontFamily: "Inter-Bold",
    color: "#1E293B",
    marginTop: 12,
    textAlign: "center",
  },
  memberRelationship: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },
  roleManagement: {
    marginTop: 16,
    alignItems: "center",
  },
  roleLabel: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#1E293B",
    marginBottom: 8,
  },
  roleButtons: {
    flexDirection: "row",
    gap: 8,
  },
  roleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  roleButtonActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  roleButtonText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  roleButtonTextActive: {
    color: "#FFFFFF",
  },
  caregiverAlertButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  caregiverAlertText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter-Bold",
    color: "#1A1D1F",
  },
  sectionCount: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  alertsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  alertItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertMessage: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#1E293B",
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#64748B",
  },
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignContent: "center",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  vitalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
    maxWidth: 120,
    flexBasis: "30%",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  vitalValue: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: "#1E293B",
    marginTop: 8,
  },
  vitalLabel: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginTop: 4,
  },
  vitalsTimestamp: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#94A3B8",
    textAlign: "center",
  },
  insightSummaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  insightSummaryItem: {
    flex: 1,
    alignItems: "center",
  },
  insightSummaryValue: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: "#1E293B",
  },
  insightSummaryLabel: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginTop: 4,
  },
  insightsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  insightItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  insightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  insightTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    flex: 1,
  },
  insightConfidenceBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  insightConfidenceText: {
    fontSize: 11,
    fontFamily: "Inter-SemiBold",
  },
  insightDescription: {
    fontSize: 13,
    fontFamily: "Inter-Regular",
    color: "#475569",
    marginTop: 8,
    lineHeight: 18,
  },
  insightRecommendation: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#334155",
    marginTop: 8,
  },
  insightsLoadingContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  insightsLoadingText: {
    fontSize: 13,
    fontFamily: "Inter-Regular",
    color: "#64748B",
  },
  symptomsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  symptomItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  severityIndicator: {
    width: 4,
    borderRadius: 2,
    marginEnd: 12,
  },
  symptomContent: {
    flex: 1,
  },
  symptomHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  symptomType: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  severityBadgeText: {
    fontSize: 10,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  symptomDescription: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginBottom: 4,
  },
  symptomTime: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#94A3B8",
  },
  medicationsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  medicationItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  medicationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  medicationName: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    flex: 1,
  },
  medicationStatus: {
    marginStart: 8,
  },
  medicationDosage: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginBottom: 8,
  },
  remindersList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  remindersTitle: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    marginBottom: 8,
  },
  reminderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  reminderTime: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#1E293B",
  },
  medicationNotes: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#94A3B8",
    marginTop: 8,
    fontStyle: "italic",
  },
  historyList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  historyItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  historyCondition: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    flex: 1,
  },
  historyDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  historyDateText: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#64748B",
  },
  historyNotes: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginTop: 4,
  },
  allergiesList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  allergyItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  allergyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  allergyName: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    flex: 1,
  },
  allergyReaction: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#DC2626",
    marginBottom: 4,
  },
  allergyNotes: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#94A3B8",
    marginTop: 4,
    fontStyle: "italic",
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#94A3B8",
    textAlign: "center",
  },
  rtlText: {
    fontFamily: "Inter-Regular",
  },
});

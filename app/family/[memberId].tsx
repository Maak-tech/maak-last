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
  Moon,
  Pill,
  Route,
  Ruler,
  Scale,
  ShieldAlert,
  Thermometer,
  Waves,
  Wind,
  XCircle,
  Zap,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { db } from "@/lib/firebase";
import { alertService } from "@/lib/services/alertService";
import { allergyService } from "@/lib/services/allergyService";
import healthContextService from "@/lib/services/healthContextService";
import type { VitalSigns } from "@/lib/services/healthDataService";
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

export default function FamilyMemberHealthView() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
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

  const loadMemberHealthData = useCallback(
    async (isRefresh = false) => {
      if (!memberId) return;

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

        // Load all health data in parallel
        const [
          memberSymptoms,
          memberMedicalHistory,
          memberMedications,
          memberAllergies,
          memberAlerts,
          healthContext,
        ] = await Promise.all([
          symptomService.getUserSymptoms(memberId),
          medicalHistoryService.getUserMedicalHistory(memberId),
          medicationService.getUserMedications(memberId),
          allergyService.getUserAllergies(memberId),
          alertService.getActiveAlerts(memberId),
          healthContextService.getUserHealthContext(memberId).catch(() => null),
        ]);

        setSymptoms(memberSymptoms);
        setMedicalHistory(memberMedicalHistory);
        setMedications(memberMedications.filter((m) => m.isActive));
        setAllergies(memberAllergies);
        setAlerts(memberAlerts);

        // Extract vitals from health context
        if (healthContext?.vitalSigns) {
          const vs = healthContext.vitalSigns;
          setVitals({
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
          });
        } else {
          setVitals(null);
        }
      } catch (error) {
        // Silently handle error
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [memberId]
  );

  useEffect(() => {
    loadMemberHealthData();
  }, [loadMemberHealthData]);

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat(isRTL ? "ar-u-ca-gregory" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat(isRTL ? "ar-u-ca-gregory" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 4) return "#EF4444";
    if (severity >= 3) return "#F59E0B";
    return "#10B981";
  };

  const getSeverityLabel = (severity: number) => {
    if (severity >= 4) return isRTL ? "شديد" : "Severe";
    if (severity >= 3) return isRTL ? "متوسط" : "Moderate";
    return isRTL ? "خفيف" : "Mild";
  };

  const changeMemberRole = async (
    targetUserId: string,
    newRole: "member" | "caregiver"
  ) => {
    if (!user?.id) return;

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
    } catch (error: any) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        error.message ||
          (isRTL
            ? "فشل في تحديث دور فردالعائلة"
            : "Failed to update family member role")
      );
    }
  };

  const sendCaregiverAlert = () => {
    if (!(user?.id && member?.id)) return;

    Alert.prompt(
      isRTL ? "إرسال تنبيه لمدير العائلة" : "Send Alert to Admin",
      isRTL
        ? "اكتب رسالة التنبيه لمدير العائلة:"
        : "Enter alert message for admin:",
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isRTL ? "إرسال" : "Send",
          onPress: async (message?: string) => {
            if (!message?.trim()) return;

            try {
              await alertService.createCaregiverAlert(
                user.id,
                user.familyId!,
                message.trim()
              );

              Alert.alert(
                isRTL ? "تم الإرسال" : "Sent",
                isRTL
                  ? "تم إرسال التنبيه لجميع مديري العائلة"
                  : "Alert sent to all admins"
              );
            } catch (error: any) {
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                error.message ||
                  (isRTL
                    ? "فشل في إرسال التنبيه الصحي لمدير العائلة"
                    : "Failed to send alert to admin")
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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft color="#FFFFFF" size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
            {isRTL ? "جاري التحميل..." : "Loading..."}
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#2563EB" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!member) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft color="#FFFFFF" size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
            {isRTL ? "فرد العائلة غير موجود" : "Member Not Found"}
          </Text>
        </View>
      </SafeAreaView>
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
    if (!rel) return "";
    const relation = RELATIONS.find((r) => r.key === rel.toLowerCase());
    if (relation) {
      return isRTL ? relation.labelAr : relation.labelEn;
    }
    // If it's already a label, return as is
    return rel;
  };

  const displayRelationship = relationship
    ? getRelationshipLabel(relationship)
    : member.role === "admin"
      ? isRTL
        ? "مدير العائلة"
        : "Admin"
      : isRTL
        ? "فرد العائلة"
        : "Member";

  const recentSymptoms = symptoms
    .filter(
      (s) =>
        new Date(s.timestamp).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
    )
    .slice(0, 10);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color="#FFFFFF" size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {isRTL ? "عرض الصحة الكامل" : "Full Health View"}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            onRefresh={() => loadMemberHealthData(true)}
            refreshing={refreshing}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.content}
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

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AlertTriangle color="#EF4444" size={20} />
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                {isRTL ? "التنبيهات الصحية الفعالة" : "Active Alerts"}
              </Text>
            </View>
            <View style={styles.alertsList}>
              {alerts.map((alert) => (
                <View key={alert.id} style={styles.alertItem}>
                  <AlertTriangle
                    color={
                      alert.severity === "critical"
                        ? "#EF4444"
                        : alert.severity === "high"
                          ? "#F59E0B"
                          : "#2563EB"
                    }
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

        {/* Vitals Section */}
        {vitals && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Gauge color="#2563EB" size={20} />
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                {isRTL ? "العلامات الحيوية" : "Vital Signs"}
              </Text>
            </View>
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
              {vitals.bloodPressure && (
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
              )}
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
            {vitals.timestamp && (
              <Text style={[styles.vitalsTimestamp, isRTL && styles.rtlText]}>
                {isRTL ? "آخر تحديث: " : "Last updated: "}
                {formatDate(vitals.timestamp)} {formatTime(vitals.timestamp)}
              </Text>
            )}
          </View>
        )}

        {/* Symptoms Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
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
                    {symptom.description && (
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
                      {formatDate(symptom.timestamp)}{" "}
                      {formatTime(symptom.timestamp)}
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
          <View style={styles.sectionHeader}>
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
                    if (!reminder.takenAt) return false;
                    const takenDate = new Date(reminder.takenAt).toDateString();
                    return takenDate === today;
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
                            new Date(reminder.takenAt).toDateString() === today;
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
                    {medication.notes && (
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
          <View style={styles.sectionHeader}>
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
                    {history.severity && (
                      <View
                        style={[
                          styles.severityBadge,
                          {
                            backgroundColor:
                              history.severity === "severe"
                                ? "#EF4444"
                                : history.severity === "moderate"
                                  ? "#F59E0B"
                                  : "#10B981",
                          },
                        ]}
                      >
                        <Text style={styles.severityBadgeText}>
                          {history.severity === "severe"
                            ? isRTL
                              ? "شديد"
                              : "Severe"
                            : history.severity === "moderate"
                              ? isRTL
                                ? "متوسط"
                                : "Moderate"
                              : isRTL
                                ? "خفيف"
                                : "Mild"}
                        </Text>
                      </View>
                    )}
                  </View>
                  {history.diagnosedDate && (
                    <View style={styles.historyDate}>
                      <Calendar color="#64748B" size={14} />
                      <Text
                        style={[
                          styles.historyDateText,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {isRTL ? "تم التشخيص: " : "Diagnosed: "}
                        {formatDate(history.diagnosedDate)}
                      </Text>
                    </View>
                  )}
                  {history.notes && (
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
          <View style={styles.sectionHeader}>
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
                          backgroundColor:
                            allergy.severity === "severe-life-threatening"
                              ? "#7F1D1D"
                              : allergy.severity === "severe"
                                ? "#DC2626"
                                : allergy.severity === "moderate"
                                  ? "#F59E0B"
                                  : "#10B981",
                        },
                      ]}
                    >
                      <Text style={styles.severityBadgeText}>
                        {allergy.severity === "severe-life-threatening"
                          ? isRTL
                            ? "خطير جداً"
                            : "Life-threatening"
                          : allergy.severity === "severe"
                            ? isRTL
                              ? "شديد"
                              : "Severe"
                            : allergy.severity === "moderate"
                              ? isRTL
                                ? "متوسط"
                                : "Moderate"
                              : isRTL
                                ? "خفيف"
                                : "Mild"}
                      </Text>
                    </View>
                  </View>
                  {allergy.reaction && (
                    <Text
                      style={[styles.allergyReaction, isRTL && styles.rtlText]}
                    >
                      {isRTL ? "رد الفعل: " : "Reaction: "}
                      {allergy.reaction}
                    </Text>
                  )}
                  {allergy.notes && (
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#2563EB",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Geist-SemiBold",
    color: "#FFFFFF",
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  memberCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  memberName: {
    fontSize: 22,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginTop: 12,
    textAlign: "center",
  },
  memberRelationship: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
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
    fontFamily: "Geist-Medium",
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
    fontFamily: "Geist-Medium",
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
    fontFamily: "Geist-SemiBold",
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
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
  },
  sectionCount: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  alertsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    fontFamily: "Geist-Medium",
    color: "#1E293B",
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
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
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
    maxWidth: 120,
    flexBasis: "30%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  vitalValue: {
    fontSize: 20,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginTop: 8,
  },
  vitalLabel: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginTop: 4,
  },
  vitalsTimestamp: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#94A3B8",
    textAlign: "center",
  },
  symptomsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    fontFamily: "Geist-SemiBold",
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
    fontFamily: "Geist-SemiBold",
    color: "#FFFFFF",
  },
  symptomDescription: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginBottom: 4,
  },
  symptomTime: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#94A3B8",
  },
  medicationsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    flex: 1,
  },
  medicationStatus: {
    marginStart: 8,
  },
  medicationDosage: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
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
    fontFamily: "Geist-Medium",
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
    fontFamily: "Geist-Regular",
    color: "#1E293B",
  },
  medicationNotes: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#94A3B8",
    marginTop: 8,
    fontStyle: "italic",
  },
  historyList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    fontFamily: "Geist-SemiBold",
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
    fontFamily: "Geist-Regular",
    color: "#64748B",
  },
  historyNotes: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginTop: 4,
  },
  allergiesList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    flex: 1,
  },
  allergyReaction: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#DC2626",
    marginBottom: 4,
  },
  allergyNotes: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#94A3B8",
    marginTop: 4,
    fontStyle: "italic",
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
  emptyText: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#94A3B8",
    textAlign: "center",
  },
  rtlText: {
    fontFamily: "Geist-Regular",
  },
});

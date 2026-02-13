/* biome-ignore-all lint/style/noNestedTernary: Legacy screen with dense conditional UI branches. */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Refactor will be done in a dedicated pass. */
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import {
  ArrowLeft,
  FileText,
  Heart,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { medicalHistoryService } from "@/lib/services/medicalHistoryService";
import { userService } from "@/lib/services/userService";
import type { MedicalHistory, User } from "@/types";
import { safeFormatDate } from "@/utils/dateFormat";

const SEVERITY_OPTIONS = [
  { key: "mild", labelEn: "Mild", labelAr: "خفيف" },
  { key: "moderate", labelEn: "Moderate", labelAr: "متوسط" },
  { key: "severe", labelEn: "Severe", labelAr: "شديد" },
];

const MEDICAL_HISTORY_EXAMPLES = [
  { en: "Diabetes", ar: "داء السكري" },
  { en: "Hypertension", ar: "ارتفاع ضغط الدم" },
  { en: "Asthma", ar: "الربو" },
  { en: "Heart Disease", ar: "أمراض القلب" },
  { en: "High Cholesterol", ar: "ارتفاع الكوليسترول" },
  { en: "Arthritis", ar: "التهاب المفاصل" },
  { en: "Migraine", ar: "الصداع النصفي" },
  { en: "Anemia", ar: "فقر الدم" },
  { en: "Thyroid Disorder", ar: "اضطراب الغدة الدرقية" },
  { en: "Kidney Disease", ar: "أمراض الكلى" },
  { en: "Liver Disease", ar: "أمراض الكبد" },
  { en: "Depression", ar: "الاكتئاب" },
  { en: "Anxiety", ar: "القلق" },
  { en: "Allergies", ar: "الحساسية" },
  { en: "Epilepsy", ar: "الصرع" },
  { en: "Osteoporosis", ar: "هشاشة العظام" },
  { en: "Sleep Apnea", ar: "انقطاع النفس أثناء النوم" },
  { en: "Chronic Pain", ar: "الألم المزمن" },
];

export default function MedicalHistoryScreen() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ returnTo?: string }>();

  // Hide the default header to prevent duplicate headers
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const [loading, setLoading] = useState(true);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory[]>([]);
  const [_summary, setSummary] = useState<unknown>(null);
  const [activeTab, setActiveTab] = useState<
    "conditions" | "surgeries" | "vaccinations" | "family"
  >("conditions");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newCondition, setNewCondition] = useState({
    condition: "",
    severity: "mild" as "mild" | "moderate" | "severe",
    diagnosedDate: new Date(),
    notes: "",
    isFamily: false,
    relation: "",
    familyMemberId: "",
  });
  const [familyMembers, setFamilyMembers] = useState<User[]>([]);
  const [loadingFamilyMembers, setLoadingFamilyMembers] = useState(false);

  const isRTL = i18n.language === "ar";

  // Helper function to translate condition based on current language
  const translateCondition = (condition: string): string => {
    if (!condition) {
      return condition;
    }

    // Find the condition in examples
    const example = MEDICAL_HISTORY_EXAMPLES.find(
      (ex) => ex.en === condition || ex.ar === condition
    );

    if (example) {
      // Return the appropriate language version
      return isRTL ? example.ar : example.en;
    }

    // If not found in examples, return as-is (custom condition)
    return condition;
  };

  const loadMedicalHistory = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      setLoading(true);
      const [history, summaryData] = await Promise.all([
        medicalHistoryService.getUserMedicalHistory(user.id),
        medicalHistoryService.getMedicalHistorySummary(user.id),
      ]);

      setMedicalHistory(history);
      setSummary(summaryData);
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "حدث خطأ أثناء تحميل التاريخ الطبي"
          : "An error occurred while loading medical history"
      );
    } finally {
      setLoading(false);
    }
  }, [isRTL, user?.id]);

  const personalHistory = medicalHistory.filter((h) => !h.isFamily);
  const familyHistory = medicalHistory.filter((h) => h.isFamily);
  const surgeryHistory = personalHistory.filter((h) =>
    h.tags?.includes("surgery")
  );
  const vaccinationHistory = personalHistory.filter((h) =>
    h.tags?.includes("vaccination")
  );
  const conditionHistory = personalHistory.filter(
    (h) => !(h.tags?.includes("surgery") || h.tags?.includes("vaccination"))
  );

  const loadFamilyMembers = useCallback(async () => {
    if (!user?.familyId) {
      return;
    }

    try {
      setLoadingFamilyMembers(true);
      const members = await userService.getFamilyMembers(user.familyId);
      setFamilyMembers(members.filter((m) => m.id !== user.id)); // Exclude current user
    } catch (_error) {
      // Silently handle error
    } finally {
      setLoadingFamilyMembers(false);
    }
  }, [user?.familyId, user?.id]);

  useEffect(() => {
    loadMedicalHistory();
  }, [loadMedicalHistory]);

  useEffect(() => {
    if (showAddModal && user?.familyId) {
      loadFamilyMembers();
    }
  }, [loadFamilyMembers, showAddModal, user?.familyId]);

  const handleAddCondition = async () => {
    if (!newCondition.condition.trim()) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "يرجى إدخال اسم الحالة الطبية"
          : "Please enter the medical condition"
      );
      return;
    }

    if (!user?.id) {
      return;
    }

    if (newCondition.isFamily && !newCondition.familyMemberId) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى اختيار عضو العائلة" : "Please select a family member"
      );
      return;
    }

    setAddLoading(true);
    try {
      const selectedMember = familyMembers.find(
        (m) => m.id === newCondition.familyMemberId
      );

      // Construct member name from firstName and lastName
      let memberName: string | undefined;
      if (selectedMember) {
        if (selectedMember.firstName && selectedMember.lastName) {
          memberName = `${selectedMember.firstName} ${selectedMember.lastName}`;
        } else {
          memberName = selectedMember.firstName || "Unknown Member";
        }
      }

      const medicalData: Omit<MedicalHistory, "id" | "userId"> = {
        condition: newCondition.condition.trim(),
        severity: newCondition.severity,
        diagnosedDate: newCondition.diagnosedDate,
        notes: newCondition.notes.trim() || undefined,
        isFamily: newCondition.isFamily,
        relation: newCondition.isFamily ? newCondition.relation : undefined,
        familyMemberId:
          newCondition.isFamily && newCondition.familyMemberId
            ? newCondition.familyMemberId
            : undefined,
        familyMemberName: newCondition.isFamily ? memberName : undefined,
      };

      await medicalHistoryService.addMedicalHistory(user.id, medicalData);

      // Reset form
      setNewCondition({
        condition: "",
        severity: "mild",
        diagnosedDate: new Date(),
        notes: "",
        isFamily: false,
        relation: "",
        familyMemberId: "",
      });

      setShowAddModal(false);
      await loadMedicalHistory();

      Alert.alert(
        isRTL ? "تم الحفظ" : "Saved",
        isRTL
          ? "تم إضافة السجل الطبي بنجاح"
          : "Medical record added successfully"
      );
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "حدث خطأ في إضافة السجل الطبي" : "Failed to add medical record"
      );
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteCondition = (id: string) => {
    Alert.alert(
      isRTL ? "حذف السجل" : "Delete Record",
      isRTL
        ? "هل أنت متأكد من حذف هذا السجل الطبي؟"
        : "Are you sure you want to delete this medical record?",
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
              await medicalHistoryService.deleteMedicalHistory(id);
              await loadMedicalHistory();
              Alert.alert(
                isRTL ? "تم الحذف" : "Deleted",
                isRTL
                  ? "تم حذف السجل الطبي بنجاح"
                  : "Medical record deleted successfully"
              );
            } catch (_error) {
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL
                  ? "حدث خطأ في حذف السجل الطبي"
                  : "Failed to delete medical record"
              );
            }
          },
        },
      ]
    );
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case "mild":
        return "#10B981";
      case "moderate":
        return "#F59E0B";
      case "severe":
        return "#EF4444";
      default:
        return "#64748B";
    }
  };

  const getSeverityText = (severity?: string) => {
    const severityMap = {
      mild: isRTL ? "خفيف" : "Mild",
      moderate: isRTL ? "متوسط" : "Moderate",
      severe: isRTL ? "شديد" : "Severe",
    };
    return severityMap[severity as keyof typeof severityMap] || severity;
  };

  const getFamilyRelationText = (record: MedicalHistory): string => {
    if (record.familyMemberName) {
      return isRTL
        ? `لـ ${record.familyMemberName}`
        : `for ${record.familyMemberName}`;
    }

    if (record.relation) {
      return isRTL ? `للـ ${record.relation}` : `for ${record.relation}`;
    }

    return isRTL ? "عائلي" : "Family";
  };

  let saveButtonLabel = isRTL ? "حفظ السجل" : "Save Record";
  if (addLoading) {
    saveButtonLabel = isRTL ? "جاري الحفظ..." : "Saving...";
  }

  return (
    <GradientScreen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.figmaScrollView}
      >
        <View style={styles.figmaHeaderWrapper}>
          <WavyBackground curve="home" height={220} variant="teal">
            <View style={styles.figmaHeader}>
              <TouchableOpacity
                onPress={() => {
                  try {
                    if (params.returnTo === "track") {
                      router.push("/(tabs)/track");
                    } else if (router.canGoBack?.()) {
                      router.back();
                    } else {
                      router.push("/(tabs)/profile");
                    }
                  } catch (_error) {
                    router.push("/(tabs)/profile");
                  }
                }}
                style={styles.figmaBackButton}
              >
                <ArrowLeft
                  color="#003543"
                  size={20}
                  style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
                />
              </TouchableOpacity>
              <View style={styles.figmaHeaderText}>
                <View style={styles.figmaHeaderTitleRow}>
                  <FileText color="#EB9C0C" size={24} />
                  <Text style={styles.figmaHeaderTitle}>Medical History</Text>
                </View>
                <Text style={styles.figmaHeaderSubtitle}>
                  Complete health record
                </Text>
              </View>
            </View>
          </WavyBackground>
        </View>

        <View style={styles.figmaContent}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#003543" size="large" />
              <Text
                style={[styles.loadingText, isRTL && { textAlign: "left" }]}
              >
                {isRTL
                  ? "جاري تحميل السجل الطبي..."
                  : "Loading medical history..."}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.figmaTabs}>
                {[
                  { id: "conditions", label: "Conditions" },
                  { id: "surgeries", label: "Surgeries" },
                  { id: "vaccinations", label: "Vaccines" },
                  { id: "family", label: "Family" },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() =>
                      setActiveTab(
                        tab.id as
                          | "conditions"
                          | "surgeries"
                          | "vaccinations"
                          | "family"
                      )
                    }
                    style={[
                      styles.figmaTabButton,
                      activeTab === tab.id && styles.figmaTabButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.figmaTabText,
                        activeTab === tab.id && styles.figmaTabTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {activeTab === "conditions" && (
                <View style={styles.figmaSection}>
                  <Text style={styles.figmaSectionTitle}>
                    Chronic Conditions
                  </Text>
                  {conditionHistory.length === 0 ? (
                    <Text style={styles.figmaEmptyText}>
                      No conditions recorded yet.
                    </Text>
                  ) : (
                    conditionHistory.map((record) => (
                      <View key={record.id} style={styles.figmaCard}>
                        <View style={styles.figmaCardIcon}>
                          <Heart
                            color={getSeverityColor(record.severity)}
                            size={22}
                          />
                        </View>
                        <View style={styles.figmaCardBody}>
                          <View style={styles.figmaCardHeader}>
                            <Text style={styles.figmaCardTitle}>
                              {translateCondition(record.condition)}
                            </Text>
                            <View
                              style={[
                                styles.figmaBadge,
                                {
                                  backgroundColor: `${getSeverityColor(record.severity)}20`,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.figmaBadgeText,
                                  { color: getSeverityColor(record.severity) },
                                ]}
                              >
                                {getSeverityText(record.severity)}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.figmaCardMeta}>
                            Diagnosed:{" "}
                            {record.diagnosedDate
                              ? safeFormatDate(
                                  new Date(record.diagnosedDate),
                                  isRTL ? "ar-u-ca-gregory" : "en-US"
                                )
                              : "Unknown"}
                          </Text>
                          {record.notes ? (
                            <Text style={styles.figmaCardMeta}>
                              {record.notes}
                            </Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeleteCondition(record.id)}
                          style={styles.figmaDeleteButton}
                        >
                          <Trash2 color="#EF4444" size={16} />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}

              {activeTab === "surgeries" && (
                <View style={styles.figmaSection}>
                  <Text style={styles.figmaSectionTitle}>Surgical History</Text>
                  {surgeryHistory.length === 0 ? (
                    <Text style={styles.figmaEmptyText}>
                      No surgeries recorded yet.
                    </Text>
                  ) : (
                    surgeryHistory.map((record) => (
                      <View key={record.id} style={styles.figmaCard}>
                        <View style={styles.figmaCardIconAlt}>
                          <FileText color="#6366F1" size={22} />
                        </View>
                        <View style={styles.figmaCardBody}>
                          <Text style={styles.figmaCardTitle}>
                            {translateCondition(record.condition)}
                          </Text>
                          <Text style={styles.figmaCardMeta}>
                            {record.diagnosedDate
                              ? safeFormatDate(
                                  new Date(record.diagnosedDate),
                                  isRTL ? "ar-u-ca-gregory" : "en-US"
                                )
                              : "Unknown date"}
                          </Text>
                          {record.notes ? (
                            <Text style={styles.figmaCardMeta}>
                              {record.notes}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {activeTab === "vaccinations" && (
                <View style={styles.figmaSection}>
                  <Text style={styles.figmaSectionTitle}>
                    Vaccination Record
                  </Text>
                  {vaccinationHistory.length === 0 ? (
                    <Text style={styles.figmaEmptyText}>
                      No vaccinations recorded yet.
                    </Text>
                  ) : (
                    vaccinationHistory.map((record) => (
                      <View key={record.id} style={styles.figmaCard}>
                        <View style={styles.figmaCardIconAlt}>
                          <FileText color="#10B981" size={22} />
                        </View>
                        <View style={styles.figmaCardBody}>
                          <Text style={styles.figmaCardTitle}>
                            {translateCondition(record.condition)}
                          </Text>
                          <Text style={styles.figmaCardMeta}>
                            Last:{" "}
                            {record.diagnosedDate
                              ? safeFormatDate(
                                  new Date(record.diagnosedDate),
                                  isRTL ? "ar-u-ca-gregory" : "en-US"
                                )
                              : "Unknown"}
                          </Text>
                          {record.notes ? (
                            <Text style={styles.figmaCardMeta}>
                              {record.notes}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {activeTab === "family" && (
                <View style={styles.figmaSection}>
                  <Text style={styles.figmaSectionTitle}>
                    Family Health History
                  </Text>
                  {familyHistory.length === 0 ? (
                    <Text style={styles.figmaEmptyText}>
                      No family history recorded yet.
                    </Text>
                  ) : (
                    familyHistory.map((record) => (
                      <View key={record.id} style={styles.figmaCard}>
                        <View style={styles.figmaCardIconAlt}>
                          <Heart color="#8B5CF6" size={22} />
                        </View>
                        <View style={styles.figmaCardBody}>
                          <Text style={styles.figmaCardTitle}>
                            {translateCondition(record.condition)}
                          </Text>
                          <Text style={styles.figmaCardMeta}>
                            {getFamilyRelationText(record)}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        onPress={() => setShowAddModal(true)}
        style={styles.figmaFab}
      >
        <Plus color="#FFFFFF" size={22} />
      </TouchableOpacity>
      {/* Add Medical History Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showAddModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && { textAlign: "left" }]}>
              {isRTL ? "إضافة سجل طبي" : "Add Medical Record"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                setNewCondition({
                  condition: "",
                  severity: "mild",
                  diagnosedDate: new Date(),
                  notes: "",
                  isFamily: false,
                  relation: "",
                  familyMemberId: "",
                });
              }}
              style={styles.closeButton}
            >
              <X color="#6C7280" size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Condition Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && { textAlign: "left" }]}>
                {isRTL ? "الحالة الطبية" : "Medical Condition"} *
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setNewCondition({ ...newCondition, condition: text })
                }
                placeholder={
                  isRTL ? "مثال: السكري، الضغط" : "e.g., Diabetes, Hypertension"
                }
                placeholderTextColor="#94A3B8"
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={newCondition.condition}
              />

              {/* Medical History Examples */}
              <View style={styles.examplesContainer}>
                <Text
                  style={[styles.examplesLabel, isRTL && { textAlign: "left" }]}
                >
                  {isRTL ? "أمثلة شائعة:" : "Common Examples:"}
                </Text>
                <View style={styles.examplesGrid}>
                  {MEDICAL_HISTORY_EXAMPLES.map((example) => (
                    <TouchableOpacity
                      key={example.en}
                      onPress={() =>
                        setNewCondition({
                          ...newCondition,
                          condition: isRTL ? example.ar : example.en,
                        })
                      }
                      style={styles.exampleChip}
                    >
                      <Text
                        style={[
                          styles.exampleChipText,
                          isRTL && { textAlign: "left" },
                        ]}
                      >
                        {isRTL ? example.ar : example.en}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Severity Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && { textAlign: "left" }]}>
                {isRTL ? "شدة الحالة" : "Severity"}
              </Text>
              <View style={styles.severityOptions}>
                {SEVERITY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() =>
                      setNewCondition({
                        ...newCondition,
                        severity: option.key as "mild" | "moderate" | "severe",
                      })
                    }
                    style={[
                      styles.severityOption,
                      newCondition.severity === option.key &&
                        styles.severityOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.severityOptionText,
                        newCondition.severity === option.key &&
                          styles.severityOptionTextSelected,
                        isRTL && { textAlign: "left" },
                      ]}
                    >
                      {isRTL ? option.labelAr : option.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Is Family Member Toggle */}
            {user?.familyId ? (
              <View style={styles.fieldContainer}>
                <View style={styles.toggleContainer}>
                  <Text
                    style={[styles.fieldLabel, isRTL && { textAlign: "left" }]}
                  >
                    {isRTL
                      ? "هذا السجل لعضو في العائلة"
                      : "This record is for a family member"}
                  </Text>
                  <Switch
                    onValueChange={(value) => {
                      setNewCondition({
                        ...newCondition,
                        isFamily: value,
                        familyMemberId: value
                          ? newCondition.familyMemberId
                          : "",
                        relation: value ? newCondition.relation : "",
                      });
                    }}
                    thumbColor={newCondition.isFamily ? "#FFFFFF" : "#9CA3AF"}
                    trackColor={{ false: "#E5E7EB", true: "#003543" }}
                    value={newCondition.isFamily}
                  />
                </View>
              </View>
            ) : null}

            {/* Family Member Selection */}
            {newCondition.isFamily && user?.familyId ? (
              <View style={styles.fieldContainer}>
                <Text
                  style={[styles.fieldLabel, isRTL && { textAlign: "left" }]}
                >
                  {isRTL ? "عضو العائلة" : "Family Member"} *
                </Text>
                {loadingFamilyMembers ? (
                  <ActivityIndicator
                    color="#003543"
                    size="small"
                    style={{ marginVertical: 12 }}
                  />
                ) : familyMembers.length === 0 ? (
                  <Text
                    style={[styles.helperText, isRTL && { textAlign: "left" }]}
                  >
                    {isRTL
                      ? "لا يوجد أعضاء عائلة متاحين"
                      : "No family members available"}
                  </Text>
                ) : (
                  <View style={styles.memberOptions}>
                    {familyMembers.map((member) => (
                      <TouchableOpacity
                        key={member.id}
                        onPress={() =>
                          setNewCondition({
                            ...newCondition,
                            familyMemberId: member.id,
                          })
                        }
                        style={[
                          styles.memberOption,
                          newCondition.familyMemberId === member.id &&
                            styles.memberOptionSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.memberOptionText,
                            newCondition.familyMemberId === member.id &&
                              styles.memberOptionTextSelected,
                            isRTL && { textAlign: "left" },
                          ]}
                        >
                          {member.firstName && member.lastName
                            ? `${member.firstName} ${member.lastName}`
                            : member.firstName || "User"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            {/* Relation Field (for family members) */}
            {newCondition.isFamily ? (
              <View style={styles.fieldContainer}>
                <Text
                  style={[styles.fieldLabel, isRTL && { textAlign: "left" }]}
                >
                  {isRTL ? "صلة القرابة" : "Relationship"} (
                  {isRTL ? "اختياري" : "Optional"})
                </Text>
                <TextInput
                  onChangeText={(text) =>
                    setNewCondition({ ...newCondition, relation: text })
                  }
                  placeholder={
                    isRTL
                      ? "مثال: الأب، الأم، الزوج"
                      : "e.g., Father, Mother, Spouse"
                  }
                  placeholderTextColor="#94A3B8"
                  style={[styles.textInput, isRTL && styles.rtlInput]}
                  textAlign={isRTL ? "right" : "left"}
                  value={newCondition.relation}
                />
              </View>
            ) : null}

            {/* Notes Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && { textAlign: "left" }]}>
                {isRTL ? "ملاحظات" : "Notes"} ({isRTL ? "اختياري" : "Optional"})
              </Text>
              <TextInput
                multiline
                numberOfLines={3}
                onChangeText={(text) =>
                  setNewCondition({ ...newCondition, notes: text })
                }
                placeholder={isRTL ? "أضف ملاحظات..." : "Add notes..."}
                placeholderTextColor="#94A3B8"
                style={[styles.textArea, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={newCondition.notes}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              disabled={addLoading}
              onPress={handleAddCondition}
              style={[
                styles.saveButton,
                addLoading && styles.saveButtonDisabled,
              ]}
            >
              {addLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Save color="#FFFFFF" size={20} />
              )}
              <Text style={styles.saveButtonText}>{saveButtonLabel}</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonRTL: {
    transform: [{ scaleX: -1 }],
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    flex: 1,
    textAlign: "center",
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EBF4FF",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  figmaHeaderWrapper: {
    flexShrink: 0,
    marginBottom: 12,
  },
  figmaScrollView: {
    flex: 1,
  },
  figmaHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  figmaBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0, 53, 67, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  figmaHeaderText: {
    flex: 1,
  },
  figmaHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  figmaHeaderTitle: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: "#003543",
  },
  figmaHeaderSubtitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#003543",
  },
  figmaContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 140,
  },
  figmaTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  figmaTabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  figmaTabButtonActive: {
    backgroundColor: "#003543",
  },
  figmaTabText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
  },
  figmaTabTextActive: {
    color: "#FFFFFF",
  },
  figmaSection: {
    marginBottom: 24,
  },
  figmaSectionTitle: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
    marginBottom: 12,
  },
  figmaEmptyText: {
    fontSize: 13,
    color: "#6C7280",
  },
  figmaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  figmaCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EEF2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  figmaCardIconAlt: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(99,102,241,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  figmaCardBody: {
    flex: 1,
  },
  figmaCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  figmaCardTitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
    flex: 1,
  },
  figmaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  figmaBadgeText: {
    fontSize: 10,
    fontFamily: "Inter-Medium",
  },
  figmaCardMeta: {
    fontSize: 12,
    color: "#6C7280",
    marginBottom: 4,
  },
  figmaDeleteButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  figmaFab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EB9C0C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    marginTop: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 100,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  comingSoon: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    textAlign: "center",
    marginTop: 100,
    paddingHorizontal: 32,
  },
  rtlText: {
    textAlign: "right",
    fontFamily: "Inter-Regular",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 4,
    marginTop: 20,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  activeTab: {
    backgroundColor: "#2563EB",
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  recordsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  recordItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  recordLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    marginEnd: 12,
  },
  recordInfo: {
    flex: 1,
  },
  recordCondition: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 4,
  },
  recordMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  severityText: {
    fontSize: 10,
    fontFamily: "Inter-Medium",
  },
  recordDate: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#64748B",
  },
  recordNotes: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginBottom: 2,
  },
  recordRelation: {
    fontSize: 10,
    fontFamily: "Inter-Medium",
    color: "#6366F1",
  },
  recordActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  floatingAddButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 20,
    marginBottom: 32,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingAddText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
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
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    backgroundColor: "#FFFFFF",
    color: "#1A1D1F",
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    backgroundColor: "#FFFFFF",
    color: "#1A1D1F",
    textAlignVertical: "top",
    minHeight: 80,
  },
  rtlInput: {
    fontFamily: "Inter-Regular",
  },
  severityOptions: {
    flexDirection: "row",
    gap: 8,
  },
  severityOption: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  severityOptionSelected: {
    backgroundColor: "rgba(0, 53, 67, 0.05)",
    borderColor: "#003543",
  },
  severityOptionText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#6C7280",
  },
  severityOptionTextSelected: {
    color: "#003543",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#003543",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
  },
  memberOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  memberOptionText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#6C7280",
  },
  memberOptionTextSelected: {
    color: "#003543",
  },
  helperText: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#6C7280",
    fontStyle: "italic",
  },
  examplesContainer: {
    marginTop: 12,
  },
  examplesLabel: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
    marginBottom: 8,
  },
  examplesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  exampleChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exampleChipText: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: "#003543",
  },
});

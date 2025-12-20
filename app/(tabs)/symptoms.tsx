import { useFocusEffect } from "expo-router";
import { Edit, MoreVertical, Plus, Trash2, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import FamilyDataFilter, {
  type FilterOption,
} from "@/app/components/FamilyDataFilter";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { symptomService } from "@/lib/services/symptomService";
import { userService } from "@/lib/services/userService";
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

export default function TrackScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
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

  const loadSymptoms = async (isRefresh = false) => {
    if (!user) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Always load family members first if user has family
      let members: UserType[] = [];
      if (user.familyId) {
        members = await userService.getFamilyMembers(user.familyId);
        setFamilyMembers(members);
      }

      // Load data based on selected filter
      if (selectedFilter.type === "family" && user.familyId) {
        // Load family symptoms and stats (both admins and members can view)
        const [familySymptoms, familyStats] = await Promise.all([
          symptomService.getFamilySymptoms(user.familyId, 50),
          symptomService.getFamilySymptomStats(user.familyId, 7),
        ]);

        setSymptoms(familySymptoms);
        setStats(familyStats);
      } else if (selectedFilter.type === "member" && selectedFilter.memberId) {
        // Load specific member symptoms and stats (both admins and members can view)
        const [memberSymptoms, memberStats] = await Promise.all([
          symptomService.getMemberSymptoms(selectedFilter.memberId, 50),
          symptomService.getMemberSymptomStats(selectedFilter.memberId, 7),
        ]);

        setSymptoms(memberSymptoms);
        setStats(memberStats);
      } else {
        // Load personal symptoms and stats (default)
        const [userSymptoms, symptomStats] = await Promise.all([
          symptomService.getUserSymptoms(user.id, 50),
          symptomService.getSymptomStats(user.id, 7),
        ]);

        setSymptoms(userSymptoms);
        setStats(symptomStats);
      }
    } catch (error) {
      // Silently handle symptoms load error
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "حدث خطأ في تحميل البيانات" : "Error loading data"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh data when tab is focused
  useFocusEffect(
    useCallback(() => {
      loadSymptoms();
    }, [user, selectedFilter])
  );

  useEffect(() => {
    loadSymptoms();
  }, [user, selectedFilter]);

  const handleFilterChange = (filter: FilterOption) => {
    setSelectedFilter(filter);
  };

  const getMemberName = (userId: string): string => {
    if (userId === user?.id) {
      return isRTL ? "أنت" : "You";
    }
    const member = familyMembers.find((m) => m.id === userId);
    return member?.name || (isRTL ? "عضو غير معروف" : "Unknown Member");
  };

  const handleAddSymptom = async () => {
    if (!user) return;

    const symptomType = selectedSymptom || customSymptom;
    if (!symptomType) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "يرجى اختيار أو إدخال نوع العرض"
          : "Please select or enter a symptom type"
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
            isRTL ? "غير مسموح" : "Not Permitted",
            isRTL
              ? "ليس لديك صلاحية لتعديل هذا العرض"
              : "You do not have permission to edit this symptom"
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
        isRTL ? "تم الحفظ" : "Saved",
        isRTL
          ? editingSymptom
            ? "تم تحديث العرض بنجاح"
            : "تم تسجيل العرض بنجاح"
          : editingSymptom
            ? "Symptom updated successfully"
            : "Symptom logged successfully"
      );
    } catch (error) {
      // Silently handle symptom save error
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "حدث خطأ في حفظ العرض" : "Error saving symptom"
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
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لتعديل هذا العرض"
          : "You do not have permission to edit this symptom"
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
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لحذف هذا العرض"
          : "You do not have permission to delete this symptom"
      );
      return;
    }

    Alert.alert(
      isRTL ? "حذف العرض" : "Delete Symptom",
      isRTL
        ? `هل أنت متأكد من رغبتك في حذف هذا العرض: ${t(symptom.type)}؟`
        : `Are you sure you want to delete this symptom: ${t(symptom.type)}?`,
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
              setLoading(true);
              await symptomService.deleteSymptom(symptom.id);
              await loadSymptoms();
              setShowActionsMenu(null);
              Alert.alert(
                isRTL ? "تم الحذف" : "Deleted",
                isRTL ? "تم حذف العرض بنجاح" : "Symptom deleted successfully"
              );
            } catch (error) {
                      // Silently handle symptom delete error
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL ? "حدث خطأ في حذف العرض" : "Error deleting symptom"
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getSeverityColor = (severityLevel: number) => {
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
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return isRTL ? "منذ أقل من ساعة" : "Less than an hour ago";
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
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Please log in to track symptoms</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {t("symptoms")}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setSelectedTargetUser(user.id);
            setShowAddModal(true);
          }}
          style={styles.addButton}
        >
          <Plus color="#FFFFFF" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            onRefresh={() => loadSymptoms(true)}
            refreshing={refreshing}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.content}
      >
        {/* Enhanced Data Filter */}
        <FamilyDataFilter
          currentUserId={user.id}
          familyMembers={familyMembers}
          hasFamily={hasFamily}
          isAdmin={isAdmin}
          onFilterChange={handleFilterChange}
          selectedFilter={selectedFilter}
        />

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t("thisWeek")}
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                {stats.totalSymptoms}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {selectedFilter.type === "family"
                  ? isRTL
                    ? "أعراض العائلة"
                    : "Family Symptoms"
                  : selectedFilter.type === "member"
                    ? isRTL
                      ? `أعراض ${selectedFilter.memberName}`
                      : `${selectedFilter.memberName}'s Symptoms`
                    : isRTL
                      ? "إجمالي الأعراض"
                      : "Total Symptoms"}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                {stats.avgSeverity.toFixed(1)}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {isRTL ? "متوسط الشدة" : "Avg Severity"}
              </Text>
            </View>
          </View>
        </View>

        {/* Symptoms List */}
        <View style={styles.symptomsSection}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {selectedFilter.type === "family"
              ? isRTL
                ? "أعراض العائلة الأخيرة"
                : "Recent Family Symptoms"
              : selectedFilter.type === "member"
                ? isRTL
                  ? `أعراض ${selectedFilter.memberName} الأخيرة`
                  : `${selectedFilter.memberName}'s Recent Symptoms`
                : isRTL
                  ? "أعراضي الأخيرة"
                  : "My Recent Symptoms"}
          </Text>

          {loading ? (
            <View style={styles.centerContainer}>
              <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
                {isRTL ? "جاري التحميل..." : "Loading..."}
              </Text>
            </View>
          ) : symptoms.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                {isRTL ? "لا توجد أعراض مسجلة" : "No symptoms recorded"}
              </Text>
            </View>
          ) : (
            symptoms.map((symptom) => (
              <View key={symptom.id} style={styles.symptomCard}>
                <View style={styles.symptomHeader}>
                  <View style={styles.symptomInfo}>
                    <Text style={[styles.symptomType, isRTL && styles.rtlText]}>
                      {t(symptom.type)}
                    </Text>
                    <View style={styles.symptomMeta}>
                      <Text
                        style={[styles.symptomDate, isRTL && styles.rtlText]}
                      >
                        {formatDate(symptom.timestamp)}
                      </Text>
                      {/* Show member name for family/admin views */}
                      {(selectedFilter.type === "family" ||
                        selectedFilter.type === "member") && (
                        <View style={styles.memberBadge}>
                          <Text
                            style={[
                              styles.memberBadgeText,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {getMemberName(symptom.userId)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.symptomActions}>
                    <View
                      style={[
                        styles.severityBadge,
                        { backgroundColor: getSeverityColor(symptom.severity) },
                      ]}
                    >
                      <Text style={styles.severityText}>
                        {symptom.severity}
                      </Text>
                    </View>
                    {/* Show action menu only for symptoms user can manage */}
                    {(symptom.userId === user.id ||
                      (isAdmin &&
                        (selectedFilter.type === "family" ||
                          selectedFilter.type === "member"))) && (
                      <TouchableOpacity
                        onPress={() =>
                          setShowActionsMenu(
                            showActionsMenu === symptom.id ? null : symptom.id
                          )
                        }
                        style={styles.actionsButton}
                      >
                        <MoreVertical color="#64748B" size={16} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {symptom.description && (
                  <Text
                    style={[styles.symptomDescription, isRTL && styles.rtlText]}
                  >
                    {symptom.description}
                  </Text>
                )}

                {/* Actions Menu */}
                {showActionsMenu === symptom.id && (
                  <View style={styles.actionsMenu}>
                    <TouchableOpacity
                      onPress={() => handleEditSymptom(symptom)}
                      style={styles.actionItem}
                    >
                      <Edit color="#64748B" size={16} />
                      <Text
                        style={[styles.actionText, isRTL && styles.rtlText]}
                      >
                        {isRTL ? "تعديل" : "Edit"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteSymptom(symptom)}
                      style={styles.actionItem}
                    >
                      <Trash2 color="#EF4444" size={16} />
                      <Text
                        style={[
                          styles.actionText,
                          styles.deleteText,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {isRTL ? "حذف" : "Delete"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

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
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {editingSymptom
                ? isRTL
                  ? "تعديل العرض"
                  : "Edit Symptom"
                : isRTL
                  ? "إضافة عرض جديد"
                  : "Add New Symptom"}
            </Text>
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
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Target User Selector (for admins) */}
            {isAdmin && hasFamily && familyMembers.length > 0 && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "إضافة العرض لـ" : "Add symptom for"}
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
                            ? isRTL
                              ? "أنت"
                              : "You"
                            : member.name}
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
                            {isRTL ? "مدير" : "Admin"}
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
                {isRTL ? "الأعراض الشائعة" : "Common Symptoms"}
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
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "عرض مخصص" : "Custom Symptom"}
              </Text>
              <TextInput
                onChangeText={(text) => {
                  setCustomSymptom(text);
                  if (text) setSelectedSymptom("");
                }}
                placeholder={
                  isRTL ? "أدخل نوع العرض..." : "Enter symptom type..."
                }
                style={[styles.textInput, isRTL && styles.rtlTextInput]}
                textAlign={isRTL ? "right" : "left"}
                value={customSymptom}
              />
            </View>

            {/* Severity */}
            {renderSeveritySelector()}

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t("description")} ({isRTL ? "اختياري" : "Optional"})
              </Text>
              <TextInput
                multiline
                numberOfLines={3}
                onChangeText={setDescription}
                placeholder={
                  isRTL
                    ? "أضف وصفاً للعرض..."
                    : "Add a description of the symptom..."
                }
                style={[
                  styles.textInput,
                  styles.textArea,
                  isRTL && styles.rtlTextInput,
                ]}
                textAlign={isRTL ? "right" : "left"}
                value={description}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              disabled={loading}
              onPress={handleAddSymptom}
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            >
              <Text style={[styles.saveButtonText, isRTL && styles.rtlText]}>
                {loading
                  ? isRTL
                    ? "جاري الحفظ..."
                    : "Saving..."
                  : editingSymptom
                    ? isRTL
                      ? "تحديث العرض"
                      : "Update Symptom"
                    : isRTL
                      ? "حفظ العرض"
                      : "Save Symptom"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
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
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  title: {
    fontSize: 24,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
  },
  rtlText: {
    fontFamily: "Cairo-Bold",
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
    padding: 20,
  },
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 12,
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
    fontFamily: "Geist-Bold",
    color: "#2563EB",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
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
    fontFamily: "Geist-SemiBold",
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
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  memberBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  memberBadgeText: {
    fontSize: 10,
    fontFamily: "Geist-Medium",
    color: "#6366F1",
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
    fontFamily: "Geist-Bold",
    color: "#FFFFFF",
  },
  actionsButton: {
    padding: 4,
  },
  symptomDescription: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
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
    fontFamily: "Geist-Medium",
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
    fontFamily: "Geist-Medium",
    color: "#64748B",
    textAlign: "center",
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#EF4444",
    textAlign: "center",
  },
  // Modal styles
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
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 8,
  },
  symptomsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  symptomOption: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  symptomOptionSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  symptomOptionText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  symptomOptionTextSelected: {
    color: "#FFFFFF",
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Geist-Regular",
    color: "#1E293B",
  },
  rtlTextInput: {
    fontFamily: "Cairo-Regular",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  severityContainer: {
    marginBottom: 24,
  },
  severityButtons: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  severityButton: {
    flex: 1,
    height: 44,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  severityButtonActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  severityButtonText: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#64748B",
  },
  severityButtonTextActive: {
    color: "#FFFFFF",
  },
  severityLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  severityLabel: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  saveButton: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#FFFFFF",
  },
  // Member selection styles
  memberSelectionContainer: {
    gap: 8,
  },
  memberOption: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberOptionSelected: {
    backgroundColor: "#EBF4FF",
    borderColor: "#2563EB",
  },
  memberInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberName: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#1E293B",
  },
  memberNameSelected: {
    color: "#2563EB",
  },
  memberRole: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  memberRoleSelected: {
    color: "#2563EB",
    backgroundColor: "#EBF4FF",
  },
});

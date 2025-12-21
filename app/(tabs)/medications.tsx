import { useFocusEffect } from "expo-router";
import { Clock, Edit, Minus, Pill, Plus, Trash2, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { convertTo12Hour, convertTo24Hour, isValidTimeFormat } from "@/lib/utils/timeFormat";
import FamilyDataFilter, {
  type FilterOption,
} from "@/app/components/FamilyDataFilter";
import AnimatedCheckButton from "@/components/AnimatedCheckButton";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { medicationService } from "@/lib/services/medicationService";
import { userService } from "@/lib/services/userService";
import type { Medication, MedicationReminder, User as UserType } from "@/types";

const FREQUENCY_OPTIONS = [
  { key: "once", labelEn: "Once daily", labelAr: "مرة واحدة يومياً" },
  { key: "twice", labelEn: "Twice daily", labelAr: "مرتان يومياً" },
  { key: "thrice", labelEn: "Three times daily", labelAr: "ثلاث مرات يومياً" },
  { key: "meals", labelEn: "With meals", labelAr: "مع الوجبات" },
  { key: "needed", labelEn: "As needed", labelAr: "عند الحاجة" },
];

export default function MedicationsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newMedication, setNewMedication] = useState({
    name: "",
    dosage: "",
    frequency: "",
    reminders: [] as { time: string; period: "AM" | "PM" }[],
    notes: "",
  });
  const [editingMedication, setEditingMedication] = useState<Medication | null>(
    null
  );
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
  const { scheduleRecurringMedicationReminder } = useNotifications();

  const loadMedications = async (isRefresh = false) => {
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
        // Load family medications (both admins and members can view)
        const familyMedications =
          await medicationService.getFamilyTodaysMedications(user.familyId);
        setMedications(familyMedications);
      } else if (selectedFilter.type === "member" && selectedFilter.memberId) {
        // Load specific member medications (both admins and members can view)
        const memberMedications = await medicationService.getMemberMedications(
          selectedFilter.memberId
        );
        setMedications(memberMedications);
      } else {
        // Load personal medications (default)
        const userMedications = await medicationService.getUserMedications(
          user.id
        );
        setMedications(userMedications);
      }
    } catch (error) {
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
      loadMedications();
    }, [user, selectedFilter])
  );

  useEffect(() => {
    loadMedications();
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

  const handleAddMedication = async () => {
    if (!user) return;

    if (
      !(newMedication.name && newMedication.dosage && newMedication.frequency)
    ) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "يرجى ملء جميع الحقول المطلوبة"
          : "Please fill in all required fields"
      );
      return;
    }

    // Validate that reminders are provided for regular medications
    if (
      newMedication.frequency !== "needed" &&
      newMedication.reminders.length === 0
    ) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "يرجى إضافة وقت تذكير واحد على الأقل"
          : "Please add at least one reminder time"
      );
      return;
    }

    // Validate reminder times format (HH:MM)
    const invalidReminders = newMedication.reminders.filter(
      (r) => !(r.time && r.time.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/))
    );

    if (invalidReminders.length > 0) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "يرجى إدخال أوقات التذكير بالتنسيق الصحيح (مثال: 8:00)"
          : "Please enter reminder times in correct format (e.g., 8:00)"
      );
      return;
    }

    try {
      setLoading(true);

      if (editingMedication) {
        // Update existing medication
        const updateData: Partial<Medication> = {
          name: newMedication.name,
          dosage: newMedication.dosage,
          frequency: newMedication.frequency,
          reminders: newMedication.reminders.map((reminder, index) => {
            // Combine time and period, then convert to 24-hour format
            const timeWithPeriod = `${reminder.time} ${reminder.period || "AM"}`;
            return {
              id: reminder.id || `${Date.now()}_${index}`,
              time: convertTo24Hour(timeWithPeriod), // Convert to 24-hour for storage
              taken: false,
            };
          }),
          ...(newMedication.notes.trim() && {
            notes: newMedication.notes.trim(),
          }),
        };

        await medicationService.updateMedication(
          editingMedication.id,
          updateData
        );

        // Reschedule notifications for updated reminders (only for current user's medications)
        if (editingMedication.userId === user.id && newMedication.reminders.length > 0) {
          const schedulingResults: { success: boolean; error?: string }[] = [];
          for (const reminder of newMedication.reminders) {
            if (reminder.time && reminder.time.trim()) {
              const result = await scheduleRecurringMedicationReminder(
                newMedication.name,
                newMedication.dosage,
                reminder.time
              );
              schedulingResults.push(result || { success: false });
            }
          }

          // Check if any scheduling failed
          const failedSchedules = schedulingResults.filter((r) => !r.success);
          if (failedSchedules.length > 0) {
            const errorMessage = failedSchedules[0]?.error || "Unknown error";
            const isPermissionError = errorMessage.toLowerCase().includes("permission");
            
            Alert.alert(
              isRTL ? "تحذير" : "Warning",
              isRTL
                ? `تم تحديث الدواء بنجاح، لكن فشل جدولة التذكير.${isPermissionError ? " يرجى تفعيل أذونات الإشعارات في إعدادات التطبيق." : ""}\n\n${errorMessage}`
                : `Medication updated successfully, but failed to schedule reminder.${isPermissionError ? " Please enable notification permissions in app settings." : ""}\n\n${errorMessage}`,
              [
                { text: isRTL ? "حسناً" : "OK", style: "cancel" },
                ...(isPermissionError
                  ? [
                      {
                        text: isRTL ? "فتح الإعدادات" : "Open Settings",
                        onPress: () => {
                          if (Platform.OS === "ios") {
                            Linking.openURL("app-settings:");
                          } else {
                            Linking.openSettings();
                          }
                        },
                      },
                    ]
                  : []),
              ]
            );
          }
        }
        setEditingMedication(null);
      } else {
        // Add new medication
        const targetUserId = selectedTargetUser || user.id;
        const medicationData: Omit<Medication, "id"> = {
          userId: targetUserId,
          name: newMedication.name,
          dosage: newMedication.dosage,
          frequency: newMedication.frequency,
          startDate: new Date(),
          reminders: newMedication.reminders.map((reminder, index) => {
            // Combine time and period, then convert to 24-hour format
            const timeWithPeriod = `${reminder.time} ${reminder.period || "AM"}`;
            return {
              id: `${Date.now()}_${index}`,
              time: convertTo24Hour(timeWithPeriod), // Convert to 24-hour for storage
              taken: false,
            };
          }),
          ...(newMedication.notes.trim() && {
            notes: newMedication.notes.trim(),
          }),
          isActive: true,
        };

        if (isAdmin && targetUserId !== user.id) {
          // Admin adding medication for another family member
          await medicationService.addMedicationForUser(
            medicationData,
            targetUserId
          );
        } else {
          // User adding medication for themselves
          await medicationService.addMedication(medicationData);
        }

        // Schedule notifications for reminders (only for current user's medications)
        if (targetUserId === user.id && newMedication.reminders.length > 0) {
          const schedulingResults: { success: boolean; error?: string }[] = [];
          for (const reminder of newMedication.reminders) {
            if (reminder.time && reminder.time.trim()) {
              const result = await scheduleRecurringMedicationReminder(
                newMedication.name,
                newMedication.dosage,
                reminder.time
              );
              schedulingResults.push(result || { success: false });
            }
          }

          // Check if any scheduling failed
          const failedSchedules = schedulingResults.filter((r) => !r.success);
          if (failedSchedules.length > 0) {
            const errorMessage = failedSchedules[0]?.error || "Unknown error";
            const isPermissionError = errorMessage.toLowerCase().includes("permission");
            
            Alert.alert(
              isRTL ? "تحذير" : "Warning",
              isRTL
                ? `تمت إضافة الدواء بنجاح، لكن فشل جدولة التذكير.${isPermissionError ? " يرجى تفعيل أذونات الإشعارات في إعدادات التطبيق." : ""}\n\n${errorMessage}`
                : `Medication added successfully, but failed to schedule reminder.${isPermissionError ? " Please enable notification permissions in app settings." : ""}\n\n${errorMessage}`,
              [
                { text: isRTL ? "حسناً" : "OK", style: "cancel" },
                ...(isPermissionError
                  ? [
                      {
                        text: isRTL ? "فتح الإعدادات" : "Open Settings",
                        onPress: () => {
                          if (Platform.OS === "ios") {
                            Linking.openURL("app-settings:");
                          } else {
                            Linking.openSettings();
                          }
                        },
                      },
                    ]
                  : []),
              ]
            );
          }
        }
      }

      // Reset form
      setNewMedication({
        name: "",
        dosage: "",
        frequency: "",
        reminders: [{ time: "", period: "AM" }],
        notes: "",
      });
      setSelectedTargetUser("");
      setShowAddModal(false);

      // Reload medications
      await loadMedications();

      Alert.alert(
        isRTL ? "تمت العملية" : "Success",
        isRTL
          ? editingMedication
            ? "تم تحديث الدواء بنجاح"
            : "تم إضافة الدواء بنجاح"
          : editingMedication
            ? "Medication updated successfully"
            : "Medication added successfully"
      );
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "حدث خطأ في حفظ الدواء" : "Error saving medication"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditMedication = (medication: Medication) => {
    // Check permissions
    const canEdit =
      medication.userId === user?.id ||
      (isAdmin &&
        (selectedFilter.type === "family" || selectedFilter.type === "member"));
    if (!canEdit) {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لتعديل هذا الدواء"
          : "You do not have permission to edit this medication"
      );
      return;
    }

    setEditingMedication(medication);
    setNewMedication({
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      reminders: medication.reminders.map((reminder) => {
        // Parse 24-hour time to get time and period
        const [hoursStr, minutesStr] = reminder.time.split(":");
        const hours = Number.parseInt(hoursStr, 10);
        let timeValue = "";
        let periodValue: "AM" | "PM" = "AM";
        
        if (hours >= 12) {
          periodValue = "PM";
          if (hours > 12) {
            timeValue = `${hours - 12}:${minutesStr}`;
          } else {
            timeValue = `12:${minutesStr}`;
          }
        } else {
          periodValue = "AM";
          if (hours === 0) {
            timeValue = `12:${minutesStr}`;
          } else {
            timeValue = reminder.time;
          }
        }
        
        return {
          time: timeValue,
          period: periodValue,
        };
      }),
      notes: medication.notes || "",
    });
    setSelectedTargetUser(medication.userId);
    setShowAddModal(true);
  };

  const handleDeleteMedication = (medication: Medication) => {
    // Check permissions
    const canDelete =
      medication.userId === user?.id ||
      (isAdmin &&
        (selectedFilter.type === "family" || selectedFilter.type === "member"));
    if (!canDelete) {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لحذف هذا الدواء"
          : "You do not have permission to delete this medication"
      );
      return;
    }

    Alert.alert(
      isRTL ? "حذف الدواء" : "Delete Medication",
      isRTL
        ? `هل أنت متأكد من رغبتك في حذف: ${medication.name}؟`
        : `Are you sure you want to delete: ${medication.name}?`,
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
              await medicationService.deleteMedication(medication.id);
              await loadMedications();
              Alert.alert(
                isRTL ? "تم الحذف" : "Deleted",
                isRTL
                  ? "تم حذف الدواء بنجاح"
                  : "Medication deleted successfully"
              );
            } catch (error) {
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL ? "حدث خطأ في حذف الدواء" : "Error deleting medication"
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const toggleMedicationTaken = async (
    medicationId: string,
    reminderId: string
  ) => {
    try {
      await medicationService.markMedicationTaken(medicationId, reminderId);

      // Update local state
      setMedications(
        medications.map((med) =>
          med.id === medicationId
            ? {
                ...med,
                reminders: med.reminders.map((reminder) =>
                  reminder.id === reminderId
                    ? { ...reminder, taken: !reminder.taken }
                    : reminder
                ),
              }
            : med
        )
      );
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "حدث خطأ في تحديث الدواء" : "Error updating medication"
      );
    }
  };

  const getTodayStats = () => {
    const totalMeds = medications.length;
    const takenMeds = medications.filter(
      (med) =>
        Array.isArray(med.reminders) &&
        med.reminders.some((reminder) => reminder.taken)
    ).length;
    return { totalMeds, takenMeds };
  };

  const getNextDoseText = (medication: Medication) => {
    const reminders = Array.isArray(medication.reminders)
      ? medication.reminders
      : [];
    if (reminders.length === 0) return "No reminders set";

    const now = new Date();
    const todayReminders = reminders.filter(
      (reminder: MedicationReminder) => !reminder.taken
    );

    if (todayReminders.length === 0) {
      return "All doses taken today";
    }

    const nextReminder = todayReminders[0];
    const [hours, minutes] = nextReminder.time.split(":");
    const nextDoseTime = new Date();
    nextDoseTime.setHours(
      Number.parseInt(hours, 10),
      Number.parseInt(minutes, 10),
      0,
      0
    );

    if (nextDoseTime < now) {
      nextDoseTime.setDate(nextDoseTime.getDate() + 1);
    }

    return `Next: ${convertTo12Hour(nextReminder.time)}`;
  };

  const { totalMeds, takenMeds } = getTodayStats();

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>
            Please log in to track medications
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {t("medications")}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setNewMedication({
              name: "",
              dosage: "",
              frequency: "",
              reminders: [{ time: "", period: "AM" }], // Start with one empty reminder
              notes: "",
            });
            setSelectedTargetUser(user.id);
            setShowAddModal(true);
          }}
          style={styles.headerAddButton}
        >
          <Plus color="#FFFFFF" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            onRefresh={() => loadMedications(true)}
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

        {/* Today's Progress */}
        <View style={styles.progressCard}>
          <Text style={[styles.progressTitle, isRTL && styles.rtlText]}>
            {selectedFilter.type === "family"
              ? isRTL
                ? "تقدم العائلة اليوم"
                : "Family's Progress Today"
              : selectedFilter.type === "member"
                ? isRTL
                  ? `تقدم ${selectedFilter.memberName} اليوم`
                  : `${selectedFilter.memberName}'s Progress Today`
                : isRTL
                  ? "تقدم اليوم"
                  : "Today's Progress"}
          </Text>
          <View style={styles.progressInfo}>
            <Text style={[styles.progressText, isRTL && styles.rtlText]}>
              {takenMeds}/{totalMeds} {isRTL ? "مأخوذة" : "taken"}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      totalMeds > 0 ? (takenMeds / totalMeds) * 100 : 0
                    }%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Today's Medications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {selectedFilter.type === "family"
              ? isRTL
                ? "أدوية العائلة"
                : "Family Medications"
              : selectedFilter.type === "member"
                ? isRTL
                  ? `أدوية ${selectedFilter.memberName}`
                  : `${selectedFilter.memberName}'s Medications`
                : isRTL
                  ? "أدوية اليوم"
                  : "Today's Medications"}
          </Text>

          {medications.length > 0 ? (
            <View style={styles.medicationsList}>
              {medications.map((medication) => (
                <View key={medication.id} style={styles.medicationItem}>
                  <View style={styles.medicationLeft}>
                    <View style={styles.medicationIcon}>
                      <Pill color="#2563EB" size={20} />
                    </View>

                    <View style={styles.medicationInfo}>
                      <View style={styles.medicationHeader}>
                        <Text
                          style={[
                            styles.medicationName,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {medication.name}
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
                              {getMemberName(medication.userId)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.medicationDosage,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {medication.dosage} • {medication.frequency}
                      </Text>
                      <View style={styles.medicationTime}>
                        <Clock color="#64748B" size={12} />
                        <Text
                          style={[
                            styles.medicationTimeText,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {getNextDoseText(medication)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.medicationActions}>
                    {/* Show all reminders with animated check buttons */}
                    <View style={styles.remindersDisplay}>
                      {medication.reminders.map((reminder) => {
                        // Check if user can mark this medication as taken
                        const canMarkTaken =
                          medication.userId === user.id || // Owner can mark their own
                          (isAdmin && user.familyId); // Admin can mark for family members

                        return (
                          <AnimatedCheckButton
                            disabled={!canMarkTaken}
                            isChecked={reminder.taken}
                            key={reminder.id}
                            label={convertTo12Hour(reminder.time)}
                            onPress={() =>
                              toggleMedicationTaken(medication.id, reminder.id)
                            }
                            size="sm"
                            style={styles.reminderButton}
                          />
                        );
                      })}
                    </View>

                    {/* Show action buttons only for medications user can manage */}
                    {(medication.userId === user.id ||
                      (isAdmin &&
                        (selectedFilter.type === "family" ||
                          selectedFilter.type === "member"))) && (
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          onPress={() => handleEditMedication(medication)}
                          style={styles.actionButton}
                        >
                          <Edit color="#64748B" size={16} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteMedication(medication)}
                          style={[styles.actionButton, styles.deleteButton]}
                        >
                          <Trash2 color="#EF4444" size={16} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
              {isRTL ? "لا توجد أدوية مضافة" : "No medications added yet"}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Add Medication Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showAddModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {editingMedication
                ? isRTL
                  ? "تحديث الدواء"
                  : "Edit Medication"
                : isRTL
                  ? "إضافة دواء"
                  : "Add Medication"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                setEditingMedication(null);
                setNewMedication({
                  name: "",
                  dosage: "",
                  frequency: "",
                  reminders: [{ time: "", period: "AM" }],
                  notes: "",
                });
              }}
              style={styles.closeButton}
            >
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Target User Selector (for admins) */}
            {isAdmin && hasFamily && familyMembers.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "إضافة الدواء لـ" : "Add medication for"}
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
                            : member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName || "User"}
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

            {/* Medication Name */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t("medicationName")} *
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setNewMedication({ ...newMedication, name: text })
                }
                placeholder={isRTL ? "اسم الدواء" : "Medication name"}
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={newMedication.name}
              />
            </View>

            {/* Dosage */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t("dosage")} *
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setNewMedication({ ...newMedication, dosage: text })
                }
                placeholder={
                  isRTL ? "مثال: 500mg, 1 كبسولة" : "e.g., 500mg, 1 tablet"
                }
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={newMedication.dosage}
              />
            </View>

            {/* Frequency */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t("frequency")} *
              </Text>
              <View style={styles.frequencyGrid}>
                {FREQUENCY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() =>
                      setNewMedication({
                        ...newMedication,
                        frequency: option.key,
                      })
                    }
                    style={[
                      styles.frequencyChip,
                      newMedication.frequency === option.key &&
                        styles.frequencyChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.frequencyChipText,
                        newMedication.frequency === option.key &&
                          styles.frequencyChipTextSelected,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL ? option.labelAr : option.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Reminders */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "التذكيرات" : "Reminders"} *
              </Text>
              <Text style={[styles.helperText, isRTL && styles.rtlText]}>
                {isRTL
                  ? "أدخل الوقت واختر AM أو PM - مثال: 8:00 AM، 2:30 PM"
                  : "Enter time and select AM or PM - Examples: 8:00 AM, 2:30 PM"}
              </Text>
              <View style={styles.remindersList}>
                {newMedication.reminders.map((reminder, index) => {
                  // Use the stored time and period values directly
                  // When editing, these are already parsed from 24-hour format
                  // When adding new, these start empty
                  const timeValue = reminder.time || "";
                  const periodValue: "AM" | "PM" = reminder.period || "AM";
                  
                  return (
                    <View key={index} style={styles.reminderItem}>
                      <TextInput
                        onChangeText={(text) => {
                          // Remove all non-digits first
                          const digitsOnly = text.replace(/\D/g, "");
                          
                          // Auto-format as HH:MM
                          let formatted = "";
                          if (digitsOnly.length > 0) {
                            // Add first digit
                            formatted = digitsOnly.substring(0, 1);
                            if (digitsOnly.length > 1) {
                              // Add second digit and colon
                              formatted = digitsOnly.substring(0, 2) + ":";
                              if (digitsOnly.length > 2) {
                                // Add minutes
                                formatted = digitsOnly.substring(0, 2) + ":" + digitsOnly.substring(2, 4);
                              }
                            }
                          }
                          
                          // Limit to HH:MM format (max 5 characters: "12:34")
                          if (formatted.length <= 5) {
                            setNewMedication({
                              ...newMedication,
                              reminders: newMedication.reminders.map((r, i) =>
                                i === index ? { ...r, time: formatted, period: r.period || "AM" } : r
                              ),
                            });
                          }
                        }}
                        placeholder={isRTL ? "8:00" : "8:00"}
                        style={[styles.reminderTimeInput, isRTL && styles.rtlInput]}
                        textAlign={isRTL ? "right" : "left"}
                        value={timeValue}
                        keyboardType="number-pad"
                        maxLength={5}
                      />
                      <View style={styles.periodSelector}>
                        <TouchableOpacity
                          onPress={() => {
                            setNewMedication({
                              ...newMedication,
                              reminders: newMedication.reminders.map((r, i) =>
                                i === index ? { ...r, period: "AM" } : r
                              ),
                            });
                          }}
                          style={[
                            styles.periodButton,
                            periodValue === "AM" && styles.periodButtonSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.periodButtonText,
                              periodValue === "AM" && styles.periodButtonTextSelected,
                            ]}
                          >
                            AM
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            setNewMedication({
                              ...newMedication,
                              reminders: newMedication.reminders.map((r, i) =>
                                i === index ? { ...r, period: "PM" } : r
                              ),
                            });
                          }}
                          style={[
                            styles.periodButton,
                            periodValue === "PM" && styles.periodButtonSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.periodButtonText,
                              periodValue === "PM" && styles.periodButtonTextSelected,
                            ]}
                          >
                            PM
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          setNewMedication({
                            ...newMedication,
                            reminders: newMedication.reminders.filter(
                              (_, i) => i !== index
                            ),
                          })
                        }
                        style={styles.removeButton}
                      >
                        <Minus color="#64748B" size={16} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
              <TouchableOpacity
                onPress={() =>
                  setNewMedication({
                    ...newMedication,
                    reminders: [...newMedication.reminders, { time: "", period: "AM" }],
                  })
                }
                style={styles.addButton}
              >
                <Plus color="#64748B" size={24} />
              </TouchableOpacity>
            </View>

            {/* Notes */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "ملاحظات" : "Notes"} ({isRTL ? "اختياري" : "Optional"})
              </Text>
              <TextInput
                multiline
                numberOfLines={3}
                onChangeText={(text) =>
                  setNewMedication({ ...newMedication, notes: text })
                }
                placeholder={isRTL ? "أضف ملاحظات..." : "Add notes..."}
                style={[styles.textArea, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={newMedication.notes}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              disabled={loading}
              onPress={handleAddMedication}
              style={[
                styles.submitButton,
                loading && styles.submitButtonDisabled,
              ]}
            >
              <Text style={styles.submitButtonText}>
                {loading ? (isRTL ? "جاري الإضافة..." : "Adding...") : t("add")}
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
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
  },
  headerAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  progressCard: {
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
  progressTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 12,
  },
  progressInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressText: {
    fontSize: 24,
    fontFamily: "Geist-Bold",
    color: "#10B981",
    minWidth: 80,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 4,
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  medicationLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  medicationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 2,
  },
  medicationDosage: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginBottom: 4,
  },
  medicationTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  medicationTimeText: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#64748B",
  },
  reminderButton: {
    marginBottom: 4,
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
  helperText: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginBottom: 8,
    marginTop: -4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "Geist-Regular",
    backgroundColor: "#FFFFFF",
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "Geist-Regular",
    backgroundColor: "#FFFFFF",
    textAlignVertical: "top",
    minHeight: 80,
  },
  rtlInput: {
    fontFamily: "Cairo-Regular",
  },
  frequencyGrid: {
    flexDirection: "row",
    gap: 8,
  },
  frequencyChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  frequencyChipSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  frequencyChipText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  frequencyChipTextSelected: {
    color: "#FFFFFF",
  },
  submitButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: "#E2E8F0",
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#FFFFFF",
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    textAlign: "center",
  },
  rtlText: {
    fontFamily: "Cairo-Regular",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    textAlign: "center",
  },
  medicationActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButtons: {
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
  remindersList: {
    marginBottom: 8,
  },
  reminderItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  reminderInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "Geist-Regular",
    backgroundColor: "#FFFFFF",
  },
  reminderTimeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "Geist-Regular",
    backgroundColor: "#FFFFFF",
    minWidth: 80,
  },
  periodSelector: {
    flexDirection: "row",
    gap: 4,
  },
  periodButton: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    minWidth: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  periodButtonSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  periodButtonText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  periodButtonTextSelected: {
    color: "#FFFFFF",
  },
  removeButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  addButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  remindersDisplay: {
    flexDirection: "column",
    gap: 4,
    marginRight: 8,
  },
  reminderTimeText: {
    fontSize: 10,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginTop: 2,
  },
  reminderTimeTaken: {
    color: "#FFFFFF",
  },
  medicationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
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

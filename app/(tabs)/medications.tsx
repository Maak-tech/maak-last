import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus,
  Clock,
  Bell,
  Check,
  X,
  Pill,
  Edit,
  Trash2,
  Minus,
} from 'lucide-react-native';
import { medicationService } from '@/lib/services/medicationService';
import { userService } from '@/lib/services/userService';
import { Medication, MedicationReminder, User as UserType } from '@/types';
import FamilyDataFilter, {
  FilterOption,
} from '@/app/components/FamilyDataFilter';

const FREQUENCY_OPTIONS = [
  { key: 'once', labelEn: 'Once daily', labelAr: 'مرة واحدة يومياً' },
  { key: 'twice', labelEn: 'Twice daily', labelAr: 'مرتان يومياً' },
  { key: 'thrice', labelEn: 'Three times daily', labelAr: 'ثلاث مرات يومياً' },
  { key: 'meals', labelEn: 'With meals', labelAr: 'مع الوجبات' },
  { key: 'needed', labelEn: 'As needed', labelAr: 'عند الحاجة' },
];

export default function MedicationsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMedication, setNewMedication] = useState({
    name: '',
    dosage: '',
    frequency: '',
    reminders: [] as { time: string }[],
    notes: '',
  });
  const [editingMedication, setEditingMedication] = useState<Medication | null>(
    null
  );
  const [familyMembers, setFamilyMembers] = useState<UserType[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>({
    id: 'personal',
    type: 'personal',
    label: '',
  });
  const [selectedTargetUser, setSelectedTargetUser] = useState<string>('');

  const isRTL = i18n.language === 'ar';
  const isAdmin = user?.role === 'admin';
  const hasFamily = Boolean(user?.familyId);

  const loadMedications = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Always load family members first if user has family
      let members: UserType[] = [];
      if (user.familyId) {
        members = await userService.getFamilyMembers(user.familyId);
        setFamilyMembers(members);
      }

      // Load data based on selected filter
      if (selectedFilter.type === 'family' && user.familyId) {
        // Load family medications (both admins and members can view)
        const familyMedications =
          await medicationService.getFamilyTodaysMedications(user.familyId);
        setMedications(familyMedications);
      } else if (selectedFilter.type === 'member' && selectedFilter.memberId) {
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
      console.error('Error loading medications:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'حدث خطأ في تحميل البيانات' : 'Error loading data'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedications();
  }, [user, selectedFilter]);

  const handleFilterChange = (filter: FilterOption) => {
    setSelectedFilter(filter);
  };

  const getMemberName = (userId: string): string => {
    if (userId === user?.id) {
      return isRTL ? 'أنت' : 'You';
    }
    const member = familyMembers.find((m) => m.id === userId);
    return member?.name || (isRTL ? 'عضو غير معروف' : 'Unknown Member');
  };

  const handleAddMedication = async () => {
    if (!user) return;

    if (
      !newMedication.name ||
      !newMedication.dosage ||
      !newMedication.frequency
    ) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL
          ? 'يرجى ملء جميع الحقول المطلوبة'
          : 'Please fill in all required fields'
      );
      return;
    }

    // Validate that reminders are provided for regular medications
    if (
      newMedication.frequency !== 'needed' &&
      newMedication.reminders.length === 0
    ) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL
          ? 'يرجى إضافة وقت تذكير واحد على الأقل'
          : 'Please add at least one reminder time'
      );
      return;
    }

    // Validate reminder times format
    const invalidReminders = newMedication.reminders.filter(
      (r) => !r.time || !r.time.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    );

    if (invalidReminders.length > 0) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL
          ? 'يرجى إدخال أوقات التذكير بالتنسيق الصحيح (HH:MM)'
          : 'Please enter reminder times in correct format (HH:MM)'
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
          reminders: newMedication.reminders.map((reminder, index) => ({
            id: `${Date.now()}_${index}`,
            time: reminder.time,
            taken: false,
          })),
          ...(newMedication.notes.trim() && {
            notes: newMedication.notes.trim(),
          }),
        };

        await medicationService.updateMedication(
          editingMedication.id,
          updateData
        );
        setEditingMedication(null);
      } else {
        // Add new medication
        const targetUserId = selectedTargetUser || user.id;
        const medicationData: Omit<Medication, 'id'> = {
          userId: targetUserId,
          name: newMedication.name,
          dosage: newMedication.dosage,
          frequency: newMedication.frequency,
          startDate: new Date(),
          reminders: newMedication.reminders.map((reminder, index) => ({
            id: `${Date.now()}_${index}`,
            time: reminder.time,
            taken: false,
          })),
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
      }

      // Reset form
      setNewMedication({
        name: '',
        dosage: '',
        frequency: '',
        reminders: [{ time: '' }],
        notes: '',
      });
      setSelectedTargetUser('');
      setShowAddModal(false);

      // Reload medications
      await loadMedications();

      Alert.alert(
        isRTL ? 'تمت العملية' : 'Success',
        isRTL
          ? editingMedication
            ? 'تم تحديث الدواء بنجاح'
            : 'تم إضافة الدواء بنجاح'
          : editingMedication
          ? 'Medication updated successfully'
          : 'Medication added successfully'
      );
    } catch (error) {
      console.error('Error saving medication:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'حدث خطأ في حفظ الدواء' : 'Error saving medication'
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
        (selectedFilter.type === 'family' || selectedFilter.type === 'member'));
    if (!canEdit) {
      Alert.alert(
        isRTL ? 'غير مسموح' : 'Not Permitted',
        isRTL
          ? 'ليس لديك صلاحية لتعديل هذا الدواء'
          : 'You do not have permission to edit this medication'
      );
      return;
    }

    setEditingMedication(medication);
    setNewMedication({
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      reminders: medication.reminders.map((reminder) => ({
        time: reminder.time,
      })),
      notes: medication.notes || '',
    });
    setSelectedTargetUser(medication.userId);
    setShowAddModal(true);
  };

  const handleDeleteMedication = (medication: Medication) => {
    // Check permissions
    const canDelete =
      medication.userId === user?.id ||
      (isAdmin &&
        (selectedFilter.type === 'family' || selectedFilter.type === 'member'));
    if (!canDelete) {
      Alert.alert(
        isRTL ? 'غير مسموح' : 'Not Permitted',
        isRTL
          ? 'ليس لديك صلاحية لحذف هذا الدواء'
          : 'You do not have permission to delete this medication'
      );
      return;
    }

    Alert.alert(
      isRTL ? 'حذف الدواء' : 'Delete Medication',
      isRTL
        ? `هل أنت متأكد من رغبتك في حذف: ${medication.name}؟`
        : `Are you sure you want to delete: ${medication.name}?`,
      [
        {
          text: isRTL ? 'إلغاء' : 'Cancel',
          style: 'cancel',
        },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await medicationService.deleteMedication(medication.id);
              await loadMedications();
              Alert.alert(
                isRTL ? 'تم الحذف' : 'Deleted',
                isRTL
                  ? 'تم حذف الدواء بنجاح'
                  : 'Medication deleted successfully'
              );
            } catch (error) {
              console.error('Error deleting medication:', error);
              Alert.alert(
                isRTL ? 'خطأ' : 'Error',
                isRTL ? 'حدث خطأ في حذف الدواء' : 'Error deleting medication'
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
      console.error('Error toggling medication:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'حدث خطأ في تحديث الدواء' : 'Error updating medication'
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
    if (reminders.length === 0) return 'No reminders set';

    const now = new Date();
    const todayReminders = reminders.filter(
      (reminder: MedicationReminder) => !reminder.taken
    );

    if (todayReminders.length === 0) {
      return 'All doses taken today';
    }

    const nextReminder = todayReminders[0];
    const [hours, minutes] = nextReminder.time.split(':');
    const nextDoseTime = new Date();
    nextDoseTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

    if (nextDoseTime < now) {
      nextDoseTime.setDate(nextDoseTime.getDate() + 1);
    }

    return `Next: ${nextReminder.time}`;
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
          {t('medications')}
        </Text>
        <TouchableOpacity
          style={styles.headerAddButton}
          onPress={() => {
            setNewMedication({
              name: '',
              dosage: '',
              frequency: '',
              reminders: [{ time: '' }], // Start with one empty reminder
              notes: '',
            });
            setSelectedTargetUser(user.id);
            setShowAddModal(true);
          }}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Enhanced Data Filter */}
        <FamilyDataFilter
          familyMembers={familyMembers}
          currentUserId={user.id}
          selectedFilter={selectedFilter}
          onFilterChange={handleFilterChange}
          isAdmin={isAdmin}
          hasFamily={hasFamily}
        />

        {/* Today's Progress */}
        <View style={styles.progressCard}>
          <Text style={[styles.progressTitle, isRTL && styles.rtlText]}>
            {selectedFilter.type === 'family'
              ? isRTL
                ? 'تقدم العائلة اليوم'
                : "Family's Progress Today"
              : selectedFilter.type === 'member'
              ? isRTL
                ? `تقدم ${selectedFilter.memberName} اليوم`
                : `${selectedFilter.memberName}'s Progress Today`
              : isRTL
              ? 'تقدم اليوم'
              : "Today's Progress"}
          </Text>
          <View style={styles.progressInfo}>
            <Text style={[styles.progressText, isRTL && styles.rtlText]}>
              {takenMeds}/{totalMeds} {isRTL ? 'مأخوذة' : 'taken'}
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
            {selectedFilter.type === 'family'
              ? isRTL
                ? 'أدوية العائلة'
                : 'Family Medications'
              : selectedFilter.type === 'member'
              ? isRTL
                ? `أدوية ${selectedFilter.memberName}`
                : `${selectedFilter.memberName}'s Medications`
              : isRTL
              ? 'أدوية اليوم'
              : "Today's Medications"}
          </Text>

          {medications.length > 0 ? (
            <View style={styles.medicationsList}>
              {medications.map((medication) => (
                <View key={medication.id} style={styles.medicationItem}>
                  <View style={styles.medicationLeft}>
                    <View style={styles.medicationIcon}>
                      <Pill size={20} color="#2563EB" />
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
                        {(selectedFilter.type === 'family' ||
                          selectedFilter.type === 'member') && (
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
                        <Clock size={12} color="#64748B" />
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
                    {/* Show all reminders with individual checkboxes */}
                    <View style={styles.remindersDisplay}>
                      {medication.reminders.map((reminder) => (
                        <TouchableOpacity
                          key={reminder.id}
                          style={[
                            styles.checkButton,
                            reminder.taken && styles.checkButtonTaken,
                          ]}
                          onPress={() =>
                            toggleMedicationTaken(medication.id, reminder.id)
                          }
                        >
                          {reminder.taken && (
                            <Check size={12} color="#FFFFFF" />
                          )}
                          <Text
                            style={[
                              styles.reminderTimeText,
                              reminder.taken && styles.reminderTimeTaken,
                            ]}
                          >
                            {reminder.time}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Show action buttons only for medications user can manage */}
                    {(medication.userId === user.id ||
                      (isAdmin &&
                        (selectedFilter.type === 'family' ||
                          selectedFilter.type === 'member'))) && (
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleEditMedication(medication)}
                        >
                          <Edit size={16} color="#64748B" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.deleteButton]}
                          onPress={() => handleDeleteMedication(medication)}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
              {isRTL ? 'لا توجد أدوية مضافة' : 'No medications added yet'}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Add Medication Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {editingMedication
                ? isRTL
                  ? 'تحديث الدواء'
                  : 'Edit Medication'
                : isRTL
                ? 'إضافة دواء'
                : 'Add Medication'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                setEditingMedication(null);
                setNewMedication({
                  name: '',
                  dosage: '',
                  frequency: '',
                  reminders: [{ time: '' }],
                  notes: '',
                });
              }}
              style={styles.closeButton}
            >
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Target User Selector (for admins) */}
            {isAdmin && hasFamily && familyMembers.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                  {isRTL ? 'إضافة الدواء لـ' : 'Add medication for'}
                </Text>
                <View style={styles.memberSelectionContainer}>
                  {familyMembers.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={[
                        styles.memberOption,
                        selectedTargetUser === member.id &&
                          styles.memberOptionSelected,
                      ]}
                      onPress={() => setSelectedTargetUser(member.id)}
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
                              ? 'أنت'
                              : 'You'
                            : member.name}
                        </Text>
                        {member.role === 'admin' && (
                          <Text
                            style={[
                              styles.memberRole,
                              selectedTargetUser === member.id &&
                                styles.memberRoleSelected,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {isRTL ? 'مدير' : 'Admin'}
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
                {t('medicationName')} *
              </Text>
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={newMedication.name}
                onChangeText={(text) =>
                  setNewMedication({ ...newMedication, name: text })
                }
                placeholder={isRTL ? 'اسم الدواء' : 'Medication name'}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Dosage */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t('dosage')} *
              </Text>
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={newMedication.dosage}
                onChangeText={(text) =>
                  setNewMedication({ ...newMedication, dosage: text })
                }
                placeholder={
                  isRTL ? 'مثال: 500mg, 1 كبسولة' : 'e.g., 500mg, 1 tablet'
                }
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Frequency */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t('frequency')} *
              </Text>
              <View style={styles.frequencyGrid}>
                {FREQUENCY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.frequencyChip,
                      newMedication.frequency === option.key &&
                        styles.frequencyChipSelected,
                    ]}
                    onPress={() =>
                      setNewMedication({
                        ...newMedication,
                        frequency: option.key,
                      })
                    }
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
                {t('reminders')} *
              </Text>
              <View style={styles.remindersList}>
                {newMedication.reminders.map((reminder, index) => (
                  <View key={index} style={styles.reminderItem}>
                    <TextInput
                      style={[styles.reminderInput, isRTL && styles.rtlInput]}
                      value={reminder.time}
                      onChangeText={(text) =>
                        setNewMedication({
                          ...newMedication,
                          reminders: newMedication.reminders.map((r, i) =>
                            i === index ? { ...r, time: text } : r
                          ),
                        })
                      }
                      placeholder={isRTL ? 'مثال: 08:00' : 'e.g., 08:00'}
                      textAlign={isRTL ? 'right' : 'left'}
                    />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() =>
                        setNewMedication({
                          ...newMedication,
                          reminders: newMedication.reminders.filter(
                            (_, i) => i !== index
                          ),
                        })
                      }
                    >
                      <Minus size={16} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() =>
                  setNewMedication({
                    ...newMedication,
                    reminders: [...newMedication.reminders, { time: '' }],
                  })
                }
              >
                <Plus size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Notes */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'ملاحظات' : 'Notes'} ({isRTL ? 'اختياري' : 'Optional'})
              </Text>
              <TextInput
                style={[styles.textArea, isRTL && styles.rtlInput]}
                value={newMedication.notes}
                onChangeText={(text) =>
                  setNewMedication({ ...newMedication, notes: text })
                }
                placeholder={isRTL ? 'أضف ملاحظات...' : 'Add notes...'}
                multiline
                numberOfLines={3}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                loading && styles.submitButtonDisabled,
              ]}
              onPress={handleAddMedication}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? (isRTL ? 'جاري الإضافة...' : 'Adding...') : t('add')}
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
  },
  headerAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressText: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
    minWidth: 80,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 12,
  },
  medicationsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  medicationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  medicationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  medicationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 2,
  },
  medicationDosage: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginBottom: 4,
  },
  medicationTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  medicationTimeText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
  },
  checkButton: {
    minWidth: 50,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkButtonTaken: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  rtlInput: {
    fontFamily: 'Cairo-Regular',
  },
  frequencyGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  frequencyChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  frequencyChipText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  frequencyChipTextSelected: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    textAlign: 'center',
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    textAlign: 'center',
  },
  medicationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  remindersList: {
    marginBottom: 8,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reminderInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    backgroundColor: '#FFFFFF',
  },
  removeButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  addButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  remindersDisplay: {
    flexDirection: 'column',
    gap: 4,
    marginRight: 8,
  },
  reminderTimeText: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginTop: 2,
  },
  reminderTimeTaken: {
    color: '#FFFFFF',
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  memberBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  memberBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#6366F1',
  },
  // Member selection styles
  memberSelectionContainer: {
    gap: 8,
  },
  memberOption: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberOptionSelected: {
    backgroundColor: '#EBF4FF',
    borderColor: '#2563EB',
  },
  memberInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1E293B',
  },
  memberNameSelected: {
    color: '#2563EB',
  },
  memberRole: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  memberRoleSelected: {
    color: '#2563EB',
    backgroundColor: '#EBF4FF',
  },
});

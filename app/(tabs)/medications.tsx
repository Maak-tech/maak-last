import React, { useState } from 'react';
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
import { Plus, Clock, Bell, Check, X, Pill } from 'lucide-react-native';

const SAMPLE_MEDICATIONS = [
  {
    id: '1',
    name: 'Vitamin D',
    dosage: '1000 IU',
    frequency: 'Once daily',
    nextDose: '2:00 PM',
    taken: false,
    color: '#10B981',
  },
  {
    id: '2',
    name: 'Omega-3',
    dosage: '1 capsule',
    frequency: 'Twice daily',
    nextDose: '6:00 PM',
    taken: true,
    color: '#2563EB',
  },
  {
    id: '3',
    name: 'Calcium',
    dosage: '500mg',
    frequency: 'With meals',
    nextDose: '8:00 PM',
    taken: false,
    color: '#F59E0B',
  },
];

const FREQUENCY_OPTIONS = [
  { key: 'once', labelEn: 'Once daily', labelAr: 'مرة واحدة يومياً' },
  { key: 'twice', labelEn: 'Twice daily', labelAr: 'مرتان يومياً' },
  { key: 'thrice', labelEn: 'Three times daily', labelAr: 'ثلاث مرات يومياً' },
  { key: 'meals', labelEn: 'With meals', labelAr: 'مع الوجبات' },
  { key: 'needed', labelEn: 'As needed', labelAr: 'عند الحاجة' },
];

export default function MedicationsScreen() {
  const { t, i18n } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [medications, setMedications] = useState(SAMPLE_MEDICATIONS);
  const [newMedication, setNewMedication] = useState({
    name: '',
    dosage: '',
    frequency: '',
    reminderTime: '',
    notes: '',
  });

  const isRTL = i18n.language === 'ar';

  const handleAddMedication = () => {
    if (!newMedication.name || !newMedication.dosage || !newMedication.frequency) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in all required fields'
      );
      return;
    }

    const medication = {
      id: Date.now().toString(),
      name: newMedication.name,
      dosage: newMedication.dosage,
      frequency: newMedication.frequency,
      nextDose: newMedication.reminderTime || '9:00 AM',
      taken: false,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
    };

    setMedications([...medications, medication]);
    setNewMedication({
      name: '',
      dosage: '',
      frequency: '',
      reminderTime: '',
      notes: '',
    });
    setShowAddModal(false);

    Alert.alert(
      isRTL ? 'تمت الإضافة' : 'Added Successfully',
      isRTL ? 'تم إضافة الدواء بنجاح' : 'Medication has been added successfully'
    );
  };

  const toggleMedicationTaken = (id: string) => {
    setMedications(medications.map(med => 
      med.id === id ? { ...med, taken: !med.taken } : med
    ));
  };

  const getTodayStats = () => {
    const totalMeds = medications.length;
    const takenMeds = medications.filter(med => med.taken).length;
    return { totalMeds, takenMeds };
  };

  const { totalMeds, takenMeds } = getTodayStats();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>{t('medications')}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Today's Progress */}
        <View style={styles.progressCard}>
          <Text style={[styles.progressTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'تقدم اليوم' : "Today's Progress"}
          </Text>
          <View style={styles.progressInfo}>
            <Text style={[styles.progressText, isRTL && styles.rtlText]}>
              {takenMeds}/{totalMeds} {isRTL ? 'مأخوذة' : 'taken'}
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${totalMeds > 0 ? (takenMeds / totalMeds) * 100 : 0}%` }
                ]} 
              />
            </View>
          </View>
        </View>

        {/* Today's Medications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'أدوية اليوم' : "Today's Medications"}
          </Text>
          
          <View style={styles.medicationsList}>
            {medications.map((medication) => (
              <View key={medication.id} style={styles.medicationItem}>
                <View style={styles.medicationLeft}>
                  <View 
                    style={[
                      styles.medicationIcon, 
                      { backgroundColor: `${medication.color}20` }
                    ]}
                  >
                    <Pill size={20} color={medication.color} />
                  </View>
                  
                  <View style={styles.medicationInfo}>
                    <Text style={[styles.medicationName, isRTL && styles.rtlText]}>
                      {medication.name}
                    </Text>
                    <Text style={[styles.medicationDosage, isRTL && styles.rtlText]}>
                      {medication.dosage} • {medication.frequency}
                    </Text>
                    <View style={styles.medicationTime}>
                      <Clock size={12} color="#64748B" />
                      <Text style={[styles.medicationTimeText, isRTL && styles.rtlText]}>
                        {isRTL ? 'الجرعة القادمة' : 'Next dose'}: {medication.nextDose}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.checkButton,
                    medication.taken && styles.checkButtonTaken,
                  ]}
                  onPress={() => toggleMedicationTaken(medication.id)}
                >
                  {medication.taken && <Check size={16} color="#FFFFFF" />}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Medication Reminders */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'التذكيرات القادمة' : 'Upcoming Reminders'}
          </Text>
          
          <View style={styles.remindersList}>
            {medications.filter(med => !med.taken).slice(0, 3).map((medication) => (
              <View key={medication.id} style={styles.reminderItem}>
                <Bell size={16} color="#F59E0B" />
                <Text style={[styles.reminderText, isRTL && styles.rtlText]}>
                  {medication.name} - {medication.nextDose}
                </Text>
              </View>
            ))}
          </View>
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
              {t('addMedication')}
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Medication Name */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t('medicationName')} *
              </Text>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlInput]}
                value={newMedication.name}
                onChangeText={(text) => setNewMedication({...newMedication, name: text})}
                placeholder={isRTL ? 'اسم الدواء' : 'Enter medication name'}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Dosage */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t('dosage')} *
              </Text>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlInput]}
                value={newMedication.dosage}
                onChangeText={(text) => setNewMedication({...newMedication, dosage: text})}
                placeholder={isRTL ? 'مثل: 500 مجم، قرص واحد' : 'e.g., 500mg, 1 tablet'}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Frequency */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t('frequency')} *
              </Text>
              <View style={styles.frequencyOptions}>
                {FREQUENCY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.frequencyOption,
                      newMedication.frequency === (isRTL ? option.labelAr : option.labelEn) && 
                      styles.frequencyOptionSelected,
                    ]}
                    onPress={() => setNewMedication({
                      ...newMedication, 
                      frequency: isRTL ? option.labelAr : option.labelEn
                    })}
                  >
                    <Text
                      style={[
                        styles.frequencyOptionText,
                        newMedication.frequency === (isRTL ? option.labelAr : option.labelEn) && 
                        styles.frequencyOptionTextSelected,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL ? option.labelAr : option.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Reminder Time */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'وقت التذكير' : 'Reminder Time'}
              </Text>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlInput]}
                value={newMedication.reminderTime}
                onChangeText={(text) => setNewMedication({...newMedication, reminderTime: text})}
                placeholder={isRTL ? 'مثل: 9:00 صباحاً' : 'e.g., 9:00 AM'}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Notes */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'ملاحظات' : 'Notes'} ({isRTL ? 'اختياري' : 'Optional'})
              </Text>
              <TextInput
                style={[styles.textAreaInput, isRTL && styles.rtlInput]}
                value={newMedication.notes}
                onChangeText={(text) => setNewMedication({...newMedication, notes: text})}
                placeholder={isRTL ? 'تعليمات خاصة...' : 'Special instructions...'}
                multiline
                numberOfLines={3}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleAddMedication}
            >
              <Text style={styles.saveButtonText}>{t('save')}</Text>
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
  addButton: {
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
    width: 32,
    height: 32,
    borderRadius: 16,
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
  remindersList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  reminderText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E293B',
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
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    backgroundColor: '#FFFFFF',
  },
  textAreaInput: {
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
  frequencyOptions: {
    gap: 8,
  },
  frequencyOption: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  frequencyOptionSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  frequencyOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  frequencyOptionTextSelected: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
  },
});
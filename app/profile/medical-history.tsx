import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { medicalHistoryService } from '@/lib/services/medicalHistoryService';
import {
  ArrowLeft,
  Heart,
  User,
  Users,
  Calendar,
  AlertCircle,
  TrendingUp,
  FileText,
  Plus,
  Search,
  X,
  Save,
  Edit,
  Trash2,
} from 'lucide-react-native';
import { MedicalHistory } from '@/types';

const SEVERITY_OPTIONS = [
  { key: 'mild', labelEn: 'Mild', labelAr: 'خفيف' },
  { key: 'moderate', labelEn: 'Moderate', labelAr: 'متوسط' },
  { key: 'severe', labelEn: 'Severe', labelAr: 'شديد' },
];

export default function MedicalHistoryScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'personal' | 'family'>('personal');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newCondition, setNewCondition] = useState({
    condition: '',
    severity: 'mild' as 'mild' | 'moderate' | 'severe',
    diagnosedDate: new Date(),
    notes: '',
    isFamily: false,
    relation: '',
  });

  const isRTL = i18n.language === 'ar';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadMedicalHistory();
  }, [user]);

  const loadMedicalHistory = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [history, summaryData] = await Promise.all([
        medicalHistoryService.getUserMedicalHistory(user.id),
        medicalHistoryService.getMedicalHistorySummary(user.id),
      ]);

      setMedicalHistory(history);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading medical history:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL
          ? 'حدث خطأ أثناء تحميل التاريخ الطبي'
          : 'An error occurred while loading medical history'
      );
    } finally {
      setLoading(false);
    }
  };

  const personalHistory = medicalHistory.filter((h) => !h.isFamily);
  const familyHistory = medicalHistory.filter((h) => h.isFamily);

  const handleAddCondition = async () => {
    if (!newCondition.condition.trim()) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'يرجى إدخال اسم الحالة الطبية' : 'Please enter the medical condition'
      );
      return;
    }

    if (!user?.id) return;

    setAddLoading(true);
    try {
      const medicalData: Omit<MedicalHistory, 'id' | 'userId'> = {
        condition: newCondition.condition.trim(),
        severity: newCondition.severity,
        diagnosedDate: newCondition.diagnosedDate,
        notes: newCondition.notes.trim() || undefined,
        isFamily: newCondition.isFamily,
        relation: newCondition.isFamily ? newCondition.relation : undefined,
      };

      await medicalHistoryService.addMedicalHistory(user.id, medicalData);
      
      // Reset form
      setNewCondition({
        condition: '',
        severity: 'mild',
        diagnosedDate: new Date(),
        notes: '',
        isFamily: false,
        relation: '',
      });
      
      setShowAddModal(false);
      await loadMedicalHistory();

      Alert.alert(
        isRTL ? 'تم الحفظ' : 'Saved',
        isRTL ? 'تم إضافة السجل الطبي بنجاح' : 'Medical record added successfully'
      );
    } catch (error) {
      console.error('Error adding medical history:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'حدث خطأ في إضافة السجل الطبي' : 'Failed to add medical record'
      );
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteCondition = async (id: string) => {
    Alert.alert(
      isRTL ? 'حذف السجل' : 'Delete Record',
      isRTL ? 'هل أنت متأكد من حذف هذا السجل الطبي؟' : 'Are you sure you want to delete this medical record?',
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
              await medicalHistoryService.deleteMedicalHistory(id);
              await loadMedicalHistory();
              Alert.alert(
                isRTL ? 'تم الحذف' : 'Deleted',
                isRTL ? 'تم حذف السجل الطبي بنجاح' : 'Medical record deleted successfully'
              );
            } catch (error) {
              console.error('Error deleting medical history:', error);
              Alert.alert(
                isRTL ? 'خطأ' : 'Error',
                isRTL ? 'حدث خطأ في حذف السجل الطبي' : 'Failed to delete medical record'
              );
            }
          },
        },
      ]
    );
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'mild':
        return '#10B981';
      case 'moderate':
        return '#F59E0B';
      case 'severe':
        return '#EF4444';
      default:
        return '#64748B';
    }
  };

  const getSeverityText = (severity?: string) => {
    const severityMap = {
      mild: isRTL ? 'خفيف' : 'Mild',
      moderate: isRTL ? 'متوسط' : 'Moderate',
      severe: isRTL ? 'شديد' : 'Severe',
    };
    return severityMap[severity as keyof typeof severityMap] || severity;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
          onPress={() => router.back()}
        >
          <ArrowLeft
            size={24}
            color="#1E293B"
            style={[isRTL && { transform: [{ rotate: '180deg' }] }]}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {isRTL ? 'التاريخ الطبي' : 'Medical History'}
        </Text>

        <TouchableOpacity 
          style={styles.searchButton}
          onPress={() => setShowAddModal(true)}
        >
          <Plus size={20} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
              {isRTL
                ? 'جاري تحميل التاريخ الطبي...'
                : 'Loading medical history...'}
            </Text>
          </View>
        ) : medicalHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <FileText size={40} color="#94A3B8" />
            </View>
            <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'لا توجد سجلات طبية' : 'No Medical Records'}
            </Text>
            <Text style={[styles.emptyDescription, isRTL && styles.rtlText]}>
              {isRTL
                ? 'ابدأ بإضافة حالاتك الطبية والأدوية'
                : 'Start by adding your medical conditions and medications'}
            </Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={[styles.addButtonText, isRTL && styles.rtlText]}>
                {isRTL ? 'إضافة سجل' : 'Add Record'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Tab Selector */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'personal' && styles.activeTab,
                ]}
                onPress={() => setActiveTab('personal')}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'personal' && styles.activeTabText,
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL ? 'شخصي' : 'Personal'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'family' && styles.activeTab,
                ]}
                onPress={() => setActiveTab('family')}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'family' && styles.activeTabText,
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL ? 'عائلي' : 'Family'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Medical Records List */}
            <View style={styles.recordsList}>
              {(activeTab === 'personal' ? personalHistory : familyHistory).map((record) => (
                <View key={record.id} style={styles.recordItem}>
                  <View style={styles.recordLeft}>
                    <View style={styles.recordIcon}>
                      <Heart size={20} color={getSeverityColor(record.severity)} />
                    </View>
                    <View style={styles.recordInfo}>
                      <Text style={[styles.recordCondition, isRTL && styles.rtlText]}>
                        {record.condition}
                      </Text>
                      <View style={styles.recordMeta}>
                        <View
                          style={[
                            styles.severityBadge,
                            { backgroundColor: getSeverityColor(record.severity) + '20' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.severityText,
                              { color: getSeverityColor(record.severity) },
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {getSeverityText(record.severity)}
                          </Text>
                        </View>
                        {record.diagnosedDate && (
                          <Text style={[styles.recordDate, isRTL && styles.rtlText]}>
                            {new Date(record.diagnosedDate).toLocaleDateString(
                              isRTL ? 'ar-SA' : 'en-US'
                            )}
                          </Text>
                        )}
                      </View>
                      {record.notes && (
                        <Text style={[styles.recordNotes, isRTL && styles.rtlText]}>
                          {record.notes}
                        </Text>
                      )}
                      {record.isFamily && record.relation && (
                        <Text style={[styles.recordRelation, isRTL && styles.rtlText]}>
                          {isRTL ? `للـ ${record.relation}` : `for ${record.relation}`}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.recordActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDeleteCondition(record.id)}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {/* Add Record Button */}
            <TouchableOpacity 
              style={styles.floatingAddButton}
              onPress={() => setShowAddModal(true)}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={[styles.floatingAddText, isRTL && styles.rtlText]}>
                {isRTL ? 'إضافة سجل جديد' : 'Add New Record'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Add Medical History Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'إضافة سجل طبي' : 'Add Medical Record'}
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Condition Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'الحالة الطبية' : 'Medical Condition'} *
              </Text>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlInput]}
                value={newCondition.condition}
                onChangeText={(text) =>
                  setNewCondition({ ...newCondition, condition: text })
                }
                placeholder={isRTL ? 'مثال: داء السكري، ضغط الدم' : 'e.g., Diabetes, Hypertension'}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Severity Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'شدة الحالة' : 'Severity'}
              </Text>
              <View style={styles.severityOptions}>
                {SEVERITY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.severityOption,
                      newCondition.severity === option.key && styles.severityOptionSelected,
                    ]}
                    onPress={() =>
                      setNewCondition({
                        ...newCondition,
                        severity: option.key as 'mild' | 'moderate' | 'severe',
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.severityOptionText,
                        newCondition.severity === option.key && styles.severityOptionTextSelected,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL ? option.labelAr : option.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'ملاحظات' : 'Notes'} ({isRTL ? 'اختياري' : 'Optional'})
              </Text>
              <TextInput
                style={[styles.textArea, isRTL && styles.rtlInput]}
                value={newCondition.notes}
                onChangeText={(text) =>
                  setNewCondition({ ...newCondition, notes: text })
                }
                placeholder={isRTL ? 'أضف ملاحظات...' : 'Add notes...'}
                multiline
                numberOfLines={3}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                addLoading && styles.saveButtonDisabled,
              ]}
              onPress={handleAddCondition}
              disabled={addLoading}
            >
              {addLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Save size={20} color="#FFFFFF" />
              )}
              <Text style={styles.saveButtonText}>
                {addLoading 
                  ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                  : (isRTL ? 'حفظ السجل' : 'Save Record')}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonRTL: {
    transform: [{ scaleX: -1 }],
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  comingSoon: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 100,
    paddingHorizontal: 32,
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
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
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#2563EB',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  recordsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  recordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recordInfo: {
    flex: 1,
  },
  recordCondition: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 4,
  },
  recordMeta: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontFamily: 'Inter-Medium',
  },
  recordDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
  },
  recordNotes: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginBottom: 2,
  },
  recordRelation: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#6366F1',
  },
  recordActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  floatingAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 20,
    marginBottom: 32,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingAddText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
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
  severityOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  severityOption: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  severityOptionSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  severityOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  severityOptionTextSelected: {
    color: '#FFFFFF',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 20,
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});

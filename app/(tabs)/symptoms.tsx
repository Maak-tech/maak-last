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
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus, Calendar, TrendingUp, X } from 'lucide-react-native';

const COMMON_SYMPTOMS = [
  { key: 'headache', severity: 3 },
  { key: 'fever', severity: 4 },
  { key: 'cough', severity: 2 },
  { key: 'fatigue', severity: 3 },
  { key: 'nausea', severity: 2 },
  { key: 'dizziness', severity: 1 },
  { key: 'chestPain', severity: 4 },
  { key: 'backPain', severity: 3 },
];

export default function SymptomsScreen() {
  const { t, i18n } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSymptom, setSelectedSymptom] = useState('');
  const [customSymptom, setCustomSymptom] = useState('');
  const [severity, setSeverity] = useState(1);
  const [description, setDescription] = useState('');

  const isRTL = i18n.language === 'ar';

  const handleAddSymptom = () => {
    // Add symptom logic here
    console.log('Adding symptom:', {
      symptom: selectedSymptom || customSymptom,
      severity,
      description,
      timestamp: new Date(),
    });
    
    // Reset form
    setSelectedSymptom('');
    setCustomSymptom('');
    setSeverity(1);
    setDescription('');
    setShowAddModal(false);
  };

  const renderSeveritySelector = () => (
    <View style={styles.severityContainer}>
      <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
        {t('severity')} ({severity}/5)
      </Text>
      <View style={styles.severityButtons}>
        {[1, 2, 3, 4, 5].map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.severityButton,
              severity >= level && styles.severityButtonActive,
            ]}
            onPress={() => setSeverity(level)}
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
        <Text style={[styles.severityLabel, isRTL && styles.rtlText]}>{t('mild')}</Text>
        <Text style={[styles.severityLabel, isRTL && styles.rtlText]}>{t('verySevere')}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>{t('symptoms')}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <TrendingUp size={20} color="#2563EB" />
            <Text style={[styles.statValue, isRTL && styles.rtlText]}>12</Text>
            <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
              {isRTL ? 'هذا الأسبوع' : 'This Week'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Calendar size={20} color="#10B981" />
            <Text style={[styles.statValue, isRTL && styles.rtlText]}>3</Text>
            <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
              {isRTL ? 'اليوم' : 'Today'}
            </Text>
          </View>
        </View>

        {/* Recent Symptoms */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'الأعراض الأخيرة' : 'Recent Symptoms'}
          </Text>
          
          <View style={styles.symptomsList}>
            {COMMON_SYMPTOMS.slice(0, 5).map((symptom, index) => (
              <View key={index} style={styles.symptomItem}>
                <View style={styles.symptomInfo}>
                  <Text style={[styles.symptomName, isRTL && styles.rtlText]}>
                    {t(symptom.key)}
                  </Text>
                  <Text style={[styles.symptomTime, isRTL && styles.rtlText]}>
                    {index === 0 ? '2 hours ago' : index === 1 ? '1 day ago' : `${index + 1} days ago`}
                  </Text>
                </View>
                
                <View style={styles.severityDisplay}>
                  {[...Array(5)].map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.severityDot,
                        i < symptom.severity && styles.severityDotActive,
                      ]}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Weekly Trends */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'الاتجاهات الأسبوعية' : 'Weekly Trends'}
          </Text>
          
          <View style={styles.trendsContainer}>
            <Text style={[styles.trendsText, isRTL && styles.rtlText]}>
              {isRTL 
                ? 'الأعراض الأكثر شيوعاً هذا الأسبوع: الصداع والإرهاق'
                : 'Most common symptoms this week: Headache and Fatigue'
              }
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Add Symptom Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {t('logSymptom')}
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Common Symptoms */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'الأعراض الشائعة' : 'Common Symptoms'}
              </Text>
              <View style={styles.symptomsGrid}>
                {COMMON_SYMPTOMS.map((symptom) => (
                  <TouchableOpacity
                    key={symptom.key}
                    style={[
                      styles.symptomChip,
                      selectedSymptom === symptom.key && styles.symptomChipSelected,
                    ]}
                    onPress={() => {
                      setSelectedSymptom(symptom.key);
                      setCustomSymptom('');
                    }}
                  >
                    <Text
                      style={[
                        styles.symptomChipText,
                        selectedSymptom === symptom.key && styles.symptomChipTextSelected,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {t(symptom.key)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Custom Symptom */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'أو أدخل عرضاً مخصصاً' : 'Or enter custom symptom'}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  isRTL && styles.rtlInput,
                ]}
                value={customSymptom}
                onChangeText={(text) => {
                  setCustomSymptom(text);
                  setSelectedSymptom('');
                }}
                placeholder={isRTL ? 'اكتب العرض هنا' : 'Type symptom here'}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Severity */}
            {renderSeveritySelector()}

            {/* Description */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t('description')} ({isRTL ? 'اختياري' : 'Optional'})
              </Text>
              <TextInput
                style={[
                  styles.textAreaInput,
                  isRTL && styles.rtlInput,
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder={isRTL ? 'إضافة تفاصيل أكثر...' : 'Add more details...'}
                multiline
                numberOfLines={4}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.saveButton,
                (!selectedSymptom && !customSymptom) && styles.saveButtonDisabled,
              ]}
              onPress={handleAddSymptom}
              disabled={!selectedSymptom && !customSymptom}
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
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
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
  symptomsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  symptomItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  symptomInfo: {
    flex: 1,
  },
  symptomName: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1E293B',
    marginBottom: 2,
  },
  symptomTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
  },
  severityDisplay: {
    flexDirection: 'row',
    gap: 4,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
  },
  severityDotActive: {
    backgroundColor: '#EF4444',
  },
  trendsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  trendsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    lineHeight: 20,
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
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  symptomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  symptomChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  symptomChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  symptomChipText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  symptomChipTextSelected: {
    color: '#FFFFFF',
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
  severityContainer: {
    marginBottom: 24,
  },
  severityButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  severityButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  severityButtonActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  severityButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  severityButtonTextActive: {
    color: '#FFFFFF',
  },
  severityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  severityLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: {
    backgroundColor: '#CBD5E1',
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
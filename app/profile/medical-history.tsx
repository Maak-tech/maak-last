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
} from 'lucide-react-native';
import { MedicalHistory } from '@/types';

export default function MedicalHistoryScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'personal' | 'family'>('personal');

  const isRTL = i18n.language === 'ar';

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

        <TouchableOpacity style={styles.searchButton}>
          <Search size={20} color="#2563EB" />
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
                ? 'ابدأ بإضافة حالاتك الطبية من قسم الأعراض'
                : 'Start by adding your medical conditions from the symptoms section'}
            </Text>
            <TouchableOpacity style={styles.addButton}>
              <Plus size={16} color="#FFFFFF" />
              <Text style={[styles.addButtonText, isRTL && styles.rtlText]}>
                {isRTL ? 'إضافة سجل' : 'Add Record'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[styles.comingSoon, isRTL && styles.rtlText]}>
            {isRTL
              ? 'جاري تطوير واجهة عرض التاريخ الطبي...'
              : 'Medical history display interface is being developed...'}
          </Text>
        )}
      </ScrollView>
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
});

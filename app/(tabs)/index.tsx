import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useFallDetection } from '@/hooks/useFallDetection';
import { useNotifications } from '@/hooks/useNotifications';
import {
  Heart,
  Activity,
  Pill,
  Users,
  AlertTriangle,
  Shield,
  Bell,
  TrendingUp,
} from 'lucide-react-native';

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [fallDetectionEnabled, setFallDetectionEnabled] = useState(false);
  const { scheduleMedicationReminder } = useNotifications();

  const isRTL = i18n.language === 'ar';

  const handleFallDetected = () => {
    Alert.alert(
      'Fall Detected',
      'A fall has been detected. Emergency contacts will be notified if you do not respond within 30 seconds.',
      [
        {
          text: 'I\'m OK',
          style: 'default',
        },
        {
          text: 'Call Emergency',
          style: 'destructive',
          onPress: () => {
            // Handle emergency call
            console.log('Emergency call initiated');
          },
        },
      ]
    );
  };

  const { isActive: fallDetectionActive, startFallDetection, stopFallDetection } = useFallDetection(handleFallDetected);

  const toggleFallDetection = () => {
    if (fallDetectionActive) {
      stopFallDetection();
      setFallDetectionEnabled(false);
    } else {
      startFallDetection();
      setFallDetectionEnabled(true);
    }
  };

  const dashboardStats = [
    {
      title: isRTL ? 'الأعراض المسجلة' : 'Symptoms Logged',
      value: '12',
      subtitle: isRTL ? 'هذا الأسبوع' : 'This week',
      icon: Activity,
      color: '#EF4444',
    },
    {
      title: isRTL ? 'الأدوية المتناولة' : 'Medications Taken', 
      value: '8/10',
      subtitle: isRTL ? 'اليوم' : 'Today',
      icon: Pill,
      color: '#10B981',
    },
    {
      title: isRTL ? 'نقاط الصحة' : 'Health Score',
      value: '85',
      subtitle: isRTL ? 'جيد' : 'Good',
      icon: TrendingUp,
      color: '#2563EB',
    },
    {
      title: isRTL ? 'أفراد العائلة' : 'Family Members',
      value: '4',
      subtitle: isRTL ? 'نشط' : 'Active',
      icon: Users,
      color: '#F59E0B',
    },
  ];

  const recentSymptoms = [
    { type: isRTL ? 'صداع' : 'Headache', severity: 3, time: '2 hours ago' },
    { type: isRTL ? 'إرهاق' : 'Fatigue', severity: 2, time: '1 day ago' },
    { type: isRTL ? 'سعال' : 'Cough', severity: 1, time: '2 days ago' },
  ];

  const upcomingMedications = [
    { name: 'Vitamin D', time: '2:00 PM', dosage: '1000 IU' },
    { name: 'Omega-3', time: '6:00 PM', dosage: '1 capsule' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, isRTL && styles.rtlText]}>
              {isRTL ? `مرحباً، ${user?.name}` : `Hello, ${user?.name}`}
            </Text>
            <Text style={[styles.subGreeting, isRTL && styles.rtlText]}>
              {isRTL ? 'كيف تشعر اليوم؟' : 'How are you feeling today?'}
            </Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Bell size={24} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Fall Detection Card */}
        <View style={[styles.fallDetectionCard, fallDetectionEnabled && styles.fallDetectionActive]}>
          <View style={styles.fallDetectionHeader}>
            <Shield size={24} color={fallDetectionEnabled ? '#10B981' : '#64748B'} />
            <Text style={[styles.fallDetectionTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'كشف السقوط' : 'Fall Detection'}
            </Text>
          </View>
          <Text style={[styles.fallDetectionDesc, isRTL && styles.rtlText]}>
            {fallDetectionEnabled 
              ? (isRTL ? 'نشط - سيتم إشعار جهات الاتصال في حالة الطوارئ' : 'Active - Emergency contacts will be notified')
              : (isRTL ? 'غير نشط - اضغط لتفعيل الحماية' : 'Inactive - Tap to enable protection')
            }
          </Text>
          <TouchableOpacity
            style={[styles.fallDetectionButton, fallDetectionEnabled && styles.fallDetectionButtonActive]}
            onPress={toggleFallDetection}
          >
            <Text style={[styles.fallDetectionButtonText, fallDetectionEnabled && styles.fallDetectionButtonTextActive]}>
              {fallDetectionEnabled ? (isRTL ? 'إيقاف' : 'Turn Off') : (isRTL ? 'تفعيل' : 'Turn On')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Health Overview Stats */}
        <View style={styles.statsContainer}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t('healthOverview')}
          </Text>
          <View style={styles.statsGrid}>
            {dashboardStats.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <View key={index} style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}>
                    <IconComponent size={20} color={stat.color} />
                  </View>
                  <Text style={[styles.statValue, isRTL && styles.rtlText]}>{stat.value}</Text>
                  <Text style={[styles.statTitle, isRTL && styles.rtlText]}>{stat.title}</Text>
                  <Text style={[styles.statSubtitle, isRTL && styles.rtlText]}>{stat.subtitle}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent Symptoms */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t('recentSymptoms')}
            </Text>
            <TouchableOpacity>
              <Text style={[styles.viewAllText, isRTL && styles.rtlText]}>
                {isRTL ? 'عرض الكل' : 'View All'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.symptomsList}>
            {recentSymptoms.map((symptom, index) => (
              <View key={index} style={styles.symptomItem}>
                <View style={styles.symptomInfo}>
                  <Text style={[styles.symptomType, isRTL && styles.rtlText]}>
                    {symptom.type}
                  </Text>
                  <Text style={[styles.symptomTime, isRTL && styles.rtlText]}>
                    {symptom.time}
                  </Text>
                </View>
                <View style={styles.severityIndicator}>
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

        {/* Upcoming Medications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t('upcomingMeds')}
            </Text>
            <TouchableOpacity>
              <Text style={[styles.viewAllText, isRTL && styles.rtlText]}>
                {isRTL ? 'عرض الكل' : 'View All'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.medicationsList}>
            {upcomingMedications.map((medication, index) => (
              <View key={index} style={styles.medicationItem}>
                <View style={styles.medicationIcon}>
                  <Pill size={20} color="#10B981" />
                </View>
                <View style={styles.medicationInfo}>
                  <Text style={[styles.medicationName, isRTL && styles.rtlText]}>
                    {medication.name}
                  </Text>
                  <Text style={[styles.medicationDosage, isRTL && styles.rtlText]}>
                    {medication.dosage}
                  </Text>
                </View>
                <Text style={[styles.medicationTime, isRTL && styles.rtlText]}>
                  {medication.time}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'إجراءات سريعة' : 'Quick Actions'}
          </Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickActionButton}>
              <Activity size={24} color="#2563EB" />
              <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                {t('logSymptom')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton}>
              <Pill size={24} color="#10B981" />
              <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                {t('addMedication')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fallDetectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fallDetectionActive: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  fallDetectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fallDetectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginLeft: 8,
  },
  fallDetectionDesc: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 20,
  },
  fallDetectionButton: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  fallDetectionButtonActive: {
    backgroundColor: '#10B981',
  },
  fallDetectionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  fallDetectionButtonTextActive: {
    color: '#FFFFFF',
  },
  statsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#2563EB',
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
  symptomType: {
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
  severityIndicator: {
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  medicationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1E293B',
    marginBottom: 2,
  },
  medicationDosage: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
  },
  medicationTime: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#2563EB',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E293B',
    marginTop: 8,
    textAlign: 'center',
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
  },
});
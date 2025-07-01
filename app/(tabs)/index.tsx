import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import {
  Heart,
  AlertTriangle,
  Pill,
  Activity,
  Users,
  TrendingUp,
  ChevronRight,
  User,
} from 'lucide-react-native';
import { symptomService } from '@/lib/services/symptomService';
import { medicationService } from '@/lib/services/medicationService';
import { alertService } from '@/lib/services/alertService';
import { userService } from '@/lib/services/userService';
import { Symptom, Medication, User as UserType } from '@/types';
import FamilyDataFilter, {
  FilterOption,
} from '@/app/components/FamilyDataFilter';

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentSymptoms, setRecentSymptoms] = useState<Symptom[]>([]);
  const [todaysMedications, setTodaysMedications] = useState<Medication[]>([]);
  const [alertsCount, setAlertsCount] = useState(0);
  const [familyMembersCount, setFamilyMembersCount] = useState(0);
  const [stats, setStats] = useState({
    symptomsThisWeek: 0,
    avgSeverity: 0,
    medicationCompliance: 0,
  });
  const [familyMembers, setFamilyMembers] = useState<UserType[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>({
    id: 'personal',
    type: 'personal',
    label: '',
  });

  const isRTL = i18n.language === 'ar';
  const isAdmin = user?.role === 'admin';
  const hasFamily = Boolean(user?.familyId);

  const getMemberName = (userId: string): string => {
    if (userId === user?.id) {
      return isRTL ? 'أنت' : 'You';
    }
    const member = familyMembers.find((m) => m.id === userId);
    return member?.name || (isRTL ? 'عضو غير معروف' : 'Unknown Member');
  };

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Always load family members first if user has family
      let members: UserType[] = [];
      if (user.familyId) {
        members = await userService.getFamilyMembers(user.familyId);
        setFamilyMembers(members);
        setFamilyMembersCount(members.length);
      }

      // Reset daily reminders first
      await medicationService.resetDailyReminders(user.id);

      // Load data based on selected filter
      if (selectedFilter.type === 'family' && user.familyId) {
        // Load family data (both admins and members can view)
        const [
          familySymptoms,
          familyMedications,
          alertsCountData,
          familySymptomStats,
        ] = await Promise.all([
          symptomService.getFamilySymptoms(user.familyId, 5),
          medicationService.getFamilyTodaysMedications(user.familyId),
          alertService.getActiveAlertsCount(user.id), // Keep personal alerts for now
          symptomService.getFamilySymptomStats(user.familyId, 7),
        ]);

        setRecentSymptoms(familySymptoms);
        setTodaysMedications(familyMedications);
        setAlertsCount(alertsCountData);

        // Calculate family medication compliance
        const today = new Date().toDateString();
        const totalReminders = familyMedications.reduce((sum, med) => {
          const reminders = Array.isArray(med.reminders) ? med.reminders : [];
          return sum + reminders.length;
        }, 0);

        const takenReminders = familyMedications.reduce((sum, med) => {
          const reminders = Array.isArray(med.reminders) ? med.reminders : [];
          return (
            sum +
            reminders.filter((r) => {
              if (!r.taken || !r.takenAt) return false;
              const takenDate = (r.takenAt as any).toDate
                ? (r.takenAt as any).toDate()
                : new Date(r.takenAt);
              const takenToday = takenDate.toDateString() === today;
              return takenToday;
            }).length
          );
        }, 0);

        const compliance =
          totalReminders > 0 ? (takenReminders / totalReminders) * 100 : 100;

        setStats({
          symptomsThisWeek: familySymptomStats.totalSymptoms,
          avgSeverity: familySymptomStats.avgSeverity,
          medicationCompliance: Math.round(compliance),
        });
      } else if (selectedFilter.type === 'member' && selectedFilter.memberId) {
        // Load specific member data (both admins and members can view)
        const [
          memberSymptoms,
          memberMedications,
          alertsCountData,
          memberSymptomStats,
          memberMedicationStats,
        ] = await Promise.all([
          symptomService.getMemberSymptoms(selectedFilter.memberId, 5),
          medicationService.getMemberTodaysMedications(selectedFilter.memberId),
          alertService.getActiveAlertsCount(user.id), // Keep personal alerts for now
          symptomService.getMemberSymptomStats(selectedFilter.memberId, 7),
          medicationService.getMemberMedicationStats(selectedFilter.memberId),
        ]);

        setRecentSymptoms(memberSymptoms);
        setTodaysMedications(memberMedications);
        setAlertsCount(alertsCountData);

        setStats({
          symptomsThisWeek: memberSymptomStats.totalSymptoms,
          avgSeverity: memberSymptomStats.avgSeverity,
          medicationCompliance: memberMedicationStats.todaysCompliance,
        });
      } else {
        // Load personal data (default)
        const [symptoms, medications, alertsCountData, symptomStats] =
          await Promise.all([
            symptomService.getUserSymptoms(user.id, 5),
            medicationService.getTodaysMedications(user.id),
            alertService.getActiveAlertsCount(user.id),
            symptomService.getSymptomStats(user.id, 7),
          ]);

        setRecentSymptoms(symptoms);
        setTodaysMedications(medications);
        setAlertsCount(alertsCountData);

        // Calculate personal medication compliance
        const today = new Date().toDateString();
        const totalReminders = medications.reduce((sum, med) => {
          const reminders = Array.isArray(med.reminders) ? med.reminders : [];
          return sum + reminders.length;
        }, 0);

        const takenReminders = medications.reduce((sum, med) => {
          const reminders = Array.isArray(med.reminders) ? med.reminders : [];
          return (
            sum +
            reminders.filter((r) => {
              if (!r.taken || !r.takenAt) return false;
              const takenDate = (r.takenAt as any).toDate
                ? (r.takenAt as any).toDate()
                : new Date(r.takenAt);
              const takenToday = takenDate.toDateString() === today;
              return takenToday;
            }).length
          );
        }, 0);

        const compliance =
          totalReminders > 0 ? (takenReminders / totalReminders) * 100 : 100;

        setStats({
          symptomsThisWeek: symptomStats.totalSymptoms,
          avgSeverity: symptomStats.avgSeverity,
          medicationCompliance: Math.round(compliance),
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user, selectedFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleFilterChange = (filter: FilterOption) => {
    setSelectedFilter(filter);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSeverityColor = (severity: number) => {
    switch (severity) {
      case 1:
        return '#10B981';
      case 2:
        return '#F59E0B';
      case 3:
        return '#EF4444';
      case 4:
        return '#DC2626';
      case 5:
        return '#991B1B';
      default:
        return '#6B7280';
    }
  };

  const getDataSourceLabel = () => {
    if (selectedFilter.type === 'family') {
      return isRTL ? 'بيانات العائلة' : 'Family Data';
    } else if (selectedFilter.type === 'member') {
      return isRTL
        ? `بيانات ${selectedFilter.memberName}`
        : `${selectedFilter.memberName}'s Data`;
    } else {
      return isRTL ? 'بياناتي الشخصية' : 'My Personal Data';
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>
            Please log in to view your dashboard
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.welcomeText, isRTL && styles.rtlText]}>
            {isRTL ? `مرحباً، ${user.name}` : `Welcome, ${user.name}`}
          </Text>
          <Text style={[styles.dateText, isRTL && styles.rtlText]}>
            {new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* Enhanced Data Filter */}
        <FamilyDataFilter
          familyMembers={familyMembers}
          currentUserId={user.id}
          selectedFilter={selectedFilter}
          onFilterChange={handleFilterChange}
          isAdmin={isAdmin}
          hasFamily={hasFamily}
        />

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Activity size={24} color="#2563EB" />
            <Text style={[styles.statValue, isRTL && styles.rtlText]}>
              {stats.symptomsThisWeek}
            </Text>
            <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
              {isRTL ? 'الأعراض هذا الأسبوع' : 'Symptoms This Week'}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Pill size={24} color="#10B981" />
            <Text style={[styles.statValue, isRTL && styles.rtlText]}>
              {stats.medicationCompliance}%
            </Text>
            <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
              {isRTL ? 'الالتزام بالدواء' : 'Med Compliance'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/(tabs)/family')}
          >
            <Users size={24} color="#8B5CF6" />
            <Text style={[styles.statValue, isRTL && styles.rtlText]}>
              {familyMembersCount}
            </Text>
            <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
              {isRTL ? 'أفراد العائلة' : 'Family Members'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Alerts */}
        {alertsCount > 0 && (
          <TouchableOpacity style={styles.alertCard}>
            <AlertTriangle size={24} color="#EF4444" />
            <View style={styles.alertContent}>
              <Text style={[styles.alertTitle, isRTL && styles.rtlText]}>
                {isRTL ? 'تنبيهات نشطة' : 'Active Alerts'}
              </Text>
              <Text style={[styles.alertText, isRTL && styles.rtlText]}>
                {isRTL
                  ? `لديك ${alertsCount} تنبيه${
                      alertsCount > 1 ? 'ات' : ''
                    } يتطلب الانتباه`
                  : `You have ${alertsCount} alert${
                      alertsCount > 1 ? 's' : ''
                    } requiring attention`}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Today's Medications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'أدوية اليوم' : "Today's Medications"}
            </Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/(tabs)/medications')}
            >
              <Text style={[styles.viewAllText, isRTL && styles.rtlText]}>
                {isRTL ? 'عرض الكل' : 'View All'}
              </Text>
              <ChevronRight size={16} color="#2563EB" />
            </TouchableOpacity>
          </View>

          {todaysMedications.length > 0 ? (
            todaysMedications.slice(0, 3).map((medication) => (
              <TouchableOpacity
                key={medication.id}
                style={styles.medicationItem}
                onPress={() => router.push('/(tabs)/medications')}
              >
                <View style={styles.medicationIcon}>
                  <Pill size={20} color="#2563EB" />
                </View>
                <View style={styles.medicationInfo}>
                  <Text
                    style={[styles.medicationName, isRTL && styles.rtlText]}
                  >
                    {medication.name}
                  </Text>
                  <Text
                    style={[styles.medicationDosage, isRTL && styles.rtlText]}
                  >
                    {medication.dosage} • {medication.frequency}
                  </Text>
                  {/* Show member name for family/member views */}
                  {(selectedFilter.type === 'family' ||
                    selectedFilter.type === 'member') && (
                    <Text
                      style={[styles.memberIndicator, isRTL && styles.rtlText]}
                    >
                      {isRTL
                        ? `للـ ${getMemberName(medication.userId)}`
                        : `for ${getMemberName(medication.userId)}`}
                    </Text>
                  )}
                </View>
                <View style={styles.medicationStatus}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          Array.isArray(medication.reminders) &&
                          medication.reminders.some((r) => r.taken)
                            ? '#10B981'
                            : '#F59E0B',
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <TouchableOpacity
              style={styles.emptyContainer}
              onPress={() => router.push('/(tabs)/medications')}
            >
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                {isRTL
                  ? 'لا توجد أدوية لليوم - اضغط لإضافة دواء'
                  : 'No medications for today - tap to add'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Symptoms */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'الأعراض الأخيرة' : 'Recent Symptoms'}
            </Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/(tabs)/symptoms')}
            >
              <Text style={[styles.viewAllText, isRTL && styles.rtlText]}>
                {isRTL ? 'عرض الكل' : 'View All'}
              </Text>
              <ChevronRight size={16} color="#2563EB" />
            </TouchableOpacity>
          </View>

          {recentSymptoms.length > 0 ? (
            recentSymptoms.map((symptom) => (
              <TouchableOpacity
                key={symptom.id}
                style={styles.symptomItem}
                onPress={() => router.push('/(tabs)/symptoms')}
              >
                <View style={styles.symptomInfo}>
                  <Text style={[styles.symptomType, isRTL && styles.rtlText]}>
                    {t(symptom.type)}
                  </Text>
                  <Text style={[styles.symptomTime, isRTL && styles.rtlText]}>
                    {formatTime(symptom.timestamp)}
                  </Text>
                  {/* Show member name for family/member views */}
                  {(selectedFilter.type === 'family' ||
                    selectedFilter.type === 'member') && (
                    <Text
                      style={[styles.memberIndicator, isRTL && styles.rtlText]}
                    >
                      {isRTL
                        ? `للـ ${getMemberName(symptom.userId)}`
                        : `for ${getMemberName(symptom.userId)}`}
                    </Text>
                  )}
                </View>
                <View style={styles.severityDisplay}>
                  {[...Array(5)].map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.severityDot,
                        {
                          backgroundColor:
                            i < symptom.severity
                              ? getSeverityColor(symptom.severity)
                              : '#E5E7EB',
                        },
                      ]}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <TouchableOpacity
              style={styles.emptyContainer}
              onPress={() => router.push('/(tabs)/symptoms')}
            >
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                {isRTL
                  ? 'لا توجد أعراض مسجلة - اضغط لإضافة عرض'
                  : 'No symptoms recorded - tap to add'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Health Score */}
        <View style={styles.healthScoreCard}>
          <Heart size={32} color="#EF4444" />
          <View style={styles.healthScoreInfo}>
            <Text style={[styles.healthScoreTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'نقاط الصحة' : 'Health Score'}
            </Text>
            <Text style={[styles.healthScoreValue, isRTL && styles.rtlText]}>
              {Math.max(
                60,
                100 -
                  stats.symptomsThisWeek * 5 -
                  (100 - stats.medicationCompliance)
              )}
            </Text>
            <Text style={[styles.healthScoreDesc, isRTL && styles.rtlText]}>
              {isRTL ? 'نقاط من 100' : 'out of 100'}
            </Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
    textAlign: 'center',
  },
  alertCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  alertContent: {
    marginLeft: 12,
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#B91C1C',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#7F1D1D',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  medicationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  medicationIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#EBF4FF',
    borderRadius: 20,
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
    marginBottom: 4,
  },
  medicationDosage: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
  },
  medicationStatus: {
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  symptomItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    marginBottom: 4,
  },
  symptomTime: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
  },
  severityDisplay: {
    flexDirection: 'row',
    gap: 3,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  healthScoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  healthScoreInfo: {
    marginLeft: 16,
    flex: 1,
  },
  healthScoreTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginBottom: 4,
  },
  healthScoreValue: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
  },
  healthScoreDesc: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    textAlign: 'center',
  },
  rtlText: {
    textAlign: 'right',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#2563EB',
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  viewModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  viewModeLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginRight: 12,
  },
  viewModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewModeOption: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
  },
  viewModeOptionActive: {
    borderColor: '#2563EB',
  },
  viewModeText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  viewModeTextActive: {
    color: '#2563EB',
  },
  familyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  familyIndicatorText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginLeft: 8,
  },
  memberIndicator: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6366F1',
    marginTop: 2,
  },
});

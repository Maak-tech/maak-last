import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { router, useFocusEffect } from 'expo-router';
import { createThemedStyles, getTextStyle } from '@/utils/styles';
import {
  Heart,
  AlertTriangle,
  Pill,
  Activity,
  Users,
  TrendingUp,
  ChevronRight,
  User,
  Phone,
  AlertCircle,
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
  const { theme } = useTheme();
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
  
  // Create themed styles
  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
      padding: theme.spacing.base,
    },
    header: {
      marginBottom: theme.spacing.xl,
    },
    welcomeText: {
      ...getTextStyle(theme, 'heading', 'bold', theme.colors.primary.main),
      marginBottom: 4,
    },
    dateText: {
      ...getTextStyle(theme, 'body', 'regular', theme.colors.text.secondary),
    },
    statsContainer: {
      flexDirection: 'row' as const,
      marginBottom: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.base,
      alignItems: 'center' as const,
      ...theme.shadows.md,
    },
    statValue: {
      ...getTextStyle(theme, 'heading', 'bold', theme.colors.secondary.main),
      marginTop: theme.spacing.sm,
      marginBottom: 4,
    },
    statLabel: {
      ...getTextStyle(theme, 'caption', 'medium', theme.colors.text.secondary),
      textAlign: 'center' as const,
    },
    alertCard: {
      backgroundColor: theme.colors.accent.error + '10',
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.xl,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.accent.error,
    },
    alertContent: {
      marginLeft: theme.spacing.md,
      flex: 1,
    },
    alertTitle: {
      ...getTextStyle(theme, 'subheading', 'bold', theme.colors.accent.error),
      marginBottom: 4,
    },
    alertText: {
      ...getTextStyle(theme, 'body', 'regular', theme.colors.accent.error),
    },
    section: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.base,
      ...theme.shadows.md,
    },
    sectionTitle: {
      ...getTextStyle(theme, 'subheading', 'bold', theme.colors.primary.main),
      marginBottom: theme.spacing.base,
    },
    sectionHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: theme.spacing.base,
    },
    viewAllButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
    },
    viewAllText: {
      ...getTextStyle(theme, 'body', 'medium', theme.colors.primary.main),
    },
    medicationItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    medicationIcon: {
      width: 40,
      height: 40,
      backgroundColor: theme.colors.primary[50],
      borderRadius: 20,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      marginRight: theme.spacing.md,
    },
    medicationInfo: {
      flex: 1,
    },
    medicationName: {
      ...getTextStyle(theme, 'body', 'semibold', theme.colors.text.primary),
      marginBottom: 4,
    },
    medicationDosage: {
      ...getTextStyle(theme, 'caption', 'regular', theme.colors.text.secondary),
    },
    medicationStatus: {
      alignItems: 'center' as const,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    symptomItem: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    symptomInfo: {
      flex: 1,
    },
    symptomType: {
      ...getTextStyle(theme, 'body', 'semibold', theme.colors.text.primary),
      marginBottom: 4,
    },
    symptomTime: {
      ...getTextStyle(theme, 'caption', 'regular', theme.colors.text.secondary),
    },
    severityDisplay: {
      flexDirection: 'row' as const,
      gap: 3,
    },
    severityDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    healthScoreCard: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      marginBottom: theme.spacing.xl,
      ...theme.shadows.md,
    },
    healthScoreInfo: {
      marginLeft: theme.spacing.base,
      flex: 1,
    },
    healthScoreTitle: {
      ...getTextStyle(theme, 'body', 'medium', theme.colors.text.secondary),
      marginBottom: 4,
    },
    healthScoreValue: {
      ...getTextStyle(theme, 'heading', 'bold', theme.colors.accent.success),
      fontSize: 32,
    },
    healthScoreDesc: {
      ...getTextStyle(theme, 'caption', 'regular', theme.colors.text.secondary),
    },
    emptyText: {
      ...getTextStyle(theme, 'body', 'regular', theme.colors.text.tertiary),
      textAlign: 'center' as const,
      fontStyle: 'italic' as const,
      paddingVertical: theme.spacing.lg,
    },
    emptyContainer: {
      paddingVertical: theme.spacing.lg,
      alignItems: 'center' as const,
    },
    errorText: {
      ...getTextStyle(theme, 'body', 'regular', theme.colors.accent.error),
      textAlign: 'center' as const,
    },
    rtlText: {
      textAlign: 'right' as const,
    },
    memberIndicator: {
      ...getTextStyle(theme, 'caption', 'medium', theme.colors.secondary.main),
      marginTop: 2,
    },
    sosButton: {
      backgroundColor: theme.colors.accent.error,
      borderRadius: theme.borderRadius.full,
      width: 60,
      height: 60,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      position: 'absolute' as const,
      bottom: theme.spacing.xl,
      right: theme.spacing.base,
      ...theme.shadows.lg,
      zIndex: 1000,
    },
    sosButtonText: {
      ...getTextStyle(theme, 'caption', 'bold', theme.colors.neutral.white),
      fontSize: 10,
      marginTop: 2,
    },
    headerWithSOS: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'flex-start' as const,
      marginBottom: theme.spacing.xl,
    },
    headerContent: {
      flex: 1,
    },
    sosHeaderButton: {
      backgroundColor: theme.colors.accent.error,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: theme.spacing.sm,
      ...theme.shadows.md,
    },
    sosHeaderText: {
      ...getTextStyle(theme, 'body', 'bold', theme.colors.neutral.white),
    },
    onelineCard: {
      backgroundColor: theme.colors.secondary[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.secondary.main,
      ...theme.shadows.sm,
    },
    onelineText: {
      ...getTextStyle(theme, 'subheading', 'semibold', theme.colors.primary.main),
      fontStyle: 'italic' as const,
      marginBottom: theme.spacing.sm,
      textAlign: 'center' as const,
    },
    onelineSource: {
      ...getTextStyle(theme, 'caption', 'medium', theme.colors.secondary.main),
      textAlign: 'center' as const,
    },
    quickActionsGrid: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: theme.spacing.md,
    },
    quickActionCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      alignItems: 'center' as const,
      ...theme.shadows.sm,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
    },
    quickActionText: {
      ...getTextStyle(theme, 'caption', 'medium', theme.colors.text.primary),
      marginTop: theme.spacing.sm,
      textAlign: 'center' as const,
    },
  }))(theme);

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

  // Refresh data when tab is focused
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [user, selectedFilter])
  );

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
    return theme.colors.severity[severity as keyof typeof theme.colors.severity] || theme.colors.neutral[500];
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

  const handleSOS = () => {
    console.log('🚨 SOS button pressed!');
    
    // Try to provide haptic feedback, but don't let errors prevent the alert
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
        // Silently fail if haptics is not available
      });
    } catch (error) {
      // Silently fail if haptics is not available
    }
    
    // Show alert immediately
    Alert.alert(
      isRTL ? 'طوارئ' : 'Emergency',
      isRTL 
        ? 'هل تريد الاتصال بخدمات الطوارئ؟'
        : 'Do you want to call emergency services?',
      [
        {
          text: isRTL ? 'إلغاء' : 'Cancel',
          style: 'cancel',
        },
        {
          text: isRTL ? 'اتصال بـ 911' : 'Call 911',
          style: 'destructive',
          onPress: () => {
            Linking.openURL('tel:911').catch((error) => {
              console.error('Error opening phone:', error);
              Alert.alert(
                isRTL ? 'خطأ' : 'Error',
                isRTL 
                  ? 'تعذر فتح تطبيق الهاتف'
                  : 'Unable to open phone app'
              );
            });
          },
        },
        {
          text: isRTL ? 'إشعار العائلة' : 'Notify Family',
          onPress: () => {
            // TODO: Implement family notification
            Alert.alert(
              isRTL ? 'تم إرسال الإشعار' : 'Notification Sent',
              isRTL 
                ? 'تم إرسال إشعار طوارئ لجميع أفراد العائلة'
                : 'Emergency notification sent to all family members'
            );
          },
        },
      ],
      { cancelable: true }
    );
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
        {/* Header with SOS Button */}
        <View style={styles.headerWithSOS}>
          <View style={styles.headerContent}>
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
          <TouchableOpacity 
            style={styles.sosHeaderButton} 
            onPress={handleSOS}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Phone size={20} color={theme.colors.neutral.white} />
            <Text style={styles.sosHeaderText}>
              {isRTL ? 'SOS' : 'SOS'}
            </Text>
          </TouchableOpacity>
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
            <Activity size={24} color={theme.colors.primary.main} />
            <Text style={[styles.statValue, isRTL && styles.rtlText]}>
              {stats.symptomsThisWeek}
            </Text>
            <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
              {isRTL ? 'الأعراض هذا الأسبوع' : 'Symptoms This Week'}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Pill size={24} color={theme.colors.accent.success} />
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
            <Users size={24} color={theme.colors.secondary.main} />
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
            <AlertTriangle size={24} color={theme.colors.accent.error} />
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
              <ChevronRight size={16} color={theme.colors.primary.main} />
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
                  <Pill size={20} color={theme.colors.primary.main} />
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
                            ? theme.colors.accent.success
                            : theme.colors.secondary.main,
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
              <ChevronRight size={16} color={theme.colors.primary.main} />
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
                              : theme.colors.neutral[200],
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

        {/* Health Score with Maak One-liner */}
        <View style={styles.healthScoreCard}>
          <Heart size={32} color={theme.colors.accent.error} />
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

        {/* Quick Actions Hub */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'إجراءات سريعة' : 'Quick Actions'}
            </Text>
          </View>

          <View style={styles.quickActionsGrid}>
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/track')}
            >
              <Activity size={24} color={theme.colors.primary.main} />
              <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                {isRTL ? 'تتبع الصحة' : 'Track Health'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/medications')}
            >
              <Pill size={24} color={theme.colors.accent.success} />
              <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                {isRTL ? 'إدارة الأدوية' : 'Medications'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/vitals')}
            >
              <Heart size={24} color={theme.colors.secondary.main} />
              <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                {isRTL ? 'المؤشرات الحيوية' : 'Vital Signs'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/family')}
            >
              <Users size={24} color={theme.colors.primary.light} />
              <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                {isRTL ? 'إدارة العائلة' : 'Manage Family'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Maak One-liner */}
        <View style={styles.onelineCard}>
          <Text style={[styles.onelineText, isRTL && styles.rtlText]}>
            {isRTL ? '"خليهم دايمًا معك"' : '"Health starts at home"'}
          </Text>
          <Text style={[styles.onelineSource, isRTL && styles.rtlText]}>
            - Maak
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

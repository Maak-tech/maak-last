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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
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
            Linking.openURL('tel:911');
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
      ]
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
<<<<<<< Updated upstream
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
=======
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container as ViewStyle}
    >
      <View style={{ flex: 1, marginBottom: 80 }}>
        <ScrollView
          contentContainerStyle={[
            styles.contentInner as ViewStyle,
            { paddingBottom: 20 + insets.bottom },
            isRTL && styles.contentInnerRTL,
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl onRefresh={onRefresh} refreshing={refreshing} />
          }
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          style={styles.content as ViewStyle}
        >
          {/* Wavy Header */}
          <View
            style={[
              styles.wavyHeaderWrapper as ViewStyle,
              isRTL && styles.wavyHeaderWrapperRTL,
            ]}
          >
            <WavyBackground
              contentPosition="top"
              curve="home"
              height={228}
              variant="gold"
            >
              <View
                style={[
                  styles.wavyHeaderContent as ViewStyle,
                  {
                    paddingTop: wavyHeaderTopPadding + (isRTL ? 2 : 0),
                  },
                  isRTL && styles.wavyHeaderContentRTL,
                ]}
              >
                <View style={styles.wavyHeaderTopRow as ViewStyle}>
                  <View
                    style={[
                      styles.headerContent as ViewStyle,
                      isRTL && (styles.headerContentRTL as ViewStyle),
                    ]}
                  >
                    <Heading
                      color={theme.colors.neutral.white}
                      level={2}
                      numberOfLines={isRTL ? 3 : 2}
                      style={[
                        styles.welcomeText,
                        isRTL && styles.welcomeTextRTL,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL
                        ? `مرحباً، ${user.firstName || "User"}`
                        : `Welcome, ${user.firstName || "User"}`}
                    </Heading>
                  </View>

                  <View
                    style={[
                      styles.wavyHeaderActions as ViewStyle,
                      isRTL && (styles.wavyHeaderActionsRTL as ViewStyle),
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={handleSOS}
                      style={[
                        styles.sosHeaderButton as ViewStyle,
                        isRTL && (styles.sosHeaderButtonRTL as ViewStyle),
                      ]}
                    >
                      <Phone color={theme.colors.neutral.white} size={18} />
                      <Text
                        color={theme.colors.neutral.white}
                        style={styles.sosHeaderText as StyleProp<TextStyle>}
                        weight="bold"
                      >
                        SOS
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={handleAlertsBadgePress}
                      style={styles.alertBadgeButton as ViewStyle}
                    >
                      <Bell color={theme.colors.neutral.white} size={22} />
                      {alertsCount > 0 && (
                        <View style={styles.alertBadgeDot as ViewStyle}>
                          <Text
                            style={{
                              color: "#fff",
                              fontSize: 9,
                              fontWeight: "700",
                              lineHeight: 13,
                            }}
                          >
                            {alertsCount > 99 ? "99+" : alertsCount}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.headerDateRow as ViewStyle}>
                  <Text
                    color={theme.colors.secondary.main}
                    numberOfLines={isRTL ? 2 : 1}
                    size="medium"
                    style={[styles.dateText, isRTL && styles.rtlText]}
                    weight="bold"
                  >
                    {safeFormatDate(
                      new Date(),
                      isRTL ? "ar-u-ca-gregory" : "en-US",
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </Text>
                </View>
              </View>
            </WavyBackground>
          </View>

          {/* Render widgets dynamically */}
          {enabledWidgets.map((widgetId) => renderWidget(widgetId))}

          {/* Vital anomaly monitoring — only shown when there are active alerts */}
          <View style={styles.section as ViewStyle}>
            <AnomalyDashboardSection onlyWhenActive={true} />
          </View>

          {/* Proactive health suggestions + top new discovery (unified section) */}
          <View style={styles.section as ViewStyle}>
            <ProactiveHealthSuggestions showDiscoveries={true} />
          </View>

          {/* Alerts Modal */}
          <Modal
            animationType="slide"
            onRequestClose={() => setShowAlertsModal(false)}
            transparent={true}
            visible={showAlertsModal}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                justifyContent: "flex-end",
              }}
            >
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  maxHeight: "80%",
                  padding: 20,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 20,
                  }}
                >
                  <Text
                    style={[
                      {
                        fontSize: 20,
                        fontFamily: "Inter-SemiBold",
                        color: "#1A1D1F",
                      },
                      isRTL && styles.rtlText,
                    ]}
                  >
                    {isRTL
                      ? "التنبيهات الطوارئ الصحية الفعالة"
                      : "Active Emergency Alerts"}
                  </Text>
                  <TouchableOpacity onPress={() => setShowAlertsModal(false)}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: "Inter-Medium",
                        color: "#003543",
                      }}
                    >
                      {isRTL ? "إغلاق" : "Close"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {loadingAlerts ? (
                  <View
                    style={{
                      paddingVertical: theme.spacing.xl,
                      alignItems: "center",
                    }}
                  >
                    <ActivityIndicator color="#003543" size="large" />
                  </View>
                ) : userAlerts.length === 0 ? (
                  <View
                    style={{
                      paddingVertical: 32,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={[
                        {
                          fontSize: 14,
                          fontFamily: "Inter-Regular",
                          color: "#6C7280",
                        },
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL
                        ? "لا توجد تنبيهات طوارئ صحية نشطة"
                        : "No active emergency alerts"}
                    </Text>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {userAlerts.map((alert) => {
                      const severityConfig = {
                        emergency: {
                          bg: "#FEE2E2",
                          border: "#DC2626",
                          icon: "#DC2626",
                        },
                        fall: {
                          bg: "#FEE2E2",
                          border: "#DC2626",
                          icon: "#DC2626",
                        },
                        medication: {
                          bg: "#FEF3C7",
                          border: "#F59E0B",
                          icon: "#F59E0B",
                        },
                        vitals: {
                          bg: "#DBEAFE",
                          border: "#3B82F6",
                          icon: "#3B82F6",
                        },
                      };
                      const config =
                        severityConfig[
                          alert.type as keyof typeof severityConfig
                        ] || severityConfig.emergency;

                      return (
                        <View
                          key={alert.id}
                          style={{
                            backgroundColor: config.bg,
                            borderRadius: 16,
                            padding: 16,
                            marginBottom: 12,
                            borderStartWidth: 4,
                            borderStartColor: config.border,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 2,
                            elevation: 1,
                          }}
                        >
                          <View style={{ flexDirection: "row", gap: 12 }}>
                            <View style={{ marginTop: 2 }}>
                              <AlertCircle color={config.icon} size={20} />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                style={[
                                  {
                                    fontSize: 15,
                                    fontFamily: "Inter-SemiBold",
                                    color: "#1A1D1F",
                                    marginBottom: 4,
                                  },
                                  isRTL && styles.rtlText,
                                ]}
                              >
                                {alert.type === "fall"
                                  ? isRTL
                                    ? "تنبيه سقوط"
                                    : "Fall Detection"
                                  : alert.type === "emergency"
                                    ? isRTL
                                      ? "طوارئ"
                                      : "Emergency"
                                    : alert.type === "medication"
                                      ? isRTL
                                        ? "دواء"
                                        : "Medication"
                                      : isRTL
                                        ? "مؤشرات حيوية"
                                        : "Vitals"}
                              </Text>
                              <Text
                                style={[
                                  {
                                    fontSize: 14,
                                    fontFamily: "Inter-Regular",
                                    color: "#4E5661",
                                    marginBottom: 6,
                                  },
                                  isRTL && styles.rtlText,
                                ]}
                              >
                                {alert.message}
                              </Text>
                              <View
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <Text
                                  style={[
                                    {
                                      fontSize: 12,
                                      fontFamily: "Inter-Regular",
                                      color: "#6C7280",
                                    },
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  {formatDateTime(alert.timestamp)}
                                </Text>
                                <TouchableOpacity
                                  disabled={loadingAlerts}
                                  onPress={async () => {
                                    try {
                                      setLoadingAlerts(true);

                                      await alertService.resolveAlert(
                                        alert.id,
                                        user.id
                                      );

                                      await new Promise((resolve) =>
                                        setTimeout(resolve, 1500)
                                      );

                                      const updatedAlerts =
                                        await alertService.getActiveAlerts(
                                          user.id
                                        );

                                      setUserAlerts(updatedAlerts);
                                      setAlertsCount(updatedAlerts.length);

                                      await loadDashboardData();

                                      if (updatedAlerts.length === 0) {
                                        setShowAlertsModal(false);
                                        Alert.alert(
                                          isRTL ? "نجح" : "Success",
                                          isRTL
                                            ? "تم حل جميع التنبيهات الطوارئ الصحية الفعالة"
                                            : "All alerts resolved"
                                        );
                                      } else {
                                        Alert.alert(
                                          t("success"),
                                          t("alertResolvedSuccessfully")
                                        );
                                      }
                                    } catch (error: any) {
                                      logger.error(
                                        "Failed to resolve alert",
                                        error,
                                        "HomeScreen"
                                      );

                                      const errorMessage =
                                        error?.message || t("unknownError");
                                      let displayMessage = errorMessage;

                                      if (
                                        errorMessage.includes(
                                          "permission-denied"
                                        ) ||
                                        errorMessage.includes("permission")
                                      ) {
                                        displayMessage = isRTL
                                          ? "ليس لديك الصلاحية لحل هذا التنبيه"
                                          : "You don't have permission to resolve this alert";
                                      } else if (
                                        errorMessage.includes(
                                          "does not exist"
                                        ) ||
                                        errorMessage.includes("not found")
                                      ) {
                                        displayMessage = isRTL
                                          ? "التنبيه غير موجود"
                                          : "Alert not found";
                                      }

                                      Alert.alert(
                                        isRTL ? "خطأ" : "Error",
                                        isRTL
                                          ? `فشل في حل التنبيه: ${displayMessage}`
                                          : `Failed to resolve alert: ${displayMessage}`
                                      );
                                    } finally {
                                      setLoadingAlerts(false);
                                    }
                                  }}
                                  style={{
                                    backgroundColor: loadingAlerts
                                      ? "#9CA3AF"
                                      : "#003543",
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 8,
                                    opacity: loadingAlerts ? 0.6 : 1,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      fontFamily: "Inter-SemiBold",
                                      color: "#FFFFFF",
                                    }}
                                  >
                                    {isRTL ? "حل" : "Resolve"}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>

          <Modal
            animationType="fade"
            onRequestClose={handleTourFinish}
            transparent={true}
            visible={showTour && tourSteps.length > 0}
          >
            <View style={styles.tourOverlay as ViewStyle}>
              <View style={styles.tourCard as ViewStyle}>
                <Text
                  style={[styles.tourTitle, isRTL && styles.rtlText]}
                  weight="bold"
                >
                  {activeTourStep.title}
                </Text>
                <Text style={[styles.tourBody, isRTL && styles.rtlText]}>
                  {activeTourStep.body}
                </Text>
                <View style={styles.tourProgressRow as ViewStyle}>
                  <Text style={styles.tourProgressText as StyleProp<TextStyle>}>
                    {tourStep + 1}/{tourSteps.length}
                  </Text>
                  <View style={styles.tourDots as ViewStyle}>
                    {tourSteps.map((_, index) => (
                      <View
                        key={`tour-dot-${index}`}
                        style={[
                          styles.tourDot,
                          index === tourStep && styles.tourDotActive,
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <View style={styles.tourFooter as ViewStyle}>
                  <Pressable
                    onPress={handleTourFinish}
                    style={styles.tourButton as ViewStyle}
                  >
                    <Text style={styles.tourButtonText as StyleProp<TextStyle>}>
                      {isRTL ? "تخطي" : "Skip"}
                    </Text>
                  </Pressable>
                  <View style={styles.tourActions as ViewStyle}>
                    {tourStep > 0 && (
                      <Pressable
                        onPress={handleTourBack}
                        style={styles.tourButton as ViewStyle}
                      >
                        <Text
                          style={styles.tourButtonText as StyleProp<TextStyle>}
                        >
                          {isRTL ? "رجوع" : "Back"}
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={handleTourNext}
                      style={[styles.tourButton, styles.tourButtonPrimary]}
                    >
                      <Text
                        style={[
                          styles.tourButtonText,
                          styles.tourButtonTextPrimary,
                        ]}
                      >
                        {tourStep >= tourSteps.length - 1
                          ? isRTL
                            ? "إنهاء"
                            : "Done"
                          : isRTL
                            ? "التالي"
                            : "Next"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </Modal>

          {/* Health Tracking Section for Regular Users */}
          {!isAdmin && (
            <View style={styles.trackingSection as ViewStyle}>
              <View style={styles.sectionHeader as ViewStyle}>
                <Text
                  style={[
                    styles.sectionTitle,
                    isRTL && styles.rtlText,
                    isRTL && { textAlign: "right" as const },
                  ]}
                >
                  {isRTL ? "تتبع الصحة اليومي" : "Daily Health Tracking"}
                </Text>
              </View>

              {/* First-time user banner — shown only when no data logged yet */}
              {stats.symptomsThisWeek === 0 && (
                <View
                  style={{
                    backgroundColor: theme.colors.primary.main + "12",
                    borderRadius: 12,
                    padding: theme.spacing.sm,
                    marginBottom: theme.spacing.base,
                    flexDirection: isRTL ? "row-reverse" : "row",
                    alignItems: "center",
                    gap: theme.spacing.sm,
                    flexWrap: "wrap" as const,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: theme.colors.text.secondary,
                      fontSize: 13,
                      textAlign: isRTL ? "right" : "left",
                    }}
                  >
                    {isRTL
                      ? "أنت جاهز! ابدأ بتسجيل أول علامة حيوية أو عرض."
                      : "You're all set! Start by logging your first vital or symptom."}
                  </Text>
                  <View
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      gap: theme.spacing.xs,
                    }}
                  >
                    <TouchableOpacity
                      onPress={navigateToVitals}
                      style={{
                        backgroundColor: theme.colors.primary.main,
                        borderRadius: 8,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: theme.colors.neutral.white,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {isRTL ? "علامة حيوية" : "Log a vital"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={navigateToSymptoms}
                      style={{
                        backgroundColor: theme.colors.primary.main + "22",
                        borderRadius: 8,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 6,
                        borderWidth: 1,
                        borderColor: theme.colors.primary.main + "44",
                      }}
                    >
                      <Text
                        style={{
                          color: theme.colors.primary.main,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {isRTL ? "عرض" : "Log a symptom"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.trackingOptions as ViewStyle}>
                {trackingTabs.map((tab) => {
                  const TrackingIcon = tab.icon;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      onPress={tab.onPress}
                      style={styles.trackingCard as ViewStyle}
                    >
                      <View
                        style={[
                          styles.trackingCardIcon,
                          { backgroundColor: tab.iconBackground },
                        ]}
                      >
                        <TrackingIcon color={tab.iconColor} size={28} />
                      </View>
                      <Text
                        style={[
                          styles.trackingCardTitle,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {tab.label}
                      </Text>
                      <Text
                        style={[
                          styles.trackingCardSubtitle,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {tab.description}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Nuralix One-liner */}
          <View style={styles.onelineCard as ViewStyle}>
            <Text style={[styles.onelineText, isRTL && styles.rtlText]}>
              {isRTL
                ? '"لأن الصحة تبدأ من المنزل"'
                : '"Because health starts at home."'}
>>>>>>> Stashed changes
            </Text>
          </View>
          <TouchableOpacity style={styles.sosHeaderButton} onPress={handleSOS}>
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

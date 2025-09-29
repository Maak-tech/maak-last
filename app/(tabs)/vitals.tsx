import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useFocusEffect } from 'expo-router';
import { createThemedStyles, getTextStyle } from '@/utils/styles';
import {
  Heart,
  Activity,
  Moon,
  Scale,
  Thermometer,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Settings,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from 'lucide-react-native';
import { healthDataService, VitalSigns, HealthDataSummary } from '@/lib/services/healthDataService';

interface VitalCard {
  key: string;
  title: string;
  titleAr: string;
  icon: any;
  color: string;
  value: string;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  status?: 'normal' | 'warning' | 'critical';
}

export default function VitalsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [vitals, setVitals] = useState<VitalSigns | null>(null);
  const [summary, setSummary] = useState<HealthDataSummary | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const isRTL = i18n.language === 'ar';

  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.base,
      backgroundColor: theme.colors.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    headerTitle: {
      ...getTextStyle(theme, 'heading', 'bold', theme.colors.primary.main),
      fontSize: 28,
    },
    headerSubtitle: {
      ...getTextStyle(theme, 'body', 'regular', theme.colors.text.secondary),
      marginTop: 4,
    },
    headerActions: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginTop: theme.spacing.base,
    },
    syncInfo: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: theme.spacing.xs,
    },
    syncText: {
      ...getTextStyle(theme, 'caption', 'regular', theme.colors.text.tertiary),
    },
    syncButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: theme.colors.primary.main,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      gap: theme.spacing.xs,
    },
    syncButtonText: {
      ...getTextStyle(theme, 'caption', 'bold', theme.colors.neutral.white),
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
    },
    permissionCard: {
      backgroundColor: theme.colors.secondary[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.xl,
      margin: theme.spacing.lg,
      alignItems: 'center' as const,
      borderWidth: 2,
      borderColor: theme.colors.secondary.main,
    },
    permissionIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.secondary.main,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      marginBottom: theme.spacing.lg,
    },
    permissionTitle: {
      ...getTextStyle(theme, 'subheading', 'bold', theme.colors.primary.main),
      textAlign: 'center' as const,
      marginBottom: theme.spacing.base,
    },
    permissionDescription: {
      ...getTextStyle(theme, 'body', 'regular', theme.colors.text.secondary),
      textAlign: 'center' as const,
      lineHeight: 22,
      marginBottom: theme.spacing.xl,
    },
    enableButton: {
      backgroundColor: theme.colors.secondary.main,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.base,
      borderRadius: theme.borderRadius.lg,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: theme.spacing.sm,
    },
    enableButtonText: {
      ...getTextStyle(theme, 'button', 'bold', theme.colors.neutral.white),
    },
    vitalsGrid: {
      paddingTop: theme.spacing.lg,
    },
    vitalsRow: {
      flexDirection: 'row' as const,
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    vitalCard: {
      flex: 1,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      ...theme.shadows.md,
    },
    vitalCardLarge: {
      flex: 2,
    },
    vitalHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: theme.spacing.md,
    },
    vitalIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    vitalTrend: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 2,
    },
    vitalTitle: {
      ...getTextStyle(theme, 'caption', 'medium', theme.colors.text.secondary),
      marginBottom: 4,
    },
    vitalValue: {
      ...getTextStyle(theme, 'heading', 'bold', theme.colors.text.primary),
      fontSize: 24,
    },
    vitalValueLarge: {
      fontSize: 32,
    },
    vitalUnit: {
      ...getTextStyle(theme, 'caption', 'regular', theme.colors.text.tertiary),
      marginTop: 2,
    },
    statusIndicator: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    },
    statusText: {
      ...getTextStyle(theme, 'caption', 'medium'),
      fontSize: 12,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      paddingTop: 100,
    },
    loadingText: {
      ...getTextStyle(theme, 'body', 'medium', theme.colors.text.secondary),
      marginTop: theme.spacing.base,
    },
    onelineCard: {
      backgroundColor: theme.colors.secondary[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginVertical: theme.spacing.lg,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.secondary.main,
      alignItems: 'center' as const,
      ...theme.shadows.sm,
    },
    onelineText: {
      ...getTextStyle(theme, 'subheading', 'semibold', theme.colors.primary.main),
      fontStyle: 'italic' as const,
      textAlign: 'center' as const,
      marginBottom: theme.spacing.sm,
    },
    onelineSource: {
      ...getTextStyle(theme, 'caption', 'medium', theme.colors.secondary.main),
    },
    rtlText: {
      textAlign: 'right' as const,
    },
  }))(theme);

  const loadVitalsData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Check permissions first
      const permissions = await healthDataService.hasHealthPermissions();
      setHasPermissions(permissions);

      if (permissions) {
        // Get latest vitals and summary
        const [vitalsData, summaryData] = await Promise.all([
          healthDataService.getLatestVitals(),
          healthDataService.getHealthSummary(),
        ]);

        setVitals(vitalsData);
        setSummary(summaryData);
        setLastSync(new Date());
      }
    } catch (error) {
      console.error('Error loading vitals:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'حدث خطأ في تحميل البيانات الصحية' : 'Error loading health data'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadVitalsData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVitalsData();
    }, [])
  );

  const handleEnableHealthData = async () => {
    try {
      setLoading(true);
      const granted = await healthDataService.requestHealthPermissions();
      
      if (granted) {
        setHasPermissions(true);
        await loadVitalsData();
        Alert.alert(
          isRTL ? 'تم التفعيل' : 'Enabled',
          isRTL 
            ? 'تم تفعيل دمج البيانات الصحية بنجاح'
            : 'Health data integration enabled successfully'
        );
      } else {
        Alert.alert(
          isRTL ? 'فشل التفعيل' : 'Permission Denied',
          isRTL 
            ? 'يرجى السماح بالوصول للبيانات الصحية في الإعدادات'
            : 'Please allow access to health data in Settings'
        );
      }
    } catch (error) {
      console.error('Error enabling health data:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'حدث خطأ في تفعيل دمج البيانات الصحية' : 'Error enabling health data integration'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSyncData = async () => {
    try {
      setRefreshing(true);
      await healthDataService.syncHealthData();
      await loadVitalsData(true);
    } catch (error) {
      console.error('Error syncing data:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'حدث خطأ في مزامنة البيانات' : 'Error syncing data'
      );
    }
  };

  const getVitalCards = (): VitalCard[] => {
    if (!vitals || !summary) return [];

    const formatted = healthDataService.formatVitalSigns(vitals);

    return [
      {
        key: 'heartRate',
        title: 'Heart Rate',
        titleAr: 'معدل ضربات القلب',
        icon: Heart,
        color: theme.colors.accent.error,
        value: vitals.heartRate?.toString() || '0',
        unit: 'BPM',
        trend: summary.heartRate.trend,
        status: vitals.heartRate && vitals.heartRate > 100 ? 'warning' : 'normal',
      },
      {
        key: 'steps',
        title: 'Steps Today',
        titleAr: 'خطوات اليوم',
        icon: Activity,
        color: theme.colors.primary.main,
        value: vitals.steps?.toLocaleString() || '0',
        unit: 'steps',
        trend: 'stable',
        status: vitals.steps && vitals.steps >= summary.steps.goal ? 'normal' : 'warning',
      },
      {
        key: 'sleep',
        title: 'Sleep Last Night',
        titleAr: 'النوم الليلة الماضية',
        icon: Moon,
        color: theme.colors.accent.info,
        value: vitals.sleepHours?.toFixed(1) || '0',
        unit: 'hours',
        trend: 'stable',
        status: vitals.sleepHours && vitals.sleepHours >= 7 ? 'normal' : 'warning',
      },
      {
        key: 'weight',
        title: 'Weight',
        titleAr: 'الوزن',
        icon: Scale,
        color: theme.colors.accent.success,
        value: vitals.weight?.toFixed(1) || '0',
        unit: 'kg',
        trend: summary.weight.trend,
        status: 'normal',
      },
    ];
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up':
        return TrendingUp;
      case 'down':
        return TrendingDown;
      default:
        return Minus;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'normal':
        return theme.colors.accent.success;
      case 'warning':
        return theme.colors.secondary.main;
      case 'critical':
        return theme.colors.accent.error;
      default:
        return theme.colors.text.tertiary;
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            Please log in to view vitals
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
            {isRTL ? 'جاري تحميل البيانات الصحية...' : 'Loading health data...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasPermissions) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIcon}>
            <Heart size={40} color={theme.colors.neutral.white} />
          </View>
          <Text style={[styles.permissionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'دمج البيانات الصحية' : 'Health Data Integration'}
          </Text>
          <Text style={[styles.permissionDescription, isRTL && styles.rtlText]}>
            {isRTL 
              ? `ادمج بياناتك الصحية من ${Platform.OS === 'ios' ? 'تطبيق الصحة' : 'Google Fit'} لمراقبة أفضل لصحتك ومعرفة المؤشرات الحيوية`
              : `Connect your health data from ${Platform.OS === 'ios' ? 'Health App' : 'Google Fit'} to get comprehensive health monitoring and vital signs tracking`}
          </Text>
          <TouchableOpacity 
            style={styles.enableButton}
            onPress={handleEnableHealthData}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.colors.neutral.white} />
            ) : (
              <Heart size={20} color={theme.colors.neutral.white} />
            )}
            <Text style={styles.enableButtonText}>
              {loading 
                ? (isRTL ? 'جاري التفعيل...' : 'Enabling...')
                : (isRTL ? 'تفعيل الدمج' : 'Enable Integration')}
            </Text>
          </TouchableOpacity>
          
          <Text style={[styles.permissionDescription, { marginTop: theme.spacing.lg, fontSize: 12 }]}>
            {isRTL 
              ? 'سيطلب منك الموافقة على قراءة: معدل ضربات القلب، الخطوات، النوم، الوزن'
              : 'You will be asked to approve reading: Heart rate, Steps, Sleep, Weight'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const vitalCards = getVitalCards();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {isRTL ? 'المؤشرات الحيوية' : 'Vital Signs'}
        </Text>
        <Text style={[styles.headerSubtitle, isRTL && styles.rtlText]}>
          {isRTL ? 'مراقبة صحتك من مصادر متعددة' : 'Monitor your health from multiple sources'}
        </Text>
        
        <View style={styles.headerActions}>
          <View style={styles.syncInfo}>
            {lastSync && (
              <>
                <CheckCircle size={12} color={theme.colors.accent.success} />
                <Text style={[styles.syncText, isRTL && styles.rtlText]}>
                  {isRTL 
                    ? `آخر مزامنة: ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : `Last sync: ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </Text>
              </>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.syncButton}
            onPress={handleSyncData}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={theme.colors.neutral.white} />
            ) : (
              <RefreshCw size={16} color={theme.colors.neutral.white} />
            )}
            <Text style={styles.syncButtonText}>
              {refreshing 
                ? (isRTL ? 'مزامنة...' : 'Syncing...')
                : (isRTL ? 'مزامنة' : 'Sync')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadVitalsData(true)}
            tintColor={theme.colors.primary.main}
          />
        }
      >
        {/* Vitals Grid */}
        <View style={styles.vitalsGrid}>
          {/* First Row - Heart Rate (large) + Steps */}
          <View style={styles.vitalsRow}>
            {vitalCards.slice(0, 2).map((vital, index) => {
              const IconComponent = vital.icon;
              const TrendIcon = getTrendIcon(vital.trend);
              const isLarge = index === 0;
              
              return (
                <View 
                  key={vital.key} 
                  style={[
                    styles.vitalCard,
                    isLarge && styles.vitalCardLarge,
                  ]}
                >
                  <View style={styles.vitalHeader}>
                    <View style={[
                      styles.vitalIcon,
                      { backgroundColor: vital.color + '20' }
                    ]}>
                      <IconComponent size={20} color={vital.color} />
                    </View>
                    <View style={styles.vitalTrend}>
                      <TrendIcon size={12} color={getStatusColor(vital.status)} />
                    </View>
                  </View>
                  
                  <Text style={[styles.vitalTitle, isRTL && styles.rtlText]}>
                    {isRTL ? vital.titleAr : vital.title}
                  </Text>
                  
                  <Text style={[
                    styles.vitalValue, 
                    isLarge && styles.vitalValueLarge,
                    isRTL && styles.rtlText
                  ]}>
                    {vital.value}
                  </Text>
                  
                  <Text style={[styles.vitalUnit, isRTL && styles.rtlText]}>
                    {vital.unit}
                  </Text>
                  
                  <View style={styles.statusIndicator}>
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: getStatusColor(vital.status),
                    }} />
                    <Text style={[
                      styles.statusText,
                      { color: getStatusColor(vital.status) },
                      isRTL && styles.rtlText
                    ]}>
                      {vital.status === 'normal' 
                        ? (isRTL ? 'طبيعي' : 'Normal')
                        : vital.status === 'warning'
                        ? (isRTL ? 'انتباه' : 'Attention')
                        : (isRTL ? 'خطر' : 'Critical')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Second Row - Sleep + Weight */}
          <View style={styles.vitalsRow}>
            {vitalCards.slice(2, 4).map((vital) => {
              const IconComponent = vital.icon;
              const TrendIcon = getTrendIcon(vital.trend);
              
              return (
                <View key={vital.key} style={styles.vitalCard}>
                  <View style={styles.vitalHeader}>
                    <View style={[
                      styles.vitalIcon,
                      { backgroundColor: vital.color + '20' }
                    ]}>
                      <IconComponent size={20} color={vital.color} />
                    </View>
                    <View style={styles.vitalTrend}>
                      <TrendIcon size={12} color={getStatusColor(vital.status)} />
                    </View>
                  </View>
                  
                  <Text style={[styles.vitalTitle, isRTL && styles.rtlText]}>
                    {isRTL ? vital.titleAr : vital.title}
                  </Text>
                  
                  <Text style={[styles.vitalValue, isRTL && styles.rtlText]}>
                    {vital.value}
                  </Text>
                  
                  <Text style={[styles.vitalUnit, isRTL && styles.rtlText]}>
                    {vital.unit}
                  </Text>
                  
                  <View style={styles.statusIndicator}>
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: getStatusColor(vital.status),
                    }} />
                    <Text style={[
                      styles.statusText,
                      { color: getStatusColor(vital.status) },
                      isRTL && styles.rtlText
                    ]}>
                      {vital.status === 'normal' 
                        ? (isRTL ? 'طبيعي' : 'Normal')
                        : vital.status === 'warning'
                        ? (isRTL ? 'انتباه' : 'Attention')
                        : (isRTL ? 'خطر' : 'Critical')}
                    </Text>
                  </View>
                </View>
              );
            })}
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
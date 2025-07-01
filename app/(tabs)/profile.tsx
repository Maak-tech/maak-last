import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { firebaseValidation } from '@/lib/services/firebaseValidation';
import { symptomService } from '@/lib/services/symptomService';
import { medicationService } from '@/lib/services/medicationService';

import {
  User,
  Settings,
  Bell,
  Shield,
  Globe,
  Heart,
  FileText,
  HelpCircle,
  LogOut,
  ChevronRight,
  Activity,
  Calendar,
  Phone,
  Check,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Symptom, Medication, MedicalHistory } from '@/types';

interface ProfileSectionItem {
  icon: any;
  label: string;
  onPress?: () => void;
  hasSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void | Promise<void>;
  value?: string;
}

interface ProfileSection {
  title: string;
  items: ProfileSectionItem[];
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [fallDetectionEnabled, setFallDetectionEnabled] = useState(true);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState({
    symptoms: [] as Symptom[],
    medications: [] as Medication[],
    healthScore: 85,
  });

  const isRTL = i18n.language === 'ar';

  useEffect(() => {
    loadUserSettings();
    loadHealthData();
  }, [user]);

  const loadUserSettings = async () => {
    try {
      const notifications = await AsyncStorage.getItem('notifications_enabled');
      const fallDetection = await AsyncStorage.getItem(
        'fall_detection_enabled'
      );

      if (notifications !== null) {
        setNotificationsEnabled(JSON.parse(notifications));
      }
      if (fallDetection !== null) {
        setFallDetectionEnabled(JSON.parse(fallDetection));
      }
    } catch (error) {
      console.log('Error loading settings:', error);
    }
  };

  const loadHealthData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [symptoms, medications] = await Promise.all([
        symptomService.getUserSymptoms(user.id),
        medicationService.getUserMedications(user.id),
      ]);

      // Calculate health score based on recent symptoms and medication compliance
      const recentSymptoms = symptoms.filter(
        (s) =>
          new Date(s.timestamp).getTime() >
          Date.now() - 30 * 24 * 60 * 60 * 1000
      );
      const activeMedications = medications.filter((m) => m.isActive);

      let score = 100;
      score -= recentSymptoms.length * 5; // Reduce score for recent symptoms
      score = Math.max(score, 0);

      setHealthData({
        symptoms: recentSymptoms,
        medications: activeMedications,
        healthScore: score,
      });
    } catch (error) {
      console.error('Error loading health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem('notifications_enabled', JSON.stringify(value));
  };

  const handleFallDetectionToggle = async (value: boolean) => {
    setFallDetectionEnabled(value);
    await AsyncStorage.setItem('fall_detection_enabled', JSON.stringify(value));
  };

  const handleLanguageChange = async (languageCode: 'en' | 'ar') => {
    await i18n.changeLanguage(languageCode);
    await AsyncStorage.setItem('app_language', languageCode);
    setLanguagePickerVisible(false);
  };

  const handlePersonalInfo = () => {
    router.push('/profile/personal-info');
  };

  const handleMedicalHistory = () => {
    router.push('/profile/medical-history');
  };

  const handleHealthReports = () => {
    if (
      healthData.symptoms.length === 0 &&
      healthData.medications.length === 0
    ) {
      Alert.alert(
        isRTL ? 'التقارير الصحية' : 'Health Reports',
        isRTL
          ? 'لا توجد بيانات صحية كافية لإنشاء تقرير. ابدأ بتسجيل الأعراض والأدوية.'
          : 'Not enough health data to generate reports. Start by logging symptoms and medications.',
        [{ text: isRTL ? 'موافق' : 'OK' }]
      );
      return;
    }

    const report = `${isRTL ? 'نقاط الصحة' : 'Health Score'}: ${
      healthData.healthScore
    }/100\n${isRTL ? 'الأعراض الأخيرة' : 'Recent Symptoms'}: ${
      healthData.symptoms.length
    }\n${isRTL ? 'الأدوية النشطة' : 'Active Medications'}: ${
      healthData.medications.length
    }`;

    Alert.alert(isRTL ? 'التقرير الصحي' : 'Health Report', report, [
      { text: isRTL ? 'موافق' : 'OK' },
      {
        text: isRTL ? 'تصدير' : 'Export',
        onPress: () => {
          Alert.alert(
            isRTL ? 'قريباً' : 'Coming Soon',
            isRTL
              ? 'ستتوفر إمكانية تصدير التقارير قريباً'
              : 'Report export will be available soon'
          );
        },
      },
    ]);
  };

  const handleHelpSupport = () => {
    router.push('/profile/help-support');
  };

  const handleTermsConditions = () => {
    router.push('/profile/terms-conditions');
  };

  const handlePrivacyPolicy = () => {
    router.push('/profile/privacy-policy');
  };

  const handleLogout = () => {
    Alert.alert(
      isRTL ? 'تسجيل الخروج' : 'Sign Out',
      isRTL
        ? 'هل أنت متأكد من تسجيل الخروج؟'
        : 'Are you sure you want to sign out?',
      [
        {
          text: isRTL ? 'إلغاء' : 'Cancel',
          style: 'cancel',
        },
        {
          text: isRTL ? 'تسجيل الخروج' : 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Logout failed:', error);
              Alert.alert(
                isRTL ? 'خطأ' : 'Error',
                isRTL
                  ? 'فشل في تسجيل الخروج'
                  : 'Failed to sign out. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const profileSections: ProfileSection[] = [
    {
      title: isRTL ? 'الحساب' : 'Account',
      items: [
        {
          icon: User,
          label: isRTL ? 'المعلومات الشخصية' : 'Personal Information',
          onPress: handlePersonalInfo,
        },
        {
          icon: Heart,
          label: isRTL ? 'التاريخ الطبي' : 'Medical History',
          onPress: handleMedicalHistory,
        },
        {
          icon: FileText,
          label: isRTL ? 'التقارير الصحية' : 'Health Reports',
          onPress: handleHealthReports,
        },
      ],
    },
    {
      title: isRTL ? 'الإعدادات' : 'Settings',
      items: [
        {
          icon: Bell,
          label: isRTL ? 'الإشعارات' : 'Notifications',
          hasSwitch: true,
          switchValue: notificationsEnabled,
          onSwitchChange: handleNotificationToggle,
        },
        {
          icon: Shield,
          label: isRTL ? 'كشف السقوط' : 'Fall Detection',
          hasSwitch: true,
          switchValue: fallDetectionEnabled,
          onSwitchChange: handleFallDetectionToggle,
        },
        {
          icon: Globe,
          label: isRTL ? 'اللغة' : 'Language',
          value: isRTL ? 'العربية' : 'English',
          onPress: () => setLanguagePickerVisible(true),
        },
      ],
    },
    {
      title: isRTL ? 'الدعم' : 'Support',
      items: [
        {
          icon: HelpCircle,
          label: isRTL ? 'المساعدة والدعم' : 'Help & Support',
          onPress: handleHelpSupport,
        },
        {
          icon: FileText,
          label: isRTL ? 'الشروط والأحكام' : 'Terms & Conditions',
          onPress: handleTermsConditions,
        },
        {
          icon: Shield,
          label: isRTL ? 'سياسة الخصوصية' : 'Privacy Policy',
          onPress: handlePrivacyPolicy,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {t('profile')}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase() || 'U'}
              </Text>
            </View>
          </View>

          <View style={styles.userInfo}>
            <Text style={[styles.userName, isRTL && styles.rtlText]}>
              {user?.name || 'User'}
            </Text>
            <Text style={[styles.userEmail, isRTL && styles.rtlText]}>
              {user?.email}
            </Text>
            <View style={styles.memberSince}>
              <Text style={[styles.memberSinceText, isRTL && styles.rtlText]}>
                {isRTL ? 'عضو منذ' : 'Member since'}{' '}
                {new Date(user?.createdAt || new Date()).getFullYear()}
              </Text>
            </View>
          </View>
        </View>

        {/* Improved Health Summary */}
        <View style={styles.healthSummary}>
          <Text style={[styles.healthTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'ملخص الصحة' : 'Health Summary'}
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : (
            <View style={styles.healthGrid}>
              <View style={styles.healthCard}>
                <View style={styles.healthIconContainer}>
                  <Activity size={24} color="#10B981" />
                </View>
                <Text style={[styles.healthCardValue, isRTL && styles.rtlText]}>
                  {healthData.healthScore}
                </Text>
                <Text
                  style={[styles.healthCardLabel, isRTL && styles.rtlText]}
                  numberOfLines={2}
                >
                  {isRTL ? 'نقاط الصحة' : 'Health Score'}
                </Text>
              </View>

              <View style={styles.healthCard}>
                <View style={styles.healthIconContainer}>
                  <Heart size={24} color="#EF4444" />
                </View>
                <Text style={[styles.healthCardValue, isRTL && styles.rtlText]}>
                  {healthData.symptoms.length}
                </Text>
                <Text
                  style={[styles.healthCardLabel, isRTL && styles.rtlText]}
                  numberOfLines={2}
                >
                  {isRTL ? 'أعراض هذا الشهر' : 'Symptoms This Month'}
                </Text>
              </View>

              <View style={styles.healthCard}>
                <View style={styles.healthIconContainer}>
                  <Calendar size={24} color="#3B82F6" />
                </View>
                <Text style={[styles.healthCardValue, isRTL && styles.rtlText]}>
                  {healthData.medications.length}
                </Text>
                <Text
                  style={[styles.healthCardLabel, isRTL && styles.rtlText]}
                  numberOfLines={2}
                >
                  {isRTL ? 'أدوية نشطة' : 'Active Medications'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Settings Sections */}
        {profileSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {section.title}
            </Text>

            <View style={styles.sectionItems}>
              {section.items.map((item, itemIndex) => {
                const IconComponent = item.icon;

                return (
                  <TouchableOpacity
                    key={itemIndex}
                    style={[
                      styles.sectionItem,
                      itemIndex === section.items.length - 1 &&
                        styles.lastSectionItem,
                    ]}
                    onPress={item.onPress}
                    disabled={item.hasSwitch || false}
                  >
                    <View style={styles.sectionItemLeft}>
                      <View style={styles.sectionItemIcon}>
                        <IconComponent size={20} color="#64748B" />
                      </View>
                      <Text
                        style={[
                          styles.sectionItemLabel,
                          isRTL && styles.rtlText,
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </View>

                    <View style={styles.sectionItemRight}>
                      {item.hasSwitch ? (
                        <Switch
                          value={item.switchValue}
                          onValueChange={item.onSwitchChange}
                          trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
                          thumbColor="#FFFFFF"
                        />
                      ) : (
                        <>
                          {item.value && (
                            <Text
                              style={[
                                styles.sectionItemValue,
                                isRTL && styles.rtlText,
                              ]}
                              numberOfLines={1}
                            >
                              {item.value}
                            </Text>
                          )}
                          <ChevronRight
                            size={16}
                            color="#94A3B8"
                            style={[
                              isRTL && { transform: [{ rotate: '180deg' }] },
                            ]}
                          />
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
          <LogOut size={20} color="#EF4444" />
          <Text style={[styles.signOutText, isRTL && styles.rtlText]}>
            {t('signOut')}
          </Text>
        </TouchableOpacity>

        {/* App Version */}
        <View style={styles.appVersion}>
          <Text style={[styles.appVersionText, isRTL && styles.rtlText]}>
            Maak v1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        visible={languagePickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLanguagePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'اختر اللغة' : 'Select Language'}
            </Text>

            <TouchableOpacity
              style={[
                styles.languageOption,
                i18n.language === 'en' && styles.selectedLanguage,
              ]}
              onPress={() => handleLanguageChange('en')}
            >
              <Text
                style={[
                  styles.languageText,
                  i18n.language === 'en' && styles.selectedLanguageText,
                ]}
              >
                English
              </Text>
              {i18n.language === 'en' && <Check size={20} color="#2563EB" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.languageOption,
                i18n.language === 'ar' && styles.selectedLanguage,
              ]}
              onPress={() => handleLanguageChange('ar')}
            >
              <Text
                style={[
                  styles.languageText,
                  styles.rtlText,
                  i18n.language === 'ar' && styles.selectedLanguageText,
                ]}
              >
                العربية
              </Text>
              {i18n.language === 'ar' && <Check size={20} color="#2563EB" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setLanguagePickerVisible(false)}
            >
              <Text style={[styles.cancelButtonText, isRTL && styles.rtlText]}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginBottom: 8,
  },
  memberSince: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberSinceText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  healthSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  healthTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  healthGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  healthCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 100,
  },
  healthIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  healthCardValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  healthCardLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 14,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionItems: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastSectionItem: {
    borderBottomWidth: 0,
  },
  sectionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  sectionItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionItemLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1E293B',
    flex: 1,
  },
  sectionItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  sectionItemValue: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    maxWidth: 80,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  signOutText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
  },
  appVersion: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  appVersionText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 20,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  selectedLanguage: {
    backgroundColor: '#EBF4FF',
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  languageText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1E293B',
  },
  selectedLanguageText: {
    color: '#2563EB',
    fontFamily: 'Inter-SemiBold',
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Switch,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
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
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [fallDetectionEnabled, setFallDetectionEnabled] = useState(true);

  const isRTL = i18n.language === 'ar';

  const handleLanguageToggle = () => {
    const newLanguage = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(newLanguage);
  };

  const handleLogout = () => {
    Alert.alert(
      isRTL ? 'تسجيل الخروج' : 'Sign Out',
      isRTL ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to sign out?',
      [
        {
          text: isRTL ? 'إلغاء' : 'Cancel',
          style: 'cancel',
        },
        {
          text: isRTL ? 'تسجيل الخروج' : 'Sign Out',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const profileSections = [
    {
      title: isRTL ? 'الحساب' : 'Account',
      items: [
        {
          icon: User,
          label: isRTL ? 'المعلومات الشخصية' : 'Personal Information',
          onPress: () => console.log('Personal Info'),
        },
        {
          icon: Heart,
          label: isRTL ? 'التاريخ الطبي' : 'Medical History',
          onPress: () => console.log('Medical History'),
        },
        {
          icon: FileText,
          label: isRTL ? 'التقارير الصحية' : 'Health Reports',
          onPress: () => console.log('Health Reports'),
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
          onSwitchChange: setNotificationsEnabled,
        },
        {
          icon: Shield,
          label: isRTL ? 'كشف السقوط' : 'Fall Detection',
          hasSwitch: true,
          switchValue: fallDetectionEnabled,
          onSwitchChange: setFallDetectionEnabled,
        },
        {
          icon: Globe,
          label: isRTL ? 'اللغة' : 'Language',
          value: isRTL ? 'العربية' : 'English',
          onPress: handleLanguageToggle,
        },
      ],
    },
    {
      title: isRTL ? 'الدعم' : 'Support',
      items: [
        {
          icon: HelpCircle,
          label: isRTL ? 'المساعدة والدعم' : 'Help & Support',
          onPress: () => console.log('Help'),
        },
        {
          icon: FileText,
          label: isRTL ? 'الشروط والأحكام' : 'Terms & Conditions',
          onPress: () => console.log('Terms'),
        },
        {
          icon: Shield,
          label: isRTL ? 'سياسة الخصوصية' : 'Privacy Policy',
          onPress: () => console.log('Privacy'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>{t('profile')}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
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
                {isRTL ? 'عضو منذ' : 'Member since'} {new Date(user?.createdAt || new Date()).getFullYear()}
              </Text>
            </View>
          </View>
        </View>

        {/* Health Summary */}
        <View style={styles.healthSummary}>
          <Text style={[styles.healthTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'ملخص الصحة' : 'Health Summary'}
          </Text>
          
          <View style={styles.healthStats}>
            <View style={styles.healthStat}>
              <Text style={[styles.healthStatValue, isRTL && styles.rtlText]}>85</Text>
              <Text style={[styles.healthStatLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'نقاط الصحة' : 'Health Score'}
              </Text>
            </View>
            
            <View style={styles.healthStat}>
              <Text style={[styles.healthStatValue, isRTL && styles.rtlText]}>12</Text>
              <Text style={[styles.healthStatLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'أعراض هذا الشهر' : 'Symptoms This Month'}
              </Text>
            </View>
            
            <View style={styles.healthStat}>
              <Text style={[styles.healthStatValue, isRTL && styles.rtlText]}>3</Text>
              <Text style={[styles.healthStatLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'أدوية نشطة' : 'Active Medications'}
              </Text>
            </View>
          </View>
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
                    style={styles.sectionItem}
                    onPress={item.onPress}
                    disabled={item.hasSwitch}
                  >
                    <View style={styles.sectionItemLeft}>
                      <View style={styles.sectionItemIcon}>
                        <IconComponent size={20} color="#64748B" />
                      </View>
                      <Text style={[styles.sectionItemLabel, isRTL && styles.rtlText]}>
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
                            <Text style={[styles.sectionItemValue, isRTL && styles.rtlText]}>
                              {item.value}
                            </Text>
                          )}
                          <ChevronRight 
                            size={16} 
                            color="#94A3B8" 
                            style={[isRTL && { transform: [{ rotate: '180deg' }] }]}
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
  healthStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  healthStat: {
    alignItems: 'center',
  },
  healthStatValue: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
    marginBottom: 4,
  },
  healthStatLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    textAlign: 'center',
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
  sectionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  },
  sectionItemValue: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
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
});
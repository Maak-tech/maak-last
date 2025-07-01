import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Shield,
  Edit3,
  MapPin,
  Phone,
  Heart,
} from 'lucide-react-native';

export default function PersonalInfoScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const isRTL = i18n.language === 'ar';

  const handleEdit = () => {
    Alert.alert(
      isRTL ? 'تعديل الملف الشخصي' : 'Edit Profile',
      isRTL
        ? 'ستتوفر إمكانية تعديل الملف الشخصي قريباً'
        : 'Profile editing will be available soon',
      [{ text: isRTL ? 'موافق' : 'OK' }]
    );
  };

  const InfoCard = ({ icon: Icon, label, value, description }: any) => (
    <View style={styles.infoCard}>
      <View style={styles.infoCardHeader}>
        <View style={styles.infoCardIcon}>
          <Icon size={20} color="#2563EB" />
        </View>
        <View style={styles.infoCardContent}>
          <Text style={[styles.infoCardLabel, isRTL && styles.rtlText]}>
            {label}
          </Text>
          <Text style={[styles.infoCardValue, isRTL && styles.rtlText]}>
            {value}
          </Text>
          {description && (
            <Text style={[styles.infoCardDescription, isRTL && styles.rtlText]}>
              {description}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  const memberSinceDate = new Date(user?.createdAt || new Date());
  const formattedDate = memberSinceDate.toLocaleDateString(
    isRTL ? 'ar-SA' : 'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );

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
          {isRTL ? 'المعلومات الشخصية' : 'Personal Information'}
        </Text>

        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Edit3 size={20} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Avatar Section */}
        <View style={styles.avatarSection}>
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
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
            </View>
          </View>
          <Text style={[styles.userName, isRTL && styles.rtlText]}>
            {user?.name || 'User'}
          </Text>
          <View style={styles.roleContainer}>
            <Shield size={14} color="#10B981" />
            <Text style={[styles.roleText, isRTL && styles.rtlText]}>
              {user?.role === 'admin'
                ? isRTL
                  ? 'مدير العائلة'
                  : 'Family Admin'
                : isRTL
                ? 'عضو'
                : 'Member'}
            </Text>
          </View>
        </View>

        {/* Information Cards */}
        <View style={styles.infoSection}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'المعلومات الأساسية' : 'Basic Information'}
          </Text>

          <InfoCard
            icon={User}
            label={isRTL ? 'الاسم الكامل' : 'Full Name'}
            value={user?.name || (isRTL ? 'غير محدد' : 'Not specified')}
            description={
              isRTL
                ? 'اسمك كما يظهر في التطبيق'
                : 'Your name as it appears in the app'
            }
          />

          <InfoCard
            icon={Mail}
            label={isRTL ? 'البريد الإلكتروني' : 'Email Address'}
            value={user?.email || (isRTL ? 'غير محدد' : 'Not specified')}
            description={
              isRTL ? 'للدخول والتواصل' : 'For login and communication'
            }
          />

          <InfoCard
            icon={Calendar}
            label={isRTL ? 'تاريخ الانضمام' : 'Member Since'}
            value={formattedDate}
            description={isRTL ? 'تاريخ إنشاء الحساب' : 'Account creation date'}
          />

          <InfoCard
            icon={Shield}
            label={isRTL ? 'دور المستخدم' : 'User Role'}
            value={
              user?.role === 'admin'
                ? isRTL
                  ? 'مدير العائلة'
                  : 'Family Admin'
                : isRTL
                ? 'عضو'
                : 'Member'
            }
            description={
              user?.role === 'admin'
                ? isRTL
                  ? 'إدارة العائلة والإعدادات'
                  : 'Manage family and settings'
                : isRTL
                ? 'عضو في العائلة'
                : 'Family member'
            }
          />
        </View>

        {/* Account Details */}
        <View style={styles.infoSection}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'تفاصيل الحساب' : 'Account Details'}
          </Text>

          <InfoCard
            icon={Heart}
            label={isRTL ? 'معرف المستخدم' : 'User ID'}
            value={
              user?.id?.substring(0, 8) + '...' ||
              (isRTL ? 'غير محدد' : 'Not specified')
            }
            description={
              isRTL ? 'معرف فريد للحساب' : 'Unique account identifier'
            }
          />

          <InfoCard
            icon={MapPin}
            label={isRTL ? 'اللغة المفضلة' : 'Preferred Language'}
            value={user?.preferences?.language === 'ar' ? 'العربية' : 'English'}
            description={isRTL ? 'لغة واجهة التطبيق' : 'App interface language'}
          />

          <InfoCard
            icon={Phone}
            label={isRTL ? 'رقم الهاتف' : 'Phone Number'}
            value={isRTL ? 'غير محدد' : 'Not specified'}
            description={
              isRTL ? 'للطوارئ والإشعارات' : 'For emergencies and notifications'
            }
          />
        </View>

        {/* Statistics */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'إحصائيات الحساب' : 'Account Statistics'}
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                {Math.floor(
                  (Date.now() -
                    new Date(user?.createdAt || new Date()).getTime()) /
                    (1000 * 60 * 60 * 24)
                )}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'أيام العضوية' : 'Days Active'}
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                100%
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'اكتمال الملف' : 'Profile Complete'}
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                {user?.preferences?.notifications
                  ? isRTL
                    ? 'مفعل'
                    : 'On'
                  : isRTL
                  ? 'معطل'
                  : 'Off'}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'الإشعارات' : 'Notifications'}
              </Text>
            </View>
          </View>
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity style={styles.editProfileButton} onPress={handleEdit}>
          <Edit3 size={20} color="#FFFFFF" />
          <Text style={[styles.editProfileText, isRTL && styles.rtlText]}>
            {isRTL ? 'تعديل الملف الشخصي' : 'Edit Profile'}
          </Text>
        </TouchableOpacity>
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
  editButton: {
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
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  userName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  roleText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#059669',
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginBottom: 4,
  },
  infoCardValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 4,
  },
  infoCardDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
    lineHeight: 16,
  },
  statsSection: {
    marginBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
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
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    textAlign: 'center',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 32,
    gap: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  editProfileText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
  },
});

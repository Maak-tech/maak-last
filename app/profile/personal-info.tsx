import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/lib/services/userService';
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
  X,
  Save,
} from 'lucide-react-native';

export default function PersonalInfoScreen() {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    phoneNumber: '',
  });

  const isRTL = i18n.language === 'ar';

  const handleEdit = () => {
    setEditForm({
      name: user?.name || '',
      phoneNumber: '',
    });
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!editForm.name.trim()) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'يرجى إدخال الاسم' : 'Please enter a name'
      );
      return;
    }

    if (!user?.id) return;

    setLoading(true);
    try {
      const updates = {
        name: editForm.name.trim(),
      };

      await userService.updateUser(user.id, updates);
      await updateUser(updates);

      setShowEditModal(false);
      Alert.alert(
        isRTL ? 'تم الحفظ' : 'Saved',
        isRTL ? 'تم تحديث الملف الشخصي بنجاح' : 'Profile updated successfully'
      );
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'حدث خطأ في تحديث الملف الشخصي' : 'Failed to update profile'
      );
    } finally {
      setLoading(false);
    }
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

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'تعديل الملف الشخصي' : 'Edit Profile'}
            </Text>
            <TouchableOpacity
              onPress={() => setShowEditModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Name Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'الاسم الكامل' : 'Full Name'} *
              </Text>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlInput]}
                value={editForm.name}
                onChangeText={(text) =>
                  setEditForm({ ...editForm, name: text })
                }
                placeholder={isRTL ? 'ادخل اسمك الكامل' : 'Enter your full name'}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Phone Number Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'رقم الهاتف' : 'Phone Number'}
              </Text>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlInput]}
                value={editForm.phoneNumber}
                onChangeText={(text) =>
                  setEditForm({ ...editForm, phoneNumber: text })
                }
                placeholder={isRTL ? 'ادخل رقم الهاتف' : 'Enter phone number'}
                textAlign={isRTL ? 'right' : 'left'}
                keyboardType="phone-pad"
              />
              <Text style={[styles.fieldDescription, isRTL && styles.rtlText]}>
                {isRTL 
                  ? 'سيستخدم للطوارئ والإشعارات المهمة'
                  : 'Used for emergencies and important notifications'}
              </Text>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                loading && styles.saveButtonDisabled,
              ]}
              onPress={handleSaveProfile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Save size={20} color="#FFFFFF" />
              )}
              <Text style={styles.saveButtonText}>
                {loading 
                  ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                  : (isRTL ? 'حفظ التغييرات' : 'Save Changes')}
              </Text>
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
    fontFamily: 'Geist-SemiBold',
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
    fontFamily: 'Geist-Bold',
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
    fontFamily: 'Geist-Bold',
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
    fontFamily: 'Geist-Medium',
    color: '#059669',
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Geist-SemiBold',
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
    fontFamily: 'Geist-Medium',
    color: '#64748B',
    marginBottom: 4,
  },
  infoCardValue: {
    fontSize: 16,
    fontFamily: 'Geist-SemiBold',
    color: '#1E293B',
    marginBottom: 4,
  },
  infoCardDescription: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
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
    fontFamily: 'Geist-Bold',
    color: '#2563EB',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Geist-Medium',
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
    fontFamily: 'Geist-SemiBold',
    color: '#FFFFFF',
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
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
    fontFamily: 'Geist-SemiBold',
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
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: 'Geist-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    backgroundColor: '#FFFFFF',
  },
  rtlInput: {
    fontFamily: 'Cairo-Regular',
  },
  fieldDescription: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 20,
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Geist-SemiBold',
    color: '#FFFFFF',
  },
});

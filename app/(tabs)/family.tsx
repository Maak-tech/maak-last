// TODO(i18n): 189 inline RTL/language ternaries — migrate to t() keys
// See: https://github.com/your-org/nuralix/issues/XXX
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Share,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FamilyMemberSkeleton } from '@/components/SkeletonLoader';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { createThemedStyles, getTextStyle } from '@/utils/styles';
import { userService } from '@/lib/services/userService';
import { familyInviteService } from '@/lib/services/familyInviteService';
import { api } from '@/lib/apiClient';
import { vhiService } from '@/lib/services/vhiService';
import { User } from '@/types';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useFamilyInvite } from '@/hooks/useFamilyInvite';
import {
  Plus,
  Users,
  Heart,
  AlertTriangle,
  UserPlus,
  Share2,
  X,
  Edit,
  Trash2,
  Settings,
} from 'lucide-react-native';
import AlertsCard from '@/app/components/AlertsCard';
import Avatar from '@/components/Avatar';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';

const RELATIONS = [
  { key: 'father', labelEn: 'Father', labelAr: 'الأب' },
  { key: 'mother', labelEn: 'Mother', labelAr: 'الأم' },
  { key: 'spouse', labelEn: 'Spouse', labelAr: 'الزوج/الزوجة' },
  { key: 'child', labelEn: 'Child', labelAr: 'الطفل' },
  { key: 'sibling', labelEn: 'Sibling', labelAr: 'الأخ/الأخت' },
  { key: 'grandparent', labelEn: 'Grandparent', labelAr: 'الجد/الجدة' },
  { key: 'other', labelEn: 'Other', labelAr: 'آخر' },
];

export default function FamilyScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  // Custom hooks for family data and invite state
  const { members: familyMembers, setMembers: setFamilyMembers, loading, refreshing, error: membersError, load: loadMembers, refresh } = useFamilyMembers(user?.familyId);
  const invite = useFamilyInvite(user?.familyId);

  // Screen-specific state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showJoinFamilyModal, setShowJoinFamilyModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editMemberForm, setEditMemberForm] = useState({ id: '', name: '', email: '', role: 'member' as 'admin' | 'member' });
  const [editLoading, setEditLoading] = useState(false);
  const [joinFamilyCode, setJoinFamilyCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<{id: string; name: string; phone: string}[]>([]);
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [familyAlertCount, setFamilyAlertCount] = useState(0);
  const [myVhiScore, setMyVhiScore] = useState<number | null>(null);

  const isRTL = i18n.language === 'ar';

  const loadFamilyMembers = useCallback(async () => {
    await loadMembers();

    if (!user?.familyId) return;

    // Fetch real alert count for family members
    if (familyMembers.length > 0) {
      try {
        const userIds = familyMembers.map((m) => m.id).join(',');
        const familyAlerts = await api.get<{ isAcknowledged: boolean }[]>(
          `/api/alerts/family?userIds=${userIds}`
        );
        setFamilyAlertCount((Array.isArray(familyAlerts) ? familyAlerts : []).filter((a) => !a.isAcknowledged).length);
      } catch (err: unknown) { console.warn('[family] Failed to load family alert count:', err instanceof Error ? err.message : String(err)); }
    }

    // Fetch current user's VHI score via the typed vhiService
    try {
      const vhi = await vhiService.getMyVHI();
      setMyVhiScore(vhi?.data?.currentState?.overallScore ?? null);
    } catch (err: unknown) { console.warn('[family] Failed to load VHI score:', err instanceof Error ? err.message : String(err)); }
  }, [loadMembers, user?.familyId, familyMembers]);

  // Refresh data when tab is focused
  useFocusEffect(
    useCallback(() => {
      loadMembers();
    }, [loadMembers])
  );

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return '#10B981';
      case 'good':
        return '#2563EB';
      case 'attention':
        return '#F59E0B';
      case 'critical':
        return '#EF4444';
      default:
        return '#64748B';
    }
  };

  const getHealthStatusText = (status: string) => {
    const statusMap = {
      excellent: isRTL ? 'ممتاز' : 'Excellent',
      good: isRTL ? 'جيد' : 'Good',
      attention: isRTL ? 'يحتاج انتباه' : 'Needs Attention',
      critical: isRTL ? 'حرج' : 'Critical',
    };
    return statusMap[status as keyof typeof statusMap] || status;
  };

  const handleInviteMember = async () => {
    if (!invite.form.name || !invite.form.relation) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'يرجى ملء الحقول المطلوبة' : 'Please fill in required fields'
      );
      return;
    }

    if (!user?.familyId) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'لا توجد عائلة مربوطة' : 'No family found'
      );
      return;
    }

    invite.setLoading(true);

    try {
      const code = await familyInviteService.createInvitationCode(
        user.familyId,
        user.id,
        invite.form.name,
        invite.form.relation
      );

      invite.setGeneratedCode(code);
      const memberName = invite.form.name;
      invite.setForm({ name: '', relation: '' });

      // Prepare sharing message
      const shareMessage = isRTL
        ? `مرحباً ${memberName}! تمت دعوتك للانضمام إلى مجموعة العائلة الصحية على تطبيق معك.\n\nرمز الدعوة: ${code}\n\n1. حمّل تطبيق معك\n2. سجّل دخولك أو أنشئ حساباً جديداً\n3. استخدم رمز الدعوة: ${code}\n\nهذا الرمز صالح لمدة 7 أيام.`
        : `Hi ${memberName}! You've been invited to join our family health group on Nuralix app.\n\nInvitation Code: ${code}\n\n1. Download the Nuralix app\n2. Sign in or create a new account\n3. Use invitation code: ${code}\n\nThis code expires in 7 days.`;

      // Show options to share or copy
      Alert.alert(
        isRTL ? 'تم إنشاء الدعوة' : 'Invitation Created',
        isRTL
          ? `تم إنشاء رمز الدعوة لـ ${memberName}: ${code}\n\nما الذي تريد فعله؟`
          : `Invitation code created for ${memberName}: ${code}\n\nWhat would you like to do?`,
        [
          {
            text: isRTL ? 'مشاركة' : 'Share',
            onPress: async () => {
              try {
                await Share.share({
                  message: shareMessage,
                  title: isRTL
                    ? "دعوة للانضمام إلى معك"
                    : "Invitation to join Nuralix",
                });
              } catch (error: unknown) {
                console.error('Error sharing:', error instanceof Error ? error.message : String(error));
                // Fallback to copying to clipboard
                await Clipboard.setStringAsync(shareMessage);
                Alert.alert(
                  isRTL ? 'تم النسخ' : 'Copied',
                  isRTL
                    ? 'تم نسخ رسالة الدعوة إلى الحافظة'
                    : 'Invitation message copied to clipboard'
                );
              }
            },
          },
          {
            text: isRTL ? 'نسخ' : 'Copy',
            onPress: async () => {
              await Clipboard.setStringAsync(shareMessage);
              Alert.alert(
                isRTL ? 'تم النسخ' : 'Copied',
                isRTL
                  ? 'تم نسخ رسالة الدعوة إلى الحافظة'
                  : 'Invitation message copied to clipboard'
              );
            },
          },
          {
            text: isRTL ? 'حسناً' : 'OK',
            style: 'cancel',
          },
        ]
      );
    } catch (error: unknown) {
      console.error('Error generating invite:', error instanceof Error ? error.message : String(error));
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'فشل في إنشاء رمز الدعوة' : 'Failed to generate invite code'
      );
    } finally {
      invite.setLoading(false);
    }
  };

  const handleEditMember = (member: User) => {
    // Check permissions: admins can edit anyone, members can only edit themselves
    const canEdit = user?.role === 'admin' || user?.id === member.id;

    if (!canEdit) {
      Alert.alert(
        isRTL ? 'غير مسموح' : 'Not Permitted',
        isRTL
          ? 'ليس لديك صلاحية لتعديل هذا العضو'
          : 'You do not have permission to edit this member'
      );
      return;
    }

    setEditMemberForm({
      id: member.id,
      name: member.name ?? '',
      email: member.email ?? '',
      role: member.role === 'caregiver' ? 'member' : member.role,
    });
    setShowEditMemberModal(true);
  };

  const handleSaveEditMember = async () => {
    if (!editMemberForm.name.trim()) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'يرجى إدخال الاسم' : 'Please enter a name'
      );
      return;
    }

    if (!user) return;

    setEditLoading(true);

    try {
      const updates: Partial<User> = {
        name: editMemberForm.name.trim(),
      };

      // Only admins can change roles and only for other users (not themselves)
      if (user.role === 'admin' && user.id !== editMemberForm.id) {
        if (
          editMemberForm.role !== 'admin' &&
          editMemberForm.role !== 'member'
        ) {
          Alert.alert(
            isRTL ? 'خطأ' : 'Error',
            isRTL ? 'يرجى اختيار دور صحيح' : 'Please select a valid role'
          );
          return;
        }
        updates.role = editMemberForm.role;
      }

      await userService.updateUser(editMemberForm.id, updates);

      // Reload family members to reflect changes
      await loadFamilyMembers();

      setShowEditMemberModal(false);
      setEditMemberForm({ id: '', name: '', email: '', role: 'member' });

      Alert.alert(
        isRTL ? 'تم الحفظ' : 'Saved',
        isRTL ? 'تم تحديث بيانات العضو بنجاح' : 'Member updated successfully'
      );
    } catch (error: unknown) {
      console.error('Error updating member:', error instanceof Error ? error.message : String(error));
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'فشل في تحديث بيانات العضو' : 'Failed to update member'
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteMember = (member: User) => {
    // Check permissions: only admins can delete members, and members can't delete themselves
    if (user?.role !== 'admin') {
      Alert.alert(
        isRTL ? 'غير مسموح' : 'Not Permitted',
        isRTL
          ? 'ليس لديك صلاحية لحذف أعضاء العائلة'
          : 'You do not have permission to remove family members'
      );
      return;
    }

    // Prevent deleting yourself
    if (member.id === user?.id) {
      Alert.alert(
        isRTL ? 'غير مسموح' : 'Not Permitted',
        isRTL
          ? 'لا يمكنك حذف نفسك من العائلة'
          : 'You cannot remove yourself from the family'
      );
      return;
    }

    Alert.alert(
      isRTL ? 'حذف العضو' : 'Remove Member',
      isRTL
        ? `هل أنت متأكد من رغبتك في إزالة ${member.name} من العائلة؟`
        : `Are you sure you want to remove ${member.name} from the family?`,
      [
        {
          text: isRTL ? 'إلغاء' : 'Cancel',
          style: 'cancel',
        },
        {
          text: isRTL ? 'إزالة' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove user from family
              await userService.updateUser(member.id, {
                familyId: undefined,
                role: 'admin', // Reset to admin for when they create/join another family
              });

              // Reload family members to reflect changes
              await loadFamilyMembers();

              Alert.alert(
                isRTL ? 'تم الإزالة' : 'Removed',
                isRTL
                  ? 'تم إزالة العضو من العائلة بنجاح'
                  : 'Member removed from family successfully'
              );
            } catch (error: unknown) {
              console.error('Error removing member:', error instanceof Error ? error.message : String(error));
              Alert.alert(
                isRTL ? 'خطأ' : 'Error',
                isRTL ? 'فشل في إزالة العضو' : 'Failed to remove member'
              );
            }
          },
        },
      ]
    );
  };

  const handleEmergencySettings = () => {
    setShowEmergencyModal(true);
  };

  const handleAddEmergencyContact = () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'يرجى ملء جميع الحقول' : 'Please fill in all fields'
      );
      return;
    }

    // Simple phone number validation
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(newContact.phone.trim())) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'يرجى إدخال رقم هاتف صحيح' : 'Please enter a valid phone number'
      );
      return;
    }

    const contact = {
      id: Date.now().toString(),
      name: newContact.name.trim(),
      phone: newContact.phone.trim(),
    };

    setEmergencyContacts([...emergencyContacts, contact]);
    setNewContact({ name: '', phone: '' });

    Alert.alert(
      isRTL ? 'تم الحفظ' : 'Saved',
      isRTL ? 'تم إضافة جهة الاتصال بنجاح' : 'Emergency contact added successfully'
    );
  };

  const handleDeleteEmergencyContact = (contactId: string) => {
    Alert.alert(
      isRTL ? 'حذف جهة الاتصال' : 'Delete Contact',
      isRTL ? 'هل أنت متأكد من حذف جهة الاتصال هذه؟' : 'Are you sure you want to delete this contact?',
      [
        {
          text: isRTL ? 'إلغاء' : 'Cancel',
          style: 'cancel',
        },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: () => {
            setEmergencyContacts(emergencyContacts.filter(c => c.id !== contactId));
            Alert.alert(
              isRTL ? 'تم الحذف' : 'Deleted',
              isRTL ? 'تم حذف جهة الاتصال بنجاح' : 'Emergency contact deleted successfully'
            );
          },
        },
      ]
    );
  };

  const copyInviteCode = async () => {
    if (!user?.familyId) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'لا توجد عائلة مربوطة' : 'No family found'
      );
      return;
    }

    try {
      // Generate a new invitation code for sharing
      const code = await familyInviteService.createInvitationCode(
        user.familyId,
        user.id,
        'Family Member', // Generic name for shared codes
        'Member' // Generic relation for shared codes
      );

      const shareMessage = isRTL
        ? `مرحباً! تمت دعوتك للانضمام إلى مجموعة العائلة الصحية على تطبيق معك.\n\nرمز الدعوة: ${code}\n\n1. حمّل تطبيق معك\n2. سجّل دخولك أو أنشئ حساباً جديداً\n3. استخدم رمز الدعوة: ${code}\n\nهذا الرمز صالح لمدة 7 أيام.`
        : `Hi! You've been invited to join our family health group on Nuralix app.\n\nInvitation Code: ${code}\n\n1. Download the Nuralix app\n2. Sign in or create a new account\n3. Use invitation code: ${code}\n\nThis code expires in 7 days.`;

      // Show options to share or copy
      Alert.alert(
        isRTL ? 'رمز الدعوة جاهز' : 'Invitation Code Ready',
        isRTL
          ? `رمز الدعوة: ${code}\n\nاختر طريقة المشاركة:`
          : `Invitation Code: ${code}\n\nChoose how to share:`,
        [
          {
            text: isRTL ? 'مشاركة' : 'Share',
            onPress: async () => {
              try {
                await Share.share({
                  message: shareMessage,
                  title: isRTL
                    ? "دعوة للانضمام إلى معك"
                    : "Invitation to join Nuralix",
                });
              } catch (error: unknown) {
                console.error('Error sharing:', error instanceof Error ? error.message : String(error));
                // Fallback to copying to clipboard
                await Clipboard.setStringAsync(shareMessage);
                Alert.alert(
                  isRTL ? 'تم النسخ' : 'Copied',
                  isRTL
                    ? 'تم نسخ رسالة الدعوة إلى الحافظة'
                    : 'Invitation message copied to clipboard'
                );
              }
            },
          },
          {
            text: isRTL ? 'نسخ الرسالة' : 'Copy Message',
            onPress: async () => {
              await Clipboard.setStringAsync(shareMessage);
              Alert.alert(
                isRTL ? 'تم النسخ' : 'Copied',
                isRTL
                  ? 'تم نسخ رسالة الدعوة إلى الحافظة'
                  : 'Full invitation message copied to clipboard'
              );
            },
          },
          {
            text: isRTL ? 'نسخ الرمز فقط' : 'Copy Code Only',
            onPress: async () => {
              await Clipboard.setStringAsync(code);
              Alert.alert(
                isRTL ? 'تم النسخ' : 'Copied',
                isRTL
                  ? `تم نسخ رمز الدعوة: ${code}`
                  : `Invitation code copied: ${code}`
              );
            },
          },
          {
            text: isRTL ? 'إلغاء' : 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (error: unknown) {
      console.error('Error generating invitation code:', error instanceof Error ? error.message : String(error));
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'فشل في إنشاء رمز الدعوة' : 'Failed to generate invitation code'
      );
    }
  };

  const handleJoinFamily = async () => {
    if (!joinFamilyCode.trim()) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'يرجى إدخال رمز الدعوة' : 'Please enter the invitation code'
      );
      return;
    }

    if (!user) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'يجب تسجيل الدخول أولاً' : 'You must be logged in first'
      );
      return;
    }

    setJoinLoading(true);

    try {
      const result = await familyInviteService.useInvitationCode(
        joinFamilyCode.trim(),
        user.id
      );
      if (result.success && result.familyId) {
        // Join the family
        await userService.joinFamily(user.id, result.familyId);

        // Refresh family members and user state
        await loadFamilyMembers();

        setJoinFamilyCode('');
        setShowJoinFamilyModal(false);

        Alert.alert(
          isRTL ? 'مرحباً بك في العائلة!' : 'Welcome to the Family!',
          isRTL
            ? 'تم انضمامك بنجاح! يمكنك الآن رؤية أعضاء عائلتك الجدد في الأسفل.'
            : 'You have successfully joined! You can now see your new family members below.'
        );

        // loadFamilyMembers() was already called above — the deferred reload is redundant.
      } else {
        Alert.alert(isRTL ? 'رمز غير صحيح' : 'Invalid Code', result.message);
      }
    } catch (error: unknown) {
      console.error('Error joining family:', error instanceof Error ? error.message : String(error));
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'فشل في الانضمام للعائلة' : 'Failed to join family'
      );
    } finally {
      setJoinLoading(false);
    }
  };

  const getFamilyStats = () => {
    const totalMembers = familyMembers.length;
    const activeMembers = familyMembers.length;
    const totalAlerts = familyAlertCount;
    const avgHealthScore = myVhiScore !== null ? Math.round(myVhiScore) : 0;

    return { totalMembers, activeMembers, totalAlerts, avgHealthScore };
  };

  const { totalMembers, activeMembers, totalAlerts, avgHealthScore } =
    getFamilyStats();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, isRTL && styles.rtlText]}>
            {t('family')}
          </Text>
        </View>
        <View style={{ padding: 16 }}>
          <FamilyMemberSkeleton />
          <FamilyMemberSkeleton />
          <FamilyMemberSkeleton />
          <FamilyMemberSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  // No-family empty state
  if (!user?.familyId && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, isRTL && styles.rtlText]}>
            {t('family')}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 64, marginBottom: 20 }}>👨‍👩‍👧</Text>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 10, textAlign: 'center' }}>
            {isRTL ? 'لا توجد عائلة بعد' : 'No family yet'}
          </Text>
          <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
            {isRTL
              ? 'أنشئ عائلتك أو انضم إلى عائلة موجودة برمز الدعوة'
              : 'Create your family or join an existing one with an invite code'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#2563EB', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 12 }}
            onPress={() => setShowJoinFamilyModal(true)}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'إنشاء أو الانضمام إلى عائلة' : 'Create or join a family'}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              {isRTL ? 'إنشاء / الانضمام' : 'Create / Join Family'}
            </Text>
          </TouchableOpacity>
        </View>
        {/* Join Family Modal — must remain mounted to accept input */}
        <Modal
          visible={showJoinFamilyModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {isRTL ? 'الانضمام إلى عائلة' : 'Join a Family'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowJoinFamilyModal(false);
                  setJoinFamilyCode('');
                }}
                style={styles.closeButton}
              >
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                  {isRTL ? 'رمز الدعوة' : 'Invitation Code'}
                </Text>
                <TextInput
                  style={[styles.textInput, isRTL && styles.rtlInput]}
                  value={joinFamilyCode}
                  onChangeText={setJoinFamilyCode}
                  placeholder={isRTL ? 'أدخل رمز الدعوة (6 أرقام)' : 'Enter invitation code (6 digits)'}
                  textAlign={isRTL ? 'right' : 'left'}
                  maxLength={6}
                  keyboardType="numeric"
                />
                <Text style={[styles.emergencyDescription, isRTL && styles.rtlText]}>
                  {isRTL
                    ? 'أدخل رمز الدعوة المرسل إليك من أحد أفراد العائلة للانضمام إلى مجموعتهم الصحية'
                    : 'Enter the invitation code sent to you by a family member to join their health group'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.inviteButton, joinLoading && styles.inviteButtonDisabled]}
                onPress={handleJoinFamily}
                disabled={joinLoading}
              >
                <Text style={styles.inviteButtonText}>
                  {joinLoading
                    ? isRTL ? 'جاري الانضمام...' : 'Joining...'
                    : isRTL ? 'انضم للعائلة' : 'Join Family'}
                </Text>
              </TouchableOpacity>
              {joinLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2563EB" />
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <ScreenErrorBoundary screenName="Family">
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {t('family')}
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowInviteModal(true)}
        >
          <UserPlus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={familyMembers}
        keyExtractor={(item) => item.id}
        renderItem={({ item: member }) => (
          <View style={styles.memberItem}>
            <View style={styles.memberLeft}>
              <View style={styles.avatarContainer}>
                <Avatar
                  source={member.avatar ? { uri: member.avatar } : undefined}
                  name={member.name}
                  size="md"
                  showBadge={member.id === user?.id}
                  badgeColor="#10B981"
                />
              </View>

              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, isRTL && styles.rtlText]}>
                  {member.name}
                </Text>
                <Text
                  style={[styles.memberRelation, isRTL && styles.rtlText]}
                >
                  {member.role === 'admin'
                    ? isRTL
                      ? 'مدير'
                      : 'Admin'
                    : isRTL
                    ? 'عضو'
                    : 'Member'}
                </Text>
                <Text
                  style={[styles.memberLastActive, isRTL && styles.rtlText]}
                >
                  {member.email}
                </Text>
              </View>
            </View>

            <View style={styles.memberRight}>
              <View style={styles.memberStats}>
                <View
                  style={[
                    styles.statusIndicator,
                    {
                      backgroundColor: '#10B981',
                    },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {isRTL ? 'نشط' : 'Active'}
                  </Text>
                </View>
              </View>

              <View style={styles.memberActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEditMember(member)}
                >
                  <Edit size={16} color="#64748B" />
                </TouchableOpacity>
                {member.id !== user?.id && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteMember(member)}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
        ListHeaderComponent={
          <>
            {/* Family Overview */}
            <View style={styles.overviewCard}>
              <Text style={[styles.overviewTitle, isRTL && styles.rtlText]}>
                {isRTL ? 'نظرة عامة على العائلة' : 'Family Overview'}
              </Text>

              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Users size={20} color="#2563EB" />
                  <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                    {totalMembers}
                  </Text>
                  <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                    {isRTL ? 'أفراد' : 'Members'}
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Heart size={20} color="#10B981" />
                  <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                    {avgHealthScore || 0}
                  </Text>
                  <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                    {isRTL ? 'نقاط الصحة' : 'Health Score'}
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <AlertTriangle size={20} color="#F59E0B" />
                  <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                    {totalAlerts}
                  </Text>
                  <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                    {isRTL ? 'تنبيهات' : 'Alerts'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Active Alerts */}
            <AlertsCard />

            {/* Family Members section title */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                {t('familyMembers')}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 48 }}>
            <Text style={{ fontSize: 40 }}>👨‍👩‍👧‍👦</Text>
            <Text style={{ fontSize: 18, fontWeight: '600', marginTop: 12, marginBottom: 8 }}>
              {isRTL ? 'لا يوجد أعضاء' : 'No family members yet'}
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
              {isRTL ? 'ادع أفراد عائلتك للانضمام' : 'Invite your family members to join'}
            </Text>
          </View>
        }
        ListFooterComponent={
          /* Quick Actions */
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'إجراءات سريعة' : 'Quick Actions'}
            </Text>

            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={copyInviteCode}
              >
                <Share2 size={24} color="#2563EB" />
                <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                  {isRTL ? 'مشاركة رمز الدعوة' : 'Share Invite Code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={handleEmergencySettings}
              >
                <Settings size={24} color="#F59E0B" />
                <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                  {isRTL ? 'إعدادات الطوارئ' : 'Emergency Settings'}
                </Text>
              </TouchableOpacity>
            </View>

            {!user?.familyId && (
              <TouchableOpacity
                style={styles.joinFamilyButton}
                onPress={() => setShowJoinFamilyModal(true)}
              >
                <Users size={24} color="#FFFFFF" />
                <Text
                  style={[styles.joinFamilyButtonText, isRTL && styles.rtlText]}
                >
                  {isRTL ? 'الانضمام إلى عائلة' : 'Join a Family'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      {/* Invite Member Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'دعوة عضو جديد' : 'Invite New Member'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowInviteModal(false);
                invite.setGeneratedCode(null);
                invite.setForm({
                  name: '',
                  relation: '',
                });
              }}
              style={styles.closeButton}
            >
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'الاسم الكامل' : 'Full Name'} *
              </Text>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlInput]}
                value={invite.form.name}
                onChangeText={(text) =>
                  invite.setForm({ ...invite.form, name: text })
                }
                placeholder={isRTL ? 'ادخل الاسم الكامل' : 'Enter full name'}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Relation */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'صلة القرابة' : 'Relationship'} *
              </Text>
              <View style={styles.relationOptions}>
                {RELATIONS.map((relation) => (
                  <TouchableOpacity
                    key={relation.key}
                    style={[
                      styles.relationOption,
                      invite.form.relation ===
                        (isRTL ? relation.labelAr : relation.labelEn) &&
                        styles.relationOptionSelected,
                    ]}
                    onPress={() =>
                      invite.setForm({
                        ...invite.form,
                        relation: isRTL ? relation.labelAr : relation.labelEn,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.relationOptionText,
                        invite.form.relation ===
                          (isRTL ? relation.labelAr : relation.labelEn) &&
                          styles.relationOptionTextSelected,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL ? relation.labelAr : relation.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.inviteButton}
              onPress={handleInviteMember}
            >
              <Text style={styles.inviteButtonText}>
                {isRTL ? 'إرسال الدعوة' : 'Send Invitation'}
              </Text>
            </TouchableOpacity>

            {invite.generatedCode && (
              <View style={styles.codeContainer}>
                <Text style={[styles.codeLabel, isRTL && styles.rtlText]}>
                  {isRTL ? 'رمز الدعوة' : 'Invite Code'}
                </Text>
                <Text style={[styles.codeValue, isRTL && styles.rtlText]}>
                  {invite.generatedCode}
                </Text>
              </View>
            )}

            {invite.loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Emergency Settings Modal */}
      <Modal
        visible={showEmergencyModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'إعدادات الطوارئ' : 'Emergency Settings'}
            </Text>
            <TouchableOpacity
              onPress={() => setShowEmergencyModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'جهات الاتصال في حالات الطوارئ' : 'Emergency Contacts'}
              </Text>
              <Text
                style={[styles.emergencyDescription, isRTL && styles.rtlText]}
              >
                {isRTL
                  ? 'سيتم إشعار جهات الاتصال هذه في حالة الطوارئ'
                  : 'These contacts will be notified in case of emergency'}
              </Text>

              {/* Emergency Contacts List */}
              {emergencyContacts.map((contact) => (
                <View key={contact.id} style={styles.contactItem}>
                  <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, isRTL && styles.rtlText]}>
                      {contact.name}
                    </Text>
                    <Text style={[styles.contactPhone, isRTL && styles.rtlText]}>
                      {contact.phone}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteContactButton}
                    onPress={() => handleDeleteEmergencyContact(contact.id)}
                  >
                    <X size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add New Contact Form */}
              <View style={styles.addContactForm}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                  {isRTL ? 'إضافة جهة اتصال جديدة' : 'Add New Contact'}
                </Text>
                
                <TextInput
                  style={[styles.textInput, isRTL && styles.rtlInput]}
                  value={newContact.name}
                  onChangeText={(text) => setNewContact({ ...newContact, name: text })}
                  placeholder={isRTL ? 'اسم جهة الاتصال' : 'Contact Name'}
                  textAlign={isRTL ? 'right' : 'left'}
                />
                
                <TextInput
                  style={[styles.textInput, isRTL && styles.rtlInput, { marginTop: 8 }]}
                  value={newContact.phone}
                  onChangeText={(text) => setNewContact({ ...newContact, phone: text })}
                  placeholder={isRTL ? 'رقم الهاتف' : 'Phone Number'}
                  textAlign={isRTL ? 'right' : 'left'}
                  keyboardType="phone-pad"
                />
                
                <TouchableOpacity 
                  style={styles.addContactButton}
                  onPress={handleAddEmergencyContact}
                >
                  <Plus size={20} color="#2563EB" />
                  <Text style={[styles.addContactText, isRTL && styles.rtlText]}>
                    {isRTL ? 'إضافة جهة اتصال' : 'Add Contact'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'كشف السقوط' : 'Fall Detection'}
              </Text>
              <TouchableOpacity style={styles.settingToggle}>
                <Text style={[styles.settingText, isRTL && styles.rtlText]}>
                  {isRTL
                    ? 'تفعيل كشف السقوط التلقائي'
                    : 'Enable automatic fall detection'}
                </Text>
                <View style={styles.toggle}>
                  <View style={styles.toggleInner} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'تنبيهات الأدوية' : 'Medication Alerts'}
              </Text>
              <TouchableOpacity style={styles.settingToggle}>
                <Text style={[styles.settingText, isRTL && styles.rtlText]}>
                  {isRTL
                    ? 'إرسال تنبيهات فوتت الأدوية'
                    : 'Send missed medication alerts'}
                </Text>
                <View style={styles.toggle}>
                  <View style={styles.toggleInner} />
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Join Family Modal */}
      <Modal
        visible={showJoinFamilyModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'الانضمام إلى عائلة' : 'Join a Family'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowJoinFamilyModal(false);
                setJoinFamilyCode('');
              }}
              style={styles.closeButton}
            >
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'رمز الدعوة' : 'Invitation Code'}
              </Text>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlInput]}
                value={joinFamilyCode}
                onChangeText={setJoinFamilyCode}
                placeholder={
                  isRTL
                    ? 'أدخل رمز الدعوة (6 أرقام)'
                    : 'Enter invitation code (6 digits)'
                }
                textAlign={isRTL ? 'right' : 'left'}
                maxLength={6}
                keyboardType="numeric"
              />
              <Text
                style={[styles.emergencyDescription, isRTL && styles.rtlText]}
              >
                {isRTL
                  ? 'أدخل رمز الدعوة المرسل إليك من أحد أفراد العائلة للانضمام إلى مجموعتهم الصحية'
                  : 'Enter the invitation code sent to you by a family member to join their health group'}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.inviteButton,
                joinLoading && styles.inviteButtonDisabled,
              ]}
              onPress={handleJoinFamily}
              disabled={joinLoading}
            >
              <Text style={styles.inviteButtonText}>
                {joinLoading
                  ? isRTL
                    ? 'جاري الانضمام...'
                    : 'Joining...'
                  : isRTL
                  ? 'انضم للعائلة'
                  : 'Join Family'}
              </Text>
            </TouchableOpacity>

            {joinLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Member Modal */}
      <Modal
        visible={showEditMemberModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'تعديل العضو' : 'Edit Member'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowEditMemberModal(false);
                setEditMemberForm({
                  id: '',
                  name: '',
                  email: '',
                  role: 'member',
                });
              }}
              style={styles.closeButton}
            >
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'الاسم' : 'Name'} *
              </Text>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlInput]}
                value={editMemberForm.name}
                onChangeText={(text) =>
                  setEditMemberForm({ ...editMemberForm, name: text })
                }
                placeholder={isRTL ? 'ادخل الاسم' : 'Enter name'}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Email */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'البريد الإلكتروني' : 'Email'} *
              </Text>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlInput]}
                value={editMemberForm.email}
                onChangeText={(text) =>
                  setEditMemberForm({ ...editMemberForm, email: text })
                }
                placeholder={isRTL ? 'ادخل البريد الإلكتروني' : 'Enter email'}
                textAlign={isRTL ? 'right' : 'left'}
                keyboardType="email-address"
              />
            </View>

            {/* Role */}
            {/* Only show role selection to admins editing other users */}
            {user?.role === 'admin' && user.id !== editMemberForm.id && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                  {isRTL ? 'الدور' : 'Role'} *
                </Text>
                <View style={styles.roleOptions}>
                  {['admin', 'member'].map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleOption,
                        editMemberForm.role === role &&
                          styles.roleOptionSelected,
                      ]}
                      onPress={() =>
                        setEditMemberForm({
                          ...editMemberForm,
                          role: role as 'admin' | 'member',
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.roleOptionText,
                          editMemberForm.role === role &&
                            styles.roleOptionTextSelected,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {role === 'admin'
                          ? isRTL
                            ? 'مدير'
                            : 'Admin'
                          : isRTL
                          ? 'عضو'
                          : 'Member'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveEditMember}
            >
              <Text style={styles.saveButtonText}>
                {isRTL ? 'حفظ' : 'Save'}
              </Text>
            </TouchableOpacity>

            {editLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overviewTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
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
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 12,
  },
  membersList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 2,
  },
  memberRelation: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginBottom: 2,
  },
  memberLastActive: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
  },
  memberRight: {
    alignItems: 'flex-end',
  },
  healthScore: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  pendingIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
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
    fontFamily: 'Inter-SemiBold',
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
    fontFamily: 'Inter-Medium',
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
    fontFamily: 'Inter-Regular',
    backgroundColor: '#FFFFFF',
  },
  rtlInput: {
    fontFamily: 'Cairo-Regular',
  },
  relationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  relationOption: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  relationOptionSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  relationOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  relationOptionTextSelected: {
    color: '#FFFFFF',
  },
  inviteButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  inviteButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  inviteButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  codeContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  codeLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 16,
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
  },
  memberStats: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  emergencyDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginBottom: 16,
  },
  addContactButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  addContactText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#2563EB',
    marginLeft: 8,
  },
  settingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
  },
  settingText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E293B',
  },
  toggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  joinFamilyButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  joinFamilyButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  roleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  roleOptionSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  roleOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  roleOptionTextSelected: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
  },
  deleteContactButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#FEF2F2',
  },
  addContactForm: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});

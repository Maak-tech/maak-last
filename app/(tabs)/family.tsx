import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Modal,
  Alert,
  Share,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus, Users, Heart, AlertTriangle, UserPlus, Share2, X } from 'lucide-react-native';

const SAMPLE_FAMILY_MEMBERS = [
  {
    id: '1',
    name: 'Sarah Ahmed',
    relation: 'Mother',
    avatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
    healthScore: 85,
    lastActive: '2 hours ago',
    status: 'good',
    alerts: 0,
  },
  {
    id: '2',
    name: 'Omar Ahmed',
    relation: 'Father',
    avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
    healthScore: 72,
    lastActive: '1 day ago',
    status: 'attention',
    alerts: 1,
  },
  {
    id: '3',
    name: 'Layla Ahmed',
    relation: 'Sister',
    avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
    healthScore: 92,
    lastActive: '30 minutes ago',
    status: 'excellent',
    alerts: 0,
  },
];

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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [familyMembers, setFamilyMembers] = useState(SAMPLE_FAMILY_MEMBERS);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    relation: '',
    email: '',
    phone: '',
  });

  const isRTL = i18n.language === 'ar';

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return '#10B981';
      case 'good': return '#2563EB';
      case 'attention': return '#F59E0B';
      case 'critical': return '#EF4444';
      default: return '#64748B';
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
    if (!inviteForm.name || !inviteForm.relation) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'يرجى ملء الحقول المطلوبة' : 'Please fill in required fields'
      );
      return;
    }

    // Generate invite link
    const inviteLink = `https://maak.app/invite?family=123&member=${encodeURIComponent(inviteForm.name)}`;
    
    try {
      await Share.share({
        message: isRTL 
          ? `مرحباً ${inviteForm.name}! تم دعوتك للانضمام إلى مجموعة العائلة الصحية على تطبيق معك. انقر على الرابط للانضمام: ${inviteLink}`
          : `Hi ${inviteForm.name}! You've been invited to join our family health group on Maak app. Click the link to join: ${inviteLink}`,
        title: isRTL ? 'دعوة للانضمام إلى معك' : 'Invitation to join Maak',
      });

      // Add pending member
      const newMember = {
        id: Date.now().toString(),
        name: inviteForm.name,
        relation: inviteForm.relation,
        avatar: 'https://images.pexels.com/photos/1300402/pexels-photo-1300402.jpeg?auto=compress&cs=tinysrgb&w=150',
        healthScore: 0,
        lastActive: 'Pending invitation',
        status: 'pending',
        alerts: 0,
      };

      setFamilyMembers([...familyMembers, newMember]);
      setInviteForm({ name: '', relation: '', email: '', phone: '' });
      setShowInviteModal(false);

      Alert.alert(
        isRTL ? 'تم الإرسال' : 'Invitation Sent',
        isRTL ? 'تم إرسال الدعوة بنجاح' : 'Invitation has been sent successfully'
      );
    } catch (error) {
      console.error('Error sharing invite:', error);
    }
  };

  const getFamilyStats = () => {
    const totalMembers = familyMembers.length;
    const activeMembers = familyMembers.filter(member => member.status !== 'pending').length;
    const totalAlerts = familyMembers.reduce((sum, member) => sum + member.alerts, 0);
    const avgHealthScore = Math.round(
      familyMembers
        .filter(member => member.healthScore > 0)
        .reduce((sum, member) => sum + member.healthScore, 0) / 
      familyMembers.filter(member => member.healthScore > 0).length
    );

    return { totalMembers, activeMembers, totalAlerts, avgHealthScore };
  };

  const { totalMembers, activeMembers, totalAlerts, avgHealthScore } = getFamilyStats();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>{t('family')}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowInviteModal(true)}
        >
          <UserPlus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Family Overview */}
        <View style={styles.overviewCard}>
          <Text style={[styles.overviewTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'نظرة عامة على العائلة' : 'Family Overview'}
          </Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Users size={20} color="#2563EB" />
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>{totalMembers}</Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'أفراد' : 'Members'}
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Heart size={20} color="#10B981" />
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>{avgHealthScore || 0}</Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'نقاط الصحة' : 'Health Score'}
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <AlertTriangle size={20} color="#F59E0B" />
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>{totalAlerts}</Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'تنبيهات' : 'Alerts'}
              </Text>
            </View>
          </View>
        </View>

        {/* Family Members */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t('familyMembers')}
          </Text>
          
          <View style={styles.membersList}>
            {familyMembers.map((member) => (
              <TouchableOpacity key={member.id} style={styles.memberItem}>
                <View style={styles.memberLeft}>
                  <View style={styles.avatarContainer}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </Text>
                    </View>
                    {member.alerts > 0 && (
                      <View style={styles.alertBadge}>
                        <Text style={styles.alertBadgeText}>{member.alerts}</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, isRTL && styles.rtlText]}>
                      {member.name}
                    </Text>
                    <Text style={[styles.memberRelation, isRTL && styles.rtlText]}>
                      {member.relation}
                    </Text>
                    <Text style={[styles.memberLastActive, isRTL && styles.rtlText]}>
                      {isRTL ? 'آخر نشاط' : 'Last active'}: {member.lastActive}
                    </Text>
                  </View>
                </View>

                <View style={styles.memberRight}>
                  {member.status !== 'pending' && (
                    <>
                      <Text style={[styles.healthScore, isRTL && styles.rtlText]}>
                        {member.healthScore}
                      </Text>
                      <View 
                        style={[
                          styles.statusIndicator, 
                          { backgroundColor: getHealthStatusColor(member.status) }
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {getHealthStatusText(member.status)}
                        </Text>
                      </View>
                    </>
                  )}
                  {member.status === 'pending' && (
                    <View style={styles.pendingIndicator}>
                      <Text style={[styles.pendingText, isRTL && styles.rtlText]}>
                        {isRTL ? 'في الانتظار' : 'Pending'}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
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
              <Share2 size={24} color="#2563EB" />
              <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                {isRTL ? 'مشاركة التطبيق' : 'Share App'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.quickActionButton}>
              <AlertTriangle size={24} color="#F59E0B" />
              <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                {isRTL ? 'إعدادات الطوارئ' : 'Emergency Settings'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Invite Member Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {t('inviteFamily')}
            </Text>
            <TouchableOpacity
              onPress={() => setShowInviteModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Name */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'الاسم الكامل' : 'Full Name'} *
              </Text>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlInput]}
                value={inviteForm.name}
                onChangeText={(text) => setInviteForm({...inviteForm, name: text})}
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
                      inviteForm.relation === (isRTL ? relation.labelAr : relation.labelEn) && 
                      styles.relationOptionSelected,
                    ]}
                    onPress={() => setInviteForm({
                      ...inviteForm, 
                      relation: isRTL ? relation.labelAr : relation.labelEn
                    })}
                  >
                    <Text
                      style={[
                        styles.relationOptionText,
                        inviteForm.relation === (isRTL ? relation.labelAr : relation.labelEn) && 
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

            {/* Email */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'البريد الإلكتروني' : 'Email'} ({isRTL ? 'اختياري' : 'Optional'})
              </Text>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlInput]}
                value={inviteForm.email}
                onChangeText={(text) => setInviteForm({...inviteForm, email: text})}
                placeholder={isRTL ? 'البريد الإلكتروني' : 'Email address'}
                keyboardType="email-address"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Phone */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'رقم الهاتف' : 'Phone Number'} ({isRTL ? 'اختياري' : 'Optional'})
              </Text>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlInput]}
                value={inviteForm.phone}
                onChangeText={(text) => setInviteForm({...inviteForm, phone: text})}
                placeholder={isRTL ? 'رقم الهاتف' : 'Phone number'}
                keyboardType="phone-pad"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            <TouchableOpacity
              style={styles.inviteButton}
              onPress={handleInviteMember}
            >
              <Text style={styles.inviteButtonText}>
                {isRTL ? 'إرسال الدعوة' : 'Send Invitation'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.inviteNote, isRTL && styles.rtlText]}>
              {isRTL 
                ? 'سيتم إرسال رابط دعوة لتحميل التطبيق والانضمام إلى مجموعة العائلة'
                : 'An invitation link will be sent to download the app and join your family group'
              }
            </Text>
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
  alertBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
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
  inviteButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  inviteNote: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
  },
});
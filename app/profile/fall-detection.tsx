import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useFallDetectionContext } from '@/contexts/FallDetectionContext';
import { pushNotificationService } from '@/lib/services/pushNotificationService';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Bell,
  TestTube,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  Activity,
} from 'lucide-react-native';

export default function FallDetectionScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const {
    isEnabled,
    isActive,
    isInitialized,
    toggleFallDetection,
    testFallDetection,
    lastAlert,
  } = useFallDetectionContext();
  const [testingNotifications, setTestingNotifications] = useState(false);
  const [testingFallDetection, setTestingFallDetection] = useState(false);

  const isRTL = i18n.language === 'ar';

  const handleTestNotifications = async () => {
    if (!user) return;

    try {
      setTestingNotifications(true);
      await pushNotificationService.sendTestNotification(user.id, user.name);

      Alert.alert(
        isRTL ? 'تم إرسال الإشعار' : 'Notification Sent',
        isRTL
          ? 'تم إرسال إشعار تجريبي بنجاح. تحقق من الإشعارات.'
          : 'Test notification sent successfully. Check your notifications.',
        [{ text: isRTL ? 'موافق' : 'OK' }]
      );
    } catch (error) {
      console.error('Error testing notifications:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL
          ? 'فشل في إرسال الإشعار التجريبي'
          : 'Failed to send test notification'
      );
    } finally {
      setTestingNotifications(false);
    }
  };

  const handleTestFallDetection = async () => {
    try {
      setTestingFallDetection(true);
      await testFallDetection();
    } catch (error) {
      console.error('Error testing fall detection:', error);
    } finally {
      setTestingFallDetection(false);
    }
  };

  const getStatusColor = () => {
    if (!isEnabled) return '#EF4444'; // Red - disabled
    if (!isActive) return '#F59E0B'; // Yellow - enabled but not active
    return '#10B981'; // Green - active
  };

  const getStatusText = () => {
    if (!isEnabled) return isRTL ? 'معطل' : 'Disabled';
    if (!isActive) return isRTL ? 'جاري التحضير...' : 'Starting...';
    return isRTL ? 'نشط' : 'Active';
  };

  const getStatusIcon = () => {
    if (!isEnabled) return <XCircle size={24} color="#EF4444" />;
    if (!isActive) return <AlertTriangle size={24} color="#F59E0B" />;
    return <CheckCircle size={24} color="#10B981" />;
  };

  const formatLastAlert = () => {
    if (!lastAlert) return isRTL ? 'لا توجد تنبيهات' : 'No alerts';

    const timeAgo = Math.floor(
      (Date.now() - lastAlert.timestamp.getTime()) / 1000
    );
    if (timeAgo < 60)
      return isRTL ? 'منذ أقل من دقيقة' : 'Less than a minute ago';
    if (timeAgo < 3600)
      return isRTL
        ? `منذ ${Math.floor(timeAgo / 60)} دقائق`
        : `${Math.floor(timeAgo / 60)} minutes ago`;
    if (timeAgo < 86400)
      return isRTL
        ? `منذ ${Math.floor(timeAgo / 3600)} ساعات`
        : `${Math.floor(timeAgo / 3600)} hours ago`;
    return isRTL
      ? `منذ ${Math.floor(timeAgo / 86400)} أيام`
      : `${Math.floor(timeAgo / 86400)} days ago`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {isRTL ? 'كشف السقوط' : 'Fall Detection'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIcon}>{getStatusIcon()}</View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, isRTL && styles.rtlText]}>
                {isRTL ? 'حالة كشف السقوط' : 'Fall Detection Status'}
              </Text>
              <Text
                style={[
                  styles.statusValue,
                  isRTL && styles.rtlText,
                  { color: getStatusColor() },
                ]}
              >
                {getStatusText()}
              </Text>
            </View>
          </View>

          {isInitialized && (
            <View style={styles.statusToggle}>
              <Text style={[styles.toggleLabel, isRTL && styles.rtlText]}>
                {isRTL ? 'تفعيل كشف السقوط' : 'Enable Fall Detection'}
              </Text>
              <Switch
                value={isEnabled}
                onValueChange={toggleFallDetection}
                trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                thumbColor={isEnabled ? '#FFFFFF' : '#9CA3AF'}
              />
            </View>
          )}
        </View>

        {/* Information Cards */}
        <View style={styles.infoCards}>
          {/* How It Works */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Activity size={24} color="#2563EB" />
              <Text style={[styles.infoTitle, isRTL && styles.rtlText]}>
                {isRTL ? 'كيف يعمل' : 'How It Works'}
              </Text>
            </View>
            <Text style={[styles.infoText, isRTL && styles.rtlText]}>
              {isRTL
                ? 'يستخدم التطبيق أجهزة استشعار الحركة في هاتفك لرصد الحركة غير الطبيعية التي قد تشير إلى سقوط. عند اكتشاف سقوط محتمل، يتم إرسال تنبيه فوري إلى أفراد العائلة.'
                : "The app uses your phone's motion sensors to detect unusual movement patterns that may indicate a fall. When a potential fall is detected, immediate alerts are sent to family members."}
            </Text>
          </View>

          {/* Family Notifications */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Users size={24} color="#10B981" />
              <Text style={[styles.infoTitle, isRTL && styles.rtlText]}>
                {isRTL ? 'تنبيهات العائلة' : 'Family Notifications'}
              </Text>
            </View>
            <Text style={[styles.infoText, isRTL && styles.rtlText]}>
              {user?.familyId
                ? isRTL
                  ? 'عند اكتشاف سقوط، سيتم إرسال إشعارات فورية إلى جميع أفراد العائلة المسجلين.'
                  : 'When a fall is detected, instant notifications will be sent to all registered family members.'
                : isRTL
                ? 'انضم إلى عائلة لتفعيل تنبيهات العائلة.'
                : 'Join a family to enable family notifications.'}
            </Text>
          </View>

          {/* Last Alert */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Bell size={24} color="#F59E0B" />
              <Text style={[styles.infoTitle, isRTL && styles.rtlText]}>
                {isRTL ? 'آخر تنبيه' : 'Last Alert'}
              </Text>
            </View>
            <Text style={[styles.infoText, isRTL && styles.rtlText]}>
              {formatLastAlert()}
            </Text>
          </View>
        </View>

        {/* Test Buttons */}
        <View style={styles.testSection}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'اختبار النظام' : 'Test System'}
          </Text>

          <TouchableOpacity
            style={[styles.testButton, styles.primaryButton]}
            onPress={handleTestFallDetection}
            disabled={testingFallDetection}
          >
            {testingFallDetection ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <TestTube size={24} color="#FFFFFF" />
            )}
            <Text style={[styles.testButtonText, isRTL && styles.rtlText]}>
              {isRTL ? 'اختبار كشف السقوط' : 'Test Fall Detection'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, styles.secondaryButton]}
            onPress={handleTestNotifications}
            disabled={testingNotifications}
          >
            {testingNotifications ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <Bell size={24} color="#2563EB" />
            )}
            <Text
              style={[styles.testButtonTextSecondary, isRTL && styles.rtlText]}
            >
              {isRTL ? 'اختبار الإشعارات' : 'Test Notifications'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Warning */}
        <View style={styles.warningCard}>
          <AlertTriangle size={24} color="#F59E0B" />
          <Text style={[styles.warningText, isRTL && styles.rtlText]}>
            {isRTL
              ? 'تذكر: كشف السقوط يستخدم أجهزة استشعار الهاتف وقد لا يكون دقيقاً في جميع الحالات. لا يُغني عن الرعاية الطبية المناسبة.'
              : 'Remember: Fall detection uses phone sensors and may not be accurate in all situations. It does not replace proper medical care.'}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIcon: {
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  toggleLabel: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  infoCards: {
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  testSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  testButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
    marginLeft: 12,
  },
  warningCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  rtlText: {
    textAlign: 'right',
  },
});

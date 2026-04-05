import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Heart,
  Pill,
  AlertTriangle,
  Users,
  Clock,
  Volume2,
  Smartphone,
} from "lucide-react-native";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { pushNotificationService } from "@/lib/services/pushNotificationService";
import { userService } from "@/lib/services/userService";

interface NotificationSettings {
  enabled: boolean;
  fallAlerts: boolean;
  medicationReminders: boolean;
  symptomAlerts: boolean;
  familyUpdates: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  sound: boolean;
  vibration: boolean;
}

export default function NotificationSettingsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timePickerField, setTimePickerField] = useState<'quietHoursStart' | 'quietHoursEnd' | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    fallAlerts: true,
    medicationReminders: true,
    symptomAlerts: true,
    familyUpdates: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    sound: true,
    vibration: true,
  });

  const isRTL = i18n.language === 'ar';

  useEffect(() => {
    loadSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userData = await userService.getUser(user.id);
      if (userData?.preferences?.notifications && typeof userData.preferences.notifications === 'object') {
        setSettings({
          ...settings,
          ...(userData.preferences.notifications as unknown as Partial<NotificationSettings>),
        });
      }
    } catch (error: unknown) {
      console.error('Error loading notification settings:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'فشل في تحميل إعدادات الإشعارات' : 'Failed to load notification settings'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;

    try {
      await api.patch("/api/user/notification-preferences", { preferences: settings }).catch((err) => {
        console.warn('[notification-settings] Failed to persist preferences to API:', err instanceof Error ? err.message : String(err));
      });

      // Also update locally
      await userService.updateUser(user.id, {
        preferences: {
          ...user.preferences,
          notifications: settings,
        },
      });

      Alert.alert(
        isRTL ? 'تم الحفظ' : 'Saved',
        isRTL
          ? 'تم حفظ إعدادات الإشعارات بنجاح'
          : 'Notification settings saved successfully',
        [{ text: isRTL ? 'موافق' : 'OK' }]
      );
    } catch (error: unknown) {
      console.error('Error saving settings:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL
          ? 'فشل في حفظ الإعدادات'
          : 'Failed to save settings'
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (key: keyof NotificationSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const renderToggleItem = (
    icon: React.ReactNode,
    title: string,
    subtitle: string,
    settingKey: keyof NotificationSettings,
    color: string = '#2563EB'
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          {icon}
        </View>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingTitle, isRTL && styles.rtlText]}>
            {title}
          </Text>
          <Text style={[styles.settingSubtitle, isRTL && styles.rtlText]}>
            {subtitle}
          </Text>
        </View>
      </View>
      <Switch
        value={settings[settingKey] as boolean}
        onValueChange={() => toggleSetting(settingKey)}
        trackColor={{ false: '#E5E7EB', true: color }}
        thumbColor={settings[settingKey] ? '#FFFFFF' : '#9CA3AF'}
        disabled={settingKey !== 'enabled' && !settings.enabled}
      />
    </View>
  );

  // Generate 30-minute interval time options for quiet hours picker
  const TIME_OPTIONS: string[] = [];
  for (let h = 0; h < 24; h++) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
  }

  const handleTimeSelect = (time: string) => {
    if (!timePickerField) return;
    setSettings(prev => ({ ...prev, [timePickerField]: time }));
    setTimePickerField(null);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
            {isRTL ? 'جاري التحميل...' : 'Loading...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
          {isRTL ? 'إعدادات الإشعارات' : 'Notification Settings'}
        </Text>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSaveSettings}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <Text style={[styles.saveButtonText, isRTL && styles.rtlText]}>
              {isRTL ? 'حفظ' : 'Save'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Master Toggle */}
        <View style={styles.section}>
          <View style={styles.masterToggleCard}>
            <View style={styles.masterToggleContent}>
              {settings.enabled ? (
                <Bell size={32} color="#2563EB" />
              ) : (
                <BellOff size={32} color="#9CA3AF" />
              )}
              <View style={styles.masterToggleInfo}>
                <Text style={[styles.masterToggleTitle, isRTL && styles.rtlText]}>
                  {isRTL ? 'الإشعارات' : 'Notifications'}
                </Text>
                <Text style={[styles.masterToggleSubtitle, isRTL && styles.rtlText]}>
                  {settings.enabled
                    ? isRTL
                      ? 'الإشعارات مفعلة'
                      : 'Notifications are enabled'
                    : isRTL
                    ? 'الإشعارات معطلة'
                    : 'Notifications are disabled'}
                </Text>
              </View>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={() => toggleSetting('enabled')}
              trackColor={{ false: '#E5E7EB', true: '#2563EB' }}
              thumbColor={settings.enabled ? '#FFFFFF' : '#9CA3AF'}
            />
          </View>
        </View>

        {/* Notification Types */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'أنواع الإشعارات' : 'Notification Types'}
          </Text>
          
          {renderToggleItem(
            <AlertTriangle size={20} color="#EF4444" />,
            isRTL ? 'تنبيهات السقوط' : 'Fall Alerts',
            isRTL
              ? 'إشعارات فورية عند اكتشاف سقوط'
              : 'Immediate notifications when a fall is detected',
            'fallAlerts',
            '#EF4444'
          )}

          {renderToggleItem(
            <Pill size={20} color="#10B981" />,
            isRTL ? 'تذكيرات الأدوية' : 'Medication Reminders',
            isRTL
              ? 'تذكيرات في أوقات تناول الأدوية'
              : 'Reminders at medication times',
            'medicationReminders',
            '#10B981'
          )}

          {renderToggleItem(
            <Heart size={20} color="#F59E0B" />,
            isRTL ? 'تنبيهات الأعراض' : 'Symptom Alerts',
            isRTL
              ? 'إشعارات عند تسجيل أعراض شديدة'
              : 'Notifications for severe symptoms',
            'symptomAlerts',
            '#F59E0B'
          )}

          {renderToggleItem(
            <Users size={20} color="#8B5CF6" />,
            isRTL ? 'تحديثات العائلة' : 'Family Updates',
            isRTL
              ? 'إشعارات حول نشاطات أفراد العائلة'
              : 'Notifications about family member activities',
            'familyUpdates',
            '#8B5CF6'
          )}
        </View>

        {/* Alert Preferences */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'تفضيلات التنبيه' : 'Alert Preferences'}
          </Text>

          {renderToggleItem(
            <Volume2 size={20} color="#2563EB" />,
            isRTL ? 'الصوت' : 'Sound',
            isRTL
              ? 'تشغيل صوت مع الإشعارات'
              : 'Play sound with notifications',
            'sound'
          )}

          {renderToggleItem(
            <Smartphone size={20} color="#2563EB" />,
            isRTL ? 'الاهتزاز' : 'Vibration',
            isRTL
              ? 'اهتزاز الجهاز مع الإشعارات'
              : 'Vibrate device with notifications',
            'vibration'
          )}
        </View>

        {/* Quiet Hours */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'ساعات الهدوء' : 'Quiet Hours'}
          </Text>

          {renderToggleItem(
            <Clock size={20} color="#6B7280" />,
            isRTL ? 'تفعيل ساعات الهدوء' : 'Enable Quiet Hours',
            isRTL
              ? 'إيقاف الإشعارات غير الطارئة خلال أوقات محددة'
              : 'Pause non-urgent notifications during specific hours',
            'quietHoursEnabled',
            '#6B7280'
          )}

          {settings.quietHoursEnabled && (
            <View style={styles.quietHoursSettings}>
              <View style={styles.timeRow}>
                <Text style={[styles.timeLabel, isRTL && styles.rtlText]}>
                  {isRTL ? 'من' : 'From'}
                </Text>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setTimePickerField('quietHoursStart')}
                >
                  <Text style={styles.timeText}>{settings.quietHoursStart}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.timeRow}>
                <Text style={[styles.timeLabel, isRTL && styles.rtlText]}>
                  {isRTL ? 'إلى' : 'To'}
                </Text>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setTimePickerField('quietHoursEnd')}
                >
                  <Text style={styles.timeText}>{settings.quietHoursEnd}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Quiet hours time picker modal */}
          <Modal
            visible={timePickerField !== null}
            transparent
            animationType="slide"
            onRequestClose={() => setTimePickerField(null)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setTimePickerField(null)}
            >
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>
                  {timePickerField === 'quietHoursStart'
                    ? (isRTL ? 'وقت البدء' : 'Start Time')
                    : (isRTL ? 'وقت الانتهاء' : 'End Time')}
                </Text>
                <FlatList
                  data={TIME_OPTIONS}
                  keyExtractor={item => item}
                  style={styles.timeList}
                  renderItem={({ item }) => {
                    const isSelected =
                      timePickerField && settings[timePickerField] === item;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.timeOption,
                          isSelected && styles.timeOptionSelected,
                        ]}
                        onPress={() => handleTimeSelect(item)}
                      >
                        <Text
                          style={[
                            styles.timeOptionText,
                            isSelected && styles.timeOptionTextSelected,
                          ]}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <AlertTriangle size={20} color="#F59E0B" />
          <Text style={[styles.infoText, isRTL && styles.rtlText]}>
            {isRTL
              ? 'تنبيهات الطوارئ مثل السقوط ستصلك دائماً حتى في ساعات الهدوء'
              : 'Emergency alerts like fall detection will always notify you, even during quiet hours'}
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
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EBF4FF',
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  masterToggleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  masterToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  masterToggleInfo: {
    marginLeft: 16,
    flex: 1,
  },
  masterToggleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  masterToggleSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  settingItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  quietHoursSettings: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  timeButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  infoCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  infoText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  rtlText: {
    textAlign: 'right',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '55%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  timeList: {
    marginTop: 8,
  },
  timeOption: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  timeOptionSelected: {
    backgroundColor: '#EBF4FF',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
  timeOptionTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
});
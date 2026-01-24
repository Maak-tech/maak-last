import { useNavigation, useRouter } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BellOff,
  Clock,
  Heart,
  Pill,
  Smartphone,
  Users,
  Volume2,
} from "lucide-react-native";
import type React from "react";
import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { pushNotificationService } from "@/lib/services/pushNotificationService";
import { userService } from "@/lib/services/userService";

interface NotificationSettings {
  enabled: boolean;
  fallAlerts: boolean;
  wellnessCheckins: boolean;
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
  const navigation = useNavigation();
  const {
    cancelAllMedicationNotifications,
    clearDuplicateMedicationNotifications,
  } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    fallAlerts: true,
    wellnessCheckins: true,
    medicationReminders: true,
    symptomAlerts: true,
    familyUpdates: true,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    sound: true,
    vibration: true,
  });

  const isRTL = i18n.language === "ar";
  const isAdmin = user?.role === "admin";

  // Hide the default header to prevent duplicate headers
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userData = await userService.getUser(user.id);
      if (userData?.preferences?.notifications) {
        const notificationPrefs = userData.preferences
          .notifications as unknown as NotificationSettings;
        setSettings({
          ...settings,
          ...notificationPrefs,
        });
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;

    try {
      setSaving(true);

      // Update settings in Firestore via Cloud Function
      const functions = getFunctions();
      const updatePreferences = httpsCallable(
        functions,
        "updateNotificationPreferences"
      );

      await updatePreferences({ preferences: settings });

      // Also update locally
      // Note: notifications is stored as an object in Firestore, but User type defines it as boolean
      await userService.updateUser(user.id, {
        preferences: {
          ...user.preferences,
          notifications: settings as any,
        },
      });

      Alert.alert(
        isRTL ? "تم الحفظ" : "Saved",
        isRTL
          ? "تم حفظ إعدادات الإشعارات بنجاح"
          : "Notification settings saved successfully",
        [{ text: isRTL ? "موافق" : "OK" }]
      );
    } catch (error) {
      // Silently handle error
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في حفظ الإعدادات" : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = async (key: keyof NotificationSettings) => {
    const newValue = !settings[key];
    setSettings((prev) => ({
      ...prev,
      [key]: newValue,
    }));

    // If medication reminders are being disabled, cancel all scheduled reminders
    if (key === "medicationReminders" && newValue === false) {
      try {
        await cancelAllMedicationNotifications();
      } catch (error) {
        // Silently handle error - user can manually clear if needed
      }
    }

    // If notifications are globally disabled, cancel all medication reminders
    if (key === "enabled" && newValue === false) {
      try {
        await cancelAllMedicationNotifications();
      } catch (error) {
        // Silently handle error
      }
    }

    // If wellness check-ins are disabled, cancel scheduled check-ins to stop immediate noise
    if (
      (key === "wellnessCheckins" && newValue === false) ||
      (key === "enabled" && newValue === false)
    ) {
      try {
        const { Platform } = await import("react-native");
        if (Platform.OS !== "web") {
          const Notifications = await import("expo-notifications");
          const allScheduled =
            await Notifications.getAllScheduledNotificationsAsync();

          for (const notification of allScheduled as any[]) {
            const data = notification?.content?.data;
            const dataType = typeof data?.type === "string" ? data.type : "";
            const isCheckin =
              dataType.includes("checkin") ||
              dataType.includes("reflection") ||
              dataType.includes("wellness");

            if (isCheckin) {
              try {
                await Notifications.cancelScheduledNotificationAsync(
                  notification.identifier
                );
              } catch {
                // Silently handle individual cancellation error
              }
            }
          }
        }
      } catch {
        // Silently handle cancellation error
      }
    }
  };

  const renderToggleItem = (
    icon: React.ReactNode,
    title: string,
    subtitle: string,
    settingKey: keyof NotificationSettings,
    color = "#2563EB"
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          {icon}
        </View>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingTitle, isRTL && { textAlign: "left" }]}>
            {title}
          </Text>
          <Text
            style={[styles.settingSubtitle, isRTL && { textAlign: "left" }]}
          >
            {subtitle}
          </Text>
        </View>
      </View>
      <Switch
        disabled={settingKey !== "enabled" && !settings.enabled}
        onValueChange={() => toggleSetting(settingKey)}
        thumbColor={settings[settingKey] ? "#FFFFFF" : "#9CA3AF"}
        trackColor={{ false: "#E5E7EB", true: color }}
        value={settings[settingKey] as boolean}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#2563EB" size="large" />
          <Text style={[styles.loadingText, isRTL && { textAlign: "left" }]}>
            {isRTL ? "جاري التحميل..." : "Loading..."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color="#333" size={24} />
        </TouchableOpacity>
        <Text style={[styles.title, isRTL && { textAlign: "left" }]}>
          {isRTL ? "إعدادات الإشعارات" : "Notification Settings"}
        </Text>
        <TouchableOpacity
          disabled={saving}
          onPress={handleSaveSettings}
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        >
          {saving ? (
            <ActivityIndicator color="#2563EB" size="small" />
          ) : (
            <Text
              style={[styles.saveButtonText, isRTL && { textAlign: "left" }]}
            >
              {isRTL ? "حفظ" : "Save"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        {/* Master Toggle */}
        <View style={styles.section}>
          <View style={styles.masterToggleCard}>
            <View style={styles.masterToggleContent}>
              {settings.enabled ? (
                <Bell color="#2563EB" size={32} />
              ) : (
                <BellOff color="#9CA3AF" size={32} />
              )}
              <View style={styles.masterToggleInfo}>
                <Text
                  style={[
                    styles.masterToggleTitle,
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {isRTL ? "الإشعارات" : "Notifications"}
                </Text>
                <Text
                  style={[
                    styles.masterToggleSubtitle,
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {settings.enabled
                    ? isRTL
                      ? "الإشعارات مفعلة"
                      : "Notifications are enabled"
                    : isRTL
                      ? "الإشعارات معطلة"
                      : "Notifications are disabled"}
                </Text>
              </View>
            </View>
            <Switch
              onValueChange={() => toggleSetting("enabled")}
              thumbColor={settings.enabled ? "#FFFFFF" : "#9CA3AF"}
              trackColor={{ false: "#E5E7EB", true: "#2563EB" }}
              value={settings.enabled}
            />
          </View>
        </View>

        {/* Notification Types */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: "left" }]}>
            {isRTL ? "أنواع الإشعارات" : "Notification Types"}
          </Text>

          {renderToggleItem(
            <AlertTriangle color="#EF4444" size={20} />,
            isRTL ? "تنبيهات السقوط" : "Fall Alerts",
            isRTL
              ? "إشعارات فورية عند اكتشاف سقوط"
              : "Immediate notifications when a fall is detected",
            "fallAlerts",
            "#EF4444"
          )}

          {renderToggleItem(
            <Bell color="#2563EB" size={20} />,
            isRTL ? "تحديثات العافية اليومية" : "Wellness Check-ins",
            isRTL
              ? "تذكيرات يومية بسيطة لمتابعة الصحة"
              : "Light daily check-ins to track wellbeing",
            "wellnessCheckins",
            "#2563EB"
          )}

          {renderToggleItem(
            <Pill color="#10B981" size={20} />,
            isRTL ? "تذكيرات الأدوية" : "Medication Reminders",
            isRTL
              ? "تذكيرات في أوقات تناول الأدوية"
              : "Reminders at medication times",
            "medicationReminders",
            "#10B981"
          )}

          {renderToggleItem(
            <Heart color="#F59E0B" size={20} />,
            isRTL ? "تنبيهات الأعراض" : "Symptom Alerts",
            isRTL
              ? "إشعارات عند تسجيل أعراض شديدة"
              : "Notifications for severe symptoms",
            "symptomAlerts",
            "#F59E0B"
          )}

          {renderToggleItem(
            <Users color="#8B5CF6" size={20} />,
            isRTL ? "تحديثات العائلة" : "Family Updates",
            isRTL
              ? "إشعارات حول نشاطات أفراد العائلة"
              : "Notifications about family member activities",
            "familyUpdates",
            "#8B5CF6"
          )}
        </View>

        {/* Alert Preferences */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: "left" }]}>
            {isRTL ? "تفضيلات التنبيه" : "Alert Preferences"}
          </Text>

          {renderToggleItem(
            <Volume2 color="#2563EB" size={20} />,
            isRTL ? "الصوت" : "Sound",
            isRTL ? "تشغيل صوت مع الإشعارات" : "Play sound with notifications",
            "sound"
          )}

          {renderToggleItem(
            <Smartphone color="#2563EB" size={20} />,
            isRTL ? "الاهتزاز" : "Vibration",
            isRTL
              ? "اهتزاز الجهاز مع الإشعارات"
              : "Vibrate device with notifications",
            "vibration"
          )}
        </View>

        {/* Quiet Hours */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: "left" }]}>
            {isRTL ? "ساعات الهدوء" : "Quiet Hours"}
          </Text>

          {renderToggleItem(
            <Clock color="#6B7280" size={20} />,
            isRTL ? "تفعيل ساعات الهدوء" : "Enable Quiet Hours",
            isRTL
              ? "إيقاف الإشعارات غير الطارئة خلال أوقات محددة"
              : "Pause non-urgent notifications during specific hours",
            "quietHoursEnabled",
            "#6B7280"
          )}

          {settings.quietHoursEnabled && (
            <View style={styles.quietHoursSettings}>
              <View style={styles.timeRow}>
                <Text
                  style={[styles.timeLabel, isRTL && { textAlign: "left" }]}
                >
                  {isRTL ? "من" : "From"}
                </Text>
                <TouchableOpacity style={styles.timeButton}>
                  <Text style={styles.timeText}>
                    {settings.quietHoursStart}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.timeRow}>
                <Text
                  style={[styles.timeLabel, isRTL && { textAlign: "left" }]}
                >
                  {isRTL ? "إلى" : "To"}
                </Text>
                <TouchableOpacity style={styles.timeButton}>
                  <Text style={styles.timeText}>{settings.quietHoursEnd}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Clear Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: "left" }]}>
            {isRTL ? "إدارة الإشعارات" : "Notification Management"}
          </Text>

          <TouchableOpacity
            onPress={async () => {
              Alert.alert(
                isRTL ? "مسح الإشعارات" : "Clear Notifications",
                isRTL
                  ? "هل تريد إلغاء جميع تذكيرات الأدوية المجدولة؟"
                  : "Do you want to cancel all scheduled medication reminders?",
                [
                  {
                    text: isRTL ? "إلغاء" : "Cancel",
                    style: "cancel",
                  },
                  {
                    text: isRTL ? "مسح" : "Clear",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        // Clear duplicates first
                        await clearDuplicateMedicationNotifications();
                        // Then cancel all medication notifications
                        const result = await cancelAllMedicationNotifications();
                        Alert.alert(
                          isRTL ? "تم" : "Done",
                          isRTL
                            ? `تم إلغاء ${result.cancelled} إشعار`
                            : `Cancelled ${result.cancelled} notification${result.cancelled !== 1 ? "s" : ""}`,
                          [{ text: isRTL ? "موافق" : "OK" }]
                        );
                      } catch (error) {
                        Alert.alert(
                          isRTL ? "خطأ" : "Error",
                          isRTL
                            ? "فشل في مسح الإشعارات"
                            : "Failed to clear notifications"
                        );
                      }
                    },
                  },
                ]
              );
            }}
            style={styles.clearButton}
          >
            <BellOff color="#EF4444" size={20} />
            <Text style={styles.clearButtonText}>
              {isRTL
                ? "مسح جميع تذكيرات الأدوية"
                : "Clear All Medication Reminders"}
            </Text>
          </TouchableOpacity>

          {isAdmin && user?.familyId && (
            <TouchableOpacity
              onPress={async () => {
                try {
                  if (!user.familyId) return;
                  await pushNotificationService.sendFamilyUpdateToAdmins({
                    familyId: user.familyId,
                    actorUserId: user.id,
                    title: isRTL
                      ? "👨‍👩‍👧‍👦 تحديث عائلي (اختبار)"
                      : "👨‍👩‍👧‍👦 Family Update (Test)",
                    body: isRTL
                      ? "إذا رأيت هذا الإشعار، فـ Family Updates تعمل لحساب الأدمن."
                      : "If you see this, Family Updates are working for the admin account.",
                    data: {
                      actorUserId: user.id,
                    },
                  });
                  Alert.alert(
                    isRTL ? "تم الإرسال" : "Sent",
                    isRTL
                      ? "تم إرسال إشعار اختبار للأدمن."
                      : "Test family update sent to admin(s)."
                  );
                } catch {
                  Alert.alert(
                    isRTL ? "خطأ" : "Error",
                    isRTL
                      ? "فشل إرسال إشعار الاختبار"
                      : "Failed to send test notification"
                  );
                }
              }}
              style={[
                styles.clearButton,
                { marginTop: 12, borderColor: "#DBEAFE" },
              ]}
            >
              <Users color="#2563EB" size={20} />
              <Text style={[styles.clearButtonText, { color: "#2563EB" }]}>
                {isRTL
                  ? "إرسال تحديث عائلي (اختبار للأدمن)"
                  : "Send Family Update (Admin Test)"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <AlertTriangle color="#F59E0B" size={20} />
          <Text style={[styles.infoText, isRTL && { textAlign: "left" }]}>
            {isRTL
              ? "تنبيهات الطوارئ مثل السقوط ستصلك دائماً حتى في ساعات الهدوء"
              : "Emergency alerts like fall detection will always notify you, even during quiet hours"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#64748B",
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#EBF4FF",
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563EB",
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  masterToggleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  masterToggleContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  masterToggleInfo: {
    marginStart: 16,
    flex: 1,
  },
  masterToggleTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  masterToggleSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  settingItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginEnd: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: "#6B7280",
  },
  quietHoursSettings: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  timeLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  timeButton: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
  },
  infoCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 16,
    margin: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  infoText: {
    fontSize: 14,
    color: "#92400E",
    lineHeight: 20,
    marginStart: 12,
    flex: 1,
  },
  clearButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FEE2E2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#EF4444",
    marginStart: 8,
  },
  rtlText: {
    textAlign: "right",
  },
});

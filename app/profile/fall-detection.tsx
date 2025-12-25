import { useNavigation, useRouter } from "expo-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Bug,
  CheckCircle,
  Settings,
  Shield,
  TestTube,
  Users,
  XCircle,
} from "lucide-react-native";
import { useEffect, useState } from "react";
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
import { useFallDetectionContext } from "@/contexts/FallDetectionContext";
import { motionPermissionService } from "@/lib/services/motionPermissionService";
import { pushNotificationService } from "@/lib/services/pushNotificationService";

export default function FallDetectionScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();

  // Hide the default header to prevent duplicate back buttons
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);
  const {
    isEnabled,
    isActive,
    isInitialized,
    toggleFallDetection,
    testFallDetection,
    runDiagnostics,
    lastAlert,
  } = useFallDetectionContext();
  const [testingNotifications, setTestingNotifications] = useState(false);
  const [testingFallDetection, setTestingFallDetection] = useState(false);
  const [motionPermissionGranted, setMotionPermissionGranted] = useState<
    boolean | null
  >(null);
  const [checkingPermission, setCheckingPermission] = useState(true);

  const isRTL = i18n.language === "ar";

  useEffect(() => {
    checkMotionPermission();
  }, []);

  const checkMotionPermission = async () => {
    setCheckingPermission(true);
    try {
      console.log("[FallDetectionScreen] 🔍 Checking motion permissions...");
      const hasPermission = await motionPermissionService.hasMotionPermission();
      console.log(
        "[FallDetectionScreen] 📋 Stored permission status:",
        hasPermission
      );

      const status = await motionPermissionService.checkMotionAvailability();
      console.log("[FallDetectionScreen] 📋 Motion availability status:", {
        available: status.available,
        granted: status.granted,
        reason: status.reason,
      });

      const isGranted = hasPermission && status.available;
      console.log(
        "[FallDetectionScreen] ✅ Motion permission granted:",
        isGranted
      );
      setMotionPermissionGranted(isGranted);

      if (!isGranted) {
        console.warn(
          "[FallDetectionScreen] ⚠️ Motion permissions not granted. Fall detection may not work."
        );
        if (!status.available) {
          console.error(
            "[FallDetectionScreen] ❌ Motion sensors not available:",
            status.reason
          );
        }
      }
    } catch (error) {
      console.error(
        "[FallDetectionScreen] ❌ Error checking motion permissions:",
        error
      );
      setMotionPermissionGranted(false);
    } finally {
      setCheckingPermission(false);
    }
  };

  const handleOpenMotionPermissions = () => {
    router.push("/profile/motion-permissions" as any);
  };

  const handleTestNotifications = async () => {
    if (!user) return;

    try {
      setTestingNotifications(true);
      const fullName =
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.firstName || "User";
      await pushNotificationService.sendTestNotification(user.id, fullName);

      Alert.alert(
        isRTL ? "تم إرسال الإشعار" : "Notification Sent",
        isRTL
          ? "تم إرسال إشعار تجريبي بنجاح. تحقق من الإشعارات."
          : "Test notification sent successfully. Check your notifications.",
        [{ text: isRTL ? "موافق" : "OK" }]
      );
    } catch (error) {
      // Silently handle error
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "فشل في إرسال الإشعار التجريبي"
          : "Failed to send test notification"
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
      // Silently handle error
    } finally {
      setTestingFallDetection(false);
    }
  };

  const handleRunDiagnostics = async () => {
    try {
      await runDiagnostics();
      Alert.alert(
        isRTL ? "التشخيص" : "Diagnostics",
        isRTL
          ? "تم تشغيل التشخيص. تحقق من سجل وحدة التحكم (Console) للتفاصيل."
          : "Diagnostics completed. Check the console logs for details.",
        [{ text: isRTL ? "موافق" : "OK" }]
      );
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في تشغيل التشخيص" : "Failed to run diagnostics"
      );
    }
  };

  const getStatusColor = () => {
    if (!isEnabled) return "#EF4444"; // Red - disabled
    if (!isActive) return "#F59E0B"; // Yellow - enabled but not active
    return "#10B981"; // Green - active
  };

  const getStatusText = () => {
    if (!isEnabled) return isRTL ? "معطل" : "Disabled";
    if (!isActive) return isRTL ? "جاري التحضير..." : "Starting...";
    return isRTL ? "نشط" : "Active";
  };

  const getStatusIcon = () => {
    if (!isEnabled) return <XCircle color="#EF4444" size={24} />;
    if (!isActive) return <AlertTriangle color="#F59E0B" size={24} />;
    return <CheckCircle color="#10B981" size={24} />;
  };

  const formatLastAlert = () => {
    if (!lastAlert) return isRTL ? "لا توجد تنبيهات" : "No alerts";

    const timeAgo = Math.floor(
      (Date.now() - lastAlert.timestamp.getTime()) / 1000
    );
    if (timeAgo < 60)
      return isRTL ? "منذ أقل من دقيقة" : "Less than a minute ago";
    if (timeAgo < 3600)
      return isRTL
        ? `منذ ${Math.floor(timeAgo / 60)} دقائق`
        : `${Math.floor(timeAgo / 60)} minutes ago`;
    if (timeAgo < 86_400)
      return isRTL
        ? `منذ ${Math.floor(timeAgo / 3600)} ساعات`
        : `${Math.floor(timeAgo / 3600)} hours ago`;
    return isRTL
      ? `منذ ${Math.floor(timeAgo / 86_400)} أيام`
      : `${Math.floor(timeAgo / 86_400)} days ago`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color="#333" size={24} />
        </TouchableOpacity>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {isRTL ? "كشف السقوط" : "Fall Detection"}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        {/* Master Toggle - At the top */}
        {isInitialized && (
          <View style={styles.section}>
            <View style={styles.masterToggleCard}>
              <View style={styles.masterToggleContent}>
                {isEnabled ? (
                  <Shield color="#10B981" size={32} />
                ) : (
                  <Shield color="#9CA3AF" size={32} />
                )}
                <View style={styles.masterToggleInfo}>
                  <Text
                    style={[styles.masterToggleTitle, isRTL && styles.rtlText]}
                  >
                    {isRTL ? "كشف السقوط" : "Fall Detection"}
                  </Text>
                  <Text
                    style={[
                      styles.masterToggleSubtitle,
                      isRTL && styles.rtlText,
                    ]}
                  >
                    {isEnabled
                      ? isRTL
                        ? "كشف السقوط مفعل"
                        : "Fall detection is enabled"
                      : isRTL
                        ? "كشف السقوط معطل"
                        : "Fall detection is disabled"}
                  </Text>
                </View>
              </View>
              <Switch
                onValueChange={toggleFallDetection}
                thumbColor={isEnabled ? "#FFFFFF" : "#9CA3AF"}
                trackColor={{ false: "#E5E7EB", true: "#10B981" }}
                value={isEnabled}
              />
            </View>
          </View>
        )}

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIcon}>{getStatusIcon()}</View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, isRTL && styles.rtlText]}>
                {isRTL ? "حالة كشف السقوط" : "Fall Detection Status"}
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
              {!motionPermissionGranted && (
                <Text
                  style={[styles.permissionWarning, isRTL && styles.rtlText]}
                >
                  {isRTL
                    ? "⚠️ أذونات الحركة مطلوبة"
                    : "⚠️ Motion permissions required"}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Motion Permissions Card */}
        {!motionPermissionGranted && (
          <View style={styles.permissionCard}>
            <View style={styles.permissionHeader}>
              <AlertTriangle color="#F59E0B" size={24} />
              <View style={styles.permissionInfo}>
                <Text style={[styles.permissionTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "أذونات الحركة" : "Motion Permissions"}
                </Text>
                <Text style={[styles.permissionText, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "يجب تفعيل أذونات الحركة واللياقة البدنية لكشف السقوط"
                    : "Motion & Fitness permissions are required for fall detection"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleOpenMotionPermissions}
              style={styles.permissionButton}
            >
              <Settings color="#FFFFFF" size={20} />
              <Text style={styles.permissionButtonText}>
                {isRTL ? "فتح إعدادات الأذونات" : "Open Permission Settings"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Information Cards */}
        <View style={styles.infoCards}>
          {/* How It Works */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Activity color="#2563EB" size={24} />
              <Text style={[styles.infoTitle, isRTL && styles.rtlText]}>
                {isRTL ? "كيف يعمل" : "How It Works"}
              </Text>
            </View>
            <Text style={[styles.infoText, isRTL && styles.rtlText]}>
              {isRTL
                ? "يستخدم التطبيق أجهزة استشعار الحركة في هاتفك لرصد الحركة غير الطبيعية التي قد تشير إلى سقوط. عند اكتشاف سقوط محتمل، يتم إرسال تنبيه فوري إلى أفراد العائلة."
                : "The app uses your phone's motion sensors to detect unusual movement patterns that may indicate a fall. When a potential fall is detected, immediate alerts are sent to family members."}
            </Text>
          </View>

          {/* Family Notifications */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Users color="#10B981" size={24} />
              <Text style={[styles.infoTitle, isRTL && styles.rtlText]}>
                {isRTL ? "تنبيهات العائلة" : "Family Notifications"}
              </Text>
            </View>
            <Text style={[styles.infoText, isRTL && styles.rtlText]}>
              {user?.familyId
                ? isRTL
                  ? "عند اكتشاف سقوط، سيتم إرسال إشعارات فورية إلى جميع أفراد العائلة المسجلين."
                  : "When a fall is detected, instant notifications will be sent to all registered family members."
                : isRTL
                  ? "انضم إلى عائلة لتفعيل تنبيهات العائلة."
                  : "Join a family to enable family notifications."}
            </Text>
          </View>

          {/* Last Alert */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Bell color="#F59E0B" size={24} />
              <Text style={[styles.infoTitle, isRTL && styles.rtlText]}>
                {isRTL ? "آخر تنبيه" : "Last Alert"}
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
            {isRTL ? "اختبار النظام" : "Test System"}
          </Text>

          <TouchableOpacity
            disabled={testingFallDetection}
            onPress={handleTestFallDetection}
            style={[styles.testButton, styles.primaryButton]}
          >
            {testingFallDetection ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <TestTube color="#FFFFFF" size={24} />
            )}
            <Text style={[styles.testButtonText, isRTL && styles.rtlText]}>
              {isRTL ? "اختبار كشف السقوط" : "Test Fall Detection"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={testingNotifications}
            onPress={handleTestNotifications}
            style={[styles.testButton, styles.secondaryButton]}
          >
            {testingNotifications ? (
              <ActivityIndicator color="#2563EB" size="small" />
            ) : (
              <Bell color="#2563EB" size={24} />
            )}
            <Text
              style={[styles.testButtonTextSecondary, isRTL && styles.rtlText]}
            >
              {isRTL ? "اختبار الإشعارات" : "Test Notifications"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleRunDiagnostics}
            style={[styles.testButton, styles.diagnosticButton]}
          >
            <Bug color="#F59E0B" size={24} />
            <Text
              style={[styles.testButtonTextDiagnostic, isRTL && styles.rtlText]}
            >
              {isRTL ? "تشخيص النظام" : "Run Diagnostics"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Warning */}
        <View style={styles.warningCard}>
          <AlertTriangle color="#F59E0B" size={24} />
          <Text style={[styles.warningText, isRTL && styles.rtlText]}>
            {isRTL
              ? "تذكر: كشف السقوط يستخدم أجهزة استشعار الهاتف وقد لا يكون دقيقاً في جميع الحالات. لا يُغني عن الرعاية الطبية المناسبة."
              : "Remember: Fall detection uses phone sensors and may not be accurate in all situations. It does not replace proper medical care."}
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
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
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
    marginLeft: 16,
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
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "500",
    color: "#1F2937",
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  toggleLabel: {
    fontSize: 16,
    color: "#1F2937",
    fontWeight: "500",
  },
  infoCards: {
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginLeft: 12,
  },
  infoText: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  testSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
  },
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
  },
  secondaryButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  diagnosticButton: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 12,
  },
  testButtonTextSecondary: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563EB",
    marginLeft: 12,
  },
  testButtonTextDiagnostic: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F59E0B",
    marginLeft: 12,
  },
  warningCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  warningText: {
    fontSize: 14,
    color: "#92400E",
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  rtlText: {
    textAlign: "right",
  },
  permissionWarning: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  permissionWarningContent: {
    flex: 1,
    marginLeft: 12,
  },
  permissionWarningTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
  },
  permissionWarningText: {
    fontSize: 14,
    color: "#92400E",
    lineHeight: 20,
    marginBottom: 12,
  },
  permissionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    alignSelf: "flex-start",
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  permissionCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  permissionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  permissionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
  },
  permissionText: {
    fontSize: 14,
    color: "#92400E",
    lineHeight: 20,
  },
});

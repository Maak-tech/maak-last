import { useNavigation, useRouter } from "expo-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Info,
  Shield,
  TestTube,
} from "lucide-react-native";
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
import { useFallDetectionContext } from "@/contexts/FallDetectionContext";
import { useTheme } from "@/contexts/ThemeContext";
import { motionPermissionService } from "@/lib/services/motionPermissionService";

export default function FallDetectionSettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const {
    isEnabled,
    isActive,
    isInitialized,
    toggleFallDetection,
    testFallDetection,
    lastAlert,
  } = useFallDetectionContext();

  const [loading, setLoading] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<{
    available: boolean;
    granted: boolean;
    reason?: string;
  } | null>(null);

  const isRTL = i18n.language === "ar";

  // Hide the default header to prevent duplicate headers
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    setCheckingPermissions(true);
    try {
      const status = await motionPermissionService.checkMotionAvailability();
      setPermissionStatus(status);
    } catch (error) {
      setPermissionStatus({
        available: false,
        granted: false,
        reason: "Failed to check permission status",
      });
    } finally {
      setCheckingPermissions(false);
    }
  };

  const handleToggle = async (value: boolean) => {
    if (!(value || permissionStatus?.granted)) {
      Alert.alert(
        isRTL ? "إذن مطلوب" : "Permission Required",
        isRTL
          ? "يجب تفعيل إذن الحركة أولاً لاستخدام كشف السقوط"
          : "Motion permission must be enabled first to use fall detection",
        [
          {
            text: isRTL ? "إلغاء" : "Cancel",
            style: "cancel",
          },
          {
            text: isRTL ? "فتح الإعدادات" : "Open Settings",
            onPress: () => router.push("/profile/motion-permissions"),
          },
        ]
      );
      return;
    }

    try {
      setLoading(true);
      await toggleFallDetection(value);
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في تحديث الإعدادات" : "Failed to update settings"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    Alert.alert(
      isRTL ? "اختبار كشف السقوط" : "Test Fall Detection",
      isRTL
        ? "سيتم إنشاء تنبيه تجريبي. هل تريد المتابعة؟"
        : "This will create a test alert. Do you want to continue?",
      [
        {
          text: isRTL ? "إلغاء" : "Cancel",
          style: "cancel",
        },
        {
          text: isRTL ? "اختبار" : "Test",
          onPress: async () => {
            try {
              setLoading(true);
              await testFallDetection();
            } catch (error) {
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL
                  ? "فشل في اختبار كشف السقوط"
                  : "Failed to test fall detection"
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (checkingPermissions) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.colors.background.primary },
        ]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
          <Text
            style={[
              styles.loadingText,
              { color: theme.colors.text.primary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {isRTL ? "جاري التحميل..." : "Loading..."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.primary },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color={theme.colors.text.primary} size={24} />
        </TouchableOpacity>
        <Text
          style={[
            styles.title,
            { color: theme.colors.text.primary },
            isRTL && { textAlign: "left" },
          ]}
        >
          {isRTL ? "كشف السقوط" : "Fall Detection"}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        {/* Master Toggle */}
        <View style={styles.section}>
          <View
            style={[
              styles.masterToggleCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: isEnabled
                  ? permissionStatus?.granted
                    ? "#10B981"
                    : "#F59E0B"
                  : "#E5E7EB",
              },
            ]}
          >
            <View style={styles.masterToggleContent}>
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: isEnabled
                      ? permissionStatus?.granted
                        ? "#10B98120"
                        : "#F59E0B20"
                      : "#E5E7EB",
                  },
                ]}
              >
                {isEnabled && permissionStatus?.granted ? (
                  <Shield color="#10B981" size={32} />
                ) : (
                  <Shield color={isEnabled ? "#F59E0B" : "#9CA3AF"} size={32} />
                )}
              </View>
              <View style={styles.masterToggleInfo}>
                <Text
                  style={[
                    styles.masterToggleTitle,
                    { color: theme.colors.text.primary },
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {isRTL ? "كشف السقوط" : "Fall Detection"}
                </Text>
                <Text
                  style={[
                    styles.masterToggleSubtitle,
                    { color: theme.colors.text.secondary },
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {isEnabled
                    ? isActive
                      ? isRTL
                        ? "نشط ومستمر"
                        : "Active and monitoring"
                      : isRTL
                        ? "مفعل ولكن غير نشط"
                        : "Enabled but not active"
                    : isRTL
                      ? "معطل"
                      : "Disabled"}
                </Text>
              </View>
            </View>
            <Switch
              disabled={loading}
              onValueChange={handleToggle}
              thumbColor={isEnabled ? "#FFFFFF" : "#9CA3AF"}
              trackColor={{
                false: "#E5E7EB",
                true: permissionStatus?.granted ? "#10B981" : "#F59E0B",
              }}
              value={isEnabled}
            />
          </View>
        </View>

        {/* Status Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text.primary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {isRTL ? "الحالة" : "Status"}
          </Text>

          {/* Permission Status */}
          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: permissionStatus?.granted
                  ? "#10B981"
                  : permissionStatus?.available
                    ? "#F59E0B"
                    : "#EF4444",
              },
            ]}
          >
            <View style={styles.statusHeader}>
              {permissionStatus?.granted ? (
                <CheckCircle color="#10B981" size={24} />
              ) : (
                <AlertTriangle
                  color={permissionStatus?.available ? "#F59E0B" : "#EF4444"}
                  size={24}
                />
              )}
              <View style={styles.statusInfo}>
                <Text
                  style={[
                    styles.statusTitle,
                    { color: theme.colors.text.primary },
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {isRTL ? "إذن الحركة" : "Motion Permission"}
                </Text>
                <Text
                  style={[
                    styles.statusText,
                    { color: theme.colors.text.secondary },
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {permissionStatus?.granted
                    ? isRTL
                      ? "مفعل - جاهز للاستخدام"
                      : "Granted - Ready to use"
                    : permissionStatus?.available
                      ? isRTL
                        ? "مطلوب - اضغط لإعداد"
                        : "Required - Tap to setup"
                      : isRTL
                        ? "غير متاح على هذا الجهاز"
                        : "Not available on this device"}
                </Text>
              </View>
            </View>
            {!permissionStatus?.granted && permissionStatus?.available && (
              <TouchableOpacity
                onPress={() => router.push("/profile/motion-permissions")}
                style={styles.linkButton}
              >
                <Text style={styles.linkButtonText}>
                  {isRTL ? "إعداد" : "Setup"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Detection Status */}
          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: isActive ? "#10B981" : "#E5E7EB",
              },
            ]}
          >
            <View style={styles.statusHeader}>
              {isActive ? (
                <Activity color="#10B981" size={24} />
              ) : (
                <Activity color="#9CA3AF" size={24} />
              )}
              <View style={styles.statusInfo}>
                <Text
                  style={[
                    styles.statusTitle,
                    { color: theme.colors.text.primary },
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {isRTL ? "حالة المراقبة" : "Monitoring Status"}
                </Text>
                <Text
                  style={[
                    styles.statusText,
                    { color: theme.colors.text.secondary },
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {isActive
                    ? isRTL
                      ? "تراقب الحركة بنشاط"
                      : "Actively monitoring motion"
                    : isInitialized
                      ? isRTL
                        ? "غير نشط"
                        : "Not active"
                      : isRTL
                        ? "جاري التهيئة..."
                        : "Initializing..."}
                </Text>
              </View>
            </View>
          </View>

          {/* Last Alert */}
          {lastAlert && (
            <View
              style={[
                styles.statusCard,
                {
                  backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                  borderColor: "#2563EB",
                },
              ]}
            >
              <View style={styles.statusHeader}>
                <AlertTriangle color="#2563EB" size={24} />
                <View style={styles.statusInfo}>
                  <Text
                    style={[
                      styles.statusTitle,
                      { color: theme.colors.text.primary },
                      isRTL && { textAlign: "left" },
                    ]}
                  >
                    {isRTL ? "آخر تنبيه" : "Last Alert"}
                  </Text>
                  <Text
                    style={[
                      styles.statusText,
                      { color: theme.colors.text.secondary },
                      isRTL && { textAlign: "left" },
                    ]}
                  >
                    {isRTL
                      ? `تم في: ${new Date(lastAlert.timestamp).toLocaleString("ar-u-ca-gregory")}`
                      : `At: ${new Date(lastAlert.timestamp).toLocaleString()}`}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text.primary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {isRTL ? "الإجراءات" : "Actions"}
          </Text>

          <TouchableOpacity
            disabled={loading || !isEnabled}
            onPress={handleTest}
            style={[
              styles.actionButton,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: isEnabled ? "#2563EB" : "#E5E7EB",
                opacity: isEnabled ? 1 : 0.5,
              },
            ]}
          >
            <TestTube color={isEnabled ? "#2563EB" : "#9CA3AF"} size={20} />
            <Text
              style={[
                styles.actionButtonText,
                {
                  color: isEnabled
                    ? theme.colors.text.primary
                    : theme.colors.text.secondary,
                },
                isRTL && { textAlign: "left" },
              ]}
            >
              {isRTL ? "اختبار كشف السقوط" : "Test Fall Detection"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Information Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text.primary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {isRTL ? "معلومات" : "Information"}
          </Text>

          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.infoHeader}>
              <Info color={theme.colors.primary.main} size={20} />
              <Text
                style={[
                  styles.infoTitle,
                  { color: theme.colors.text.primary },
                  isRTL && { textAlign: "left" },
                ]}
              >
                {isRTL ? "كيف يعمل" : "How It Works"}
              </Text>
            </View>
            <Text
              style={[
                styles.infoText,
                { color: theme.colors.text.secondary },
                isRTL && { textAlign: "left" },
              ]}
            >
              {isRTL
                ? "يستخدم التطبيق مستشعرات الحركة في جهازك (مقياس التسارع والجيروسكوب) لاكتشاف الحركات المفاجئة التي قد تشير إلى السقوط. عند اكتشاف السقوط، يتم إرسال تنبيه تلقائي إلى جهات الاتصال الطارئة الخاصة بك مع موقعك."
                : "The app uses your device's motion sensors (accelerometer and gyroscope) to detect sudden movements that may indicate a fall. When a fall is detected, an automatic alert is sent to your emergency contacts with your location."}
            </Text>
          </View>

          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: "#FFFBEB",
                borderColor: "#FEF3C7",
              },
            ]}
          >
            <View style={styles.infoHeader}>
              <AlertTriangle color="#F59E0B" size={20} />
              <Text
                style={[
                  styles.infoTitle,
                  { color: "#92400E" },
                  isRTL && { textAlign: "left" },
                ]}
              >
                {isRTL ? "مهم" : "Important"}
              </Text>
            </View>
            <Text
              style={[
                styles.infoText,
                { color: "#92400E" },
                isRTL && { textAlign: "left" },
              ]}
            >
              {isRTL
                ? "كشف السقوط ليس بديلاً عن الرعاية الطبية الطارئة. في حالة الطوارئ الطبية، اتصل بخدمات الطوارئ المحلية على الفور."
                : "Fall detection is not a substitute for emergency medical care. In case of a medical emergency, contact your local emergency services immediately."}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: "Geist-Medium",
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
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
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
    marginBottom: 12,
  },
  masterToggleCard: {
    borderRadius: 12,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 2,
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
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginEnd: 16,
  },
  masterToggleInfo: {
    flex: 1,
  },
  masterToggleTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  masterToggleSubtitle: {
    fontSize: 14,
  },
  statusCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusInfo: {
    marginStart: 12,
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  statusText: {
    fontSize: 13,
  },
  linkButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#EBF4FF",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  linkButtonText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600",
  },
  actionButton: {
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginStart: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

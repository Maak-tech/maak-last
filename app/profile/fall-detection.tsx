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
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useFallDetectionContext } from "@/contexts/FallDetectionContext";
import { motionPermissionService } from "@/lib/services/motionPermissionService";
import { safeFormatDateTime } from "@/utils/dateFormat";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This settings screen intentionally combines status cards, permission state, and localized UI branches.
export default function FallDetectionSettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
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

  const checkPermissionStatus = useCallback(async () => {
    setCheckingPermissions(true);
    try {
      const status = await motionPermissionService.checkMotionAvailability();
      setPermissionStatus(status);
    } catch (_error) {
      setPermissionStatus({
        available: false,
        granted: false,
        reason: "Failed to check permission status",
      });
    } finally {
      setCheckingPermissions(false);
    }
  }, []);

  useEffect(() => {
    checkPermissionStatus();
  }, [checkPermissionStatus]);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Toggle flow includes permission gating and localized alert actions.
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
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في تحديث الإعدادات" : "Failed to update settings"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTest = () => {
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
            } catch (_error) {
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
      <GradientScreen edges={["top"]} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#003543" size="large" />
          <Text style={[styles.loadingText, isRTL && { textAlign: "left" }]}>
            {isRTL ? "جاري التحميل..." : "Loading..."}
          </Text>
        </View>
      </GradientScreen>
    );
  }

  let masterBorderColor = "#E5E7EB";
  let masterIconBackgroundColor = "#E5E7EB";
  if (isEnabled) {
    masterBorderColor = permissionStatus?.granted ? "#10B981" : "#F59E0B";
    masterIconBackgroundColor = permissionStatus?.granted
      ? "#10B98120"
      : "#F59E0B20";
  }

  let masterStatusText = isRTL ? "معطل" : "Disabled";
  if (isEnabled && isActive) {
    masterStatusText = isRTL ? "نشط ومستمر" : "Active and monitoring";
  } else if (isEnabled) {
    masterStatusText = isRTL ? "مفعل ولكن غير نشط" : "Enabled but not active";
  }

  let permissionBorderColor = "#EF4444";
  if (permissionStatus?.granted) {
    permissionBorderColor = "#10B981";
  } else if (permissionStatus?.available) {
    permissionBorderColor = "#F59E0B";
  }

  let permissionStatusText = isRTL
    ? "غير متاح على هذا الجهاز"
    : "Not available on this device";
  if (permissionStatus?.granted) {
    permissionStatusText = isRTL
      ? "مفعل - جاهز للاستخدام"
      : "Granted - Ready to use";
  } else if (permissionStatus?.available) {
    permissionStatusText = isRTL
      ? "مطلوب - اضغط لإعداد"
      : "Required - Tap to setup";
  }

  let monitoringStatusText = isRTL ? "جاري التهيئة..." : "Initializing...";
  if (isActive) {
    monitoringStatusText = isRTL
      ? "تراقب الحركة بنشاط"
      : "Actively monitoring motion";
  } else if (isInitialized) {
    monitoringStatusText = t("notActive");
  }

  return (
    <GradientScreen edges={["top"]} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <View style={styles.headerWrapper}>
          <WavyBackground
            contentPosition="top"
            curve="home"
            height={280}
            variant="teal"
          >
            <View style={styles.headerContent}>
              <View style={[styles.headerRow, isRTL && styles.headerRowRTL]}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.backButton}
                >
                  <ArrowLeft
                    color="#003543"
                    size={20}
                    style={
                      isRTL ? { transform: [{ rotate: "180deg" }] } : undefined
                    }
                  />
                </TouchableOpacity>
                <View style={styles.headerTitle}>
                  <View
                    style={[
                      styles.headerTitleRow,
                      isRTL && styles.headerRowRTL,
                    ]}
                  >
                    <Shield color="#EB9C0C" size={20} />
                    <Text style={styles.headerTitleText}>
                      {isRTL ? "كشف السقوط" : "Fall Detection"}
                    </Text>
                  </View>
                  <Text
                    style={[styles.headerSubtitle, isRTL && styles.rtlText]}
                  >
                    {isRTL
                      ? "مراقبة الحركة وتنبيهات الطوارئ"
                      : "Motion monitoring and emergency alerts"}
                  </Text>
                </View>
              </View>
            </View>
          </WavyBackground>
        </View>

        {/* Master Toggle */}
        <View style={styles.section}>
          <View
            style={[
              styles.masterToggleCard,
              { borderColor: masterBorderColor },
            ]}
          >
            <View style={styles.masterToggleContent}>
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: masterIconBackgroundColor,
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
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {isRTL ? "كشف السقوط" : "Fall Detection"}
                </Text>
                <Text
                  style={[
                    styles.masterToggleSubtitle,
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {masterStatusText}
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
          <Text style={[styles.sectionTitle, isRTL && { textAlign: "left" }]}>
            {isRTL ? "الحالة" : "Status"}
          </Text>

          {/* Permission Status */}
          <View
            style={[styles.statusCard, { borderColor: permissionBorderColor }]}
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
                  style={[styles.statusTitle, isRTL && { textAlign: "left" }]}
                >
                  {isRTL ? "إذن الحركة" : "Motion Permission"}
                </Text>
                <Text
                  style={[styles.statusText, isRTL && { textAlign: "left" }]}
                >
                  {permissionStatusText}
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
              { borderColor: isActive ? "#10B981" : "#E5E7EB" },
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
                  style={[styles.statusTitle, isRTL && { textAlign: "left" }]}
                >
                  {isRTL ? "حالة المراقبة" : "Monitoring Status"}
                </Text>
                <Text
                  style={[styles.statusText, isRTL && { textAlign: "left" }]}
                >
                  {monitoringStatusText}
                </Text>
              </View>
            </View>
          </View>

          {/* Last Alert */}
          {lastAlert ? (
            <View style={[styles.statusCard, { borderColor: "#2563EB" }]}>
              <View style={styles.statusHeader}>
                <AlertTriangle color="#2563EB" size={24} />
                <View style={styles.statusInfo}>
                  <Text
                    style={[styles.statusTitle, isRTL && { textAlign: "left" }]}
                  >
                    {isRTL ? "آخر تنبيه" : "Last Alert"}
                  </Text>
                  <Text
                    style={[styles.statusText, isRTL && { textAlign: "left" }]}
                  >
                    {isRTL
                      ? `تم في: ${safeFormatDateTime(
                          new Date(lastAlert.timestamp),
                          "ar-u-ca-gregory"
                        )}`
                      : `At: ${safeFormatDateTime(
                          new Date(lastAlert.timestamp)
                        )}`}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: "left" }]}>
            {isRTL ? "الإجراءات" : "Actions"}
          </Text>

          <TouchableOpacity
            disabled={loading || !isEnabled}
            onPress={handleTest}
            style={[
              styles.actionButton,
              {
                borderColor: isEnabled ? "#003543" : "#E5E7EB",
                opacity: isEnabled ? 1 : 0.5,
              },
            ]}
          >
            <TestTube color={isEnabled ? "#003543" : "#9CA3AF"} size={20} />
            <Text
              style={[
                styles.actionButtonText,
                {
                  color: isEnabled ? "#1A1D1F" : "#6C7280",
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
          <Text style={[styles.sectionTitle, isRTL && { textAlign: "left" }]}>
            {isRTL ? "معلومات" : "Information"}
          </Text>

          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Info color="#003543" size={20} />
              <Text style={[styles.infoTitle, isRTL && { textAlign: "left" }]}>
                {isRTL ? "كيف يعمل" : "How It Works"}
              </Text>
            </View>
            <Text style={[styles.infoText, isRTL && { textAlign: "left" }]}>
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
    </GradientScreen>
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
    fontFamily: "Inter-Medium",
    color: "#1A1D1F",
  },
  headerWrapper: {
    marginHorizontal: -24,
    marginBottom: -20,
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 130,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 50,
  },
  headerRowRTL: {
    flexDirection: "row-reverse",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0, 53, 67, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  headerTitleText: {
    fontSize: 22,
    fontFamily: "Inter-Bold",
    color: "#003543",
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: "rgba(0, 53, 67, 0.85)",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  rtlText: {
    textAlign: "right",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter-Bold",
    color: "#1A1D1F",
    marginBottom: 12,
  },
  masterToggleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
    marginBottom: 4,
  },
  masterToggleSubtitle: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#6C7280",
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
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
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
    marginBottom: 2,
  },
  statusText: {
    fontSize: 13,
    fontFamily: "Inter-Regular",
    color: "#6C7280",
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
    color: "#003543",
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
  },
  actionButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
    marginStart: 12,
  },
  infoText: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#6C7280",
    lineHeight: 20,
  },
});

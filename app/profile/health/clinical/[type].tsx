import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { ArrowLeft, Calendar, TestTube, Video } from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { clinicalIntegrationService } from "@/lib/services/clinicalIntegrationService";
import type {
  ClinicalIntegrationRequest,
  ClinicalIntegrationStatus,
  ClinicalIntegrationType,
} from "@/types";

type IntegrationConfig = {
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
};

const INTEGRATION_CONFIG: Record<ClinicalIntegrationType, IntegrationConfig> = {
  clinic: {
    titleKey: "clinicIntegration",
    descriptionKey: "clinicIntegrationDesc",
    icon: Calendar,
  },
  lab: {
    titleKey: "labIntegration",
    descriptionKey: "labIntegrationDesc",
    icon: TestTube,
  },
  radiology: {
    titleKey: "radiologyIntegration",
    descriptionKey: "radiologyIntegrationDesc",
    icon: Video,
  },
};

const normalizeType = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const getStatusColor = (
  status: ClinicalIntegrationStatus,
  theme: ReturnType<typeof useTheme>["theme"]
) => {
  switch (status) {
    case "connected":
      return theme.colors.accent.success;
    case "approved":
      return theme.colors.primary.main;
    case "rejected":
      return theme.colors.accent.error;
    case "pending":
    default:
      return theme.colors.accent.warning;
  }
};

const getStatusLabel = (
  status: ClinicalIntegrationStatus,
  t: (key: string) => string
) => {
  switch (status) {
    case "connected":
      return t("integrationStatusConnected");
    case "approved":
      return t("integrationStatusApproved");
    case "rejected":
      return t("integrationStatusRejected");
    case "pending":
    default:
      return t("integrationStatusPending");
  }
};

export const options = {
  headerShown: false,
};

export default function ClinicalIntegrationScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { type } = useLocalSearchParams<{ type?: string }>();
  const resolvedType = normalizeType(type) as
    | ClinicalIntegrationType
    | undefined;

  const config = useMemo(() => {
    if (!resolvedType) {
      return null;
    }
    return INTEGRATION_CONFIG[resolvedType] || null;
  }, [resolvedType]);

  const [providerName, setProviderName] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [patientId, setPatientId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [latestRequest, setLatestRequest] =
    useState<ClinicalIntegrationRequest | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const loadLatestRequest = useCallback(async () => {
    if (!(user?.id && config && resolvedType)) {
      setLatestRequest(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const request =
        await clinicalIntegrationService.getLatestIntegrationRequest(
          user.id,
          resolvedType
        );
      setLatestRequest(request);
    } catch (_error) {
      setLatestRequest(null);
    } finally {
      setLoading(false);
    }
  }, [config, resolvedType, user?.id]);

  useEffect(() => {
    loadLatestRequest();
  }, [loadLatestRequest]);

  const handleSubmit = async () => {
    if (!user?.id) {
      Alert.alert(t("error"), t("integrationNotSignedIn"));
      return;
    }

    if (!providerName.trim()) {
      Alert.alert(t("error"), t("integrationMissingProviderName"));
      return;
    }

    if (!(config && resolvedType)) {
      return;
    }

    setSubmitting(true);
    try {
      await clinicalIntegrationService.createIntegrationRequest(user.id, {
        type: resolvedType,
        providerName,
        portalUrl,
        patientId,
        notes,
      });
      setProviderName("");
      setPortalUrl("");
      setPatientId("");
      setNotes("");
      await loadLatestRequest();
      Alert.alert(t("success"), t("integrationSubmittedMessage"));
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("errorMessage");
      Alert.alert(t("error"), message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!config) {
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
            style={[styles.backButton, isRTL && styles.backButtonRTL]}
          >
            <ArrowLeft
              color={isDark ? theme.colors.text.primary : "#1E293B"}
              size={24}
              style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
            />
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              { color: isDark ? theme.colors.text.primary : "#1E293B" },
            ]}
          >
            {t("clinicalIntegrations")}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text
            style={[styles.errorText, { color: theme.colors.text.secondary }]}
          >
            {t("errorMessage")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const StatusIcon = config.icon;
  const statusColor =
    latestRequest && getStatusColor(latestRequest.status, theme);
  const statusLabel = latestRequest && getStatusLabel(latestRequest.status, t);
  const lastUpdatedLabel = latestRequest
    ? t("integrationRequestedOn", {
        date: latestRequest.createdAt.toLocaleDateString(),
      })
    : null;

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
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
        >
          <ArrowLeft
            color={isDark ? theme.colors.text.primary : "#1E293B"}
            size={24}
            style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
          />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: isDark ? theme.colors.text.primary : "#1E293B" },
            isRTL && { textAlign: "left" },
          ]}
        >
          {t(config.titleKey)}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <View
          style={[
            styles.introCard,
            {
              backgroundColor: isDark
                ? theme.colors.background.secondary
                : "#FFFFFF",
            },
          ]}
        >
          <View
            style={[
              styles.introIcon,
              { backgroundColor: `${theme.colors.primary.main}20` },
            ]}
          >
            <StatusIcon color={theme.colors.primary.main} size={32} />
          </View>
          <Text
            style={[
              styles.introTitle,
              { color: theme.colors.text.primary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {t(config.titleKey)}
          </Text>
          <Text
            style={[
              styles.introDescription,
              { color: theme.colors.text.secondary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {t(config.descriptionKey)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text.primary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {t("integrationStatus")}
          </Text>

          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: isDark
                  ? theme.colors.background.secondary
                  : "#FFFFFF",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator
                color={theme.colors.primary.main}
                size="small"
              />
            ) : latestRequest ? (
              <View style={styles.statusRow}>
                <StatusIcon color={statusColor || "#64748B"} size={20} />
                <View style={styles.statusContent}>
                  <Text
                    style={[
                      styles.statusLabel,
                      { color: statusColor || theme.colors.text.primary },
                      isRTL && { textAlign: "left" },
                    ]}
                  >
                    {statusLabel}
                  </Text>
                  {lastUpdatedLabel ? (
                    <Text
                      style={[
                        styles.statusMeta,
                        { color: theme.colors.text.secondary },
                        isRTL && { textAlign: "left" },
                      ]}
                    >
                      {lastUpdatedLabel}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <Text
                style={[
                  styles.statusMeta,
                  { color: theme.colors.text.secondary },
                  isRTL && { textAlign: "left" },
                ]}
              >
                {t("integrationStatusNone")}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text.primary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {t("integrationRequestTitle")}
          </Text>
          <Text
            style={[
              styles.sectionSubtitle,
              { color: theme.colors.text.secondary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {t("integrationRequestSubtitle")}
          </Text>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.inputLabel,
                { color: theme.colors.text.primary },
                isRTL && { textAlign: "left" },
              ]}
            >
              {t("integrationProviderName")}
            </Text>
            <TextInput
              onChangeText={setProviderName}
              placeholder={t("integrationProviderName")}
              placeholderTextColor={theme.colors.text.secondary}
              style={[
                styles.input,
                {
                  color: theme.colors.text.primary,
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                  backgroundColor: isDark
                    ? theme.colors.background.secondary
                    : "#FFFFFF",
                },
                isRTL && { textAlign: "left" },
              ]}
              value={providerName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.inputLabel,
                { color: theme.colors.text.primary },
                isRTL && { textAlign: "left" },
              ]}
            >
              {t("integrationPortalUrl")}
            </Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="url"
              onChangeText={setPortalUrl}
              placeholder="https://"
              placeholderTextColor={theme.colors.text.secondary}
              style={[
                styles.input,
                {
                  color: theme.colors.text.primary,
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                  backgroundColor: isDark
                    ? theme.colors.background.secondary
                    : "#FFFFFF",
                },
                isRTL && { textAlign: "left" },
              ]}
              value={portalUrl}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.inputLabel,
                { color: theme.colors.text.primary },
                isRTL && { textAlign: "left" },
              ]}
            >
              {t("integrationPatientId")}
            </Text>
            <TextInput
              onChangeText={setPatientId}
              placeholder={t("integrationPatientId")}
              placeholderTextColor={theme.colors.text.secondary}
              style={[
                styles.input,
                {
                  color: theme.colors.text.primary,
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                  backgroundColor: isDark
                    ? theme.colors.background.secondary
                    : "#FFFFFF",
                },
                isRTL && { textAlign: "left" },
              ]}
              value={patientId}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.inputLabel,
                { color: theme.colors.text.primary },
                isRTL && { textAlign: "left" },
              ]}
            >
              {t("integrationNotes")}
            </Text>
            <TextInput
              multiline
              onChangeText={setNotes}
              placeholder={t("notesOptional")}
              placeholderTextColor={theme.colors.text.secondary}
              style={[
                styles.input,
                styles.multilineInput,
                {
                  color: theme.colors.text.primary,
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                  backgroundColor: isDark
                    ? theme.colors.background.secondary
                    : "#FFFFFF",
                },
                isRTL && { textAlign: "left" },
              ]}
              value={notes}
            />
          </View>

          <TouchableOpacity
            disabled={submitting}
            onPress={handleSubmit}
            style={[
              styles.submitButton,
              {
                backgroundColor: submitting
                  ? theme.colors.border.medium
                  : theme.colors.primary.main,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {t("integrationSubmit")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonRTL: {
    transform: [{ scaleX: -1 }],
  },
  introCard: {
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
  },
  introIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },
  introDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  statusCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusContent: {
    marginLeft: 10,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 28,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
});

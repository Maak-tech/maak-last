/**
 * Org Notification Settings Screen
 *
 * Org admins configure which automated email channels are active and
 * review recent email delivery logs.
 *
 * Stores preferences in: organizations/{orgId}/notification_settings/email
 *
 * Route: /(settings)/org/notifications?orgId=<orgId>&orgName=<orgName>
 */

import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  Bell,
  BellOff,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Mail,
  RefreshCw,
  XCircle,
} from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Caption,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import WavyBackground from "@/components/figma/WavyBackground";
import { useTheme } from "@/contexts/ThemeContext";
import { type EmailJob, emailService } from "@/lib/services/emailService";
import { organizationService } from "@/lib/services/organizationService";
import type { EmailChannel } from "@/types";
import { getTextStyle } from "@/utils/styles";

// ─── Channel Config ───────────────────────────────────────────────────────────

type ChannelConfig = {
  key: EmailChannel;
  label: string;
  description: string;
  icon: React.ReactNode;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Email Log Item ───────────────────────────────────────────────────────────

function EmailLogItem({
  job,
  theme,
}: {
  job: EmailJob;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const isSent = job.status === "sent";
  const isFailed = job.status === "failed";

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.secondary,
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      {isSent ? (
        <CheckCircle2 color="#10B981" size={16} style={{ marginTop: 2 }} />
      ) : isFailed ? (
        <XCircle color="#EF4444" size={16} style={{ marginTop: 2 }} />
      ) : (
        <Clock color="#F59E0B" size={16} style={{ marginTop: 2 }} />
      )}
      <View style={{ flex: 1 }}>
        <TypographyText
          numberOfLines={1}
          style={{
            color: theme.colors.text.primary,
            fontSize: 13,
            fontWeight: "600",
          }}
        >
          {job.subject}
        </TypographyText>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 3 }}>
          <Caption style={{ color: theme.colors.text.secondary }}>
            → {job.to.join(", ")}
          </Caption>
        </View>
        {isFailed && job.error ? (
          <Caption numberOfLines={1} style={{ color: "#EF4444", marginTop: 2 }}>
            {job.error}
          </Caption>
        ) : null}
      </View>
      <Caption style={{ color: theme.colors.text.secondary }}>
        {formatDate(job.createdAt)}
      </Caption>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OrgNotificationsScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ orgId: string; orgName?: string }>();
  const orgId = params.orgId ?? "";
  const isRTL = i18n.language === "ar";

  // Channel toggles — loaded from / saved to Firestore sub-doc
  const [channels, setChannels] = useState<Record<EmailChannel, boolean>>({
    weekly_report: true,
    critical_alert: true,
    patient_digest: false,
    org_summary: false,
    consent_revocation: true,
  });

  const [emailLog, setEmailLog] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const isMountedRef = useRef(true);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const CHANNEL_CONFIGS: ChannelConfig[] = [
    {
      key: "weekly_report",
      label: "Weekly Provider Digest",
      description: "Summary email to all providers every Monday at 07:00 UTC",
      icon: <Mail color="#2563EB" size={18} />,
    },
    {
      key: "critical_alert",
      label: "Critical Alert Fallback",
      description:
        "Email providers when push notification fails for critical events",
      icon: <Bell color="#EF4444" size={18} />,
    },
    {
      key: "patient_digest",
      label: "Patient Weekly Digest",
      description: "Summary email sent to individual patients each week",
      icon: <Mail color="#10B981" size={18} />,
    },
    {
      key: "org_summary",
      label: "Org Admin Summary",
      description: "Weekly operations summary for org administrators",
      icon: <Mail color="#8B5CF6" size={18} />,
    },
    {
      key: "consent_revocation",
      label: "Consent Revocation Notice",
      description:
        "Email patient when they revoke an organization's data access",
      icon: <BellOff color="#64748B" size={18} />,
    },
  ];

  const load = useCallback(
    async (isRefresh = false) => {
      if (!orgId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const [settingsSnap, log] = await Promise.allSettled([
          organizationService.getNotificationSettings(orgId),
          emailService.listRecentJobs(orgId, 15),
        ]);

        if (!isMountedRef.current) return;

        if (settingsSnap.status === "fulfilled" && settingsSnap.value) {
          const saved = settingsSnap.value as Record<string, unknown>;
          setChannels((prev) => ({
            ...prev,
            ...((saved.channels as Partial<Record<EmailChannel, boolean>>) ??
              {}),
          }));
        }

        if (log.status === "fulfilled") {
          setEmailLog(log.value);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [orgId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const handleToggle = (channel: EmailChannel, value: boolean) => {
    setChannels((prev) => ({ ...prev, [channel]: value }));
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      await organizationService.saveNotificationSettings(orgId, { channels });
      Alert.alert("Saved", "Notification settings updated.");
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to save settings."
      );
    } finally {
      setSaving(false);
    }
  };

  const sentCount = emailLog.filter((j) => j.status === "sent").length;
  const failedCount = emailLog.filter((j) => j.status === "failed").length;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <WavyBackground>
      {/* Header */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          paddingTop: 56,
          paddingHorizontal: 20,
          paddingBottom: 12,
          gap: 12,
        }}
      >
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={theme.colors.text.primary} size={24} />
        </TouchableOpacity>
        <TypographyText
          style={getTextStyle(
            theme,
            "heading",
            "bold",
            theme.colors.text.primary
          )}
        >
          Notifications
        </TypographyText>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => load(true)}
        >
          <RefreshCw
            color={theme.colors.text.secondary}
            size={18}
            style={refreshing ? { opacity: 0.4 } : undefined}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          color={theme.colors.text.primary}
          style={{ marginTop: 48 }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl
              onRefresh={() => load(true)}
              refreshing={refreshing}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Channel toggles */}
          <TypographyText
            style={[
              getTextStyle(
                theme,
                "caption",
                "semibold",
                theme.colors.text.secondary
              ),
              {
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 12,
              },
            ]}
          >
            Email Channels
          </TypographyText>

          {CHANNEL_CONFIGS.map((cfg) => (
            <View
              key={cfg.key}
              style={{
                backgroundColor: theme.colors.background.secondary,
                borderRadius: 12,
                padding: 14,
                marginBottom: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: theme.colors.background.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {cfg.icon}
              </View>
              <View style={{ flex: 1 }}>
                <TypographyText
                  style={{
                    color: theme.colors.text.primary,
                    fontSize: 14,
                    fontWeight: "600",
                  }}
                >
                  {cfg.label}
                </TypographyText>
                <Caption
                  style={{ color: theme.colors.text.secondary, marginTop: 2 }}
                >
                  {cfg.description}
                </Caption>
              </View>
              <Switch
                onValueChange={(v) => handleToggle(cfg.key, v)}
                thumbColor="#FFF"
                trackColor={{
                  false: theme.colors.background.primary,
                  true: "#6366F1",
                }}
                value={channels[cfg.key]}
              />
            </View>
          ))}

          {/* Save button */}
          <TouchableOpacity
            disabled={saving}
            onPress={handleSave}
            style={{
              backgroundColor: "#6366F1",
              borderRadius: 12,
              padding: 14,
              alignItems: "center",
              marginTop: 4,
              marginBottom: 28,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <TypographyText
                style={{ color: "#FFF", fontWeight: "600", fontSize: 15 }}
              >
                Save Settings
              </TypographyText>
            )}
          </TouchableOpacity>

          {/* Delivery log */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <TypographyText
              style={[
                getTextStyle(
                  theme,
                  "caption",
                  "semibold",
                  theme.colors.text.secondary
                ),
                { textTransform: "uppercase", letterSpacing: 0.8 },
              ]}
            >
              Recent Deliveries
            </TypographyText>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Caption style={{ color: "#10B981" }}>{sentCount} sent</Caption>
              {failedCount > 0 && (
                <Caption style={{ color: "#EF4444" }}>
                  {failedCount} failed
                </Caption>
              )}
            </View>
          </View>

          {emailLog.length === 0 ? (
            <View
              style={{
                backgroundColor: theme.colors.background.secondary,
                borderRadius: 10,
                padding: 20,
                alignItems: "center",
              }}
            >
              {channels.weekly_report || channels.critical_alert ? (
                <>
                  <BellOff color={theme.colors.text.secondary} size={24} />
                  <Caption
                    style={{ color: theme.colors.text.secondary, marginTop: 8 }}
                  >
                    No emails sent yet. The weekly digest runs every Monday.
                  </Caption>
                </>
              ) : (
                <>
                  <BellOff color={theme.colors.text.secondary} size={24} />
                  <Caption
                    style={{ color: theme.colors.text.secondary, marginTop: 8 }}
                  >
                    All channels are disabled. Enable at least one above.
                  </Caption>
                </>
              )}
            </View>
          ) : (
            emailLog.map((job) => (
              <EmailLogItem job={job} key={job.id} theme={theme} />
            ))
          )}

          {/* Info note */}
          <View
            style={{
              backgroundColor: "#EFF6FF",
              borderRadius: 10,
              padding: 14,
              marginTop: 16,
            }}
          >
            <Caption style={{ color: "#1D4ED8" }}>
              Email delivery is handled by SendGrid. Provider email addresses
              are taken from their Nuralix user profiles. Ensure providers have
              verified emails to receive digests.
            </Caption>
          </View>
        </ScrollView>
      )}
    </WavyBackground>
  );
}

/**
 * Notification Templates Screen
 *
 * Org admins customize the push notification copy sent to their patients
 * for each alert / event type. Templates support simple tokens:
 *   {{patient.firstName}}, {{vital.type}}, {{value}}, {{orgName}}
 *
 * Templates are stored at:
 *   organizations/{orgId}/notification_templates/{type}_{channel}
 *
 * Route: /(settings)/org/templates?orgId=<orgId>&orgName=<orgName>
 */

import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  Bell,
  ChevronLeft,
  RefreshCw,
  RotateCcw,
  Save,
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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Caption,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import WavyBackground from "@/components/figma/WavyBackground";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DEFAULT_TEMPLATES,
  type NotificationTemplate,
  type NotificationTemplateType,
  notificationTemplateService,
} from "@/lib/services/notificationTemplateService";
import { getTextStyle } from "@/utils/styles";

// ─── Config ───────────────────────────────────────────────────────────────────

const TEMPLATE_TYPES: {
  type: NotificationTemplateType;
  label: string;
  description: string;
  accentColor: string;
  bgColor: string;
}[] = [
  {
    type: "critical_alert",
    label: "Critical Alert",
    description: "Sent to providers when a critical vital threshold is crossed",
    accentColor: "#DC2626",
    bgColor: "#FEF2F2",
  },
  {
    type: "medication_missed",
    label: "Missed Medication",
    description: "Sent to the patient when a scheduled dose is overdue",
    accentColor: "#F97316",
    bgColor: "#FFF7ED",
  },
  {
    type: "vital_stale",
    label: "Stale Vitals Sync",
    description: "Sent when a patient's wearable hasn't synced in 24+ hours",
    accentColor: "#6366F1",
    bgColor: "#EEF2FF",
  },
  {
    type: "risk_nudge",
    label: "Risk Check-In Nudge",
    description: "Low-priority proactive message sent by the AI agent",
    accentColor: "#0EA5E9",
    bgColor: "#F0F9FF",
  },
  {
    type: "task_assigned",
    label: "Task Assigned",
    description: "Sent to the patient when a care coordinator creates a task",
    accentColor: "#10B981",
    bgColor: "#ECFDF5",
  },
];

const TOKEN_CHIPS = [
  "{{patient.firstName}}",
  "{{vital.type}}",
  "{{value}}",
  "{{orgName}}",
];

// ─── Template Editor ──────────────────────────────────────────────────────────

function TemplateEditor({
  config,
  template,
  saving,
  onTitleChange,
  onBodyChange,
  onSave,
  onReset,
  theme,
}: {
  config: (typeof TEMPLATE_TYPES)[0];
  template: NotificationTemplate;
  saving: boolean;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onSave: () => void;
  onReset: () => void;
  theme: ReturnType<typeof import("@/contexts/ThemeContext").useTheme>["theme"];
}) {
  const defaults = DEFAULT_TEMPLATES[config.type];
  const isDefaultTitle = template.titleTemplate === defaults.title;
  const isDefaultBody = template.bodyTemplate === defaults.body;
  const isDefault = isDefaultTitle && isDefaultBody;

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.secondary,
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 16,
        borderLeftWidth: 3,
        borderLeftColor: config.accentColor,
      }}
    >
      {/* Card header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 14,
          paddingBottom: 12,
          backgroundColor: config.bgColor,
        }}
      >
        <Bell color={config.accentColor} size={18} />
        <View style={{ flex: 1 }}>
          <TypographyText
            style={{
              color: config.accentColor,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {config.label}
          </TypographyText>
          <Caption style={{ color: theme.colors.text.secondary, marginTop: 2 }}>
            {config.description}
          </Caption>
        </View>
        {!isDefault && (
          <View
            style={{
              backgroundColor: config.accentColor,
              borderRadius: 6,
              paddingHorizontal: 7,
              paddingVertical: 2,
            }}
          >
            <Caption style={{ color: "#FFF", fontWeight: "700" }}>
              Custom
            </Caption>
          </View>
        )}
      </View>

      <View style={{ padding: 14, gap: 12 }}>
        {/* Title */}
        <View>
          <Caption
            style={{
              color: theme.colors.text.secondary,
              fontWeight: "600",
              marginBottom: 6,
            }}
          >
            TITLE (max 80 chars)
          </Caption>
          <View
            style={{
              backgroundColor: theme.colors.background.primary,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <TextInput
              maxLength={80}
              multiline={false}
              onChangeText={onTitleChange}
              placeholder={defaults.title}
              placeholderTextColor={theme.colors.text.secondary}
              style={{ color: theme.colors.text.primary, fontSize: 14 }}
              value={template.titleTemplate}
            />
          </View>
          <Caption
            style={{
              color:
                template.titleTemplate.length > 70
                  ? "#F97316"
                  : theme.colors.text.secondary,
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {template.titleTemplate.length}/80
          </Caption>
        </View>

        {/* Body */}
        <View>
          <Caption
            style={{
              color: theme.colors.text.secondary,
              fontWeight: "600",
              marginBottom: 6,
            }}
          >
            BODY (max 240 chars)
          </Caption>
          <View
            style={{
              backgroundColor: theme.colors.background.primary,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              minHeight: 72,
            }}
          >
            <TextInput
              maxLength={240}
              multiline
              numberOfLines={3}
              onChangeText={onBodyChange}
              placeholder={defaults.body}
              placeholderTextColor={theme.colors.text.secondary}
              style={{ color: theme.colors.text.primary, fontSize: 14 }}
              value={template.bodyTemplate}
            />
          </View>
          <Caption
            style={{
              color:
                template.bodyTemplate.length > 200
                  ? "#F97316"
                  : theme.colors.text.secondary,
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {template.bodyTemplate.length}/240
          </Caption>
        </View>

        {/* Action row */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {!isDefault && (
            <TouchableOpacity
              onPress={onReset}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: theme.colors.background.primary,
              }}
            >
              <RotateCcw color={theme.colors.text.secondary} size={14} />
              <Caption
                style={{
                  color: theme.colors.text.secondary,
                  fontWeight: "600",
                }}
              >
                Reset
              </Caption>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            disabled={saving}
            onPress={onSave}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: config.accentColor,
              borderRadius: 10,
              paddingVertical: 9,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Save color="#FFF" size={14} />
                <Caption style={{ color: "#FFF", fontWeight: "700" }}>
                  Save Template
                </Caption>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationTemplatesScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ orgId: string; orgName?: string }>();
  const orgId = params.orgId ?? "";
  const isRTL = i18n.language === "ar";

  const [templates, setTemplates] = useState<
    Record<string, NotificationTemplate>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
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

  const load = useCallback(
    async (isRefresh = false) => {
      if (!orgId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const data = await notificationTemplateService.getOrgTemplates(orgId);
        if (isMountedRef.current) {
          setTemplates(data);
        }
      } catch (err) {
        if (isMountedRef.current) {
          Alert.alert(
            "Error",
            err instanceof Error ? err.message : "Failed to load templates."
          );
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

  const updateField = (
    key: string,
    field: "titleTemplate" | "bodyTemplate",
    value: string
  ) => {
    setTemplates((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleSave = async (
    type: NotificationTemplateType,
    channel: "push"
  ) => {
    const key = `${type}_${channel}`;
    const template = templates[key];
    if (!template) return;

    setSavingKey(key);
    try {
      await notificationTemplateService.saveTemplate(orgId, {
        type: template.type,
        channel: template.channel,
        titleTemplate: template.titleTemplate,
        bodyTemplate: template.bodyTemplate,
        language: template.language,
        isActive: template.isActive,
      });
      Alert.alert("Saved", `${type.replace(/_/g, " ")} template updated.`);
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to save template."
      );
    } finally {
      setSavingKey(null);
    }
  };

  const handleReset = (type: NotificationTemplateType, channel: "push") => {
    const defaults = DEFAULT_TEMPLATES[type];
    const key = `${type}_${channel}`;
    Alert.alert(
      "Reset Template",
      "Restore the default notification text for this template?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await notificationTemplateService.resetToDefault(
                orgId,
                type,
                channel
              );
              if (isMountedRef.current) {
                setTemplates((prev) => ({
                  ...prev,
                  [key]: {
                    ...prev[key],
                    titleTemplate: defaults.title,
                    bodyTemplate: defaults.body,
                  },
                }));
              }
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "Reset failed."
              );
            }
          },
        },
      ]
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

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
        <View style={{ flex: 1 }}>
          <TypographyText
            style={getTextStyle(
              theme,
              "heading",
              "bold",
              theme.colors.text.primary
            )}
          >
            Notification Templates
          </TypographyText>
          <Caption style={{ color: theme.colors.text.secondary }}>
            Customize push messages for your patients
          </Caption>
        </View>
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
          {/* Token guide */}
          <View
            style={{
              backgroundColor: "#EFF6FF",
              borderRadius: 12,
              padding: 14,
              marginBottom: 24,
            }}
          >
            <Caption
              style={{
                color: "#1D4ED8",
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              AVAILABLE TOKENS
            </Caption>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {TOKEN_CHIPS.map((token) => (
                <View
                  key={token}
                  style={{
                    backgroundColor: "#DBEAFE",
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  <Caption
                    style={{ color: "#1D4ED8", fontFamily: "monospace" }}
                  >
                    {token}
                  </Caption>
                </View>
              ))}
            </View>
            <Caption style={{ color: "#3B82F6", marginTop: 8 }}>
              Tokens are replaced with live values at send time.
            </Caption>
          </View>

          {/* Template editors */}
          {TEMPLATE_TYPES.map((cfg) => {
            const key = `${cfg.type}_push`;
            const template = templates[key];
            if (!template) return null;

            return (
              <TemplateEditor
                config={cfg}
                key={cfg.type}
                onBodyChange={(v) => updateField(key, "bodyTemplate", v)}
                onReset={() => handleReset(cfg.type, "push")}
                onSave={() => handleSave(cfg.type, "push")}
                onTitleChange={(v) => updateField(key, "titleTemplate", v)}
                saving={savingKey === key}
                template={template}
                theme={theme}
              />
            );
          })}

          {/* Note */}
          <View
            style={{
              backgroundColor: theme.colors.background.secondary,
              borderRadius: 10,
              padding: 14,
            }}
          >
            <Caption style={{ color: theme.colors.text.secondary }}>
              Templates apply to push notifications sent by the Nuralix AI agent
              and automated care pathway steps. Changes take effect immediately
              for new events.
            </Caption>
          </View>
        </ScrollView>
      )}
    </WavyBackground>
  );
}

/**
 * Webhook Management Screen
 *
 * Org admins register and manage outbound webhook endpoints here.
 * Each endpoint receives HMAC-SHA256 signed payloads for subscribed events.
 *
 * Route: /(settings)/org/webhooks?orgId=<orgId>
 */

import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  RefreshCw,
  RotateCcw,
  Webhook,
  XCircle,
  ZapOff,
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
  Modal,
  RefreshControl,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Caption,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { webhookService } from "@/lib/services/webhookService";
import type { WebhookEndpoint, WebhookEventType } from "@/types";
import { getTextStyle } from "@/utils/styles";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_EVENTS: Array<{ key: WebhookEventType; label: string }> = [
  { key: "vital.anomaly", label: "Vital anomaly detected" },
  { key: "vital.critical", label: "Critical vital threshold breach" },
  { key: "alert.created", label: "Alert created" },
  { key: "alert.resolved", label: "Alert resolved" },
  { key: "medication.missed", label: "Medication missed" },
  { key: "patient.risk_escalated", label: "Patient risk escalated" },
  { key: "discovery.new", label: "New health discovery" },
  { key: "wearable.synced", label: "Wearable data synced" },
];

// ─── Endpoint Card ────────────────────────────────────────────────────────────

function EndpointCard({
  endpoint,
  isRTL,
  theme,
  onDisable,
  onRotateSecret,
}: {
  endpoint: WebhookEndpoint;
  isRTL: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
  onDisable: (id: string) => void;
  onRotateSecret: (id: string, name: string) => void;
}) {
  const hasFailures = endpoint.failureCount > 0;

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.secondary,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: endpoint.isActive
          ? hasFailures
            ? "#F59E0B"
            : "#22C55E"
          : "#9CA3AF",
      }}
    >
      {/* Name + status */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <TypographyText
          style={{
            color: theme.colors.text.primary,
            fontSize: 15,
            fontWeight: "600",
            flex: 1,
          }}
        >
          {endpoint.name}
        </TypographyText>
        {endpoint.isActive ? (
          hasFailures ? (
            <AlertTriangle size={16} color="#F59E0B" />
          ) : (
            <CheckCircle2 size={16} color="#22C55E" />
          )
        ) : (
          <XCircle size={16} color="#9CA3AF" />
        )}
      </View>

      {/* URL */}
      <Caption
        style={{ color: theme.colors.text.secondary, marginBottom: 6 }}
        numberOfLines={1}
      >
        {endpoint.url}
      </Caption>

      {/* Events */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 10,
        }}
      >
        {endpoint.events.map((ev) => (
          <View
            key={ev}
            style={{
              backgroundColor: theme.colors.background.primary,
              borderRadius: 6,
              paddingHorizontal: 7,
              paddingVertical: 3,
            }}
          >
            <Caption style={{ color: theme.colors.text.secondary }}>{ev}</Caption>
          </View>
        ))}
      </View>

      {/* Stats */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Caption style={{ color: theme.colors.text.secondary }}>
          {endpoint.failureCount > 0
            ? `${endpoint.failureCount} recent failure${endpoint.failureCount !== 1 ? "s" : ""}`
            : "No recent failures"}
        </Caption>
        <Caption style={{ color: theme.colors.text.secondary }}>
          {endpoint.lastTriggeredAt
            ? `Last: ${endpoint.lastTriggeredAt.toLocaleDateString()}`
            : "Never triggered"}
        </Caption>
      </View>

      {/* Actions */}
      {endpoint.isActive ? (
        <View
          style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 8 }}
        >
          <TouchableOpacity
            onPress={() => onRotateSecret(endpoint.id, endpoint.name)}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: theme.colors.background.primary,
              borderRadius: 8,
              paddingVertical: 8,
            }}
          >
            <RotateCcw size={14} color={theme.colors.text.secondary} />
            <Caption style={{ color: theme.colors.text.secondary }}>
              Rotate secret
            </Caption>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onDisable(endpoint.id)}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: "#FEE2E2",
              borderRadius: 8,
              paddingVertical: 8,
            }}
          >
            <ZapOff size={14} color="#DC2626" />
            <Caption style={{ color: "#DC2626" }}>Disable</Caption>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: theme.colors.background.primary,
            borderRadius: 8,
            paddingVertical: 8,
            alignItems: "center",
          }}
        >
          <Caption style={{ color: "#9CA3AF" }}>Endpoint disabled</Caption>
        </View>
      )}
    </View>
  );
}

// ─── Add Endpoint Modal ───────────────────────────────────────────────────────

function AddEndpointModal({
  visible,
  isRTL,
  theme,
  onClose,
  onSave,
}: {
  visible: boolean;
  isRTL: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
  onClose: () => void;
  onSave: (
    name: string,
    url: string,
    events: WebhookEventType[]
  ) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<WebhookEventType>>(
    new Set()
  );
  const [saving, setSaving] = useState(false);

  const toggleEvent = (ev: WebhookEventType) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(ev)) next.delete(ev);
      else next.add(ev);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Please enter a name for this endpoint.");
      return;
    }
    if (!url.startsWith("https://")) {
      Alert.alert("Validation", "Webhook URL must start with https://");
      return;
    }
    if (selectedEvents.size === 0) {
      Alert.alert(
        "Validation",
        "Select at least one event to subscribe to."
      );
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), url.trim(), Array.from(selectedEvents));
      setName("");
      setUrl("");
      setSelectedEvents(new Set());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.background.primary,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24,
            paddingBottom: 40,
            maxHeight: "90%",
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <TypographyText
              style={[
                getTextStyle(
                  theme,
                  "heading",
                  "bold",
                  theme.colors.text.primary
                ),
                { marginBottom: 20 },
              ]}
            >
              New Webhook Endpoint
            </TypographyText>

            {/* Name */}
            <Caption
              style={{ color: theme.colors.text.secondary, marginBottom: 6 }}
            >
              Name
            </Caption>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. EHR System"
              placeholderTextColor={theme.colors.text.secondary}
              style={{
                backgroundColor: theme.colors.background.secondary,
                borderRadius: 10,
                padding: 12,
                color: theme.colors.text.primary,
                marginBottom: 16,
                fontSize: 15,
              }}
            />

            {/* URL */}
            <Caption
              style={{ color: theme.colors.text.secondary, marginBottom: 6 }}
            >
              Endpoint URL (HTTPS required)
            </Caption>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="https://your-system.com/webhook"
              placeholderTextColor={theme.colors.text.secondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{
                backgroundColor: theme.colors.background.secondary,
                borderRadius: 10,
                padding: 12,
                color: theme.colors.text.primary,
                marginBottom: 16,
                fontSize: 15,
              }}
            />

            {/* Events */}
            <Caption
              style={{ color: theme.colors.text.secondary, marginBottom: 10 }}
            >
              Subscribe to events
            </Caption>
            {ALL_EVENTS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                onPress={() => toggleEvent(key)}
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.background.secondary,
                }}
              >
                <Caption
                  style={{ color: theme.colors.text.primary, flex: 1 }}
                >
                  {label}
                </Caption>
                <Switch
                  value={selectedEvents.has(key)}
                  onValueChange={() => toggleEvent(key)}
                  trackColor={{ false: "#E5E7EB", true: "#6366F1" }}
                  thumbColor="#FFFFFF"
                />
              </TouchableOpacity>
            ))}

            {/* Save */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={{
                backgroundColor: "#6366F1",
                borderRadius: 12,
                padding: 16,
                alignItems: "center",
                marginTop: 24,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <TypographyText
                  style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}
                >
                  Save Endpoint
                </TypographyText>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={{ alignItems: "center", marginTop: 12 }}
            >
              <Caption style={{ color: theme.colors.text.secondary }}>
                Cancel
              </Caption>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WebhooksScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ orgId: string }>();
  const orgId = params.orgId;
  const isRTL = i18n.language === "ar";

  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
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
      setError(null);
      try {
        const data = await webhookService.listEndpoints(orgId);
        if (isMountedRef.current) setEndpoints(data);
      } catch (err) {
        if (isMountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to load webhooks"
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

  const handleAddEndpoint = useCallback(
    async (name: string, url: string, events: WebhookEventType[]) => {
      if (!orgId || !user?.id) return;
      const { endpoint, signingSecret } = await webhookService.createEndpoint({
        orgId,
        name,
        url,
        events,
        createdBy: user.id,
      });
      if (isMountedRef.current) {
        setEndpoints((prev) => [endpoint, ...prev]);
      }
      Alert.alert(
        "Endpoint Created",
        `Your signing secret:\n\n${signingSecret}\n\nStore this securely — it will not be shown again.`,
        [{ text: "I've copied it", style: "default" }]
      );
    },
    [orgId, user?.id]
  );

  const handleDisable = useCallback(
    (webhookId: string) => {
      if (!orgId) return;
      Alert.alert(
        "Disable Endpoint",
        "This endpoint will stop receiving events. You can re-enable it later.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              await webhookService.disableEndpoint(orgId, webhookId);
              if (isMountedRef.current) {
                setEndpoints((prev) =>
                  prev.map((e) =>
                    e.id === webhookId ? { ...e, isActive: false } : e
                  )
                );
              }
            },
          },
        ]
      );
    },
    [orgId]
  );

  const handleRotateSecret = useCallback(
    (webhookId: string, name: string) => {
      if (!orgId) return;
      Alert.alert(
        "Rotate Signing Secret",
        `The current signing secret for "${name}" will be immediately invalidated. Update your server before rotating.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Rotate",
            style: "destructive",
            onPress: async () => {
              try {
                const newSecret = await webhookService.rotateSigningSecret(
                  orgId,
                  webhookId
                );
                Alert.alert(
                  "New Signing Secret",
                  `${newSecret}\n\nStore this securely — it will not be shown again.`,
                  [{ text: "I've copied it", style: "default" }]
                );
              } catch {
                Alert.alert("Error", "Failed to rotate signing secret.");
              }
            },
          },
        ]
      );
    },
    [orgId]
  );

  const activeCount = endpoints.filter((e) => e.isActive).length;

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
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <TypographyText
          style={getTextStyle(
            theme,
            "heading",
            "bold",
            theme.colors.text.primary
          )}
        >
          Webhooks
        </TypographyText>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => load(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <RefreshCw
            size={18}
            color={theme.colors.text.secondary}
            style={refreshing ? { opacity: 0.4 } : undefined}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
          />
        }
      >
        {/* Summary + Add button */}
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Caption style={{ color: theme.colors.text.secondary }}>
            {activeCount} active endpoint{activeCount !== 1 ? "s" : ""}
          </Caption>
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "#6366F1",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 7,
            }}
          >
            <Webhook size={14} color="#FFFFFF" />
            <Caption style={{ color: "#FFFFFF", fontWeight: "600" }}>
              Add Endpoint
            </Caption>
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error ? (
          <View
            style={{
              backgroundColor: "#FEE2E2",
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <TypographyText style={{ color: "#DC2626" }}>
              {error}
            </TypographyText>
          </View>
        ) : null}

        {/* Content */}
        {loading ? (
          <ActivityIndicator
            color={theme.colors.text.primary}
            style={{ marginTop: 48 }}
          />
        ) : endpoints.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Webhook size={40} color={theme.colors.text.secondary} />
            <TypographyText
              style={{
                color: theme.colors.text.secondary,
                marginTop: 12,
                textAlign: "center",
                lineHeight: 22,
              }}
            >
              {
                "No webhook endpoints yet.\nAdd one to receive real-time events in your EHR or data platform."
              }
            </TypographyText>
          </View>
        ) : (
          endpoints.map((ep) => (
            <EndpointCard
              key={ep.id}
              endpoint={ep}
              isRTL={isRTL}
              theme={theme}
              onDisable={handleDisable}
              onRotateSecret={handleRotateSecret}
            />
          ))
        )}

        {/* HMAC note */}
        {endpoints.length > 0 ? (
          <View
            style={{
              backgroundColor: "#EFF6FF",
              borderRadius: 10,
              padding: 14,
              marginTop: 8,
            }}
          >
            <Caption style={{ color: "#1D4ED8" }}>
              All payloads are signed with HMAC-SHA256. Verify the{" "}
              <Caption style={{ color: "#1D4ED8", fontWeight: "600" }}>
                X-Maak-Signature
              </Caption>{" "}
              header on your server before processing events.
            </Caption>
          </View>
        ) : null}
      </ScrollView>

      <AddEndpointModal
        visible={showAddModal}
        isRTL={isRTL}
        theme={theme}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddEndpoint}
      />
    </WavyBackground>
  );
}

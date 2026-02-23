/**
 * API Key Management Screen
 *
 * Org admins create and manage API keys for external integrations.
 * Keys use format mk_live_{48 hex} and are stored as SHA-256 hashes.
 * The plaintext key is shown exactly once at creation — cannot be recovered.
 *
 * Route: /(settings)/org/api-keys?orgId=<orgId>
 */

import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  CheckCircle2,
  ChevronLeft,
  Key,
  RefreshCw,
  RotateCcw,
  ShieldOff,
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
import { apiKeyService } from "@/lib/services/apiKeyService";
import type { ApiKey, ApiKeyScope } from "@/types";
import { getTextStyle } from "@/utils/styles";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_SCOPES: Array<{ key: ApiKeyScope; label: string; description: string }> =
  [
    {
      key: "vitals:read",
      label: "Vitals — Read",
      description: "Read vital signs and measurements",
    },
    {
      key: "vitals:write",
      label: "Vitals — Write",
      description: "Push vitals from external devices",
    },
    {
      key: "medications:read",
      label: "Medications — Read",
      description: "Read medication lists and adherence",
    },
    {
      key: "anomalies:read",
      label: "Anomalies — Read",
      description: "Read detected vital anomalies",
    },
    {
      key: "alerts:read",
      label: "Alerts — Read",
      description: "Read active and resolved alerts",
    },
    {
      key: "risk:read",
      label: "Risk Score — Read",
      description: "Read composite patient risk scores",
    },
    {
      key: "org:read",
      label: "Org Summary — Read",
      description: "Read org-level cohort summaries",
    },
    {
      key: "patients:read",
      label: "Patients — Read",
      description: "Read patient roster and details",
    },
  ];

const SCOPE_COLORS: Record<string, string> = {
  "vitals:read": "#3B82F6",
  "vitals:write": "#EF4444",
  "medications:read": "#8B5CF6",
  "anomalies:read": "#F59E0B",
  "alerts:read": "#EF4444",
  "risk:read": "#EC4899",
  "org:read": "#14B8A6",
  "patients:read": "#10B981",
};

// ─── API Key Card ─────────────────────────────────────────────────────────────

function ApiKeyCard({
  apiKey,
  isRTL,
  theme,
  onRevoke,
  onRotate,
}: {
  apiKey: ApiKey;
  isRTL: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
  onRevoke: (id: string, name: string) => void;
  onRotate: (id: string, name: string) => void;
}) {
  const isExpired =
    apiKey.expiresAt != null && apiKey.expiresAt < new Date();

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.secondary,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor:
          !apiKey.isActive || isExpired ? "#9CA3AF" : "#22C55E",
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
          {apiKey.name}
        </TypographyText>
        {apiKey.isActive && !isExpired ? (
          <CheckCircle2 size={16} color="#22C55E" />
        ) : (
          <ShieldOff size={16} color="#9CA3AF" />
        )}
      </View>

      {/* Key prefix */}
      <View
        style={{
          backgroundColor: theme.colors.background.primary,
          borderRadius: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          marginBottom: 10,
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Key size={12} color={theme.colors.text.secondary} />
        <Caption
          style={{
            color: theme.colors.text.secondary,
            fontFamily: "monospace",
          }}
        >
          {apiKey.keyPrefix}••••••••••••••••••••••••••••••••••••••••
        </Caption>
      </View>

      {/* Scopes */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 10,
        }}
      >
        {apiKey.scopes.map((scope) => (
          <View
            key={scope}
            style={{
              backgroundColor:
                `${SCOPE_COLORS[scope] ?? "#6B7280"}18`,
              borderRadius: 6,
              paddingHorizontal: 7,
              paddingVertical: 3,
            }}
          >
            <Caption
              style={{ color: SCOPE_COLORS[scope] ?? "#6B7280" }}
            >
              {scope}
            </Caption>
          </View>
        ))}
      </View>

      {/* Meta */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          justifyContent: "space-between",
          marginBottom: apiKey.isActive && !isExpired ? 12 : 0,
        }}
      >
        <Caption style={{ color: theme.colors.text.secondary }}>
          {apiKey.rateLimit} req/min
        </Caption>
        <Caption style={{ color: theme.colors.text.secondary }}>
          {apiKey.lastUsedAt
            ? `Last used: ${apiKey.lastUsedAt.toLocaleDateString()}`
            : isExpired
              ? "Expired"
              : "Never used"}
        </Caption>
      </View>

      {/* Actions — only for active, non-expired keys */}
      {apiKey.isActive && !isExpired ? (
        <View
          style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 8 }}
        >
          <TouchableOpacity
            onPress={() => onRotate(apiKey.id, apiKey.name)}
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
              Rotate
            </Caption>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onRevoke(apiKey.id, apiKey.name)}
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
            <ShieldOff size={14} color="#DC2626" />
            <Caption style={{ color: "#DC2626" }}>Revoke</Caption>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

// ─── Create Key Modal ─────────────────────────────────────────────────────────

function CreateKeyModal({
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
    scopes: ApiKeyScope[],
    rateLimit: number
  ) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Set<ApiKeyScope>>(
    new Set(["vitals:read", "anomalies:read", "alerts:read"])
  );
  const [rateLimit, setRateLimit] = useState("100");
  const [saving, setSaving] = useState(false);

  const toggleScope = (scope: ApiKeyScope) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Please enter a name for this API key.");
      return;
    }
    if (selectedScopes.size === 0) {
      Alert.alert("Validation", "Select at least one scope.");
      return;
    }
    const rate = Number.parseInt(rateLimit, 10);
    if (Number.isNaN(rate) || rate < 1) {
      Alert.alert("Validation", "Rate limit must be a positive number.");
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), Array.from(selectedScopes), rate);
      setName("");
      setSelectedScopes(new Set(["vitals:read", "anomalies:read", "alerts:read"]));
      setRateLimit("100");
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
            maxHeight: "92%",
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
              New API Key
            </TypographyText>

            {/* Name */}
            <Caption
              style={{ color: theme.colors.text.secondary, marginBottom: 6 }}
            >
              Key name
            </Caption>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Epic EHR Integration"
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

            {/* Rate limit */}
            <Caption
              style={{ color: theme.colors.text.secondary, marginBottom: 6 }}
            >
              Rate limit (requests per minute)
            </Caption>
            <TextInput
              value={rateLimit}
              onChangeText={setRateLimit}
              keyboardType="number-pad"
              placeholder="100"
              placeholderTextColor={theme.colors.text.secondary}
              style={{
                backgroundColor: theme.colors.background.secondary,
                borderRadius: 10,
                padding: 12,
                color: theme.colors.text.primary,
                marginBottom: 16,
                fontSize: 15,
                width: 120,
              }}
            />

            {/* Scopes */}
            <Caption
              style={{ color: theme.colors.text.secondary, marginBottom: 10 }}
            >
              Permissions (scopes)
            </Caption>
            {ALL_SCOPES.map(({ key, label, description }) => (
              <TouchableOpacity
                key={key}
                onPress={() => toggleScope(key)}
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.background.secondary,
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <TypographyText
                    style={{
                      color: theme.colors.text.primary,
                      fontSize: 14,
                      fontWeight: "500",
                    }}
                  >
                    {label}
                  </TypographyText>
                  <Caption style={{ color: theme.colors.text.secondary }}>
                    {description}
                  </Caption>
                </View>
                <Switch
                  value={selectedScopes.has(key)}
                  onValueChange={() => toggleScope(key)}
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
                  style={{
                    color: "#FFFFFF",
                    fontSize: 15,
                    fontWeight: "600",
                  }}
                >
                  Generate Key
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

export default function ApiKeysScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ orgId: string }>();
  const orgId = params.orgId;
  const isRTL = i18n.language === "ar";

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
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
        const data = await apiKeyService.listApiKeys(orgId);
        // Sort: active first, then by createdAt desc
        data.sort((a, b) => {
          if (a.isActive !== b.isActive)
            return a.isActive ? -1 : 1;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        if (isMountedRef.current) setApiKeys(data);
      } catch (err) {
        if (isMountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to load API keys"
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

  const handleCreate = useCallback(
    async (name: string, scopes: ApiKeyScope[], rateLimit: number) => {
      if (!orgId || !user?.id) return;
      const { key, plaintext } = await apiKeyService.createApiKey({
        orgId,
        name,
        scopes,
        createdBy: user.id,
        rateLimit,
      });
      if (isMountedRef.current) {
        setApiKeys((prev) => [key, ...prev]);
      }
      // Show plaintext once — cannot be recovered
      Alert.alert(
        "API Key Created",
        `Your new API key:\n\n${plaintext}\n\nCopy it now — this is the only time it will be shown.`,
        [{ text: "I've copied it", style: "default" }]
      );
    },
    [orgId, user?.id]
  );

  const handleRevoke = useCallback(
    (keyId: string, keyName: string) => {
      if (!orgId) return;
      Alert.alert(
        "Revoke API Key",
        `"${keyName}" will be permanently revoked. Any integrations using this key will stop working immediately.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: async () => {
              await apiKeyService.revokeApiKey(orgId, keyId);
              if (isMountedRef.current) {
                setApiKeys((prev) =>
                  prev.map((k) =>
                    k.id === keyId ? { ...k, isActive: false } : k
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

  const handleRotate = useCallback(
    (keyId: string, keyName: string) => {
      if (!orgId || !user?.id) return;
      Alert.alert(
        "Rotate API Key",
        `"${keyName}" will be revoked and a new key created with the same permissions. Update your integration before rotating.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Rotate",
            style: "destructive",
            onPress: async () => {
              try {
                const { key: newKey, plaintext } =
                  await apiKeyService.rotateApiKey(orgId, keyId, user.id);
                if (isMountedRef.current) {
                  setApiKeys((prev) =>
                    [
                      newKey,
                      ...prev.map((k) =>
                        k.id === keyId ? { ...k, isActive: false } : k
                      ),
                    ]
                  );
                }
                Alert.alert(
                  "New API Key",
                  `${plaintext}\n\nCopy it now — this is the only time it will be shown.`,
                  [{ text: "I've copied it", style: "default" }]
                );
              } catch {
                Alert.alert("Error", "Failed to rotate API key.");
              }
            },
          },
        ]
      );
    },
    [orgId, user?.id]
  );

  const activeCount = apiKeys.filter((k) => k.isActive).length;

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
          API Keys
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
        {/* Summary + create */}
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Caption style={{ color: theme.colors.text.secondary }}>
            {activeCount} active key{activeCount !== 1 ? "s" : ""}
          </Caption>
          <TouchableOpacity
            onPress={() => setShowCreateModal(true)}
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
            <Key size={14} color="#FFFFFF" />
            <Caption style={{ color: "#FFFFFF", fontWeight: "600" }}>
              New Key
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
        ) : apiKeys.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Key size={40} color={theme.colors.text.secondary} />
            <TypographyText
              style={{
                color: theme.colors.text.secondary,
                marginTop: 12,
                textAlign: "center",
                lineHeight: 22,
              }}
            >
              {"No API keys yet.\nCreate one to connect EHRs, analytics\nplatforms, and other integrations."}
            </TypographyText>
          </View>
        ) : (
          apiKeys.map((k) => (
            <ApiKeyCard
              key={k.id}
              apiKey={k}
              isRTL={isRTL}
              theme={theme}
              onRevoke={handleRevoke}
              onRotate={handleRotate}
            />
          ))
        )}

        {/* Security note */}
        <View
          style={{
            backgroundColor: "#FFFBEB",
            borderRadius: 10,
            padding: 14,
            marginTop: 8,
          }}
        >
          <Caption style={{ color: "#92400E" }}>
            API keys grant access to patient health data. Store them in
            environment variables — never in client-side code or version
            control. Rotate keys immediately if compromised.
          </Caption>
        </View>
      </ScrollView>

      <CreateKeyModal
        visible={showCreateModal}
        isRTL={isRTL}
        theme={theme}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreate}
      />
    </WavyBackground>
  );
}

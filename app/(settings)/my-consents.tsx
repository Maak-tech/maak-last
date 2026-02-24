/**
 * My Consents Screen
 *
 * Patients see which organizations have access to their health data
 * and can revoke consent at any time. Consent history is preserved
 * per regulatory requirements — only the active flag changes.
 *
 * Route: /(settings)/my-consents
 */

import { useNavigation } from "expo-router";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  RefreshCw,
  Shield,
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
import { consentService } from "@/lib/services/consentService";
import { organizationService } from "@/lib/services/organizationService";
import type { ConsentScope, Organization, PatientConsent } from "@/types";
import { getTextStyle } from "@/utils/styles";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCOPE_LABELS: Record<ConsentScope, string> = {
  vitals: "Vitals",
  medications: "Medications",
  symptoms: "Symptoms",
  lab_results: "Lab Results",
  ai_analysis: "AI Analysis",
  data_export: "Data Export",
  wearable_data: "Wearable Data",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Consent Card ─────────────────────────────────────────────────────────────

function ConsentCard({
  consent,
  org,
  theme,
  onRevoke,
}: {
  consent: PatientConsent;
  org: Organization | null;
  theme: ReturnType<typeof useTheme>["theme"];
  onRevoke: (consent: PatientConsent) => void;
}) {
  const isActive = consent.isActive;

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.secondary,
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: isActive ? "#22C55E" : "#9CA3AF",
      }}
    >
      {/* Header row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <TypographyText
            style={{
              color: theme.colors.text.primary,
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            {org?.name ?? consent.orgId}
          </TypographyText>
          {org?.type ? (
            <Caption
              style={{ color: theme.colors.text.secondary, marginTop: 2 }}
            >
              {org.type.charAt(0).toUpperCase() + org.type.slice(1)}
            </Caption>
          ) : null}
        </View>

        {/* Status badge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: isActive ? "#DCFCE7" : "#F1F5F9",
          }}
        >
          {isActive ? (
            <CheckCircle2 color="#16A34A" size={13} />
          ) : (
            <XCircle color="#9CA3AF" size={13} />
          )}
          <Caption
            style={{
              color: isActive ? "#16A34A" : "#9CA3AF",
              fontWeight: "600",
            }}
          >
            {isActive ? "Active" : "Revoked"}
          </Caption>
        </View>
      </View>

      {/* Scope chips */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 12,
        }}
      >
        {consent.scope.map((s) => (
          <View
            key={s}
            style={{
              backgroundColor: isActive
                ? "#EFF6FF"
                : theme.colors.background.primary,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Caption
              style={{
                color: isActive ? "#2563EB" : theme.colors.text.secondary,
              }}
            >
              {SCOPE_LABELS[s] ?? s}
            </Caption>
          </View>
        ))}
      </View>

      {/* Dates */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Caption style={{ color: theme.colors.text.secondary }}>
          Granted {formatDate(consent.grantedAt)}
        </Caption>
        {consent.revokedAt ? (
          <Caption style={{ color: theme.colors.text.secondary }}>
            Revoked {formatDate(consent.revokedAt)}
          </Caption>
        ) : null}
      </View>

      {/* Revoke button — only for active consents */}
      {isActive ? (
        <TouchableOpacity
          onPress={() => onRevoke(consent)}
          style={{
            marginTop: 14,
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: "#EF4444",
            paddingVertical: 10,
            alignItems: "center",
          }}
        >
          <Caption style={{ color: "#EF4444", fontWeight: "600" }}>
            Revoke Access
          </Caption>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyConsentsScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const isRTL = i18n.language === "ar";

  const [consents, setConsents] = useState<PatientConsent[]>([]);
  const [orgsMap, setOrgsMap] = useState<Record<string, Organization>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      if (!user?.id) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await consentService.getUserConsents(user.id);
        // Sort: active first, then by grantedAt desc
        data.sort((a, b) => {
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          return b.grantedAt.getTime() - a.grantedAt.getTime();
        });

        // Fetch org names for display
        const map: Record<string, Organization> = {};
        await Promise.allSettled(
          data.map(async (c) => {
            if (!map[c.orgId]) {
              const org = await organizationService.getOrganization(c.orgId);
              if (org) map[c.orgId] = org;
            }
          })
        );

        if (isMountedRef.current) {
          setConsents(data);
          setOrgsMap(map);
        }
      } catch (err) {
        if (isMountedRef.current)
          setError(
            err instanceof Error ? err.message : "Failed to load consents"
          );
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [user?.id]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const handleRevoke = useCallback(
    (consent: PatientConsent) => {
      const orgName = orgsMap[consent.orgId]?.name ?? consent.orgId;
      Alert.alert(
        "Revoke Access",
        `Remove ${orgName}'s access to your health data? This takes effect immediately and cannot be undone without contacting the organization.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: async () => {
              if (!user?.id) return;
              try {
                await consentService.revokeConsentWithMirror(
                  user.id,
                  consent.orgId,
                  user.id
                );
                // Optimistic update
                setConsents((prev) =>
                  prev.map((c) =>
                    c.orgId === consent.orgId
                      ? {
                          ...c,
                          isActive: false,
                          revokedAt: new Date(),
                          revokedBy: user.id,
                        }
                      : c
                  )
                );
              } catch {
                Alert.alert(
                  "Error",
                  "Failed to revoke consent. Please try again."
                );
              }
            },
          },
        ]
      );
    },
    [orgsMap, user?.id]
  );

  const activeCount = consents.filter((c) => c.isActive).length;

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
          Data Access
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
        {/* Summary banner */}
        {!loading && consents.length > 0 ? (
          <View
            style={{
              backgroundColor: activeCount > 0 ? "#EFF6FF" : "#F1F5F9",
              borderRadius: 12,
              padding: 14,
              marginBottom: 20,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <AlertCircle
              color={activeCount > 0 ? "#2563EB" : "#64748B"}
              size={18}
            />
            <Caption
              style={{
                color: activeCount > 0 ? "#1D4ED8" : "#64748B",
                flex: 1,
              }}
            >
              {activeCount === 0
                ? "No organizations currently have access to your health data."
                : `${activeCount} organization${activeCount !== 1 ? "s" : ""} can currently access your health data.`}
            </Caption>
          </View>
        ) : null}

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

        {loading ? (
          <ActivityIndicator
            color={theme.colors.text.primary}
            style={{ marginTop: 48 }}
          />
        ) : consents.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Shield color={theme.colors.text.secondary} size={40} />
            <TypographyText
              style={{
                color: theme.colors.text.secondary,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              No organizations have requested access to your data.
            </TypographyText>
          </View>
        ) : (
          consents.map((c) => (
            <ConsentCard
              consent={c}
              key={`${c.orgId}-${c.grantedAt.getTime()}`}
              onRevoke={handleRevoke}
              org={orgsMap[c.orgId] ?? null}
              theme={theme}
            />
          ))
        )}

        {/* Privacy note */}
        {!loading && (
          <View
            style={{
              backgroundColor: "#F0FDF4",
              borderRadius: 10,
              padding: 14,
              marginTop: 8,
            }}
          >
            <Caption style={{ color: "#166534" }}>
              Revoking access is immediate and permanent. Organizations retain
              records they already generated per their data retention policy.
              Your Maak data is never sold or shared without explicit consent.
            </Caption>
          </View>
        )}
      </ScrollView>
    </WavyBackground>
  );
}

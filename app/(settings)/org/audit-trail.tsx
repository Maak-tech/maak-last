/**
 * Audit Trail Screen
 *
 * HIPAA-compliant, append-only access and mutation log for an organization.
 * Accessible to org_admin only. Shows who accessed what data, and when.
 *
 * Route: /(settings)/org/audit-trail?orgId=<orgId>
 */

import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  collection,
  type DocumentSnapshot,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import {
  Activity,
  AlertCircle,
  ChevronLeft,
  Eye,
  Key,
  RefreshCw,
  Shield,
  Trash2,
  User,
  Webhook,
  Zap,
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
import { useTheme } from "@/contexts/ThemeContext";
import { db } from "@/lib/firebase";
import type { AuditAction, AuditTrailEntry } from "@/types";
import { getTextStyle } from "@/utils/styles";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

type FilterCategory = "all" | "phi" | "patient" | "admin" | "system";

const FILTER_CATEGORIES: Array<{ key: FilterCategory; label: string }> = [
  { key: "all", label: "All" },
  { key: "phi", label: "PHI Access" },
  { key: "patient", label: "Patient" },
  { key: "admin", label: "Admin" },
  { key: "system", label: "System" },
];

const PHI_ACTIONS: AuditAction[] = [
  "phi_read",
  "phi_write",
  "phi_delete",
  "phi_export",
];
const PATIENT_ACTIONS: AuditAction[] = [
  "patient_enrolled",
  "patient_discharged",
  "consent_granted",
  "consent_revoked",
];
const ADMIN_ACTIONS: AuditAction[] = [
  "api_key_created",
  "api_key_revoked",
  "role_changed",
];
const SYSTEM_ACTIONS: AuditAction[] = [
  "agent_action",
  "webhook_triggered",
  "api_key_used",
  "alert_created",
  "alert_resolved",
  "login",
  "logout",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function mapEntry(id: string, data: Record<string, unknown>): AuditTrailEntry {
  return {
    id,
    timestamp: toDate(data.timestamp),
    actorId: (data.actorId as string) ?? "",
    actorType: (data.actorType as AuditTrailEntry["actorType"]) ?? "user",
    actorOrgId: data.actorOrgId as string | undefined,
    action: (data.action as AuditAction) ?? "phi_read",
    resourceType: (data.resourceType as string) ?? "",
    resourceId: (data.resourceId as string) ?? "",
    patientUserId: data.patientUserId as string | undefined,
    orgId: data.orgId as string | undefined,
    ipAddress: data.ipAddress as string | undefined,
    userAgent: data.userAgent as string | undefined,
    details: data.details as Record<string, unknown> | undefined,
    outcome: (data.outcome as AuditTrailEntry["outcome"]) ?? "success",
    denialReason: data.denialReason as string | undefined,
  };
}

function maskId(id: string): string {
  if (!id || id.length <= 8) return id;
  return `${id.slice(0, 6)}••••${id.slice(-4)}`;
}

function formatTimestamp(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function actionLabel(action: AuditAction): string {
  const map: Record<AuditAction, string> = {
    phi_read: "PHI Read",
    phi_write: "PHI Write",
    phi_delete: "PHI Delete",
    phi_export: "PHI Export",
    login: "Login",
    logout: "Logout",
    api_key_created: "API Key Created",
    api_key_revoked: "API Key Revoked",
    api_key_used: "API Key Used",
    role_changed: "Role Changed",
    patient_enrolled: "Patient Enrolled",
    patient_discharged: "Patient Discharged",
    consent_granted: "Consent Granted",
    consent_revoked: "Consent Revoked",
    agent_action: "Agent Action",
    alert_created: "Alert Created",
    alert_resolved: "Alert Resolved",
    webhook_triggered: "Webhook Triggered",
  };
  return map[action] ?? action;
}

function actionIcon(action: AuditAction, color: string) {
  const size = 16;
  if (PHI_ACTIONS.includes(action)) return <Eye color={color} size={size} />;
  if (["patient_enrolled", "patient_discharged"].includes(action))
    return <User color={color} size={size} />;
  if (["consent_granted", "consent_revoked"].includes(action))
    return <Shield color={color} size={size} />;
  if (["api_key_created", "api_key_revoked", "api_key_used"].includes(action))
    return <Key color={color} size={size} />;
  if (action === "role_changed") return <User color={color} size={size} />;
  if (action === "agent_action") return <Zap color={color} size={size} />;
  if (action === "webhook_triggered")
    return <Webhook color={color} size={size} />;
  if (["phi_delete", "patient_discharged"].includes(action))
    return <Trash2 color={color} size={size} />;
  if (["alert_created", "alert_resolved"].includes(action))
    return <AlertCircle color={color} size={size} />;
  return <Activity color={color} size={size} />;
}

function outcomeColor(outcome: AuditTrailEntry["outcome"]): string {
  if (outcome === "success") return "#22C55E";
  if (outcome === "denied") return "#F97316";
  return "#EF4444";
}

// ─── Entry Row ────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  theme,
}: {
  entry: AuditTrailEntry;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const iconColor = "#6366F1";
  const dot = outcomeColor(entry.outcome);

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.secondary,
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      {/* Icon */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: "#EEF2FF",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {actionIcon(entry.action, iconColor)}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 2,
          }}
        >
          <TypographyText
            numberOfLines={1}
            style={{
              color: theme.colors.text.primary,
              fontSize: 13,
              fontWeight: "600",
              flex: 1,
            }}
          >
            {actionLabel(entry.action)}
          </TypographyText>
          {/* Outcome dot */}
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: dot,
              marginLeft: 8,
              flexShrink: 0,
            }}
          />
        </View>

        <Caption style={{ color: theme.colors.text.secondary }}>
          {entry.resourceType}
          {entry.patientUserId ? ` · pt: ${maskId(entry.patientUserId)}` : ""}
        </Caption>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          <Caption style={{ color: theme.colors.text.secondary }}>
            {entry.actorType === "api_key" ? "Key: " : ""}
            {maskId(entry.actorId)}
          </Caption>
          <Caption style={{ color: theme.colors.text.secondary }}>
            {formatTimestamp(entry.timestamp)}
          </Caption>
        </View>

        {/* Denial reason */}
        {entry.denialReason ? (
          <Caption style={{ color: "#EF4444", marginTop: 2 }}>
            {entry.denialReason}
          </Caption>
        ) : null}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AuditTrailScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ orgId: string }>();
  const orgId = params.orgId ?? "";
  const isRTL = i18n.language === "ar";

  const [entries, setEntries] = useState<AuditTrailEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterCategory>("all");

  const lastDocRef = useRef<DocumentSnapshot | null>(null);
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

  // Build action filter list for current category
  function actionsForFilter(cat: FilterCategory): AuditAction[] | null {
    if (cat === "phi") return PHI_ACTIONS;
    if (cat === "patient") return PATIENT_ACTIONS;
    if (cat === "admin") return ADMIN_ACTIONS;
    if (cat === "system") return SYSTEM_ACTIONS;
    return null; // "all" — no filter
  }

  const load = useCallback(
    async (isRefresh = false) => {
      if (!orgId) return;
      if (isRefresh) {
        setRefreshing(true);
        lastDocRef.current = null;
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const col = collection(db, "audit_trail");
        const actions = actionsForFilter(filter);

        const constraints = [
          where("orgId", "==", orgId),
          orderBy("timestamp", "desc"),
          limit(PAGE_SIZE),
          ...(actions ? [where("action", "in", actions)] : []),
        ] as Parameters<typeof query>[1][];

        const snap = await getDocs(query(col, ...constraints));
        const items = snap.docs.map((d) =>
          mapEntry(d.id, d.data() as Record<string, unknown>)
        );

        if (isMountedRef.current) {
          setEntries(items);
          lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
          setHasMore(snap.docs.length === PAGE_SIZE);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to load audit trail"
          );
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [orgId, filter]
  );

  const loadMore = useCallback(async () => {
    if (!(orgId && hasMore) || loadingMore || !lastDocRef.current) return;
    setLoadingMore(true);

    try {
      const col = collection(db, "audit_trail");
      const actions = actionsForFilter(filter);

      const constraints = [
        where("orgId", "==", orgId),
        orderBy("timestamp", "desc"),
        startAfter(lastDocRef.current),
        limit(PAGE_SIZE),
        ...(actions ? [where("action", "in", actions)] : []),
      ] as Parameters<typeof query>[1][];

      const snap = await getDocs(query(col, ...constraints));
      const more = snap.docs.map((d) =>
        mapEntry(d.id, d.data() as Record<string, unknown>)
      );

      if (isMountedRef.current) {
        setEntries((prev) => [...prev, ...more]);
        lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
        setHasMore(snap.docs.length === PAGE_SIZE);
      }
    } catch {
      // silently ignore pagination errors
    } finally {
      if (isMountedRef.current) setLoadingMore(false);
    }
  }, [orgId, filter, hasMore, loadingMore]);

  useEffect(() => {
    load(false);
  }, [load]);

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
          Audit Trail
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

      {/* Filter chips */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 12,
          gap: 8,
          flexDirection: isRTL ? "row-reverse" : "row",
        }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {FILTER_CATEGORIES.map((cat) => {
          const active = filter === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              onPress={() => setFilter(cat.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: active
                  ? "#6366F1"
                  : theme.colors.background.secondary,
              }}
            >
              <Caption
                style={{
                  color: active ? "#FFFFFF" : theme.colors.text.secondary,
                  fontWeight: active ? "600" : "400",
                }}
              >
                {cat.label}
              </Caption>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const nearBottom =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - 200;
          if (nearBottom && !loadingMore) {
            loadMore();
          }
        }}
        refreshControl={
          <RefreshControl
            onRefresh={() => load(true)}
            refreshing={refreshing}
          />
        }
        scrollEventThrottle={400}
        showsVerticalScrollIndicator={false}
      >
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
        ) : entries.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Shield color={theme.colors.text.secondary} size={40} />
            <TypographyText
              style={{
                color: theme.colors.text.secondary,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              No audit entries found for this filter.
            </TypographyText>
          </View>
        ) : (
          <>
            {entries.map((e) => (
              <EntryRow entry={e} key={e.id} theme={theme} />
            ))}

            {/* Load more */}
            {hasMore ? (
              <TouchableOpacity
                disabled={loadingMore}
                onPress={loadMore}
                style={{
                  alignItems: "center",
                  paddingVertical: 16,
                  marginTop: 4,
                }}
              >
                {loadingMore ? (
                  <ActivityIndicator color={theme.colors.text.secondary} />
                ) : (
                  <Caption style={{ color: "#6366F1", fontWeight: "600" }}>
                    Load more
                  </Caption>
                )}
              </TouchableOpacity>
            ) : (
              <Caption
                style={{
                  color: theme.colors.text.secondary,
                  textAlign: "center",
                  marginTop: 8,
                  paddingBottom: 8,
                }}
              >
                End of audit log
              </Caption>
            )}
          </>
        )}
      </ScrollView>

      {/* HIPAA notice */}
      <View
        style={{
          backgroundColor: "#F0FDF4",
          borderTopWidth: 1,
          borderTopColor: "#BBF7D0",
          paddingHorizontal: 20,
          paddingVertical: 10,
        }}
      >
        <Caption style={{ color: "#166534", textAlign: "center" }}>
          This log is append-only and tamper-evident. Required for HIPAA
          compliance.
        </Caption>
      </View>
    </WavyBackground>
  );
}

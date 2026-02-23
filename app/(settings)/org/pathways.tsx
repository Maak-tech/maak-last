/**
 * Care Pathway Management Screen
 *
 * Org admins and care coordinators use this screen to:
 *   - Browse and toggle active/inactive pathway definitions
 *   - Import built-in clinical protocol templates (one-tap)
 *
 * Route: /(settings)/org/pathways?orgId=<orgId>
 */

import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  Activity,
  ChevronLeft,
  GitBranch,
  Plus,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
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
import {
  carePathwayService,
  parseDelayMs,
} from "@/lib/services/carePathwayService";
import type { PathwayDefinition } from "@/types";
import { getTextStyle } from "@/utils/styles";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDelay(delay: string): string {
  const ms = parseDelayMs(delay);
  if (ms === 0) return "immediately";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return `after ${days}d`;
  if (hours > 0) return `after ${hours}h`;
  return `after ${mins}m`;
}

// ─── Pathway Card ─────────────────────────────────────────────────────────────

function PathwayCard({
  pathway,
  isRTL,
  theme,
  onToggle,
}: {
  pathway: PathwayDefinition;
  isRTL: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
  onToggle: (pathway: PathwayDefinition) => void;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.background.secondary,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: pathway.isActive ? "#22C55E" : "#9CA3AF",
      }}
    >
      {/* Header row */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <View
          style={{
            flex: 1,
            marginRight: isRTL ? 0 : 12,
            marginLeft: isRTL ? 12 : 0,
          }}
        >
          <TypographyText
            style={getTextStyle(
              theme,
              "subheading",
              "semibold",
              theme.colors.text.primary
            )}
          >
            {pathway.name}
          </TypographyText>
          {pathway.description ? (
            <Caption
              style={{ color: theme.colors.text.secondary, marginTop: 2 }}
            >
              {pathway.description}
            </Caption>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={() => onToggle(pathway)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {pathway.isActive ? (
            <ToggleRight size={28} color="#22C55E" />
          ) : (
            <ToggleLeft size={28} color="#9CA3AF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Trigger */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          marginBottom: 8,
          gap: 6,
        }}
      >
        <Activity size={13} color={theme.colors.text.secondary} />
        <Caption style={{ color: theme.colors.text.secondary }}>
          {"Trigger: "}
          <Caption style={{ color: theme.colors.text.primary }}>
            {pathway.triggerCondition}
          </Caption>
        </Caption>
      </View>

      {/* Step chips */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        {pathway.steps.map((step, idx) => (
          <View
            key={step.id}
            style={{
              backgroundColor: theme.colors.background.primary,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Caption style={{ color: theme.colors.text.secondary }}>
              {idx + 1}. {step.action.replace(/_/g, " ")}{" "}
              {formatDelay(step.delay)}
            </Caption>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Template Row ─────────────────────────────────────────────────────────────

function TemplateRow({
  name,
  description,
  triggerCondition,
  stepCount,
  isRTL,
  theme,
  onImport,
}: {
  name: string;
  description: string;
  triggerCondition: string;
  stepCount: number;
  isRTL: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
  onImport: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.background.secondary,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        flexDirection: isRTL ? "row-reverse" : "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <GitBranch size={20} color="#6366F1" />
      <View style={{ flex: 1 }}>
        <TypographyText
          style={{
            color: theme.colors.text.primary,
            fontSize: 14,
            fontWeight: "600",
          }}
        >
          {name}
        </TypographyText>
        <Caption style={{ color: theme.colors.text.secondary }}>
          {description} · {stepCount} steps · {triggerCondition}
        </Caption>
      </View>
      <TouchableOpacity
        onPress={onImport}
        style={{
          backgroundColor: "#6366F1",
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 6,
        }}
      >
        <Caption style={{ color: "#FFFFFF", fontWeight: "600" }}>
          Import
        </Caption>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PathwaysScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ orgId: string }>();
  const orgId = params.orgId;
  const isRTL = i18n.language === "ar";

  const [pathways, setPathways] = useState<PathwayDefinition[]>([]);
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
      if (!orgId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await carePathwayService.listPathways(orgId);
        if (isMountedRef.current) setPathways(data);
      } catch (err) {
        if (isMountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to load pathways"
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

  const handleToggle = useCallback(
    async (pathway: PathwayDefinition) => {
      if (!orgId) return;
      const next = !pathway.isActive;
      setPathways((prev) =>
        prev.map((p) => (p.id === pathway.id ? { ...p, isActive: next } : p))
      );
      try {
        await carePathwayService.setPathwayActive(orgId, pathway.id, next);
      } catch {
        setPathways((prev) =>
          prev.map((p) =>
            p.id === pathway.id ? { ...p, isActive: pathway.isActive } : p
          )
        );
        Alert.alert("Error", "Failed to update pathway status.");
      }
    },
    [orgId]
  );

  const handleImportTemplate = useCallback(
    async (
      template: ReturnType<
        typeof carePathwayService.getBuiltInTemplates
      >[number]
    ) => {
      if (!orgId || !user?.id) return;
      try {
        const created = await carePathwayService.createPathway({
          orgId,
          createdBy: user.id,
          name: template.name,
          description: template.description,
          triggerCondition: template.triggerCondition,
          steps: template.steps,
        });
        if (isMountedRef.current) {
          setPathways((prev) => [created, ...prev]);
          Alert.alert(
            "Imported",
            `"${template.name}" has been added to your pathways.`
          );
        }
      } catch {
        Alert.alert("Error", "Failed to import template.");
      }
    },
    [orgId, user?.id]
  );

  const templates = carePathwayService.getBuiltInTemplates();

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
          Care Pathways
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
        ) : (
          <>
            {/* Your Pathways */}
            <TypographyText
              style={[
                getTextStyle(
                  theme,
                  "subheading",
                  "semibold",
                  theme.colors.text.primary
                ),
                { marginBottom: 12 },
              ]}
            >
              Your Pathways ({pathways.length})
            </TypographyText>

            {pathways.length === 0 ? (
              <View
                style={{
                  alignItems: "center",
                  paddingVertical: 32,
                  marginBottom: 24,
                }}
              >
                <GitBranch size={36} color={theme.colors.text.secondary} />
                <TypographyText
                  style={{
                    color: theme.colors.text.secondary,
                    marginTop: 12,
                    textAlign: "center",
                  }}
                >
                  No pathways yet. Import a template below to get started.
                </TypographyText>
              </View>
            ) : (
              pathways.map((p) => (
                <PathwayCard
                  key={p.id}
                  pathway={p}
                  isRTL={isRTL}
                  theme={theme}
                  onToggle={handleToggle}
                />
              ))
            )}

            {/* Built-in Templates */}
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                marginTop: 8,
              }}
            >
              <Plus size={16} color={theme.colors.text.secondary} />
              <TypographyText
                style={getTextStyle(
                  theme,
                  "subheading",
                  "semibold",
                  theme.colors.text.primary
                )}
              >
                Import Template
              </TypographyText>
            </View>
            <Caption
              style={{ color: theme.colors.text.secondary, marginBottom: 12 }}
            >
              Pre-built clinical protocols — customize after importing.
            </Caption>

            {templates.map((t) => (
              <TemplateRow
                key={t.triggerCondition}
                name={t.name}
                description={t.description}
                triggerCondition={t.triggerCondition}
                stepCount={t.steps.length}
                isRTL={isRTL}
                theme={theme}
                onImport={() => handleImportTemplate(t)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </WavyBackground>
  );
}

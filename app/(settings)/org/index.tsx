/**
 * Org Settings Hub
 *
 * Entry point for organization configuration. Accessible to org_admin
 * and care_coordinator roles. Links to all org management sub-screens.
 *
 * Route: /(settings)/org?orgId=<orgId>&orgName=<orgName>
 */

import { router, useLocalSearchParams, useNavigation } from "expo-router";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GitBranch,
  Key,
  Layers,
  Shield,
  Users,
  Webhook,
} from "lucide-react-native";
import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, TouchableOpacity, View } from "react-native";
import {
  Caption,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import WavyBackground from "@/components/figma/WavyBackground";
import { useTheme } from "@/contexts/ThemeContext";
import { getTextStyle } from "@/utils/styles";

// ─── Nav Item ─────────────────────────────────────────────────────────────────

function NavItem({
  icon,
  label,
  description,
  onPress,
  isRTL,
  theme,
  iconBg,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onPress: () => void;
  isRTL: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
  iconBg: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: theme.colors.background.secondary,
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
        flexDirection: isRTL ? "row-reverse" : "row",
        alignItems: "center",
        gap: 14,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <TypographyText
          style={{
            color: theme.colors.text.primary,
            fontSize: 15,
            fontWeight: "600",
          }}
        >
          {label}
        </TypographyText>
        <Caption style={{ color: theme.colors.text.secondary, marginTop: 2 }}>
          {description}
        </Caption>
      </View>
      <ChevronRight
        size={18}
        color={theme.colors.text.secondary}
        style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
      />
    </TouchableOpacity>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  label,
  theme,
}: {
  label: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <TypographyText
      style={[
        getTextStyle(theme, "caption", "semibold", theme.colors.text.secondary),
        {
          textTransform: "uppercase",
          letterSpacing: 0.8,
          marginBottom: 8,
          marginTop: 20,
        },
      ]}
    >
      {label}
    </TypographyText>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OrgSettingsHub() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ orgId: string; orgName: string }>();
  const orgId = params.orgId ?? "";
  const orgName = params.orgName ?? "Organization";
  const isRTL = i18n.language === "ar";

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const navigate = (path: string) => {
    router.push(
      `/(settings)/org/${path}?orgId=${encodeURIComponent(orgId)}&orgName=${encodeURIComponent(orgName)}` as never
    );
  };

  return (
    <WavyBackground>
      {/* Header */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          paddingTop: 56,
          paddingHorizontal: 20,
          paddingBottom: 8,
          gap: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={theme.colors.text.primary} />
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
            {orgName}
          </TypographyText>
          <Caption style={{ color: theme.colors.text.secondary }}>
            Organization settings
          </Caption>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Org identity card */}
        <View
          style={{
            backgroundColor: theme.colors.background.secondary,
            borderRadius: 14,
            padding: 16,
            marginBottom: 4,
            flexDirection: isRTL ? "row-reverse" : "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: "#EFF6FF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={24} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <TypographyText
              style={{
                color: theme.colors.text.primary,
                fontSize: 17,
                fontWeight: "700",
              }}
            >
              {orgName}
            </TypographyText>
            <Caption
              style={{ color: theme.colors.text.secondary, fontFamily: "monospace" }}
              numberOfLines={1}
            >
              ID: {orgId}
            </Caption>
          </View>
        </View>

        {/* — Clinical Workflows — */}
        <SectionHeader label="Clinical Workflows" theme={theme} />

        <NavItem
          icon={<GitBranch size={22} color="#6366F1" />}
          label="Care Pathways"
          description="Automated clinical protocols for patient cohorts"
          onPress={() => navigate("pathways")}
          isRTL={isRTL}
          theme={theme}
          iconBg="#EEF2FF"
        />

        <NavItem
          icon={<Users size={22} color="#10B981" />}
          label="Patient Roster"
          description="Enrolled patients, consent, and risk overview"
          onPress={() =>
            router.push(
              `/(tabs)/org-dashboard?orgId=${encodeURIComponent(orgId)}` as never
            )
          }
          isRTL={isRTL}
          theme={theme}
          iconBg="#ECFDF5"
        />

        <NavItem
          icon={<Layers size={22} color="#0D9488" />}
          label="Patient Cohorts"
          description="Group patients by condition, program, or risk tier"
          onPress={() => navigate("cohorts")}
          isRTL={isRTL}
          theme={theme}
          iconBg="#F0FDFA"
        />

        <NavItem
          icon={<Users size={22} color="#8B5CF6" />}
          label="Team Members"
          description="Manage providers, coordinators, and access roles"
          onPress={() => navigate("members")}
          isRTL={isRTL}
          theme={theme}
          iconBg="#F5F3FF"
        />

        <NavItem
          icon={<ClipboardList size={22} color="#0EA5E9" />}
          label="Task Queue"
          description="Open tasks and coordinator work queue"
          onPress={() =>
            router.push(
              `/(tabs)/tasks?orgId=${encodeURIComponent(orgId)}` as never
            )
          }
          isRTL={isRTL}
          theme={theme}
          iconBg="#F0F9FF"
        />

        {/* — Integration — */}
        <SectionHeader label="Integration" theme={theme} />

        <NavItem
          icon={<Key size={22} color="#F59E0B" />}
          label="API Keys"
          description="Manage keys for EHR and analytics integrations"
          onPress={() => navigate("api-keys")}
          isRTL={isRTL}
          theme={theme}
          iconBg="#FFFBEB"
        />

        <NavItem
          icon={<Webhook size={22} color="#EC4899" />}
          label="Webhooks"
          description="Real-time event delivery to external systems"
          onPress={() => navigate("webhooks")}
          isRTL={isRTL}
          theme={theme}
          iconBg="#FDF2F8"
        />

        {/* — Compliance — */}
        <SectionHeader label="Compliance" theme={theme} />

        <NavItem
          icon={<Shield size={22} color="#64748B" />}
          label="Audit Trail"
          description="HIPAA-compliant access and mutation log"
          onPress={() => navigate("audit-trail")}
          isRTL={isRTL}
          theme={theme}
          iconBg="#F1F5F9"
        />

        {/* Info footer */}
        <View
          style={{
            backgroundColor: "#EFF6FF",
            borderRadius: 10,
            padding: 14,
            marginTop: 24,
          }}
        >
          <Caption style={{ color: "#1D4ED8" }}>
            Changes take effect immediately. API key and webhook changes may
            require restarting affected integrations.
          </Caption>
        </View>
      </ScrollView>
    </WavyBackground>
  );
}

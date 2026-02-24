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
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  GitBranch,
  Key,
  Layers,
  MessageSquare,
  Shield,
  Users,
  Webhook,
  Zap,
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
        color={theme.colors.text.secondary}
        size={18}
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
        {/* Org identity card — tappable → profile settings */}
        <TouchableOpacity
          onPress={() => navigate("profile")}
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
            <Building2 color="#2563EB" size={24} />
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
              numberOfLines={1}
              style={{
                color: theme.colors.text.secondary,
                fontFamily: "monospace",
              }}
            >
              ID: {orgId}
            </Caption>
          </View>
          <ChevronRight color={theme.colors.text.secondary} size={16} />
        </TouchableOpacity>

        {/* — Clinical Workflows — */}
        <SectionHeader label="Clinical Workflows" theme={theme} />

        <NavItem
          description="Automated clinical protocols for patient cohorts"
          icon={<GitBranch color="#6366F1" size={22} />}
          iconBg="#EEF2FF"
          isRTL={isRTL}
          label="Care Pathways"
          onPress={() => navigate("pathways")}
          theme={theme}
        />

        <NavItem
          description="Enrolled patients, consent, and risk overview"
          icon={<Users color="#10B981" size={22} />}
          iconBg="#ECFDF5"
          isRTL={isRTL}
          label="Patient Roster"
          onPress={() =>
            router.push(
              `/(tabs)/org-dashboard?orgId=${encodeURIComponent(orgId)}` as never
            )
          }
          theme={theme}
        />

        <NavItem
          description="Group patients by condition, program, or risk tier"
          icon={<Layers color="#0D9488" size={22} />}
          iconBg="#F0FDFA"
          isRTL={isRTL}
          label="Patient Cohorts"
          onPress={() => navigate("cohorts")}
          theme={theme}
        />

        <NavItem
          description="Manage providers, coordinators, and access roles"
          icon={<Users color="#8B5CF6" size={22} />}
          iconBg="#F5F3FF"
          isRTL={isRTL}
          label="Team Members"
          onPress={() => navigate("members")}
          theme={theme}
        />

        <NavItem
          description="Open tasks and coordinator work queue"
          icon={<ClipboardList color="#0EA5E9" size={22} />}
          iconBg="#F0F9FF"
          isRTL={isRTL}
          label="Task Queue"
          onPress={() =>
            router.push(
              `/(tabs)/tasks?orgId=${encodeURIComponent(orgId)}` as never
            )
          }
          theme={theme}
        />

        {/* — Integration — */}
        <SectionHeader label="Integration" theme={theme} />

        <NavItem
          description="Endpoints, LOINC codes, and Epic / Cerner connection guide"
          icon={<Zap color="#10B981" size={22} />}
          iconBg="#ECFDF5"
          isRTL={isRTL}
          label="FHIR R4 / EHR"
          onPress={() => navigate("fhir")}
          theme={theme}
        />

        <NavItem
          description="Manage keys for EHR and analytics integrations"
          icon={<Key color="#F59E0B" size={22} />}
          iconBg="#FFFBEB"
          isRTL={isRTL}
          label="API Keys"
          onPress={() => navigate("api-keys")}
          theme={theme}
        />

        <NavItem
          description="Real-time event delivery to external systems"
          icon={<Webhook color="#EC4899" size={22} />}
          iconBg="#FDF2F8"
          isRTL={isRTL}
          label="Webhooks"
          onPress={() => navigate("webhooks")}
          theme={theme}
        />

        <NavItem
          description="Email digest channels, delivery logs, and alert settings"
          icon={<Bell color="#F97316" size={22} />}
          iconBg="#FFF7ED"
          isRTL={isRTL}
          label="Notifications"
          onPress={() => navigate("notifications")}
          theme={theme}
        />

        <NavItem
          description="Customize push notification copy for each alert type"
          icon={<MessageSquare color="#7C3AED" size={22} />}
          iconBg="#F5F3FF"
          isRTL={isRTL}
          label="Message Templates"
          onPress={() => navigate("templates")}
          theme={theme}
        />

        <NavItem
          description="Current plan, usage limits, and upgrade options"
          icon={<CreditCard color="#6366F1" size={22} />}
          iconBg="#EEF2FF"
          isRTL={isRTL}
          label="Plan & Billing"
          onPress={() => navigate("billing")}
          theme={theme}
        />

        {/* — Compliance — */}
        <SectionHeader label="Compliance" theme={theme} />

        <NavItem
          description="HIPAA-compliant access and mutation log"
          icon={<Shield color="#64748B" size={22} />}
          iconBg="#F1F5F9"
          isRTL={isRTL}
          label="Audit Trail"
          onPress={() => navigate("audit-trail")}
          theme={theme}
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

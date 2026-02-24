/**
 * Create Organization Screen
 *
 * First-time setup for org admins who don't yet belong to an organization.
 * Collects org name, type, and data region, then:
 *   1. Creates the organization document in Firestore
 *   2. Adds the creator as org_admin member
 *
 * After creation, navigates to the org settings hub.
 *
 * Route: /(settings)/create-org
 */

import { router, useNavigation } from "expo-router";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { organizationService } from "@/lib/services/organizationService";
import type { OrgType } from "@/types";
import { getTextStyle } from "@/utils/styles";

// ─── Config ───────────────────────────────────────────────────────────────────

const ORG_TYPES: { value: OrgType; label: string; description: string }[] = [
  {
    value: "clinic",
    label: "Clinic",
    description: "Outpatient clinic or medical practice",
  },
  {
    value: "hospital",
    label: "Hospital",
    description: "Inpatient facility or health system",
  },
  {
    value: "employer",
    label: "Employer",
    description: "Corporate wellness or employee health program",
  },
  {
    value: "insurer",
    label: "Insurance",
    description: "Health insurance or case management",
  },
  {
    value: "homecare",
    label: "Home Care",
    description: "Home health agency or remote monitoring",
  },
];

const DATA_REGIONS: { value: "us" | "eu" | "uae"; label: string }[] = [
  { value: "us", label: "United States" },
  { value: "eu", label: "European Union" },
  { value: "uae", label: "UAE / Gulf Region" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldLabel({
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
        { textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
      ]}
    >
      {label}
    </TypographyText>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateOrgScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const isRTL = i18n.language === "ar";

  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState<OrgType>("clinic");
  const [dataRegion, setDataRegion] = useState<"us" | "eu" | "uae">("us");
  const [creating, setCreating] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const isValid = orgName.trim().length >= 2;

  const handleCreate = async () => {
    if (!(user?.id && isValid)) return;
    setCreating(true);
    try {
      const org = await organizationService.createOrganization({
        name: orgName.trim(),
        type: orgType,
        plan: "starter",
        createdBy: user.id,
        settings: {
          dataRegion,
          timezone: "UTC",
          language: "en" as const,
          features: [],
          branding: { primaryColor: "#2563EB" },
        },
      });

      // Add creator as org_admin
      await organizationService.addMember(org.id, {
        orgId: org.id,
        userId: user.id,
        role: "org_admin",
        displayName:
          (user as { displayName?: string }).displayName ??
          (user as { name?: string }).name ??
          user.id,
        email: (user as { email?: string }).email,
        invitedBy: user.id,
        isActive: true,
      });

      router.replace(
        `/(settings)/org?orgId=${encodeURIComponent(org.id)}&orgName=${encodeURIComponent(org.name)}` as never
      );
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to create organization."
      );
      setCreating(false);
    }
  };

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
            New Organization
          </TypographyText>
          <Caption style={{ color: theme.colors.text.secondary }}>
            Set up your healthcare organization
          </Caption>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Identity card preview */}
        <View
          style={{
            backgroundColor: "#EFF6FF",
            borderRadius: 16,
            padding: 18,
            marginBottom: 24,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            borderWidth: 1.5,
            borderColor: "#BFDBFE",
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: "#DBEAFE",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 color="#2563EB" size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <TypographyText
              style={{
                color: orgName.trim() ? "#111827" : "#9CA3AF",
                fontSize: 17,
                fontWeight: "700",
              }}
            >
              {orgName.trim() || "Your Organization Name"}
            </TypographyText>
            <Caption style={{ color: "#2563EB", marginTop: 2 }}>
              {ORG_TYPES.find((t) => t.value === orgType)?.label ?? "Clinic"} ·
              Starter Plan
            </Caption>
          </View>
        </View>

        {/* Organization Name */}
        <FieldLabel label="Organization Name" theme={theme} />
        <View
          style={{
            backgroundColor: theme.colors.background.secondary,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            marginBottom: 24,
          }}
        >
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={80}
            onChangeText={setOrgName}
            placeholder="e.g. Sunrise Health Clinic"
            placeholderTextColor={theme.colors.text.secondary}
            style={{
              color: theme.colors.text.primary,
              fontSize: 16,
              fontWeight: "500",
            }}
            value={orgName}
          />
        </View>

        {/* Organization Type */}
        <FieldLabel label="Organization Type" theme={theme} />
        <View style={{ marginBottom: 24 }}>
          {ORG_TYPES.map((type) => {
            const isSelected = orgType === type.value;
            return (
              <TouchableOpacity
                key={type.value}
                onPress={() => setOrgType(type.value)}
                style={{
                  backgroundColor: isSelected
                    ? "#EFF6FF"
                    : theme.colors.background.secondary,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderWidth: isSelected ? 1.5 : 0,
                  borderColor: isSelected ? "#BFDBFE" : "transparent",
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: isSelected ? "#2563EB" : "#D1D5DB",
                    backgroundColor: isSelected ? "#2563EB" : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isSelected && (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "#FFF",
                      }}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <TypographyText
                    style={{
                      color: theme.colors.text.primary,
                      fontSize: 15,
                      fontWeight: isSelected ? "600" : "400",
                    }}
                  >
                    {type.label}
                  </TypographyText>
                  <Caption
                    style={{ color: theme.colors.text.secondary, marginTop: 2 }}
                  >
                    {type.description}
                  </Caption>
                </View>
                {isSelected && <ChevronRight color="#2563EB" size={16} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Data Region */}
        <FieldLabel label="Data Region" theme={theme} />
        <View
          style={{
            backgroundColor: theme.colors.background.secondary,
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 28,
          }}
        >
          {DATA_REGIONS.map((region, i) => {
            const isSelected = dataRegion === region.value;
            return (
              <TouchableOpacity
                key={region.value}
                onPress={() => setDataRegion(region.value)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: theme.colors.background.primary,
                  backgroundColor: isSelected ? "#EFF6FF" : "transparent",
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: isSelected ? "#2563EB" : "#D1D5DB",
                    backgroundColor: isSelected ? "#2563EB" : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  {isSelected && (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "#FFF",
                      }}
                    />
                  )}
                </View>
                <TypographyText
                  style={{
                    color: theme.colors.text.primary,
                    fontSize: 15,
                    fontWeight: isSelected ? "600" : "400",
                    flex: 1,
                  }}
                >
                  {region.label}
                </TypographyText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info note */}
        <View
          style={{
            backgroundColor: "#F0FDF4",
            borderRadius: 10,
            padding: 14,
            marginBottom: 24,
          }}
        >
          <Caption style={{ color: "#166534" }}>
            Your organization will start on the free Starter plan (up to 50
            patients, 5 team members). Upgrade to Growth or Enterprise from the
            Plan & Billing screen at any time.
          </Caption>
        </View>

        {/* Create button */}
        <TouchableOpacity
          disabled={!isValid || creating}
          onPress={handleCreate}
          style={{
            backgroundColor: "#2563EB",
            borderRadius: 14,
            padding: 18,
            alignItems: "center",
            opacity: !isValid || creating ? 0.5 : 1,
          }}
        >
          {creating ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <TypographyText
              style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}
            >
              Create Organization
            </TypographyText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </WavyBackground>
  );
}

/**
 * Org Profile Settings Screen
 *
 * Org admins edit organization identity: name, type, branding color,
 * timezone, and data residency region.
 *
 * Route: /(settings)/org/profile?orgId=<orgId>&orgName=<orgName>
 */

import { useLocalSearchParams, useNavigation } from "expo-router";
import { Building2, ChevronLeft, Clock, Globe, MapPin, Palette, Save } from "lucide-react-native";
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
import { organizationService } from "@/lib/services/organizationService";
import type { Organization, OrgType } from "@/types";
import { getTextStyle } from "@/utils/styles";

// ─── Constants ────────────────────────────────────────────────────────────────

const ORG_TYPES: Array<{ key: OrgType; label: string }> = [
  { key: "clinic", label: "Clinic" },
  { key: "hospital", label: "Hospital" },
  { key: "employer", label: "Employer" },
  { key: "insurer", label: "Insurer" },
  { key: "homecare", label: "Home Care" },
];

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const DATA_REGIONS: Array<{ key: "us" | "eu" | "uae"; label: string; description: string }> = [
  { key: "us", label: "United States", description: "HIPAA — AWS us-east-1" },
  { key: "eu", label: "European Union", description: "GDPR — AWS eu-west-1" },
  { key: "uae", label: "UAE / GCC", description: "PDPL — AWS me-south-1" },
];

/** null = no automatic archiving */
const RETENTION_OPTIONS: Array<{ years: number | null; label: string; description: string }> = [
  { years: null, label: "No Limit", description: "Keep data indefinitely (default)" },
  { years: 2, label: "2 Years", description: "Recommended for low-risk consumer apps" },
  { years: 5, label: "5 Years", description: "Typical clinical records minimum" },
  { years: 7, label: "7 Years", description: "Common HIPAA / EU GDPR standard" },
  { years: 10, label: "10 Years", description: "Long-term chronic disease management" },
];

const BRAND_COLORS = [
  { hex: "#2563EB", label: "Blue" },
  { hex: "#7C3AED", label: "Violet" },
  { hex: "#059669", label: "Emerald" },
  { hex: "#DC2626", label: "Red" },
  { hex: "#D97706", label: "Amber" },
  { hex: "#0D9488", label: "Teal" },
  { hex: "#DB2777", label: "Pink" },
  { hex: "#64748B", label: "Slate" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({
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
        { textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginTop: 20 },
      ]}
    >
      {label}
    </TypographyText>
  );
}

function SelectRow<T extends string>({
  options,
  value,
  onChange,
  theme,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: active ? theme.colors.primary.main : theme.colors.border.light,
              backgroundColor: active
                ? theme.colors.primary.main + "15"
                : theme.colors.background.secondary,
            }}
          >
            <Caption
              style={{
                color: active ? theme.colors.primary.main : theme.colors.text.secondary,
                fontWeight: active ? "600" : "400",
              }}
            >
              {opt.label}
            </Caption>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OrgProfileScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ orgId: string; orgName?: string }>();
  const orgId = params.orgId ?? "";
  const isRTL = i18n.language === "ar";

  const [org, setOrg] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<OrgType>("clinic");
  const [primaryColor, setPrimaryColor] = useState("#2563EB");
  const [timezone, setTimezone] = useState("UTC");
  const [dataRegion, setDataRegion] = useState<"us" | "eu" | "uae">("us");
  const [retentionYears, setRetentionYears] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const isMountedRef = useRef(true);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await organizationService.getOrganization(orgId);
      if (!isMountedRef.current) return;
      if (data) {
        setOrg(data);
        setName(data.name);
        setType(data.type);
        setPrimaryColor(data.settings.branding?.primaryColor ?? "#2563EB");
        setTimezone(data.settings.timezone ?? "UTC");
        setDataRegion(data.settings.dataRegion ?? "us");
        setRetentionYears(data.settings.retentionYears ?? null);
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to load organization.");
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  // Track changes
  useEffect(() => {
    if (!org) return;
    const changed =
      name !== org.name ||
      type !== org.type ||
      primaryColor !== (org.settings.branding?.primaryColor ?? "#2563EB") ||
      timezone !== (org.settings.timezone ?? "UTC") ||
      dataRegion !== (org.settings.dataRegion ?? "us") ||
      retentionYears !== (org.settings.retentionYears ?? null);
    setDirty(changed);
  }, [name, type, primaryColor, timezone, dataRegion, retentionYears, org]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Required", "Organization name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      await organizationService.updateOrganization(orgId, {
        name: trimmedName,
        type,
        settings: {
          ...(org?.settings ?? { language: "en", features: [], dataRegion: "us", timezone: "UTC" }),
          timezone,
          dataRegion,
          branding: {
            ...(org?.settings.branding ?? {}),
            primaryColor,
          },
          ...(retentionYears !== null
            ? { retentionYears }
            : { retentionYears: null }),
        },
      });
      setOrg((prev) =>
        prev
          ? {
              ...prev,
              name: trimmedName,
              type,
              settings: {
                ...prev.settings,
                timezone,
                dataRegion,
                branding: { ...prev.settings.branding, primaryColor },
              },
            }
          : prev
      );
      setDirty(false);
      Alert.alert("Saved", "Organization profile updated.");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 10,
    padding: 14,
    color: theme.colors.text.primary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
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
          style={getTextStyle(theme, "heading", "bold", theme.colors.text.primary)}
        >
          Organization Profile
        </TypographyText>
        <View style={{ flex: 1 }} />
        {dirty && !saving && (
          <View
            style={{
              backgroundColor: "#FEF3C7",
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Caption style={{ color: "#D97706", fontWeight: "600" }}>Unsaved</Caption>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator
          color={theme.colors.text.primary}
          style={{ marginTop: 48 }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Identity card */}
          <View
            style={{
              backgroundColor: primaryColor + "15",
              borderRadius: 14,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              marginBottom: 4,
              borderWidth: 1.5,
              borderColor: primaryColor + "30",
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: primaryColor + "25",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={24} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <TypographyText
                style={{ color: theme.colors.text.primary, fontSize: 16, fontWeight: "700" }}
                numberOfLines={1}
              >
                {name || "Organization Name"}
              </TypographyText>
              <Caption style={{ color: theme.colors.text.secondary }}>
                {org?.plan ?? "starter"} plan · {org?.createdAt ? formatDate(org.createdAt) : ""}
              </Caption>
            </View>
          </View>

          {/* Name */}
          <SectionLabel label="Organization Name" theme={theme} />
          <TextInput
            style={inputStyle}
            value={name}
            onChangeText={setName}
            placeholder="e.g. City General Clinic"
            placeholderTextColor={theme.colors.text.secondary}
          />

          {/* Type */}
          <SectionLabel label="Organization Type" theme={theme} />
          <SelectRow
            options={ORG_TYPES}
            value={type}
            onChange={setType}
            theme={theme}
          />

          {/* Brand color */}
          <SectionLabel label="Brand Color" theme={theme} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Palette size={16} color={theme.colors.text.secondary} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {BRAND_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.hex}
                  onPress={() => setPrimaryColor(c.hex)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: c.hex,
                    borderWidth: primaryColor === c.hex ? 3 : 0,
                    borderColor: "#FFF",
                    shadowColor: c.hex,
                    shadowOpacity: primaryColor === c.hex ? 0.5 : 0,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: primaryColor === c.hex ? 4 : 0,
                  }}
                />
              ))}
            </View>
          </View>

          {/* Timezone */}
          <SectionLabel label="Timezone" theme={theme} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Globe size={14} color={theme.colors.text.secondary} />
            <Caption style={{ color: theme.colors.text.secondary }}>
              Used for scheduled reports and alert windows
            </Caption>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 4 }}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              {TIMEZONES.map((tz) => (
                <TouchableOpacity
                  key={tz}
                  onPress={() => setTimezone(tz)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor:
                      timezone === tz
                        ? theme.colors.primary.main
                        : theme.colors.border.light,
                    backgroundColor:
                      timezone === tz
                        ? theme.colors.primary.main + "15"
                        : theme.colors.background.secondary,
                  }}
                >
                  <Caption
                    style={{
                      color:
                        timezone === tz
                          ? theme.colors.primary.main
                          : theme.colors.text.secondary,
                      fontWeight: timezone === tz ? "600" : "400",
                    }}
                  >
                    {tz}
                  </Caption>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Data region */}
          <SectionLabel label="Data Residency Region" theme={theme} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <MapPin size={14} color={theme.colors.text.secondary} />
            <Caption style={{ color: theme.colors.text.secondary }}>
              Determines where patient data is stored. Contact support to migrate.
            </Caption>
          </View>
          {DATA_REGIONS.map((r) => {
            const active = dataRegion === r.key;
            return (
              <TouchableOpacity
                key={r.key}
                onPress={() => setDataRegion(r.key)}
                style={{
                  backgroundColor: active
                    ? theme.colors.primary.main + "12"
                    : theme.colors.background.secondary,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderWidth: 1.5,
                  borderColor: active
                    ? theme.colors.primary.main
                    : "transparent",
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: active
                      ? theme.colors.primary.main
                      : theme.colors.text.secondary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {active && (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: theme.colors.primary.main,
                      }}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <TypographyText
                    style={{
                      color: theme.colors.text.primary,
                      fontSize: 14,
                      fontWeight: active ? "700" : "500",
                    }}
                  >
                    {r.label}
                  </TypographyText>
                  <Caption style={{ color: theme.colors.text.secondary }}>
                    {r.description}
                  </Caption>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Data Retention */}
          <SectionLabel label="Data Retention Policy" theme={theme} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Clock size={14} color={theme.colors.text.secondary} />
            <Caption style={{ color: theme.colors.text.secondary, flex: 1 }}>
              Health records older than this threshold are archived automatically each Saturday.
              GDPR / HIPAA compliance may require a specific policy.
            </Caption>
          </View>
          {RETENTION_OPTIONS.map((opt) => {
            const active = retentionYears === opt.years;
            return (
              <TouchableOpacity
                key={String(opt.years)}
                onPress={() => setRetentionYears(opt.years)}
                style={{
                  backgroundColor: active
                    ? theme.colors.primary.main + "12"
                    : theme.colors.background.secondary,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderWidth: 1.5,
                  borderColor: active ? theme.colors.primary.main : "transparent",
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: active
                      ? theme.colors.primary.main
                      : theme.colors.text.secondary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {active && (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: theme.colors.primary.main,
                      }}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <TypographyText
                    style={{
                      color: theme.colors.text.primary,
                      fontSize: 14,
                      fontWeight: active ? "700" : "500",
                    }}
                  >
                    {opt.label}
                  </TypographyText>
                  <Caption style={{ color: theme.colors.text.secondary }}>
                    {opt.description}
                  </Caption>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Org ID (read-only) */}
          <SectionLabel label="Organization ID" theme={theme} />
          <View
            style={{
              backgroundColor: theme.colors.background.secondary,
              borderRadius: 10,
              padding: 12,
              marginBottom: 24,
            }}
          >
            <Caption
              style={{ color: theme.colors.text.secondary, fontFamily: "monospace" }}
              selectable
            >
              {orgId}
            </Caption>
          </View>

          {/* Save button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !dirty}
            style={{
              backgroundColor: dirty ? "#6366F1" : theme.colors.background.secondary,
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator color={dirty ? "#FFF" : theme.colors.text.secondary} />
            ) : (
              <>
                <Save
                  size={16}
                  color={dirty ? "#FFF" : theme.colors.text.secondary}
                />
                <TypographyText
                  style={{
                    color: dirty ? "#FFF" : theme.colors.text.secondary,
                    fontWeight: "600",
                    fontSize: 15,
                  }}
                >
                  {dirty ? "Save Changes" : "No Changes"}
                </TypographyText>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </WavyBackground>
  );
}

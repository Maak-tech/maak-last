/**
 * FHIR Integration Screen
 *
 * Shows org admins and tech leads everything needed to connect Maak to
 * an EHR system (Epic, Cerner, Meditech) via FHIR R4.
 *
 * Covers:
 *   - Base URL + copy-to-clipboard
 *   - SMART on FHIR discovery endpoint
 *   - Authentication (API key header)
 *   - All supported FHIR R4 resource endpoints
 *   - LOINC code reference for vitals
 *   - Step-by-step Epic App Orchard / Cerner Code connection guide
 *
 * Route: /(settings)/org/fhir?orgId=<orgId>&orgName=<orgName>
 */

import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Code2,
  Copy,
  Link,
  Lock,
  Shield,
  Zap,
} from "lucide-react-native";
import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, TouchableOpacity, View } from "react-native";
import {
  Caption,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import WavyBackground from "@/components/figma/WavyBackground";
import { useTheme } from "@/contexts/ThemeContext";
import { getTextStyle } from "@/utils/styles";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIREBASE_PROJECT = "maak-5caad";
// Firebase Hosting rewrites unify FHIR + OAuth + REST under one domain:
//   /fhir/**                        → fhirApi Cloud Function
//   /.well-known/smart-configuration → fhirApi Cloud Function
//   /auth/**                        → smartAuth Cloud Function
//   /.well-known/jwks.json          → smartAuth Cloud Function
const HOSTING_BASE = `https://${FIREBASE_PROJECT}.web.app`;
const FHIR_BASE = HOSTING_BASE;
const AUTH_BASE = HOSTING_BASE;

const SMART_OAUTH_ENDPOINTS = [
  {
    label: "Authorization Endpoint",
    value: `${AUTH_BASE}/auth/authorize`,
  },
  {
    label: "Token Endpoint",
    value: `${AUTH_BASE}/auth/token`,
  },
  {
    label: "Token Introspection (RFC 7662)",
    value: `${AUTH_BASE}/auth/token/introspect`,
  },
  {
    label: "JWK Set — Public Key (RFC 7517)",
    value: `${AUTH_BASE}/.well-known/jwks.json`,
  },
  {
    label: "Client Registration (requires API key)",
    value: `${AUTH_BASE}/auth/register`,
  },
];

const FHIR_ENDPOINTS = [
  {
    method: "GET",
    path: "/.well-known/smart-configuration",
    description: "SMART on FHIR discovery (no auth required)",
    auth: false,
  },
  {
    method: "GET",
    path: "/fhir/r4/Patient/:id",
    description: "Patient demographics and profile",
    auth: true,
  },
  {
    method: "GET",
    path: "/fhir/r4/Observation?patient=:id",
    description: "Vital signs — add &category=vital-signs&date=ge2024-01-01",
    auth: true,
  },
  {
    method: "GET",
    path: "/fhir/r4/MedicationRequest?patient=:id",
    description: "Active medication requests — add &status=active",
    auth: true,
  },
  {
    method: "GET",
    path: "/fhir/r4/Bundle?patient=:id",
    description: "Full patient summary bundle (all resources)",
    auth: true,
  },
  {
    method: "POST",
    path: "/fhir/r4/Observation",
    description: "Ingest vitals from clinic bedside device",
    auth: true,
  },
];

const LOINC_CODES = [
  { code: "8867-4", display: "Heart Rate", unit: "bpm" },
  { code: "59408-5", display: "Oxygen Saturation (SpO₂)", unit: "%" },
  { code: "8480-6", display: "Systolic Blood Pressure", unit: "mmHg" },
  { code: "8462-4", display: "Diastolic Blood Pressure", unit: "mmHg" },
  { code: "8310-5", display: "Body Temperature", unit: "°C" },
  { code: "9279-1", display: "Respiratory Rate", unit: "/min" },
  { code: "29463-7", display: "Body Weight", unit: "kg" },
  { code: "8302-2", display: "Body Height", unit: "cm" },
  { code: "2339-0", display: "Blood Glucose", unit: "mg/dL" },
  { code: "55284-4", display: "Blood Pressure Panel", unit: "—" },
];

const EPIC_STEPS = [
  "Open Epic App Orchard → Create App → Select 'SMART on FHIR'",
  "Set Launch URL to your coordinator dashboard URL",
  "Add Redirect URI: maakhealth://auth/fhir-callback",
  `Set FHIR Base URL to: ${FHIR_BASE}`,
  "Select scopes: patient/*.read, user/*.read, launch",
  "Copy Client ID from App Orchard → add to Maak API Keys screen",
  "Test with Epic sandbox: https://fhir.epic.com/interconnect-fhir-oauth/",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyableField({
  label,
  value,
  theme,
  mono = true,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>["theme"];
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Caption style={{ color: theme.colors.text.secondary, marginBottom: 4 }}>
        {label}
      </Caption>
      <TouchableOpacity
        onPress={handleCopy}
        style={{
          backgroundColor: theme.colors.background.secondary,
          borderRadius: 10,
          padding: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <TypographyText
          numberOfLines={2}
          selectable
          style={{
            flex: 1,
            color: theme.colors.text.primary,
            fontSize: 12,
            fontFamily: mono ? "monospace" : undefined,
          }}
        >
          {value}
        </TypographyText>
        {copied ? (
          <Check color="#10B981" size={14} />
        ) : (
          <Copy color={theme.colors.text.secondary} size={14} />
        )}
      </TouchableOpacity>
    </View>
  );
}

function SectionHeader({
  label,
  icon,
  theme,
}: {
  label: string;
  icon: React.ReactNode;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 24,
        marginBottom: 12,
      }}
    >
      {icon}
      <TypographyText
        style={getTextStyle(
          theme,
          "subheading",
          "bold",
          theme.colors.text.primary
        )}
      >
        {label}
      </TypographyText>
    </View>
  );
}

function CollapsibleSection({
  title,
  children,
  theme,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  theme: ReturnType<typeof useTheme>["theme"];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View
      style={{
        backgroundColor: theme.colors.background.secondary,
        borderRadius: 12,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 14,
          justifyContent: "space-between",
        }}
      >
        <TypographyText
          style={{
            color: theme.colors.text.primary,
            fontSize: 14,
            fontWeight: "600",
          }}
        >
          {title}
        </TypographyText>
        {open ? (
          <ChevronUp color={theme.colors.text.secondary} size={16} />
        ) : (
          <ChevronDown color={theme.colors.text.secondary} size={16} />
        )}
      </TouchableOpacity>
      {open && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          {children}
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FhirIntegrationScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ orgId: string; orgName?: string }>();
  const orgId = params.orgId ?? "";
  const isRTL = i18n.language === "ar";

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const methodColor = (method: string) =>
    method === "GET" ? "#2563EB" : method === "POST" ? "#059669" : "#6366F1";

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
        <View style={{ flex: 1 }}>
          <TypographyText
            style={getTextStyle(
              theme,
              "heading",
              "bold",
              theme.colors.text.primary
            )}
          >
            FHIR R4 Integration
          </TypographyText>
          <Caption style={{ color: theme.colors.text.secondary }}>
            Connect to Epic, Cerner, and SMART-enabled EHRs
          </Caption>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status badge */}
        <View
          style={{
            backgroundColor: "#ECFDF5",
            borderRadius: 12,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <Zap color="#059669" size={18} />
          <Caption style={{ color: "#065F46", flex: 1 }}>
            FHIR R4 + SMART on FHIR OAuth 2.0 is live. Supports
            authorization_code (PKCE S256), client_credentials, and
            refresh_token flows. RS256-signed JWTs. Compatible with Epic App
            Orchard and Cerner Code.
          </Caption>
        </View>

        {/* Base URL */}
        <SectionHeader
          icon={<Link color={theme.colors.text.primary} size={18} />}
          label="Endpoint URLs"
          theme={theme}
        />

        <CopyableField
          label="FHIR R4 Base URL"
          theme={theme}
          value={FHIR_BASE}
        />
        <CopyableField
          label="SMART on FHIR Discovery"
          theme={theme}
          value={`${FHIR_BASE}/.well-known/smart-configuration`}
        />

        {/* Authentication */}
        <SectionHeader
          icon={<Shield color={theme.colors.text.primary} size={18} />}
          label="Authentication"
          theme={theme}
        />
        <View
          style={{
            backgroundColor: theme.colors.background.secondary,
            borderRadius: 12,
            padding: 14,
            marginBottom: 8,
          }}
        >
          <Caption
            style={{ color: theme.colors.text.secondary, marginBottom: 8 }}
          >
            All FHIR endpoints (except SMART discovery) require an API key in
            the request header:
          </Caption>
          <View
            style={{
              backgroundColor: "#111827",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <Caption style={{ color: "#86EFAC", fontFamily: "monospace" }}>
              X-API-Key: {"<"}your-api-key{">"}
            </Caption>
          </View>
          <Caption style={{ color: theme.colors.text.secondary, marginTop: 8 }}>
            Generate an API key in the API Keys screen. Keys can be scoped to
            read-only, write, or admin permissions.
          </Caption>
        </View>

        {/* SMART OAuth 2.0 */}
        <SectionHeader
          icon={<Lock color={theme.colors.text.primary} size={18} />}
          label="SMART on FHIR OAuth 2.0"
          theme={theme}
        />
        <View
          style={{
            backgroundColor: theme.colors.background.secondary,
            borderRadius: 12,
            padding: 14,
            marginBottom: 10,
          }}
        >
          <Caption
            style={{ color: theme.colors.text.secondary, marginBottom: 12 }}
          >
            Full OAuth 2.0 authorization server. Supports PKCE S256
            (authorization_code), client_credentials, and refresh_token grant
            types. All access tokens are RS256-signed JWTs with a 1-hour TTL.
          </Caption>
          {SMART_OAUTH_ENDPOINTS.map((ep) => (
            <CopyableField
              key={ep.label}
              label={ep.label}
              theme={theme}
              value={ep.value}
            />
          ))}
        </View>

        <CollapsibleSection
          theme={theme}
          title="Register an EHR app (POST /auth/register)"
        >
          <Caption
            style={{ color: theme.colors.text.secondary, marginBottom: 10 }}
          >
            Before your EHR can launch SMART flows, register its client ID with
            Maak. Use your organization API key to authenticate this call:
          </Caption>
          <View
            style={{
              backgroundColor: "#111827",
              borderRadius: 8,
              padding: 12,
              marginBottom: 10,
            }}
          >
            <Caption
              style={{
                color: "#86EFAC",
                fontFamily: "monospace",
                lineHeight: 18,
              }}
            >
              {`curl -X POST ${AUTH_BASE}/auth/register \\
  -H "X-API-Key: <your-api-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "clientName": "Epic App Orchard",
    "redirectUris": ["https://your-ehr/callback"],
    "grantTypes": ["authorization_code"],
    "scopes": ["patient/*.read","openid"],
    "requireUserConsent": true
  }'`}
            </Caption>
          </View>
          <Caption
            style={{ color: theme.colors.text.secondary, marginBottom: 6 }}
          >
            The response returns a{" "}
            <Caption
              style={{
                fontFamily: "monospace",
                color: theme.colors.text.primary,
              }}
            >
              clientId
            </Caption>{" "}
            and a one-time{" "}
            <Caption
              style={{
                fontFamily: "monospace",
                color: theme.colors.text.primary,
              }}
            >
              clientSecret
            </Caption>
            . Store the secret immediately — it is not retrievable after this
            call.
          </Caption>
          <Caption style={{ color: theme.colors.text.secondary }}>
            For{" "}
            <Caption
              style={{
                fontFamily: "monospace",
                color: theme.colors.text.primary,
              }}
            >
              client_credentials
            </Caption>{" "}
            (backend M2M) flows, omit redirectUris and set{" "}
            <Caption
              style={{
                fontFamily: "monospace",
                color: theme.colors.text.primary,
              }}
            >
              grantTypes: ["client_credentials"]
            </Caption>
            .
          </Caption>
        </CollapsibleSection>

        {/* FHIR Endpoints */}
        <SectionHeader
          icon={<Code2 color={theme.colors.text.primary} size={18} />}
          label="FHIR R4 Resources"
          theme={theme}
        />

        {FHIR_ENDPOINTS.map((ep, i) => (
          <View
            key={i}
            style={{
              backgroundColor: theme.colors.background.secondary,
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <View
                style={{
                  backgroundColor: methodColor(ep.method) + "20",
                  borderRadius: 6,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                }}
              >
                <Caption
                  style={{
                    color: methodColor(ep.method),
                    fontWeight: "700",
                    fontFamily: "monospace",
                  }}
                >
                  {ep.method}
                </Caption>
              </View>
              {!ep.auth && (
                <View
                  style={{
                    backgroundColor: "#F0FDF4",
                    borderRadius: 6,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Caption style={{ color: "#059669", fontWeight: "600" }}>
                    public
                  </Caption>
                </View>
              )}
            </View>
            <TypographyText
              style={{
                color: theme.colors.text.primary,
                fontSize: 12,
                fontFamily: "monospace",
                marginBottom: 4,
              }}
            >
              {ep.path}
            </TypographyText>
            <Caption style={{ color: theme.colors.text.secondary }}>
              {ep.description}
            </Caption>
          </View>
        ))}

        {/* LOINC codes */}
        <SectionHeader
          icon={<BookOpen color={theme.colors.text.primary} size={18} />}
          label="LOINC Code Reference"
          theme={theme}
        />
        <CollapsibleSection theme={theme} title="Vital Signs LOINC Codes">
          {LOINC_CODES.map((loinc) => (
            <View
              key={loinc.code}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border.light,
              }}
            >
              <Caption
                style={{ color: "#2563EB", fontFamily: "monospace", width: 70 }}
              >
                {loinc.code}
              </Caption>
              <Caption style={{ flex: 1, color: theme.colors.text.primary }}>
                {loinc.display}
              </Caption>
              <Caption
                style={{
                  color: theme.colors.text.secondary,
                  width: 56,
                  textAlign: "right",
                }}
              >
                {loinc.unit}
              </Caption>
            </View>
          ))}
        </CollapsibleSection>

        {/* Epic guide */}
        <SectionHeader
          icon={<BookOpen color={theme.colors.text.primary} size={18} />}
          label="Epic App Orchard Setup"
          theme={theme}
        />
        <CollapsibleSection
          theme={theme}
          title="Step-by-step Epic connection guide"
        >
          {EPIC_STEPS.map((step, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: "#6366F1",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                <Caption style={{ color: "#FFF", fontWeight: "700" }}>
                  {i + 1}
                </Caption>
              </View>
              <Caption
                style={{
                  color: theme.colors.text.primary,
                  flex: 1,
                  lineHeight: 18,
                }}
              >
                {step}
              </Caption>
            </View>
          ))}
        </CollapsibleSection>

        {/* Cerner note */}
        <CollapsibleSection
          theme={theme}
          title="Cerner Code / Oracle Health connection"
        >
          <Caption
            style={{ color: theme.colors.text.secondary, marginBottom: 8 }}
          >
            Cerner uses the same SMART on FHIR 2.0 standard. Follow the same
            steps above but use the Cerner Code App Gallery instead of Epic App
            Orchard.
          </Caption>
          <CopyableField
            label="Cerner SMART Launch URL"
            mono
            theme={theme}
            value={`${FHIR_BASE}/.well-known/smart-configuration`}
          />
          <Caption style={{ color: theme.colors.text.secondary }}>
            Cerner requires a Vendor Access Agreement (VAA) before production
            launch. Use the sandbox environment for testing:
            open.epic.com/Argonaut/R4.
          </Caption>
        </CollapsibleSection>

        {/* Footer info */}
        <View
          style={{
            backgroundColor: "#EFF6FF",
            borderRadius: 10,
            padding: 14,
            marginTop: 16,
          }}
        >
          <Caption style={{ color: "#1D4ED8" }}>
            FHIR R4 is the HL7 standard for healthcare data exchange. Your API
            key scopes control which patient data is accessible. Patient consent
            is enforced on every request — revoked consents block all FHIR
            access immediately.
          </Caption>
        </View>
      </ScrollView>
    </WavyBackground>
  );
}

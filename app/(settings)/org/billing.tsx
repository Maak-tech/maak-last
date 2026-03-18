/**
 * Org Billing & Plan Screen
 *
 * Shows the org's current plan tier + usage (from Firestore),
 * RevenueCat subscription status, available packages to purchase,
 * and a plan feature comparison table.
 *
 * Route: /(settings)/org/billing?orgId=<orgId>&orgName=<orgName>
 */

import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  RefreshCw,
  RotateCcw,
  XCircle,
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
  Alert,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import {
  Caption,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import WavyBackground from "@/components/figma/WavyBackground";
import { useTheme } from "@/contexts/ThemeContext";
import { organizationService } from "@/lib/services/organizationService";
import {
  revenueCatService,
  type SubscriptionStatus,
} from "@/lib/services/revenueCatService";
import type { Organization, OrgPlan } from "@/types";
import { getTextStyle } from "@/utils/styles";

// ─── Plan Config ──────────────────────────────────────────────────────────────

type PlanFeature = {
  label: string;
  starter: boolean | string;
  growth: boolean | string;
  enterprise: boolean | string;
};

const PLAN_FEATURES: PlanFeature[] = [
  {
    label: "Enrolled patients",
    starter: "Up to 50",
    growth: "Up to 500",
    enterprise: "Unlimited",
  },
  {
    label: "Team seats",
    starter: "Up to 5",
    growth: "Up to 25",
    enterprise: "Unlimited",
  },
  {
    label: "Population dashboard",
    starter: true,
    growth: true,
    enterprise: true,
  },
  { label: "Care pathways", starter: false, growth: true, enterprise: true },
  { label: "Task management", starter: false, growth: true, enterprise: true },
  {
    label: "AI agent cycle (15 min)",
    starter: false,
    growth: true,
    enterprise: true,
  },
  {
    label: "Outbound webhooks",
    starter: false,
    growth: true,
    enterprise: true,
  },
  { label: "REST API access", starter: false, growth: true, enterprise: true },
  {
    label: "FHIR R4 endpoints",
    starter: false,
    growth: false,
    enterprise: true,
  },
  {
    label: "SMART on FHIR (Epic/Cerner)",
    starter: false,
    growth: false,
    enterprise: true,
  },
  {
    label: "Weekly email digests",
    starter: false,
    growth: true,
    enterprise: true,
  },
  {
    label: "HIPAA audit trail",
    starter: false,
    growth: true,
    enterprise: true,
  },
  {
    label: "Data residency (EU/UAE)",
    starter: false,
    growth: false,
    enterprise: true,
  },
  {
    label: "SLA (99.9% uptime)",
    starter: false,
    growth: false,
    enterprise: true,
  },
  {
    label: "Dedicated support",
    starter: false,
    growth: false,
    enterprise: true,
  },
];

const PLAN_COLORS: Record<
  OrgPlan,
  { bg: string; text: string; border: string }
> = {
  starter: { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" },
  growth: { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  enterprise: { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function UsageBar({
  label,
  used,
  limit,
  color,
  theme,
}: {
  label: string;
  used: number;
  limit: number | null;
  color: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const pct = limit ? Math.min((used / limit) * 100, 100) : 0;
  const isWarning = limit ? pct >= 80 : false;
  const barColor = isWarning ? "#F97316" : color;

  return (
    <View style={{ marginBottom: 14 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <Caption
          style={{ color: theme.colors.text.primary, fontWeight: "600" }}
        >
          {label}
        </Caption>
        <Caption
          style={{ color: isWarning ? "#F97316" : theme.colors.text.secondary }}
        >
          {used} {limit ? `/ ${limit}` : "enrolled"}
        </Caption>
      </View>
      {limit ? (
        <View
          style={{
            height: 6,
            backgroundColor: theme.colors.background.primary,
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${pct}%`,
              height: "100%",
              backgroundColor: barColor,
              borderRadius: 3,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

function FeatureCell({
  value,
  isHighlighted,
}: {
  value: boolean | string;
  isHighlighted: boolean;
}) {
  if (typeof value === "string") {
    return (
      <TypographyText
        style={{
          fontSize: 11,
          color: isHighlighted ? "#2563EB" : "#374151",
          textAlign: "center",
          fontWeight: isHighlighted ? "600" : "400",
        }}
      >
        {value}
      </TypographyText>
    );
  }
  return value ? (
    <CheckCircle2 color={isHighlighted ? "#2563EB" : "#10B981"} size={14} />
  ) : (
    <XCircle color="#D1D5DB" size={14} />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BillingScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ orgId: string; orgName?: string }>();
  const orgId = params.orgId ?? "";
  const isRTL = i18n.language === "ar";

  const [org, setOrg] = useState<Organization | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
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

      try {
        const [orgResult, statusResult, offeringsResult] =
          await Promise.allSettled([
            organizationService.getOrganization(orgId),
            revenueCatService.getSubscriptionStatus(),
            revenueCatService.getOfferings(),
          ] as const);

        if (!isMountedRef.current) return;

        if (orgResult.status === "fulfilled") setOrg(orgResult.value);
        if (statusResult.status === "fulfilled")
          setSubscriptionStatus(statusResult.value);
        if (offeringsResult.status === "fulfilled" && offeringsResult.value) {
          setPackages(offeringsResult.value.availablePackages);
        }
      } catch (err) {
        Alert.alert(
          "Error",
          err instanceof Error ? err.message : "Failed to load."
        );
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

  const handlePurchase = async (pkg: PurchasesPackage) => {
    setPurchasing(pkg.product.identifier);
    try {
      await revenueCatService.purchasePackage(pkg);
      const updated = await revenueCatService.getSubscriptionStatus();
      if (isMountedRef.current) setSubscriptionStatus(updated);
      Alert.alert("Success", "Your subscription is now active.");
    } catch (err) {
      if (err instanceof Error && err.message !== "Purchase was cancelled") {
        Alert.alert(
          "Purchase Failed",
          err.message || "Unable to complete purchase."
        );
      }
    } finally {
      if (isMountedRef.current) setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await revenueCatService.restorePurchases();
      const updated = await revenueCatService.getSubscriptionStatus();
      if (isMountedRef.current) setSubscriptionStatus(updated);
      Alert.alert("Restored", "Your purchases have been restored.");
    } catch (err) {
      Alert.alert(
        "Restore Failed",
        err instanceof Error ? err.message : "Unable to restore purchases."
      );
    } finally {
      if (isMountedRef.current) setRestoring(false);
    }
  };

  const plan: OrgPlan = org?.plan ?? "starter";
  const planColor = PLAN_COLORS[plan];
  const seatCount = org?.billing?.seatCount ?? 0;
  const patientCount = org?.billing?.patientCount ?? 0;
  const seatLimit: number | null =
    plan === "starter" ? 5 : plan === "growth" ? 25 : null;
  const patientLimit: number | null =
    plan === "starter" ? 50 : plan === "growth" ? 500 : null;

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
          Plan & Billing
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

      {loading ? (
        <ActivityIndicator
          color={theme.colors.text.primary}
          style={{ marginTop: 48 }}
        />
      ) : (
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
          {/* ── Current Plan Card ─────────────────────────────────────────── */}
          <View
            style={{
              backgroundColor: planColor.bg,
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1.5,
              borderColor: planColor.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <CreditCard color={planColor.text} size={22} />
                <TypographyText
                  style={{
                    color: planColor.text,
                    fontSize: 18,
                    fontWeight: "800",
                    textTransform: "uppercase",
                  }}
                >
                  {plan}
                </TypographyText>
              </View>
            </View>

            <UsageBar
              color={planColor.text}
              label="Team Seats"
              limit={seatLimit}
              theme={theme}
              used={seatCount}
            />
            <UsageBar
              color={planColor.text}
              label="Enrolled Patients"
              limit={patientLimit}
              theme={theme}
              used={patientCount}
            />

            {(seatLimit && seatCount >= seatLimit * 0.8) ||
            (patientLimit && patientCount >= patientLimit * 0.8) ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: "#FEF3C7",
                  borderRadius: 8,
                  padding: 10,
                  marginTop: 4,
                }}
              >
                <AlertCircle color="#D97706" size={14} />
                <Caption style={{ color: "#92400E", flex: 1 }}>
                  Approaching plan limits. Upgrade to avoid service
                  interruption.
                </Caption>
              </View>
            ) : null}
          </View>

          {/* ── RevenueCat Subscription Status ────────────────────────────── */}
          <TypographyText
            style={[
              getTextStyle(
                theme,
                "caption",
                "semibold",
                theme.colors.text.secondary
              ),
              {
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 12,
              },
            ]}
          >
            Subscription
          </TypographyText>

          <View
            style={{
              backgroundColor: theme.colors.background.secondary,
              borderRadius: 14,
              padding: 16,
              marginBottom: 16,
            }}
          >
            {subscriptionStatus?.isActive ? (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: "#10B981",
                    }}
                  />
                  <TypographyText
                    style={{
                      color: "#10B981",
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    Active
                  </TypographyText>
                  <Caption style={{ color: theme.colors.text.secondary }}>
                    ·{" "}
                    {subscriptionStatus.subscriptionPeriod === "yearly"
                      ? "Annual"
                      : "Monthly"}{" "}
                    plan
                  </Caption>
                </View>
                {subscriptionStatus.expirationDate && (
                  <Caption style={{ color: theme.colors.text.secondary }}>
                    Renews{" "}
                    {subscriptionStatus.expirationDate.toLocaleDateString(
                      undefined,
                      { month: "long", day: "numeric", year: "numeric" }
                    )}
                  </Caption>
                )}
              </>
            ) : (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#9CA3AF",
                  }}
                />
                <Caption style={{ color: theme.colors.text.secondary }}>
                  No active subscription
                </Caption>
              </View>
            )}
          </View>

          {/* ── Available Packages ────────────────────────────────────────── */}
          {packages.length > 0 && (
            <>
              <TypographyText
                style={[
                  getTextStyle(
                    theme,
                    "caption",
                    "semibold",
                    theme.colors.text.secondary
                  ),
                  {
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 12,
                  },
                ]}
              >
                {subscriptionStatus?.isActive ? "Change Plan" : "Choose a Plan"}
              </TypographyText>

              {packages.map((pkg) => {
                const isCurrentProduct =
                  subscriptionStatus?.productIdentifier ===
                  pkg.product.identifier;
                const isBuying = purchasing === pkg.product.identifier;

                return (
                  <TouchableOpacity
                    disabled={isCurrentProduct || purchasing !== null}
                    key={pkg.product.identifier}
                    onPress={() => handlePurchase(pkg)}
                    style={{
                      backgroundColor: isCurrentProduct
                        ? "#EFF6FF"
                        : theme.colors.background.secondary,
                      borderRadius: 14,
                      padding: 16,
                      marginBottom: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      borderWidth: isCurrentProduct ? 1.5 : 0,
                      borderColor: isCurrentProduct ? "#BFDBFE" : "transparent",
                      opacity: purchasing !== null && !isBuying ? 0.5 : 1,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        backgroundColor: isCurrentProduct
                          ? "#DBEAFE"
                          : "#EEF2FF",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Zap
                        color={isCurrentProduct ? "#2563EB" : "#6366F1"}
                        size={20}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TypographyText
                        style={{
                          color: theme.colors.text.primary,
                          fontSize: 15,
                          fontWeight: "600",
                        }}
                      >
                        {pkg.product.title || pkg.product.identifier}
                      </TypographyText>
                      <Caption
                        style={{
                          color: theme.colors.text.secondary,
                          marginTop: 2,
                        }}
                      >
                        {pkg.product.description || ""}
                      </Caption>
                    </View>
                    {isBuying ? (
                      <ActivityIndicator color="#6366F1" />
                    ) : isCurrentProduct ? (
                      <Caption
                        style={{
                          color: "#2563EB",
                          fontWeight: "600",
                          fontSize: 12,
                        }}
                      >
                        Current
                      </Caption>
                    ) : (
                      <View style={{ alignItems: "flex-end" }}>
                        <TypographyText
                          style={{
                            color: "#6366F1",
                            fontWeight: "700",
                            fontSize: 15,
                          }}
                        >
                          {pkg.product.priceString}
                        </TypographyText>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Upgrade CTA when no packages loaded and no active subscription */}
          {packages.length === 0 && !subscriptionStatus?.isActive && (
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Upgrade",
                  "Contact sales@nuralix.ai to discuss enterprise pricing."
                )
              }
           style={{
                backgroundColor: theme.colors.primary.main,
                borderRadius: 16,
                paddingVertical: 16,
                paddingHorizontal: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 16,
                shadowColor: theme.colors.primary.main,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
              }}
             >
              <Zap color="#FFF" size={18} />
              <TypographyText
                style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}
              >
                Upgrade Plan
              </TypographyText>
            </TouchableOpacity>
          )}

          {/* Restore Purchases */}
          <TouchableOpacity
            disabled={restoring}
            onPress={handleRestore}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 12,
              marginBottom: 24,
              opacity: restoring ? 0.5 : 1,
            }}
          >
            {restoring ? (
              <ActivityIndicator
                color={theme.colors.text.secondary}
                size="small"
              />
            ) : (
              <RotateCcw color={theme.colors.text.secondary} size={14} />
            )}
            <Caption style={{ color: theme.colors.text.secondary }}>
              Restore Purchases
            </Caption>
          </TouchableOpacity>

          {/* ── Plan Comparison Table ─────────────────────────────────────── */}
          <TypographyText
            style={[
              getTextStyle(
                theme,
                "caption",
                "semibold",
                theme.colors.text.secondary
              ),
              {
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 12,
              },
            ]}
          >
            Plan Comparison
          </TypographyText>

          {/* Table header */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: theme.colors.background.secondary,
              borderRadius: 10,
              padding: 10,
              marginBottom: 2,
            }}
          >
            <View style={{ flex: 2 }} />
            {(["starter", "growth", "enterprise"] as OrgPlan[]).map((p) => (
              <View
                key={p}
                style={{
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor:
                    plan === p ? PLAN_COLORS[p].bg : "transparent",
                }}
              >
                <Caption
                  style={{
                    color:
                      plan === p
                        ? PLAN_COLORS[p].text
                        : theme.colors.text.secondary,
                    fontWeight: plan === p ? "700" : "500",
                    textTransform: "uppercase",
                  }}
                >
                  {p}
                </Caption>
                {plan === p && (
                  <Caption style={{ color: PLAN_COLORS[p].text, fontSize: 9 }}>
                    current
                  </Caption>
                )}
              </View>
            ))}
          </View>

          {/* Table rows */}
          {PLAN_FEATURES.map((feature, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 10,
                paddingHorizontal: 10,
                backgroundColor:
                  i % 2 === 0
                    ? theme.colors.background.secondary
                    : "transparent",
                borderRadius: 6,
              }}
            >
              <Caption style={{ flex: 2, color: theme.colors.text.primary }}>
                {feature.label}
              </Caption>
              {(["starter", "growth", "enterprise"] as OrgPlan[]).map((p) => (
                <View key={p} style={{ flex: 1, alignItems: "center" }}>
                  <FeatureCell isHighlighted={plan === p} value={feature[p]} />
                </View>
              ))}
            </View>
          ))}

          {/* Contact note */}
          <View
            style={{
              backgroundColor: "#F0FDF4",
              borderRadius: 10,
              padding: 14,
              marginTop: 16,
            }}
          >
            <Caption style={{ color: "#166534" }}>
              Enterprise plans include custom patient limits, dedicated support,
              data residency options (EU/UAE), and FHIR R4 EHR integration.
              Contact sales@nuralix.ai for pricing.
            </Caption>
          </View>
        </ScrollView>
      )}
    </WavyBackground>
  );
}

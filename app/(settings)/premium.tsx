/**
 * Individual User Premium / Billing Screen
 *
 * Shows current plan + subscription status.
 * "Upgrade" / "Change Plan" opens the RevenueCatUI paywall modal.
 * Restore Purchases delegates to RevenueCat via the paywall.
 *
 * Route: /(settings)/premium
 */

import { useNavigation } from "expo-router";
import {
  Brain,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  FlaskConical,
  Heart,
  Sparkles,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from "lucide-react-native";
import type React from "react";
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
  Linking,
  Modal,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Caption,
  Heading,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import WavyBackground from "@/components/figma/WavyBackground";
import { RevenueCatPaywall } from "@/components/RevenueCatPaywall";
import { useTheme } from "@/contexts/ThemeContext";
import { useRevenueCat } from "@/hooks/useRevenueCat";
import { useSubscription } from "@/hooks/useSubscription";
import { paywallGuard } from "@/lib/utils/paywallGuard";
import { getTextStyle } from "@/utils/styles";

// ─── Plan comparison data ──────────────────────────────────────────────────────

type PlanCol = "free" | "individual" | "family";

type FeatureRow = {
  icon: React.ComponentType<{ size: number; color: string }>;
  labelEn: string;
  labelAr: string;
  free: boolean | string;
  individual: boolean | string;
  family: boolean | string;
};

const FEATURE_ROWS: FeatureRow[] = [
  {
    icon: Heart,
    labelEn: "Symptom & vital tracking",
    labelAr: "تتبع الأعراض والعلامات الحيوية",
    free: true,
    individual: true,
    family: true,
  },
  {
    icon: Heart,
    labelEn: "Medication tracking",
    labelAr: "تتبع الأدوية",
    free: true,
    individual: true,
    family: true,
  },
  {
    icon: Heart,
    labelEn: "Basic health reports",
    labelAr: "تقارير صحية أساسية",
    free: true,
    individual: true,
    family: true,
  },
  {
    icon: TrendingUp,
    labelEn: "Advanced vitals & PPG",
    labelAr: "العلامات الحيوية المتقدمة",
    free: false,
    individual: true,
    family: true,
  },
  {
    icon: Sparkles,
    labelEn: "Daily AI health briefing",
    labelAr: "ملخص صحي يومي بالذكاء الاصطناعي",
    free: false,
    individual: true,
    family: true,
  },
  {
    icon: TrendingUp,
    labelEn: "Predictive health score (7-day)",
    labelAr: "توقع نقاط الصحة (٧ أيام)",
    free: false,
    individual: true,
    family: true,
  },
  {
    icon: FlaskConical,
    labelEn: "Lab results intelligence",
    labelAr: "تحليل نتائج الفحوصات",
    free: false,
    individual: true,
    family: true,
  },
  {
    icon: Brain,
    labelEn: "Medication intelligence",
    labelAr: "ذكاء الأدوية",
    free: false,
    individual: true,
    family: true,
  },
  {
    icon: Sparkles,
    labelEn: "Health discoveries",
    labelAr: "الاكتشافات الصحية",
    free: false,
    individual: true,
    family: true,
  },
  {
    icon: Brain,
    labelEn: "Zeina AI assistant",
    labelAr: "مساعدة زينا الذكية",
    free: false,
    individual: true,
    family: true,
  },
  {
    icon: Heart,
    labelEn: "Data export (CSV/PDF)",
    labelAr: "تصدير البيانات",
    free: false,
    individual: true,
    family: true,
  },
  {
    icon: Users,
    labelEn: "Family members",
    labelAr: "أفراد العائلة",
    free: false,
    individual: false,
    family: true,
  },
  {
    icon: Users,
    labelEn: "Family health dashboard",
    labelAr: "لوحة صحة العائلة",
    free: false,
    individual: false,
    family: true,
  },
  {
    icon: Users,
    labelEn: "Family alerts & sharing",
    labelAr: "تنبيهات ومشاركة عائلية",
    free: false,
    individual: false,
    family: true,
  },
];

const PLAN_META: Record<
  PlanCol,
  {
    labelEn: string;
    labelAr: string;
    color: string;
    bg: string;
    border: string;
  }
> = {
  free: {
    labelEn: "Free",
    labelAr: "مجاني",
    color: "#6B7280",
    bg: "#F9FAFB",
    border: "#E5E7EB",
  },
  individual: {
    labelEn: "Individual",
    labelAr: "فردي",
    color: "#6366F1",
    bg: "#EEF2FF",
    border: "#C7D2FE",
  },
  family: {
    labelEn: "Family",
    labelAr: "عائلي",
    color: "#0D9488",
    bg: "#F0FDF9",
    border: "#99F6E4",
  },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return (
      <TypographyText
        style={{ fontSize: 11, color: "#374151", textAlign: "center" }}
      >
        {value}
      </TypographyText>
    );
  }
  return value ? (
    <CheckCircle2 color="#10B981" size={15} />
  ) : (
    <XCircle color="#D1D5DB" size={15} />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PremiumScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const isRTL = i18n.language === "ar";

  const {
    isPremium,
    isFamilyPlan,
    isIndividualPlan,
    subscriptionStatus,
    isLoading,
  } = useSubscription();
  const { refreshCustomerInfo } = useRevenueCat();

  const [showPaywall, setShowPaywall] = useState(false);
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

  const openPaywall = useCallback(() => {
    if (!paywallGuard.tryShowPaywall()) return;
    setShowPaywall(true);
  }, []);

  const closePaywall = useCallback(() => {
    paywallGuard.hidePaywall();
    setShowPaywall(false);
  }, []);

  const handlePurchaseComplete = useCallback(async () => {
    closePaywall();
    try {
      await refreshCustomerInfo();
    } catch {
      // Non-critical
    }
  }, [closePaywall, refreshCustomerInfo]);

  const currentPlan: PlanCol = isFamilyPlan
    ? "family"
    : isIndividualPlan
      ? "individual"
      : "free";
  const meta = PLAN_META[currentPlan];

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
        <Heading
          level={5}
          style={getTextStyle(
            theme,
            "heading",
            "bold",
            theme.colors.text.primary
          )}
        >
          {isRTL ? "اشتراكي" : "My Plan"}
        </Heading>
      </View>

      {isLoading ? (
        <ActivityIndicator
          color={theme.colors.primary.main}
          style={{ marginTop: 64 }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 56 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Current Plan Card ──────────────────────────────────────────── */}
          <View
            style={{
              backgroundColor: meta.bg,
              borderRadius: 18,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1.5,
              borderColor: meta.border,
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: meta.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CreditCard color={meta.color} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <TypographyText
                  style={{
                    color: meta.color,
                    fontWeight: "800",
                    fontSize: 18,
                    textTransform: "uppercase",
                  }}
                >
                  {isRTL ? meta.labelAr : meta.labelEn}
                </TypographyText>
                <Caption style={{ color: theme.colors.text.secondary }}>
                  {isRTL ? "خطتك الحالية" : "Your current plan"}
                </Caption>
              </View>
              {isPremium && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: "#D1FAE5",
                    borderRadius: 20,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: "#10B981",
                    }}
                  />
                  <Caption style={{ color: "#065F46", fontWeight: "700" }}>
                    {isRTL ? "نشط" : "Active"}
                  </Caption>
                </View>
              )}
            </View>

            {/* Renewal date */}
            {subscriptionStatus?.expirationDate && isPremium && (
              <View
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: theme.colors.background.secondary,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  marginBottom: 12,
                }}
              >
                <Caption style={{ color: theme.colors.text.secondary }}>
                  {isRTL ? "يتجدد:" : "Renews:"}
                </Caption>
                <Caption
                  style={{
                    color: theme.colors.text.primary,
                    fontWeight: "600",
                  }}
                >
                  {subscriptionStatus.expirationDate.toLocaleDateString(
                    isRTL ? "ar-SA" : undefined,
                    { day: "numeric", month: "long", year: "numeric" }
                  )}
                </Caption>
                <Caption style={{ color: theme.colors.text.secondary }}>
                  ·{" "}
                  {subscriptionStatus.subscriptionPeriod === "yearly"
                    ? isRTL
                      ? "سنوي"
                      : "Annual"
                    : isRTL
                      ? "شهري"
                      : "Monthly"}
                </Caption>
              </View>
            )}

            {/* Upgrade / Change Plan button */}
            <TouchableOpacity
              onPress={openPaywall}
              style={{
                backgroundColor: isPremium ? "transparent" : "#6366F1",
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 18,
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderWidth: isPremium ? 1.5 : 0,
                borderColor: isPremium ? meta.border : "transparent",
              }}
            >
              <Zap color={isPremium ? meta.color : "#FFF"} size={16} />
              <TypographyText
                style={{
                  color: isPremium ? meta.color : "#FFF",
                  fontWeight: "700",
                  fontSize: 15,
                }}
              >
                {isPremium
                  ? isRTL
                    ? "تغيير الخطة"
                    : "Change Plan"
                  : isRTL
                    ? "ترقية الخطة"
                    : "Upgrade Plan"}
              </TypographyText>
            </TouchableOpacity>
          </View>

          {/* ── Plan Comparison Table ──────────────────────────────────────── */}
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
                marginBottom: 14,
              },
            ]}
          >
            {isRTL ? "مقارنة الخطط" : "Plan Comparison"}
          </TypographyText>

          {/* Header row */}
          <View
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              marginBottom: 4,
            }}
          >
            <View style={{ flex: 2.2 }} />
            {(["free", "individual", "family"] as PlanCol[]).map((col) => {
              const m = PLAN_META[col];
              const isActive = currentPlan === col;
              return (
                <View
                  key={col}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: isActive ? m.bg : "transparent",
                    marginHorizontal: 2,
                  }}
                >
                  <Caption
                    style={{
                      color: isActive ? m.color : theme.colors.text.secondary,
                      fontWeight: isActive ? "800" : "500",
                      textTransform: "uppercase",
                      fontSize: 10,
                    }}
                  >
                    {isRTL ? m.labelAr : m.labelEn}
                  </Caption>
                  {isActive && (
                    <Caption style={{ color: m.color, fontSize: 9 }}>
                      {isRTL ? "حالي" : "current"}
                    </Caption>
                  )}
                </View>
              );
            })}
          </View>

          {/* Feature rows */}
          {FEATURE_ROWS.map((row, i) => (
            <View
              key={i}
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                paddingVertical: 10,
                paddingHorizontal: 8,
                backgroundColor:
                  i % 2 === 0
                    ? theme.colors.background.secondary
                    : "transparent",
                borderRadius: 8,
              }}
            >
              <View
                style={{
                  flex: 2.2,
                  flexDirection: isRTL ? "row-reverse" : "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <row.icon color={theme.colors.text.secondary} size={14} />
                <Caption
                  style={{
                    color: theme.colors.text.primary,
                    flex: 1,
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {isRTL ? row.labelAr : row.labelEn}
                </Caption>
              </View>
              {(["free", "individual", "family"] as PlanCol[]).map((col) => (
                <View
                  key={col}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FeatureCell value={row[col]} />
                </View>
              ))}
            </View>
          ))}

          {/* Footer note */}
          <View
            style={{
              backgroundColor: "#F0FDF4",
              borderRadius: 12,
              padding: 14,
              marginTop: 20,
            }}
          >
            <Caption
              style={{
                color: "#166534",
                textAlign: isRTL ? "right" : "left",
                lineHeight: 18,
              }}
            >
              {isRTL
                ? "جميع الخطط المميزة تتضمن نسخاً احتياطية تلقائية، دعماً أولوياً، وتشفيراً كاملاً للبيانات. لأسئلة الفوترة تواصل: support@maakhealth.com"
                : "All premium plans include automatic cloud backup, priority support, and full data encryption. For billing questions contact support@maakhealth.com"}
            </Caption>
          </View>

          {/* Auto-renewal disclosure + Terms/Privacy — Apple §3.1.2 */}
          <Caption
            style={{
              color: theme.colors.text.tertiary,
              textAlign: "center",
              lineHeight: 16,
              marginTop: 16,
              fontSize: 11,
            }}
          >
            {isRTL
              ? "الاشتراك يتجدد تلقائياً ما لم يتم إلغاؤه قبل 24 ساعة على الأقل من نهاية الفترة الحالية. يتم تحصيل الرسوم من حساب iTunes عند تأكيد الشراء."
              : "Subscription automatically renews unless canceled at least 24 hours before the end of the current period. Payment is charged to your iTunes account at confirmation of purchase."}
          </Caption>
          <View
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              justifyContent: "center",
              alignItems: "center",
              marginTop: 8,
              marginBottom: 8,
            }}
          >
            <TouchableOpacity
              onPress={() =>
                Linking.openURL(
                  "https://maak-5caad.web.app/terms-conditions"
                )
              }
              style={{ paddingHorizontal: 8, paddingVertical: 4 }}
            >
              <Caption
                style={{
                  color: "#2563EB",
                  textDecorationLine: "underline",
                }}
              >
                {isRTL ? "شروط الاستخدام" : "Terms of Use (EULA)"}
              </Caption>
            </TouchableOpacity>
            <Caption style={{ color: theme.colors.text.tertiary }}>•</Caption>
            <TouchableOpacity
              onPress={() =>
                Linking.openURL(
                  "https://maak-5caad.web.app/privacy-policy"
                )
              }
              style={{ paddingHorizontal: 8, paddingVertical: 4 }}
            >
              <Caption
                style={{
                  color: "#2563EB",
                  textDecorationLine: "underline",
                }}
              >
                {isRTL ? "سياسة الخصوصية" : "Privacy Policy"}
              </Caption>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ── RevenueCat Paywall Modal ───────────────────────────────────────── */}
      <Modal
        animationType="slide"
        onRequestClose={closePaywall}
        presentationStyle="pageSheet"
        visible={showPaywall}
      >
        <RevenueCatPaywall
          onDismiss={closePaywall}
          onPurchaseComplete={handlePurchaseComplete}
        />
      </Modal>
    </WavyBackground>
  );
}

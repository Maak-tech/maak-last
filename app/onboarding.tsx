import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WatermarkPattern } from "@/components/figma/WatermarkPattern";
import { RevenueCatPaywall } from "@/components/RevenueCatPaywall";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { paywallGuard } from "@/lib/utils/paywallGuard";

// Figma design: 4-step onboarding with icons
const STEPS = [
  {
    icon: "heart" as const,
    color: "#EB9C0C",
    image: require("@/assets/images/welcome.png"),
  },
  {
    icon: "pulse" as const,
    color: "#003543",
    image: require("@/assets/images/track-health..png"),
  },
  {
    icon: "notifications" as const,
    color: "#10B981",
    image: require("@/assets/images/manage-family.png"),
  },
  {
    icon: "chatbubbles" as const,
    color: "#EB9C0C",
    image: require("@/assets/images/generated_image.png"),
  },
];

function getIconBackgroundColor(color: string): string {
  switch (color) {
    case "#EB9C0C":
      return "rgba(235,156,12,0.15)";
    case "#003543":
      return "rgba(0,53,67,0.15)";
    default:
      return "rgba(16,185,129,0.15)";
  }
}

// Premium features shown on the upsell step
const PREMIUM_FEATURES = [
  {
    iconEn: "🌅",
    labelEn: "Daily AI health briefing",
    labelAr: "ملخص صحي يومي بالذكاء الاصطناعي",
  },
  {
    iconEn: "📈",
    labelEn: "7-day predictive health score",
    labelAr: "توقع نقاط الصحة لـ ٧ أيام",
  },
  {
    iconEn: "🔬",
    labelEn: "Lab results intelligence",
    labelAr: "تحليل نتائج الفحوصات",
  },
  {
    iconEn: "💊",
    labelEn: "Medication intelligence",
    labelAr: "ذكاء الأدوية والتفاعلات",
  },
  { iconEn: "✨", labelEn: "Health discoveries", labelAr: "الاكتشافات الصحية" },
  {
    iconEn: "🤖",
    labelEn: "Zeina AI assistant",
    labelAr: "مساعدة زينا الذكية",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { updateUser } = useAuth();
  const [step, setStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // STEPS.length is 4; step 4 is the premium upsell step
  const isPremiumStep = step === STEPS.length;
  const currentStep = STEPS[step];
  const isLastContentStep = step === STEPS.length - 1;
  const isRTL = i18n.language === "ar";

  const completeOnboarding = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      const AsyncStorage = await import(
        "@react-native-async-storage/async-storage"
      );
      await AsyncStorage.default.setItem("triggerDashboardTour", "true");
      await updateUser({ onboardingCompleted: true });
      setTimeout(() => {
        router.replace({ pathname: "/(tabs)", params: { tour: "1" } });
      }, 300);
    } catch {
      setIsCompleting(false);
    }
  };

  const handleNext = async () => {
    if (isPremiumStep) {
      // "Maybe Later" on premium step — complete without subscribing
      await completeOnboarding();
    } else if (isLastContentStep) {
      // Move to premium upsell step
      setStep(STEPS.length);
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
  };

  const handleUpgradePress = () => {
    if (!paywallGuard.tryShowPaywall()) return;
    setShowPaywall(true);
  };

  const handlePaywallDismiss = () => {
    paywallGuard.hidePaywall();
    setShowPaywall(false);
  };

  const handlePurchaseComplete = async () => {
    paywallGuard.hidePaywall();
    setShowPaywall(false);
    await completeOnboarding();
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "ar" : "en";
    i18n.changeLanguage(newLang);
  };

  // Computed only for the 4 content steps (not for the premium upsell step)
  const titleKey = isPremiumStep
    ? ("onboarding.title.1" as const)
    : (`onboarding.title.${step + 1}` as const);
  const subtitleKey = isPremiumStep
    ? ("onboarding.subtitle.1" as const)
    : (`onboarding.subtitle.${step + 1}` as const);

  return (
    <View style={styles.container}>
      <WatermarkPattern />

      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        {/* Language toggle */}
        <View style={styles.languageRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={toggleLanguage}
            style={styles.languageButton}
          >
            <Ionicons color="#4E5661" name="globe-outline" size={18} />
            <Text style={styles.languageText}>
              {i18n.language === "en" ? "العربية" : "English"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Progress indicators — 5 dots total (4 content + 1 premium) */}
        <View style={styles.progressRow}>
          {[
            ...STEPS,
            { icon: "star" as const, color: "#EB9C0C", image: STEPS[0].image },
          ].map((stepConfig, index) => (
            <View
              key={`${stepConfig.icon}-${index}`}
              style={[
                styles.progressDot,
                index === step && styles.progressDotActive,
                index < step && styles.progressDotCompleted,
              ]}
            />
          ))}
        </View>

        {isPremiumStep ? (
          /* ── Premium Upsell Step ─────────────────────────────────────── */
          <>
            <View style={styles.content}>
              {/* Header */}
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: "rgba(235,156,12,0.12)" },
                ]}
              >
                <Ionicons color="#EB9C0C" name="star" size={48} />
              </View>
              <Text style={[styles.title, isRTL && styles.rtlText]}>
                {isRTL
                  ? "أطلق إمكانياتك الكاملة"
                  : "Unlock Your Full Potential"}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { marginBottom: 24 },
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL
                  ? "ترقّ إلى ماك بريميوم واحصل على رؤى صحية مدعومة بالذكاء الاصطناعي"
                  : "Upgrade to Maak Premium for AI-powered health insights"}
              </Text>

              {/* Feature list */}
              <View style={{ width: "100%", gap: 10 }}>
                {PREMIUM_FEATURES.map((f) => (
                  <View
                    key={f.labelEn}
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      alignItems: "center",
                      gap: 12,
                      backgroundColor: "rgba(0,53,67,0.04)",
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{f.iconEn}</Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: "#1A1D1F",
                        textAlign: isRTL ? "right" : "left",
                        flex: 1,
                      }}
                    >
                      {isRTL ? f.labelAr : f.labelEn}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              {/* Primary — open paywall */}
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isCompleting}
                onPress={handleUpgradePress}
                style={[styles.primaryButton, { backgroundColor: "#EB9C0C" }]}
              >
                <Ionicons color="#FFFFFF" name="star" size={18} />
                <Text style={styles.primaryButtonText}>
                  {isRTL ? "ابدأ التجربة المجانية" : "Start Free Trial"}
                </Text>
              </TouchableOpacity>

              {/* Secondary — skip to dashboard */}
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isCompleting}
                onPress={handleNext}
                style={styles.skipButton}
              >
                <Text style={styles.skipText}>
                  {isRTL ? "ربما لاحقاً" : "Maybe Later"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* ── Regular content steps ───────────────────────────────────── */
          <>
            <View style={styles.content}>
              {/* Icon */}
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: getIconBackgroundColor(currentStep.color),
                  },
                ]}
              >
                <Ionicons
                  color={currentStep.color}
                  name={currentStep.icon}
                  size={48}
                />
              </View>

              {/* Logo for first step */}
              {step === 0 && (
                <View style={styles.logoRow}>
                  <View style={styles.logoDots}>
                    <View
                      style={[styles.dot, { backgroundColor: "#003543" }]}
                    />
                    <View
                      style={[styles.dot, { backgroundColor: "#EB9C0C" }]}
                    />
                  </View>
                  <Text style={styles.logoText}>{t("app.name")}</Text>
                </View>
              )}

              {/* Title and subtitle */}
              <Text
                numberOfLines={2}
                style={[styles.title, isRTL && styles.rtlText]}
              >
                {t(titleKey)}
              </Text>
              <Text
                numberOfLines={3}
                style={[styles.subtitle, isRTL && styles.rtlText]}
              >
                {t(subtitleKey)}
              </Text>

              {/* Illustration */}
              <View style={styles.illustrationPlaceholder}>
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={t(titleKey)}
                  resizeMode="contain"
                  source={currentStep.image}
                  style={styles.illustrationImage}
                />
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isCompleting}
                onPress={handleNext}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {isLastContentStep
                    ? t("onboarding.next")
                    : t("onboarding.next")}
                </Text>
                <Ionicons color="#FFFFFF" name="chevron-forward" size={20} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleSkip}
                style={styles.skipButton}
              >
                <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>

      {/* RevenueCat Paywall Modal */}
      <Modal
        animationType="slide"
        onRequestClose={handlePaywallDismiss}
        presentationStyle="pageSheet"
        visible={showPaywall}
      >
        <RevenueCatPaywall
          onDismiss={handlePaywallDismiss}
          onPurchaseComplete={handlePurchaseComplete}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  safeArea: {
    flex: 1,
    zIndex: 10,
  },
  languageRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  languageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  languageText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4E5661",
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  progressDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
  },
  progressDotActive: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#003543",
  },
  progressDotCompleted: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#003543",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  logoDots: {
    flexDirection: "row",
    gap: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  logoText: {
    fontSize: 30,
    fontWeight: "700",
    color: "#003543",
  },
  title: {
    fontSize: 30,
    fontWeight: "600",
    color: "#1A1D1F",
    textAlign: "center",
    marginBottom: 16,
    maxWidth: 340,
  },
  subtitle: {
    fontSize: 18,
    color: "#6C7280",
    textAlign: "center",
    marginBottom: 48,
    maxWidth: 400,
    lineHeight: 26,
  },
  rtlText: {
    textAlign: "right",
  },
  illustrationPlaceholder: {
    width: 256,
    height: 256,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FDFE",
    overflow: "hidden",
    padding: 12,
  },
  illustrationImage: {
    width: "100%",
    height: "100%",
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    backgroundColor: "#003543",
    borderRadius: 12,
    paddingVertical: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  skipButton: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },
  skipText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6C7280",
  },
});

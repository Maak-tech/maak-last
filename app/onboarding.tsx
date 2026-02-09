import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  type ImageStyle,
  SafeAreaView,
  type StyleProp,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

// Different onboarding steps based on user role
const getOnboardingSteps = (userRole: string) => {
  const isAdmin = userRole === "admin";

  if (isAdmin) {
    // Full onboarding for admin users
    return [
      {
        key: "welcome",
        image: require("@/assets/images/welcome.png"),
        titleEn: "Welcome to Maak",
        titleAr: "Ù…Ø±Ø­Ø¨Ø§Ù‹ Ø¨Ùƒ ÙÙŠ Ù…Ø¹Ùƒ",
        descEn:
          "Your family health companion. Keep track of your loved ones health and stay connected.",
        descAr:
          "Ø±ÙÙŠÙ‚Ùƒ Ø§Ù„ØµØ­ÙŠ Ù„Ù„Ø¹Ø§Ø¦Ù„Ø©. ØªØ§Ø¨Ø¹ ØµØ­Ø© Ø£Ø­Ø¨Ø§Ø¦Ùƒ ÙˆØ§Ø¨Ù‚ÙŽ Ø¹Ù„Ù‰ ØªÙˆØ§ØµÙ„ Ù…Ø¹Ù‡Ù….",
        onelinerEn: '"Health starts at home"',
        onelinerAr: '"Ø®Ù„ÙŠÙ‡Ù… Ø¯Ø§ÙŠÙ…Ù‹Ø§ Ù…Ø¹Ùƒ"',
      },
      {
        key: "track",
        image: require("@/assets/images/track-health..png"),
        titleEn: "Track Health Together",
        titleAr: "ØªØªØ¨Ø¹ Ø§Ù„ØµØ­Ø© Ù…Ø¹Ø§Ù‹",
        descEn:
          "Monitor symptoms, medications, and vital signs for your entire family in one place.",
        descAr:
          "Ø±Ø§Ù‚Ø¨ Ø§Ù„Ø£Ø¹Ø±Ø§Ø¶ ÙˆØ§Ù„Ø£Ø¯ÙˆÙŠØ© ÙˆØ§Ù„Ø¹Ù„Ø§Ù…Ø§Øª Ø§Ù„Ø­ÙŠÙˆÙŠØ© Ù„Ø¹Ø§Ø¦Ù„ØªÙƒ Ø¨Ø£ÙƒÙ…Ù„Ù‡Ø§ ÙÙŠ Ù…ÙƒØ§Ù† ÙˆØ§Ø­Ø¯.",
        onelinerEn: '"Health starts at home"',
        onelinerAr: '"Ø®Ù„ÙŠÙ‡Ù… Ø¯Ø§ÙŠÙ…Ù‹Ø§ Ù…Ø¹Ùƒ"',
      },
      {
        key: "family",
        image: require("@/assets/images/manage-family.png"),
        titleEn: "Manage Your Family",
        titleAr: "Ø¥Ø¯Ø§Ø±Ø© Ø¹Ø§Ø¦Ù„ØªÙƒ",
        descEn:
          "Invite family members, share health data, and provide care for each other.",
        descAr:
          "Ø§Ø¯Ø¹ Ø£ÙØ±Ø§Ø¯ Ø§Ù„Ø¹Ø§Ø¦Ù„Ø©ØŒ ÙˆØ´Ø§Ø±Ùƒ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØµØ­ÙŠØ©ØŒ ÙˆØ§Ø¹ØªÙ†ÙˆØ§ Ø¨Ø¨Ø¹Ø¶ÙƒÙ… Ø§Ù„Ø¨Ø¹Ø¶.",
        onelinerEn: '"Health starts at home"',
        onelinerAr: '"Ø®Ù„ÙŠÙ‡Ù… Ø¯Ø§ÙŠÙ…Ù‹Ø§ Ù…Ø¹Ùƒ"',
      },
    ];
  }
  // Simplified onboarding for regular users
  return [
    {
      key: "welcome",
      image: require("@/assets/images/welcome.png"),
      titleEn: "Welcome to Maak",
      titleAr: "Ù…Ø±Ø­Ø¨Ø§Ù‹ Ø¨Ùƒ ÙÙŠ Ù…Ø¹Ùƒ",
      descEn:
        "Your personal health companion. Track symptoms, medications, and get health insights.",
      descAr:
        "Ø±ÙÙŠÙ‚Ùƒ Ø§Ù„ØµØ­ÙŠ Ø§Ù„Ø´Ø®ØµÙŠ. ØªØ§Ø¨Ø¹ Ø§Ù„Ø£Ø¹Ø±Ø§Ø¶ ÙˆØ§Ù„Ø£Ø¯ÙˆÙŠØ© ÙˆØ§Ø­ØµÙ„ Ø¹Ù„Ù‰ Ø±Ø¤Ù‰ ØµØ­ÙŠØ©.",
      onelinerEn: '"Health starts at home"',
      onelinerAr: '"Ø§Ù„ØµØ­Ø© ØªØ¨Ø¯Ø£ Ù…Ù† Ø§Ù„Ù…Ù†Ø²Ù„"',
    },
    {
      key: "track",
      image: require("@/assets/images/track-health..png"),
      titleEn: "Track Your Health",
      titleAr: "ØªØ§Ø¨Ø¹ ØµØ­ØªÙƒ",
      descEn:
        "Easily log symptoms, manage medications, and monitor your vital signs.",
      descAr:
        "Ø³Ø¬Ù„ Ø§Ù„Ø£Ø¹Ø±Ø§Ø¶ Ø¨Ø³Ù‡ÙˆÙ„Ø©ØŒ Ø£Ø¯Ø± Ø§Ù„Ø£Ø¯ÙˆÙŠØ©ØŒ ÙˆØ±Ø§Ù‚Ø¨ Ø§Ù„Ø¹Ù„Ø§Ù…Ø§Øª Ø§Ù„Ø­ÙŠÙˆÙŠØ©.",
      onelinerEn: '"Stay on top of your health"',
      onelinerAr: '"Ø§Ø¨Ù‚ÙŽ Ø¹Ù„Ù‰ Ø§Ø·Ù„Ø§Ø¹ Ø¨ØµØ­ØªÙƒ"',
    },
    {
      key: "zeina",
      image: require("@/assets/images/welcome.png"), // Using welcome image as placeholder
      titleEn: "Meet Zeina",
      titleAr: "ØªØ¹Ø±Ù Ø¹Ù„Ù‰ Ø²ÙŠÙ†Ø©",
      descEn:
        "Your AI health assistant is here to help answer questions and provide guidance.",
      descAr:
        "Ù…Ø³Ø§Ø¹Ø¯Ùƒ Ø§Ù„ØµØ­ÙŠ Ø§Ù„Ø°ÙƒÙŠ Ù‡Ù†Ø§ Ù„Ù„Ù…Ø³Ø§Ø¹Ø¯Ø© ÙÙŠ Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø£Ø³Ø¦Ù„Ø© ÙˆØªÙ‚Ø¯ÙŠÙ… Ø§Ù„Ø¥Ø±Ø´Ø§Ø¯Ø§Øª.",
      onelinerEn: '"Your health companion"',
      onelinerAr: '"Ø±ÙÙŠÙ‚Ùƒ Ø§Ù„ØµØ­ÙŠ"',
    },
  ];
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Multi-step onboarding UI intentionally keeps logic co-located.
export default function OnboardingScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  type RouteTarget = Parameters<typeof router.replace>[0];

  const isRTL = i18n.language === "ar";
  const onboardingSteps = getOnboardingSteps(user?.role || "user");

  // biome-ignore lint/nursery/noShadow: Local themed-style callback parameter is intentional and scoped.
  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      flexDirection: "row" as const,
      justifyContent: "flex-end" as const,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
    },
    skipButton: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    skipText: {
      ...getTextStyle(theme, "body", "medium", theme.colors.text.secondary),
    },
    progressContainer: {
      flexDirection: "row" as const,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingVertical: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.neutral[200],
    },
    progressDotActive: {
      width: 24,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.primary.main,
    },
    content: {
      flex: 1,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.base,
    },
    imageSection: {
      alignItems: "center" as const,
      flex: 1,
      justifyContent: "center" as const,
      maxHeight: "50%",
    },
    imageContainer: {
      width: 260,
      height: 260,
      borderRadius: 20,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      backgroundColor: theme.colors.background.secondary,
      ...theme.shadows.lg,
    },
    image: {
      width: 220,
      height: 220,
      borderRadius: 15,
    },
    textContainer: {
      alignItems: "center" as const,
      paddingHorizontal: theme.spacing.base,
      flex: 1,
      justifyContent: "center" as const,
      minHeight: 200,
    },
    title: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.primary.main),
      fontSize: 28,
      textAlign: "center" as const,
      marginBottom: theme.spacing.lg,
      lineHeight: 34,
    },
    description: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      textAlign: "center" as const,
      lineHeight: 22,
      marginBottom: theme.spacing.xl,
      fontSize: 16,
    },
    oneliner: {
      ...getTextStyle(
        theme,
        "subheading",
        "semibold",
        theme.colors.secondary.main
      ),
      fontStyle: "italic" as const,
      textAlign: "center" as const,
      fontSize: 18,
    },
    footer: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
    },
    buttonContainer: {
      flexDirection: "row" as const,
      gap: theme.spacing.md,
    },
    primaryButton: {
      flex: 1,
      backgroundColor: theme.colors.primary.main,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.base,
      alignItems: "center" as const,
      ...theme.shadows.md,
    },
    primaryButtonText: {
      ...getTextStyle(theme, "button", "bold", theme.colors.neutral.white),
    },
    secondaryButton: {
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.lg,
      alignItems: "center" as const,
    },
    secondaryButtonText: {
      ...getTextStyle(theme, "button", "medium", theme.colors.text.secondary),
    },
    rtlText: {
      textAlign: "right" as const,
    },
  }))(theme);

  const handleComplete = async () => {
    if (isCompleting) {
      return;
    }

    setIsCompleting(true);
    try {
      const AsyncStorage = await import(
        "@react-native-async-storage/async-storage"
      );
      await AsyncStorage.default.setItem("triggerDashboardTour", "true");
      await updateUser({ onboardingCompleted: true });
      // Small delay to ensure state is updated
      setTimeout(() => {
        const route: RouteTarget = {
          pathname: "/(tabs)",
          params: { tour: "1" },
        };
        router.replace(route);
      }, 300);
    } catch (_error) {
      // Silently handle error
      setIsCompleting(false);
    }
  };

  const nextStep = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skip = () => {
    handleComplete();
  };

  const currentStepData = onboardingSteps[currentStep];
  const isLastStep = currentStep === onboardingSteps.length - 1;
  let primaryButtonLabel = isRTL ? "Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â§Ã™â€žÃ™Å " : "Next";
  if (isLastStep && isCompleting) {
    primaryButtonLabel = isRTL
      ? "Ã˜Â¬Ã˜Â§Ã˜Â±Ã™Å  Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€¦Ã™Å Ã™â€ž..."
      : "Loading...";
  } else if (isLastStep) {
    primaryButtonLabel = isRTL
      ? "Ã˜Â§Ã˜Â¨Ã˜Â¯Ã˜Â£ Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€ "
      : "Get Started";
  }

  return (
    <SafeAreaView style={styles.container as ViewStyle}>
      {/* Header */}
      <View style={styles.header as ViewStyle}>
        <TouchableOpacity onPress={skip} style={styles.skipButton as ViewStyle}>
          <Text
            style={
              [styles.skipText, isRTL && styles.rtlText] as StyleProp<TextStyle>
            }
          >
            {isRTL ? "ØªØ®Ø·ÙŠ" : "Skip"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer as ViewStyle}>
        {onboardingSteps.map((step, index) => (
          <View
            key={step.key}
            style={
              [
                styles.progressDot,
                index === currentStep && styles.progressDotActive,
              ] as StyleProp<ViewStyle>
            }
          />
        ))}
      </View>

      {/* Content */}
      <View style={styles.content as ViewStyle}>
        {/* Image Section */}
        <View style={styles.imageSection as ViewStyle}>
          <View style={styles.imageContainer as ViewStyle}>
            <Image
              resizeMode="contain"
              source={currentStepData.image}
              style={styles.image as StyleProp<ImageStyle>}
            />
          </View>
        </View>

        {/* Text Section */}
        <View style={styles.textContainer as ViewStyle}>
          <Text
            style={
              [styles.title, isRTL && styles.rtlText] as StyleProp<TextStyle>
            }
          >
            {isRTL ? currentStepData.titleAr : currentStepData.titleEn}
          </Text>

          <Text
            style={
              [
                styles.description,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            {isRTL ? currentStepData.descAr : currentStepData.descEn}
          </Text>

          <Text
            style={
              [styles.oneliner, isRTL && styles.rtlText] as StyleProp<TextStyle>
            }
          >
            {isRTL ? currentStepData.onelinerAr : currentStepData.onelinerEn}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer as ViewStyle}>
        <View style={styles.buttonContainer as ViewStyle}>
          {currentStep > 0 && (
            <TouchableOpacity
              onPress={prevStep}
              style={styles.secondaryButton as ViewStyle}
            >
              <Text
                style={
                  [
                    styles.secondaryButtonText,
                    isRTL && styles.rtlText,
                  ] as StyleProp<TextStyle>
                }
              >
                {isRTL ? "Ø§Ù„Ø³Ø§Ø¨Ù‚" : "Back"}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            disabled={isCompleting}
            onPress={nextStep}
            style={styles.primaryButton as ViewStyle}
          >
            <Text
              style={
                [
                  styles.primaryButtonText,
                  isRTL && styles.rtlText,
                ] as StyleProp<TextStyle>
              }
            >
              {primaryButtonLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

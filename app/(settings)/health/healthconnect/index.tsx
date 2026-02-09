import { router } from "expo-router";
import { ChevronRight, Heart } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  type StyleProp,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { configureLayoutAnimationIfActive } from "@/lib/utils/appStateGuards";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: screen copy is intentionally inline for localization parity.
export default function HealthConnectIntroScreen() {
  const { i18n } = useTranslation();
  const { theme: appTheme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const isRTL = i18n.language === "ar";

  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    scrollContent: {
      flexGrow: 1,
      padding: theme.spacing.lg,
      justifyContent: "center" as const,
    },
    header: {
      marginBottom: theme.spacing.xl,
      alignItems: "center" as const,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.primary[50],
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.lg,
    },
    title: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.primary.main),
      fontSize: 28,
      textAlign: "center" as const,
      marginBottom: theme.spacing.md,
    },
    subtitle: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      textAlign: "center" as const,
      lineHeight: 22,
    },
    section: {
      marginBottom: theme.spacing.lg,
    },
    sectionTitle: {
      ...getTextStyle(
        theme,
        "subheading",
        "semibold",
        theme.colors.text.primary
      ),
      marginBottom: theme.spacing.md,
    },
    bulletPoint: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
      marginBottom: theme.spacing.sm,
      lineHeight: 22,
    },
    notDoSection: {
      backgroundColor: theme.colors.secondary[50],
      padding: theme.spacing.base,
      borderRadius: theme.borderRadius.lg,
      borderStartWidth: 4,
      borderStartColor: theme.colors.secondary.main,
      marginBottom: theme.spacing.lg,
    },
    notDoTitle: {
      ...getTextStyle(
        theme,
        "subheading",
        "semibold",
        theme.colors.secondary.dark
      ),
      marginBottom: theme.spacing.md,
    },
    notDoText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
      marginBottom: theme.spacing.sm,
      lineHeight: 22,
    },
    learnMoreButton: {
      paddingVertical: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    learnMoreText: {
      ...getTextStyle(theme, "body", "semibold", theme.colors.primary.main),
    },
    expandedText: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
      lineHeight: 20,
      marginBottom: theme.spacing.lg,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary.main,
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      marginTop: theme.spacing.md,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      flexDirection: "row" as const,
      gap: theme.spacing.sm,
      ...theme.shadows.md,
    },
    primaryButtonText: {
      ...getTextStyle(theme, "button", "semibold", theme.colors.neutral.white),
    },
    secondaryButton: {
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      marginTop: theme.spacing.md,
      alignItems: "center" as const,
    },
    secondaryButtonText: {
      ...getTextStyle(theme, "body", "semibold", theme.colors.text.secondary),
    },
    rtlText: {
      textAlign: "right" as const,
    },
  }))(appTheme);

  const toggleLearnMore = () => {
    if (Platform.OS === "ios") {
      configureLayoutAnimationIfActive(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpanded((v) => !v);
  };

  const getLearnMoreLabel = (
    isExpanded: boolean,
    isRtlLanguage: boolean
  ): string => {
    if (isExpanded) {
      return isRtlLanguage ? "إخفاء التفاصيل" : "Hide details";
    }
    return isRtlLanguage ? "تعرف على المزيد" : "Learn more";
  };

  return (
    <SafeAreaView style={styles.container as ViewStyle}>
      <ScrollView
        contentContainerStyle={styles.scrollContent as ViewStyle}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header as ViewStyle}>
          <View style={styles.iconContainer as ViewStyle}>
            <Heart color={appTheme.colors.primary.main} size={40} />
          </View>
          <Text
            style={
              [styles.title, isRTL && styles.rtlText] as StyleProp<TextStyle>
            }
          >
            {isRTL ? "ربط Health Connect" : "Connect Health Connect"}
          </Text>
          <Text
            style={
              [styles.subtitle, isRTL && styles.rtlText] as StyleProp<TextStyle>
            }
          >
            {isRTL
              ? "يمكن لـ Maak قراءة البيانات الصحية التي تختارها من Health Connect لمساعدتك وعائلتك في تتبع الاتجاهات واكتشاف المخاطر مبكرًا."
              : "Maak can read the health data you choose from Health Connect to help you and your family track trends and spot risks early."}
          </Text>
        </View>

        <View style={styles.section as ViewStyle}>
          <Text
            style={
              [
                styles.sectionTitle,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            {isRTL ? "ما سنفعله:" : "What we will do:"}
          </Text>
          <Text
            style={
              [
                styles.bulletPoint,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            •{" "}
            {isRTL
              ? "أنت تختار ما تشاركه (اختر مقاييس محددة)"
              : "You choose what to share (pick specific metrics)"}
          </Text>
          <Text
            style={
              [
                styles.bulletPoint,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            •{" "}
            {isRTL
              ? "وصول للقراءة فقط (Maak لا يكتب أبدًا في Health Connect)"
              : "Read-only access (Maak never writes to Health Connect)"}
          </Text>
          <Text
            style={
              [
                styles.bulletPoint,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            •{" "}
            {isRTL
              ? "استخدام البيانات لتقديم رؤى صحية ودعم الرعاية"
              : "Use data to provide health insights and caregiving support"}
          </Text>
          <Text
            style={
              [
                styles.bulletPoint,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            •{" "}
            {isRTL
              ? "التغيير في أي وقت (إدارة أو إلغاء في إعدادات Health Connect)"
              : "Change anytime (manage or revoke in Health Connect settings)"}
          </Text>
        </View>

        <View style={styles.notDoSection as ViewStyle}>
          <Text
            style={
              [
                styles.notDoTitle,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            {isRTL ? "ما لن نفعله:" : "What we will NOT do:"}
          </Text>
          <Text
            style={
              [
                styles.notDoText,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            •{" "}
            {isRTL
              ? "لن نبيع بياناتك الصحية أبدًا"
              : "We will never sell your health data"}
          </Text>
          <Text
            style={
              [
                styles.notDoText,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            •{" "}
            {isRTL
              ? "لن نشارك بياناتك مع أطراف ثالثة"
              : "We will never share your data with third parties"}
          </Text>
          <Text
            style={
              [
                styles.notDoText,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            •{" "}
            {isRTL
              ? "لن نكتب أو نعدل بيانات Health Connect الخاصة بك"
              : "We will never write to or modify your Health Connect data"}
          </Text>
          <Text
            style={
              [
                styles.notDoText,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            •{" "}
            {isRTL
              ? "بياناتك تبقى آمنة وخاصة"
              : "Your data stays secure and private"}
          </Text>
        </View>

        <Pressable
          onPress={toggleLearnMore}
          style={styles.learnMoreButton as ViewStyle}
        >
          <Text
            style={
              [
                styles.learnMoreText,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            {getLearnMoreLabel(expanded, isRTL)}
          </Text>
        </Pressable>

        {expanded ? (
          <Text
            style={
              [
                styles.expandedText,
                isRTL && styles.rtlText,
              ] as StyleProp<TextStyle>
            }
          >
            {isRTL
              ? "يستخدم Health Connect من Google لتخزين البيانات الصحية بشكل آمن على جهازك. يستخدم Maak البيانات التي تختارها لتقديم رؤى الرعاية (مثل الاتجاهات والتنبيهات) ولا نبيع بياناتك الصحية."
              : "Health Connect by Google stores health data securely on your device. Maak uses the data you select to provide caregiving insights (like trends and alerts) and we do not sell your health data."}
          </Text>
        ) : null}

        <Pressable
          onPress={() => router.push("/health/healthconnect/permissions")}
          style={styles.primaryButton as ViewStyle}
        >
          <Text style={styles.primaryButtonText as TextStyle}>
            {isRTL ? "اختر ما تشاركه" : "Choose what to share"}
          </Text>
          <ChevronRight
            color={appTheme.colors.neutral.white}
            size={20}
            style={{ transform: [{ rotate: isRTL ? "180deg" : "0deg" }] }}
          />
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={styles.secondaryButton as ViewStyle}
        >
          <Text style={styles.secondaryButtonText as TextStyle}>
            {isRTL ? "ليس الآن" : "Not now"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

import React, { useState } from "react";
import { View, Text, Pressable, LayoutAnimation, Platform, SafeAreaView, ScrollView } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";
import { createThemedStyles, getTextStyle } from "@/utils/styles";
import { Heart, ChevronRight } from "lucide-react-native";

export default function AppleHealthIntroScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
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
      ...getTextStyle(theme, "subheading", "semibold", theme.colors.text.primary),
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
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.secondary.main,
      marginBottom: theme.spacing.lg,
    },
    notDoTitle: {
      ...getTextStyle(theme, "subheading", "semibold", theme.colors.secondary.dark),
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
  }))(theme);

  const toggleLearnMore = () => {
    if (Platform.OS === "ios") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpanded((v) => !v);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Heart color={theme.colors.primary.main} size={40} />
          </View>
          <Text style={[styles.title, isRTL && styles.rtlText]}>
            {isRTL ? "ربط Apple Health" : "Connect Apple Health"}
          </Text>
          <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
            {isRTL
              ? "يمكن لـ Maak قراءة البيانات الصحية التي تختارها لمساعدتك وعائلتك في تتبع الاتجاهات واكتشاف المخاطر مبكرًا."
              : "Maak can read the health data you choose to help you and your family track trends and spot risks early."}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? "ما سنفعله:" : "What we will do:"}
          </Text>
          <Text style={[styles.bulletPoint, isRTL && styles.rtlText]}>
            • {isRTL ? "أنت تختار ما تشاركه (اختر مقاييس محددة)" : "You choose what to share (pick specific metrics)"}
          </Text>
          <Text style={[styles.bulletPoint, isRTL && styles.rtlText]}>
            • {isRTL ? "وصول للقراءة فقط (Maak لا يكتب أبدًا في Apple Health)" : "Read-only access (Maak never writes to Apple Health)"}
          </Text>
          <Text style={[styles.bulletPoint, isRTL && styles.rtlText]}>
            • {isRTL ? "استخدام البيانات لتقديم رؤى صحية ودعم الرعاية" : "Use data to provide health insights and caregiving support"}
          </Text>
          <Text style={[styles.bulletPoint, isRTL && styles.rtlText]}>
            • {isRTL ? "التغيير في أي وقت (إدارة أو إلغاء في إعدادات iOS)" : "Change anytime (manage or revoke in iOS Settings)"}
          </Text>
        </View>

        <View style={styles.notDoSection}>
          <Text style={[styles.notDoTitle, isRTL && styles.rtlText]}>
            {isRTL ? "ما لن نفعله:" : "What we will NOT do:"}
          </Text>
          <Text style={[styles.notDoText, isRTL && styles.rtlText]}>
            • {isRTL ? "لن نبيع بياناتك الصحية أبدًا" : "We will never sell your health data"}
          </Text>
          <Text style={[styles.notDoText, isRTL && styles.rtlText]}>
            • {isRTL ? "لن نشارك بياناتك مع أطراف ثالثة" : "We will never share your data with third parties"}
          </Text>
          <Text style={[styles.notDoText, isRTL && styles.rtlText]}>
            • {isRTL ? "لن نكتب أو نعدل بيانات Apple Health الخاصة بك" : "We will never write to or modify your Apple Health data"}
          </Text>
          <Text style={[styles.notDoText, isRTL && styles.rtlText]}>
            • {isRTL ? "بياناتك تبقى آمنة وخاصة" : "Your data stays secure and private"}
          </Text>
        </View>

        <Pressable onPress={toggleLearnMore} style={styles.learnMoreButton}>
          <Text style={[styles.learnMoreText, isRTL && styles.rtlText]}>
            {expanded
              ? isRTL
                ? "إخفاء التفاصيل"
                : "Hide details"
              : isRTL
                ? "تعرف على المزيد"
                : "Learn more"}
          </Text>
        </Pressable>

        {expanded && (
          <Text style={[styles.expandedText, isRTL && styles.rtlText]}>
            {isRTL
              ? "يستخدم Apple Health HealthKit لتخزين البيانات الصحية بشكل آمن على جهازك. يستخدم Maak البيانات التي تختارها لتقديم رؤى الرعاية (مثل الاتجاهات والتنبيهات) ولا نبيع بياناتك الصحية."
              : "Apple Health uses HealthKit to store health data securely on your device. Maak uses the data you select to provide caregiving insights (like trends and alerts) and we do not sell your health data."}
          </Text>
        )}

        <Pressable
          onPress={() => router.push("/health/apple/permissions")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>
            {isRTL ? "اختر ما تشاركه" : "Choose what to share"}
          </Text>
          <ChevronRight
            color={theme.colors.neutral.white}
            size={20}
            style={{ transform: [{ rotate: isRTL ? "180deg" : "0deg" }] }}
          />
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>
            {isRTL ? "ليس الآن" : "Not now"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

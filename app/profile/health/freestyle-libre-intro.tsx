/**
 * Freestyle Libre Introduction Screen
 * Pre-permission explanation before requesting Freestyle Libre OAuth
 */

import { useNavigation, useRouter } from "expo-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Heart,
  Lock,
  Shield,
} from "lucide-react-native";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: onboarding copy and states are intentionally rendered inline.
export default function FreestyleLibreIntroScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { i18n } = useTranslation();
  const { theme, isDark } = useTheme();

  const isRTL = i18n.language === "ar";

  // Hide the default header to prevent duplicate headers
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.primary },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
        >
          <ArrowLeft
            color={theme.colors.text.primary}
            size={24}
            style={isRTL && styles.iconRTL}
          />
        </TouchableOpacity>
        <Text
          style={[
            styles.title,
            { color: theme.colors.text.primary },
            isRTL && styles.rtlText,
          ]}
        >
          {isRTL ? "فري ستايل ليبري" : "Freestyle Libre"}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: isDark
                  ? "rgba(239, 68, 68, 0.2)"
                  : "rgba(239, 68, 68, 0.1)",
              },
            ]}
          >
            <Activity color="#EF4444" size={48} />
          </View>
          <Text
            style={[
              styles.heroTitle,
              { color: theme.colors.text.primary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "ربط فري ستايل ليبري" : "Connect Freestyle Libre"}
          </Text>
          <Text
            style={[
              styles.heroSubtitle,
              { color: theme.colors.text.secondary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL
              ? "مراقبة مستمرة للسكر في الدم"
              : "Continuous blood glucose monitoring"}
          </Text>
        </View>

        {/* Important Notice */}
        <View style={styles.noticeSection}>
          <View style={styles.noticeHeader}>
            <AlertTriangle color="#EF4444" size={20} />
            <Text
              style={[
                styles.noticeTitle,
                { color: theme.colors.text.primary },
                isRTL && styles.rtlText,
              ]}
            >
              {isRTL ? "ملاحظة مهمة" : "Important Notice"}
            </Text>
          </View>
          <Text
            style={[
              styles.noticeText,
              { color: theme.colors.text.secondary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL
              ? "تكامل فري ستايل ليبري يتطلب شراكة مع آبوت. هذه الميزة غير متوفرة حالياً وتتطلب تطوير إضافي."
              : "Freestyle Libre integration requires partnership with Abbott. This feature is currently unavailable and requires additional development."}
          </Text>
        </View>

        {/* Benefits Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text.primary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "الميزات المخططة" : "Planned Features"}
          </Text>

          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <View
                style={[styles.benefitIcon, { backgroundColor: "#EF4444" }]}
              >
                <Activity color="#FFFFFF" size={20} />
              </View>
              <View style={styles.benefitContent}>
                <Text
                  style={[
                    styles.benefitTitle,
                    { color: theme.colors.text.primary },
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL ? "قراءات مستمرة" : "Continuous Readings"}
                </Text>
                <Text
                  style={[
                    styles.benefitDescription,
                    { color: theme.colors.text.secondary },
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL
                    ? "قياسات السكر كل دقيقة بدون وخز"
                    : "Glucose measurements every minute without finger pricks"}
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View
                style={[styles.benefitIcon, { backgroundColor: "#F59E0B" }]}
              >
                <Heart color="#FFFFFF" size={20} />
              </View>
              <View style={styles.benefitContent}>
                <Text
                  style={[
                    styles.benefitTitle,
                    { color: theme.colors.text.primary },
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL ? "تحليلات متقدمة" : "Advanced Analytics"}
                </Text>
                <Text
                  style={[
                    styles.benefitDescription,
                    { color: theme.colors.text.secondary },
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL
                    ? "اتجاهات السكر، متوسطات، وتقارير شاملة"
                    : "Glucose trends, averages, and comprehensive reports"}
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View
                style={[styles.benefitIcon, { backgroundColor: "#10B981" }]}
              >
                <Shield color="#FFFFFF" size={20} />
              </View>
              <View style={styles.benefitContent}>
                <Text
                  style={[
                    styles.benefitTitle,
                    { color: theme.colors.text.primary },
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL ? "إدارة السكري" : "Diabetes Management"}
                </Text>
                <Text
                  style={[
                    styles.benefitDescription,
                    { color: theme.colors.text.secondary },
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL
                    ? "أدوات لإدارة مرض السكري بشكل أفضل"
                    : "Tools for better diabetes management"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text.primary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "الخصوصية والأمان" : "Privacy & Security"}
          </Text>

          <View style={styles.privacyList}>
            <View style={styles.privacyItem}>
              <Lock color="#EF4444" size={20} />
              <Text
                style={[
                  styles.privacyText,
                  { color: theme.colors.text.secondary },
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL
                  ? "بيانات CGM محمية بتشفير طبي"
                  : "CGM data protected with medical-grade encryption"}
              </Text>
            </View>
            <View style={styles.privacyItem}>
              <Shield color="#EF4444" size={20} />
              <Text
                style={[
                  styles.privacyText,
                  { color: theme.colors.text.secondary },
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL ? "امتثال كامل لمعايير HIPAA" : "Full HIPAA compliance"}
              </Text>
            </View>
          </View>
        </View>

        {/* Connect Button - Disabled */}
        <View style={styles.connectSection}>
          <TouchableOpacity
            disabled={true}
            style={[styles.connectButton, styles.connectButtonDisabled]}
          >
            <Text style={styles.connectButtonText}>
              {isRTL ? "غير متوفر حالياً" : "Currently Unavailable"}
            </Text>
          </TouchableOpacity>

          <Text
            style={[
              styles.disclaimer,
              { color: theme.colors.text.tertiary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL
              ? "يتطلب شراكة مع آبوت للتطوير"
              : "Requires partnership with Abbott for development"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonRTL: {
    transform: [{ scaleX: -1 }],
  },
  title: {
    fontSize: 20,
    fontFamily: "Geist-Bold",
    flex: 1,
    textAlign: "center",
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: "Geist-Bold",
    textAlign: "center",
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: "Geist-Regular",
    textAlign: "center",
    lineHeight: 24,
  },
  noticeSection: {
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
  },
  noticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  noticeTitle: {
    fontSize: 16,
    fontFamily: "Geist-Bold",
  },
  noticeText: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    lineHeight: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Geist-Bold",
    marginBottom: 16,
  },
  benefitsList: {
    gap: 16,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    lineHeight: 20,
  },
  privacyList: {
    gap: 12,
  },
  privacyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  privacyText: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    flex: 1,
  },
  connectSection: {
    alignItems: "center",
    paddingTop: 20,
  },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: "100%",
    marginBottom: 12,
    backgroundColor: "#EF4444",
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  connectButtonText: {
    fontSize: 16,
    fontFamily: "Geist-Bold",
    color: "#FFFFFF",
    marginRight: 8,
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  rtlText: {
    textAlign: "right",
  },
  iconRTL: {
    transform: [{ scaleX: -1 }],
  },
});

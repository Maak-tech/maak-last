/**
 * Dexcom CGM Introduction Screen
 * Pre-permission explanation before requesting Dexcom OAuth
 * @module profile/health/dexcom-intro
 */

import { useNavigation, useRouter } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  Lock,
  Settings,
  Shield,
  Activity,
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

export default function DexcomIntroScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
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
          {isRTL ? "ديكسكوم CGM" : "Dexcom CGM"}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
            {isRTL ? "ربط ديكسكوم CGM" : "Connect Dexcom CGM"}
          </Text>
          <Text
            style={[
              styles.heroSubtitle,
              { color: theme.colors.text.secondary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL
              ? "تتبع مستويات السكر في الدم في الوقت الفعلي"
              : "Real-time blood glucose monitoring"}
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
            {isRTL ? "لماذا ديكسكوم؟" : "Why Dexcom?"}
          </Text>

          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: "#EF4444" }]}>
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
                  {isRTL ? "مراقبة مستمرة" : "Continuous Monitoring"}
                </Text>
                <Text
                  style={[
                    styles.benefitDescription,
                    { color: theme.colors.text.secondary },
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL
                    ? "قراءات السكر كل 5 دقائق على مدار 24 ساعة"
                    : "Glucose readings every 5 minutes, 24/7"}
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: "#F59E0B" }]}>
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
                  {isRTL ? "تنبيهات ذكية" : "Smart Alerts"}
                </Text>
                <Text
                  style={[
                    styles.benefitDescription,
                    { color: theme.colors.text.secondary },
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL
                    ? "إشعارات للارتفاعات والانخفاضات الخطرة"
                    : "Alerts for dangerous highs and lows"}
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: "#10B981" }]}>
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
          </View>
        </View>

        {/* CGM Specific Info */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text.primary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "كيف يعمل" : "How It Works"}
          </Text>

          <View style={styles.cgmInfo}>
            <Text
              style={[
                styles.cgmText,
                { color: theme.colors.text.secondary },
                isRTL && styles.rtlText,
              ]}
            >
              {isRTL
                ? "جهاز ديكسكوم CGM يقيس مستويات السكر في السائل بين الخلايا كل 5 دقائق ويرسل البيانات إلى تطبيق الهاتف. سنقوم بمزامنة هذه البيانات لمساعدتك في إدارة مرض السكري بشكل أفضل."
                : "The Dexcom CGM measures glucose levels in interstitial fluid every 5 minutes and sends data to your phone app. We'll sync this data to help you better manage diabetes."}
            </Text>
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
                  ? "بيانات CGM محمية بتشفير من طرف إلى طرف"
                  : "CGM data protected with end-to-end encryption"}
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
                {isRTL
                  ? "نحن نتوافق مع HIPAA للبيانات الطبية"
                  : "HIPAA compliant for medical data"}
              </Text>
            </View>
          </View>
        </View>

        {/* Connect Button */}
        <View style={styles.connectSection}>
          <TouchableOpacity
            onPress={() => router.push("/profile/health/dexcom-permissions")}
            style={[styles.connectButton, { backgroundColor: "#EF4444" }]}
          >
            <Text style={styles.connectButtonText}>
              {isRTL ? "ربط ديكسكوم CGM" : "Connect Dexcom CGM"}
            </Text>
            <ChevronRight
              color="#FFFFFF"
              size={20}
              style={isRTL && styles.iconRTL}
            />
          </TouchableOpacity>

          <Text
            style={[
              styles.disclaimer,
              { color: theme.colors.text.tertiary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL
              ? "يجب أن يكون لديك حساب ديكسكوم نشط"
              : "You must have an active Dexcom account"}
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
  cgmInfo: {
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
  },
  cgmText: {
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
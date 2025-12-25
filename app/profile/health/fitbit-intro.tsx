/**
 * Fitbit Introduction Screen
 * Pre-permission explanation before requesting Fitbit OAuth
 */

import { useNavigation, useRouter } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  Lock,
  Settings,
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

export default function FitbitIntroScreen() {
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
          onPress={() => router.push("/(tabs)/profile")}
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
        >
          <ArrowLeft
            color="#1E293B"
            size={24}
            style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {isRTL ? "ربط Fitbit" : "Connect Fitbit"}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Intro Section */}
        <View style={styles.introSection}>
          <Heart color={theme.colors.primary.main} size={64} />
          <Text
            style={[
              styles.title,
              { color: theme.colors.text.primary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "ربط Fitbit" : "Connect Fitbit"}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: theme.colors.text.secondary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL
              ? "قم بمزامنة بياناتك الصحية من Fitbit إلى Maak Health"
              : "Sync your health data from Fitbit to Maak Health"}
          </Text>
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text.primary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "ما ستحصل عليه" : "What You'll Get"}
          </Text>

          <View style={styles.benefitItem}>
            <View
              style={[
                styles.benefitIcon,
                { backgroundColor: theme.colors.primary.main + "20" },
              ]}
            >
              <Heart color={theme.colors.primary.main} size={24} />
            </View>
            <View style={styles.benefitContent}>
              <Text
                style={[
                  styles.benefitTitle,
                  { color: theme.colors.text.primary },
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL ? "معدل ضربات القلب" : "Heart Rate"}
              </Text>
              <Text
                style={[
                  styles.benefitDesc,
                  { color: theme.colors.text.secondary },
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL
                  ? "تتبع معدل ضربات القلب في الراحة والنشاط"
                  : "Track resting and active heart rate"}
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View
              style={[
                styles.benefitIcon,
                { backgroundColor: theme.colors.primary.main + "20" },
              ]}
            >
              <Heart color={theme.colors.primary.main} size={24} />
            </View>
            <View style={styles.benefitContent}>
              <Text
                style={[
                  styles.benefitTitle,
                  { color: theme.colors.text.primary },
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL ? "الخطوات والنشاط" : "Steps & Activity"}
              </Text>
              <Text
                style={[
                  styles.benefitDesc,
                  { color: theme.colors.text.secondary },
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL
                  ? "مزامنة الخطوات والمسافة والسعرات الحرارية"
                  : "Sync steps, distance, and calories burned"}
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View
              style={[
                styles.benefitIcon,
                { backgroundColor: theme.colors.primary.main + "20" },
              ]}
            >
              <Heart color={theme.colors.primary.main} size={24} />
            </View>
            <View style={styles.benefitContent}>
              <Text
                style={[
                  styles.benefitTitle,
                  { color: theme.colors.text.primary },
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL ? "النوم" : "Sleep"}
              </Text>
              <Text
                style={[
                  styles.benefitDesc,
                  { color: theme.colors.text.secondary },
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL
                  ? "تحليل جودة النوم ومدة النوم"
                  : "Sleep quality analysis and duration"}
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View
              style={[
                styles.benefitIcon,
                { backgroundColor: theme.colors.primary.main + "20" },
              ]}
            >
              <Heart color={theme.colors.primary.main} size={24} />
            </View>
            <View style={styles.benefitContent}>
              <Text
                style={[
                  styles.benefitTitle,
                  { color: theme.colors.text.primary },
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL ? "القياسات الحيوية" : "Vitals"}
              </Text>
              <Text
                style={[
                  styles.benefitDesc,
                  { color: theme.colors.text.secondary },
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL
                  ? "الوزن، الأكسجين في الدم، ودرجة الحرارة"
                  : "Weight, blood oxygen, and temperature"}
              </Text>
            </View>
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.privacySection}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text.primary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "خصوصيتك" : "Your Privacy"}
          </Text>

          <View
            style={[
              styles.privacyCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                borderColor: theme.colors.primary.main + "40",
                borderWidth: 2,
              },
            ]}
          >
            <View style={styles.privacyItem}>
              <View
                style={[
                  styles.privacyIcon,
                  { backgroundColor: theme.colors.primary.main + "20" },
                ]}
              >
                <Lock color={theme.colors.primary.main} size={20} />
              </View>
              <View style={styles.privacyContent}>
                <Text
                  style={[
                    styles.privacyTitle,
                    { color: theme.colors.text.primary },
                  ]}
                >
                  {isRTL ? "نقرأ فقط ما تختاره" : "We only read what you choose"}
                </Text>
                <Text
                  style={[
                    styles.privacyDesc,
                    { color: theme.colors.text.secondary },
                  ]}
                >
                  {isRTL
                    ? "لديك سيطرة كاملة. اختر بالضبط المقاييس التي تريد مشاركتها."
                    : "You have complete control. Select exactly which metrics to share."}
                </Text>
              </View>
            </View>

            <View style={styles.privacyItem}>
              <View
                style={[
                  styles.privacyIcon,
                  { backgroundColor: theme.colors.primary.main + "20" },
                ]}
              >
                <Shield color={theme.colors.primary.main} size={20} />
              </View>
              <View style={styles.privacyContent}>
                <Text
                  style={[
                    styles.privacyTitle,
                    { color: theme.colors.text.primary },
                  ]}
                >
                  {isRTL
                    ? "لا نبيع أو نشارك بياناتك الصحية"
                    : "We never sell or share health data"}
                </Text>
                <Text
                  style={[
                    styles.privacyDesc,
                    { color: theme.colors.text.secondary },
                  ]}
                >
                  {isRTL
                    ? "بياناتك الصحية ملكك وحدك. لا نبيعها أو نشاركها مع أطراف ثالثة."
                    : "Your health data is yours alone. We never sell it or share it with third parties."}
                </Text>
              </View>
            </View>

            <View style={styles.privacyItem}>
              <View
                style={[
                  styles.privacyIcon,
                  { backgroundColor: theme.colors.primary.main + "20" },
                ]}
              >
                <Settings color={theme.colors.primary.main} size={20} />
              </View>
              <View style={styles.privacyContent}>
                <Text
                  style={[
                    styles.privacyTitle,
                    { color: theme.colors.text.primary },
                  ]}
                >
                  {isRTL
                    ? "يمكنك تغيير الأذونات في أي وقت"
                    : "You can change permissions anytime"}
                </Text>
                <Text
                  style={[
                    styles.privacyDesc,
                    { color: theme.colors.text.secondary },
                  ]}
                >
                  {isRTL
                    ? "قم بتحديث اختياراتك أو قطع الاتصال تمامًا في أي وقت."
                    : "Update your selections or disconnect completely at any time."}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            { backgroundColor: theme.colors.primary.main },
          ]}
          onPress={() => router.push("/profile/health/fitbit-permissions")}
        >
          <Text style={styles.continueButtonText}>
            {isRTL ? "متابعة" : "Continue"}
          </Text>
          <ChevronRight
            color="#FFFFFF"
            size={20}
            style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
          />
        </TouchableOpacity>
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
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  backButtonRTL: {
    transform: [{ rotate: "180deg" }],
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  introSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: "Geist-Bold",
    marginTop: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Geist-Regular",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 24,
  },
  benefitsSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Geist-SemiBold",
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    lineHeight: 20,
  },
  privacySection: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  privacyCard: {
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
  },
  privacyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  privacyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 15,
    fontFamily: "Geist-SemiBold",
    marginBottom: 4,
  },
  privacyDesc: {
    fontSize: 13,
    fontFamily: "Geist-Regular",
    lineHeight: 18,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginHorizontal: 24,
    marginTop: 32,
    marginBottom: 32,
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    marginRight: 8,
  },
  rtlText: {
    textAlign: "right",
  },
});


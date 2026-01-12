/**
 * Oura Ring Introduction Screen
 * Pre-permission explanation before requesting Oura OAuth
 */

import { useNavigation, useRouter } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  Lock,
  Settings,
  Shield,
  Moon,
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

export default function OuraIntroScreen() {
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
          {isRTL ? "خاتم أورا" : "Oura Ring"}
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
                  ? "rgba(139, 92, 246, 0.2)"
                  : "rgba(139, 92, 246, 0.1)",
              },
            ]}
          >
            <Moon color="#8B5CF6" size={48} />
          </View>
          <Text
            style={[
              styles.heroTitle,
              { color: theme.colors.text.primary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "ربط خاتم أورا" : "Connect Oura Ring"}
          </Text>
          <Text
            style={[
              styles.heroSubtitle,
              { color: theme.colors.text.secondary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL
              ? "تتبع النوم والاستعداد اليومي المتقدم"
              : "Advanced sleep and daily readiness tracking"}
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
            {isRTL ? "ما ستحصل عليه" : "What You'll Get"}
          </Text>

          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: "#8B5CF6" }]}>
                <Moon color="#FFFFFF" size={20} />
              </View>
              <View style={styles.benefitContent}>
                <Text
                  style={[
                    styles.benefitTitle,
                    { color: theme.colors.text.primary },
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL ? "تحليل النوم المتقدم" : "Advanced Sleep Analysis"}
                </Text>
                <Text
                  style={[
                    styles.benefitDescription,
                    { color: theme.colors.text.secondary },
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL
                    ? "مراحل النوم، جودة النوم، والنوم العميق"
                    : "Sleep stages, sleep quality, and deep sleep tracking"}
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: "#10B981" }]}>
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
                  {isRTL ? "الاستعداد اليومي" : "Daily Readiness"}
                </Text>
                <Text
                  style={[
                    styles.benefitDescription,
                    { color: theme.colors.text.secondary },
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL
                    ? "درجات الاستعداد والتعافي اليومية"
                    : "Daily readiness and recovery scores"}
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: "#F59E0B" }]}>
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
                  {isRTL ? "مراقبة النشاط" : "Activity Monitoring"}
                </Text>
                <Text
                  style={[
                    styles.benefitDescription,
                    { color: theme.colors.text.secondary },
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL
                    ? "خطوات، حرق سعرات، ومستويات الطاقة"
                    : "Steps, calorie burn, and energy levels"}
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
              <Lock color="#8B5CF6" size={20} />
              <Text
                style={[
                  styles.privacyText,
                  { color: theme.colors.text.secondary },
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL
                  ? "بيانات النوم محمية بتشفير شامل"
                  : "Sleep data protected with comprehensive encryption"}
              </Text>
            </View>
            <View style={styles.privacyItem}>
              <Shield color="#8B5CF6" size={20} />
              <Text
                style={[
                  styles.privacyText,
                  { color: theme.colors.text.secondary },
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL
                  ? "أورا تلتزم بمعايير الخصوصية العالية"
                  : "Oura adheres to highest privacy standards"}
              </Text>
            </View>
          </View>
        </View>

        {/* Connect Button */}
        <View style={styles.connectSection}>
          <TouchableOpacity
            onPress={() => router.push("/profile/health/oura-permissions")}
            style={[styles.connectButton, { backgroundColor: "#8B5CF6" }]}
          >
            <Text style={styles.connectButtonText}>
              {isRTL ? "ربط خاتم أورا" : "Connect Oura Ring"}
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
              ? "سيتم توجيهك إلى موقع أورا للموافقة"
              : "You'll be redirected to Oura to approve access"}
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
/**
 * Apple Health Introduction Screen
 * Pre-permission explanation before requesting HealthKit access
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
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This screen renders multiple localized sections with platform-specific branching.
export default function AppleHealthIntroScreen() {
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

  if (Platform.OS !== "ios") {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.colors.background.primary },
        ]}
      >
        <View style={styles.errorContainer}>
          <Text
            style={[
              styles.errorText,
              { color: theme.colors.text.primary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {t("appleHealthOnlyIOS")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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

        <Text style={[styles.headerTitle, isRTL && { textAlign: "left" }]}>
          {t("connectAppleHealth")}
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
              isRTL && { textAlign: "left" },
            ]}
          >
            {t("connectAppleHealth")}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: theme.colors.text.secondary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {t("syncHealthDataBetterInsights")}
          </Text>
        </View>

        {/* Benefits Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text.primary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {t("whatYoullGet")}
          </Text>

          <View style={styles.benefitCard}>
            <Shield color={theme.colors.primary.main} size={24} />
            <View style={styles.benefitContent}>
              <Text
                style={[
                  styles.benefitTitle,
                  { color: theme.colors.text.primary },
                  isRTL && { textAlign: "left" },
                ]}
              >
                {t("completeHealthPicture")}
              </Text>
              <Text
                style={[
                  styles.benefitDesc,
                  { color: theme.colors.text.secondary },
                  isRTL && { textAlign: "left" },
                ]}
              >
                {t("completeHealthPictureDesc")}
              </Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <Heart color={theme.colors.primary.main} size={24} />
            <View style={styles.benefitContent}>
              <Text
                style={[
                  styles.benefitTitle,
                  { color: theme.colors.text.primary },
                  isRTL && { textAlign: "left" },
                ]}
              >
                {t("earlyRiskDetection")}
              </Text>
              <Text
                style={[
                  styles.benefitDesc,
                  { color: theme.colors.text.secondary },
                  isRTL && { textAlign: "left" },
                ]}
              >
                {t("earlyRiskDetectionDesc")}
              </Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <Lock color={theme.colors.primary.main} size={24} />
            <View style={styles.benefitContent}>
              <Text
                style={[
                  styles.benefitTitle,
                  { color: theme.colors.text.primary },
                  isRTL && { textAlign: "left" },
                ]}
              >
                {t("yourDataYourControl")}
              </Text>
              <Text
                style={[
                  styles.benefitDesc,
                  { color: theme.colors.text.secondary },
                  isRTL && { textAlign: "left" },
                ]}
              >
                {t("yourDataYourControlDesc")}
              </Text>
            </View>
          </View>
        </View>

        {/* Privacy Promise Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text.primary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {t("yourPrivacyPromise")}
          </Text>

          <View
            style={[
              styles.privacyCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                borderColor: `${theme.colors.primary.main}40`,
                borderWidth: 2,
              },
            ]}
          >
            <View style={styles.privacyItem}>
              <View
                style={[
                  styles.privacyIcon,
                  { backgroundColor: `${theme.colors.primary.main}20` },
                ]}
              >
                <Lock color={theme.colors.primary.main} size={20} />
              </View>
              <View style={styles.privacyContent}>
                <Text
                  style={[
                    styles.privacyTitle,
                    { color: theme.colors.text.primary },
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {t("weOnlyReadWhatYouChoose")}
                </Text>
                <Text
                  style={[
                    styles.privacyDesc,
                    { color: theme.colors.text.secondary },
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {t("weOnlyReadWhatYouChooseDesc")}
                </Text>
              </View>
            </View>

            <View style={styles.privacyItem}>
              <View
                style={[
                  styles.privacyIcon,
                  { backgroundColor: `${theme.colors.primary.main}20` },
                ]}
              >
                <Shield color={theme.colors.primary.main} size={20} />
              </View>
              <View style={styles.privacyContent}>
                <Text
                  style={[
                    styles.privacyTitle,
                    { color: theme.colors.text.primary },
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {t("weNeverSellHealthData")}
                </Text>
                <Text
                  style={[
                    styles.privacyDesc,
                    { color: theme.colors.text.secondary },
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {t("weNeverSellHealthDataDesc")}
                </Text>
              </View>
            </View>

            <View style={styles.privacyItem}>
              <View
                style={[
                  styles.privacyIcon,
                  { backgroundColor: `${theme.colors.primary.main}20` },
                ]}
              >
                <Settings color={theme.colors.primary.main} size={20} />
              </View>
              <View style={styles.privacyContent}>
                <Text
                  style={[
                    styles.privacyTitle,
                    { color: theme.colors.text.primary },
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {t("changePermissionsAnytime")}
                </Text>
                <Text
                  style={[
                    styles.privacyDesc,
                    { color: theme.colors.text.secondary },
                    isRTL && { textAlign: "left" },
                  ]}
                >
                  {t("changePermissionsAnytimeDesc")}
                </Text>
              </View>
            </View>
          </View>

          {/* Additional Privacy Info */}
          <View
            style={[
              styles.additionalPrivacyCard,
              {
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                borderColor: isDark ? "#1E293B" : "#E2E8F0",
              },
            ]}
          >
            <Text
              style={[
                styles.additionalPrivacyText,
                { color: theme.colors.text.secondary },
                isRTL && { textAlign: "left" },
              ]}
            >
              {t("readOnlyAccess")}
              {"\n"}
              {t("dataEncryptedSynced")}
              {"\n"}
              {t("usedForCaregiving")}
            </Text>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            onPress={() => router.push("/profile/health/apple-permissions")}
            style={[
              styles.primaryButton,
              { backgroundColor: theme.colors.primary.main },
            ]}
          >
            <Text style={styles.primaryButtonText}>{t("continue")}</Text>
            <ChevronRight
              color="#FFFFFF"
              size={20}
              style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.secondaryButton}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                { color: theme.colors.text.secondary },
                isRTL && { textAlign: "left" },
              ]}
            >
              {t("notNow")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonRTL: {
    transform: [{ scaleX: -1 }],
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  introSection: {
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter-Bold",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    textAlign: "center",
    lineHeight: 24,
  },
  rtlText: {
    textAlign: "right",
    fontFamily: "Inter-Regular",
  },
  section: {
    padding: 24,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
  },
  benefitCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  benefitContent: {
    flex: 1,
    marginStart: 16,
  },
  benefitTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  privacyCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  privacyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  privacyItemLast: {
    marginBottom: 0,
  },
  privacyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginEnd: 16,
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
    lineHeight: 22,
  },
  privacyDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  additionalPrivacyCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  additionalPrivacyText: {
    fontSize: 13,
    lineHeight: 20,
  },
  ctaSection: {
    padding: 24,
    paddingTop: 8,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    marginEnd: 8,
  },
  secondaryButton: {
    padding: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
});

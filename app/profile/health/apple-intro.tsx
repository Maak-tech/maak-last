/**
 * Apple Health Introduction Screen
 * Pre-permission explanation before requesting HealthKit access
 */

import { useRouter } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Heart, Shield, Lock, ChevronRight, ArrowLeft, Settings } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { Platform } from "react-native";

export default function AppleHealthIntroScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  if (Platform.OS !== "ios") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text }]}>
            Apple Health is only available on iOS devices.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={theme.text} />
          </TouchableOpacity>
          <Heart size={64} color={theme.primary} />
          <Text style={[styles.title, { color: theme.text }]}>
            Connect Apple Health
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Sync your health data to provide better care insights
          </Text>
        </View>

        {/* Benefits Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            What You'll Get
          </Text>

          <View style={styles.benefitCard}>
            <Shield size={24} color={theme.primary} />
            <View style={styles.benefitContent}>
              <Text style={[styles.benefitTitle, { color: theme.text }]}>
                Complete Health Picture
              </Text>
              <Text style={[styles.benefitDesc, { color: theme.textSecondary }]}>
                View all your health metrics in one place for better care coordination
              </Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <Heart size={24} color={theme.primary} />
            <View style={styles.benefitContent}>
              <Text style={[styles.benefitTitle, { color: theme.text }]}>
                Early Risk Detection
              </Text>
              <Text style={[styles.benefitDesc, { color: theme.textSecondary }]}>
                Track trends and identify potential health issues early
              </Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <Lock size={24} color={theme.primary} />
            <View style={styles.benefitContent}>
              <Text style={[styles.benefitTitle, { color: theme.text }]}>
                Your Data, Your Control
              </Text>
              <Text style={[styles.benefitDesc, { color: theme.textSecondary }]}>
                You choose exactly which metrics to share. Read-only access.
              </Text>
            </View>
          </View>
        </View>

        {/* Privacy Promise Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Your Privacy Promise
          </Text>
          
          <View
            style={[
              styles.privacyCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                borderColor: theme.primary + "40",
                borderWidth: 2,
              },
            ]}
          >
            <View style={styles.privacyItem}>
              <View style={[styles.privacyIcon, { backgroundColor: theme.primary + "20" }]}>
                <Lock size={20} color={theme.primary} />
              </View>
              <View style={styles.privacyContent}>
                <Text style={[styles.privacyTitle, { color: theme.text }]}>
                  We only read what you choose
                </Text>
                <Text style={[styles.privacyDesc, { color: theme.textSecondary }]}>
                  You have complete control. Select exactly which metrics to share, and we&apos;ll only access those.
                </Text>
              </View>
            </View>

            <View style={styles.privacyItem}>
              <View style={[styles.privacyIcon, { backgroundColor: theme.primary + "20" }]}>
                <Shield size={20} color={theme.primary} />
              </View>
              <View style={styles.privacyContent}>
                <Text style={[styles.privacyTitle, { color: theme.text }]}>
                  We never sell or share health data
                </Text>
                <Text style={[styles.privacyDesc, { color: theme.textSecondary }]}>
                  Your health data is yours alone. We never sell it, share it with third parties, or use it for advertising.
                </Text>
              </View>
            </View>

            <View style={styles.privacyItem}>
              <View style={[styles.privacyIcon, { backgroundColor: theme.primary + "20" }]}>
                <Settings size={20} color={theme.primary} />
              </View>
              <View style={styles.privacyContent}>
                <Text style={[styles.privacyTitle, { color: theme.text }]}>
                  You can change permissions anytime
                </Text>
                <Text style={[styles.privacyDesc, { color: theme.textSecondary }]}>
                  Update your selections or disconnect completely at any time through the app or iOS Settings.
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
            <Text style={[styles.additionalPrivacyText, { color: theme.textSecondary }]}>
              • Read-only access - we never write to your health data{"\n"}
              • Data is encrypted and securely synced{"\n"}
              • Used only for caregiving insights and health tracking
            </Text>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push("/profile/health/apple-permissions" as any)}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
            <ChevronRight size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.back()}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>
              Not Now
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
    padding: 24,
    alignItems: "center",
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: 24,
    top: 24,
    padding: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
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
    marginLeft: 16,
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
    marginRight: 16,
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
    marginRight: 8,
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


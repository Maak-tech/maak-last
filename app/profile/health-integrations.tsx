/**
 * Health Integrations Screen
 * Provider selection and management
 */

import { type Href, useNavigation, useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Heart,
} from "lucide-react-native";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import type { HealthProvider } from "@/lib/health/healthMetricsCatalog";
import { getProviderConnection } from "@/lib/health/healthSync";
import type { ProviderConnection } from "@/lib/health/healthTypes";
import { fitbitService } from "@/lib/services/fitbitService";
import { withingsService } from "@/lib/services/withingsService";

type ProviderOption = {
  id: HealthProvider;
  name: string;
  description: string;
  icon: typeof Heart;
  available: boolean;
  recommended?: boolean;
  comingSoon?: boolean;
  route: string;
};

export const options = {
  headerShown: false,
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this screen coordinates availability, connectivity, and navigation state in one view.
export default function HealthIntegrationsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [loading, setLoading] = useState(true);
  const [fitbitAvailable, setFitbitAvailable] = useState<boolean | null>(null);
  const [withingsAvailable, setWithingsAvailable] = useState<boolean | null>(
    null
  );
  const [connections, setConnections] = useState<
    Map<HealthProvider, ProviderConnection>
  >(new Map());

  // Hide the default header to prevent duplicate headers
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const providers: ProviderOption[] = [
    {
      id: "apple_health",
      name: t("appleHealth"),
      description: t("appleHealthDescription"),
      icon: Heart,
      available: Platform.OS === "ios",
      recommended: Platform.OS === "ios",
      route: "/profile/health/apple-intro",
    },
    {
      id: "health_connect",
      name: "Google Health Connect",
      description: "Secure health data platform for Android devices",
      icon: Heart,
      available: Platform.OS === "android",
      recommended: Platform.OS === "android",
      route: "/(settings)/health/healthconnect",
    },
    {
      id: "fitbit",
      name: t("fitbit"),
      description: t("fitbitDescription"),
      icon: Heart,
      available: fitbitAvailable === true,
      comingSoon: false,
      route: "/profile/health/fitbit-intro",
    },
    {
      id: "samsung_health",
      name: "Samsung Health",
      description: "Comprehensive health tracking from Samsung devices",
      icon: Heart,
      available: false,
      comingSoon: true,
      route: "/profile/health/samsung-health-intro",
    },
    {
      id: "garmin",
      name: "Garmin Connect",
      description: "Advanced fitness and health data from Garmin devices",
      icon: Heart,
      available: false,
      comingSoon: true,
      route: "/profile/health/garmin-intro",
    },
    {
      id: "withings",
      name: "Withings",
      description: "Smart scales and health monitors",
      icon: Heart,
      available: withingsAvailable === true,
      comingSoon: false,
      route: "/profile/health/withings-intro",
    },
    {
      id: "oura",
      name: "Oura Ring",
      description: "Sleep and readiness tracking with Oura Ring",
      icon: Heart,
      available: false,
      comingSoon: true,
      route: "/profile/health/oura-intro",
    },
    {
      id: "dexcom",
      name: "Dexcom CGM",
      description: "Continuous glucose monitoring for diabetes management",
      icon: Heart,
      available: false,
      comingSoon: true,
      route: "/profile/health/dexcom-intro",
    },
    {
      id: "freestyle_libre",
      name: "Freestyle Libre",
      description: "Continuous glucose monitoring system",
      icon: Heart,
      available: false, // Requires partnership with Abbott
      route: "/profile/health/freestyle-libre-intro",
    },
  ];

  // Static list of all provider IDs to check connections for
  const allProviderIds: HealthProvider[] = [
    "apple_health",
    "health_connect",
    "fitbit",
    "samsung_health",
    "garmin",
    "withings",
    "oura",
    "dexcom",
    "freestyle_libre",
  ];

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      const [fitbitAvailability, withingsAvailability] = await Promise.all([
        fitbitService.isAvailable(),
        withingsService.isAvailable(),
      ]);

      // Set availability state (true/false, not null)
      setFitbitAvailable(fitbitAvailability.available);
      setWithingsAvailable(withingsAvailability.available);

      const connectionsMap = new Map<HealthProvider, ProviderConnection>();

      // Use static list instead of providers array to avoid dependency issues
      for (const providerId of allProviderIds) {
        const connection = await getProviderConnection(providerId);
        if (connection) {
          connectionsMap.set(providerId, connection);
        }
      }

      setConnections(connectionsMap);
    } catch (_error) {
      // Set to false on error so they show as "Coming Soon" instead of platform error
      setFitbitAvailable(false);
      setWithingsAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: provider routing logic is intentionally explicit per-provider.
  const handleProviderPress = (provider: ProviderOption) => {
    if (!provider.available) {
      if (provider.comingSoon) {
        Alert.alert(
          isRTL ? "قريباً" : "Coming Soon",
          `${provider.name} ${isRTL ? "سيصبح متاحاً قريباً" : "will be available soon"}.`
        );
      } else {
        Alert.alert(
          t("notAvailable"),
          `${provider.name} ${isRTL ? "غير متاح على" : "is not available on"} ${Platform.OS === "ios" ? "iOS" : "Android"}.`
        );
      }
      return;
    }

    const connection = connections.get(provider.id);
    if (connection?.connected) {
      // Navigate to connected screen
      if (provider.id === "health_connect") {
        // Health Connect uses permissions screen for connected state
        router.push("/(settings)/health/healthconnect/permissions" as Href);
      } else {
        router.push(provider.route.replace("-intro", "-connected") as Href);
      }
    } else {
      // Navigate to intro screen
      router.push(provider.route as Href);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.colors.background.primary },
        ]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // Header styles with proper border color
  const headerBackgroundColor = isDark
    ? theme.colors.background.secondary
    : "#FFFFFF";
  const headerBorderColor = isDark ? theme.colors.border.medium : "#E2E8F0";

  const headerStyles = {
    backgroundColor: headerBackgroundColor,
    borderBottomColor: headerBorderColor,
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.primary },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, headerStyles]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
        >
          <ArrowLeft
            color={isDark ? theme.colors.text.primary : "#1E293B"}
            size={24}
            style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
          />
        </TouchableOpacity>

        <Text
          style={[
            styles.headerTitle,
            { color: isDark ? theme.colors.text.primary : "#1E293B" },
            isRTL && { textAlign: "left" },
          ]}
        >
          {isRTL ? "تكاملات البيانات الصحية" : "Health Integrations"}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Welcome Section */}
        <View
          style={[
            styles.welcomeSection,
            {
              backgroundColor: isDark
                ? theme.colors.background.secondary
                : "#FFFFFF",
            },
          ]}
        >
          <View
            style={[
              styles.welcomeIcon,
              { backgroundColor: `${theme.colors.primary.main}20` },
            ]}
          >
            <Heart color={theme.colors.primary.main} size={40} />
          </View>
          <Text
            style={[
              styles.welcomeTitle,
              { color: theme.colors.text.primary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {isRTL ? "تكاملات البيانات الصحية " : "Health Integrations"}
          </Text>
          <Text
            style={[
              styles.welcomeDescription,
              { color: theme.colors.text.secondary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {isRTL
              ? "قم بتوصيل مصادر البيانات الصحية لتوفير تحليلات أفضل ورعاية محسّنة"
              : "Connect health data sources to provide better insights and care"}
          </Text>
        </View>

        {/* Providers List */}
        <View style={styles.providersSection}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text.primary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {t("availableProviders")}
          </Text>

          {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: rendering cards keeps UI state colocated with labels/badges. */}
          {providers.map((provider) => {
            const connection = connections.get(provider.id);
            const isConnected = connection?.connected === true;
            const canInteract =
              provider.available || provider.comingSoon === true;

            return (
              <TouchableOpacity
                disabled={!canInteract}
                key={provider.id}
                onPress={() => handleProviderPress(provider)}
                style={[
                  styles.providerCard,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                    opacity: canInteract ? 1 : 0.5,
                  },
                ]}
              >
                <View style={styles.providerIconContainer}>
                  <provider.icon
                    color={
                      isConnected
                        ? theme.colors.accent.success
                        : theme.colors.primary.main
                    }
                    size={24}
                  />
                </View>

                <View style={styles.providerContent}>
                  <View style={styles.providerHeader}>
                    <Text
                      style={[
                        styles.providerName,
                        { color: theme.colors.text.primary },
                      ]}
                    >
                      {provider.name}
                    </Text>
                    {provider.recommended === true ? (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: `${theme.colors.primary.main}20` },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: theme.colors.primary.main },
                            isRTL && { textAlign: "left" },
                          ]}
                        >
                          {t("recommended")}
                        </Text>
                      </View>
                    ) : null}
                    {provider.comingSoon === true ? (
                      <View
                        style={[styles.badge, { backgroundColor: "#FF6B3520" }]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: "#FF6B35" },
                            isRTL && { textAlign: "left" },
                          ]}
                        >
                          {isRTL ? "قريباً" : "Coming Soon"}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text
                    style={[
                      styles.providerDesc,
                      { color: theme.colors.text.secondary },
                      isRTL && { textAlign: "left" },
                    ]}
                  >
                    {provider.description}
                  </Text>

                  {isConnected ? (
                    <View style={styles.statusRow}>
                      <Check color={theme.colors.accent.success} size={16} />
                      <Text
                        style={[
                          styles.statusText,
                          { color: theme.colors.accent.success },
                          isRTL && { textAlign: "left" },
                        ]}
                      >
                        {t("connected")} • {connection.selectedMetrics.length}{" "}
                        {t("metrics")}
                      </Text>
                    </View>
                  ) : null}

                  {!(provider.available || provider.comingSoon) && (
                    <View style={styles.statusRow}>
                      <AlertCircle
                        color={theme.colors.text.secondary}
                        size={16}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: theme.colors.text.secondary },
                          isRTL && { textAlign: "left" },
                        ]}
                      >
                        {t("notAvailableOnPlatform")}
                      </Text>
                    </View>
                  )}
                </View>

                {canInteract ? (
                  <ChevronRight color={theme.colors.text.secondary} size={20} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text
            style={[
              styles.infoTitle,
              { color: theme.colors.text.primary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {t("aboutHealthIntegrations")}
          </Text>
          <Text
            style={[
              styles.infoText,
              { color: theme.colors.text.secondary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {t("healthDataReadOnly")}
            {"\n"}
            {t("chooseMetricsToShare")}
            {"\n"}
            {t("dataEncrypted")}
            {"\n"}
            {t("disconnectAnytime")}
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
  scroll: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
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
    fontFamily: "Geist-SemiBold",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  welcomeSection: {
    alignItems: "center",
    paddingVertical: 32,
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontFamily: "Geist-Bold",
    marginBottom: 8,
    textAlign: "center",
  },
  welcomeDescription: {
    fontSize: 16,
    fontFamily: "Geist-Regular",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  rtlText: {
    textAlign: "right",
    fontFamily: "Geist-Regular",
  },
  providersSection: {
    padding: 24,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  providerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  providerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginEnd: 16,
  },
  providerContent: {
    flex: 1,
  },
  providerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  providerName: {
    fontSize: 17,
    fontWeight: "600",
    marginEnd: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  providerDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statusText: {
    fontSize: 13,
    marginStart: 6,
    fontWeight: "500",
  },
  infoSection: {
    padding: 24,
    paddingTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },
});

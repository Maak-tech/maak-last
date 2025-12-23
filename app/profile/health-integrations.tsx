/**
 * Health Integrations Screen
 * Provider selection and management
 */

import { useRouter, useNavigation } from "expo-router";
import { useState, useEffect, useCallback, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Heart, ChevronRight, Check, AlertCircle, ArrowLeft } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import type { HealthProvider } from "@/lib/health/healthMetricsCatalog";
import {
  getProviderConnection,
  disconnectProvider,
} from "@/lib/health/healthSync";
import type { ProviderConnection } from "@/lib/health/healthTypes";

interface ProviderOption {
  id: HealthProvider;
  name: string;
  description: string;
  icon: typeof Heart;
  available: boolean;
  recommended?: boolean;
  route: string;
}

export const options = {
  headerShown: false,
};

export default function HealthIntegrationsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [loading, setLoading] = useState(true);
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
      name: "Apple Health",
      description: "Sync data from Apple's Health app",
      icon: Heart,
      available: Platform.OS === "ios",
      recommended: Platform.OS === "ios",
      route: "/profile/health/apple-intro",
    },
    {
      id: "fitbit",
      name: "Fitbit",
      description: "Sync data from your Fitbit account",
      icon: Heart,
      available: true,
      route: "/profile/health/fitbit-intro",
    },
  ];

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      const connectionsMap = new Map<HealthProvider, ProviderConnection>();

      for (const provider of providers) {
        const connection = await getProviderConnection(provider.id);
        if (connection) {
          connectionsMap.set(provider.id, connection);
        }
      }

      setConnections(connectionsMap);
    } catch {
      // Silently handle error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleProviderPress = (provider: ProviderOption) => {
    if (!provider.available) {
      Alert.alert(
        "Not Available",
        `${provider.name} is not available on ${Platform.OS === "ios" ? "iOS" : "Android"}.`
      );
      return;
    }

    const connection = connections.get(provider.id);
    if (connection?.connected) {
      // Navigate to connected screen
      router.push(provider.route.replace("-intro", "-connected") as any);
    } else {
      // Navigate to intro screen
      router.push(provider.route as any);
    }
  };


  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? theme.colors.background.secondary : "#FFFFFF", borderBottomColor: isDark ? theme.colors.border : "#E2E8F0" }]}>
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

        <Text style={[styles.headerTitle, { color: isDark ? theme.colors.text.primary : "#1E293B" }, isRTL && styles.rtlText]}>
          {isRTL ? "تكاملات الصحة" : "Health Integrations"}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View style={[styles.welcomeSection, { backgroundColor: isDark ? theme.colors.background.secondary : "#FFFFFF" }]}>
          <View style={[styles.welcomeIcon, { backgroundColor: theme.colors.primary.main + "20" }]}>
            <Heart size={40} color={theme.colors.primary.main} />
          </View>
          <Text style={[styles.welcomeTitle, { color: theme.colors.text.primary }, isRTL && styles.rtlText]}>
            {isRTL ? "تكاملات الصحة" : "Health Integrations"}
          </Text>
          <Text style={[styles.welcomeDescription, { color: theme.colors.text.secondary }, isRTL && styles.rtlText]}>
            {isRTL
              ? "قم بتوصيل مصادر البيانات الصحية لتوفير رؤى أفضل ورعاية محسّنة"
              : "Connect health data sources to provide better insights and care"}
          </Text>
        </View>

        {/* Providers List */}
        <View style={styles.providersSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Available Providers
          </Text>

          {providers.map((provider) => {
            const connection = connections.get(provider.id);
            const isConnected = connection?.connected;

            return (
              <TouchableOpacity
                key={provider.id}
                style={[
                  styles.providerCard,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                    opacity: provider.available ? 1 : 0.5,
                  },
                ]}
                onPress={() => handleProviderPress(provider)}
                disabled={!provider.available}
              >
                <View style={styles.providerIconContainer}>
                  <provider.icon
                    size={24}
                    color={isConnected ? theme.colors.accent.success : theme.colors.primary.main}
                  />
                </View>

                <View style={styles.providerContent}>
                  <View style={styles.providerHeader}>
                    <Text style={[styles.providerName, { color: theme.colors.text.primary }]}>
                      {provider.name}
                    </Text>
                    {provider.recommended && (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: theme.colors.primary.main + "20" },
                        ]}
                      >
                        <Text
                          style={[styles.badgeText, { color: theme.colors.primary.main }]}
                        >
                          Recommended
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text
                    style={[styles.providerDesc, { color: theme.colors.text.secondary }]}
                  >
                    {provider.description}
                  </Text>

                  {isConnected && (
                    <View style={styles.statusRow}>
                      <Check size={16} color={theme.colors.accent.success} />
                      <Text
                        style={[styles.statusText, { color: theme.colors.accent.success }]}
                      >
                        Connected • {connection.selectedMetrics.length} metrics
                      </Text>
                    </View>
                  )}

                  {!provider.available && (
                    <View style={styles.statusRow}>
                      <AlertCircle size={16} color={theme.colors.text.secondary} />
                      <Text
                        style={[
                          styles.statusText,
                          { color: theme.colors.text.secondary },
                        ]}
                      >
                        Not available on this platform
                      </Text>
                    </View>
                  )}
                </View>

                {provider.available && (
                  <ChevronRight size={20} color={theme.colors.text.secondary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={[styles.infoTitle, { color: theme.colors.text.primary }]}>
            About Health Integrations
          </Text>
          <Text style={[styles.infoText, { color: theme.colors.text.secondary }]}>
            • Health data is read-only and fully under your control{"\n"}
            • You choose exactly which metrics to share{"\n"}
            • Data is encrypted and securely synced{"\n"}
            • You can disconnect anytime
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
    marginRight: 16,
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
    marginRight: 8,
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
    marginLeft: 6,
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


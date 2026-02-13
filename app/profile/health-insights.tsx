import { router } from "expo-router";
import { ArrowLeft, Brain } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AIInsightsDashboard } from "@/app/components/AIInsightsDashboard";
import HealthInsightsCard from "@/app/components/HealthInsightsCard";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";

export default function HealthInsightsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "transparent",
    },
    headerWrap: {
      marginHorizontal: -24,
      marginBottom: -20,
    },
    headerContent: {
      paddingHorizontal: 24,
      paddingTop: 140,
      paddingBottom: 12,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 40,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "rgba(0, 53, 67, 0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
    },
    headerTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    headerTitleText: {
      fontSize: 22,
      fontFamily: "Inter-Bold",
      color: "#003543",
    },
    headerSubtitle: {
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: "rgba(0, 53, 67, 0.85)",
      marginTop: 4,
    },
    content: {
      paddingHorizontal: 24,
      paddingTop: 40,
      paddingBottom: 40,
    },
    rtlText: {
      textAlign: "right",
    },
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  if (!user) {
    return null;
  }

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor="#003543"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerWrap}>
          <WavyBackground
            contentPosition="top"
            curve="home"
            height={280}
            variant="teal"
          >
            <View style={styles.headerContent}>
              <View
                style={[
                  styles.headerRow,
                  isRTL && { flexDirection: "row-reverse" as const },
                ]}
              >
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.backButton}
                >
                  <ArrowLeft
                    color="#003543"
                    size={20}
                    style={
                      isRTL ? { transform: [{ rotate: "180deg" }] } : undefined
                    }
                  />
                </TouchableOpacity>
                <View style={styles.headerTitle}>
                  <View
                    style={[
                      styles.headerTitleRow,
                      isRTL && { flexDirection: "row-reverse" as const },
                    ]}
                  >
                    <Brain color="#EB9C0C" size={20} />
                    <Text style={styles.headerTitleText}>
                      {t("healthInsights", "Health Insights")}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.headerSubtitle, isRTL && styles.rtlText]}
                  >
                    {t("healthInsightsSubtitle")}
                  </Text>
                </View>
              </View>
            </View>
          </WavyBackground>
        </View>

        <AIInsightsDashboard
          compact={false}
          embedded={true}
          key={`health-insights-dashboard-${refreshKey}`}
          onInsightPress={() => router.push("/(tabs)/analytics")}
        />
        <HealthInsightsCard key={`health-insights-card-${refreshKey}`} />
      </ScrollView>
    </GradientScreen>
  );
}

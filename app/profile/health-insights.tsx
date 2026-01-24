import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { AIInsightsDashboard } from "@/app/components/AIInsightsDashboard";
import HealthInsightsCard from "@/app/components/HealthInsightsCard";
import { Heading } from "@/components/design-system/Typography";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { createThemedStyles } from "@/utils/styles";

export default function HealthInsightsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";
  const [refreshing, setRefreshing] = useState(false);

  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    backButton: {
      marginRight: isRTL ? 0 : theme.spacing.md,
      marginLeft: isRTL ? theme.spacing.md : 0,
    },
    headerTitle: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    contentInner: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.base,
    },
  }))(theme);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Refresh will be handled by the components themselves
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  if (!user) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container as ViewStyle}>
      <View style={styles.header as ViewStyle}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton as ViewStyle}
        >
          <ChevronLeft
            color={theme.colors.text.primary}
            size={24}
            style={isRTL ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </TouchableOpacity>
        <View style={styles.headerTitle as ViewStyle}>
          <Heading color={theme.colors.text.primary} level={4}>
            {t("healthInsights")}
          </Heading>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.contentInner as ViewStyle}
        refreshControl={
          <RefreshControl onRefresh={onRefresh} refreshing={refreshing} />
        }
        showsVerticalScrollIndicator={false}
        style={styles.content as ViewStyle}
      >
        <HealthInsightsCard />
        <AIInsightsDashboard
          compact={false}
          onInsightPress={(insight) => {
            // Navigate to analytics tab for detailed view
            router.push("/(tabs)/analytics");
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

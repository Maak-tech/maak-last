import { Shield, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";
import { Badge } from "@/components/design-system/AdditionalComponents";
import {
  Heading,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAnomalyDetection } from "@/hooks/useAnomalyDetection";
import { createThemedStyles, getTextStyle } from "@/utils/styles";
import AnomalyAlertCard from "./AnomalyAlertCard";

export default function AnomalyDashboardSection() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const { recentAnomalies, anomalyStats, loading, acknowledge } =
    useAnomalyDetection(user?.id, { historyDays: 1 });

  const styles = createThemedStyles((t) => ({
    container: {
      marginBottom: t.spacing.base,
    } as ViewStyle,
    header: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: t.spacing.base,
    } as ViewStyle,
    headerLeft: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.sm,
    } as ViewStyle,
    headerTitle: getTextStyle(t, "subheading", "bold", t.colors.text.primary),
    normalContainer: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.sm,
      padding: t.spacing.base,
      borderRadius: t.spacing.sm,
      backgroundColor: "#10B98115",
    } as ViewStyle,
    normalText: getTextStyle(t, "body", "regular", "#10B981"),
    emptyContainer: {
      padding: t.spacing.xl,
      alignItems: "center" as const,
    } as ViewStyle,
    rtlText: {
      textAlign: (isRTL ? "right" : "left") as "left" | "right",
    },
  }))(theme);

  if (!user) return null;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <ActivityIndicator color={theme.colors.primary.main} size="small" />
        </View>
      </View>
    );
  }

  // Filter to unacknowledged anomalies
  const activeAnomalies = recentAnomalies.filter((a) => !a.acknowledged);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Shield
            color={
              activeAnomalies.length > 0
                ? theme.colors.accent.warning
                : "#10B981"
            }
            size={20}
          />
          <Heading
            level={6}
            style={[styles.headerTitle, isRTL && styles.rtlText]}
          >
            {isRTL ? "مراقبة العلامات الحيوية" : "Vital Monitoring"}
          </Heading>
          {activeAnomalies.length > 0 && (
            <Badge
              size="small"
              style={{ borderColor: theme.colors.accent.warning }}
              variant="outline"
            >
              {activeAnomalies.length}
            </Badge>
          )}
        </View>
      </View>

      {activeAnomalies.length === 0 ? (
        <View style={styles.normalContainer}>
          <ShieldCheck color="#10B981" size={24} />
          <TypographyText style={[styles.normalText, isRTL && styles.rtlText]}>
            {isRTL
              ? "علاماتك الحيوية ضمن النطاق الطبيعي"
              : "Your vitals are within normal range"}
          </TypographyText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingRight: isRTL ? 0 : theme.spacing.base,
            paddingLeft: isRTL ? theme.spacing.base : 0,
          }}
          horizontal={activeAnomalies.length > 1}
          showsHorizontalScrollIndicator={false}
        >
          {activeAnomalies.map((anomaly) => (
            <AnomalyAlertCard
              anomaly={anomaly}
              compact={activeAnomalies.length > 1}
              key={anomaly.id}
              onAcknowledge={acknowledge}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

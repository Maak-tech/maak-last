/**
 * VHIContextBanner
 *
 * Shown on the home screen when the user's VHI composite risk is > 60.
 * Surfaces the top declining factor and links to the Nora tab.
 */

import { useRouter } from "expo-router";
import { AlertTriangle, ChevronRight, TrendingDown } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View, type ViewStyle } from "react-native";
import { Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import { api, ApiError } from "@/lib/apiClient";
import type { VirtualHealthIdentity } from "@/types/vhi";

type VHIResponse = { data: VirtualHealthIdentity } | null;

export default function VHIContextBanner() {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const router = useRouter();
  const isArabic = i18n.language.startsWith("ar");

  const [compositeRisk, setCompositeRisk] = useState<number | null>(null);
  const [topDeclining, setTopDeclining] = useState<string | null>(null);
  const [trajectory, setTrajectory] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<VHIResponse>("/api/vhi/me")
      .then((res) => {
        if (!res?.data) return;
        const vhi = res.data;
        setCompositeRisk(vhi.currentState.riskScores.compositeRisk);
        setTopDeclining(vhi.decliningFactors[0]?.factor ?? null);
        // Infer trajectory from top declining factor impact
        const topImpact = vhi.decliningFactors[0]?.impact;
        setTrajectory(topImpact === "high" ? "worsening" : topImpact === "medium" ? "stable" : null);
      })
      .catch((err) => {
        // Silently ignore — banner is optional
        if (!(err instanceof ApiError)) {
          console.warn("[VHIContextBanner]", err);
        }
      });
  }, []);

  if (compositeRisk === null || compositeRisk <= 60) return null;

  const isUrgent = compositeRisk > 75;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push("/(tabs)/nora")}
      style={[
        styles.container,
        {
          backgroundColor: isUrgent
            ? theme.colors.accent.error + "18"
            : theme.colors.accent.warning + "18",
          borderColor: isUrgent
            ? theme.colors.accent.error
            : theme.colors.accent.warning,
        },
      ]}
    >
      <View style={styles.iconRow}>
        {isUrgent ? (
          <AlertTriangle color={theme.colors.accent.error} size={18} />
        ) : (
          <TrendingDown color={theme.colors.accent.warning} size={18} />
        )}
        <View style={styles.textBlock}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: isUrgent ? theme.colors.accent.error : theme.colors.accent.warning,
            }}
          >
            {isArabic
              ? `هويتك الصحية تُظهر تغييرات اليوم`
              : `Your health identity shows changes today`}
          </Text>
          {topDeclining ? (
            <Text style={{ fontSize: 12, color: theme.colors.text.secondary, marginTop: 2 }}>
              {topDeclining}
            </Text>
          ) : null}
        </View>
        <ChevronRight color={theme.colors.text.secondary} size={16} />
      </View>
    </TouchableOpacity>
  );
}

const styles = {
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  } as ViewStyle,
  iconRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  } as ViewStyle,
  textBlock: {
    flex: 1,
  } as ViewStyle,
};

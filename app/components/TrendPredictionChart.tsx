import { LineChart } from "react-native-chart-kit";
import { Dimensions, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";
import { chartsService, type TrendPrediction } from "@/lib/services/chartsService";
import { Caption, Heading, Text } from "@/components/design-system/Typography";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { TrendingDown, TrendingUp, Minus } from "lucide-react-native";

interface TrendPredictionChartProps {
  prediction: TrendPrediction;
  title: string;
  yAxisLabel?: string;
  yAxisSuffix?: string;
  height?: number;
}

export default function TrendPredictionChart({
  prediction,
  title,
  yAxisLabel,
  yAxisSuffix = "",
  height = 220,
}: TrendPredictionChartProps) {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const screenWidth = Dimensions.get("window").width;
  const locale = i18n.language === "ar" ? "ar" : "en-US";

  // Combine historical and predicted data
  const allLabels = [
    ...prediction.historical.map((p) =>
      typeof p.x === "string"
        ? new Date(p.x).toLocaleDateString(locale, { month: "short", day: "numeric" })
        : String(p.x)
    ),
    ...prediction.predicted.map((p) =>
      typeof p.x === "string"
        ? new Date(p.x).toLocaleDateString(locale, { month: "short", day: "numeric" })
        : String(p.x)
    ),
  ];

  const historicalData = prediction.historical.map((p) => p.y);
  const predictedData = prediction.predicted.map((p) => p.y);

  // Create a combined dataset with historical and predicted separated
  const combinedData = [...historicalData, ...predictedData];

  const chartConfig = {
    backgroundColor: theme.colors.background.secondary,
    backgroundGradientFrom: theme.colors.background.secondary,
    backgroundGradientTo: theme.colors.background.secondary,
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(30, 41, 59, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "4",
      strokeWidth: "2",
    },
    propsForBackgroundLines: {
      strokeDasharray: "", // solid lines
      stroke: theme.colors.border.light,
      strokeWidth: 1,
    },
  };

  const getTrendIcon = () => {
    switch (prediction.trend) {
      case "increasing":
        return <TrendingUp size={16} color={theme.colors.accent.error} />;
      case "decreasing":
        return <TrendingDown size={16} color={theme.colors.accent.success} />;
      default:
        return <Minus size={16} color={theme.colors.text.secondary} />;
    }
  };

  const getTrendLabel = () => {
    switch (prediction.trend) {
      case "increasing":
        return "Increasing";
      case "decreasing":
        return "Decreasing";
      default:
        return "Stable";
    }
  };

  return (
    <View style={{ marginVertical: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 8 }}>
        <Heading level={6} style={{}}>{title}</Heading>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {getTrendIcon()}
          <Badge
            variant={
              prediction.trend === "increasing"
                ? "error"
                : prediction.trend === "decreasing"
                  ? "success"
                  : "outline"
            }
            size="small"
            style={{}}
          >
            {getTrendLabel()}
          </Badge>
        </View>
      </View>

      <LineChart
        data={{
          labels: allLabels,
          datasets: [
            {
              data: combinedData,
              color: (opacity: number) => `rgba(59, 130, 246, ${opacity})`,
              strokeWidth: 2,
            },
          ],
        }}
        width={screenWidth - 32}
        height={height}
        yAxisLabel={yAxisLabel || ""}
        yAxisSuffix={yAxisSuffix}
        chartConfig={chartConfig}
        bezier
        style={{
          marginVertical: 8,
          borderRadius: 16,
          marginHorizontal: 16,
        }}
        withInnerLines={true}
        withOuterLines={true}
        withVerticalLines={true}
        withHorizontalLines={true}
        withDots={true}
        withShadow={false}
        segments={4}
      />

      {/* Prediction indicator */}
      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
        <View
          style={{
            height: 2,
            backgroundColor: theme.colors.border.medium,
            marginBottom: 4,
            position: "relative",
          }}
        >
          <View
            style={{
              position: "absolute",
              left: `${(prediction.historical.length / combinedData.length) * 100}%`,
              width: "100%",
              height: 2,
              backgroundColor: theme.colors.primary.main,
              opacity: 0.5,
            }}
          />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Caption style={{}} numberOfLines={1}>
            {t("historical", "Historical")}
          </Caption>
          <Caption style={{}} numberOfLines={1}>
            {t("predictedWithConfidence", "Predicted ({{percent}}% confidence)", {
              percent: (prediction.confidence * 100).toFixed(0),
            })}
          </Caption>
        </View>
      </View>
    </View>
  );
}

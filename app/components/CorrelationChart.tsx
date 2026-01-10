import { Dimensions, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { chartsService, type CorrelationData } from "@/lib/services/chartsService";
import { Caption, Heading, Text } from "@/components/design-system/Typography";
import { Badge } from "@/components/design-system/AdditionalComponents";

interface CorrelationChartProps {
  data: CorrelationData;
  title?: string;
  height?: number;
}

export default function CorrelationChart({
  data,
  title,
  height = 250,
}: CorrelationChartProps) {
  const { theme } = useTheme();
  const screenWidth = Dimensions.get("window").width;

  // Convert correlation data to scatter chart format
  const scatterData = data.dataPoints.map((point) => ({
    x: point.x,
    y: point.y,
  }));

  // Calculate min/max for axes
  const xValues = scatterData.map((p) => p.x);
  const yValues = scatterData.map((p) => p.y);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

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
  };

  const getCorrelationLabel = () => {
    const absCorr = Math.abs(data.correlation);
    if (absCorr > 0.7) return "Strong";
    if (absCorr > 0.4) return "Moderate";
    if (absCorr > 0.2) return "Weak";
    return "None";
  };

  const getCorrelationColor = () => {
    const absCorr = Math.abs(data.correlation);
    if (absCorr > 0.4) {
      return data.correlation > 0 ? theme.colors.accent.error : theme.colors.accent.success;
    }
    return theme.colors.text.secondary;
  };

  return (
    <View style={{ marginVertical: 16 }}>
      {title && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 8 }}>
          <Heading level={6} style={undefined}>{title}</Heading>
          <Badge
            variant={Math.abs(data.correlation) > 0.4 ? (data.correlation > 0 ? "error" : "success") : "outline"}
            size="small"
            style={undefined}
          >
            {getCorrelationLabel()} ({data.correlation.toFixed(2)})
          </Badge>
        </View>
      )}
      
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <Caption numberOfLines={undefined} style={{ textAlign: "center" }}>
          {data.xLabel} vs {data.yLabel}
        </Caption>
      </View>

      {/* Note: react-native-chart-kit doesn't have ScatterChart, so we'll use a custom visualization */}
      <View
        style={{
          height,
          backgroundColor: theme.colors.background.secondary,
          borderRadius: 16,
          marginHorizontal: 16,
          padding: 16,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ marginBottom: 16, textAlign: "center" }}>
          Correlation: {data.correlation.toFixed(3)}
        </Text>
        <Text style={{ fontSize: 12, color: theme.colors.text.secondary, textAlign: "center" }}>
          {data.trend === "positive"
            ? "Higher medication compliance correlates with lower symptom severity"
            : data.trend === "negative"
              ? "Lower medication compliance correlates with higher symptom severity"
              : "No significant correlation found"}
        </Text>
      </View>
    </View>
  );
}

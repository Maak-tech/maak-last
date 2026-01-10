import { LineChart } from "react-native-chart-kit";
import { Dimensions, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { chartsService, type TimeSeriesData } from "@/lib/services/chartsService";
import { Caption, Heading, Text } from "@/components/design-system/Typography";

interface HealthChartProps {
  data: TimeSeriesData;
  title: string;
  yAxisLabel?: string;
  yAxisSuffix?: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
}

export default function HealthChart({
  data,
  title,
  yAxisLabel,
  yAxisSuffix = "",
  height = 220,
  showLegend = true,
  showGrid = true,
}: HealthChartProps) {
  const { theme } = useTheme();
  const screenWidth = Dimensions.get("window").width;

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
      stroke: theme.colors.primary.main,
    },
    propsForBackgroundLines: {
      strokeDasharray: "", // solid lines
      stroke: theme.colors.border.light,
      strokeWidth: 1,
    },
  };

  // Prepare data for chart-kit
  const chartData = {
    labels: data.labels,
    datasets: data.datasets.map((dataset) => ({
      data: dataset.data,
      color: dataset.color || ((opacity: number) => `rgba(59, 130, 246, ${opacity})`),
      strokeWidth: dataset.strokeWidth || 2,
    })),
  };

  return (
    <View style={{ marginVertical: 16 }}>
      {title && (
        <Heading level={6} style={{ marginBottom: 8, paddingHorizontal: 16 }}>
          {title}
        </Heading>
      )}
      <LineChart
        data={{
          labels: chartData.labels,
          datasets: chartData.datasets,
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
        withInnerLines={showGrid}
        withOuterLines={showGrid}
        withVerticalLines={showGrid}
        withHorizontalLines={showGrid}
        withDots={true}
        withShadow={false}
        segments={4}
      />
    </View>
  );
}

import { LineChart } from "react-native-chart-kit";
import { Dimensions, View, ScrollView, TouchableOpacity } from "react-native";
import { useState } from "react";
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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

  // Calculate max value for better scaling
  const maxValue = Math.max(
    ...chartData.datasets.flatMap((dataset) => dataset.data),
    1
  );

  return (
    <View style={{ marginVertical: 16 }}>
      {title && (
        <Heading level={6} style={{ marginBottom: 8, paddingHorizontal: 16 }}>
          {title}
        </Heading>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        <View>
          <LineChart
            data={{
              labels: chartData.labels,
              datasets: chartData.datasets,
            }}
            width={Math.max(screenWidth - 32, chartData.labels.length * 40)}
            height={height}
            yAxisLabel={yAxisLabel || ""}
            yAxisSuffix={yAxisSuffix}
            chartConfig={chartConfig}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
            withInnerLines={showGrid}
            withOuterLines={showGrid}
            withVerticalLines={showGrid}
            withHorizontalLines={showGrid}
            withDots={true}
            withShadow={false}
            segments={4}
            onDataPointClick={(dataPoint) => {
              setSelectedIndex(dataPoint.index);
            }}
          />
          {/* Tooltip for selected data point */}
          {selectedIndex !== null && chartData.labels[selectedIndex] && (
            <View
              style={{
                position: "absolute",
                top: 20,
                left: 16 + (selectedIndex * Math.max(screenWidth - 32, chartData.labels.length * 40)) / chartData.labels.length - 50,
                backgroundColor: theme.colors.background.primary,
                padding: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: theme.colors.border.light,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
                zIndex: 1000,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: theme.colors.text.primary }}>
                {chartData.labels[selectedIndex]}
              </Text>
              {chartData.datasets.map((dataset, idx) => (
                <Text
                  key={idx}
                  style={{ fontSize: 11, color: theme.colors.text.secondary, marginTop: 2 }}
                >
                  {yAxisLabel} {dataset.data[selectedIndex]?.toFixed(1)}{yAxisSuffix}
                </Text>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      {/* Legend */}
      {showLegend && chartData.datasets.length > 1 && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            flexWrap: "wrap",
            paddingHorizontal: 16,
            marginTop: 8,
          }}
        >
          {chartData.datasets.map((dataset, index) => (
            <View
              key={index}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginHorizontal: 8,
                marginVertical: 4,
              }}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: dataset.color?.(1) || theme.colors.primary.main,
                  marginRight: 6,
                }}
              />
              <Caption style={{}} numberOfLines={undefined}>Dataset {index + 1}</Caption>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

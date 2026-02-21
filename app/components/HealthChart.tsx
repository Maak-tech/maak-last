import { useState } from "react";
import { Dimensions, ScrollView, View } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Caption, Heading, Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { TimeSeriesData } from "@/lib/services/chartsService";

type HealthChartProps = {
  data: TimeSeriesData;
  title: string;
  yAxisLabel?: string;
  yAxisSuffix?: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  phaseByIndex?: Array<
    "period" | "follicular" | "fertile" | "ovulation" | "luteal" | "unknown"
  >;
};

export default function HealthChart({
  data,
  title,
  yAxisLabel,
  yAxisSuffix = "",
  height = 220,
  showLegend = true,
  showGrid = true,
  phaseByIndex,
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
      color:
        dataset.color ||
        ((opacity: number) => `rgba(59, 130, 246, ${opacity})`),
      strokeWidth: dataset.strokeWidth || 2,
    })),
  };

  const phaseColors: Record<
    NonNullable<HealthChartProps["phaseByIndex"]>[number],
    string
  > = {
    period: "rgba(239, 68, 68, 0.35)",
    follicular: "rgba(59, 130, 246, 0.22)",
    fertile: "rgba(16, 185, 129, 0.22)",
    ovulation: "rgba(245, 158, 11, 0.25)",
    luteal: "rgba(139, 92, 246, 0.22)",
    unknown: "rgba(148, 163, 184, 0.12)",
  };

  return (
    <View style={{ marginVertical: 16 }}>
      {title ? (
        <Heading level={6} style={{ marginBottom: 8, paddingHorizontal: 16 }}>
          {title}
        </Heading>
      ) : null}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16 }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View>
          {phaseByIndex && phaseByIndex.length === chartData.labels.length ? (
            <View
              style={{
                flexDirection: "row",
                height: 8,
                borderRadius: 16,
                overflow: "hidden",
                marginTop: 6,
                marginBottom: 2,
                width: Math.max(screenWidth - 32, chartData.labels.length * 40),
              }}
            >
              {chartData.labels.map((label, idx) => {
                const phase = phaseByIndex[idx] || "unknown";
                return (
                  <View
                    key={`${label}-${phase}`}
                    style={{
                      flex: 1,
                      backgroundColor:
                        phaseColors[phase] || phaseColors.unknown,
                    }}
                  />
                );
              })}
            </View>
          ) : null}
          <LineChart
            bezier
            chartConfig={chartConfig}
            data={{
              labels: chartData.labels,
              datasets: chartData.datasets,
            }}
            height={height}
            onDataPointClick={(dataPoint) => {
              setSelectedIndex(dataPoint.index);
            }}
            segments={4}
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
            width={Math.max(screenWidth - 32, chartData.labels.length * 40)}
            withDots={true}
            withHorizontalLines={showGrid}
            withInnerLines={showGrid}
            withOuterLines={showGrid}
            withShadow={false}
            withVerticalLines={showGrid}
            yAxisLabel={yAxisLabel || ""}
            yAxisSuffix={yAxisSuffix}
          />
          {/* Tooltip for selected data point */}
          {selectedIndex !== null && chartData.labels[selectedIndex] && (
            <View
              style={{
                position: "absolute",
                top: 20,
                left:
                  16 +
                  (selectedIndex *
                    Math.max(screenWidth - 32, chartData.labels.length * 40)) /
                    chartData.labels.length -
                  50,
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
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: theme.colors.text.primary,
                }}
              >
                {chartData.labels[selectedIndex]}
              </Text>
              {chartData.datasets.map((dataset) => (
                <Text
                  key={`${dataset.strokeWidth ?? 2}-${dataset.data.join(",")}`}
                  style={{
                    fontSize: 11,
                    color: theme.colors.text.secondary,
                    marginTop: 2,
                  }}
                >
                  {yAxisLabel} {dataset.data[selectedIndex]?.toFixed(1)}
                  {yAxisSuffix}
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
              key={`legend-${dataset.strokeWidth ?? 2}-${dataset.data.join(",")}`}
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
                  backgroundColor:
                    dataset.color?.(1) || theme.colors.primary.main,
                  marginRight: 6,
                }}
              />
              <Caption numberOfLines={undefined} style={{}}>
                Dataset {index + 1}
              </Caption>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

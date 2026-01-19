import { Dimensions, ScrollView, View } from "react-native";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { Caption, Heading, Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { CorrelationData } from "@/lib/services/chartsService";

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
      return data.correlation > 0
        ? theme.colors.accent.error
        : theme.colors.accent.success;
    }
    return theme.colors.text.secondary;
  };

  return (
    <View style={{ marginVertical: 16 }}>
      {title && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 16,
            marginBottom: 8,
          }}
        >
          <Heading level={6} style={undefined}>
            {title}
          </Heading>
          <Badge
            size="small"
            style={undefined}
            variant={
              Math.abs(data.correlation) > 0.4
                ? data.correlation > 0
                  ? "error"
                  : "success"
                : "outline"
            }
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

      {/* Custom scatter plot visualization */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: 16 }}
      >
        <View
          style={{
            height,
            backgroundColor: theme.colors.background.secondary,
            borderRadius: 16,
            padding: 16,
            minWidth: Dimensions.get("window").width - 32,
          }}
        >
          {data.dataPoints.length > 0 ? (
            <Svg
              height={height - 32}
              width={Dimensions.get("window").width - 64}
            >
              {/* Calculate scales */}
              <G>
                {/* Y-axis label */}
                <SvgText
                  fill={theme.colors.text.secondary}
                  fontSize="12"
                  transform={`rotate(-90, 20, ${height / 2 - 80})`}
                  x={20}
                  y={height / 2 - 80}
                >
                  {data.yLabel}
                </SvgText>

                {/* X-axis label */}
                <SvgText
                  fill={theme.colors.text.secondary}
                  fontSize="12"
                  textAnchor="middle"
                  x={(Dimensions.get("window").width - 64) / 2}
                  y={height - 40}
                >
                  {data.xLabel}
                </SvgText>

                {/* Draw scatter points */}
                {data.dataPoints.map((point, index) => {
                  const chartWidth = Dimensions.get("window").width - 64;
                  const chartHeight = height - 80;
                  const padding = 40;

                  // Normalize coordinates
                  const xValues = data.dataPoints.map((p) => p.x);
                  const yValues = data.dataPoints.map((p) => p.y);
                  const xMin = Math.min(...xValues);
                  const xMax = Math.max(...xValues) || 1;
                  const yMin = Math.min(...yValues);
                  const yMax = Math.max(...yValues) || 1;

                  const normalizedX =
                    padding +
                    ((point.x - xMin) / (xMax - xMin || 1)) *
                      (chartWidth - padding * 2);
                  const normalizedY =
                    padding +
                    (1 - (point.y - yMin) / (yMax - yMin || 1)) *
                      (chartHeight - padding * 2);

                  return (
                    <Circle
                      cx={normalizedX}
                      cy={normalizedY}
                      fill={theme.colors.primary.main}
                      key={index}
                      opacity={0.6}
                      r="4"
                    />
                  );
                })}

                {/* Draw trend line if correlation is significant */}
                {Math.abs(data.correlation) > 0.3 &&
                  data.dataPoints.length > 1 && (
                    <Line
                      opacity={0.5}
                      stroke={theme.colors.primary.main}
                      strokeDasharray="5,5"
                      strokeWidth="2"
                      x1={40}
                      x2={Dimensions.get("window").width - 64 - 40}
                      y1={
                        40 +
                        (1 -
                          (data.dataPoints[0].y -
                            Math.min(...data.dataPoints.map((p) => p.y))) /
                            (Math.max(...data.dataPoints.map((p) => p.y)) -
                              Math.min(...data.dataPoints.map((p) => p.y)) ||
                              1)) *
                          (height - 120)
                      }
                      y2={
                        40 +
                        (1 -
                          (data.dataPoints[data.dataPoints.length - 1].y -
                            Math.min(...data.dataPoints.map((p) => p.y))) /
                            (Math.max(...data.dataPoints.map((p) => p.y)) -
                              Math.min(...data.dataPoints.map((p) => p.y)) ||
                              1)) *
                          (height - 120)
                      }
                    />
                  )}
              </G>
            </Svg>
          ) : (
            <View
              style={{
                justifyContent: "center",
                alignItems: "center",
                flex: 1,
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  color: theme.colors.text.secondary,
                }}
              >
                No data available for correlation analysis
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

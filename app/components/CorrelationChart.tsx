import { Dimensions, ScrollView, View } from "react-native";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { Caption, Heading, Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { CorrelationData } from "@/lib/services/chartsService";

type CorrelationChartProps = {
  data: CorrelationData;
  title?: string;
  height?: number;
};

export default function CorrelationChart({
  data,
  title,
  height = 250,
}: CorrelationChartProps) {
  const { theme } = useTheme();
  const viewportWidth = Dimensions.get("window").width;
  const chartWidth = viewportWidth - 64;
  const chartHeight = height - 80;
  const chartPadding = 40;
  const pointXValues = data.dataPoints.map((point) => point.x);
  const pointYValues = data.dataPoints.map((point) => point.y);
  const pointXMin = Math.min(...pointXValues);
  const pointXMax = Math.max(...pointXValues) || 1;
  const pointYMin = Math.min(...pointYValues);
  const pointYMax = Math.max(...pointYValues) || 1;

  const getCorrelationLabel = () => {
    const absCorr = Math.abs(data.correlation);
    if (absCorr > 0.7) {
      return "Strong";
    }
    if (absCorr > 0.4) {
      return "Moderate";
    }
    if (absCorr > 0.2) {
      return "Weak";
    }
    return "None";
  };

  const getCorrelationVariant = (): "error" | "success" | "outline" => {
    if (Math.abs(data.correlation) <= 0.4) {
      return "outline";
    }
    return data.correlation > 0 ? "error" : "success";
  };

  const normalizePointX = (x: number): number =>
    chartPadding +
    ((x - pointXMin) / (pointXMax - pointXMin || 1)) *
      (chartWidth - chartPadding * 2);
  const normalizePointY = (y: number): number =>
    chartPadding +
    (1 - (y - pointYMin) / (pointYMax - pointYMin || 1)) *
      (chartHeight - chartPadding * 2);

  return (
    <View style={{ marginVertical: 16 }}>
      {title ? (
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
            variant={getCorrelationVariant()}
          >
            {getCorrelationLabel()} ({data.correlation.toFixed(2)})
          </Badge>
        </View>
      ) : null}

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
            <Svg height={height - 32} width={chartWidth}>
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
                  x={chartWidth / 2}
                  y={height - 40}
                >
                  {data.xLabel}
                </SvgText>

                {/* Draw scatter points */}
                {data.dataPoints.map((point) => (
                  <Circle
                    cx={normalizePointX(point.x)}
                    cy={normalizePointY(point.y)}
                    fill={theme.colors.primary.main}
                    key={`point-${point.x}-${point.y}`}
                    opacity={0.6}
                    r="4"
                  />
                ))}

                {/* Draw trend line if correlation is significant */}
                {Math.abs(data.correlation) > 0.3 &&
                data.dataPoints.length > 1 ? (
                  <Line
                    opacity={0.5}
                    stroke={theme.colors.primary.main}
                    strokeDasharray="5,5"
                    strokeWidth="2"
                    x1={chartPadding}
                    x2={chartWidth - chartPadding}
                    y1={normalizePointY(data.dataPoints[0].y)}
                    y2={normalizePointY(data.dataPoints.at(-1)?.y ?? 0)}
                  />
                ) : null}
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

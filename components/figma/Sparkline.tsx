import Svg, {
  Defs,
  LinearGradient,
  Polygon,
  Polyline,
  Stop,
} from "react-native-svg";

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
};

const normalizePoints = (
  data: number[],
  width: number,
  height: number,
  padding: number
) => {
  if (data.length <= 1) {
    return "";
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  return data
    .map((value, index) => {
      const x = padding + (usableWidth * index) / (data.length - 1);
      const y = height - padding - ((value - min) / range) * usableHeight;
      return `${x},${y}`;
    })
    .join(" ");
};

export default function Sparkline({
  data,
  width = 60,
  height = 30,
  color = "#10B981",
}: SparklineProps) {
  if (!data || data.length === 0) {
    return null;
  }

  // If only one data point, create a horizontal line
  let points: string;
  if (data.length === 1) {
    const y = height / 2;
    points = `2,${y} ${width - 2},${y}`;
  } else {
    points = normalizePoints(data, width, height, 2);
  }

  // Build closed polygon for gradient fill (line points + bottom corners)
  const fillPoints = `2,${height} ${points} ${width - 2},${height}`;

  const gradientId = `sparkGrad-${color.replace("#", "")}`;

  return (
    <Svg height={height} width={width}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.25} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Polygon fill={`url(#${gradientId})`} points={fillPoints} stroke="none" />
      <Polyline
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
      />
    </Svg>
  );
}

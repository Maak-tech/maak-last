import Svg, { Polyline } from "react-native-svg";

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
  if (!data || data.length <= 1) {
    return null;
  }

  const points = normalizePoints(data, width, height, 2);

  return (
    <Svg height={height} width={width}>
      <Polyline
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </Svg>
  );
}

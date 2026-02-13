interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

export function Sparkline({
  data,
  color = "#003543",
  height = 40,
  width = 100,
}: SparklineProps) {
  if (data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="overflow-visible" height={height} width={width}>
      <polyline
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      {/* Fill area */}
      <polygon
        fill={color}
        fillOpacity="0.1"
        points={`0,${height} ${points} ${width},${height}`}
      />
    </svg>
  );
}

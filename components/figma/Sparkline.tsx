import { View } from "react-native";

interface Props {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export default function Sparkline({ data, color = "#3B82F6", width = 80, height = 24 }: Props) {
  if (!data || data.length === 0) return <View style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const barW = Math.max((width / data.length) - 1, 2);

  return (
    <View style={{ width, height, flexDirection: "row", alignItems: "flex-end", gap: 1 }}>
      {data.map((v, i) => (
        <View
          key={i}
          style={{
            width: barW,
            height: Math.max(((v - min) / range) * (height - 2) + 2, 2),
            backgroundColor: i === data.length - 1 ? color : `${color}60`,
            borderRadius: 1,
          }}
        />
      ))}
    </View>
  );
}

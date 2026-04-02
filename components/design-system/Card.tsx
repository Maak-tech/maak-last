import { StyleSheet, View, type ViewProps } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface CardProps extends ViewProps {
  padding?: number;
  radius?: number;
}

export default function Card({ style, padding = 16, radius = 16, children, ...props }: CardProps) {
  const { theme, isDark } = useTheme();
  const bg = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: bg, borderColor: border, padding, borderRadius: radius },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
});

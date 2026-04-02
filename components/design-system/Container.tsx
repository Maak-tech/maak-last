import { StyleSheet, View, type ViewProps } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface ContainerProps extends ViewProps {
  padded?: boolean;
}

export default function Container({ style, padded = true, children, ...props }: ContainerProps) {
  const { theme, isDark } = useTheme();
  const bg = isDark ? theme.colors.background.primary : "#F8FAFC";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bg },
        padded && styles.padded,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padded: { paddingHorizontal: 16 },
});

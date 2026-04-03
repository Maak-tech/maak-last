import { StyleSheet, View, ViewProps } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface Props extends ViewProps {
  children?: React.ReactNode;
  edges?: string[];
}

export default function GradientScreen({ children, style, edges: _edges, ...rest }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

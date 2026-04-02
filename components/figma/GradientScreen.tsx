import { StyleSheet, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  children?: React.ReactNode;
  style?: object;
}

export default function GradientScreen({ children, style }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

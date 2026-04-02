import { Plus } from "lucide-react-native";
import { StyleSheet, TouchableOpacity, type TouchableOpacityProps } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface FABProps extends TouchableOpacityProps {
  icon?: React.ReactNode;
  size?: number;
}

export default function FAB({ icon, size = 56, style, ...props }: FABProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.primary.main,
        },
        style,
      ]}
      {...props}
    >
      {icon ?? <Plus color="#FFFFFF" size={size * 0.43} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});

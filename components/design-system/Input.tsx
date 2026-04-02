import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export default function Input({ label, error, style, ...props }: InputProps) {
  const { theme, isDark } = useTheme();
  const bg = isDark ? "#1E293B" : "#FFFFFF";
  const border = error ? "#EF4444" : (isDark ? "#334155" : "#E2E8F0");

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={[styles.label, { color: theme.colors.text.secondary }]}>{label}</Text>
      )}
      <TextInput
        style={[
          styles.input,
          { backgroundColor: bg, borderColor: border, color: theme.colors.text.primary },
          style,
        ]}
        placeholderTextColor={theme.colors.text.secondary}
        {...props}
      />
      {error && (
        <Text style={styles.error}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 13, fontWeight: "500" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  error: { fontSize: 12, color: "#EF4444" },
});

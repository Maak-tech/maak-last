import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

export default function ResourcesScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    content: {
      flex: 1,
      padding: theme.spacing.base,
    },
    title: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.primary.main),
      marginBottom: theme.spacing.base,
    },
    text: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
    },
    rtlText: {
      textAlign: "right" as const,
    },
  }))(theme);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={[styles.title, isRTL && styles.rtlText]}>
            {isRTL ? "Ø§Ù„Ù…ÙˆØ§Ø±Ø¯" : "Resources"}
          </Text>
          <Text style={[styles.text, isRTL && styles.rtlText]}>
            {isRTL ? "Ù‚Ø±ÙŠØ¨Ø§Ù‹..." : "Coming soon..."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
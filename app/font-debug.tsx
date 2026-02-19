import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArabicText } from "@/components/ArabicText";
import { arabicText } from "@/lib/arabicText";

export default function FontDebugScreen() {
  const { i18n } = useTranslation();

  // Check if Text.defaultProps is set
  const defaultProps = (
    Text as unknown as { defaultProps?: { style?: { fontFamily?: string } } }
  ).defaultProps;
  const defaultFont = defaultProps?.style?.fontFamily ?? "not set";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Font Debug Screen</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Settings:</Text>
          <Text style={styles.info}>Language: {i18n.language}</Text>
          <Text style={styles.info}>Text.defaultProps font: {defaultFont}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Test 1: Regular Text (should use defaultProps)
          </Text>
          <Text style={styles.testText}>مرحباً - Hello in Arabic</Text>
          <Text style={styles.testText}>{arabicText.welcome}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Test 2: Text with explicit NotoSansArabic
          </Text>
          <Text style={[styles.testText, styles.arabicFont]}>
            مرحباً - Hello in Arabic
          </Text>
          <Text style={[styles.testText, styles.arabicFont]}>
            {arabicText.welcome}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test 3: ArabicText Component</Text>
          <ArabicText style={styles.testText}>
            مرحباً - Hello in Arabic
          </ArabicText>
          <ArabicText style={styles.testText}>{arabicText.welcome}</ArabicText>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More Arabic Words:</Text>
          <ArabicText style={styles.testText}>
            {arabicText.home} - Home
          </ArabicText>
          <ArabicText style={styles.testText}>
            {arabicText.family} - Family
          </ArabicText>
          <ArabicText style={styles.testText}>
            {arabicText.medications} - Medications
          </ArabicText>
          <ArabicText style={styles.testText}>
            {arabicText.symptoms} - Symptoms
          </ArabicText>
        </View>

        <Text style={styles.footer}>
          If Test 1 shows ???????, then Text.defaultProps is not working.
          {"\n"}
          If Test 2 or 3 show ???????, then the NotoSansArabic font is not
          loaded.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    marginBottom: 30,
    padding: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    color: "#333",
  },
  info: {
    fontSize: 14,
    marginBottom: 5,
    color: "#666",
  },
  testText: {
    fontSize: 24,
    marginVertical: 8,
    color: "#000",
  },
  arabicFont: {
    fontFamily: "NotoSansArabic-Regular",
  },
  footer: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    marginTop: 20,
    padding: 15,
    backgroundColor: "#fff3cd",
    borderRadius: 8,
    lineHeight: 18,
  },
});

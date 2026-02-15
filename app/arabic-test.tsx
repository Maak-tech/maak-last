import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArabicText } from "@/components/ArabicText";
import { arabicText } from "@/lib/arabicText";

export default function ArabicTestScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Arabic Test Screen</Text>
        <Text style={styles.subtitle}>Using ArabicText Component</Text>

        <ArabicText style={styles.arabic}>{arabicText.welcome}</ArabicText>
        <Text style={styles.label}>Welcome (مرحباً)</Text>

        <ArabicText style={styles.arabic}>{arabicText.home}</ArabicText>
        <Text style={styles.label}>Home (الرئيسية)</Text>

        <ArabicText style={styles.arabic}>{arabicText.symptoms}</ArabicText>
        <Text style={styles.label}>Symptoms (الأعراض الصحية)</Text>

        <ArabicText style={styles.arabic}>{arabicText.medications}</ArabicText>
        <Text style={styles.label}>Medications (الأدوية)</Text>

        <ArabicText style={styles.arabic}>{arabicText.family}</ArabicText>
        <Text style={styles.label}>Family (العائلة)</Text>

        <ArabicText style={styles.arabic}>{arabicText.profile}</ArabicText>
        <Text style={styles.label}>Profile (الملف الشخصي)</Text>

        <ArabicText style={styles.arabic}>{arabicText.zeina}</ArabicText>
        <Text style={styles.label}>Zeina (زينة)</Text>

        <ArabicText style={styles.arabic}>مرحباً بك في تطبيق معاك</ArabicText>
        <Text style={styles.label}>Welcome to Maak App</Text>

        <Text style={styles.info}>
          ✓ All Arabic text above uses the ArabicText component with Cairo font.
          {"\n\n"}
          Cairo is a beautiful Arabic font that supports all Arabic characters.
          {"\n\n"}
          If you still see ??????? then the font file itself is not loading from
          the package.
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
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
  },
  arabic: {
    fontSize: 32,
    marginTop: 20,
    marginBottom: 5,
    textAlign: "center",
    color: "#000",
  },
  label: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 15,
  },
  info: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 30,
    padding: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    lineHeight: 20,
  },
});

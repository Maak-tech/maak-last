import { useRouter } from "expo-router";
import { ArrowLeft, Building2 } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/apiClient";

type OrgType = "clinic" | "hospital" | "pharmacy" | "lab" | "research" | "other";

const ORG_TYPES: { key: OrgType; labelEn: string; labelAr: string }[] = [
  { key: "clinic",    labelEn: "Clinic",       labelAr: "عيادة" },
  { key: "hospital",  labelEn: "Hospital",     labelAr: "مستشفى" },
  { key: "pharmacy",  labelEn: "Pharmacy",     labelAr: "صيدلية" },
  { key: "lab",       labelEn: "Laboratory",   labelAr: "مختبر" },
  { key: "research",  labelEn: "Research",     labelAr: "بحث علمي" },
  { key: "other",     labelEn: "Other",        labelAr: "أخرى" },
];

export default function CreateOrgScreen() {
  const { i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const isRTL = i18n.language === "ar";

  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState<OrgType>("clinic");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);

  const bg = isDark ? theme.colors.background.primary : "#F8FAFC";
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert(
        isRTL ? "مطلوب" : "Required",
        isRTL ? "أدخل اسم المنظمة" : "Please enter the organisation name"
      );
      return;
    }
    setSaving(true);
    try {
      const org = await api.post<{ id: string; name: string }>("/api/org", {
        name: name.trim(),
        type: orgType,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
      });
      Alert.alert(
        isRTL ? "تم الإنشاء" : "Organisation Created",
        isRTL
          ? `تم إنشاء "${org.name}" بنجاح. أنت مسجّل كمسؤول تلقائياً.`
          : `"${org.name}" created successfully. You've been enrolled as admin.`,
        [{ text: isRTL ? "حسناً" : "OK", onPress: () => router.replace({ pathname: '/(tabs)/org-dashboard' }) }]
      );
    } catch (err: unknown) {
      Alert.alert(isRTL ? "خطأ" : "Error", (err instanceof Error ? err.message : null) ?? "Failed to create organisation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: card, borderBottomColor: border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft color={theme.colors.text.primary} size={22} style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
            {isRTL ? "إنشاء منظمة" : "Create Organisation"}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: `${theme.colors.primary.main}15` }]}>
              <Building2 color={theme.colors.primary.main} size={40} />
            </View>
            <Text style={[styles.heroTitle, { color: theme.colors.text.primary }]}>
              {isRTL ? "أنشئ منظمتك الصحية" : "Set up your healthcare organisation"}
            </Text>
            <Text style={[styles.heroDesc, { color: theme.colors.text.secondary }]}>
              {isRTL
                ? "ستصبح مسؤولاً تلقائياً وتستطيع دعوة الأعضاء وإدارة المرضى"
                : "You'll automatically become admin and can invite members, manage patients"}
            </Text>
          </View>

          <View style={styles.form}>
            {/* Name */}
            <View>
              <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
                {isRTL ? "اسم المنظمة *" : "Organisation Name *"}
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={isRTL ? "مثال: عيادة الشفاء" : "e.g. Al-Shifa Clinic"}
                placeholderTextColor={theme.colors.text.secondary}
                style={[styles.input, { borderColor: border, color: theme.colors.text.primary, backgroundColor: card }]}
              />
            </View>

            {/* Type */}
            <View>
              <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
                {isRTL ? "نوع المنظمة" : "Organisation Type"}
              </Text>
              <View style={styles.typeGrid}>
                {ORG_TYPES.map((t) => {
                  const isActive = orgType === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setOrgType(t.key)}
                      style={[
                        styles.typeBtn,
                        {
                          borderColor: isActive ? theme.colors.primary.main : border,
                          backgroundColor: isActive ? `${theme.colors.primary.main}10` : card,
                        },
                      ]}
                    >
                      <Text style={[styles.typeBtnText, { color: isActive ? theme.colors.primary.main : theme.colors.text.primary }]}>
                        {isRTL ? t.labelAr : t.labelEn}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Email */}
            <View>
              <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
                {isRTL ? "البريد الإلكتروني" : "Email"}
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="info@example.com"
                placeholderTextColor={theme.colors.text.secondary}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.input, { borderColor: border, color: theme.colors.text.primary, backgroundColor: card }]}
              />
            </View>

            {/* Phone */}
            <View>
              <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
                {isRTL ? "رقم الهاتف" : "Phone"}
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+966..."
                placeholderTextColor={theme.colors.text.secondary}
                keyboardType="phone-pad"
                style={[styles.input, { borderColor: border, color: theme.colors.text.primary, backgroundColor: card }]}
              />
            </View>

            {/* Website */}
            <View>
              <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
                {isRTL ? "الموقع الإلكتروني" : "Website"}
              </Text>
              <TextInput
                value={website}
                onChangeText={setWebsite}
                placeholder="https://..."
                placeholderTextColor={theme.colors.text.secondary}
                autoCapitalize="none"
                keyboardType="url"
                style={[styles.input, { borderColor: border, color: theme.colors.text.primary, backgroundColor: card }]}
              />
            </View>

            <TouchableOpacity
              onPress={handleCreate}
              disabled={saving}
              style={[styles.createBtn, { backgroundColor: theme.colors.primary.main, opacity: saving ? 0.7 : 1 }]}
            >
              {saving
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={styles.createBtnText}>{isRTL ? "إنشاء المنظمة" : "Create Organisation"}</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "600", flex: 1, textAlign: "center" },
  hero: { alignItems: "center", padding: 32, gap: 12 },
  heroIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center" },
  heroTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  heroDesc: { fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 16 },
  form: { padding: 20, gap: 20 },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  typeBtnText: { fontSize: 13, fontWeight: "500" },
  createBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  createBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});

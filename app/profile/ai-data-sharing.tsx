/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Screen is a self-contained disclosure + consent + preview flow. */
import { useNavigation, useRouter } from "expo-router";
import { ArrowLeft, Shield, Sparkles } from "lucide-react-native";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import aiConsentService from "@/lib/services/aiConsentService";
import healthContextService from "@/lib/services/healthContextService";

export const options = {
  headerShown: false,
};

export default function AIDataSharingScreen() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const isRTL = i18n.language.toLowerCase().startsWith("ar");

  const [loading, setLoading] = useState(true);
  const [consented, setConsented] = useState(false);
  const [consentedAtIso, setConsentedAtIso] = useState<string | undefined>(
    undefined
  );

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewText, setPreviewText] = useState<string>("");

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const loadConsent = useCallback(async () => {
    setLoading(true);
    const status = await aiConsentService.getConsent();
    setConsented(status.consented);
    setConsentedAtIso(status.consentedAtIso);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConsent();
  }, [loadConsent]);

  const toggleConsent = async () => {
    const next = !consented;
    setConsented(next);
    await aiConsentService.setConsented(next);
    const status = await aiConsentService.getConsent();
    setConsented(status.consented);
    setConsentedAtIso(status.consentedAtIso);
  };

  const openPreview = async () => {
    setPreviewVisible(true);
    setPreviewLoading(true);
    try {
      const prompt = await healthContextService.getContextualPrompt();
      setPreviewText(prompt);
    } catch {
      setPreviewText(
        isRTL
          ? "تعذّر تحميل معاينة بيانات الذكاء الاصطناعي."
          : "Failed to load AI data preview."
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <GradientScreen edges={["top"]} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerWrapper}>
          <WavyBackground
            contentPosition="top"
            curve="home"
            height={260}
            variant="teal"
          >
            <View style={styles.headerContent}>
              <View style={[styles.headerRow, isRTL && styles.headerRowRTL]}>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/profile")}
                  style={styles.backButton}
                >
                  <ArrowLeft
                    color="#003543"
                    size={20}
                    style={
                      isRTL ? { transform: [{ rotate: "180deg" }] } : undefined
                    }
                  />
                </TouchableOpacity>
                <View style={styles.headerTitle}>
                  <View
                    style={[
                      styles.headerTitleRow,
                      isRTL && styles.headerRowRTL,
                    ]}
                  >
                    <Shield color="#EB9C0C" size={20} />
                    <Text style={styles.headerTitleText}>
                      {isRTL
                        ? "مشاركة بيانات الذكاء الاصطناعي"
                        : "AI Data Sharing"}
                    </Text>
                  </View>
                  <Text
                    style={[styles.headerSubtitle, isRTL && styles.rtlText]}
                  >
                    {isRTL
                      ? "تحكم في إرسال بياناتك إلى مزوّد ذكاء اصطناعي خارجي."
                      : "Control whether your data is sent to a third-party AI provider."}
                  </Text>
                </View>
              </View>
            </View>
          </WavyBackground>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#003543" size="large" />
            <Text style={[styles.loadingText, isRTL && { textAlign: "left" }]}>
              {isRTL ? "جاري التحميل..." : "Loading..."}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={[styles.cardHeader, isRTL && styles.headerRowRTL]}>
                <Sparkles color="#2563EB" size={20} />
                <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "المزوّد" : "Provider"}
                </Text>
              </View>
              <Text style={[styles.cardText, isRTL && styles.rtlText]}>
                {isRTL
                  ? "ميزات «زينة» والرؤى الذكية تستخدم مزوّد ذكاء اصطناعي من طرف ثالث."
                  : "Zeina and AI Insights use a third-party AI provider."}
              </Text>
              <Text style={[styles.cardHint, isRTL && styles.rtlText]}>
                {isRTL
                  ? "يتم إرسال الطلبات عبر خدماتنا الخلفية بأمان — ولا نقوم بتضمين مفاتيح الوصول داخل التطبيق."
                  : "Requests are sent securely via our backend services — access keys are not embedded in the app."}
              </Text>
              <Text style={[styles.cardHint, isRTL && styles.rtlText]}>
                {isRTL
                  ? "نستخدم نهج «تقليل/إخفاء الهوية»: لا نرسل الاسم افتراضيًا، ونقلل المعرّفات ونزيل التواريخ الدقيقة قدر الإمكان."
                  : "We use a de-identify/minimize approach: we don’t send your name by default, we minimize identifiers, and remove exact dates where possible."}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={[styles.cardHeader, isRTL && styles.headerRowRTL]}>
                <Shield color="#10B981" size={20} />
                <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "الإذن" : "Permission"}
                </Text>
              </View>

              <View style={[styles.toggleRow, isRTL && styles.toggleRowRTL]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleTitle, isRTL && styles.rtlText]}>
                    {isRTL
                      ? "السماح بمشاركة البيانات مع مزوّد ذكاء اصطناعي من طرف ثالث"
                      : "Allow data sharing with a third-party AI provider"}
                  </Text>
                  <Text
                    style={[styles.toggleSubtitle, isRTL && styles.rtlText]}
                  >
                    {isRTL
                      ? "بدون هذا الإذن، لن يتم إرسال بياناتك إلى مزوّد الذكاء الاصطناعي."
                      : "Without this, your data will not be sent to the AI provider."}
                  </Text>
                  {consented && consentedAtIso ? (
                    <Text style={[styles.consentMeta, isRTL && styles.rtlText]}>
                      {isRTL
                        ? `تم التفعيل: ${new Date(consentedAtIso).toLocaleString()}`
                        : `Enabled: ${new Date(consentedAtIso).toLocaleString()}`}
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  accessibilityRole="switch"
                  accessibilityState={{ checked: consented }}
                  onPress={toggleConsent}
                  style={[
                    styles.toggle,
                    consented ? styles.toggleOn : styles.toggleOff,
                  ]}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      consented ? styles.toggleKnobOn : styles.toggleKnobOff,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>
                {isRTL ? "ما الذي قد يتم إرساله؟" : "What may be sent?"}
              </Text>
              <Text style={[styles.cardText, isRTL && styles.rtlText]}>
                {isRTL
                  ? "حسب الميزة التي تستخدمها، قد نرسل: رسائلك في الدردشة، وسياق صحتك (مثل الملف الصحي، الأدوية، الأعراض، والمقاييس/الملخصات)، وبالنسبة للإدخال الصوتي قد يتم إرسال ملف صوتي للتحويل إلى نص."
                  : "Depending on the feature you use, we may send: your chat messages, your health context (e.g., profile, medications, symptoms, metrics/summaries), and for voice input an audio recording for speech-to-text transcription."}
              </Text>
              <Text style={[styles.cardHint, isRTL && styles.rtlText]}>
                {isRTL
                  ? "افتراضيًا لا نضمّن الاسم/جهات الاتصال في سياق الذكاء الاصطناعي، ونزيل التواريخ الدقيقة قدر الإمكان، ونحجب البريد/الهاتف الواضحين. إذا كتبت بيانات تعريفية في الدردشة، قد يتم إرسالها."
                  : "By default we don’t include names/contact details in AI context, we remove exact dates where possible, and we redact obvious emails/phone numbers. If you type identifying information into chat, it may be sent."}
              </Text>

              <TouchableOpacity
                onPress={openPreview}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {isRTL
                    ? "معاينة البيانات التي ستُرسل"
                    : "Preview the data to be sent"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/profile/privacy-policy")}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>
                  {isRTL ? "عرض سياسة الخصوصية" : "View Privacy Policy"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setPreviewVisible(false)}
        transparent={true}
        visible={previewVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={[styles.modalHeader, isRTL && styles.headerRowRTL]}>
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {isRTL ? "معاينة بيانات الذكاء الاصطناعي" : "AI Data Preview"}
              </Text>
              <TouchableOpacity onPress={() => setPreviewVisible(false)}>
                <Text style={styles.modalClose}>
                  {isRTL ? "إغلاق" : "Close"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalHint, isRTL && styles.rtlText]}>
              {isRTL
                ? "هذه المعاينة تعرض سياقًا مُقلَّلًا/مُخفى الهوية. قد يتم إرسال نص رسالتك أيضًا."
                : "This preview shows a minimized/de-identified context. Your chat message text may also be sent."}
            </Text>

            {previewLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color="#003543" size="large" />
                <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
                  {isRTL ? "جاري التحميل..." : "Loading..."}
                </Text>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.previewScroll}
                showsVerticalScrollIndicator={true}
              >
                <Text style={[styles.previewText, isRTL && styles.rtlText]}>
                  {previewText}
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },
  headerWrapper: { marginHorizontal: -24, marginBottom: -12 },
  headerContent: { paddingHorizontal: 24, paddingTop: 130, paddingBottom: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 50,
  },
  headerRowRTL: { flexDirection: "row-reverse" },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0, 53, 67, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitleText: { fontSize: 18, fontWeight: "700", color: "#003543" },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#0F172A",
    opacity: 0.75,
  },
  rtlText: { textAlign: "left" },
  loadingContainer: { paddingVertical: 28, alignItems: "center" },
  loadingText: { marginTop: 10, color: "#0F172A", opacity: 0.8 },
  card: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(2, 132, 199, 0.10)",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  cardText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: "#0F172A",
    opacity: 0.9,
  },
  cardHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: "#334155",
    opacity: 0.85,
  },
  toggleRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleRowRTL: { flexDirection: "row-reverse" },
  toggleTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  toggleSubtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: "#334155",
    opacity: 0.9,
  },
  consentMeta: { marginTop: 8, fontSize: 11, color: "#64748B" },
  toggle: {
    width: 54,
    height: 32,
    borderRadius: 16,
    padding: 3,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: "#10B981" },
  toggleOff: { backgroundColor: "rgba(15,23,42,0.18)" },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  toggleKnobOn: { alignSelf: "flex-end" },
  toggleKnobOff: { alignSelf: "flex-start" },
  primaryButton: {
    marginTop: 14,
    backgroundColor: "#003543",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700" },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: "rgba(0, 53, 67, 0.10)",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#003543", fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "82%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15, 23, 42, 0.08)",
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  modalClose: { color: "#2563EB", fontWeight: "700" },
  modalHint: { paddingTop: 10, fontSize: 12, lineHeight: 16, color: "#64748B" },
  modalLoading: { paddingVertical: 24, alignItems: "center" },
  previewScroll: { paddingVertical: 14 },
  previewText: { fontSize: 12, lineHeight: 18, color: "#0F172A" },
});

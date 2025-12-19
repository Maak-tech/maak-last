import { useRouter } from "expo-router";
import { ArrowLeft, Calendar, Shield } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  documentService,
  type ParsedDocument,
} from "../../lib/services/documentService";

export default function PrivacyPolicyScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isRTL = i18n.language === "ar";

  useEffect(() => {
    loadPrivacyPolicy();
  }, []);

  const loadPrivacyPolicy = async () => {
    try {
      setLoading(true);
      setError(null);
      const privacyDoc = await documentService.getPrivacyPolicy();
      setDocument(privacyDoc);
    } catch (err) {
      console.error("Error loading privacy policy:", err);
      setError(
        isRTL
          ? "حدث خطأ في تحميل سياسة الخصوصية"
          : "Error loading privacy policy"
      );
    } finally {
      setLoading(false);
    }
  };

  const SectionCard = ({
    title,
    content,
    level,
  }: {
    title: string;
    content: string;
    level: number;
  }) => (
    <View style={[styles.sectionCard, level > 2 && styles.subsectionCard]}>
      <Text
        style={[
          styles.sectionTitle,
          isRTL && styles.rtlText,
          level === 2 && styles.mainSectionTitle,
          level > 2 && styles.subsectionTitle,
        ]}
      >
        {title}
      </Text>
      <Text style={[styles.sectionContent, isRTL && styles.rtlText]}>
        {content}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
        >
          <ArrowLeft
            color="#1E293B"
            size={24}
            style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {isRTL ? "سياسة الخصوصية" : "Privacy Policy"}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#2563EB" size="large" />
            <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
              {isRTL ? "جاري التحميل..." : "Loading..."}
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, isRTL && styles.rtlText]}>
              {error}
            </Text>
            <TouchableOpacity
              onPress={loadPrivacyPolicy}
              style={styles.retryButton}
            >
              <Text style={[styles.retryButtonText, isRTL && styles.rtlText]}>
                {isRTL ? "إعادة المحاولة" : "Retry"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : document ? (
          <>
            {/* Introduction */}
            <View style={styles.introSection}>
              <View style={styles.introIcon}>
                <Shield color="#2563EB" size={40} />
              </View>
              <Text style={[styles.introTitle, isRTL && styles.rtlText]}>
                {isRTL ? "سياسة خصوصية تطبيق معاك" : document.title}
              </Text>
              <Text style={[styles.introDescription, isRTL && styles.rtlText]}>
                {isRTL
                  ? "نحن نحترم خصوصيتك ونلتزم بحماية معلوماتك الشخصية والصحية. تشرح هذه السياسة كيفية جمع واستخدام وحماية بياناتك."
                  : "We respect your privacy and are committed to protecting your personal and health information. This policy explains how we collect, use, and protect your data."}
              </Text>
              {document.lastUpdated && (
                <View style={styles.lastUpdated}>
                  <Calendar color="#64748B" size={16} />
                  <Text
                    style={[styles.lastUpdatedText, isRTL && styles.rtlText]}
                  >
                    {isRTL
                      ? `آخر تحديث: ${document.lastUpdated}`
                      : `Last Updated: ${document.lastUpdated}`}
                  </Text>
                </View>
              )}
            </View>

            {/* Document Sections */}
            {document.sections.map((section) => (
              <SectionCard
                content={section.content}
                key={section.id}
                level={section.level}
                title={section.title}
              />
            ))}
          </>
        ) : (
          <Text style={[styles.noContentText, isRTL && styles.rtlText]}>
            {isRTL ? "لا يوجد محتوى متاح" : "No content available"}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonRTL: {
    transform: [{ scaleX: -1 }],
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  introSection: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#FFFFFF",
    marginTop: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  introIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EBF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 24,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginBottom: 12,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  introDescription: {
    fontSize: 16,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  lastUpdated: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    marginTop: 16,
  },
  lastUpdatedText: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  subsectionCard: {
    marginLeft: 16,
    backgroundColor: "#F8FAFC",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 12,
  },
  mainSectionTitle: {
    fontSize: 18,
    fontFamily: "Geist-Bold",
  },
  subsectionTitle: {
    fontSize: 14,
    fontFamily: "Geist-SemiBold",
  },
  sectionContent: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#374151",
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#64748B",
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: "Geist-SemiBold",
    color: "#FFFFFF",
  },
  noContentText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#64748B",
    textAlign: "center",
    marginTop: 50,
    paddingHorizontal: 32,
  },
  rtlText: {
    fontFamily: "Cairo-Regular",
  },
});

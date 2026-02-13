/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Large screen composed of multiple localized UI states. */
/* biome-ignore-all lint/correctness/noNestedComponentDefinitions: Local section renderer intentionally captures `isRTL`. */
/* biome-ignore-all lint/style/noNestedTernary: State rendering is explicit and localized. */
import { useNavigation, useRouter } from "expo-router";
import { ArrowLeft, Calendar, Shield } from "lucide-react-native";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import {
  documentService,
  type ParsedDocument,
} from "../../lib/services/documentService";

export const options = {
  headerShown: false,
};

export default function PrivacyPolicyScreen() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isRTL = i18n.language === "ar";

  // Hide the default header to prevent duplicate headers
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const loadPrivacyPolicy = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const privacyDoc = await documentService.getPrivacyPolicy();
      setDocument(privacyDoc);
    } catch {
      // Silently handle error
      setError(
        isRTL
          ? "حدث خطأ في تحميل سياسة الخصوصية"
          : "Error loading privacy policy"
      );
    } finally {
      setLoading(false);
    }
  }, [isRTL]);

  useEffect(() => {
    loadPrivacyPolicy();
  }, [loadPrivacyPolicy]);

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
          isRTL && { textAlign: "left" },
          level === 2 && styles.mainSectionTitle,
          level > 2 && styles.subsectionTitle,
        ]}
      >
        {title}
      </Text>
      <Text style={[styles.sectionContent, isRTL && { textAlign: "left" }]}>
        {content}
      </Text>
    </View>
  );

  return (
    <GradientScreen edges={["top"]} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <View style={styles.headerWrapper}>
          <WavyBackground
            contentPosition="top"
            curve="home"
            height={280}
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
                      {isRTL ? "سياسة الخصوصية" : "Privacy Policy"}
                    </Text>
                  </View>
                  <Text
                    style={[styles.headerSubtitle, isRTL && styles.rtlText]}
                  >
                    {isRTL
                      ? "كيف نحمي ونستخدم بياناتك"
                      : "How we protect and use your data"}
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
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, isRTL && { textAlign: "left" }]}>
              {error}
            </Text>
            <TouchableOpacity
              onPress={loadPrivacyPolicy}
              style={styles.retryButton}
            >
              <Text
                style={[styles.retryButtonText, isRTL && { textAlign: "left" }]}
              >
                {isRTL ? "إعادة المحاولة" : "Retry"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : document ? (
          <>
            {/* Introduction */}
            <View style={styles.introSection}>
              <View style={styles.introIcon}>
                <Shield color="#EB9C0C" size={40} />
              </View>
              <Text style={[styles.introTitle, isRTL && { textAlign: "left" }]}>
                {isRTL ? "سياسة خصوصية تطبيق معاك" : document.title}
              </Text>
              <Text
                style={[
                  styles.introDescription,
                  isRTL && { textAlign: "left" },
                ]}
              >
                {isRTL
                  ? "نحن نحترم خصوصيتك ونلتزم بحماية معلوماتك الشخصية والصحية. تشرح هذه السياسة كيفية جمع واستخدام وحماية بياناتك."
                  : "We respect your privacy and are committed to protecting your personal and health information. This policy explains how we collect, use, and protect your data."}
              </Text>
              {document.lastUpdated ? (
                <View style={styles.lastUpdated}>
                  <Calendar color="#64748B" size={16} />
                  <Text
                    style={[
                      styles.lastUpdatedText,
                      isRTL && { textAlign: "left" },
                    ]}
                  >
                    {isRTL
                      ? `آخر تحديث: ${document.lastUpdated}`
                      : `Last Updated: ${document.lastUpdated}`}
                  </Text>
                </View>
              ) : null}
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
          <Text style={[styles.noContentText, isRTL && { textAlign: "left" }]}>
            {isRTL ? "لا يوجد محتوى متاح" : "No content available"}
          </Text>
        )}
      </ScrollView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerWrapper: {
    marginHorizontal: -24,
    marginBottom: -20,
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 130,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 50,
  },
  headerRowRTL: {
    flexDirection: "row-reverse",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0, 53, 67, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  headerTitleText: {
    fontSize: 22,
    fontFamily: "Inter-Bold",
    color: "#003543",
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: "rgba(0, 53, 67, 0.85)",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  introSection: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#FFFFFF",
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  introIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF8EB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: "#1E293B",
    marginBottom: 12,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  introDescription: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
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
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  subsectionCard: {
    marginStart: 16,
    backgroundColor: "#F8FAFC",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 12,
  },
  mainSectionTitle: {
    fontSize: 18,
    fontFamily: "Inter-Bold",
  },
  subsectionTitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
  },
  sectionContent: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
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
    fontFamily: "Inter-Medium",
    color: "#1A1D1F",
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
    fontFamily: "Inter-Medium",
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#EB9C0C",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  noContentText: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    textAlign: "center",
    marginTop: 50,
    paddingHorizontal: 32,
  },
  rtlText: {
    textAlign: "right",
  },
});

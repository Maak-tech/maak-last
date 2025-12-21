import { useRouter, useNavigation } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  FileText,
  Info,
  Shield,
} from "lucide-react-native";
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

export default function TermsConditionsScreen() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isRTL = i18n.language === "ar";

  // Hide the default header to prevent duplicate back buttons
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    loadTermsAndConditions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTermsAndConditions = async () => {
    try {
      setLoading(true);
      setError(null);
      const termsDoc = await documentService.getTermsAndConditions();
      setDocument(termsDoc);
    } catch {
      // Silently handle error
      setError(
        isRTL
          ? "حدث خطأ في تحميل الشروط والأحكام"
          : "Error loading terms and conditions"
      );
    } finally {
      setLoading(false);
    }
  };

  const getSectionIcon = (title: string) => {
    if (
      title.toLowerCase().includes("acceptance") ||
      title.toLowerCase().includes("قبول")
    ) {
      return Shield;
    }
    if (
      title.toLowerCase().includes("use") ||
      title.toLowerCase().includes("استخدام")
    ) {
      return Info;
    }
    if (
      title.toLowerCase().includes("medical") ||
      title.toLowerCase().includes("طبية")
    ) {
      return AlertTriangle;
    }
    if (
      title.toLowerCase().includes("privacy") ||
      title.toLowerCase().includes("خصوصية")
    ) {
      return Shield;
    }
    if (
      title.toLowerCase().includes("liability") ||
      title.toLowerCase().includes("مسؤولية")
    ) {
      return AlertTriangle;
    }
    return FileText;
  };

  const getSectionColor = (title: string) => {
    if (
      title.toLowerCase().includes("acceptance") ||
      title.toLowerCase().includes("قبول")
    ) {
      return "#10B981";
    }
    if (
      title.toLowerCase().includes("use") ||
      title.toLowerCase().includes("استخدام")
    ) {
      return "#3B82F6";
    }
    if (
      title.toLowerCase().includes("medical") ||
      title.toLowerCase().includes("طبية")
    ) {
      return "#F59E0B";
    }
    if (
      title.toLowerCase().includes("privacy") ||
      title.toLowerCase().includes("خصوصية")
    ) {
      return "#8B5CF6";
    }
    if (
      title.toLowerCase().includes("liability") ||
      title.toLowerCase().includes("مسؤولية")
    ) {
      return "#F59E0B";
    }
    return "#2563EB";
  };

  const SectionCard = ({
    title,
    content,
    level,
  }: {
    title: string;
    content: string;
    level: number;
  }) => {
    const Icon = getSectionIcon(title);
    const color = getSectionColor(title);

    return (
      <View style={[styles.sectionCard, level > 2 && styles.subsectionCard]}>
        {level === 2 && (
          <View style={styles.sectionHeader}>
            <View
              style={[styles.sectionIcon, { backgroundColor: color + "20" }]}
            >
              <Icon color={color} size={20} />
            </View>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {title}
            </Text>
          </View>
        )}
        {level > 2 && (
          <Text style={[styles.subsectionTitle, isRTL && styles.rtlText]}>
            {title}
          </Text>
        )}
        <View style={level === 2 ? styles.sectionContent : undefined}>
          <Text style={[styles.paragraph, isRTL && styles.rtlText]}>
            {content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack && router.canGoBack()) {
              router.back();
            } else {
              router.push("/(tabs)/profile");
            }
          }}
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
        >
          <ArrowLeft
            color="#1E293B"
            size={24}
            style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {isRTL ? "الشروط والأحكام" : "Terms & Conditions"}
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
              onPress={loadTermsAndConditions}
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
                <FileText color="#2563EB" size={40} />
              </View>
              <Text style={[styles.introTitle, isRTL && styles.rtlText]}>
                {isRTL ? "شروط وأحكام استخدام تطبيق معاك" : document.title}
              </Text>
              <Text style={[styles.introDescription, isRTL && styles.rtlText]}>
                {isRTL
                  ? "يرجى قراءة هذه الشروط والأحكام بعناية قبل استخدام تطبيق معاك. باستخدامك للتطبيق، فإنك توافق على الالتزام بهذه الشروط."
                  : "Please read these terms and conditions carefully before using the Maak app. By using the app, you agree to be bound by these terms."}
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

            {/* Contact Information */}
            <View style={styles.contactSection}>
              <Text style={[styles.contactTitle, isRTL && styles.rtlText]}>
                {isRTL ? "تواصل معنا" : "Contact Us"}
              </Text>
              <Text style={[styles.contactText, isRTL && styles.rtlText]}>
                {isRTL
                  ? "إذا كان لديك أي أسئلة حول هذه الشروط والأحكام، يرجى التواصل معنا:"
                  : "If you have any questions about these terms and conditions, please contact us:"}
              </Text>
              <Text style={[styles.contactDetails, isRTL && styles.rtlText]}>
                {isRTL ? "البريد الإلكتروني: " : "Email: "}legal@maak.app
              </Text>
              <Text style={[styles.contactDetails, isRTL && styles.rtlText]}>
                {isRTL ? "الهاتف: " : "Phone: "}+966 12 345 6789
              </Text>
            </View>
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
    marginBottom: 16,
  },
  lastUpdated: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  lastUpdatedText: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    flex: 1,
  },
  sectionContent: {
    padding: 16,
  },
  paragraph: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#374151",
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  bullet: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#374151",
    marginRight: 8,
    marginTop: 2,
  },
  bulletText: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#374151",
    lineHeight: 20,
    flex: 1,
  },
  contactSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  contactTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 12,
  },
  contactText: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    lineHeight: 20,
    marginBottom: 16,
  },
  contactDetails: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#2563EB",
    marginBottom: 4,
  },
  subsectionCard: {
    marginLeft: 16,
    backgroundColor: "#F8FAFC",
  },
  subsectionTitle: {
    fontSize: 14,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 8,
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

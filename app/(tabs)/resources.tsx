import { useNavigation, useRouter } from "expo-router";
import {
  Activity,
  ArrowLeft,
  Book,
  BookOpen,
  FileText,
  Heart,
  Pill,
  Play,
  Star,
  Users,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Resource = {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  category: "general" | "medication" | "family" | "symptoms" | "lifestyle";
  type: "article" | "video" | "guide" | "checklist";
  duration?: string;
  rating?: number;
  url?: string;
  featured?: boolean;
};

const resources: Resource[] = [
  {
    id: "1",
    title: "Understanding Medication Adherence",
    titleAr: "فهم الالتزام بالدواء",
    description:
      "Learn why taking medications as prescribed is crucial for your health",
    descriptionAr:
      "تعلم لماذا تناول الأدوية كما هو موصوف أمر بالغ الأهمية لصحتك",
    category: "medication",
    type: "article",
    duration: "5 min",
    rating: 4.8,
    featured: true,
  },
  {
    id: "2",
    title: "Family Health Management Best Practices",
    titleAr: "أفضل ممارسات إدارة صحة العائلة",
    description:
      "Tips for managing your family's health effectively using Maak",
    descriptionAr: "نصائح لإدارة صحة عائلتك بفعالية باستخدام معاك",
    category: "family",
    type: "guide",
    duration: "10 min",
    rating: 4.9,
    featured: true,
  },
  {
    id: "3",
    title: "How to Track Symptoms Effectively",
    titleAr: "كيفية تتبع الأعراض بفعالية",
    description: "Learn to accurately record and monitor health symptoms",
    descriptionAr: "تعلم كيفية تسجيل ومراقبة الأعراض الصحية بدقة",
    category: "symptoms",
    type: "video",
    duration: "8 min",
    rating: 4.7,
  },
  {
    id: "4",
    title: "Emergency Preparedness Checklist",
    titleAr: "قائمة فحص الاستعداد للطوارئ",
    description: "Essential steps to prepare for medical emergencies",
    descriptionAr: "خطوات أساسية للاستعداد للطوارئ الطبية",
    category: "general",
    type: "checklist",
    duration: "3 min",
    rating: 4.6,
  },
  {
    id: "5",
    title: "Healthy Lifestyle for Families",
    titleAr: "نمط حياة صحي للعائلات",
    description: "Building healthy habits that last for the whole family",
    descriptionAr: "بناء عادات صحية دائمة للعائلة بأكملها",
    category: "lifestyle",
    type: "article",
    duration: "12 min",
    rating: 4.5,
  },
  {
    id: "6",
    title: "Understanding Health Scores",
    titleAr: "فهم نقاط الصحة",
    description: "How Maak calculates your health score and what it means",
    descriptionAr: "كيف يحسب معاك نقاط صحتك وما معنى ذلك",
    category: "general",
    type: "guide",
    duration: "6 min",
    rating: 4.4,
  },
];

const _categories = [
  { key: "all", labelEn: "All", labelAr: "الكل", icon: Book },
  { key: "general", labelEn: "General", labelAr: "عام", icon: Heart },
  { key: "medication", labelEn: "Medications", labelAr: "الأدوية", icon: Pill },
  { key: "family", labelEn: "Family", labelAr: "العائلة", icon: Users },
  { key: "symptoms", labelEn: "Symptoms", labelAr: "الأعراض", icon: Activity },
  { key: "lifestyle", labelEn: "Lifestyle", labelAr: "نمط الحياة", icon: Star },
];

export default function ResourcesScreen() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const [selectedCategory, _setSelectedCategory] = useState("all");
  const [_bookmarkedItems, setBookmarkedItems] = useState<string[]>([]);

  const isRTL = i18n.language === "ar";

  // Hide the default header to prevent duplicate back buttons
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const _getTypeIcon = (type: string) => {
    switch (type) {
      case "article":
        return FileText;
      case "video":
        return Play;
      case "guide":
        return BookOpen;
      case "checklist":
        return Book;
      default:
        return FileText;
    }
  };

  const filteredResources =
    selectedCategory === "all"
      ? resources
      : resources.filter((resource) => resource.category === selectedCategory);

  const _featuredResources = filteredResources.filter((r) => r.featured);
  const _regularResources = filteredResources.filter((r) => !r.featured);

  const _handleResourcePress = (_resource: Resource) => {
    Alert.alert(
      isRTL ? "قريباً" : "Coming Soon",
      isRTL ? "هذا المحتوى سيتوفر قريباً" : "This content will be available soon"
    );
  };

  const _toggleBookmark = (resourceId: string) => {
    setBookmarkedItems((prev) =>
      prev.includes(resourceId)
        ? prev.filter((id) => id !== resourceId)
        : [...prev, resourceId]
    );
  };

  return (
    <SafeAreaView
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container}
    >
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
          {isRTL ? "المصادر التعليمية" : "Health Resources"}
        </Text>
        <Text style={[styles.headerSubtitle, isRTL && styles.rtlText]}>
          {isRTL
            ? "تعلم المزيد عن الصحة والرعاية"
            : "Learn more about health and care"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        style={styles.content}
      >
        {/* Coming Soon Badge */}
        <View style={styles.comingSoonCard}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {isRTL ? "قريباً" : "COMING SOON"}
            </Text>
          </View>
          <Text style={[styles.comingSoonTitle, isRTL && styles.rtlText]}>
            {isRTL ? "المصادر التعليمية قريباً" : "Health Resources Coming Soon"}
          </Text>
          <Text style={[styles.comingSoonDescription, isRTL && styles.rtlText]}>
            {isRTL
              ? "سنضيف قريباً مصادر تعليمية شاملة حول الصحة والرعاية"
              : "We'll be adding comprehensive health and care resources soon"}
          </Text>
        </View>

        {/* Maak One-liner */}
        <View style={styles.onelineCard}>
          <Text style={[styles.onelineText, isRTL && styles.rtlText]}>
            {isRTL ? '"خليهم دايمًا معك"' : '"Health starts at home"'}
          </Text>
          <Text style={[styles.onelineSource, isRTL && styles.rtlText]}>
            - Maak
          </Text>
        </View>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: 20,
    padding: 8,
    zIndex: 10,
  },
  backButtonRTL: {
    left: undefined,
    right: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Geist-Bold",
    color: "#2563EB",
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  comingSoonCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    marginTop: 20,
    borderStartWidth: 4,
    borderStartColor: "#F59E0B",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  badge: {
    backgroundColor: "#FCD34D",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Geist-Bold",
    color: "#92400E",
  },
  comingSoonTitle: {
    fontSize: 20,
    fontFamily: "Geist-SemiBold",
    color: "#2563EB",
    textAlign: "center",
    marginBottom: 8,
  },
  comingSoonDescription: {
    fontSize: 16,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    textAlign: "center",
  },
  onelineCard: {
    backgroundColor: "#EBF4FF",
    borderRadius: 16,
    padding: 20,
    marginVertical: 20,
    borderStartWidth: 4,
    borderStartColor: "#2563EB",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  onelineText: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    color: "#2563EB",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 12,
  },
  onelineSource: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#2563EB",
  },
  rtlText: {
    fontFamily: "Geist-Regular",
    textAlign: "right",
  },
});

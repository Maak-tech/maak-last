import {
  Activity,
  ArrowLeft,
  Book,
  Bookmark,
  BookOpen,
  Clock,
  ExternalLink,
  FileText,
  Heart,
  Pill,
  Play,
  Star,
  Users,
} from "lucide-react-native";
import { useState, useEffect } from "react";
import { useRouter, useNavigation } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

interface Resource {
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
}

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

const categories = [
  { key: "all", labelEn: "All", labelAr: "الكل", icon: Book },
  { key: "general", labelEn: "General", labelAr: "عام", icon: Heart },
  { key: "medication", labelEn: "Medications", labelAr: "الأدوية", icon: Pill },
  { key: "family", labelEn: "Family", labelAr: "العائلة", icon: Users },
  { key: "symptoms", labelEn: "Symptoms", labelAr: "الأعراض", icon: Activity },
  { key: "lifestyle", labelEn: "Lifestyle", labelAr: "نمط الحياة", icon: Star },
];

export default function ResourcesScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [bookmarkedItems, setBookmarkedItems] = useState<string[]>([]);

  const isRTL = i18n.language === "ar";

  // Hide the default header to prevent duplicate back buttons
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
      ...theme.shadows.sm,
    },
    backButton: {
      marginBottom: theme.spacing.md,
      alignSelf: "flex-start",
      padding: theme.spacing.sm,
      marginLeft: -theme.spacing.sm,
    },
    backButtonRTL: {
      marginLeft: 0,
      marginRight: -theme.spacing.sm,
      alignSelf: "flex-end",
    },
    headerContent: {
      marginTop: 0,
    },
    headerTitle: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.primary.main),
      fontSize: 28,
      marginBottom: theme.spacing.xs,
    },
    headerSubtitle: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
    },
    categoryTabs: {
      flexDirection: "row" as const,
      paddingVertical: theme.spacing.base,
    },
    categoryTab: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.background.secondary,
      marginRight: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    categoryTabActive: {
      backgroundColor: theme.colors.primary.main,
    },
    categoryTabText: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.secondary),
    },
    categoryTabTextActive: {
      color: theme.colors.neutral.white,
    },
    featuredSection: {
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.text.primary),
      marginBottom: theme.spacing.base,
    },
    featuredCard: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.base,
      ...theme.shadows.md,
    },
    featuredBadge: {
      backgroundColor: theme.colors.secondary.main,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.sm,
      alignSelf: "flex-start" as const,
      marginBottom: theme.spacing.sm,
    },
    featuredBadgeText: {
      ...getTextStyle(theme, "caption", "bold", theme.colors.neutral.white),
      fontSize: 10,
    },
    resourceCard: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.md,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      ...theme.shadows.sm,
    },
    resourceIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.primary[50],
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginRight: theme.spacing.md,
    },
    resourceContent: {
      flex: 1,
    },
    resourceTitle: {
      ...getTextStyle(theme, "body", "semibold", theme.colors.text.primary),
      marginBottom: 2,
    },
    resourceDescription: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
      marginBottom: theme.spacing.xs,
    },
    resourceMeta: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.spacing.sm,
    },
    metaItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 2,
    },
    metaText: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.tertiary),
      fontSize: 10,
    },
    resourceActions: {
      alignItems: "center" as const,
      gap: theme.spacing.sm,
    },
    bookmarkButton: {
      padding: theme.spacing.xs,
    },
    externalLink: {
      padding: theme.spacing.xs,
    },
    onelineCard: {
      backgroundColor: theme.colors.secondary[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginVertical: theme.spacing.lg,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.secondary.main,
      alignItems: "center" as const,
      ...theme.shadows.sm,
    },
    onelineText: {
      ...getTextStyle(
        theme,
        "subheading",
        "semibold",
        theme.colors.primary.main
      ),
      fontStyle: "italic" as const,
      textAlign: "center" as const,
      marginBottom: theme.spacing.sm,
    },
    onelineSource: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.secondary.main),
    },
    rtlText: {
      textAlign: "right" as const,
    },
  }))(theme);

  const filteredResources =
    selectedCategory === "all"
      ? resources
      : resources.filter((resource) => resource.category === selectedCategory);

  const featuredResources = filteredResources.filter((r) => r.featured);
  const regularResources = filteredResources.filter((r) => !r.featured);

  const getTypeIcon = (type: string) => {
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case "article":
        return theme.colors.primary.main;
      case "video":
        return theme.colors.accent.error;
      case "guide":
        return theme.colors.accent.success;
      case "checklist":
        return theme.colors.secondary.main;
      default:
        return theme.colors.primary.main;
    }
  };

  const handleResourcePress = (resource: Resource) => {
    Alert.alert(
      isRTL ? "قريباً" : "Coming Soon",
      isRTL
        ? "هذا المحتوى سيتوفر قريباً"
        : "This content will be available soon"
    );
  };

  const toggleBookmark = (resourceId: string) => {
    setBookmarkedItems((prev) =>
      prev.includes(resourceId)
        ? prev.filter((id) => id !== resourceId)
        : [...prev, resourceId]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
        >
          <ArrowLeft
            color={theme.colors.text.primary}
            size={24}
            style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
          />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
            {isRTL ? "المصادر التعليمية" : "Health Resources"}
          </Text>
          <Text style={[styles.headerSubtitle, isRTL && styles.rtlText]}>
            {isRTL
              ? "تعلم المزيد عن الصحة والرعاية"
              : "Learn more about health and care"}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        {/* Coming Soon Badge */}
        <View
          style={{
            backgroundColor: theme.colors.secondary[50],
            borderRadius: theme.borderRadius.lg,
            padding: theme.spacing.lg,
            marginBottom: theme.spacing.lg,
            borderLeftWidth: 4,
            borderLeftColor: theme.colors.secondary.main,
            alignItems: "center",
            ...theme.shadows.sm,
          }}
        >
          <View
            style={{
              backgroundColor: "#FCD34D",
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xs,
              borderRadius: theme.borderRadius.full,
              marginBottom: theme.spacing.sm,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Geist-Bold",
                color: "#92400E",
              }}
            >
              {isRTL ? "قريباً" : "COMING SOON"}
            </Text>
          </View>
          <Text
            style={[
              getTextStyle(
                theme,
                "subheading",
                "semibold",
                theme.colors.primary.main
              ),
              isRTL && styles.rtlText,
              { textAlign: "center", marginBottom: theme.spacing.xs },
            ]}
          >
            {isRTL
              ? "المصادر التعليمية قريباً"
              : "Health Resources Coming Soon"}
          </Text>
          <Text
            style={[
              getTextStyle(
                theme,
                "body",
                "regular",
                theme.colors.text.secondary
              ),
              isRTL && styles.rtlText,
              { textAlign: "center" },
            ]}
          >
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

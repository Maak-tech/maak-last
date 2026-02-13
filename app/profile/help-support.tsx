import { useNavigation, useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
  ArrowLeft,
  Book,
  ChevronRight,
  Clock,
  Globe,
  HelpCircle,
  Mail,
  MapPin,
  Phone,
  Video,
} from "lucide-react-native";
import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";

type ContactCardProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  value: string;
  method: string;
  color: string;
};

type HelpCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  comingSoon?: boolean;
};

export const options = {
  headerShown: false,
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This support screen intentionally renders multiple localized sections and FAQ/help cards.
export default function HelpSupportScreen() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();

  const isRTL = i18n.language === "ar";

  // Hide the default header to prevent duplicate headers
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const handleContactMethod = (method: string, value: string) => {
    switch (method) {
      case "phone":
        Linking.openURL(`tel:${value}`);
        break;
      case "email":
        Linking.openURL(`mailto:${value}`);
        break;
      case "website":
        Linking.openURL(value);
        break;
      default:
        Alert.alert(
          isRTL ? "قريباً" : "Coming Soon",
          isRTL
            ? "ستتوفر هذه الميزة قريباً"
            : "This feature will be available soon"
        );
    }
  };

  // biome-ignore lint/correctness/noNestedComponentDefinitions: Local helper renderer uses screen-local RTL and click handlers.
  const ContactCard = ({
    icon: Icon,
    title,
    subtitle,
    value,
    method,
    color,
  }: ContactCardProps) => (
    <TouchableOpacity
      onPress={() => handleContactMethod(method, value)}
      style={styles.contactCard}
    >
      <View style={[styles.contactIcon, { backgroundColor: `${color}20` }]}>
        <Icon color={color} size={24} />
      </View>
      <View style={styles.contactContent}>
        <Text style={[styles.contactTitle, isRTL && { textAlign: "left" }]}>
          {title}
        </Text>
        <Text style={[styles.contactSubtitle, isRTL && { textAlign: "left" }]}>
          {subtitle}
        </Text>
        <Text style={[styles.contactValue, isRTL && { textAlign: "left" }]}>
          {value}
        </Text>
      </View>
      <ChevronRight
        color="#94A3B8"
        size={20}
        style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
      />
    </TouchableOpacity>
  );

  // biome-ignore lint/correctness/noNestedComponentDefinitions: Local helper renderer uses screen-local RTL.
  const FAQItem = ({
    question,
    answer,
  }: {
    question: string;
    answer: string;
  }) => (
    <View style={styles.faqItem}>
      <Text style={[styles.faqQuestion, isRTL && { textAlign: "left" }]}>
        {question}
      </Text>
      <Text style={[styles.faqAnswer, isRTL && { textAlign: "left" }]}>
        {answer}
      </Text>
    </View>
  );

  // biome-ignore lint/correctness/noNestedComponentDefinitions: Local helper renderer uses screen-local RTL and alert behavior.
  const HelpCard = ({
    icon: Icon,
    title,
    description,
    color,
    comingSoon = false,
  }: HelpCardProps) => (
    <TouchableOpacity
      onPress={() => {
        if (comingSoon) {
          Alert.alert(
            isRTL ? "قريباً" : "Coming Soon",
            isRTL
              ? "هذه الميزة ستتوفر قريباً"
              : "This feature will be available soon"
          );
        }
      }}
      style={styles.helpCard}
    >
      <View style={[styles.helpIcon, { backgroundColor: `${color}20` }]}>
        <Icon color={color} size={20} />
      </View>
      <Text style={[styles.helpTitle, isRTL && { textAlign: "left" }]}>
        {title}
      </Text>
      <Text style={[styles.helpDescription, isRTL && { textAlign: "left" }]}>
        {description}
      </Text>
      {comingSoon ? (
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>
            {isRTL ? "قريباً" : "Coming Soon"}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <GradientScreen edges={["top"]} style={styles.container}>
      <View style={styles.headerWrapper}>
        <WavyBackground curve="home" height={220} variant="teal">
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
                  style={[styles.headerTitleRow, isRTL && styles.headerRowRTL]}
                >
                  <HelpCircle color="#EB9C0C" size={20} />
                  <Text style={styles.headerTitleText}>
                    {isRTL ? "المساعدة والدعم" : "Help & Support"}
                  </Text>
                </View>
                <Text style={[styles.headerSubtitle, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "فريق دعم معاك متاح لمساعدتك"
                    : "Maak support team is here to help you"}
                </Text>
              </View>
            </View>
          </View>
        </WavyBackground>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeIcon}>
            <HelpCircle color="#EB9C0C" size={40} />
          </View>
          <Text style={[styles.welcomeTitle, isRTL && { textAlign: "left" }]}>
            {isRTL ? "نحن هنا لمساعدتك" : "We're Here to Help"}
          </Text>
          <Text
            style={[styles.welcomeDescription, isRTL && { textAlign: "left" }]}
          >
            {isRTL
              ? "فريق دعم معاك متاح لمساعدتك في أي وقت. اختر الطريقة المناسبة للتواصل معنا."
              : "Maak support team is available to help you anytime. Choose the best way to contact us."}
          </Text>
        </View>

        {/* Contact Methods */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: "left" }]}>
            {isRTL ? "طرق التواصل" : "Contact Methods"}
          </Text>

          <ContactCard
            color="#3B82F6"
            icon={Mail}
            method="email"
            subtitle={
              isRTL
                ? "للاستفسارات العامة والدعم التقني"
                : "For general inquiries and technical support"
            }
            title={isRTL ? "راسلنا" : "Email Us"}
            value="info@maaktech.net"
          />

          <ContactCard
            color="#F59E0B"
            icon={Globe}
            method="website"
            subtitle={
              isRTL
                ? "معلومات شاملة ومركز المساعدة"
                : "Comprehensive information and help center"
            }
            title={isRTL ? "موقعنا الإلكتروني" : "Visit Website"}
            value="https://maaktech.net/"
          />
        </View>

        {/* Business Hours */}
        <View style={styles.businessHours}>
          <Clock color="#64748B" size={20} />
          <View style={styles.hoursContent}>
            <Text style={[styles.hoursTitle, isRTL && { textAlign: "left" }]}>
              {isRTL ? "ساعات العمل" : "Business Hours"}
            </Text>
            <Text style={[styles.hoursText, isRTL && { textAlign: "left" }]}>
              {isRTL
                ? "الأحد - الخميس: 9:00 صباحاً - 5:00 مساءً"
                : "Sunday - Thursday: 9:00 AM - 5:00 PM"}
            </Text>
            <Text style={[styles.hoursSubtext, isRTL && { textAlign: "left" }]}>
              {isRTL ? "توقيت الرياض (GMT+3)" : "Riyadh Time (GMT+3)"}
            </Text>
          </View>
        </View>

        {/* Quick Help */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: "left" }]}>
            {isRTL ? "مساعدة سريعة" : "Quick Help"}
          </Text>

          <View style={styles.helpGrid}>
            <HelpCard
              color="#2563EB"
              comingSoon={true}
              description={
                isRTL
                  ? "تعلم كيفية استخدام التطبيق"
                  : "Learn how to use the app"
              }
              icon={Book}
              title={isRTL ? "دليل الاستخدام" : "User Guide"}
            />

            <HelpCard
              color="#10B981"
              comingSoon={true}
              description={
                isRTL ? "شاهد الدروس التفاعلية" : "Watch interactive lessons"
              }
              icon={Video}
              title={isRTL ? "فيديوهات تعليمية" : "Video Tutorials"}
            />
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: "left" }]}>
            {isRTL ? "الأسئلة الشائعة" : "Frequently Asked Questions"}
          </Text>

          <FAQItem
            answer={
              isRTL
                ? 'اذهب إلى قسم العائلة واضغط على "دعوة فرد" ثم أدخل معلومات الفرد الجديد وأرسل الدعوة.'
                : 'Go to the Family section, tap "Invite Member", enter the new member\'s information and send the invitation.'
            }
            question={
              isRTL
                ? "كيف أضيف فرد جديد للعائلة؟"
                : "How do I add a new family member?"
            }
          />

          <FAQItem
            answer={
              isRTL
                ? 'من الشاشة الرئيسية، اضغط على "تسجيل عرض" واختر نوع العرض وشدته وأضف أي ملاحظات.'
                : 'From the main screen, tap "Log Symptom", select the symptom type, severity level, and add any notes.'
            }
            question={isRTL ? "كيف أسجل الأعراض؟" : "How do I log symptoms?"}
          />

          <FAQItem
            answer={
              isRTL
                ? "اذهب إلى قسم الأدوية، أضف دواء جديد أو عدل دواء موجود، واضبط أوقات التذكير."
                : "Go to Medications section, add a new medication or edit existing one, and set reminder times."
            }
            question={
              isRTL
                ? "كيف أضبط تذكيرات الأدوية؟"
                : "How do I set medication reminders?"
            }
          />

          <FAQItem
            answer={
              isRTL
                ? "نعم، نستخدم تشفير متقدم لحماية بياناتك ولا نشاركها مع أطراف ثالثة دون موافقتك."
                : "Yes, we use advanced encryption to protect your data and never share it with third parties without your consent."
            }
            question={isRTL ? "هل بياناتي آمنة؟" : "Is my data secure?"}
          />
        </View>

        {/* Emergency Contact */}
        <View style={styles.emergencySection}>
          <View style={styles.emergencyHeader}>
            <View style={styles.emergencyIcon}>
              <Phone color="#EF4444" size={20} />
            </View>
            <Text
              style={[styles.emergencyTitle, isRTL && { textAlign: "left" }]}
            >
              {isRTL ? "رقم الطوارئ" : "Emergency Contact"}
            </Text>
          </View>
          <Text
            style={[
              styles.emergencyDescription,
              isRTL && { textAlign: "left" },
            ]}
          >
            {isRTL
              ? "في حالة الطوارئ الطبية، اتصل بالرقم التالي:"
              : "For medical emergencies, call:"}
          </Text>
          <TouchableOpacity
            onPress={() => handleContactMethod("phone", "+966911")}
            style={styles.emergencyButton}
          >
            <Text
              style={[styles.emergencyNumber, isRTL && { textAlign: "left" }]}
            >
              911
            </Text>
          </TouchableOpacity>
        </View>

        {/* Location */}
        <View style={styles.locationSection}>
          <MapPin color="#64748B" size={20} />
          <View style={styles.locationContent}>
            <Text
              style={[styles.locationTitle, isRTL && { textAlign: "left" }]}
            >
              {isRTL ? "موقعنا" : "Our Location"}
            </Text>
            <Text style={[styles.locationText, isRTL && { textAlign: "left" }]}>
              {isRTL ? "رام الله، فلسطين" : "Palestine, Ramallah"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerWrapper: {
    flexShrink: 0,
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: 12,
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerRowRTL: {
    flexDirection: "row-reverse",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
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
    color: "#FFFFFF",
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
    paddingBottom: 40,
  },
  welcomeSection: {
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
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF8EB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: "#1E293B",
    marginBottom: 8,
    textAlign: "center",
  },
  welcomeDescription: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 16,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginEnd: 16,
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 2,
  },
  contactSubtitle: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#003543",
  },
  businessHours: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  hoursContent: {
    marginStart: 12,
    flex: 1,
  },
  hoursTitle: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 4,
  },
  hoursText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#059669",
    marginBottom: 2,
  },
  hoursSubtext: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#64748B",
  },
  helpGrid: {
    flexDirection: "row",
    gap: 12,
  },
  helpCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  helpIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  helpTitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 4,
    textAlign: "center",
  },
  helpDescription: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 16,
  },
  comingSoonBadge: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FEF3C7",
    borderRadius: 4,
  },
  comingSoonText: {
    fontSize: 10,
    fontFamily: "Inter-SemiBold",
    color: "#D97706",
    textTransform: "uppercase",
  },
  faqItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  faqQuestion: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    lineHeight: 20,
  },
  emergencySection: {
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  emergencyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  emergencyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginEnd: 8,
  },
  emergencyTitle: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: "#DC2626",
  },
  emergencyDescription: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#7F1D1D",
    marginBottom: 16,
    lineHeight: 20,
  },
  emergencyButton: {
    backgroundColor: "#DC2626",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  emergencyNumber: {
    fontSize: 18,
    fontFamily: "Inter-Bold",
    color: "#FFFFFF",
  },
  locationSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  locationContent: {
    marginStart: 12,
    flex: 1,
  },
  locationTitle: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#64748B",
  },
  rtlText: {
    textAlign: "right",
  },
});

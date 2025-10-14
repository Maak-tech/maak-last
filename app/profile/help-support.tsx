import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Linking,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  HelpCircle,
  Phone,
  Mail,
  Globe,
  MessageCircle,
  Book,
  Video,
  Clock,
  MapPin,
  ChevronRight,
} from 'lucide-react-native';

export default function HelpSupportScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const isRTL = i18n.language === 'ar';

  const handleContactMethod = (method: string, value: string) => {
    switch (method) {
      case 'phone':
        Linking.openURL(`tel:${value}`);
        break;
      case 'email':
        Linking.openURL(`mailto:${value}`);
        break;
      case 'website':
        Linking.openURL(value);
        break;
      default:
        Alert.alert(
          isRTL ? 'قريباً' : 'Coming Soon',
          isRTL
            ? 'ستتوفر هذه الميزة قريباً'
            : 'This feature will be available soon'
        );
    }
  };

  const ContactCard = ({
    icon: Icon,
    title,
    subtitle,
    value,
    method,
    color,
  }: any) => (
    <TouchableOpacity
      style={styles.contactCard}
      onPress={() => handleContactMethod(method, value)}
    >
      <View style={[styles.contactIcon, { backgroundColor: color + '20' }]}>
        <Icon size={24} color={color} />
      </View>
      <View style={styles.contactContent}>
        <Text style={[styles.contactTitle, isRTL && styles.rtlText]}>
          {title}
        </Text>
        <Text style={[styles.contactSubtitle, isRTL && styles.rtlText]}>
          {subtitle}
        </Text>
        <Text style={[styles.contactValue, isRTL && styles.rtlText]}>
          {value}
        </Text>
      </View>
      <ChevronRight
        size={20}
        color="#94A3B8"
        style={[isRTL && { transform: [{ rotate: '180deg' }] }]}
      />
    </TouchableOpacity>
  );

  const FAQItem = ({
    question,
    answer,
  }: {
    question: string;
    answer: string;
  }) => (
    <View style={styles.faqItem}>
      <Text style={[styles.faqQuestion, isRTL && styles.rtlText]}>
        {question}
      </Text>
      <Text style={[styles.faqAnswer, isRTL && styles.rtlText]}>{answer}</Text>
    </View>
  );

  const HelpCard = ({ icon: Icon, title, description, color }: any) => (
    <TouchableOpacity style={styles.helpCard}>
      <View style={[styles.helpIcon, { backgroundColor: color + '20' }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={[styles.helpTitle, isRTL && styles.rtlText]}>{title}</Text>
      <Text style={[styles.helpDescription, isRTL && styles.rtlText]}>
        {description}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
          onPress={() => router.back()}
        >
          <ArrowLeft
            size={24}
            color="#1E293B"
            style={[isRTL && { transform: [{ rotate: '180deg' }] }]}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {isRTL ? 'المساعدة والدعم' : 'Help & Support'}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeIcon}>
            <HelpCircle size={40} color="#2563EB" />
          </View>
          <Text style={[styles.welcomeTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'نحن هنا لمساعدتك' : "We're Here to Help"}
          </Text>
          <Text style={[styles.welcomeDescription, isRTL && styles.rtlText]}>
            {isRTL
              ? 'فريق دعم معاك متاح لمساعدتك في أي وقت. اختر الطريقة المناسبة للتواصل معنا.'
              : 'Maak support team is available to help you anytime. Choose the best way to contact us.'}
          </Text>
        </View>

        {/* Contact Methods */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'طرق التواصل' : 'Contact Methods'}
          </Text>

          <ContactCard
            icon={Phone}
            title={isRTL ? 'اتصل بنا' : 'Call Us'}
            subtitle={
              isRTL
                ? 'للحالات العاجلة والدعم المباشر'
                : 'For urgent issues and direct support'
            }
            value="+970 594521902"
            method="phone"
            color="#10B981"
          />

          <ContactCard
            icon={Mail}
            title={isRTL ? 'راسلنا' : 'Email Us'}
            subtitle={
              isRTL
                ? 'للاستفسارات العامة والدعم التقني'
                : 'For general inquiries and technical support'
            }
            value="info@maaktech.net"
            method="email"
            color="#3B82F6"
          />

          <ContactCard
            icon={MessageCircle}
            title={isRTL ? 'الدردشة المباشرة' : 'Live Chat'}
            subtitle={
              isRTL
                ? 'متاح خلال ساعات العمل'
                : 'Available during business hours'
            }
            value={isRTL ? 'ابدأ المحادثة' : 'Start Conversation'}
            method="chat"
            color="#8B5CF6"
          />

          <ContactCard
            icon={Globe}
            title={isRTL ? 'موقعنا الإلكتروني' : 'Visit Website'}
            subtitle={
              isRTL
                ? 'معلومات شاملة ومركز المساعدة'
                : 'Comprehensive information and help center'
            }
            value="https://maaktech.net/"
            method="website"
            color="#F59E0B"
          />
        </View>

        {/* Business Hours */}
        <View style={styles.businessHours}>
          <Clock size={20} color="#64748B" />
          <View style={styles.hoursContent}>
            <Text style={[styles.hoursTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'ساعات العمل' : 'Business Hours'}
            </Text>
            <Text style={[styles.hoursText, isRTL && styles.rtlText]}>
              {isRTL
                ? 'الأحد - الخميس: 9:00 صباحاً - 5:00 مساءً'
                : 'Sunday - Thursday: 9:00 AM - 5:00 PM'}
            </Text>
            <Text style={[styles.hoursSubtext, isRTL && styles.rtlText]}>
              {isRTL ? 'توقيت الرياض (GMT+3)' : 'Riyadh Time (GMT+3)'}
            </Text>
          </View>
        </View>

        {/* Quick Help */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'مساعدة سريعة' : 'Quick Help'}
          </Text>

          <View style={styles.helpGrid}>
            <HelpCard
              icon={Book}
              title={isRTL ? 'دليل الاستخدام' : 'User Guide'}
              description={
                isRTL
                  ? 'تعلم كيفية استخدام التطبيق'
                  : 'Learn how to use the app'
              }
              color="#2563EB"
            />

            <HelpCard
              icon={Video}
              title={isRTL ? 'فيديوهات تعليمية' : 'Video Tutorials'}
              description={
                isRTL ? 'شاهد الدروس التفاعلية' : 'Watch interactive lessons'
              }
              color="#10B981"
            />
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
          </Text>

          <FAQItem
            question={
              isRTL
                ? 'كيف أضيف فرد جديد للعائلة؟'
                : 'How do I add a new family member?'
            }
            answer={
              isRTL
                ? 'اذهب إلى قسم العائلة واضغط على "دعوة فرد" ثم أدخل معلومات الفرد الجديد وأرسل الدعوة.'
                : 'Go to the Family section, tap "Invite Member", enter the new member\'s information and send the invitation.'
            }
          />

          <FAQItem
            question={isRTL ? 'كيف أسجل الأعراض؟' : 'How do I log symptoms?'}
            answer={
              isRTL
                ? 'من الشاشة الرئيسية، اضغط على "تسجيل عرض" واختر نوع العرض وشدته وأضف أي ملاحظات.'
                : 'From the main screen, tap "Log Symptom", select the symptom type, severity level, and add any notes.'
            }
          />

          <FAQItem
            question={
              isRTL
                ? 'كيف أضبط تذكيرات الأدوية؟'
                : 'How do I set medication reminders?'
            }
            answer={
              isRTL
                ? 'اذهب إلى قسم الأدوية، أضف دواء جديد أو عدل دواء موجود، واضبط أوقات التذكير.'
                : 'Go to Medications section, add a new medication or edit existing one, and set reminder times.'
            }
          />

          <FAQItem
            question={isRTL ? 'هل بياناتي آمنة؟' : 'Is my data secure?'}
            answer={
              isRTL
                ? 'نعم، نستخدم تشفير متقدم لحماية بياناتك ولا نشاركها مع أطراف ثالثة دون موافقتك.'
                : 'Yes, we use advanced encryption to protect your data and never share it with third parties without your consent.'
            }
          />
        </View>

        {/* Emergency Contact */}
        <View style={styles.emergencySection}>
          <View style={styles.emergencyHeader}>
            <View style={styles.emergencyIcon}>
              <Phone size={20} color="#EF4444" />
            </View>
            <Text style={[styles.emergencyTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'رقم الطوارئ' : 'Emergency Contact'}
            </Text>
          </View>
          <Text style={[styles.emergencyDescription, isRTL && styles.rtlText]}>
            {isRTL
              ? 'في حالة الطوارئ الطبية، اتصل بالرقم التالي:'
              : 'For medical emergencies, call:'}
          </Text>
          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={() => handleContactMethod('phone', '+966911')}
          >
            <Text style={[styles.emergencyNumber, isRTL && styles.rtlText]}>
              911
            </Text>
          </TouchableOpacity>
        </View>

        {/* Location */}
        <View style={styles.locationSection}>
          <MapPin size={20} color="#64748B" />
          <View style={styles.locationContent}>
            <Text style={[styles.locationTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'موقعنا' : 'Our Location'}
            </Text>
            <Text style={[styles.locationText, isRTL && styles.rtlText]}>
              {isRTL
                ? 'رام الله، فلسطين'
                : 'Palestine, Ramallah'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonRTL: {
    transform: [{ scaleX: -1 }],
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  welcomeSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 16,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 2,
  },
  contactSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#2563EB',
  },
  businessHours: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  hoursContent: {
    marginLeft: 12,
    flex: 1,
  },
  hoursTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 4,
  },
  hoursText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#059669',
    marginBottom: 2,
  },
  hoursSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
  },
  helpGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  helpCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  helpIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  helpTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 4,
    textAlign: 'center',
  },
  helpDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  faqItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  faqQuestion: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    lineHeight: 20,
  },
  emergencySection: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  emergencyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  emergencyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
  },
  emergencyDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#7F1D1D',
    marginBottom: 16,
    lineHeight: 20,
  },
  emergencyButton: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  emergencyNumber: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  locationContent: {
    marginLeft: 12,
    flex: 1,
  },
  locationTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
  },
});

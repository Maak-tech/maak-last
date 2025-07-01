import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  FileText,
  Calendar,
  Shield,
  AlertTriangle,
  Info,
} from 'lucide-react-native';

export default function TermsConditionsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const isRTL = i18n.language === 'ar';

  const SectionCard = ({
    icon: Icon,
    title,
    children,
    color = '#2563EB',
  }: any) => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: color + '20' }]}>
          <Icon size={20} color={color} />
        </View>
        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
          {title}
        </Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );

  const TextParagraph = ({ children }: { children: string }) => (
    <Text style={[styles.paragraph, isRTL && styles.rtlText]}>{children}</Text>
  );

  const BulletPoint = ({ children }: { children: string }) => (
    <View style={styles.bulletContainer}>
      <Text style={styles.bullet}>•</Text>
      <Text style={[styles.bulletText, isRTL && styles.rtlText]}>
        {children}
      </Text>
    </View>
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
          {isRTL ? 'الشروط والأحكام' : 'Terms & Conditions'}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Introduction */}
        <View style={styles.introSection}>
          <View style={styles.introIcon}>
            <FileText size={40} color="#2563EB" />
          </View>
          <Text style={[styles.introTitle, isRTL && styles.rtlText]}>
            {isRTL
              ? 'شروط وأحكام استخدام تطبيق معاك'
              : 'Maak App Terms & Conditions'}
          </Text>
          <Text style={[styles.introDescription, isRTL && styles.rtlText]}>
            {isRTL
              ? 'يرجى قراءة هذه الشروط والأحكام بعناية قبل استخدام تطبيق معاك. باستخدامك للتطبيق، فإنك توافق على الالتزام بهذه الشروط.'
              : 'Please read these terms and conditions carefully before using the Maak app. By using the app, you agree to be bound by these terms.'}
          </Text>
          <View style={styles.lastUpdated}>
            <Calendar size={16} color="#64748B" />
            <Text style={[styles.lastUpdatedText, isRTL && styles.rtlText]}>
              {isRTL ? 'آخر تحديث: ديسمبر 2024' : 'Last Updated: December 2024'}
            </Text>
          </View>
        </View>

        {/* 1. Acceptance of Terms */}
        <SectionCard
          icon={Shield}
          title={isRTL ? '1. قبول الشروط' : '1. Acceptance of Terms'}
          color="#10B981"
        >
          <TextParagraph>
            {isRTL
              ? 'باستخدام تطبيق معاك ("التطبيق")، فإنك تؤكد أنك قد قرأت وفهمت ووافقت على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي من هذه الشروط، يرجى عدم استخدام التطبيق.'
              : 'By using the Maak app ("the App"), you acknowledge that you have read, understood, and agree to be bound by these terms and conditions. If you do not agree to any of these terms, please do not use the App.'}
          </TextParagraph>
        </SectionCard>

        {/* 2. Acceptable Use */}
        <SectionCard
          icon={Info}
          title={isRTL ? '2. الاستخدام المقبول' : '2. Acceptable Use'}
          color="#3B82F6"
        >
          <TextParagraph>
            {isRTL
              ? 'يجب استخدام التطبيق للأغراض المشروعة فقط ووفقاً لهذه الشروط. أنت توافق على عدم:'
              : 'The App must be used for lawful purposes only and in accordance with these terms. You agree not to:'}
          </TextParagraph>
          <BulletPoint>
            {isRTL
              ? 'استخدام التطبيق لأي غرض غير قانوني أو محظور'
              : 'Use the App for any unlawful or prohibited purpose'}
          </BulletPoint>
          <BulletPoint>
            {isRTL
              ? 'انتهاك أي قوانين أو لوائح محلية أو دولية'
              : 'Violate any local, national, or international laws or regulations'}
          </BulletPoint>
          <BulletPoint>
            {isRTL
              ? 'التدخل في أمان التطبيق أو محاولة الوصول غير المصرح به'
              : 'Interfere with the security of the App or attempt unauthorized access'}
          </BulletPoint>
          <BulletPoint>
            {isRTL
              ? 'نقل أو توزيع محتوى ضار أو مسيء'
              : 'Transmit or distribute harmful, offensive, or malicious content'}
          </BulletPoint>
        </SectionCard>

        {/* 3. Medical Information Disclaimer */}
        <SectionCard
          icon={AlertTriangle}
          title={
            isRTL
              ? '3. إخلاء المسؤولية الطبية'
              : '3. Medical Information Disclaimer'
          }
          color="#F59E0B"
        >
          <TextParagraph>
            {isRTL
              ? 'التطبيق يوفر معلومات عامة ولا يحل محل الاستشارة الطبية المهنية أو التشخيص أو العلاج. يجب استشارة مقدم الرعاية الصحية المؤهل دائماً قبل اتخاذ أي قرارات طبية.'
              : 'The App provides general information and does not replace professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before making any medical decisions.'}
          </TextParagraph>
          <TextParagraph>
            {isRTL
              ? 'في حالات الطوارئ الطبية، اتصل بخدمات الطوارئ المحلية فوراً.'
              : 'In case of medical emergencies, contact your local emergency services immediately.'}
          </TextParagraph>
        </SectionCard>

        {/* 4. Privacy and Data Protection */}
        <SectionCard
          icon={Shield}
          title={
            isRTL
              ? '4. الخصوصية وحماية البيانات'
              : '4. Privacy and Data Protection'
          }
          color="#8B5CF6"
        >
          <TextParagraph>
            {isRTL
              ? 'نحن نحترم خصوصيتك ونلتزم بحماية معلوماتك الشخصية والصحية. لمزيد من التفاصيل حول كيفية جمع واستخدام وحماية بياناتك، يرجى مراجعة سياسة الخصوصية الخاصة بنا.'
              : 'We respect your privacy and are committed to protecting your personal and health information. For details on how we collect, use, and protect your data, please review our Privacy Policy.'}
          </TextParagraph>
        </SectionCard>

        {/* 5. User Account and Security */}
        <SectionCard
          icon={Shield}
          title={
            isRTL ? '5. حساب المستخدم والأمان' : '5. User Account and Security'
          }
          color="#EF4444"
        >
          <TextParagraph>
            {isRTL
              ? 'أنت مسؤول عن الحفاظ على سرية حسابك ومعلومات تسجيل الدخول. يجب إخطارنا فوراً بأي استخدام غير مصرح به لحسابك.'
              : 'You are responsible for maintaining the confidentiality of your account and login information. You must notify us immediately of any unauthorized use of your account.'}
          </TextParagraph>
        </SectionCard>

        {/* 6. Intellectual Property */}
        <SectionCard
          icon={FileText}
          title={isRTL ? '6. الملكية الفكرية' : '6. Intellectual Property'}
          color="#06B6D4"
        >
          <TextParagraph>
            {isRTL
              ? 'جميع المحتويات والمواد في التطبيق محمية بحقوق الطبع والنشر والعلامات التجارية وحقوق الملكية الفكرية الأخرى. لا يجوز استخدام أو إعادة إنتاج أي محتوى دون إذن صريح.'
              : 'All content and materials in the App are protected by copyright, trademarks, and other intellectual property rights. No content may be used or reproduced without explicit permission.'}
          </TextParagraph>
        </SectionCard>

        {/* 7. Limitation of Liability */}
        <SectionCard
          icon={AlertTriangle}
          title={isRTL ? '7. تحديد المسؤولية' : '7. Limitation of Liability'}
          color="#F59E0B"
        >
          <TextParagraph>
            {isRTL
              ? 'لن نكون مسؤولين عن أي أضرار مباشرة أو غير مباشرة أو عرضية أو خاصة أو تبعية تنتج عن استخدام أو عدم القدرة على استخدام التطبيق.'
              : 'We shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use the App.'}
          </TextParagraph>
        </SectionCard>

        {/* 8. Modifications to Terms */}
        <SectionCard
          icon={Calendar}
          title={isRTL ? '8. تعديل الشروط' : '8. Modifications to Terms'}
          color="#10B981"
        >
          <TextParagraph>
            {isRTL
              ? 'نحتفظ بالحق في تعديل هذه الشروط والأحكام في أي وقت. سيتم إخطار المستخدمين بالتغييرات الجوهرية من خلال التطبيق أو البريد الإلكتروني.'
              : 'We reserve the right to modify these terms and conditions at any time. Users will be notified of material changes through the App or email.'}
          </TextParagraph>
        </SectionCard>

        {/* 9. Termination */}
        <SectionCard
          icon={AlertTriangle}
          title={isRTL ? '9. إنهاء الخدمة' : '9. Termination'}
          color="#EF4444"
        >
          <TextParagraph>
            {isRTL
              ? 'يمكننا إنهاء أو تعليق الوصول إلى التطبيق فوراً، دون إشعار مسبق، لأي سبب، بما في ذلك انتهاك هذه الشروط.'
              : 'We may terminate or suspend access to the App immediately, without prior notice, for any reason, including breach of these terms.'}
          </TextParagraph>
        </SectionCard>

        {/* 10. Governing Law */}
        <SectionCard
          icon={Shield}
          title={isRTL ? '10. القانون المطبق' : '10. Governing Law'}
          color="#8B5CF6"
        >
          <TextParagraph>
            {isRTL
              ? 'تخضع هذه الشروط والأحكام لقوانين المملكة العربية السعودية وتفسر وفقاً لها.'
              : 'These terms and conditions are governed by and construed in accordance with the laws of Saudi Arabia.'}
          </TextParagraph>
        </SectionCard>

        {/* Contact Information */}
        <View style={styles.contactSection}>
          <Text style={[styles.contactTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'تواصل معنا' : 'Contact Us'}
          </Text>
          <Text style={[styles.contactText, isRTL && styles.rtlText]}>
            {isRTL
              ? 'إذا كان لديك أي أسئلة حول هذه الشروط والأحكام، يرجى التواصل معنا:'
              : 'If you have any questions about these terms and conditions, please contact us:'}
          </Text>
          <Text style={[styles.contactDetails, isRTL && styles.rtlText]}>
            {isRTL ? 'البريد الإلكتروني: ' : 'Email: '}legal@maak.app
          </Text>
          <Text style={[styles.contactDetails, isRTL && styles.rtlText]}>
            {isRTL ? 'الهاتف: ' : 'Phone: '}+966 12 345 6789
          </Text>
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
  introSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  introIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  introDescription: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  lastUpdated: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  lastUpdatedText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    flex: 1,
  },
  sectionContent: {
    padding: 16,
  },
  paragraph: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginRight: 8,
    marginTop: 2,
  },
  bulletText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
    flex: 1,
  },
  contactSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  contactTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  contactDetails: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#2563EB',
    marginBottom: 4,
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
  },
});

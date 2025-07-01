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
import { ArrowLeft, Shield } from 'lucide-react-native';

export default function PrivacyPolicyScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const isRTL = i18n.language === 'ar';

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
          {isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Introduction */}
        <View style={styles.introSection}>
          <View style={styles.introIcon}>
            <Shield size={40} color="#2563EB" />
          </View>
          <Text style={[styles.introTitle, isRTL && styles.rtlText]}>
            {isRTL ? 'سياسة خصوصية تطبيق معاك' : 'Maak App Privacy Policy'}
          </Text>
          <Text style={[styles.introDescription, isRTL && styles.rtlText]}>
            {isRTL
              ? 'نحن نحترم خصوصيتك ونلتزم بحماية معلوماتك الشخصية والصحية. تشرح هذه السياسة كيفية جمع واستخدام وحماية بياناتك.'
              : 'We respect your privacy and are committed to protecting your personal and health information. This policy explains how we collect, use, and protect your data.'}
          </Text>
        </View>

        <Text style={[styles.comingSoon, isRTL && styles.rtlText]}>
          {isRTL
            ? 'جاري إعداد سياسة الخصوصية الشاملة...'
            : 'Comprehensive privacy policy content is being prepared...'}
        </Text>
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
  },
  comingSoon: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 50,
    paddingHorizontal: 32,
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
  },
});

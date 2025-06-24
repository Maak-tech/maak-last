import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Heart } from 'lucide-react-native';

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const { signUp, loading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isRTL = i18n.language === 'ar';

  const handleRegister = async () => {
    setErrors({});
    
    if (!name || !email || !password || !confirmPassword) {
      setErrors({
        general: 'Please fill in all fields',
      });
      return;
    }

    if (password !== confirmPassword) {
      setErrors({
        confirmPassword: 'Passwords do not match',
      });
      return;
    }

    if (password.length < 6) {
      setErrors({
        password: 'Password must be at least 6 characters',
      });
      return;
    }

    try {
      await signUp(email, password, name);
    } catch (error: any) {
      setErrors({
        general: error.message || 'Registration failed. Please try again.',
      });
    }
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardContainer}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={toggleLanguage} style={styles.languageButton}>
              <Text style={styles.languageText}>{i18n.language === 'en' ? 'عربي' : 'English'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Heart size={40} color="#2563EB" />
            </View>
            <Text style={[styles.appName, isRTL && styles.rtlText]}>Maak</Text>
            <Text style={[styles.tagline, isRTL && styles.rtlText]}>
              {isRTL ? 'انضم إلى مجتمع الصحة العائلية' : 'Join the family health community'}
            </Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={[styles.title, isRTL && styles.rtlText]}>{t('createAccount')}</Text>

            {errors.general && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errors.general}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {isRTL ? 'الاسم الكامل' : 'Full Name'}
              </Text>
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={name}
                onChangeText={setName}
                textAlign={isRTL ? 'right' : 'left'}
                placeholder={isRTL ? 'ادخل اسمك الكامل' : 'Enter your full name'}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>{t('email')}</Text>
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                textAlign={isRTL ? 'right' : 'left'}
                placeholder={isRTL ? 'ادخل بريدك الإلكتروني' : 'Enter your email'}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>{t('password')}</Text>
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput, errors.password && styles.inputError]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textAlign={isRTL ? 'right' : 'left'}
                placeholder={isRTL ? 'ادخل كلمة المرور' : 'Enter your password'}
              />
              {errors.password && (
                <Text style={styles.fieldErrorText}>{errors.password}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>{t('confirmPassword')}</Text>
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput, errors.confirmPassword && styles.inputError]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                textAlign={isRTL ? 'right' : 'left'}
                placeholder={isRTL ? 'أعد إدخال كلمة المرور' : 'Confirm your password'}
              />
              {errors.confirmPassword && (
                <Text style={styles.fieldErrorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.registerButton, loading && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.registerButtonText}>
                {loading ? t('loading') : t('createAccount')}
              </Text>
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={[styles.loginText, isRTL && styles.rtlText]}>
                {t('alreadyHaveAccount')}
              </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text style={[styles.loginLink, isRTL && styles.rtlText]}>{t('signIn')}</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flexGrow: 1,
    minHeight: '100%',
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    position: 'absolute',
    top: 50,
    right: 24,
    zIndex: 1,
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 20,
  },
  languageText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#475569',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    backgroundColor: '#EBF4FF',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    textAlign: 'center',
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 32,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#DC2626',
  },
  fieldErrorText: {
    color: '#DC2626',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  rtlInput: {
    fontFamily: 'Cairo-Regular',
  },
  registerButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  registerButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginRight: 4,
  },
  loginLink: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#2563EB',
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
  },
});
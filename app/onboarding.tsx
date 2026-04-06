import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Animated,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { createThemedStyles, getTextStyle } from '@/utils/styles';
import { Heart, Users, Bell, Shield } from 'lucide-react-native';
import { appleHealthService } from '@/lib/services/appleHealthService';

const ONBOARDING_STEP_KEY = 'nuralix_onboarding_step';
const ONBOARDING_COMPLETE_KEY = 'nuralix_onboarding_complete';

const onboardingSteps = [
  {
    key: 'welcome',
    image: require('@/assets/images/welcome.png'),
    titleEn: 'Welcome to Maak',
    titleAr: 'مرحباً بك في معك',
    descEn: 'Your family health companion. Keep track of your loved ones health and stay connected.',
    descAr: 'رفيقك الصحي للعائلة. تابع صحة أحبائك وابقَ على تواصل معهم.',
    onelinerEn: '"Health starts at home"',
    onelinerAr: '"خليهم دايمًا معك"',
  },
  {
    key: 'track',
    image: require('@/assets/images/track-health..png'),
    titleEn: 'Track Health Together',
    titleAr: 'تتبع الصحة معاً',
    descEn: 'Monitor symptoms, medications, and vital signs for your entire family in one place.',
    descAr: 'راقب الأعراض والأدوية والعلامات الحيوية لعائلتك بأكملها في مكان واحد.',
    onelinerEn: '"Health starts at home"',
    onelinerAr: '"خليهم دايمًا معك"',
  },
  {
    key: 'family',
    image: require('@/assets/images/manage-family.png'),
    titleEn: 'Manage Your Family',
    titleAr: 'إدارة عائلتك',
    descEn: 'Invite family members, share health data, and provide care for each other.',
    descAr: 'ادع أفراد العائلة، وشارك البيانات الصحية، واعتنوا ببعضكم البعض.',
    onelinerEn: '"Health starts at home"',
    onelinerAr: '"خليهم دايمًا معك"',
  },
  {
    key: 'connect-health',
    image: require('@/assets/images/manage-family.png'),
    titleEn: 'Connect Your Health Data',
    titleAr: 'اربط بياناتك الصحية',
    descEn: 'Sync with Apple Health or Android Health Connect to automatically import your vitals, steps, and sleep data.',
    descAr: 'زامن مع Apple Health أو Android Health Connect لاستيراد مؤشراتك الحيوية وخطواتك وبيانات نومك تلقائيًا.',
    onelinerEn: '"Your data, your health"',
    onelinerAr: '"بياناتك، صحتك"',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { updateUser } = useAuth();
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [healthConnecting, setHealthConnecting] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);

  const isRTL = i18n.language === 'ar';

  // Restore persisted onboarding step on mount
  useEffect(() => {
    SecureStore.getItemAsync(ONBOARDING_STEP_KEY).then((stored) => {
      if (stored) {
        const savedStep = parseInt(stored, 10);
        if (!isNaN(savedStep) && savedStep > 0) setCurrentStep(savedStep);
      }
    }).catch(() => { /* ignore SecureStore errors on first install */ });
  }, []);

  const advanceStep = (newStep: number) => {
    setCurrentStep(newStep);
    SecureStore.setItemAsync(ONBOARDING_STEP_KEY, String(newStep)).catch(() => {});
  };

  const completeOnboarding = async () => {
    await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, 'true').catch(() => {});
    await SecureStore.deleteItemAsync(ONBOARDING_STEP_KEY).catch(() => {});
    router.replace('/(tabs)');
  };

  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      flexDirection: 'row' as const,
      justifyContent: 'flex-end' as const,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
    },
    skipButton: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    skipText: {
      ...getTextStyle(theme, 'body', 'medium', theme.colors.text.secondary),
    },
    progressContainer: {
      flexDirection: 'row' as const,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      paddingVertical: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.neutral[200],
    },
    progressDotActive: {
      width: 24,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.primary.main,
    },
    content: {
      flex: 1,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.base,
    },
    imageSection: {
      alignItems: 'center' as const,
      flex: 1,
      justifyContent: 'center' as const,
      maxHeight: '50%',
    },
    imageContainer: {
      width: 260,
      height: 260,
      borderRadius: 20,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      backgroundColor: theme.colors.background.secondary,
      ...theme.shadows.lg,
    },
    image: {
      width: 220,
      height: 220,
      borderRadius: 15,
    },
    textContainer: {
      alignItems: 'center' as const,
      paddingHorizontal: theme.spacing.base,
      flex: 1,
      justifyContent: 'center' as const,
      minHeight: 200,
    },
    title: {
      ...getTextStyle(theme, 'heading', 'bold', theme.colors.primary.main),
      fontSize: 28,
      textAlign: 'center' as const,
      marginBottom: theme.spacing.lg,
      lineHeight: 34,
    },
    description: {
      ...getTextStyle(theme, 'body', 'regular', theme.colors.text.secondary),
      textAlign: 'center' as const,
      lineHeight: 22,
      marginBottom: theme.spacing.xl,
      fontSize: 16,
    },
    oneliner: {
      ...getTextStyle(theme, 'subheading', 'semibold', theme.colors.secondary.main),
      fontStyle: 'italic' as const,
      textAlign: 'center' as const,
      fontSize: 18,
    },
    footer: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
    },
    buttonContainer: {
      flexDirection: 'row' as const,
      gap: theme.spacing.md,
    },
    primaryButton: {
      flex: 1,
      backgroundColor: theme.colors.primary.main,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.base,
      alignItems: 'center' as const,
      ...theme.shadows.md,
    },
    primaryButtonText: {
      ...getTextStyle(theme, 'button', 'bold', theme.colors.neutral.white),
    },
    secondaryButton: {
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.lg,
      alignItems: 'center' as const,
    },
    secondaryButtonText: {
      ...getTextStyle(theme, 'button', 'medium', theme.colors.text.secondary),
    },
    rtlText: {
      textAlign: 'right' as const,
    },
  }))(theme);

  const requestHealthPermissions = async () => {
    setHealthConnecting(true);
    try {
      if (Platform.OS === 'ios') {
        await appleHealthService.requestPermissions([
          'heart_rate',
          'steps',
          'sleep',
          'blood_pressure',
          'weight',
          'blood_oxygen',
        ]);
        setHealthConnected(true);
      } else if (Platform.OS === 'android') {
        // Health Connect permissions are handled separately after onboarding.
        // Navigate forward; the user can connect from Profile → Connected Devices.
        setHealthConnected(true);
      }
    } catch {
      // Silently fail — user can connect later from Profile → Connected Devices
      setHealthConnected(false);
    } finally {
      setHealthConnecting(false);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
      }
    } catch {}
  };

  const handleComplete = async () => {
    if (isCompleting) return;

    setIsCompleting(true);
    try {
      await updateUser({ onboardingCompleted: true });
      // Small delay to ensure state is updated
      setTimeout(() => {
        completeOnboarding();
      }, 300);
    } catch (error: unknown) {
      console.error('Error completing onboarding:', error instanceof Error ? error.message : String(error));
      setIsCompleting(false);
    }
  };

  const nextStep = async () => {
    if (currentStep < onboardingSteps.length - 1) {
      // Request notification permission on the second-to-last or last step
      if (
        currentStep === onboardingSteps.length - 1 ||
        currentStep === onboardingSteps.length - 2
      ) {
        await requestNotificationPermission();
      }
      advanceStep(currentStep + 1);
    } else {
      // Last step — request notification permission before completing
      await requestNotificationPermission();
      handleComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      advanceStep(currentStep - 1);
    }
  };

  const skip = async () => {
    // Request notification permission when skipping (user has seen enough context)
    await requestNotificationPermission();
    handleComplete();
  };

  const currentStepData = onboardingSteps[currentStep];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={skip} style={styles.skipButton}>
          <Text style={[styles.skipText, isRTL && styles.rtlText]}>
            {isRTL ? 'تخطي' : 'Skip'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {onboardingSteps.map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index === currentStep && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Image Section */}
        <View style={styles.imageSection}>
          <View style={styles.imageContainer}>
            <Image
              source={currentStepData.image}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Text Section */}
        <View style={styles.textContainer}>
          <Text style={[styles.title, isRTL && styles.rtlText]}>
            {isRTL ? currentStepData.titleAr : currentStepData.titleEn}
          </Text>

          <Text style={[styles.description, isRTL && styles.rtlText]}>
            {isRTL ? currentStepData.descAr : currentStepData.descEn}
          </Text>

          {currentStepData.key === 'connect-health' ? (
            /* Health data connection buttons */
            <View style={{ width: '100%', gap: 10, marginTop: 4 }}>
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  onPress={requestHealthPermissions}
                  disabled={healthConnecting || healthConnected}
                  style={{
                    backgroundColor: healthConnected ? '#10B981' : theme.colors.primary.main,
                    borderRadius: theme.borderRadius.lg,
                    paddingVertical: theme.spacing.base,
                    alignItems: 'center' as const,
                    flexDirection: 'row' as const,
                    justifyContent: 'center' as const,
                    gap: 8,
                    opacity: healthConnecting ? 0.7 : 1,
                  }}
                >
                  {healthConnecting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : null}
                  <Text style={{ color: '#fff', fontWeight: '600' as const, fontSize: 15 }}>
                    {healthConnected
                      ? (isRTL ? 'تم الربط بـ Apple Health' : 'Apple Health Connected')
                      : (isRTL ? 'ربط Apple Health' : 'Connect Apple Health')}
                  </Text>
                </TouchableOpacity>
              )}
              {Platform.OS === 'android' && (
                <TouchableOpacity
                  onPress={requestHealthPermissions}
                  disabled={healthConnecting || healthConnected}
                  style={{
                    backgroundColor: healthConnected ? '#10B981' : theme.colors.primary.main,
                    borderRadius: theme.borderRadius.lg,
                    paddingVertical: theme.spacing.base,
                    alignItems: 'center' as const,
                    flexDirection: 'row' as const,
                    justifyContent: 'center' as const,
                    gap: 8,
                    opacity: healthConnecting ? 0.7 : 1,
                  }}
                >
                  {healthConnecting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : null}
                  <Text style={{ color: '#fff', fontWeight: '600' as const, fontSize: 15 }}>
                    {healthConnected
                      ? (isRTL ? 'تم الربط بـ Health Connect' : 'Health Connect Connected')
                      : (isRTL ? 'ربط Health Connect' : 'Connect Android Health')}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={nextStep}
                style={{
                  paddingVertical: theme.spacing.base,
                  alignItems: 'center' as const,
                }}
              >
                <Text style={{ color: theme.colors.text.secondary, fontSize: 14 }}>
                  {isRTL ? 'تخطي في الوقت الحالي' : 'Skip for now'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.oneliner, isRTL && styles.rtlText]}>
              {isRTL ? currentStepData.onelinerAr : currentStepData.onelinerEn}
            </Text>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.buttonContainer}>
          {currentStep > 0 && (
            <TouchableOpacity onPress={prevStep} style={styles.secondaryButton}>
              <Text
                style={[styles.secondaryButtonText, isRTL && styles.rtlText]}
              >
                {isRTL ? 'السابق' : 'Back'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={nextStep}
            style={styles.primaryButton}
            disabled={isCompleting}
          >
            <Text style={[styles.primaryButtonText, isRTL && styles.rtlText]}>
              {currentStep === onboardingSteps.length - 1
                ? isCompleting
                  ? (isRTL ? 'جاري التحميل...' : 'Loading...')
                  : (isRTL ? 'ابدأ الآن' : 'Get Started')
                : (isRTL ? 'التالي' : 'Next')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

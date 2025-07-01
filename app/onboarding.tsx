import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Heart, Users, Bell, Shield } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');

const onboardingSteps = [
  {
    key: 'health',
    icon: Heart,
    titleKey: 'onboardingTitle1',
    descKey: 'onboardingDesc1',
    color: '#2563EB',
  },
  {
    key: 'family',
    icon: Users,
    titleKey: 'onboardingTitle2',
    descKey: 'onboardingDesc2',
    color: '#10B981',
  },
  {
    key: 'alerts',
    icon: Bell,
    titleKey: 'onboardingTitle3',
    descKey: 'onboardingDesc3',
    color: '#F59E0B',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { updateUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  const isRTL = i18n.language === 'ar';

  const handleComplete = async () => {
    if (isCompleting) return;

    setIsCompleting(true);
    try {
      await updateUser({ onboardingCompleted: true });
      // Small delay to ensure state is updated
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 300);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsCompleting(false);
    }
  };

  const nextStep = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skip = () => {
    handleComplete();
  };

  const currentStepData = onboardingSteps[currentStep];
  const IconComponent = currentStepData.icon;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={skip} style={styles.skipButton}>
          <Text style={[styles.skipText, isRTL && styles.rtlText]}>
            {t('skip')}
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
              {
                backgroundColor:
                  index === currentStep ? currentStepData.color : '#E2E8F0',
              },
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${currentStepData.color}20` },
          ]}
        >
          <IconComponent size={64} color={currentStepData.color} />
        </View>

        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {t(currentStepData.titleKey)}
        </Text>

        <Text style={[styles.description, isRTL && styles.rtlText]}>
          {t(currentStepData.descKey)}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.buttonContainer}>
          {currentStep > 0 && (
            <TouchableOpacity onPress={prevStep} style={styles.secondaryButton}>
              <Text
                style={[styles.secondaryButtonText, isRTL && styles.rtlText]}
              >
                {t('back')}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={nextStep}
            style={[
              styles.primaryButton,
              { backgroundColor: currentStepData.color },
            ]}
            disabled={isCompleting}
          >
            <Text style={[styles.primaryButtonText, isRTL && styles.rtlText]}>
              {currentStep === onboardingSteps.length - 1
                ? isCompleting
                  ? 'Loading...'
                  : t('continue')
                : t('next')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 16,
    color: '#64748B',
    fontFamily: 'Inter-Medium',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  progressDotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  rtlText: {
    textAlign: 'right',
  },
});

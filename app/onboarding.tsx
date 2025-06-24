import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Animated,
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
  const { t, i18n } = useTranslation();
  const { updateUser } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const isRTL = i18n.language === 'ar';
  const isLastStep = currentStep === onboardingSteps.length - 1;

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      scrollViewRef.current?.scrollTo({
        x: nextStep * screenWidth,
        animated: true,
      });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      scrollViewRef.current?.scrollTo({
        x: prevStep * screenWidth,
        animated: true,
      });
    }
  };

  const handleFinish = async () => {
    try {
      await updateUser({ onboardingCompleted: true });
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const handleSkip = async () => {
    await handleFinish();
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {onboardingSteps.map((_, index) => {
          const opacity = scrollX.interpolate({
            inputRange: [
              (index - 1) * screenWidth,
              index * screenWidth,
              (index + 1) * screenWidth,
            ],
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  opacity,
                  backgroundColor: currentStep === index ? '#2563EB' : '#CBD5E1',
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  const renderStep = (step: typeof onboardingSteps[0], index: number) => {
    const IconComponent = step.icon;

    return (
      <View key={step.key} style={styles.stepContainer}>
        <View style={styles.contentContainer}>
          <View style={[styles.iconContainer, { backgroundColor: `${step.color}20` }]}>
            <IconComponent size={60} color={step.color} />
          </View>

          <Text style={[styles.title, isRTL && styles.rtlText]}>
            {t(step.titleKey)}
          </Text>

          <Text style={[styles.description, isRTL && styles.rtlText]}>
            {t(step.descKey)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={[styles.skipText, isRTL && styles.rtlText]}>
            {t('skip')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {onboardingSteps.map(renderStep)}
      </ScrollView>

      {renderDots()}

      <View style={styles.bottomContainer}>
        <View style={styles.navigationContainer}>
          {currentStep > 0 && (
            <TouchableOpacity onPress={handlePrevious} style={styles.backButton}>
              <Text style={[styles.backButtonText, isRTL && styles.rtlText]}>
                {t('back')}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.spacer} />

          <TouchableOpacity
            onPress={isLastStep ? handleFinish : handleNext}
            style={styles.nextButton}
          >
            <Text style={styles.nextButtonText}>
              {isLastStep ? t('continue') : t('next')}
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  scrollView: {
    flex: 1,
  },
  stepContainer: {
    width: screenWidth,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  contentContainer: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 34,
  },
  description: {
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 26,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  spacer: {
    flex: 1,
  },
  nextButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    minWidth: 120,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  rtlText: {
    fontFamily: 'Cairo-Regular',
  },
});
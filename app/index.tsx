import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const navigated = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (navigated.current) return;
    navigated.current = true;

    try {
      if (!user) {
        router.replace('/(auth)/login');
      } else if (!user.onboardingCompleted) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('[Index] Navigation error:', error);
    }
  }, [loading, user?.id, user?.onboardingCompleted, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.loadingText}>
        {loading ? 'Loading...' : 'Navigating...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: 'system-ui',
    }),
  },
});

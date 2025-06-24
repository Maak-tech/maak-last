import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (!loading && !isNavigating) {
      setIsNavigating(true);
      
      // Add a small delay to ensure router is ready
      setTimeout(() => {
        try {
          if (!user) {
            router.replace('/(auth)/login');
          } else if (!user.onboardingCompleted) {
            router.replace('/onboarding');
          } else {
            router.replace('/(tabs)');
          }
        } catch (error) {
          console.error('Navigation error:', error);
          // Fallback navigation
          router.replace('/(auth)/login');
        }
      }, 100);
    }
  }, [user, loading, router, isNavigating]);

  if (loading || isNavigating) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return <View style={styles.container} />;
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
  },
});
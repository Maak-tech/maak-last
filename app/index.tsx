import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isNavigating && !error) {
      setIsNavigating(true);
      
      // Add error handling for navigation
      const navigate = async () => {
        try {
          // Ensure router is ready before navigation
          await new Promise(resolve => setTimeout(resolve, 200));
          
          if (!user) {
            router.replace('/(auth)/login');
          } else if (!user.onboardingCompleted) {
            router.replace('/onboarding');
          } else {
            router.replace('/(tabs)');
          }
        } catch (navigationError) {
          console.error('Navigation error:', navigationError);
          setError('Navigation failed. Please try again.');
          setIsNavigating(false);
          
          // Fallback navigation after error
          setTimeout(() => {
            try {
              router.replace('/(auth)/login');
            } catch (fallbackError) {
              console.error('Fallback navigation failed:', fallbackError);
            }
          }, 1000);
        }
      };

      navigate();
    }
  }, [user, loading, router, isNavigating, error]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

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
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: 'system-ui',
    }),
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    padding: 20,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: 'system-ui',
    }),
  },
});
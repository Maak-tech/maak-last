import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const navigate = useCallback(async () => {
    if (isNavigating || loading) return;
    
    setIsNavigating(true);
    setError(null);
    
    try {
      // Ensure router is ready and add proper delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (!user) {
        router.replace('/(auth)/login');
      } else if (!user.onboardingCompleted) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } catch (navigationError) {
      console.error('Navigation error:', navigationError);
      setError('Navigation failed. Retrying...');
      setIsNavigating(false);
      
      // Retry navigation with exponential backoff
      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, Math.pow(2, retryCount) * 1000);
      } else {
        setError('Unable to navigate. Please restart the app.');
      }
    }
  }, [user, loading, router, isNavigating, retryCount]);

  useEffect(() => {
    if (!loading && !isNavigating && !error) {
      navigate();
    }
  }, [loading, navigate, isNavigating, error, retryCount]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        {retryCount >= 3 && (
          <Text style={styles.retryText}>
            Please close and restart the app
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.loadingText}>Loading...</Text>
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
  retryText: {
    fontSize: 14,
    color: '#7F1D1D',
    textAlign: 'center',
    marginTop: 10,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: 'system-ui',
    }),
  },
});
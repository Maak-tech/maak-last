import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const renderCount = useRef(0);
  renderCount.current++;

  // Debug component lifecycle
  useEffect(() => {
    console.log('🔄 Index component MOUNTED');
    return () => {
      console.log('💀 Index component UNMOUNTED');
    };
  }, []);

  // Debug what we're receiving from useAuth
  console.log(
    `🏠 Index component RENDER #${renderCount.current} - user from useAuth:`,
    user ? `${user.name} (${user.id})` : 'null',
    'loading:',
    loading
  );

  // Single navigation effect - simplified logic
  useEffect(() => {
    console.log(
      '📱 Navigation useEffect triggered - loading:',
      loading,
      'user:',
      user ? `${user.name} (onboarding: ${user.onboardingCompleted})` : 'null'
    );

    // Don't navigate if still loading
    if (loading) {
      console.log('⏳ Still loading, waiting...');
      return;
    }

    console.log('🧭 Ready to navigate - performing navigation...');

    // Navigate immediately based on auth state
    try {
      if (!user) {
        console.log('➡️ Navigating to login (no user)');
        router.replace('/(auth)/login');
      } else if (!user.onboardingCompleted) {
        console.log('➡️ Navigating to onboarding (user needs onboarding)');
        router.replace('/onboarding');
      } else {
        console.log('➡️ Navigating to main app (user ready)');
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('❌ Navigation error:', error);
    }
  }, [loading, user?.id, user?.onboardingCompleted, router]); // Watch specific user properties

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

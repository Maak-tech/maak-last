import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from './theme';
import { LinearGradient } from 'expo-linear-gradient';

const Container = ({
  children,
  scroll = false,
  gradient = false,
  gradientColors = [colors.primary, colors.primaryDark],
  backgroundColor = colors.background,
  padding = true,
  style,
}) => {
  const content = (
    <View style={[styles.content, padding && styles.withPadding, style]}>
      {children}
    </View>
  );

  const scrollContent = scroll ? (
    <ScrollView
      contentContainerStyle={[padding && styles.withPadding]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    content
  );

  return (
    <>
      <StatusBar
        barStyle={gradient ? 'light-content' : 'dark-content'}
        backgroundColor={gradient ? gradientColors[0] : backgroundColor}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {gradient ? (
            <LinearGradient
              colors={gradientColors}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {scrollContent}
            </LinearGradient>
          ) : (
            <View style={[styles.container, { backgroundColor }]}>
              {scrollContent}
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  withPadding: {
    padding: spacing.md,
  },
});

export default Container;

// Note: Install react-native-linear-gradient
// npm install react-native-linear-gradient
// or use expo-linear-gradient if using Expo

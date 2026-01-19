import { LinearGradient } from "expo-linear-gradient";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "./theme";

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
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    content
  );

  return (
    <>
      <StatusBar
        backgroundColor={gradient ? gradientColors[0] : backgroundColor}
        barStyle={gradient ? "light-content" : "dark-content"}
      />

      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
          style={styles.container}
        >
          {gradient ? (
            <LinearGradient
              colors={gradientColors}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.gradient}
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

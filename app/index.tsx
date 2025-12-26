import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const lastNavigationTarget = useRef<string | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }

    // Determine target route based on user state
    let targetRoute: string | null = null;
    if (!user) {
      targetRoute = "/(auth)/login";
    } else if (user.onboardingCompleted !== true) {
      // Route to onboarding if explicitly false, undefined, or null
      // Only route to tabs if onboardingCompleted is explicitly true
      targetRoute = "/onboarding";
    } else {
      targetRoute = "/(tabs)";
    }

    // Only navigate if target has changed
    if (targetRoute === lastNavigationTarget.current) {
      return;
    }

    lastNavigationTarget.current = targetRoute;

    try {
      router.replace(targetRoute);
    } catch (error) {
      lastNavigationTarget.current = null;
      // Fallback to login on navigation error
      try {
        router.replace("/(auth)/login");
      } catch (fallbackError) {
        // Last resort - do nothing and let user see loading screen
      }
    }
  }, [loading, user?.id, user?.onboardingCompleted]);

  return (
    <View style={styles.container}>
      <Text style={styles.loadingText}>
        {loading ? "Loading..." : "Navigating..."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#64748B",
    fontFamily: Platform.select({
      ios: "System",
      android: "Roboto",
      web: "system-ui",
    }),
  },
});

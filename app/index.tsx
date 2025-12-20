import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    try {
      if (!user) {
        router.replace("/(auth)/login");
      } else if (user.onboardingCompleted) {
        router.replace("/(tabs)");
      } else {
        router.replace("/onboarding");
      }
    } catch (error) {
      // Silently handle error
    }
  }, [loading, user?.id, user?.onboardingCompleted, router]);

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

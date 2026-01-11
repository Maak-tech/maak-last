import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Info, Sparkles } from "lucide-react-native";

// This screen is isolated - TextImpl errors only affect this route
export default function PPGMeasureScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const [PPGComponent, setPPGComponent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect if not authenticated
    if (!user) {
      router.replace("/login");
      return;
    }

    // Load PPG component after mount to isolate any errors
    const loadComponent = () => {
      // For now, use simulated version to avoid camera conflicts
      // expo-camera (PPGVitalMonitor) conflicts with react-native-vision-camera (PPGVitalMonitorVisionCamera)
      // Until React 19 + Reanimated compatibility is fixed, use simulated only
      try {
        const simulatedModule = require("@/components/PPGVitalMonitor");
        setPPGComponent(() => simulatedModule.default);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    // Small delay to ensure app is fully mounted
    const timer = setTimeout(loadComponent, 100);
    return () => clearTimeout(timer);
  }, [user]);

  if (!user || loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>{isRTL ? "جاري تحميل مراقب PPG..." : "Loading PPG Monitor..."}</Text>
      </View>
    );
  }

  if (!PPGComponent) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{isRTL ? "تعذر تحميل مكون PPG" : "Unable to load PPG component"}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Coming Soon Banner */}
      <View style={styles.comingSoonBanner}>
        <View style={styles.bannerIconContainer}>
          <Sparkles color="#F59E0B" size={20} />
        </View>
        <View style={styles.bannerTextContainer}>
          <Text style={styles.bannerTitle}>{isRTL ? "PPG الكاميرا الحقيقية قريباً!" : "Real Camera PPG Coming Soon!"}</Text>
          <Text style={styles.bannerSubtitle}>
            {isRTL ? "في انتظار React Native Reanimated 4.0 لدعم الكاميرا الكامل" : "Waiting for React Native Reanimated 4.0 for full camera support"}
          </Text>
        </View>
      </View>

      {/* Current PPG Component (Simulated) */}
      <View style={{ flex: 1 }}>
        <PPGComponent
          visible={true}
          userId={user.id}
          onMeasurementComplete={(result: any) => {
            // Navigate back to track tab after completion
            // Track screen will auto-reload data with useFocusEffect
            router.back();
          }}
          onClose={() => {
            // Navigate back when closed
            router.back();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
    padding: 20,
  },
  comingSoonBanner: {
    backgroundColor: "#FEF3C7",
    borderBottomWidth: 2,
    borderBottomColor: "#F59E0B",
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 9999,
  },
  bannerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FCD34D",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 11,
    color: "#78350F",
    lineHeight: 14,
  },
});


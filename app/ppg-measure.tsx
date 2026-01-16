import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Info, Heart } from "lucide-react-native";

// This screen is isolated - TextImpl errors only affect this route
export default function PPGMeasureScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const [PPGComponent, setPPGComponent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [useRealCamera, setUseRealCamera] = useState(true);

  useEffect(() => {
    // Redirect if not authenticated
    if (!user) {
      router.replace("/login");
      return;
    }

    // Load PPG component after mount to isolate any errors
    const loadComponent = () => {
      try {
        // Use real VisionCamera PPG component for actual camera-based measurement
        // This uses react-native-vision-camera with frame processors for real PPG signal extraction
        const visionCameraModule = require("@/components/PPGVitalMonitorVisionCamera");
        setPPGComponent(() => visionCameraModule.default);
        setUseRealCamera(true);
      } catch (error) {
        // Fallback to simulated version if VisionCamera fails to load
        try {
          const simulatedModule = require("@/components/PPGVitalMonitor");
          setPPGComponent(() => simulatedModule.default);
          setUseRealCamera(false);
        } catch (fallbackError) {
          // Both failed
        }
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
      {/* Real Camera PPG Info Banner */}
      {useRealCamera && (
        <View style={styles.realCameraBanner}>
          <View style={styles.bannerIconContainer}>
            <Heart color="#10B981" size={20} />
          </View>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.realBannerTitle}>{isRTL ? "قياس PPG بالكاميرا الحقيقية" : "Real Camera PPG Measurement"}</Text>
            <Text style={styles.realBannerSubtitle}>
              {isRTL ? "استخدم الكاميرا الأمامية وإصبعك لقياس معدل ضربات القلب" : "Using front camera and fingertip for heart rate measurement"}
            </Text>
          </View>
        </View>
      )}

      {/* Fallback Banner if using simulated */}
      {!useRealCamera && (
        <View style={styles.comingSoonBanner}>
          <View style={styles.bannerIconContainer}>
            <Info color="#F59E0B" size={20} />
          </View>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>{isRTL ? "وضع المحاكاة" : "Simulation Mode"}</Text>
            <Text style={styles.bannerSubtitle}>
              {isRTL ? "الكاميرا الحقيقية غير متوفرة - استخدام بيانات محاكاة" : "Real camera unavailable - using simulated data"}
            </Text>
          </View>
        </View>
      )}

      {/* PPG Component */}
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
  realCameraBanner: {
    backgroundColor: "#D1FAE5",
    borderBottomWidth: 2,
    borderBottomColor: "#10B981",
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 9999,
  },
  realBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#065F46",
    marginBottom: 2,
  },
  realBannerSubtitle: {
    fontSize: 11,
    color: "#047857",
    lineHeight: 14,
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
    backgroundColor: "#34D399",
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


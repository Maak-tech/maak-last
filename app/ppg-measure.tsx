import { router } from "expo-router";
import { Heart } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";

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
        // This uses react-native-vision-camera with frame processors for REAL PPG signal extraction
        // CRITICAL: Only real camera data is used - no simulated data
        const visionCameraModule = require("@/components/PPGVitalMonitorVisionCamera");
        setPPGComponent(() => visionCameraModule.default);
        setUseRealCamera(true);
      } catch (error) {
        // VisionCamera failed to load - NO FALLBACK ALLOWED
        // Simulated data is scientifically invalid and completely disabled
        // Show error to user - this is the ONLY acceptable outcome

        // Set component to null - will show error message
        setPPGComponent(null);
        setUseRealCamera(false);
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
        <ActivityIndicator color="#2563EB" size="large" />
        <Text style={styles.loadingText}>
          {t("loadingPPGMonitor", "Loading PPG Monitor...")}
        </Text>
      </View>
    );
  }

  if (!PPGComponent) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Heart color="#EF4444" size={48} />
          <Text style={styles.errorTitle}>
            {t("ppgMeasurementUnavailable", "PPG Measurement Unavailable")}
          </Text>
          <Text style={styles.errorText}>
            {t(
              "ppgRequiresNativeBuild",
              "Real camera heart rate measurement requires a native build with react-native-vision-camera.\n\nExpo Go cannot be used for this feature as it requires real-time camera frame processing for accurate PPG readings."
            )}
          </Text>
          <Text style={styles.errorSubtext}>
            {t(
              "ppgUseNativeBuild",
              "Please use a native app build for real measurements."
            )}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButtonLarge}
          >
            <Text style={styles.backButtonLargeText}>
              {t("goBack", "Go Back")}
            </Text>
          </TouchableOpacity>
        </View>
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
            <Text style={styles.realBannerTitle}>
              {t("realCameraPPGMeasurement", "Real Camera PPG Measurement")}
            </Text>
            <Text style={styles.realBannerSubtitle}>
              {t(
                "usingBackCameraAndFlash",
                "Using back camera and flash for heart rate measurement"
              )}
            </Text>
          </View>
        </View>
      )}

      {/* No fallback banner - if VisionCamera fails, show error screen only */}

      {/* PPG Component */}
      <View style={{ flex: 1 }}>
        <PPGComponent
          onClose={() => {
            // Navigate back when closed
            router.back();
          }}
          onMeasurementComplete={() => {
            // Keep this route mounted so the PPG modal can show the success UI + score.
            // The user can tap "Done" which triggers `onClose` and navigates back.
          }}
          userId={user.id}
          visible={true}
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
  errorContainer: {
    alignItems: "center",
    paddingHorizontal: 32,
    maxWidth: 400,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  errorText: {
    fontSize: 15,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 12,
  },
  errorSubtext: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 24,
  },
  backButtonLarge: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 160,
    alignItems: "center",
  },
  backButtonLargeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
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

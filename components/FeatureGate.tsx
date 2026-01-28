import { Lock } from "lucide-react-native";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRevenueCat } from "@/hooks/useRevenueCat";
import {
  type FeatureId,
  featureGateService,
  useFeatureGate,
} from "@/lib/services/featureGateService";
import { paywallGuard } from "@/lib/utils/paywallGuard";
import { RevenueCatPaywall } from "./RevenueCatPaywall";

interface FeatureGateProps {
  /** Feature ID to check access for */
  featureId: FeatureId;
  /** Children to render if user has access */
  children: React.ReactNode;
  /** Fallback content to show if user doesn't have access (optional) */
  fallback?: React.ReactNode;
  /** Show upgrade prompt automatically when access is denied */
  showUpgradePrompt?: boolean;
  /** Custom message to show when access is denied */
  customMessage?: string;
}

/**
 * FeatureGate Component
 * Wraps premium features and shows upgrade prompt if user doesn't have access
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({
  featureId,
  children,
  fallback,
  showUpgradePrompt = true,
  customMessage,
}) => {
  const { hasAccess, needsUpgrade, feature, isLoading } =
    useFeatureGate(featureId);
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { refreshCustomerInfo } = useRevenueCat();
  const [showPaywall, setShowPaywall] = React.useState(false);

  // Show loading state while checking subscription
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
          {isRTL ? "جاري التحميل..." : "Loading..."}
        </Text>
      </View>
    );
  }

  // User has access - render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // User doesn't have access
  const handleUpgradePress = () => {
    // Prevent showing paywall if one is already showing globally
    if (!paywallGuard.tryShowPaywall()) {
      return;
    }

    if (showUpgradePrompt) {
      setShowPaywall(true);
    } else {
      const featureDisplayName = feature
        ? featureGateService.getFeatureDisplayName(featureId, isRTL)
        : isRTL
          ? "هذه الميزة"
          : "This feature";
      Alert.alert(
        isRTL ? "ميزة مميزة" : "Premium Feature",
        customMessage ||
          (isRTL
            ? `يتطلب ${featureDisplayName} اشتراك مميز`
            : `${featureDisplayName} requires a Premium subscription`),
        [
          {
            text: isRTL ? "إلغاء" : "Cancel",
            style: "cancel",
            onPress: () => {
              paywallGuard.hidePaywall();
            },
          },
          {
            text: isRTL ? "ترقية" : "Upgrade",
            onPress: () => {
              if (paywallGuard.tryShowPaywall()) {
                setShowPaywall(true);
              }
            },
          },
        ]
      );
    }
  };

  // Show custom fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default upgrade prompt UI
  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleUpgradePress}
        style={styles.upgradeContainer}
      >
        <View style={styles.upgradeContent}>
          <Lock color="#64748B" size={24} />
          <View style={styles.upgradeTextContainer}>
            <Text style={[styles.upgradeTitle, isRTL && styles.rtlText]}>
              {isRTL ? "ميزة مميزة" : "Premium Feature"}
            </Text>
            <Text style={[styles.upgradeDescription, isRTL && styles.rtlText]}>
              {customMessage ||
                (isRTL
                  ? `يتطلب ${feature?.name || "هذه الميزة"} اشتراك مميز`
                  : `${feature?.name || "This feature"} requires a Premium subscription`)}
            </Text>
          </View>
        </View>
        <Text style={[styles.upgradeButton, isRTL && styles.rtlText]}>
          {isRTL ? "ترقية" : "Upgrade"}
        </Text>
      </TouchableOpacity>

      {/* Paywall Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          paywallGuard.hidePaywall();
          setShowPaywall(false);
        }}
        presentationStyle="pageSheet"
        visible={showPaywall}
      >
        <RevenueCatPaywall
          onDismiss={async () => {
            paywallGuard.hidePaywall();
            setShowPaywall(false);
          }}
          onPurchaseComplete={async () => {
            // Refresh subscription status after purchase
            try {
              await refreshCustomerInfo();
            } catch (err) {
              // Error is already handled by the hook
            }
            paywallGuard.hidePaywall();
            setShowPaywall(false);
          }}
        />
      </Modal>
    </>
  );
};

/**
 * Hook-based feature gate (for programmatic checks)
 * Use this when you need to conditionally render or execute code based on feature access
 */
export function useFeatureAccess(featureId: FeatureId) {
  const { hasAccess, needsUpgrade, feature, isLoading } =
    useFeatureGate(featureId);
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  const showUpgradeAlert = (customMessage?: string) => {
    const featureDisplayName = feature
      ? featureGateService.getFeatureDisplayName(featureId, isRTL)
      : isRTL
        ? "هذه الميزة"
        : "This feature";
    Alert.alert(
      isRTL ? "ميزة مميزة" : "Premium Feature",
      customMessage ||
        (isRTL
          ? `يتطلب ${featureDisplayName} اشتراك مميز`
          : `${featureDisplayName} requires a Premium subscription`),
      [
        {
          text: isRTL ? "إلغاء" : "Cancel",
          style: "cancel",
        },
        {
          text: isRTL ? "ترقية" : "Upgrade",
          // Note: You'll need to handle navigation to paywall screen
        },
      ]
    );
  };

  return {
    hasAccess,
    needsUpgrade,
    feature,
    isLoading,
    showUpgradeAlert,
  };
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 14,
    color: "#64748B",
    fontFamily: "Geist-Regular",
  },
  upgradeContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    margin: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  upgradeContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  upgradeTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 4,
  },
  upgradeDescription: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
  },
  upgradeButton: {
    fontSize: 14,
    fontFamily: "Geist-SemiBold",
    color: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
  },
  rtlText: {
    fontFamily: "Geist-Regular",
  },
});

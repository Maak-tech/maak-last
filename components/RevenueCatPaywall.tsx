import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type {
  CustomerInfo,
  PurchasesError,
  PurchasesStoreTransaction,
} from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";
import { useRevenueCat } from "@/hooks/useRevenueCat";

type RevenueCatPaywallProps = {
  onPurchaseComplete?: () => void;
  onDismiss?: () => void;
};

/**
 * RevenueCat Paywall Component
 * Displays the RevenueCat Paywall UI for subscription purchases
 */
export function RevenueCatPaywall({
  onPurchaseComplete,
  onDismiss,
}: RevenueCatPaywallProps) {
  const { t } = useTranslation();
  const { isLoading, offerings, error, refreshOfferings, refreshCustomerInfo } =
    useRevenueCat();

  // All hooks must be called before any conditional returns
  useEffect(() => {
    if (error) {
      Alert.alert(t("error"), error.message || t("subscription.loadError"));
    }
  }, [error, t]);

  const handleRetry = async () => {
    try {
      await refreshOfferings();
    } catch (_err) {
      // Error is already handled by the hook
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>
          {t("subscription.loading", "Loading subscription plans...")}
        </Text>
      </View>
    );
  }

  if (!offerings) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          {t(
            "subscription.noOfferingsAvailable",
            "No subscription plans available at this time."
          )}
        </Text>
        <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>{t("retry", "Retry")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissButtonText}>{t("close", "Close")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <RevenueCatUI.Paywall
      onDismiss={onDismiss}
      onPurchaseCompleted={async ({
        customerInfo: _customerInfo,
        storeTransaction: _storeTransaction,
      }: {
        customerInfo: CustomerInfo;
        storeTransaction: PurchasesStoreTransaction;
      }) => {
        // Refresh customer info to update subscription status immediately
        try {
          await refreshCustomerInfo();
        } catch (_err) {
          // Error is already handled by the hook, continue anyway
        }

        Alert.alert(
          t("subscription.purchaseSuccess"),
          t("subscription.purchaseSuccessMessage"),
          [
            {
              text: t("ok"),
              onPress: () => {
                onPurchaseComplete?.();
              },
            },
          ]
        );
      }}
      onPurchaseError={({
        error: purchaseError,
      }: {
        error: PurchasesError;
      }) => {
        // Don't show error for user cancellation
        if (!purchaseError.userCancelled) {
          Alert.alert(
            t("subscription.purchaseError"),
            purchaseError.message || t("subscription.purchaseErrorMessage")
          );
        }
      }}
      onRestoreCompleted={async ({
        customerInfo: _customerInfo,
      }: {
        customerInfo: CustomerInfo;
      }) => {
        // Refresh customer info to update subscription status immediately
        try {
          await refreshCustomerInfo();
        } catch (_err) {
          // Error is already handled by the hook, continue anyway
        }

        Alert.alert(
          t("subscription.restoreSuccess"),
          t("subscription.restoreSuccessMessage")
        );
      }}
      options={{ offering: offerings }}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  dismissButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  dismissButtonText: {
    color: "#64748B",
    fontSize: 16,
  },
});

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import type {
  CustomerInfo,
  PurchasesError,
  PurchasesStoreTransaction,
} from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";
import { useRevenueCat } from "@/hooks/useRevenueCat";

interface RevenueCatPaywallProps {
  onPurchaseComplete?: () => void;
  onDismiss?: () => void;
}

/**
 * RevenueCat Paywall Component
 * Displays the RevenueCat Paywall UI for subscription purchases
 */
export function RevenueCatPaywall({
  onPurchaseComplete,
  onDismiss,
}: RevenueCatPaywallProps) {
  const { t } = useTranslation();
  const { isLoading, offerings, error } = useRevenueCat();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  useEffect(() => {
    if (error) {
      Alert.alert(t("error"), error.message || t("subscription.loadError"));
    }
  }, [error, t]);

  if (!(offerings || isLoading)) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          {t("subscription.noOfferingsAvailable")}
        </Text>
      </View>
    );
  }

  return (
    <RevenueCatUI.Paywall
      onDismiss={onDismiss}
      onPurchaseCompleted={({
        customerInfo,
        storeTransaction,
      }: {
        customerInfo: CustomerInfo;
        storeTransaction: PurchasesStoreTransaction;
      }) => {
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
      onPurchaseError={({ error }: { error: PurchasesError }) => {
        // Don't show error for user cancellation
        if (!error.userCancelled) {
          Alert.alert(
            t("subscription.purchaseError"),
            error.message || t("subscription.purchaseErrorMessage")
          );
        }
      }}
      onRestoreCompleted={({
        customerInfo,
      }: {
        customerInfo: CustomerInfo;
      }) => {
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
  },
});

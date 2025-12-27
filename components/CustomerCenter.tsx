import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { CustomerInfo, PurchasesError } from "react-native-purchases";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import RevenueCatUI from "react-native-purchases-ui";
import { useRevenueCat } from "@/hooks/useRevenueCat";

interface CustomerCenterProps {
  onDismiss?: () => void;
}

/**
 * Customer Center Component
 * Displays the RevenueCat Customer Center UI for subscription management
 */
export function CustomerCenter({ onDismiss }: CustomerCenterProps) {
  const { t } = useTranslation();
  const { isLoading, customerInfo, error, refreshCustomerInfo } = useRevenueCat();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  useEffect(() => {
    if (error) {
      Alert.alert(
        t("error"),
        error.message || t("subscription.loadError")
      );
    }
  }, [error, t]);

  if (!customerInfo && !isLoading) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t("subscription.noCustomerInfo")}</Text>
      </View>
    );
  }

  return (
    <RevenueCatUI.CustomerCenterView
      onRestoreCompleted={({ customerInfo }: { customerInfo: CustomerInfo }) => {
        refreshCustomerInfo();
        Alert.alert(
          t("subscription.restoreSuccess"),
          t("subscription.restoreSuccessMessage")
        );
      }}
      onRestoreFailed={({ error }: { error: PurchasesError }) => {
        Alert.alert(
          t("subscription.subscriptionError"),
          error.message || t("subscription.errorMessage")
        );
      }}
      onDismiss={onDismiss}
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


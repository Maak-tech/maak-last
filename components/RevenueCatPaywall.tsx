import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Linking,
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

const IS_DEV = process.env.NODE_ENV !== "production";

const TERMS_URL = "https://app.nuralix.ai/terms-conditions";
const PRIVACY_URL = "https://app.nuralix.ai/privacy-policy";

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
  const { t, i18n } = useTranslation();
  const { isLoading, offerings, error, refreshOfferings, refreshCustomerInfo } =
    useRevenueCat();
  const isRTL = i18n.language === "ar";

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
    // Log error for debugging
    if (error) {
      console.error("[RevenueCatPaywall] Offerings error:", error.message);
    } else {
      console.warn(
        "[RevenueCatPaywall] Offerings are null. Check RevenueCat dashboard configuration:",
        {
          offeringId: "ofrng88ce8c174f",
          hasError: !!error,
          isLoading,
        }
      );
    }

    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          {error
            ? error.message ||
              t(
                "subscription.noOfferingsAvailable",
                "No subscription plans available at this time."
              )
            : t(
                "subscription.noOfferingsAvailable",
                "No subscription plans available at this time."
              )}
        </Text>
        {IS_DEV && (
          <Text style={[styles.errorText, { fontSize: 12, marginTop: 8 }]}>
            {isRTL
              ? "للتصحيح: تأكد من تكوين المنتجات في App Store Connect / Google Play Console وتكوين العروض في لوحة تحكم RevenueCat."
              : "Debug: Ensure products are configured in App Store Connect / Google Play Console and offerings are set up in RevenueCat dashboard."}
          </Text>
        )}
        <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>{t("retry", "Retry")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissButtonText}>{t("close", "Close")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleTermsPress = () => {
    Linking.openURL(TERMS_URL);
  };

  const handlePrivacyPress = () => {
    Linking.openURL(PRIVACY_URL);
  };

  return (
    <View style={styles.container}>
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

      {/* Subscription disclosure + Terms/Privacy links - Required by Apple §3.1.2 */}
      <View style={styles.disclosureContainer}>
        <Text style={[styles.disclosureText, isRTL && styles.disclosureTextRTL]}>
          {isRTL
            ? "الاشتراك يتجدد تلقائياً ما لم يتم إلغاؤه قبل 24 ساعة على الأقل من نهاية الفترة الحالية. يتم تحصيل الرسوم من حساب iTunes عند تأكيد الشراء. يمكنك إدارة اشتراكك وإلغاؤه من إعدادات حسابك في App Store."
            : "Subscription automatically renews unless canceled at least 24 hours before the end of the current period. Payment is charged to your iTunes account at confirmation of purchase. You can manage and cancel your subscription from your App Store account settings."}
        </Text>
        <View style={[styles.linksContainer, isRTL && styles.linksContainerRTL]}>
          <TouchableOpacity onPress={handleTermsPress} style={styles.linkButton}>
            <Text style={[styles.linkText, isRTL && styles.linkTextRTL]}>
              {isRTL ? "شروط الاستخدام" : "Terms of Use (EULA)"}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.separator, isRTL && styles.separatorRTL]}>•</Text>
          <TouchableOpacity
            onPress={handlePrivacyPress}
            style={styles.linkButton}
          >
            <Text style={[styles.linkText, isRTL && styles.linkTextRTL]}>
              {isRTL ? "سياسة الخصوصية" : "Privacy Policy"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  disclosureContainer: {
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  disclosureText: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 8,
  },
  disclosureTextRTL: {
    fontFamily: "NotoSansArabic-Regular",
    textAlign: "center",
  },
  linksContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  linksContainerRTL: {
    flexDirection: "row-reverse",
  },
  linkButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 12,
    color: "#2563EB",
    textDecorationLine: "underline",
    fontFamily: "Inter-Medium",
  },
  linkTextRTL: {
    fontFamily: "NotoSansArabic-Regular",
  },
  separator: {
    fontSize: 12,
    color: "#94A3B8",
    marginHorizontal: 8,
  },
  separatorRTL: {
    marginHorizontal: 8,
  },
});

/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Self-contained destructive flow with confirmations and loading states. */
import { useNavigation, useRouter } from "expo-router";
import { AlertTriangle, ArrowLeft, Trash2 } from "lucide-react-native";
import { useCallback, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import accountDeletionService from "@/lib/services/accountDeletionService";

export const options = {
  headerShown: false,
};

export default function DeleteAccountScreen() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { logout } = useAuth();
  const isRTL = i18n.language.toLowerCase().startsWith("ar");

  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const expected = "DELETE";
  const canDelete = confirmText.trim().toUpperCase() === expected;

  const runDelete = useCallback(async () => {
    if (!canDelete || isDeleting) {
      return;
    }

    Alert.alert(
      isRTL ? "حذف الحساب" : "Delete account",
      isRTL
        ? "هذا الإجراء نهائي ولا يمكن التراجع عنه. هل تريد المتابعة؟"
        : "This action is permanent and cannot be undone. Do you want to continue?",
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isRTL ? "حذف" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              await accountDeletionService.deleteMyAccount();
              // After deletion, ensure local session is cleared.
              await logout();
              router.replace("/(auth)/login");
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              Alert.alert(
                isRTL ? "تعذر الحذف" : "Deletion failed",
                isRTL
                  ? "تعذر حذف الحساب الآن. يرجى المحاولة لاحقًا."
                  : `Could not delete your account right now. Please try again.\n\n${message}`
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }, [canDelete, isDeleting, isRTL, logout, router]);

  return (
    <GradientScreen edges={["top"]} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerWrapper}>
          <WavyBackground
            contentPosition="top"
            curve="home"
            height={250}
            variant="teal"
          >
            <View style={styles.headerContent}>
              <View style={[styles.headerRow, isRTL && styles.headerRowRTL]}>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/profile")}
                  style={styles.backButton}
                >
                  <ArrowLeft
                    color="#003543"
                    size={20}
                    style={
                      isRTL ? { transform: [{ rotate: "180deg" }] } : undefined
                    }
                  />
                </TouchableOpacity>
                <View style={styles.headerTitle}>
                  <View
                    style={[
                      styles.headerTitleRow,
                      isRTL && styles.headerRowRTL,
                    ]}
                  >
                    <Trash2 color="#EF4444" size={20} />
                    <Text style={styles.headerTitleText}>
                      {isRTL ? "حذف الحساب" : "Delete Account"}
                    </Text>
                  </View>
                  <Text
                    style={[styles.headerSubtitle, isRTL && styles.rtlText]}
                  >
                    {isRTL
                      ? "احذف حسابك وبياناتك من داخل التطبيق."
                      : "Delete your account and associated app data."}
                  </Text>
                </View>
              </View>
            </View>
          </WavyBackground>
        </View>

        <View style={styles.card}>
          <View style={[styles.cardHeader, isRTL && styles.headerRowRTL]}>
            <AlertTriangle color="#F59E0B" size={20} />
            <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>
              {isRTL ? "تنبيه" : "Warning"}
            </Text>
          </View>
          <Text style={[styles.cardText, isRTL && styles.rtlText]}>
            {isRTL
              ? "سيتم حذف حسابك وبياناتك من خوادمنا. لا يمكن التراجع عن هذا الإجراء."
              : "Your account and data will be deleted from our systems. This cannot be undone."}
          </Text>
          <Text style={[styles.cardHint, isRTL && styles.rtlText]}>
            {isRTL
              ? "للتأكيد، اكتب كلمة DELETE أدناه."
              : "To confirm, type DELETE below."}
          </Text>

          <TextInput
            autoCapitalize="characters"
            editable={!isDeleting}
            onChangeText={setConfirmText}
            placeholder={expected}
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={confirmText}
          />

          <TouchableOpacity
            disabled={!canDelete || isDeleting}
            onPress={runDelete}
            style={[
              styles.deleteButton,
              (!canDelete || isDeleting) && styles.deleteButtonDisabled,
            ]}
          >
            {isDeleting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.deleteButtonText}>
                {isRTL ? "حذف الحساب" : "Delete account"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },
  headerWrapper: { marginHorizontal: -24, marginBottom: -12 },
  headerContent: { paddingHorizontal: 24, paddingTop: 130, paddingBottom: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 50,
  },
  headerRowRTL: { flexDirection: "row-reverse" },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0, 53, 67, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitleText: { fontSize: 18, fontWeight: "700", color: "#003543" },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#0F172A",
    opacity: 0.75,
  },
  rtlText: { textAlign: "left" },
  card: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.15)",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  cardText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: "#0F172A",
    opacity: 0.9,
  },
  cardHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: "#334155",
    opacity: 0.85,
  },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  deleteButton: {
    marginTop: 14,
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  deleteButtonDisabled: {
    opacity: 0.55,
  },
  deleteButtonText: { color: "#FFFFFF", fontWeight: "800" },
});

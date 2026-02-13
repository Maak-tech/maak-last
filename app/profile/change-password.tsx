/**
 * Change Password Screen
 * Allows users to change their password
 * Matches Figma design with WavyBackground header and brand styling
 */

import { useNavigation, useRouter } from "expo-router";
import { ArrowLeft, Eye, EyeOff, Lock, Save } from "lucide-react-native";
import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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

export const options = {
  headerShown: false,
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This screen handles multiple guarded auth flows and platform-specific UX.
export default function ChangePasswordScreen() {
  const { i18n } = useTranslation();
  const { user, changePassword, resetPassword } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isRTL = i18n.language === "ar";

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!currentPassword) {
      newErrors.currentPassword = isRTL
        ? "يرجى إدخال كلمة المرور الحالية"
        : "Please enter your current password";
    }

    if (!newPassword) {
      newErrors.newPassword = isRTL
        ? "يرجى إدخال كلمة المرور الجديدة"
        : "Please enter a new password";
    } else if (newPassword.length < 6) {
      newErrors.newPassword = isRTL
        ? "يجب أن تكون كلمة المرور 6 أحرف على الأقل"
        : "Password must be at least 6 characters";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = isRTL
        ? "يرجى تأكيد كلمة المرور الجديدة"
        : "Please confirm your new password";
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = isRTL
        ? "كلمات المرور غير متطابقة"
        : "Passwords do not match";
    }

    if (currentPassword === newPassword) {
      newErrors.newPassword = isRTL
        ? "يجب أن تكون كلمة المرور الجديدة مختلفة عن الحالية"
        : "New password must be different from current password";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleForgotPassword = () => {
    if (!user?.email) {
      if (Platform.OS === "web") {
        window.confirm(
          isRTL
            ? "لم يتم العثور على عنوان البريد الإلكتروني"
            : "Email address not found"
        );
      } else {
        Alert.alert(
          isRTL ? "خطأ" : "Error",
          isRTL
            ? "لم يتم العثور على عنوان البريد الإلكتروني"
            : "Email address not found",
          [{ text: isRTL ? "موافق" : "OK" }]
        );
      }
      return;
    }

    const message = isRTL
      ? `سيتم إرسال رابط إعادة تعيين كلمة المرور إلى ${user.email}. هل تريد المتابعة؟`
      : `A password reset link will be sent to ${user.email}. Do you want to continue?`;

    if (Platform.OS === "web") {
      const confirmed = window.confirm(message);
      if (confirmed) {
        sendResetEmail();
      }
    } else {
      Alert.alert(
        isRTL ? "إعادة تعيين كلمة المرور" : "Reset Password",
        message,
        [
          { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
          { text: isRTL ? "إرسال" : "Send", onPress: sendResetEmail },
        ]
      );
    }
  };

  const sendResetEmail = async () => {
    if (!user?.email) return;

    setLoading(true);
    try {
      await resetPassword(user.email);
      const successMessage = isRTL
        ? `تم إرسال رابط إعادة تعيين كلمة المرور إلى ${user.email}. يرجى التحقق من بريدك الإلكتروني.`
        : `Password reset link has been sent to ${user.email}. Please check your email.`;

      if (Platform.OS === "web") {
        window.alert(successMessage);
        router.back();
      } else {
        Alert.alert(isRTL ? "تم الإرسال" : "Email Sent", successMessage, [
          { text: isRTL ? "موافق" : "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error: unknown) {
      const errorMessage =
        (error as { message?: string }).message ||
        (isRTL ? "فشل إرسال البريد الإلكتروني" : "Failed to send email");
      if (Platform.OS === "web") {
        window.alert(errorMessage);
      } else {
        Alert.alert(isRTL ? "خطأ" : "Error", errorMessage, [
          { text: isRTL ? "موافق" : "OK" },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!validateForm()) return;

    setErrors({});
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      Alert.alert(
        isRTL ? "تم التغيير" : "Password Changed",
        isRTL
          ? "تم تغيير كلمة المرور بنجاح"
          : "Your password has been changed successfully",
        [{ text: isRTL ? "موافق" : "OK", onPress: () => router.back() }]
      );
    } catch (error: unknown) {
      let errorMessage =
        (error as { message?: string }).message ||
        (isRTL ? "فشل تغيير كلمة المرور" : "Failed to change password");

      if (
        errorMessage.toLowerCase().includes("incorrect") ||
        errorMessage.toLowerCase().includes("wrong") ||
        errorMessage.toLowerCase().includes("invalid-login") ||
        errorMessage.toLowerCase().includes("invalid-credential")
      ) {
        errorMessage = isRTL
          ? "كلمة المرور الحالية غير صحيحة. يرجى التحقق من كلمة المرور والمحاولة مرة أخرى."
          : "Current password is incorrect. Please verify your current password and try again.";
        setErrors({ currentPassword: errorMessage });
      } else if (errorMessage.toLowerCase().includes("network")) {
        errorMessage = isRTL
          ? "خطأ في الاتصال بالشبكة. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى."
          : "Network error. Please check your internet connection and try again.";
      } else if (
        errorMessage.toLowerCase().includes("sign out") ||
        errorMessage.toLowerCase().includes("recent login")
      ) {
        errorMessage = isRTL
          ? "لأسباب أمنية، يرجى تسجيل الخروج وتسجيل الدخول مرة أخرى قبل تغيير كلمة المرور."
          : "For security reasons, please sign out and sign in again before changing your password.";
      } else if (errorMessage.toLowerCase().includes("weak")) {
        errorMessage = isRTL
          ? "كلمة المرور الجديدة ضعيفة. يجب أن تكون 6 أحرف على الأقل."
          : "New password is too weak. It must be at least 6 characters long.";
        setErrors({ newPassword: errorMessage });
      }

      Alert.alert(isRTL ? "خطأ" : "Error", errorMessage, [
        { text: isRTL ? "موافق" : "OK" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (t: string) => void,
    placeholder: string,
    secure: boolean,
    showPassword: boolean,
    toggleShow: () => void,
    errorKey: string
  ) => (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, isRTL && styles.rtlText]}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          onChangeText={(text) => {
            onChangeText(text);
            if (errors[errorKey]) {
              setErrors({ ...errors, [errorKey]: "" });
            }
          }}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          secureTextEntry={!showPassword}
          style={[
            styles.input,
            errors[errorKey] && styles.inputError,
            isRTL && styles.rtlInput,
          ]}
          textAlign={isRTL ? "right" : "left"}
          value={value}
        />
        <TouchableOpacity
          onPress={toggleShow}
          style={[styles.eyeButton, isRTL && styles.eyeButtonRTL]}
        >
          {showPassword ? (
            <EyeOff color="#6C7280" size={20} />
          ) : (
            <Eye color="#6C7280" size={20} />
          )}
        </TouchableOpacity>
      </View>
      {errors[errorKey] ? (
        <Text style={[styles.errorText, isRTL && styles.rtlText]}>
          {errors[errorKey]}
        </Text>
      ) : null}
    </View>
  );

  return (
    <GradientScreen edges={["top"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header - Figma WavyBackground */}
          <View style={styles.headerWrapper}>
            <WavyBackground curve="home" height={200} variant="teal">
              <View style={styles.headerContent}>
                <View style={[styles.headerRow, isRTL && styles.headerRowRTL]}>
                  <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                  >
                    <ArrowLeft
                      color="#003543"
                      size={20}
                      style={
                        isRTL
                          ? { transform: [{ rotate: "180deg" }] }
                          : undefined
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
                      <Lock color="#EB9C0C" size={20} />
                      <Text style={styles.headerTitleText}>
                        {isRTL ? "تغيير كلمة المرور" : "Change Password"}
                      </Text>
                    </View>
                    <Text
                      style={[styles.headerSubtitle, isRTL && styles.rtlText]}
                    >
                      {isRTL
                        ? "قم بتحديث كلمة المرور لحسابك"
                        : "Update your account password"}
                    </Text>
                  </View>
                </View>
              </View>
            </WavyBackground>
          </View>
          <View style={styles.formCard}>
            {renderInput(
              isRTL ? "كلمة المرور الحالية" : "Current Password",
              currentPassword,
              setCurrentPassword,
              isRTL ? "أدخل كلمة المرور الحالية" : "Enter current password",
              true,
              showCurrentPassword,
              () => setShowCurrentPassword(!showCurrentPassword),
              "currentPassword"
            )}

            <TouchableOpacity
              onPress={handleForgotPassword}
              style={[styles.forgotLink, isRTL && styles.forgotLinkRTL]}
            >
              <Text style={styles.forgotLinkText}>
                {isRTL ? "نسيت كلمة المرور؟" : "Forgot Password?"}
              </Text>
            </TouchableOpacity>

            {renderInput(
              isRTL ? "كلمة المرور الجديدة" : "New Password",
              newPassword,
              setNewPassword,
              isRTL ? "أدخل كلمة المرور الجديدة" : "Enter new password",
              true,
              showNewPassword,
              () => setShowNewPassword(!showNewPassword),
              "newPassword"
            )}
            <Text style={[styles.helperText, isRTL && styles.rtlText]}>
              {isRTL
                ? "يجب أن تكون 6 أحرف على الأقل"
                : "Must be at least 6 characters"}
            </Text>

            {renderInput(
              isRTL ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password",
              confirmPassword,
              setConfirmPassword,
              isRTL ? "أعد إدخال كلمة المرور الجديدة" : "Re-enter new password",
              true,
              showConfirmPassword,
              () => setShowConfirmPassword(!showConfirmPassword),
              "confirmPassword"
            )}

            <TouchableOpacity
              disabled={loading}
              onPress={handleChangePassword}
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Save color="#FFFFFF" size={20} />
                  <Text style={styles.saveButtonText}>
                    {isRTL ? "حفظ التغييرات" : "Save Changes"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View
              style={[styles.securityNote, isRTL && styles.securityNoteRTL]}
            >
              <Lock color="#6C7280" size={16} />
              <Text style={[styles.securityNoteText, isRTL && styles.rtlText]}>
                {isRTL
                  ? "لأسباب أمنية، قد يُطلب منك إعادة تسجيل الدخول بعد تغيير كلمة المرور."
                  : "For security reasons, you may need to sign in again after changing your password."}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  headerWrapper: {
    marginHorizontal: -24,
    marginBottom: 0,
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 0,
  },
  headerRowRTL: {
    flexDirection: "row-reverse",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0, 53, 67, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  headerTitleText: {
    fontSize: 22,
    fontFamily: "Inter-Bold",
    color: "#003543",
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: "rgba(0, 53, 67, 0.85)",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
    marginBottom: 8,
  },
  inputContainer: {
    position: "relative",
  },
  input: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingEnd: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    color: "#1A1D1F",
  },
  inputError: {
    borderColor: "#EF4444",
  },
  rtlInput: {
    paddingStart: 48,
    paddingEnd: 16,
    textAlign: "right",
  },
  eyeButton: {
    position: "absolute",
    right: 16,
    top: 14,
    padding: 4,
  },
  eyeButtonRTL: {
    right: undefined,
    left: 16,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: "#EF4444",
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#6C7280",
    marginTop: -8,
    marginBottom: 8,
  },
  forgotLink: {
    marginTop: -8,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  forgotLinkRTL: {
    alignSelf: "flex-end",
  },
  forgotLinkText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#003543",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "#EB9C0C",
    marginTop: 8,
    marginBottom: 20,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 12,
  },
  securityNoteRTL: {
    flexDirection: "row-reverse",
  },
  securityNoteText: {
    fontSize: 13,
    fontFamily: "Inter-Regular",
    color: "#6C7280",
    lineHeight: 18,
    flex: 1,
  },
  rtlText: {
    textAlign: "right",
  },
});

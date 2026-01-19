/**
 * Change Password Screen
 * Allows users to change their password
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
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export const options = {
  headerShown: false,
};

export default function ChangePasswordScreen() {
  const { t, i18n } = useTranslation();
  const { user, changePassword, resetPassword } = useAuth();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();

  // Hide the default header to prevent duplicate headers
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
        const confirmed = window.confirm(
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
          {
            text: isRTL ? "إلغاء" : "Cancel",
            style: "cancel",
          },
          {
            text: isRTL ? "إرسال" : "Send",
            onPress: sendResetEmail,
          },
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
          {
            text: isRTL ? "موافق" : "OK",
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error: any) {
      const errorMessage =
        error.message ||
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
    if (!validateForm()) {
      return;
    }

    // Clear any previous errors
    setErrors({});

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);

      // Clear form on success
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      Alert.alert(
        isRTL ? "تم التغيير" : "Password Changed",
        isRTL
          ? "تم تغيير كلمة المرور بنجاح"
          : "Your password has been changed successfully",
        [
          {
            text: isRTL ? "موافق" : "OK",
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error: any) {
      // Extract error message
      let errorMessage =
        error.message ||
        (isRTL ? "فشل تغيير كلمة المرور" : "Failed to change password");

      // Provide more helpful error messages based on error content
      if (
        errorMessage.toLowerCase().includes("incorrect") ||
        errorMessage.toLowerCase().includes("wrong") ||
        errorMessage.toLowerCase().includes("invalid-login") ||
        errorMessage.toLowerCase().includes("invalid-credential")
      ) {
        errorMessage = isRTL
          ? "كلمة المرور الحالية غير صحيحة. يرجى التحقق من كلمة المرور والمحاولة مرة أخرى."
          : "Current password is incorrect. Please verify your current password and try again.";
        // Set error on current password field
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

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.primary },
        isRTL && styles.containerRTL,
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, isRTL && styles.backButtonRTL]}
          >
            <ArrowLeft
              color={theme.colors.text.primary}
              size={24}
              style={isRTL && { transform: [{ rotate: "180deg" }] }}
            />
          </TouchableOpacity>
          <Lock color={theme.colors.primary.main} size={32} />
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>
            {isRTL ? "تغيير كلمة المرور" : "Change Password"}
          </Text>
          <Text
            style={[styles.subtitle, { color: theme.colors.text.secondary }]}
          >
            {isRTL
              ? "قم بتحديث كلمة المرور لحسابك"
              : "Update your account password"}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={isRTL && styles.contentRTL}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.content}
        >
          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme.colors.text.primary },
                isRTL && styles.rtlText,
              ]}
            >
              {isRTL ? "كلمة المرور الحالية" : "Current Password"}
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                onChangeText={(text) => {
                  setCurrentPassword(text);
                  if (errors.currentPassword) {
                    setErrors({ ...errors, currentPassword: "" });
                  }
                }}
                passwordRules=""
                placeholder={
                  isRTL ? "أدخل كلمة المرور الحالية" : "Enter current password"
                }
                placeholderTextColor={theme.colors.text.secondary}
                secureTextEntry={!showCurrentPassword}
                style={[
                  styles.input,
                  {
                    color: theme.colors.text.primary,
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: errors.currentPassword
                      ? "#EF4444"
                      : isDark
                        ? "#334155"
                        : "#E2E8F0",
                  },
                  isRTL && styles.rtlInput,
                ]}
                textAlign={isRTL ? "right" : "left"}
                textContentType="none"
                value={currentPassword}
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                style={[styles.eyeButton, isRTL && styles.eyeButtonRTL]}
              >
                {showCurrentPassword ? (
                  <EyeOff color={theme.colors.text.secondary} size={20} />
                ) : (
                  <Eye color={theme.colors.text.secondary} size={20} />
                )}
              </TouchableOpacity>
            </View>
            {errors.currentPassword && (
              <Text style={[styles.errorText, isRTL && styles.rtlText]}>
                {errors.currentPassword}
              </Text>
            )}

            {/* Forgot Password Link */}
            <TouchableOpacity
              onPress={handleForgotPassword}
              style={[
                styles.forgotPasswordLink,
                isRTL && styles.forgotPasswordLinkRTL,
              ]}
            >
              <Text
                style={[
                  styles.forgotPasswordText,
                  { color: "#FF8C42" },
                  isRTL && styles.rtlText,
                ]}
              >
                {isRTL ? "نسيت كلمة المرور؟" : "Forgot Password?"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme.colors.text.primary },
                isRTL && styles.rtlText,
              ]}
            >
              {isRTL ? "كلمة المرور الجديدة" : "New Password"}
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                onChangeText={(text) => {
                  setNewPassword(text);
                  if (errors.newPassword) {
                    setErrors({ ...errors, newPassword: "" });
                  }
                }}
                passwordRules=""
                placeholder={
                  isRTL ? "أدخل كلمة المرور الجديدة" : "Enter new password"
                }
                placeholderTextColor={theme.colors.text.secondary}
                secureTextEntry={!showNewPassword}
                style={[
                  styles.input,
                  {
                    color: theme.colors.text.primary,
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: errors.newPassword
                      ? "#EF4444"
                      : isDark
                        ? "#334155"
                        : "#E2E8F0",
                  },
                  isRTL && styles.rtlInput,
                ]}
                textAlign={isRTL ? "right" : "left"}
                textContentType="none"
                value={newPassword}
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                style={[styles.eyeButton, isRTL && styles.eyeButtonRTL]}
              >
                {showNewPassword ? (
                  <EyeOff color={theme.colors.text.secondary} size={20} />
                ) : (
                  <Eye color={theme.colors.text.secondary} size={20} />
                )}
              </TouchableOpacity>
            </View>
            {errors.newPassword && (
              <Text style={[styles.errorText, isRTL && styles.rtlText]}>
                {errors.newPassword}
              </Text>
            )}
            <Text
              style={[
                styles.helperText,
                { color: theme.colors.text.secondary },
                isRTL && styles.rtlText,
              ]}
            >
              {isRTL
                ? "يجب أن تكون 6 أحرف على الأقل"
                : "Must be at least 6 characters"}
            </Text>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme.colors.text.primary },
                isRTL && styles.rtlText,
              ]}
            >
              {isRTL ? "تأكيد كلمة المرور" : "Confirm New Password"}
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword) {
                    setErrors({ ...errors, confirmPassword: "" });
                  }
                }}
                passwordRules=""
                placeholder={
                  isRTL
                    ? "أعد إدخال كلمة المرور الجديدة"
                    : "Re-enter new password"
                }
                placeholderTextColor={theme.colors.text.secondary}
                secureTextEntry={!showConfirmPassword}
                style={[
                  styles.input,
                  {
                    color: theme.colors.text.primary,
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: errors.confirmPassword
                      ? "#EF4444"
                      : isDark
                        ? "#334155"
                        : "#E2E8F0",
                  },
                  isRTL && styles.rtlInput,
                ]}
                textAlign={isRTL ? "right" : "left"}
                textContentType="none"
                value={confirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={[styles.eyeButton, isRTL && styles.eyeButtonRTL]}
              >
                {showConfirmPassword ? (
                  <EyeOff color={theme.colors.text.secondary} size={20} />
                ) : (
                  <Eye color={theme.colors.text.secondary} size={20} />
                )}
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && (
              <Text style={[styles.errorText, isRTL && styles.rtlText]}>
                {errors.confirmPassword}
              </Text>
            )}
          </View>

          {/* Save Button */}
          <TouchableOpacity
            disabled={loading}
            onPress={handleChangePassword}
            style={[
              styles.saveButton,
              {
                backgroundColor: "#FF8C42", // Orange color
                opacity: loading ? 0.6 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Save color="#FFFFFF" size={20} />
                <Text style={styles.saveButtonText}>
                  {isRTL ? "حفظ التغييرات" : "Save Changes"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Security Note */}
          <View
            style={[
              styles.securityNote,
              {
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
              isRTL && styles.securityNoteRTL,
            ]}
          >
            <Lock color={theme.colors.text.secondary} size={16} />
            <Text
              style={[
                styles.securityNoteText,
                { color: theme.colors.text.secondary },
                isRTL && styles.rtlText,
              ]}
            >
              {isRTL
                ? "لأسباب أمنية، سيُطلب منك إعادة تسجيل الدخول بعد تغيير كلمة المرور."
                : "For security reasons, you may need to sign in again after changing your password."}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerRTL: {
    direction: "rtl",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    padding: 24,
    alignItems: "center",
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: 24,
    top: 24,
    padding: 8,
  },
  backButtonRTL: {
    left: undefined,
    right: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  contentRTL: {
    alignItems: "stretch",
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputContainer: {
    position: "relative",
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingEnd: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  rtlInput: {
    paddingStart: 48,
    paddingEnd: 16,
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
    fontSize: 14,
    color: "#EF4444",
    marginTop: 4,
  },
  helperText: {
    fontSize: 13,
    marginTop: 4,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
    gap: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12,
  },
  securityNoteText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  forgotPasswordLink: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  forgotPasswordLinkRTL: {
    alignSelf: "flex-end",
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: "600",
  },
  rtlText: {
    textAlign: "right",
  },
  securityNoteRTL: {
    flexDirection: "row-reverse",
  },
});

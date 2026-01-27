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
  const { i18n } = useTranslation();
  const { user, changePassword, resetPassword } = useAuth();
  const { theme, isDark } = useTheme();
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
        error instanceof Error
          ? error.message
          : isRTL
            ? "فشل إرسال البريد الإلكتروني"
            : "Failed to send email";

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
        error instanceof Error
          ? error.message
          : isRTL
            ? "فشل تغيير كلمة المرور"
            : "Failed to change password";

      const lowerMsg = errorMessage.toLowerCase();

      if (
        lowerMsg.includes("incorrect") ||
        lowerMsg.includes("wrong") ||
        lowerMsg.includes("invalid-login") ||
        lowerMsg.includes("invalid-credential")
      ) {
        errorMessage = isRTL
          ? "كلمة المرور الحالية غير صحيحة."
          : "Current password is incorrect.";
        setErrors({ currentPassword: errorMessage });
      } else if (lowerMsg.includes("network")) {
        errorMessage = isRTL
          ? "خطأ في الاتصال بالشبكة."
          : "Network error. Please check your connection.";
      } else if (
        lowerMsg.includes("sign out") ||
        lowerMsg.includes("recent login")
      ) {
        errorMessage = isRTL
          ? "يرجى تسجيل الخروج وتسجيل الدخول مرة أخرى."
          : "Please sign out and sign in again.";
      } else if (lowerMsg.includes("weak")) {
        errorMessage = isRTL ? "كلمة المرور ضعيفة." : "Password is too weak.";
        setErrors({ newPassword: errorMessage });
      }

      Alert.alert(isRTL ? "خطأ" : "Error", errorMessage, [
        { text: isRTL ? "موافق" : "OK" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Icon colors from theme (these still need JS since icons don't support className)
  const iconColor = isDark ? "#94A3B8" : "#64748B";
  const textColor = isDark ? "#F8FAFC" : "#1E293B";

  return (
    <SafeAreaView
      className="flex-1 bg-surface"
      style={isRTL ? { direction: "rtl" } : undefined}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="relative items-center p-6">
          <TouchableOpacity
            className={`absolute top-6 p-2 ${isRTL ? "right-6" : "left-6"}`}
            onPress={() => router.back()}
          >
            <ArrowLeft
              color={textColor}
              size={24}
              style={isRTL ? { transform: [{ rotate: "180deg" }] } : undefined}
            />
          </TouchableOpacity>
          <Lock color={theme.colors.primary.main} size={32} />
          <Text className="mt-4 mb-2 text-center font-bold text-2xl text-on-surface">
            {isRTL ? "تغيير كلمة المرور" : "Change Password"}
          </Text>
          <Text className="text-center text-base text-on-surface-secondary leading-6">
            {isRTL
              ? "قم بتحديث كلمة المرور لحسابك"
              : "Update your account password"}
          </Text>
        </View>

        <ScrollView
          className="flex-1 px-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Current Password */}
          <View className="mb-6">
            <Text
              className={`mb-2 font-semibold text-base text-on-surface ${isRTL ? "text-right" : "text-left"}`}
            >
              {isRTL ? "كلمة المرور الحالية" : "Current Password"}
            </Text>
            <View className="relative">
              <TextInput
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                className={`rounded-xl border bg-input-bg px-4 py-3.5 text-base text-on-surface ${
                  errors.currentPassword
                    ? "border-red-500"
                    : "border-border-default"
                } ${isRTL ? "pr-4 pl-12" : "pr-12 pl-4"}`}
                onChangeText={(text) => {
                  setCurrentPassword(text);
                  if (errors.currentPassword) {
                    setErrors({ ...errors, currentPassword: "" });
                  }
                }}
                placeholder={
                  isRTL ? "أدخل كلمة المرور الحالية" : "Enter current password"
                }
                placeholderTextColor={iconColor}
                secureTextEntry={!showCurrentPassword}
                textAlign={isRTL ? "right" : "left"}
                value={currentPassword}
              />
              <TouchableOpacity
                className={`absolute top-3.5 p-1 ${isRTL ? "left-4" : "right-4"}`}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? (
                  <EyeOff color={iconColor} size={20} />
                ) : (
                  <Eye color={iconColor} size={20} />
                )}
              </TouchableOpacity>
            </View>
            {errors.currentPassword ? (
              <Text
                className={`mt-1 text-red-500 text-sm ${isRTL ? "text-right" : "text-left"}`}
              >
                {errors.currentPassword}
              </Text>
            ) : null}

            <TouchableOpacity
              className={`mt-2 ${isRTL ? "self-end" : "self-start"}`}
              onPress={handleForgotPassword}
            >
              <Text
                className={`font-semibold text-orange-500 text-sm ${isRTL ? "text-right" : "text-left"}`}
              >
                {isRTL ? "نسيت كلمة المرور؟" : "Forgot Password?"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* New Password */}
          <View className="mb-6">
            <Text
              className={`mb-2 font-semibold text-base text-on-surface ${isRTL ? "text-right" : "text-left"}`}
            >
              {isRTL ? "كلمة المرور الجديدة" : "New Password"}
            </Text>
            <View className="relative">
              <TextInput
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                className={`rounded-xl border bg-input-bg px-4 py-3.5 text-base text-on-surface ${
                  errors.newPassword
                    ? "border-red-500"
                    : "border-border-default"
                } ${isRTL ? "pr-4 pl-12" : "pr-12 pl-4"}`}
                onChangeText={(text) => {
                  setNewPassword(text);
                  if (errors.newPassword) {
                    setErrors({ ...errors, newPassword: "" });
                  }
                }}
                placeholder={
                  isRTL ? "أدخل كلمة المرور الجديدة" : "Enter new password"
                }
                placeholderTextColor={iconColor}
                secureTextEntry={!showNewPassword}
                textAlign={isRTL ? "right" : "left"}
                value={newPassword}
              />
              <TouchableOpacity
                className={`absolute top-3.5 p-1 ${isRTL ? "left-4" : "right-4"}`}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff color={iconColor} size={20} />
                ) : (
                  <Eye color={iconColor} size={20} />
                )}
              </TouchableOpacity>
            </View>
            {errors.newPassword ? (
              <Text
                className={`mt-1 text-red-500 text-sm ${isRTL ? "text-right" : "text-left"}`}
              >
                {errors.newPassword}
              </Text>
            ) : null}
            <Text
              className={`mt-1 text-[13px] text-on-surface-secondary ${isRTL ? "text-right" : "text-left"}`}
            >
              {isRTL
                ? "يجب أن تكون 6 أحرف على الأقل"
                : "Must be at least 6 characters"}
            </Text>
          </View>

          {/* Confirm Password */}
          <View className="mb-6">
            <Text
              className={`mb-2 font-semibold text-base text-on-surface ${isRTL ? "text-right" : "text-left"}`}
            >
              {isRTL ? "تأكيد كلمة المرور" : "Confirm New Password"}
            </Text>
            <View className="relative">
              <TextInput
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                className={`rounded-xl border bg-input-bg px-4 py-3.5 text-base text-on-surface ${
                  errors.confirmPassword
                    ? "border-red-500"
                    : "border-border-default"
                } ${isRTL ? "pr-4 pl-12" : "pr-12 pl-4"}`}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword) {
                    setErrors({ ...errors, confirmPassword: "" });
                  }
                }}
                placeholder={
                  isRTL
                    ? "أعد إدخال كلمة المرور الجديدة"
                    : "Re-enter new password"
                }
                placeholderTextColor={iconColor}
                secureTextEntry={!showConfirmPassword}
                textAlign={isRTL ? "right" : "left"}
                value={confirmPassword}
              />
              <TouchableOpacity
                className={`absolute top-3.5 p-1 ${isRTL ? "left-4" : "right-4"}`}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff color={iconColor} size={20} />
                ) : (
                  <Eye color={iconColor} size={20} />
                )}
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? (
              <Text
                className={`mt-1 text-red-500 text-sm ${isRTL ? "text-right" : "text-left"}`}
              >
                {errors.confirmPassword}
              </Text>
            ) : null}
          </View>

          {/* Save Button */}
          <TouchableOpacity
            className={`mt-2 mb-6 flex-row items-center justify-center gap-2 rounded-xl bg-orange-500 p-4 ${
              loading ? "opacity-60" : "opacity-100"
            }`}
            disabled={loading}
            onPress={handleChangePassword}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Save color="#FFFFFF" size={20} />
                <Text className="font-semibold text-[17px] text-white">
                  {isRTL ? "حفظ التغييرات" : "Save Changes"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Security Note */}
          <View
            className={`mb-6 flex-row items-start gap-3 rounded-xl border border-border-default bg-surface-tertiary p-4 ${
              isRTL ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <Lock color={iconColor} size={16} />
            <Text
              className={`flex-1 text-[13px] text-on-surface-secondary leading-[18px] ${isRTL ? "text-right" : "text-left"}`}
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

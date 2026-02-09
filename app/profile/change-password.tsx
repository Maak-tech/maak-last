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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This screen handles multiple guarded auth flows and platform-specific UX.
export default function ChangePasswordScreen() {
  const { i18n } = useTranslation();
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
  const getInputBorderColor = (hasError: boolean) => {
    if (hasError) {
      return "#EF4444";
    }
    return isDark ? "#334155" : "#E2E8F0";
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Field-level validation intentionally maps many states to localized messages.
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!currentPassword) {
      newErrors.currentPassword = isRTL
        ? "ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø­Ø§Ù„ÙŠØ©"
        : "Please enter your current password";
    }

    if (!newPassword) {
      newErrors.newPassword = isRTL
        ? "ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©"
        : "Please enter a new password";
    } else if (newPassword.length < 6) {
      newErrors.newPassword = isRTL
        ? "ÙŠØ¬Ø¨ Ø£Ù† ØªÙƒÙˆÙ† ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± 6 Ø£Ø­Ø±Ù Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„"
        : "Password must be at least 6 characters";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = isRTL
        ? "ÙŠØ±Ø¬Ù‰ ØªØ£ÙƒÙŠØ¯ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©"
        : "Please confirm your new password";
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = isRTL
        ? "ÙƒÙ„Ù…Ø§Øª Ø§Ù„Ù…Ø±ÙˆØ± ØºÙŠØ± Ù…ØªØ·Ø§Ø¨Ù‚Ø©"
        : "Passwords do not match";
    }

    if (currentPassword === newPassword) {
      newErrors.newPassword = isRTL
        ? "ÙŠØ¬Ø¨ Ø£Ù† ØªÙƒÙˆÙ† ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© Ù…Ø®ØªÙ„ÙØ© Ø¹Ù† Ø§Ù„Ø­Ø§Ù„ÙŠØ©"
        : "New password must be different from current password";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Forgot-password flow includes confirmation and platform-specific interaction patterns.
  const handleForgotPassword = () => {
    if (!user?.email) {
      if (Platform.OS === "web") {
        // biome-ignore lint/suspicious/noAlert: Temporary web fallback.
        window.confirm(
          isRTL
            ? "Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ"
            : "Email address not found"
        );
      } else {
        Alert.alert(
          isRTL ? "Ø®Ø·Ø£" : "Error",
          isRTL
            ? "Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ"
            : "Email address not found",
          [{ text: isRTL ? "Ù…ÙˆØ§ÙÙ‚" : "OK" }]
        );
      }
      return;
    }

    const message = isRTL
      ? `Ø³ÙŠØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø±Ø§Ø¨Ø· Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø¥Ù„Ù‰ ${user.email}. Ù‡Ù„ ØªØ±ÙŠØ¯ Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©ØŸ`
      : `A password reset link will be sent to ${user.email}. Do you want to continue?`;

    if (Platform.OS === "web") {
      // biome-ignore lint/suspicious/noAlert: Temporary web fallback.
      const confirmed = window.confirm(message);
      if (confirmed) {
        sendResetEmail();
      }
    } else {
      Alert.alert(
        isRTL
          ? "Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±"
          : "Reset Password",
        message,
        [
          {
            text: isRTL ? "Ø¥Ù„ØºØ§Ø¡" : "Cancel",
            style: "cancel",
          },
          {
            text: isRTL ? "Ø¥Ø±Ø³Ø§Ù„" : "Send",
            onPress: sendResetEmail,
          },
        ]
      );
    }
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Async reset flow requires localized success/error handling.
  const sendResetEmail = async () => {
    if (!user?.email) {
      return;
    }

    setLoading(true);
    try {
      await resetPassword(user.email);

      const successMessage = isRTL
        ? `ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø±Ø§Ø¨Ø· Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø¥Ù„Ù‰ ${user.email}. ÙŠØ±Ø¬Ù‰ Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø¨Ø±ÙŠØ¯Ùƒ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ.`
        : `Password reset link has been sent to ${user.email}. Please check your email.`;

      if (Platform.OS === "web") {
        // biome-ignore lint/suspicious/noAlert: Temporary web fallback.
        window.alert(successMessage);
        router.back();
      } else {
        Alert.alert(
          isRTL ? "ØªÙ… Ø§Ù„Ø¥Ø±Ø³Ø§Ù„" : "Email Sent",
          successMessage,
          [
            {
              text: isRTL ? "Ù…ÙˆØ§ÙÙ‚" : "OK",
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        (error as { message?: string }).message ||
        (isRTL
          ? "ÙØ´Ù„ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ"
          : "Failed to send email");

      if (Platform.OS === "web") {
        // biome-ignore lint/suspicious/noAlert: Temporary web fallback.
        window.alert(errorMessage);
      } else {
        Alert.alert(isRTL ? "Ø®Ø·Ø£" : "Error", errorMessage, [
          { text: isRTL ? "Ù…ÙˆØ§ÙÙ‚" : "OK" },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Error mapping is intentionally explicit for account-security UX.
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
        isRTL ? "ØªÙ… Ø§Ù„ØªØºÙŠÙŠØ±" : "Password Changed",
        isRTL
          ? "ØªÙ… ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø¨Ù†Ø¬Ø§Ø­"
          : "Your password has been changed successfully",
        [
          {
            text: isRTL ? "Ù…ÙˆØ§ÙÙ‚" : "OK",
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error: unknown) {
      // Extract error message
      let errorMessage =
        (error as { message?: string }).message ||
        (isRTL
          ? "ÙØ´Ù„ ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±"
          : "Failed to change password");

      // Provide more helpful error messages based on error content
      if (
        errorMessage.toLowerCase().includes("incorrect") ||
        errorMessage.toLowerCase().includes("wrong") ||
        errorMessage.toLowerCase().includes("invalid-login") ||
        errorMessage.toLowerCase().includes("invalid-credential")
      ) {
        errorMessage = isRTL
          ? "ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø­Ø§Ù„ÙŠØ© ØºÙŠØ± ØµØ­ÙŠØ­Ø©. ÙŠØ±Ø¬Ù‰ Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± ÙˆØ§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø±Ø© Ø£Ø®Ø±Ù‰."
          : "Current password is incorrect. Please verify your current password and try again.";
        // Set error on current password field
        setErrors({ currentPassword: errorMessage });
      } else if (errorMessage.toLowerCase().includes("network")) {
        errorMessage = isRTL
          ? "Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø´Ø¨ÙƒØ©. ÙŠØ±Ø¬Ù‰ Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø§ØªØµØ§Ù„Ùƒ Ø¨Ø§Ù„Ø¥Ù†ØªØ±Ù†Øª ÙˆØ§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø±Ø© Ø£Ø®Ø±Ù‰."
          : "Network error. Please check your internet connection and try again.";
      } else if (
        errorMessage.toLowerCase().includes("sign out") ||
        errorMessage.toLowerCase().includes("recent login")
      ) {
        errorMessage = isRTL
          ? "Ù„Ø£Ø³Ø¨Ø§Ø¨ Ø£Ù…Ù†ÙŠØ©ØŒ ÙŠØ±Ø¬Ù‰ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬ ÙˆØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ù…Ø±Ø© Ø£Ø®Ø±Ù‰ Ù‚Ø¨Ù„ ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±."
          : "For security reasons, please sign out and sign in again before changing your password.";
      } else if (errorMessage.toLowerCase().includes("weak")) {
        errorMessage = isRTL
          ? "ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© Ø¶Ø¹ÙŠÙØ©. ÙŠØ¬Ø¨ Ø£Ù† ØªÙƒÙˆÙ† 6 Ø£Ø­Ø±Ù Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„."
          : "New password is too weak. It must be at least 6 characters long.";
        setErrors({ newPassword: errorMessage });
      }

      Alert.alert(isRTL ? "Ø®Ø·Ø£" : "Error", errorMessage, [
        { text: isRTL ? "Ù…ÙˆØ§ÙÙ‚" : "OK" },
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
            {isRTL ? "ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±" : "Change Password"}
          </Text>
          <Text
            style={[styles.subtitle, { color: theme.colors.text.secondary }]}
          >
            {isRTL
              ? "Ù‚Ù… Ø¨ØªØ­Ø¯ÙŠØ« ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ù„Ø­Ø³Ø§Ø¨Ùƒ"
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
              {isRTL
                ? "ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø­Ø§Ù„ÙŠØ©"
                : "Current Password"}
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
                  isRTL
                    ? "Ø£Ø¯Ø®Ù„ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø­Ø§Ù„ÙŠØ©"
                    : "Enter current password"
                }
                placeholderTextColor={theme.colors.text.secondary}
                secureTextEntry={!showCurrentPassword}
                style={[
                  styles.input,
                  {
                    color: theme.colors.text.primary,
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: getInputBorderColor(
                      Boolean(errors.currentPassword)
                    ),
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
            {errors.currentPassword ? (
              <Text style={[styles.errorText, isRTL && styles.rtlText]}>
                {errors.currentPassword}
              </Text>
            ) : null}

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
                {isRTL
                  ? "Ù†Ø³ÙŠØª ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±ØŸ"
                  : "Forgot Password?"}
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
              {isRTL ? "ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©" : "New Password"}
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
                  isRTL
                    ? "Ø£Ø¯Ø®Ù„ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©"
                    : "Enter new password"
                }
                placeholderTextColor={theme.colors.text.secondary}
                secureTextEntry={!showNewPassword}
                style={[
                  styles.input,
                  {
                    color: theme.colors.text.primary,
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: getInputBorderColor(
                      Boolean(errors.newPassword)
                    ),
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
            {errors.newPassword ? (
              <Text style={[styles.errorText, isRTL && styles.rtlText]}>
                {errors.newPassword}
              </Text>
            ) : null}
            <Text
              style={[
                styles.helperText,
                { color: theme.colors.text.secondary },
                isRTL && styles.rtlText,
              ]}
            >
              {isRTL
                ? "ÙŠØ¬Ø¨ Ø£Ù† ØªÙƒÙˆÙ† 6 Ø£Ø­Ø±Ù Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„"
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
              {isRTL
                ? "ØªØ£ÙƒÙŠØ¯ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±"
                : "Confirm New Password"}
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
                    ? "Ø£Ø¹Ø¯ Ø¥Ø¯Ø®Ø§Ù„ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©"
                    : "Re-enter new password"
                }
                placeholderTextColor={theme.colors.text.secondary}
                secureTextEntry={!showConfirmPassword}
                style={[
                  styles.input,
                  {
                    color: theme.colors.text.primary,
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: getInputBorderColor(
                      Boolean(errors.confirmPassword)
                    ),
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
            {errors.confirmPassword ? (
              <Text style={[styles.errorText, isRTL && styles.rtlText]}>
                {errors.confirmPassword}
              </Text>
            ) : null}
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
                  {isRTL ? "Ø­ÙØ¸ Ø§Ù„ØªØºÙŠÙŠØ±Ø§Øª" : "Save Changes"}
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
                ? "Ù„Ø£Ø³Ø¨Ø§Ø¨ Ø£Ù…Ù†ÙŠØ©ØŒ Ø³ÙŠÙØ·Ù„Ø¨ Ù…Ù†Ùƒ Ø¥Ø¹Ø§Ø¯Ø© ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ø¹Ø¯ ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±."
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

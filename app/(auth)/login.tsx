import { Link, useRouter } from "expo-router";
import type { ConfirmationResult } from "firebase/auth";
import { PhoneAuthProvider, signInWithCredential } from "firebase/auth";
import { Mail, Phone, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import i18nInstance from "@/lib/i18n";

// Type for React Native Firebase confirmation result
interface RNFirebaseConfirmationResult {
  confirm: (code: string) => Promise<any>;
}

// Combined confirmation result type (matches AuthContext)
type PhoneConfirmationResult =
  | ConfirmationResult
  | RNFirebaseConfirmationResult;

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { signIn, signInWithPhone, verifyPhoneCode, loading, user } = useAuth();
  const router = useRouter();
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] =
    useState<PhoneConfirmationResult | null>(null);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [familyCode, setFamilyCode] = useState("");
  const [showFamilyCode, setShowFamilyCode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isRTL = i18n.language === "ar";

  // Navigate away when user becomes available (after successful login)
  useEffect(() => {
    if (!loading && user) {
      // User is authenticated, let index.tsx handle routing
      router.replace("/");
    }
  }, [user, loading, router]);

  const handleLogin = async () => {
    setErrors({});

    if (loginMethod === "email") {
      if (!(email && password)) {
        setErrors({
          general: t("pleaseFillAllFields", "Please fill in all fields"),
        });
        return;
      }

      try {
        // If user provided a family code, store it BEFORE authentication
        // This ensures it's available when onAuthStateChanged triggers
        if (familyCode.trim()) {
          try {
            const AsyncStorage = await import(
              "@react-native-async-storage/async-storage"
            );
            await AsyncStorage.default.setItem(
              "pendingFamilyCode",
              familyCode.trim()
            );
          } catch (error) {
            Alert.alert(
              t("notice", "Notice"),
              t(
                "familyCodeStorageIssue",
                "There was an issue storing your family code. Please use the family code in the Family tab after login."
              )
            );
          }
        }

        await signIn(email, password);

        // Show success message for family code
        if (familyCode.trim()) {
          Alert.alert(
            t("loginSuccessful", "Login Successful"),
            t(
              "willBeAddedToFamily",
              "You will be added to the family group shortly."
            )
          );
        }

        // Don't navigate here - let the useEffect above handle navigation
        // once the auth state has fully updated
      } catch (error: any) {
        // Silently handle error
        const errorMessage =
          error.message ||
          t("loginFailedMessage", "Login failed. Please try again.");
        setErrors({
          general: errorMessage,
        });
        Alert.alert(
          t("loginFailed", "Login Failed"),
          error.message ||
            t(
              "pleaseCheckCredentials",
              "Please check your credentials and try again."
            )
        );
      }
    } else {
      // Phone login
      if (!phoneNumber.trim()) {
        setErrors({
          general: t(
            "pleaseEnterPhoneNumber",
            "Please enter your phone number"
          ),
        });
        return;
      }

      // Validate phone number format - must include country code
      const cleanedPhone = phoneNumber.trim().replace(/[\s\-()]/g, "");
      const hasCountryCode =
        cleanedPhone.startsWith("+") || cleanedPhone.startsWith("00");

      if (!hasCountryCode && cleanedPhone.length < 10) {
        setErrors({
          general: isRTL
            ? "يرجى إدخال رقم هاتف صحيح مع رمز الدولة (مثال: +1234567890 للولايات المتحدة، +966501234567 للسعودية)"
            : "Please enter a valid phone number with country code (e.g., +1234567890 for US, +966501234567 for Saudi Arabia)",
        });
        return;
      }

      try {
        // Store family code if provided
        if (familyCode.trim()) {
          try {
            const AsyncStorage = await import(
              "@react-native-async-storage/async-storage"
            );
            await AsyncStorage.default.setItem(
              "pendingFamilyCode",
              familyCode.trim()
            );
          } catch (error) {
            // Silently handle error
          }
        }

        const confirmation = await signInWithPhone(phoneNumber.trim());
        setConfirmationResult(confirmation);
        setShowOtpInput(true);
      } catch (error: any) {
        const errorMessage =
          error.message ||
          (isRTL
            ? "فشل إرسال رمز التحقق. يرجى المحاولة مرة أخرى."
            : "Failed to send verification code. Please try again.");
        setErrors({
          general: errorMessage,
        });
      }
    }
  };

  const handleVerifyOtp = async () => {
    setErrors({});

    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setErrors({
        general: isRTL
          ? "يرجى إدخال رمز التحقق المكون من 6 أرقام"
          : "Please enter the 6-digit verification code",
      });
      return;
    }

    if (!confirmationResult) {
      setErrors({
        general: isRTL
          ? "خطأ في التحقق. يرجى المحاولة مرة أخرى."
          : "Verification error. Please try again.",
      });
      return;
    }

    try {
      // Verify OTP - this will sign in the user
      // Check if it's a web SDK ConfirmationResult (has verificationId) or RN Firebase (has confirm method)
      if ("verificationId" in confirmationResult) {
        // Web SDK path
        const credential = PhoneAuthProvider.credential(
          confirmationResult.verificationId,
          otpCode.trim()
        );
        await signInWithCredential(auth, credential);
      } else {
        // React Native Firebase path - use confirm method
        await confirmationResult.confirm(otpCode.trim());
      }

      // Show success message for family code
      if (familyCode.trim()) {
        Alert.alert(
          "Login Successful",
          "You will be added to the family group shortly."
        );
      }
    } catch (error: any) {
      const errorMessage =
        error.message ||
        (isRTL
          ? "رمز التحقق غير صحيح. يرجى المحاولة مرة أخرى."
          : "Invalid verification code. Please try again.");
      setErrors({
        general: errorMessage,
      });
    }
  };

  const handleResendCode = async () => {
    setErrors({});

    if (!phoneNumber.trim()) {
      setErrors({
        general: isRTL
          ? "يرجى إدخال رقم الهاتف"
          : "Please enter your phone number",
      });
      return;
    }

    const cleanedPhone = phoneNumber.trim().replace(/[\s\-()]/g, "");
    const hasCountryCode =
      cleanedPhone.startsWith("+") || cleanedPhone.startsWith("00");

    if (!hasCountryCode && cleanedPhone.length < 10) {
      setErrors({
        general: isRTL
          ? "يرجى إدخال رقم هاتف صحيح مع رمز الدولة (مثال: +1234567890 للولايات المتحدة، +966501234567 للسعودية)"
          : "Please enter a valid phone number with country code (e.g., +1234567890 for US, +966501234567 for Saudi Arabia)",
      });
      return;
    }

    try {
      const confirmation = await signInWithPhone(phoneNumber.trim());
      setConfirmationResult(confirmation);
      setShowOtpInput(true);
    } catch (error: any) {
      const errorMessage =
        error.message ||
        (isRTL
          ? "فشل إرسال رمز التحقق. يرجى المحاولة مرة أخرى."
          : "Failed to send verification code. Please try again.");
      setErrors({
        general: errorMessage,
      });
    }
  };

  const toggleLanguage = async () => {
    try {
      const newLang = i18n.language === "en" ? "ar" : "en";
      await i18nInstance.changeLanguage(newLang);
    } catch (error) {
      // Fallback to using hook's i18n if instance fails
      try {
        if (i18n && i18n.changeLanguage) {
          await i18n.changeLanguage(i18n.language === "en" ? "ar" : "en");
        }
      } catch {
        // Silently handle error
      }
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContainer}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
          style={styles.keyboardContainer}
        >
          <View
            style={[styles.header, isRTL ? styles.headerRTL : styles.headerLTR]}
          >
            <TouchableOpacity
              onPress={toggleLanguage}
              style={styles.languageButton}
            >
              <Text style={styles.languageText}>
                {i18n.language === "en" ? "عربي" : "English"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Image
                resizeMode="contain"
                source={require("@/assets/images/icon.png")}
                style={styles.logoImage}
              />
            </View>
            <Text style={[styles.appName, isRTL && styles.rtlText]}>Maak</Text>
            <Text style={[styles.tagline, isRTL && styles.rtlText]}>
              {isRTL
                ? "صحتك وصحة عائلتك في مكان واحد"
                : "Your family health, together"}
            </Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={[styles.title, isRTL && styles.titleRTL]}>
              {t("signIn")}
            </Text>

            {errors.general && (
              <View style={styles.errorContainer}>
                <Text style={[styles.errorText, isRTL && styles.rtlText]}>
                  {errors.general}
                </Text>
              </View>
            )}

            {/* Login Method Toggle */}
            <View style={styles.methodToggleContainer}>
              <TouchableOpacity
                onPress={() => {
                  setLoginMethod("email");
                  setShowOtpInput(false);
                  setConfirmationResult(null);
                  setErrors({});
                }}
                style={[
                  styles.methodToggle,
                  loginMethod === "email" && styles.methodToggleActive,
                ]}
              >
                <Mail
                  color={loginMethod === "email" ? "#2563EB" : "#64748B"}
                  size={20}
                />
                <Text
                  style={[
                    styles.methodToggleText,
                    loginMethod === "email" && styles.methodToggleTextActive,
                    isRTL && styles.rtlText,
                  ]}
                >
                  {t("email")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setLoginMethod("phone");
                  setShowOtpInput(false);
                  setConfirmationResult(null);
                  setErrors({});
                }}
                style={[
                  styles.methodToggle,
                  loginMethod === "phone" && styles.methodToggleActive,
                ]}
              >
                <Phone
                  color={loginMethod === "phone" ? "#2563EB" : "#64748B"}
                  size={20}
                />
                <Text
                  style={[
                    styles.methodToggleText,
                    loginMethod === "phone" && styles.methodToggleTextActive,
                    isRTL && styles.rtlText,
                  ]}
                >
                  {t("phone", "Phone")}
                </Text>
              </TouchableOpacity>
            </View>

            {loginMethod === "email" ? (
              <>
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, isRTL && styles.labelRTL]}>
                    {t("email")}
                  </Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="username"
                    keyboardType="email-address"
                    onChangeText={setEmail}
                    placeholder={t("enterYourEmail", "Enter your email")}
                    style={[styles.input, isRTL && styles.rtlInput]}
                    textAlign={isRTL ? "right" : "left"}
                    textContentType="username"
                    value={email}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={[styles.label, isRTL && styles.labelRTL]}>
                    {t("password")}
                  </Text>
                  <TextInput
                    autoComplete="off"
                    onChangeText={setPassword}
                    passwordRules=""
                    placeholder={t("enterYourPassword", "Enter your password")}
                    secureTextEntry
                    style={[styles.input, isRTL && styles.rtlInput]}
                    textAlign={isRTL ? "right" : "left"}
                    textContentType="none"
                    value={password}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, isRTL && styles.labelRTL]}>
                    {t("phoneNumber", "Phone Number")}
                  </Text>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="phone-pad"
                    onChangeText={setPhoneNumber}
                    placeholder={t(
                      "enterPhoneNumberExample",
                      "Example: +1234567890 or +966501234567"
                    )}
                    style={[styles.input, isRTL && styles.rtlInput]}
                    textAlign={isRTL ? "right" : "left"}
                    value={phoneNumber}
                  />
                  <Text style={[styles.helperText, isRTL && styles.rtlText]}>
                    {t(
                      "phoneNumberHelper",
                      "Include country code (e.g., +1234567890 for US, +966501234567 for Saudi Arabia). We'll send you a verification code via SMS"
                    )}
                  </Text>
                </View>

                {showOtpInput && (
                  <View style={styles.inputContainer}>
                    <Text style={[styles.helperText, isRTL && styles.rtlText]}>
                      {t("codeSent", "Code sent. Enter it below or resend.")}
                    </Text>
                    <Text style={[styles.label, isRTL && styles.labelRTL]}>
                      {t("verificationCode", "Verification Code")}
                    </Text>
                    <TextInput
                      keyboardType="number-pad"
                      maxLength={6}
                      onChangeText={setOtpCode}
                      placeholder={t(
                        "enter6DigitCode",
                        "Enter 6-digit verification code"
                      )}
                      style={[styles.input, isRTL && styles.rtlInput]}
                      textAlign={isRTL ? "right" : "left"}
                      value={otpCode}
                    />
                    <TouchableOpacity
                      onPress={handleVerifyOtp}
                      style={styles.verifyButton}
                    >
                      <Text style={styles.verifyButtonText}>
                        {loading
                          ? t("verifying", "Verifying...")
                          : t("verify", "Verify")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={loading}
                      onPress={handleResendCode}
                      style={[
                        styles.resendButton,
                        loading && styles.resendButtonDisabled,
                      ]}
                    >
                      <Text style={styles.resendButtonText}>
                        {t("resendCode", "Resend code")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* Family Code Section */}
            <View style={styles.familySection}>
              <TouchableOpacity
                onPress={() => setShowFamilyCode(!showFamilyCode)}
                style={[styles.familyToggle, isRTL && styles.familyToggleRTL]}
              >
                <Users color="#2563EB" size={20} />
                <Text
                  style={[
                    styles.familyToggleText,
                    isRTL && styles.rtlText,
                    isRTL ? { marginEnd: 8 } : { marginStart: 8 },
                  ]}
                >
                  {t("joinExistingFamily", "Join existing family")}
                </Text>
                <Text style={[styles.optionalText, isRTL && styles.rtlText]}>
                  {t("optional", "(Optional)")}
                </Text>
              </TouchableOpacity>

              {showFamilyCode && (
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, isRTL && styles.labelRTL]}>
                    {t("familyCode", "Family Code")}
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    maxLength={6}
                    onChangeText={setFamilyCode}
                    placeholder={t(
                      "enterInvitationCode",
                      "Enter invitation code (6 digits)"
                    )}
                    style={[styles.input, isRTL && styles.rtlInput]}
                    textAlign={isRTL ? "right" : "left"}
                    value={familyCode}
                  />
                  <Text style={[styles.helperText, isRTL && styles.rtlText]}>
                    {t(
                      "invitationCodeHelper",
                      "Enter the invitation code sent to you by a family member"
                    )}
                  </Text>
                </View>
              )}
            </View>

            {loginMethod === "email" && (
              <TouchableOpacity
                style={[styles.forgotButton, isRTL && styles.forgotButtonRTL]}
              >
                <Text style={[styles.forgotText, isRTL && styles.rtlText]}>
                  {t("forgotPassword")}
                </Text>
              </TouchableOpacity>
            )}

            {!showOtpInput && (
              <TouchableOpacity
                disabled={loading}
                onPress={handleLogin}
                style={[
                  styles.loginButton,
                  loading && styles.loginButtonDisabled,
                ]}
              >
                <Text style={styles.loginButtonText}>
                  {loading
                    ? t("loading")
                    : loginMethod === "phone"
                      ? t("sendVerificationCode", "Send Verification Code")
                      : t("signIn")}
                </Text>
              </TouchableOpacity>
            )}
            {loginMethod === "phone" && !showOtpInput && (
              <TouchableOpacity
                disabled={!confirmationResult}
                onPress={() => {
                  if (confirmationResult) {
                    setShowOtpInput(true);
                    setErrors({});
                  }
                }}
                style={[
                  styles.enterCodeButton,
                  !confirmationResult && styles.enterCodeButtonDisabled,
                ]}
              >
                <Text style={styles.enterCodeButtonText}>
                  {t("enterCode", "Enter code")}
                </Text>
              </TouchableOpacity>
            )}

            <View
              style={[
                styles.registerContainer,
                isRTL && styles.registerContainerRTL,
              ]}
            >
              <Text
                style={[
                  styles.registerText,
                  isRTL && styles.rtlText,
                  isRTL && { marginStart: 4 },
                ]}
              >
                {t("dontHaveAccount")}
              </Text>
              <Link asChild href="/(auth)/register">
                <TouchableOpacity>
                  <Text style={[styles.registerLink, isRTL && styles.rtlText]}>
                    {t("signUp")}
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContainer: {
    flexGrow: 1,
    minHeight: "100%",
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    position: "absolute",
    top: 50,
    zIndex: 1,
  },
  headerLTR: {
    right: 24,
  },
  headerRTL: {
    left: 24,
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 20,
  },
  languageText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#475569",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  logo: {
    width: 80,
    height: 80,
    backgroundColor: "#EBF4FF",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  appName: {
    fontSize: 32,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    textAlign: "center",
  },
  formContainer: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginBottom: 32,
    textAlign: "center",
  },
  titleRTL: {
    textAlign: "left",
  },
  errorContainer: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    fontFamily: "Geist-Regular",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#374151",
    marginBottom: 8,
  },
  labelRTL: {
    textAlign: "left",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Geist-Regular",
    backgroundColor: "#FFFFFF",
  },
  rtlInput: {
    fontFamily: "Geist-Regular",
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  forgotButtonRTL: {
    alignSelf: "flex-start",
  },
  forgotText: {
    color: "#2563EB",
    fontSize: 14,
    fontFamily: "Geist-Medium",
  },
  loginButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  loginButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
  },
  enterCodeButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: "#F1F5F9",
  },
  enterCodeButtonDisabled: {
    opacity: 0.6,
  },
  enterCodeButtonText: {
    color: "#2563EB",
    fontSize: 14,
    fontFamily: "Geist-SemiBold",
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  registerContainerRTL: {
    flexDirection: "row-reverse",
  },
  registerText: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
  },
  registerLink: {
    fontSize: 14,
    fontFamily: "Geist-SemiBold",
    color: "#2563EB",
  },
  rtlText: {
    textAlign: "right",
    fontFamily: "Geist-Regular",
  },
  familySection: {
    marginVertical: 16,
  },
  familyToggle: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  familyToggleRTL: {
    flexDirection: "row-reverse",
  },
  familyToggleText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#2563EB",
    flex: 1,
  },
  optionalText: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#64748B",
  },
  helperText: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginTop: 4,
    lineHeight: 16,
  },
  methodToggleContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  methodToggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  methodToggleActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EBF4FF",
  },
  methodToggleText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  methodToggleTextActive: {
    color: "#2563EB",
    fontFamily: "Geist-SemiBold",
  },
  verifyButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
  },
  resendButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#EEF2FF",
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendButtonText: {
    color: "#2563EB",
    fontSize: 14,
    fontFamily: "Geist-SemiBold",
  },
  phoneNoticeContainer: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  phoneNoticeText: {
    color: "#92400E",
    fontSize: 14,
    fontFamily: "Geist-Regular",
    lineHeight: 20,
  },
});

import { Link, useRouter } from "expo-router";
import { Check, Users, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import i18nInstance from "@/lib/i18n";
import type { AvatarType } from "@/types";

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const { signUp, loading, user } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [showFamilyCode, setShowFamilyCode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedAvatarType, setSelectedAvatarType] = useState<
    AvatarType | undefined
  >();
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);

  const isRTL = i18n.language === "ar";
  const keyboardAvoidanceEnabled = false; // Diagnostic: disable to rule out keyboard/layout loops
  const KeyboardContainer = keyboardAvoidanceEnabled
    ? KeyboardAvoidingView
    : View;
  const keyboardContainerProps = keyboardAvoidanceEnabled
    ? {
        behavior: Platform.OS === "ios" ? ("padding" as const) : undefined,
        keyboardVerticalOffset: Platform.OS === "ios" ? 0 : 20,
      }
    : {};

  // Navigate away when user becomes available (after successful registration)
  useEffect(() => {
    if (!loading && user) {
      // User is authenticated, let index.tsx handle routing
      router.replace("/");
    }
  }, [user, loading, router]);

  // Memoize the avatar name to prevent unnecessary re-renders
  const avatarName = useMemo(() => {
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    return;
  }, [firstName, lastName]);

  const handleRegister = async () => {
    setErrors({});

    // Validate required fields - lastName is optional
    if (!firstName) {
      setErrors({
        general: isRTL
          ? "يرجى إدخال الاسم الأول"
          : "Please enter your first name",
      });
      return;
    }

    if (!(email && password && confirmPassword)) {
      setErrors({
        general: isRTL
          ? "يرجى ملء جميع الحقول المطلوبة"
          : "Please fill in all required fields",
      });
      return;
    }

    if (password !== confirmPassword) {
      setErrors({
        confirmPassword: isRTL
          ? "كلمات المرور غير متطابقة"
          : "Passwords do not match",
      });
      return;
    }

    if (password.length < 6) {
      setErrors({
        password: isRTL
          ? "يجب أن تكون كلمة المرور 6 أحرف على الأقل"
          : "Password must be at least 6 characters",
      });
      return;
    }

    try {
      // Store family code in AsyncStorage if provided (will be processed after signup)
      if (familyCode.trim()) {
        const AsyncStorage = await import(
          "@react-native-async-storage/async-storage"
        );
        await AsyncStorage.default.setItem(
          "pendingFamilyCode",
          familyCode.trim()
        );
      }

      await signUp(email, password, firstName, lastName, selectedAvatarType);
      // Don't navigate here - let the useEffect above handle navigation
      // once the auth state has fully updated
    } catch (error: any) {
      setErrors({
        general:
          error.message ||
          (isRTL
            ? "فشل التسجيل. يرجى المحاولة مرة أخرى."
            : "Registration failed. Please try again."),
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
      <KeyboardContainer
        {...keyboardContainerProps}
        style={styles.keyboardContainer}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContainer}
          contentInsetAdjustmentBehavior="never"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={false}
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
                ? "انضم إلى مجتمع الصحة العائلية"
                : "Join the family health community"}
            </Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={[styles.title, isRTL && styles.titleRTL]}>
              {t("createAccount")}
            </Text>

            {errors?.general && (
              <View style={styles.errorContainer}>
                <Text style={[styles.errorText, isRTL && styles.rtlText]}>
                  {errors.general}
                </Text>
              </View>
            )}

            {/* Avatar Selection */}
            <View style={styles.avatarContainer}>
              <Text style={[styles.label, isRTL && styles.labelRTL]}>
                {t("chooseAvatar", "Choose Avatar")}
              </Text>
              <TouchableOpacity
                onPress={() => setAvatarPickerVisible(true)}
                style={styles.avatarButton}
              >
                <Avatar
                  avatarType={selectedAvatarType}
                  name={avatarName}
                  size="lg"
                />
                <Text style={[styles.avatarHint, isRTL && styles.rtlText]}>
                  {t("tapToSelect", "Tap to select")}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.labelRTL]}>
                {t("firstName", "First Name")}
              </Text>
              <TextInput
                onChangeText={setFirstName}
                placeholder={t("enterYourFirstName", "Enter your first name")}
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={firstName ?? ""}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.labelRTL]}>
                {t("lastName", "Last Name")}
              </Text>
              <TextInput
                onChangeText={setLastName}
                placeholder={t("enterYourLastName", "Enter your last name")}
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={lastName ?? ""}
              />
            </View>

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
                value={email ?? ""}
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
                style={[
                  styles.input,
                  isRTL && styles.rtlInput,
                  errors?.password && styles.inputError,
                ]}
                textAlign={isRTL ? "right" : "left"}
                textContentType="none"
                value={password ?? ""}
              />
              {errors?.password && (
                <Text style={[styles.fieldErrorText, isRTL && styles.rtlText]}>
                  {errors.password}
                </Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.labelRTL]}>
                {t("confirmPassword")}
              </Text>
              <TextInput
                autoComplete="off"
                onChangeText={setConfirmPassword}
                passwordRules=""
                placeholder={t("confirmYourPassword", "Confirm your password")}
                secureTextEntry
                style={[
                  styles.input,
                  isRTL && styles.rtlInput,
                  errors?.confirmPassword && styles.inputError,
                ]}
                textAlign={isRTL ? "right" : "left"}
                textContentType="none"
                value={confirmPassword ?? ""}
              />
              {errors?.confirmPassword && (
                <Text style={[styles.fieldErrorText, isRTL && styles.rtlText]}>
                  {errors.confirmPassword}
                </Text>
              )}
            </View>

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
                    {isRTL
                      ? "أدخل رمز الدعوة المرسل إليك من أحد أفراد العائلة"
                      : "Enter the invitation code sent to you by a family member"}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              disabled={loading}
              onPress={handleRegister}
              style={[
                styles.registerButton,
                loading && styles.registerButtonDisabled,
              ]}
            >
              <Text style={styles.registerButtonText}>
                {loading ? t("loading") : t("createAccount")}
              </Text>
            </TouchableOpacity>

            <View
              style={[styles.loginContainer, isRTL && styles.loginContainerRTL]}
            >
              <Text
                style={[
                  styles.loginText,
                  isRTL && styles.rtlText,
                  isRTL && { marginStart: 4 },
                ]}
              >
                {t("alreadyHaveAccount")}
              </Text>
              <Link asChild href="/(auth)/login">
                <TouchableOpacity>
                  <Text style={[styles.loginLink, isRTL && styles.rtlText]}>
                    {t("signIn")}
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardContainer>

      {/* Avatar Picker Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setAvatarPickerVisible(false)}
        transparent={true}
        visible={avatarPickerVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 400 }]}>
            <View style={[styles.modalHeader, isRTL && styles.modalHeaderRTL]}>
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {t("chooseAvatar", "Choose Avatar")}
              </Text>
              <TouchableOpacity onPress={() => setAvatarPickerVisible(false)}>
                <X color="#64748B" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.avatarGrid}>
              {[
                {
                  type: "man" as AvatarType,
                  emoji: "👨🏻",
                  labelEn: "Man",
                  labelAr: "رجل",
                },
                {
                  type: "woman" as AvatarType,
                  emoji: "👩🏻",
                  labelEn: "Woman",
                  labelAr: "امرأة",
                },
                {
                  type: "boy" as AvatarType,
                  emoji: "👦🏻",
                  labelEn: "Boy",
                  labelAr: "صبي",
                },
                {
                  type: "girl" as AvatarType,
                  emoji: "👧🏻",
                  labelEn: "Girl",
                  labelAr: "فتاة",
                },
                {
                  type: "grandma" as AvatarType,
                  emoji: "👵🏻",
                  labelEn: "Grandma",
                  labelAr: "جدة",
                },
                {
                  type: "grandpa" as AvatarType,
                  emoji: "👴🏻",
                  labelEn: "Grandpa",
                  labelAr: "جد",
                },
              ].map((avatar) => (
                <TouchableOpacity
                  key={avatar.type}
                  onPress={() => {
                    setSelectedAvatarType(avatar.type);
                    setAvatarPickerVisible(false);
                  }}
                  style={[
                    styles.avatarOption,
                    selectedAvatarType === avatar.type &&
                      styles.avatarOptionSelected,
                  ]}
                >
                  <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
                  <Text
                    style={[
                      styles.avatarLabel,
                      selectedAvatarType === avatar.type &&
                        styles.avatarLabelSelected,
                      isRTL && styles.rtlText,
                    ]}
                  >
                    {isRTL ? avatar.labelAr : avatar.labelEn}
                  </Text>
                  {selectedAvatarType === avatar.type && (
                    <View
                      style={[
                        styles.avatarCheck,
                        isRTL ? styles.avatarCheckRTL : styles.avatarCheckLTR,
                      ]}
                    >
                      <Check color="#FFFFFF" size={16} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  keyboardContainer: {
    width: "100%",
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
    marginBottom: 40,
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
  inputError: {
    borderColor: "#DC2626",
  },
  fieldErrorText: {
    color: "#DC2626",
    fontSize: 12,
    fontFamily: "Geist-Regular",
    marginTop: 4,
  },
  rtlInput: {
    fontFamily: "Geist-Regular",
  },
  registerButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
    marginTop: 8,
  },
  registerButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginText: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
  },
  loginLink: {
    fontSize: 14,
    fontFamily: "Geist-SemiBold",
    color: "#2563EB",
  },
  rtlText: {
    textAlign: "right",
    fontFamily: "Geist-Regular",
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarButton: {
    alignItems: "center",
    marginTop: 8,
  },
  avatarHint: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 300,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalHeaderRTL: {
    flexDirection: "row-reverse",
  },
  loginContainerRTL: {
    flexDirection: "row-reverse",
  },
  familyToggleRTL: {
    flexDirection: "row-reverse",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 20,
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  },
  avatarOption: {
    width: "30%",
    aspectRatio: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    position: "relative",
  },
  avatarOptionSelected: {
    backgroundColor: "#EBF4FF",
    borderColor: "#2563EB",
  },
  avatarEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  avatarLabel: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  avatarLabelSelected: {
    color: "#2563EB",
    fontFamily: "Geist-SemiBold",
  },
  avatarCheck: {
    position: "absolute",
    top: 8,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarCheckLTR: {
    right: 8,
  },
  avatarCheckRTL: {
    left: 8,
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
});

import { Link, useRouter } from "expo-router";
import { Check, Users, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import type { AvatarType } from "@/types";

// Avatar options - moved outside component to prevent recreation on every render
const AVATAR_OPTIONS = [
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
];

// Email validation helper
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const { signUp, loading } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [showFamilyCode, setShowFamilyCode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedAvatarType, setSelectedAvatarType] = useState<AvatarType | undefined>();
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);

  const isRTL = i18n.language === "ar";

  // Memoize the avatar name to prevent unnecessary re-renders
  const avatarName = useMemo(() => {
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    return undefined;
  }, [firstName, lastName]);

  const handleRegister = async () => {
    setErrors({});

    // Validate required fields - lastName is optional
    if (!(firstName && email && password && confirmPassword)) {
      setErrors({
        general: isRTL
          ? "يرجى ملء جميع الحقول المطلوبة"
          : "Please fill in all required fields",
      });
      return;
    }

    // Validate email format
    if (!isValidEmail(email)) {
      setErrors({
        email: isRTL
          ? "يرجى إدخال بريد إلكتروني صحيح"
          : "Please enter a valid email address",
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
        await AsyncStorage.setItem(
          "pendingFamilyCode",
          familyCode.trim()
        );
      }

      await signUp(email, password, firstName, lastName, selectedAvatarType);
      router.replace("/");
    } catch (error: any) {
      setErrors({
        general: error.message || (isRTL
          ? "فشل التسجيل. يرجى المحاولة مرة أخرى."
          : "Registration failed. Please try again."),
      });
    }
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "en" ? "ar" : "en");
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
          style={styles.keyboardContainer}
        >
          <View style={styles.header}>
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
            <Text style={[styles.title, isRTL && styles.rtlText]}>
              {t("createAccount")}
            </Text>

            {errors?.general && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errors.general}</Text>
              </View>
            )}

            {/* Avatar Selection */}
            <View style={styles.avatarContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {isRTL ? "اختر الصورة الرمزية" : "Choose Avatar"}
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
                  {isRTL ? "اضغط للاختيار" : "Tap to select"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {isRTL ? "الاسم الأول" : "First Name"}
              </Text>
              <TextInput
                onChangeText={setFirstName}
                placeholder={
                  isRTL ? "ادخل اسمك الأول" : "Enter your first name"
                }
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={firstName}
                accessibilityLabel={isRTL ? "الاسم الأول" : "First Name"}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {isRTL ? "اسم العائلة" : "Last Name"}
              </Text>
              <TextInput
                onChangeText={setLastName}
                placeholder={isRTL ? "ادخل اسم عائلتك" : "Enter your last name"}
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={lastName}
                accessibilityLabel={isRTL ? "اسم العائلة" : "Last Name"}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {t("email")}
              </Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="username"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder={
                  isRTL ? "ادخل بريدك الإلكتروني" : "Enter your email"
                }
                style={[
                  styles.input,
                  isRTL && styles.rtlInput,
                  errors?.email && styles.inputError,
                ]}
                textAlign={isRTL ? "right" : "left"}
                textContentType="username"
                value={email}
                accessibilityLabel={isRTL ? "البريد الإلكتروني" : "Email"}
              />
              {errors?.email && (
                <Text style={styles.fieldErrorText}>{errors.email}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {t("password")}
              </Text>
              <TextInput
                autoComplete="off"
                onChangeText={setPassword}
                placeholder={isRTL ? "ادخل كلمة المرور" : "Enter your password"}
                secureTextEntry
                style={[
                  styles.input,
                  isRTL && styles.rtlInput,
                  errors?.password && styles.inputError,
                ]}
                textAlign={isRTL ? "right" : "left"}
                textContentType="none"
                value={password}
                accessibilityLabel={isRTL ? "كلمة المرور" : "Password"}
              />
              {errors?.password && (
                <Text style={styles.fieldErrorText}>{errors.password}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {t("confirmPassword")}
              </Text>
              <TextInput
                autoComplete="off"
                onChangeText={setConfirmPassword}
                placeholder={
                  isRTL ? "أعد إدخال كلمة المرور" : "Confirm your password"
                }
                secureTextEntry
                style={[
                  styles.input,
                  isRTL && styles.rtlInput,
                  errors?.confirmPassword && styles.inputError,
                ]}
                textAlign={isRTL ? "right" : "left"}
                textContentType="none"
                value={confirmPassword}
                accessibilityLabel={
                  isRTL ? "تأكيد كلمة المرور" : "Confirm Password"
                }
              />
              {errors?.confirmPassword && (
                <Text style={styles.fieldErrorText}>
                  {errors.confirmPassword}
                </Text>
              )}
            </View>

            {/* Family Code Section */}
            <View style={styles.familySection}>
              <TouchableOpacity
                onPress={() => setShowFamilyCode(!showFamilyCode)}
                style={styles.familyToggle}
              >
                <Users color="#2563EB" size={20} />
                <Text
                  style={[styles.familyToggleText, isRTL && styles.rtlText]}
                >
                  {isRTL ? "الانضمام إلى عائلة موجودة" : "Join existing family"}
                </Text>
                <Text style={styles.optionalText}>
                  {isRTL ? "(اختياري)" : "(Optional)"}
                </Text>
              </TouchableOpacity>

              {showFamilyCode && (
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, isRTL && styles.rtlText]}>
                    {isRTL ? "رمز العائلة" : "Family Code"}
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    maxLength={6}
                    onChangeText={setFamilyCode}
                    placeholder={
                      isRTL
                        ? "أدخل رمز الدعوة (6 أرقام)"
                        : "Enter invitation code (6 digits)"
                    }
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

            <View style={styles.loginContainer}>
              <Text style={[styles.loginText, isRTL && styles.rtlText]}>
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
        </KeyboardAvoidingView>
      </ScrollView>

      {/* Avatar Picker Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setAvatarPickerVisible(false)}
        transparent={true}
        visible={avatarPickerVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {isRTL ? "اختر الصورة الرمزية" : "Choose Avatar"}
              </Text>
              <TouchableOpacity onPress={() => setAvatarPickerVisible(false)}>
                <X color="#64748B" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.avatarGrid}>
              {AVATAR_OPTIONS.map((avatar) => (
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
                    <View style={styles.avatarCheck}>
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
    padding: 24,
  },
  keyboardContainer: {
    width: "100%",
  },
  header: {
    position: "absolute",
    top: 50,
    right: 24,
    zIndex: 1,
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
    marginRight: 4,
  },
  loginLink: {
    fontSize: 14,
    fontFamily: "Geist-SemiBold",
    color: "#2563EB",
  },
  rtlText: {
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
  modalTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    textAlign: "center",
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
    right: 8,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
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
    marginLeft: 8,
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
});

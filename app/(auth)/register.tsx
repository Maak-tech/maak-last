import { Link, useRouter } from "expo-router";
import { Users, Check } from "lucide-react-native";
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Image,
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
import type { AvatarType } from "@/types";

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
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarType | undefined>(undefined);
  
  // Refs for TextInputs to handle focus programmatically
  const lastNameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const isRTL = i18n.language === "ar";

  const handleRegister = async () => {
    setErrors({});

    if (!(firstName && lastName && email && password && confirmPassword)) {
      setErrors({
        general: isRTL ? "يرجى ملء جميع الحقول" : "Please fill in all fields",
      });
      return;
    }

    if (password !== confirmPassword) {
      setErrors({
        confirmPassword: "Passwords do not match",
      });
      return;
    }

    if (password.length < 6) {
      setErrors({
        password: "Password must be at least 6 characters",
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
            "Notice",
            "There was an issue storing your family code. Please use the family code in the Family tab after registration."
          );
        }
      }

      await signUp(email, password, firstName, lastName, selectedAvatar);

      // Show success message for family code
      if (familyCode.trim()) {
        Alert.alert(
          "Registration Successful",
          "You will be added to the family group shortly."
        );
      }

      // Navigate back to index so it can handle the authenticated user routing
      // This ensures proper auth state establishment before navigation

      // Small delay to ensure auth state is fully established
      setTimeout(() => {
        router.replace("/");
      }, 100);
    } catch (error: any) {
      setErrors({
        general: error.message || "Registration failed. Please try again.",
      });
    }
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "en" ? "ar" : "en");
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardContainer}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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

            {errors.general && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errors.general}</Text>
              </View>
            )}

            {/* Avatar Selection */}
            <View style={styles.avatarSection}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {isRTL ? "اختر صورتك الرمزية (اختياري)" : "Choose your avatar (optional)"}
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.avatarScrollContent}
              >
                {[
                  { type: "man" as AvatarType, emoji: "👨🏻", labelEn: "Man", labelAr: "رجل" },
                  { type: "woman" as AvatarType, emoji: "👩🏻", labelEn: "Woman", labelAr: "امرأة" },
                  { type: "boy" as AvatarType, emoji: "👦🏻", labelEn: "Boy", labelAr: "صبي" },
                  { type: "girl" as AvatarType, emoji: "👧🏻", labelEn: "Girl", labelAr: "فتاة" },
                  { type: "grandma" as AvatarType, emoji: "👵🏻", labelEn: "Grandma", labelAr: "جدة" },
                  { type: "grandpa" as AvatarType, emoji: "👴🏻", labelEn: "Grandpa", labelAr: "جد" },
                ].map((avatar) => (
                  <TouchableOpacity
                    key={avatar.type}
                    onPress={() => setSelectedAvatar(avatar.type)}
                    style={[
                      styles.avatarOption,
                      selectedAvatar === avatar.type && styles.avatarOptionSelected,
                    ]}
                  >
                    <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
                    <Text
                      style={[
                        styles.avatarLabel,
                        selectedAvatar === avatar.type && styles.avatarLabelSelected,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL ? avatar.labelAr : avatar.labelEn}
                    </Text>
                    {selectedAvatar === avatar.type && (
                      <View style={styles.avatarCheck}>
                        <Check color="#FFFFFF" size={14} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {isRTL ? "الاسم الأول" : "First Name"}
              </Text>
              <TextInput
                onChangeText={(text) => {
                  try {
                    setFirstName(text);
                  } catch (error) {
                    console.error("Error setting first name:", error);
                  }
                }}
                onSubmitEditing={() => {
                  try {
                    lastNameInputRef.current?.focus();
                  } catch (error) {
                    console.error("Error focusing last name:", error);
                  }
                }}
                returnKeyType="next"
                placeholder={
                  isRTL ? "ادخل اسمك الأول" : "Enter your first name"
                }
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={firstName}
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {isRTL ? "اسم العائلة" : "Last Name"}
              </Text>
              <TextInput
                ref={lastNameInputRef}
                onChangeText={(text) => {
                  try {
                    setLastName(text);
                  } catch (error) {
                    console.error("Error setting last name:", error);
                  }
                }}
                onSubmitEditing={() => {
                  try {
                    emailInputRef.current?.focus();
                  } catch (error) {
                    console.error("Error focusing email:", error);
                  }
                }}
                returnKeyType="next"
                placeholder={
                  isRTL ? "ادخل اسم عائلتك" : "Enter your last name"
                }
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={lastName}
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {t("email")}
              </Text>
              <TextInput
                ref={emailInputRef}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={(text) => {
                  try {
                    setEmail(text);
                  } catch (error) {
                    console.error("Error setting email:", error);
                  }
                }}
                onSubmitEditing={() => {
                  try {
                    passwordInputRef.current?.focus();
                  } catch (error) {
                    console.error("Error focusing password:", error);
                  }
                }}
                returnKeyType="next"
                placeholder={
                  isRTL ? "ادخل بريدك الإلكتروني" : "Enter your email"
                }
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={email}
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {t("password")}
              </Text>
              <TextInput
                ref={passwordInputRef}
                onChangeText={(text) => {
                  try {
                    setPassword(text);
                  } catch (error) {
                    console.error("Error setting password:", error);
                  }
                }}
                returnKeyType="next"
                placeholder={isRTL ? "ادخل كلمة المرور" : "Enter your password"}
                secureTextEntry
                style={[
                  styles.input,
                  isRTL && styles.rtlInput,
                  errors.password && styles.inputError,
                ]}
                textAlign={isRTL ? "right" : "left"}
                value={password}
                blurOnSubmit={false}
              />
              {errors.password && (
                <Text style={styles.fieldErrorText}>{errors.password}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {t("confirmPassword")}
              </Text>
              <TextInput
                onChangeText={setConfirmPassword}
                placeholder={
                  isRTL ? "أعد إدخال كلمة المرور" : "Confirm your password"
                }
                secureTextEntry
                style={[
                  styles.input,
                  isRTL && styles.rtlInput,
                  errors.confirmPassword && styles.inputError,
                ]}
                textAlign={isRTL ? "right" : "left"}
                value={confirmPassword}
              />
              {errors.confirmPassword && (
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
        </ScrollView>
      </KeyboardAvoidingView>
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
    fontFamily: "Cairo-Regular",
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
    fontFamily: "Cairo-Regular",
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
  avatarSection: {
    marginBottom: 20,
  },
  avatarScrollContent: {
    paddingVertical: 8,
    gap: 12,
  },
  avatarOption: {
    width: 85,
    height: 100,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    position: "relative",
    marginRight: 12,
  },
  avatarOptionSelected: {
    backgroundColor: "#EBF4FF",
    borderColor: "#2563EB",
  },
  avatarEmoji: {
    fontSize: 36,
    marginBottom: 6,
  },
  avatarLabel: {
    fontSize: 11,
    fontFamily: "Geist-Medium",
    color: "#64748B",
    textAlign: "center",
  },
  avatarLabelSelected: {
    color: "#2563EB",
    fontFamily: "Geist-SemiBold",
  },
  avatarCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#2563EB",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});

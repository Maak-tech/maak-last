import { Link, useRouter } from "expo-router";
import { Users } from "lucide-react-native";
import { useState } from "react";
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

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { signIn, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [showFamilyCode, setShowFamilyCode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isRTL = i18n.language === "ar";

  const handleLogin = async () => {
    setErrors({});

    if (!(email && password)) {
      setErrors({
        general: "Please fill in all fields",
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
            "There was an issue storing your family code. Please use the family code in the Family tab after login."
          );
        }
      }

      await signIn(email, password);

      // Show success message for family code
      if (familyCode.trim()) {
        Alert.alert(
          "Login Successful",
          "You will be added to the family group shortly."
        );
      }

      // Navigate back to index so it can handle the authenticated user
      router.replace("/");
    } catch (error: any) {
      // Silently handle error
      setErrors({
        general: error.message || "Login failed. Please try again.",
      });
      Alert.alert(
        "Login Failed",
        error.message || "Please check your credentials and try again."
      );
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
                ? "صحتك وصحة عائلتك في مكان واحد"
                : "Your family health, together"}
            </Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={[styles.title, isRTL && styles.rtlText]}>
              {t("signIn")}
            </Text>

            {errors.general && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errors.general}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {t("email")}
              </Text>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder={
                  isRTL ? "ادخل بريدك الإلكتروني" : "Enter your email"
                }
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={email}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {t("password")}
              </Text>
              <TextInput
                onChangeText={setPassword}
                placeholder={isRTL ? "ادخل كلمة المرور" : "Enter your password"}
                secureTextEntry
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={password}
              />
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

            <TouchableOpacity style={styles.forgotButton}>
              <Text style={[styles.forgotText, isRTL && styles.rtlText]}>
                {t("forgotPassword")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={loading}
              onPress={handleLogin}
              style={[
                styles.loginButton,
                loading && styles.loginButtonDisabled,
              ]}
            >
              <Text style={styles.loginButtonText}>
                {loading ? t("loading") : t("signIn")}
              </Text>
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={[styles.registerText, isRTL && styles.rtlText]}>
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
  rtlInput: {
    fontFamily: "Geist-Regular",
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 24,
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
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  registerText: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginRight: 4,
  },
  registerLink: {
    fontSize: 14,
    fontFamily: "Geist-SemiBold",
    color: "#2563EB",
  },
  rtlText: {
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

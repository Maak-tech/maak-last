import { Link, useRouter } from "expo-router";
import { Fingerprint, Users } from "lucide-react-native";
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
import AdaptiveBiometricAuth from "@/components/AdaptiveBiometricAuth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { auth, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { signIn, loading, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [showFamilyCode, setShowFamilyCode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showBiometric, setShowBiometric] = useState(false);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);
  const [biometricUserId, setBiometricUserId] = useState<string | null>(null);

  const isRTL = i18n.language === "ar";
  const db = getFirestore();

  // Check if user has biometric enrollment (check persisted session or stored userId)
  useEffect(() => {
    const checkBiometricEnrollment = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const profileDoc = await getDoc(doc(db, 'biometric_profiles', currentUser.uid));
          const isEnrolled = profileDoc.exists();
          setIsBiometricEnrolled(isEnrolled);
          // Store userId if enrolled for future checks
          if (isEnrolled) {
            try {
              const AsyncStorage = await import("@react-native-async-storage/async-storage");
              await AsyncStorage.default.setItem("biometric_enrolled_user_id", currentUser.uid);
            } catch (error) {
              // Silently handle error
            }
          }
        } catch (error) {
          // Silently handle error
        }
      } else {
        // Check for stored enrolled userId from AsyncStorage
        try {
          const AsyncStorage = await import("@react-native-async-storage/async-storage");
          const storedUserId = await AsyncStorage.default.getItem("biometric_enrolled_user_id");
          if (storedUserId) {
            try {
              const profileDoc = await getDoc(doc(db, 'biometric_profiles', storedUserId));
              const isEnrolled = profileDoc.exists();
              setIsBiometricEnrolled(isEnrolled);
              // Store userId in state so it's available for biometric login
              if (isEnrolled) {
                setBiometricUserId(storedUserId);
              }
            } catch (error) {
              // Silently handle error
              setIsBiometricEnrolled(false);
              setBiometricUserId(null);
            }
          } else {
            setIsBiometricEnrolled(false);
            setBiometricUserId(null);
          }
        } catch (error) {
          setIsBiometricEnrolled(false);
          setBiometricUserId(null);
        }
      }
    };
    checkBiometricEnrollment();
    
    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        checkBiometricEnrollment();
      } else {
        // Re-check with stored userId when user logs out
        checkBiometricEnrollment();
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Navigate away when user becomes available (after successful login)
  useEffect(() => {
    if (!loading && user) {
      // User is authenticated, let index.tsx handle routing
      router.replace("/");
    }
  }, [user, loading, router]);

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

      // Don't navigate here - let the useEffect above handle navigation
      // once the auth state has fully updated
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

  const handleBiometricSuccess = async (result: any) => {
    setShowBiometric(false);
    
    // Handle enrollment mode completion
    if (result.mode === 'enroll') {
      Alert.alert(
        isRTL ? 'تم التسجيل بنجاح' : 'Enrollment Successful',
        isRTL
          ? 'تم تسجيل المصادقة الحيوية بنجاح. يمكنك الآن استخدامها لتسجيل الدخول.'
          : 'Biometric authentication has been enrolled successfully. You can now use it to log in.',
        [{ text: isRTL ? 'حسناً' : 'OK' }]
      );
      // Refresh enrollment status
      try {
        // Get userId from currentUser, state, or stored value
        let userId: string | null = null;
        const currentUser = auth.currentUser;
        if (currentUser) {
          userId = currentUser.uid;
        } else if (biometricUserId) {
          userId = biometricUserId;
        } else {
          // Fallback: Try to get stored userId from AsyncStorage
          try {
            const AsyncStorage = await import("@react-native-async-storage/async-storage");
            userId = await AsyncStorage.default.getItem("biometric_enrolled_user_id");
          } catch (storageError) {
            // Silently handle error
          }
        }

        // Only query Firestore if we have a valid userId
        if (userId) {
          const profileDoc = await getDoc(doc(db, 'biometric_profiles', userId));
          setIsBiometricEnrolled(profileDoc.exists());
        } else {
          // If no userId available, we can't verify enrollment status
          // This shouldn't happen after enrollment, but handle gracefully
          setIsBiometricEnrolled(false);
        }
      } catch (error) {
        // Silently handle error
        setIsBiometricEnrolled(false);
      }
      return;
    }
    
    // Handle authentication mode
    if (result.authenticated === true && biometricUserId) {
      try {
        // Get custom token from Cloud Function
        const generateToken = httpsCallable(functions, "generateBiometricToken");
        
        const tokenResult = await generateToken({
          userId: biometricUserId,
          authLogId: result.authLogId,
        });
        
        const { customToken } = (tokenResult.data as any);
        
        if (!customToken) {
          throw new Error("Failed to get authentication token");
        }
        
        // Sign in with custom token
        await signInWithCustomToken(auth, customToken);
        
        // Don't navigate here - let the useEffect above handle navigation
        // once the auth state has fully updated
      } catch (error: any) {
        Alert.alert(
          isRTL ? 'خطأ في المصادقة' : 'Authentication Error',
          isRTL
            ? 'فشل تسجيل الدخول. يرجى المحاولة مرة أخرى أو استخدام تسجيل الدخول بكلمة المرور.'
            : error.message || 'Failed to complete login. Please try again or use password login.'
        );
      }
      return;
    }
    
    // Handle failed authentication (authenticated === false)
    if (result.authenticated === false) {
      Alert.alert(
        isRTL ? 'فشل المصادقة' : 'Authentication Failed',
        isRTL
          ? 'فشلت المصادقة الحيوية. يرجى المحاولة مرة أخرى أو استخدام تسجيل الدخول بكلمة المرور.'
          : 'Biometric authentication failed. Please try again or use password login.'
      );
      return;
    }
    
    // Handle unexpected result structure
    if (!result.authenticated && result.mode !== 'enroll') {
      Alert.alert(
        isRTL ? 'خطأ غير متوقع' : 'Unexpected Error',
        isRTL
          ? 'حدث خطأ غير متوقع أثناء المصادقة. يرجى المحاولة مرة أخرى.'
          : 'An unexpected error occurred during authentication. Please try again.'
      );
    }
  };

  const handleBiometricFailure = (error: any) => {
    setShowBiometric(false);
    Alert.alert(
      isRTL ? 'فشل المصادقة' : 'Authentication Failed',
      isRTL 
        ? 'فشلت المصادقة الحيوية. يرجى المحاولة مرة أخرى أو استخدام تسجيل الدخول بكلمة المرور.'
        : 'Biometric authentication failed. Please try again or use password login.'
    );
  };

  const handleBiometricLogin = async () => {
    // Get userId from currentUser, state, or stored value
    let userId: string | null = null;
    const currentUser = auth.currentUser;
    if (currentUser) {
      userId = currentUser.uid;
    } else if (biometricUserId) {
      // Use stored userId from state (set by useEffect when enrollment detected)
      userId = biometricUserId;
    } else {
      // Fallback: Try to get stored userId from AsyncStorage
      try {
        const AsyncStorage = await import("@react-native-async-storage/async-storage");
        userId = await AsyncStorage.default.getItem("biometric_enrolled_user_id");
      } catch (error) {
        // Silently handle error
      }
    }

    if (!userId) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL 
          ? 'لم يتم العثور على بيانات المصادقة الحيوية. يرجى تسجيل الدخول أولاً.'
          : 'Biometric authentication data not found. Please log in first.'
      );
      return;
    }
    
    // Verify enrollment before proceeding
    if (!isBiometricEnrolled) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL 
          ? 'لم يتم تسجيل المصادقة الحيوية. يرجى تسجيل الدخول أولاً.'
          : 'Biometric authentication is not enrolled. Please log in first.'
      );
      return;
    }
    
    setBiometricUserId(userId);
    setShowBiometric(true);
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
                autoComplete="username"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder={
                  isRTL ? "ادخل بريدك الإلكتروني" : "Enter your email"
                }
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                textContentType="username"
                value={email}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.rtlText]}>
                {t("password")}
              </Text>
              <TextInput
                autoComplete="off"
                onChangeText={setPassword}
                passwordRules=""
                placeholder={isRTL ? "ادخل كلمة المرور" : "Enter your password"}
                secureTextEntry
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                textContentType="none"
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

            {/* Biometric Login Button - Show if user is enrolled */}
            {isBiometricEnrolled && (
              <>
                <TouchableOpacity
                  onPress={handleBiometricLogin}
                  style={styles.biometricButton}
                >
                  <Fingerprint size={20} color="#2563EB" />
                  <Text style={styles.biometricButtonText}>
                    {isRTL ? "تسجيل الدخول بالمصادقة الحيوية" : "Login with Biometrics"}
                  </Text>
                </TouchableOpacity>

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>
                    {isRTL ? "أو" : "OR"}
                  </Text>
                  <View style={styles.dividerLine} />
                </View>
              </>
            )}

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

      {/* Biometric Authentication Modal */}
      {showBiometric && biometricUserId && (
        <AdaptiveBiometricAuth
          visible={showBiometric}
          mode="authenticate"
          userId={biometricUserId}
          onAuthSuccess={handleBiometricSuccess}
          onAuthFailure={handleBiometricFailure}
          onClose={() => {
            setShowBiometric(false);
            setBiometricUserId(null);
          }}
        />
      )}
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
    marginEnd: 4,
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
  familyToggleText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#2563EB",
    marginStart: 8,
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
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F9FF",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "#2563EB",
    marginBottom: 16,
    gap: 8,
  },
  biometricButtonText: {
    color: "#2563EB",
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
  },
});

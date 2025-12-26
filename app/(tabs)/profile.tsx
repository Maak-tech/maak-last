import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Activity,
  Bell,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  FileText,
  Globe,
  Heart,
  HelpCircle,
  Lock,
  LogOut,
  Moon,
  Shield,
  Sun,
  User,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Avatar from "@/components/Avatar";
import type { AvatarType } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useFallDetectionContext } from "@/contexts/FallDetectionContext";
import { useTheme } from "@/contexts/ThemeContext";
import { medicationService } from "@/lib/services/medicationService";
import {
  type ExportFormat,
  exportMetrics,
} from "@/lib/services/metricsExportService";
import { symptomService } from "@/lib/services/symptomService";
import { userService } from "@/lib/services/userService";
import type { Medication, Symptom } from "@/types";

interface ProfileSectionItem {
  icon: any;
  label: string;
  onPress?: () => void;
  hasSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void | Promise<void>;
  value?: string;
  comingSoon?: boolean;
}

interface ProfileSection {
  title: string;
  items: ProfileSectionItem[];
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateUser } = useAuth();
  const { isEnabled: fallDetectionEnabled, toggleFallDetection } =
    useFallDetectionContext();
  const { themeMode, setThemeMode, isDark } = useTheme();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [avatarCreatorVisible, setAvatarCreatorVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [healthData, setHealthData] = useState({
    symptoms: [] as Symptom[],
    medications: [] as Medication[],
    healthScore: 85,
  });
  const [exporting, setExporting] = useState(false);

  const isRTL = i18n.language === "ar";

  // Refresh data when tab is focused
  useFocusEffect(
    useCallback(() => {
      loadHealthData();
      loadUserSettings();
    }, [user])
  );

  useEffect(() => {
    loadUserSettings();
    loadHealthData();
  }, [user]);

  const loadUserSettings = async () => {
    try {
      const notifications = await AsyncStorage.getItem("notifications_enabled");

      if (notifications !== null) {
        setNotificationsEnabled(JSON.parse(notifications));
      }
    } catch (error) {
      // Silently handle settings load error
    }
  };

  const loadHealthData = async (isRefresh = false) => {
    if (!user?.id) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const [symptoms, medications] = await Promise.all([
        symptomService.getUserSymptoms(user.id),
        medicationService.getUserMedications(user.id),
      ]);

      // Calculate health score based on recent symptoms and medication compliance
      const recentSymptoms = symptoms.filter(
        (s) =>
          new Date(s.timestamp).getTime() >
          Date.now() - 30 * 24 * 60 * 60 * 1000
      );
      const activeMedications = medications.filter((m) => m.isActive);

      let score = 100;
      score -= recentSymptoms.length * 5; // Reduce score for recent symptoms
      score = Math.max(score, 0);

      setHealthData({
        symptoms: recentSymptoms,
        medications: activeMedications,
        healthScore: score,
      });
    } catch (error) {
      // Silently handle error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem("notifications_enabled", JSON.stringify(value));
  };

  const handleFallDetectionToggle = async (value: boolean) => {
    await toggleFallDetection(value);
  };

  const handleLanguageChange = async (languageCode: "en" | "ar") => {
    await i18n.changeLanguage(languageCode);
    await AsyncStorage.setItem("app_language", languageCode);
    setLanguagePickerVisible(false);
  };

  const handlePersonalInfo = () => {
    router.push("/profile/personal-info");
  };

  const handleChangePassword = () => {
    router.push("/profile/change-password");
  };

  const handleHealthReports = async () => {
    // Prevent concurrent exports
    if (exporting) {
      Alert.alert(
        isRTL ? "جاري التصدير" : "Export in Progress",
        isRTL
          ? "يتم تصدير المقاييس الصحية حالياً. يرجى الانتظار حتى يكتمل التصدير."
          : "An export is already in progress. Please wait for it to complete."
      );
      return;
    }

    // Set exporting flag immediately to prevent concurrent exports
    setExporting(true);

    try {
      // Export directly as PDF (CSV option removed)
      await performExport("pdf");
    } catch (error: any) {
      setExporting(false);
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "حدث خطأ في التصدير" : "Error exporting metrics"
      );
    }
  };

  const performExport = async (format: ExportFormat) => {
    try {
      // exporting flag already set to true in handleHealthReports

      await exportMetrics(
        {
          format,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          endDate: new Date(),
          userId: user?.id, // Pass user ID to include symptoms, medications, medical history, and moods
        },
        (message) => {
          // Progress callback - silently handle progress updates
        }
      );

      Alert.alert(
        isRTL ? "نجح التصدير" : "Export Successful",
        isRTL
          ? "تم تصدير المقاييس الصحية بنجاح. استخدم خيار المشاركة لحفظ الملف."
          : "Health metrics exported successfully. Use the share option to save the file."
      );
    } catch (error: any) {
      Alert.alert(
        isRTL ? "خطأ في التصدير" : "Export Error",
        error?.message ||
          (isRTL
            ? "حدث خطأ أثناء تصدير المقاييس الصحية"
            : "An error occurred while exporting health metrics")
      );
    } finally {
      setExporting(false);
    }
  };

  const handleHelpSupport = () => {
    router.push("/profile/help-support");
  };

  const handleTermsConditions = () => {
    router.push("/profile/terms-conditions");
  };

  const handlePrivacyPolicy = () => {
    router.push("/profile/privacy-policy");
  };

  const handleLogout = () => {
    Alert.alert(
      isRTL ? "تسجيل الخروج" : "Sign Out",
      isRTL
        ? "هل أنت متأكد من تسجيل الخروج؟"
        : "Are you sure you want to sign out?",
      [
        {
          text: isRTL ? "إلغاء" : "Cancel",
          style: "cancel",
        },
        {
          text: isRTL ? "تسجيل الخروج" : "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
              router.replace("/(auth)/login");
            } catch (error) {
              // Silently handle logout error
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL
                  ? "فشل في تسجيل الخروج"
                  : "Failed to sign out. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const profileSections: ProfileSection[] = [
    {
      title: isRTL ? "الحساب" : "Account",
      items: [
        {
          icon: User,
          label: isRTL ? "المعلومات الشخصية" : "Personal Information",
          onPress: handlePersonalInfo,
        },
        {
          icon: Lock,
          label: isRTL ? "تغيير كلمة المرور" : "Change Password",
          onPress: handleChangePassword,
        },
        {
          icon: FileText,
          label: isRTL ? "التقارير الصحية" : "Health Reports",
          onPress: handleHealthReports,
        },
        {
          icon: BookOpen,
          label: isRTL ? "المصادر التعليمية" : "Health Resources",
          onPress: () => router.push("/(tabs)/resources"),
          comingSoon: true,
        },
      ],
    },
    {
      title: isRTL ? "الإعدادات" : "Settings",
      items: [
        {
          icon: Bell,
          label: isRTL ? "الإشعارات" : "Notifications",
          onPress: () => router.push("/profile/notification-settings"),
        },
        {
          icon: Shield,
          label: isRTL ? "كشف السقوط" : "Fall Detection",
          onPress: () => router.push("/profile/fall-detection"),
        },
        {
          icon: Activity,
          label: isRTL ? "تكاملات الصحة" : "Health Integrations",
          onPress: () => router.push("/profile/health-integrations" as any),
        },
        {
          icon: isDark ? Sun : Moon,
          label: isRTL ? "المظهر الداكن" : "Dark Mode",
          hasSwitch: true,
          switchValue: isDark,
          onSwitchChange: (value: boolean) => {
            setThemeMode(value ? "dark" : "light");
          },
        },
        {
          icon: Globe,
          label: isRTL ? "اللغة" : "Language",
          value: isRTL ? "العربية" : "English",
          onPress: () => setLanguagePickerVisible(true),
        },
      ],
    },
    {
      title: isRTL ? "الدعم" : "Support",
      items: [
        {
          icon: HelpCircle,
          label: isRTL ? "المساعدة والدعم" : "Help & Support",
          onPress: handleHelpSupport,
        },
        {
          icon: FileText,
          label: isRTL ? "الشروط والأحكام" : "Terms & Conditions",
          onPress: handleTermsConditions,
        },
        {
          icon: Shield,
          label: isRTL ? "سياسة الخصوصية" : "Privacy Policy",
          onPress: handlePrivacyPolicy,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {t("profile")}
        </Text>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            onRefresh={() => loadHealthData(true)}
            refreshing={refreshing}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.content}
      >
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Avatar
              avatarType={user?.avatarType}
              name={user?.firstName}
              size="xl"
              onPress={() => setAvatarCreatorVisible(true)}
              style={{ width: 120, height: 120 }}
            />
          </View>

          <View style={styles.userInfo}>
            <Text style={[styles.userName, isRTL && styles.rtlText]}>
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.firstName || "User"}
            </Text>
            <Text style={[styles.userEmail, isRTL && styles.rtlText]}>
              {user?.email}
            </Text>
            <View style={styles.memberSince}>
              <Text style={[styles.memberSinceText, isRTL && styles.rtlText]}>
                {isRTL ? "عضو منذ" : "Member since"}{" "}
                {new Date(user?.createdAt || new Date()).getFullYear()}
              </Text>
            </View>
          </View>
        </View>

        {/* Improved Health Summary */}
        <View style={styles.healthSummary}>
          <Text style={[styles.healthTitle, isRTL && styles.rtlText]}>
            {isRTL ? "ملخص الصحة" : "Health Summary"}
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#2563EB" size="large" />
            </View>
          ) : (
            <View style={styles.healthGrid}>
              <View style={styles.healthCard}>
                <View style={styles.healthIconContainer}>
                  <Activity color="#10B981" size={24} />
                </View>
                <Text style={[styles.healthCardValue, isRTL && styles.rtlText]}>
                  {healthData.healthScore}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[styles.healthCardLabel, isRTL && styles.rtlText]}
                >
                  {isRTL ? "نقاط الصحة" : "Health Score"}
                </Text>
              </View>

              <View style={styles.healthCard}>
                <View style={styles.healthIconContainer}>
                  <Heart color="#EF4444" size={24} />
                </View>
                <Text style={[styles.healthCardValue, isRTL && styles.rtlText]}>
                  {healthData.symptoms.length}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[styles.healthCardLabel, isRTL && styles.rtlText]}
                >
                  {isRTL ? "أعراض هذا الشهر" : "Symptoms This Month"}
                </Text>
              </View>

              <View style={styles.healthCard}>
                <View style={styles.healthIconContainer}>
                  <Calendar color="#3B82F6" size={24} />
                </View>
                <Text style={[styles.healthCardValue, isRTL && styles.rtlText]}>
                  {healthData.medications.length}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[styles.healthCardLabel, isRTL && styles.rtlText]}
                >
                  {isRTL ? "أدوية نشطة" : "Active Medications"}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Settings Sections */}
        {profileSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {section.title}
            </Text>

            <View style={styles.sectionItems}>
              {section.items.map((item, itemIndex) => {
                const IconComponent = item.icon;

                return (
                  <TouchableOpacity
                    disabled={!item.onPress}
                    key={itemIndex}
                    onPress={item.onPress}
                    style={[
                      styles.sectionItem,
                      itemIndex === section.items.length - 1 &&
                        styles.lastSectionItem,
                    ]}
                  >
                    <View style={styles.sectionItemLeft}>
                      <View style={styles.sectionItemIcon}>
                        <IconComponent color="#64748B" size={20} />
                      </View>
                      <View
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.sectionItemLabel,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {item.label}
                        </Text>
                        {item.comingSoon && (
                          <View style={styles.comingSoonBadge}>
                            <Text style={styles.comingSoonText}>
                              {isRTL ? "قريباً" : "Coming Soon"}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.sectionItemRight}>
                      {item.hasSwitch ? (
                        <Switch
                          onValueChange={item.onSwitchChange}
                          thumbColor="#FFFFFF"
                          trackColor={{ false: "#E2E8F0", true: "#2563EB" }}
                          value={item.switchValue}
                        />
                      ) : (
                        <>
                          {exporting &&
                          item.label ===
                            (isRTL ? "التقارير الصحية" : "Health Reports") ? (
                            <ActivityIndicator color="#2563EB" size="small" />
                          ) : (
                            <>
                              {item.value && (
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    styles.sectionItemValue,
                                    isRTL && styles.rtlText,
                                  ]}
                                >
                                  {item.value}
                                </Text>
                              )}
                              <ChevronRight
                                color="#94A3B8"
                                size={16}
                                style={[
                                  isRTL && {
                                    transform: [{ rotate: "180deg" }],
                                  },
                                ]}
                              />
                            </>
                          )}
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Sign Out Button */}
        <TouchableOpacity onPress={handleLogout} style={styles.signOutButton}>
          <LogOut color="#EF4444" size={20} />
          <Text style={[styles.signOutText, isRTL && styles.rtlText]}>
            {t("signOut")}
          </Text>
        </TouchableOpacity>

        {/* App Version */}
        <View style={styles.appVersion}>
          <Text style={[styles.appVersionText, isRTL && styles.rtlText]}>
            Maak v1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setLanguagePickerVisible(false)}
        transparent={true}
        visible={languagePickerVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? "اختر اللغة" : "Select Language"}
            </Text>

            <TouchableOpacity
              onPress={() => handleLanguageChange("en")}
              style={[
                styles.languageOption,
                i18n.language === "en" && styles.selectedLanguage,
              ]}
            >
              <Text
                style={[
                  styles.languageText,
                  i18n.language === "en" && styles.selectedLanguageText,
                ]}
              >
                English
              </Text>
              {i18n.language === "en" && <Check color="#2563EB" size={20} />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleLanguageChange("ar")}
              style={[
                styles.languageOption,
                i18n.language === "ar" && styles.selectedLanguage,
              ]}
            >
              <Text
                style={[
                  styles.languageText,
                  styles.rtlText,
                  i18n.language === "ar" && styles.selectedLanguageText,
                ]}
              >
                العربية
              </Text>
              {i18n.language === "ar" && <Check color="#2563EB" size={20} />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setLanguagePickerVisible(false)}
              style={styles.cancelButton}
            >
              <Text style={[styles.cancelButtonText, isRTL && styles.rtlText]}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Avatar Type Selector Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setAvatarCreatorVisible(false)}
        visible={avatarCreatorVisible}
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {isRTL ? "اختر الصورة الرمزية" : "Choose Your Avatar"}
              </Text>
              <TouchableOpacity
                onPress={() => setAvatarCreatorVisible(false)}
                style={styles.modalCloseButton}
              >
                <X color="#64748B" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.avatarGrid}>
              {(["man", "woman", "boy", "girl", "grandpa", "grandma"] as AvatarType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.avatarOption,
                    user?.avatarType === type && styles.avatarOptionSelected,
                  ]}
                  onPress={async () => {
                    try {
                      setLoading(true);
                      if (user?.id) {
                        await userService.updateUser(user.id, {
                          avatarType: type,
                        });
                        if (updateUser) {
                          await updateUser({ avatarType: type });
                        }
                        setAvatarCreatorVisible(false);
                        Alert.alert(
                          isRTL ? "تم الحفظ" : "Success",
                          isRTL
                            ? "تم حفظ الصورة الرمزية بنجاح"
                            : "Avatar saved successfully"
                        );
                      }
                    } catch (error) {
                      Alert.alert(
                        isRTL ? "خطأ" : "Error",
                        isRTL
                          ? "فشل حفظ الصورة الرمزية"
                          : "Failed to save avatar"
                      );
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  <Avatar avatarType={type} size="xl" style={{ width: 80, height: 80 }} />
                  <Text style={[styles.avatarLabel, isRTL && styles.rtlText]}>
                    {type === "man" && (isRTL ? "رجل" : "Man")}
                    {type === "woman" && (isRTL ? "امرأة" : "Woman")}
                    {type === "boy" && (isRTL ? "صبي" : "Boy")}
                    {type === "girl" && (isRTL ? "فتاة" : "Girl")}
                    {type === "grandpa" && (isRTL ? "جد" : "Grandpa")}
                    {type === "grandma" && (isRTL ? "جدة" : "Grandma")}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: "center",
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 24,
    fontFamily: "Geist-Bold",
    color: "#FFFFFF",
  },
  userInfo: {
    alignItems: "center",
  },
  userName: {
    fontSize: 24,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginBottom: 8,
  },
  memberSince: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberSinceText: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  healthSummary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  healthTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  healthGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  healthCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    minHeight: 100,
  },
  healthIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  healthCardValue: {
    fontSize: 20,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  healthCardLabel: {
    fontSize: 11,
    fontFamily: "Geist-Medium",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 14,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionItems: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  lastSectionItem: {
    borderBottomWidth: 0,
  },
  sectionItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  sectionItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sectionItemLabel: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#1E293B",
    flex: 1,
  },
  sectionItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  sectionItemValue: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    maxWidth: 80,
  },
  comingSoonBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#FEF3C7",
    borderRadius: 4,
  },
  comingSoonText: {
    fontSize: 10,
    fontFamily: "Geist-Bold",
    color: "#92400E",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 20,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  signOutText: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#EF4444",
  },
  appVersion: {
    alignItems: "center",
    paddingBottom: 20,
  },
  appVersionText: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#94A3B8",
  },
  rtlText: {
    fontFamily: "Geist-Regular",
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
    maxWidth: 400,
    maxHeight: "80%",
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
    flex: 1,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  languageOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#F8FAFC",
  },
  selectedLanguage: {
    backgroundColor: "#EBF4FF",
    borderWidth: 1,
    borderColor: "#2563EB",
  },
  languageText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#1E293B",
  },
  selectedLanguageText: {
    color: "#2563EB",
    fontFamily: "Geist-SemiBold",
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 16,
  },
  avatarOption: {
    width: "30%",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    position: "relative",
    paddingVertical: 16,
    marginBottom: 12,
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
    marginTop: 8,
    textAlign: "center",
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
  creatorModalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  creatorModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  creatorModalTitle: {
    fontSize: 20,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
  },
  creatorCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
});

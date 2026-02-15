/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Large profile screen with multiple modal flows. */
/* biome-ignore-all lint/style/noNestedTernary: Localization branches are intentionally explicit in this screen. */
import { useNavigation, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  User,
  X,
} from "lucide-react-native";
import {
  type ComponentType,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Avatar from "@/components/Avatar";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { userService } from "@/lib/services/userService";
import type { AvatarType } from "@/types";
import { safeFormatDate } from "@/utils/dateFormat";

export const options = {
  headerShown: false,
};

type InfoCardProps = {
  description?: string;
  icon: ComponentType<{ color?: string; size?: number }>;
  isRTL: boolean;
  label: string;
  value: string;
};

function InfoCard({
  description,
  icon: Icon,
  isRTL,
  label,
  value,
}: InfoCardProps) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoCardHeader}>
        <View style={styles.infoCardIcon}>
          <Icon color="#003543" size={20} />
        </View>
        <View style={styles.infoCardContent}>
          <Text style={[styles.infoCardLabel, isRTL && { textAlign: "left" }]}>
            {label}
          </Text>
          <Text style={[styles.infoCardValue, isRTL && { textAlign: "left" }]}>
            {value}
          </Text>
          {description ? (
            <Text
              style={[
                styles.infoCardDescription,
                isRTL && { textAlign: "left" },
              ]}
            >
              {description}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function PersonalInfoScreen() {
  const { i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();

  // Hide the default header to prevent duplicate headers
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [avatarCreatorVisible, setAvatarCreatorVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phoneNumber: user?.phoneNumber || "",
  });

  // Sync editForm when user data changes
  useEffect(() => {
    if (user && !showEditModal) {
      setEditForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phoneNumber: user.phoneNumber || "",
      });
    }
  }, [user, showEditModal]);

  const isRTL = i18n.language === "ar";

  const handleEdit = () => {
    setEditForm({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phoneNumber: user?.phoneNumber || "",
    });
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!editForm.firstName.trim()) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى إدخال الاسم الأول" : "Please enter a first name"
      );
      return;
    }

    if (!user?.id) {
      return;
    }

    setLoading(true);
    try {
      const updates = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phoneNumber: editForm.phoneNumber.trim(),
      };

      await userService.updateUser(user.id, updates);
      await updateUser(updates);

      setShowEditModal(false);
      Alert.alert(
        isRTL ? "تم الحفظ" : "Saved",
        isRTL ? "تم تحديث الملف الشخصي بنجاح" : "Profile updated successfully"
      );
    } catch {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "حدث خطأ في تحديث الملف الشخصي" : "Failed to update profile"
      );
    } finally {
      setLoading(false);
    }
  };

  const memberSinceDate = new Date(user?.createdAt || new Date());
  const formattedDate = safeFormatDate(
    memberSinceDate,
    isRTL ? "ar-u-ca-gregory" : "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with WavyBackground */}
        <View style={styles.headerWrap}>
          <WavyBackground curve="home" height={200} variant="teal">
            <View style={styles.headerContent}>
              <View
                style={[
                  styles.headerRow,
                  isRTL && { flexDirection: "row-reverse" as const },
                ]}
              >
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.backButton}
                >
                  <ArrowLeft
                    color="#003543"
                    size={20}
                    style={
                      isRTL ? { transform: [{ rotate: "180deg" }] } : undefined
                    }
                  />
                </TouchableOpacity>

                <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "المعلومات الشخصية" : "Personal Information"}
                </Text>

                <TouchableOpacity
                  onPress={handleEdit}
                  style={styles.editButton}
                >
                  <Edit3 color="#003543" size={20} />
                </TouchableOpacity>
              </View>
            </View>
          </WavyBackground>
        </View>
        {/* Profile Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setAvatarCreatorVisible(true)}
            >
              <Avatar
                avatarType={user?.avatarType}
                name={user?.firstName}
                size="xl"
                style={{ width: 200, height: 200 }}
              />
            </TouchableOpacity>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
            </View>
          </View>
          <Text style={[styles.userName, isRTL && { textAlign: "left" }]}>
            {user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.firstName || "User"}
          </Text>
          <View style={styles.roleContainer}>
            <Shield color="#10B981" size={14} />
            <Text style={[styles.roleText, isRTL && { textAlign: "left" }]}>
              {user?.role === "admin"
                ? isRTL
                  ? "مدير العائلة"
                  : "Family Admin"
                : isRTL
                  ? "عضو"
                  : "Member"}
            </Text>
          </View>
        </View>

        {/* Information Cards */}
        <View style={styles.infoSection}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: "left" }]}>
            {isRTL ? "المعلومات الأساسية" : "Basic Information"}
          </Text>

          <InfoCard
            description={
              isRTL
                ? "اسمك كما يظهر في التطبيق"
                : "Your name as it appears in the app"
            }
            icon={User}
            isRTL={isRTL}
            label={isRTL ? "الاسم الكامل" : "Full Name"}
            value={
              user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.firstName || t("notSpecified")
            }
          />

          <InfoCard
            description={
              isRTL ? "للدخول والتواصل" : "For login and communication"
            }
            icon={Mail}
            isRTL={isRTL}
            label={isRTL ? "البريد الإلكتروني" : "Email Address"}
            value={user?.email || t("notSpecified")}
          />

          <InfoCard
            description={isRTL ? "تاريخ إنشاء الحساب" : "Account creation date"}
            icon={Calendar}
            isRTL={isRTL}
            label={isRTL ? "تاريخ الانضمام" : "Member Since"}
            value={formattedDate}
          />

          <InfoCard
            description={
              user?.role === "admin"
                ? t("manageFamilyAndSettings")
                : t("familyMember")
            }
            icon={Shield}
            isRTL={isRTL}
            label={isRTL ? "دور المستخدم" : "User Role"}
            value={user?.role === "admin" ? t("familyAdmin") : t("member")}
          />
        </View>

        {/* Account Details */}
        <View style={styles.infoSection}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: "left" }]}>
            {isRTL ? "تفاصيل الحساب" : "Account Details"}
          </Text>

          <InfoCard
            description={isRTL ? "لغة واجهة التطبيق" : "App interface language"}
            icon={MapPin}
            isRTL={isRTL}
            label={isRTL ? "اللغة المفضلة" : "Preferred Language"}
            value={user?.preferences?.language === "ar" ? "العربية" : "English"}
          />

          <InfoCard
            description={
              isRTL ? "للطوارئ والإشعارات" : "For emergencies and notifications"
            }
            icon={Phone}
            isRTL={isRTL}
            label={isRTL ? "رقم الهاتف" : "Phone Number"}
            value={user?.phoneNumber || t("notSpecified")}
          />
        </View>

        {/* Statistics */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: "left" }]}>
            {isRTL ? "إحصائيات الحساب" : "Account Statistics"}
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, isRTL && { textAlign: "left" }]}>
                {Math.floor(
                  (Date.now() -
                    new Date(user?.createdAt || new Date()).getTime()) /
                    (1000 * 60 * 60 * 24)
                )}
              </Text>
              <Text style={[styles.statLabel, isRTL && { textAlign: "left" }]}>
                {isRTL ? "أيام العضوية" : "Days Active"}
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={[styles.statValue, isRTL && { textAlign: "left" }]}>
                100%
              </Text>
              <Text style={[styles.statLabel, isRTL && { textAlign: "left" }]}>
                {isRTL ? "اكتمال الملف" : "Profile Complete"}
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={[styles.statValue, isRTL && { textAlign: "left" }]}>
                {user?.preferences?.notifications
                  ? isRTL
                    ? "مفعل"
                    : "On"
                  : isRTL
                    ? "معطل"
                    : "Off"}
              </Text>
              <Text style={[styles.statLabel, isRTL && { textAlign: "left" }]}>
                {isRTL ? "الإشعارات" : "Notifications"}
              </Text>
            </View>
          </View>
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity onPress={handleEdit} style={styles.editProfileButton}>
          <Edit3 color="#FFFFFF" size={20} />
          <Text
            style={[styles.editProfileText, isRTL && { textAlign: "left" }]}
          >
            {isRTL ? "تعديل الملف الشخصي" : "Edit Profile"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showEditModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && { textAlign: "left" }]}>
              {isRTL ? "تعديل الملف الشخصي" : "Edit Profile"}
            </Text>
            <TouchableOpacity
              onPress={() => setShowEditModal(false)}
              style={styles.closeButton}
            >
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalFormContent}>
            {/* First Name Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && { textAlign: "left" }]}>
                {isRTL ? "الاسم الأول" : "First Name"} *
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setEditForm({ ...editForm, firstName: text })
                }
                placeholder={
                  isRTL ? "ادخل اسمك الأول" : "Enter your first name"
                }
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={editForm.firstName}
              />
            </View>

            {/* Last Name Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && { textAlign: "left" }]}>
                {isRTL ? "اسم العائلة" : "Last Name"}
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setEditForm({ ...editForm, lastName: text })
                }
                placeholder={isRTL ? "ادخل اسم عائلتك" : "Enter your last name"}
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={editForm.lastName}
              />
            </View>

            {/* Phone Number Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && { textAlign: "left" }]}>
                {isRTL ? "رقم الهاتف" : "Phone Number"}
              </Text>
              <TextInput
                keyboardType="phone-pad"
                onChangeText={(text) =>
                  setEditForm({ ...editForm, phoneNumber: text })
                }
                placeholder={isRTL ? "ادخل رقم الهاتف" : "Enter phone number"}
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={editForm.phoneNumber}
              />
              <Text
                style={[
                  styles.fieldDescription,
                  isRTL && { textAlign: "left" },
                ]}
              >
                {isRTL
                  ? "سيستخدم للطوارئ والإشعارات المهمة"
                  : "Used for emergencies and important notifications"}
              </Text>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              disabled={loading}
              onPress={handleSaveProfile}
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Save color="#FFFFFF" size={20} />
              )}
              <Text style={styles.saveButtonText}>
                {loading
                  ? isRTL
                    ? "جاري الحفظ..."
                    : "Saving..."
                  : isRTL
                    ? "حفظ التغييرات"
                    : "Save Changes"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Avatar Type Selector Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setAvatarCreatorVisible(false)}
        transparent={true}
        visible={avatarCreatorVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.avatarModalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isRTL && { textAlign: "left" }]}>
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
              {(
                [
                  "man",
                  "woman",
                  "boy",
                  "girl",
                  "grandpa",
                  "grandma",
                ] as AvatarType[]
              ).map((type) => (
                <TouchableOpacity
                  key={type}
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
                    } catch (_error) {
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
                  style={[
                    styles.avatarOption,
                    user?.avatarType === type && styles.avatarOptionSelected,
                  ]}
                >
                  <Avatar
                    avatarType={type}
                    size="xl"
                    style={{ width: 80, height: 80 }}
                  />
                  <Text
                    style={[styles.avatarLabel, isRTL && { textAlign: "left" }]}
                  >
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
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  headerWrap: {
    marginHorizontal: -24,
    marginBottom: 0,
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0, 53, 67, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter-Bold",
    color: "#003543",
    flex: 1,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0, 53, 67, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  statusBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
  },
  userName: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: "#003543",
    marginBottom: 8,
  },
  roleContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  roleText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#059669",
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: "#003543",
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0, 53, 67, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginEnd: 12,
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardLabel: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
    marginBottom: 4,
  },
  infoCardValue: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
    marginBottom: 4,
  },
  infoCardDescription: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#94A3B8",
    lineHeight: 16,
  },
  statsSection: {
    marginBottom: 32,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: "#003543",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
    textAlign: "center",
  },
  editProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#003543",
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 32,
    gap: 8,
    shadowColor: "#003543",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  editProfileText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  rtlText: {
    textAlign: "right",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#F9FDFE",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter-SemiBold",
    color: "#003543",
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  modalFormContent: {
    padding: 24,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#1A1D1F",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    backgroundColor: "#FFFFFF",
    color: "#1A1D1F",
  },
  rtlInput: {
    fontFamily: "Inter-Regular",
  },
  fieldDescription: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#6C7280",
    marginTop: 4,
    lineHeight: 16,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#003543",
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 20,
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  avatarModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 16,
  },
  avatarOption: {
    width: "30%",
    backgroundColor: "#F9FDFE",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    position: "relative",
    paddingVertical: 16,
    marginBottom: 12,
  },
  avatarOptionSelected: {
    backgroundColor: "#F0FAFB",
    borderColor: "#003543",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0, 53, 67, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLabel: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
    marginTop: 8,
    textAlign: "center",
  },
});

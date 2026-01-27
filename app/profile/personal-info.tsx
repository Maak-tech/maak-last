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
import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { userService } from "@/lib/services/userService";
import type { AvatarType } from "@/types";

export const options = {
  headerShown: false,
};

// Info row component
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center border-border-default border-b py-4">
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-blue-50">
        <Icon color="#2563EB" size={18} />
      </View>
      <View className="flex-1">
        <Text className="text-on-surface-secondary text-xs">{label}</Text>
        <Text className="font-medium text-base text-on-surface">{value}</Text>
      </View>
    </View>
  );
}

export default function PersonalInfoScreen() {
  const { i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const { isDark } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [showEditModal, setShowEditModal] = useState(false);
  const [avatarCreatorVisible, setAvatarCreatorVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phoneNumber: user?.phoneNumber || "",
  });

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
  const iconColor = isDark ? "#94A3B8" : "#64748B";
  const textColor = isDark ? "#F8FAFC" : "#1E293B";

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

    if (!user?.id) return;

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
  const formattedDate = memberSinceDate.toLocaleDateString(
    isRTL ? "ar-u-ca-gregory" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || (isRTL ? "غير محدد" : "Not specified");

  const roleLabel =
    user?.role === "admin"
      ? isRTL
        ? "مدير العائلة"
        : "Family Admin"
      : isRTL
        ? "عضو"
        : "Member";

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center justify-between bg-surface-secondary px-4 py-3">
        <TouchableOpacity
          className="h-10 w-10 items-center justify-center rounded-full"
          onPress={() => router.back()}
        >
          <ArrowLeft
            color={textColor}
            size={24}
            style={isRTL ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </TouchableOpacity>
        <Text className="font-semibold text-lg text-on-surface">
          {isRTL ? "المعلومات الشخصية" : "Personal Info"}
        </Text>
        <TouchableOpacity
          className="h-10 w-10 items-center justify-center rounded-full"
          onPress={handleEdit}
        >
          <Edit3 color="#2563EB" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <View className="items-center bg-surface-secondary px-4 pt-4 pb-6">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setAvatarCreatorVisible(true)}
          >
            <Avatar
              avatarType={user?.avatarType}
              name={user?.firstName}
              size="xl"
              style={{ width: 120, height: 120 }}
            />
          </TouchableOpacity>
          <Text className="mt-3 font-bold text-on-surface text-xl">
            {fullName}
          </Text>
          <View className="mt-2 flex-row items-center gap-1 rounded-full bg-green-50 px-2 py-1">
            <Shield color="#10B981" size={12} />
            <Text className="font-medium text-green-600 text-xs">
              {roleLabel}
            </Text>
          </View>
        </View>

        {/* Info Section */}
        <View className="mt-2 bg-surface-secondary px-4">
          <InfoRow
            icon={User}
            label={isRTL ? "الاسم الكامل" : "Full Name"}
            value={fullName}
          />
          <InfoRow
            icon={Mail}
            label={isRTL ? "البريد الإلكتروني" : "Email"}
            value={user?.email || (isRTL ? "غير محدد" : "Not specified")}
          />
          <InfoRow
            icon={Phone}
            label={isRTL ? "رقم الهاتف" : "Phone"}
            value={user?.phoneNumber || (isRTL ? "غير محدد" : "Not specified")}
          />
          <InfoRow
            icon={MapPin}
            label={isRTL ? "اللغة" : "Language"}
            value={user?.preferences?.language === "ar" ? "العربية" : "English"}
          />
          <InfoRow
            icon={Calendar}
            label={isRTL ? "تاريخ الانضمام" : "Member Since"}
            value={formattedDate}
          />
          <InfoRow
            icon={Shield}
            label={isRTL ? "الدور" : "Role"}
            value={roleLabel}
          />
        </View>

        {/* Stats */}
        <View className="mt-2 flex-row bg-surface-secondary px-4 py-4">
          <View className="flex-1 items-center">
            <Text className="font-bold text-blue-600 text-lg">
              {Math.floor(
                (Date.now() -
                  new Date(user?.createdAt || new Date()).getTime()) /
                  (1000 * 60 * 60 * 24)
              )}
            </Text>
            <Text className="text-on-surface-secondary text-xs">
              {isRTL ? "يوم" : "days"}
            </Text>
          </View>
          <View className="flex-1 items-center border-border-default border-r border-l">
            <Text className="font-bold text-blue-600 text-lg">100%</Text>
            <Text className="text-on-surface-secondary text-xs">
              {isRTL ? "مكتمل" : "complete"}
            </Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="font-bold text-blue-600 text-lg">
              {user?.preferences?.notifications ? "✓" : "✗"}
            </Text>
            <Text className="text-on-surface-secondary text-xs">
              {isRTL ? "إشعارات" : "notifications"}
            </Text>
          </View>
        </View>

        {/* Edit Button */}
        <View className="p-4">
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-3"
            onPress={handleEdit}
          >
            <Edit3 color="#FFFFFF" size={18} />
            <Text className="font-semibold text-white">
              {isRTL ? "تعديل" : "Edit Profile"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showEditModal}
      >
        <SafeAreaView className="flex-1 bg-surface">
          <View className="flex-row items-center justify-between border-border-default border-b px-4 py-3">
            <Text className="font-semibold text-lg text-on-surface">
              {isRTL ? "تعديل" : "Edit Profile"}
            </Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <X color={iconColor} size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4">
            <View className="mb-4">
              <Text className="mb-1 font-medium text-on-surface text-sm">
                {isRTL ? "الاسم الأول" : "First Name"} *
              </Text>
              <TextInput
                className="rounded-lg border border-border-default bg-surface-secondary px-3 py-2.5 text-on-surface"
                onChangeText={(text) =>
                  setEditForm({ ...editForm, firstName: text })
                }
                placeholder={isRTL ? "الاسم الأول" : "First name"}
                placeholderTextColor={iconColor}
                value={editForm.firstName}
              />
            </View>

            <View className="mb-4">
              <Text className="mb-1 font-medium text-on-surface text-sm">
                {isRTL ? "اسم العائلة" : "Last Name"}
              </Text>
              <TextInput
                className="rounded-lg border border-border-default bg-surface-secondary px-3 py-2.5 text-on-surface"
                onChangeText={(text) =>
                  setEditForm({ ...editForm, lastName: text })
                }
                placeholder={isRTL ? "اسم العائلة" : "Last name"}
                placeholderTextColor={iconColor}
                value={editForm.lastName}
              />
            </View>

            <View className="mb-4">
              <Text className="mb-1 font-medium text-on-surface text-sm">
                {isRTL ? "رقم الهاتف" : "Phone"}
              </Text>
              <TextInput
                className="rounded-lg border border-border-default bg-surface-secondary px-3 py-2.5 text-on-surface"
                keyboardType="phone-pad"
                onChangeText={(text) =>
                  setEditForm({ ...editForm, phoneNumber: text })
                }
                placeholder={isRTL ? "رقم الهاتف" : "Phone number"}
                placeholderTextColor={iconColor}
                value={editForm.phoneNumber}
              />
            </View>

            <TouchableOpacity
              className={`mt-4 flex-row items-center justify-center gap-2 rounded-xl py-3 ${
                loading ? "bg-slate-400" : "bg-blue-600"
              }`}
              disabled={loading}
              onPress={handleSaveProfile}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Save color="#FFFFFF" size={18} />
              )}
              <Text className="font-semibold text-white">
                {loading
                  ? isRTL
                    ? "جاري الحفظ..."
                    : "Saving..."
                  : isRTL
                    ? "حفظ"
                    : "Save"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Avatar Selector Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setAvatarCreatorVisible(false)}
        transparent={true}
        visible={avatarCreatorVisible}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-4">
          <View className="w-full max-w-sm rounded-2xl bg-surface-secondary p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="font-semibold text-lg text-on-surface">
                {isRTL ? "اختر صورة" : "Choose Avatar"}
              </Text>
              <TouchableOpacity onPress={() => setAvatarCreatorVisible(false)}>
                <X color={iconColor} size={24} />
              </TouchableOpacity>
            </View>
            <View className="flex-row flex-wrap justify-between">
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
                  className={`mb-3 w-[30%] items-center rounded-xl border-2 py-3 ${
                    user?.avatarType === type
                      ? "border-blue-600 bg-blue-50"
                      : "border-border-default bg-surface"
                  }`}
                  key={type}
                  onPress={async () => {
                    try {
                      setLoading(true);
                      if (user?.id) {
                        await userService.updateUser(user.id, {
                          avatarType: type,
                        });
                        await updateUser({ avatarType: type });
                        setAvatarCreatorVisible(false);
                      }
                    } catch {
                      Alert.alert(
                        isRTL ? "خطأ" : "Error",
                        isRTL ? "فشل الحفظ" : "Failed to save"
                      );
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  <Avatar
                    avatarType={type}
                    size="lg"
                    style={{ width: 60, height: 60 }}
                  />
                  <Text className="mt-1 text-center text-on-surface-secondary text-xs">
                    {type === "man" && (isRTL ? "رجل" : "Man")}
                    {type === "woman" && (isRTL ? "امرأة" : "Woman")}
                    {type === "boy" && (isRTL ? "صبي" : "Boy")}
                    {type === "girl" && (isRTL ? "فتاة" : "Girl")}
                    {type === "grandpa" && (isRTL ? "جد" : "Grandpa")}
                    {type === "grandma" && (isRTL ? "جدة" : "Grandma")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import {
  AlertTriangle,
  Edit,
  Grid3x3,
  Heart,
  List,
  Plus,
  Settings,
  Share2,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AlertsCard from "@/app/components/AlertsCard";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useFallDetectionContext } from "@/contexts/FallDetectionContext";
import { useTheme } from "@/contexts/ThemeContext";
import { alertService } from "@/lib/services/alertService";
import { familyInviteService } from "@/lib/services/familyInviteService";
import { medicationService } from "@/lib/services/medicationService";
import { symptomService } from "@/lib/services/symptomService";
import { userService } from "@/lib/services/userService";
import { createThemedStyles, getTextStyle } from "@/utils/styles";
import type { User } from "@/types";

const RELATIONS = [
  { key: "father", labelEn: "Father", labelAr: "الأب" },
  { key: "mother", labelEn: "Mother", labelAr: "الأم" },
  { key: "spouse", labelEn: "Spouse", labelAr: "الزوج/الزوجة" },
  { key: "child", labelEn: "Child", labelAr: "الطفل" },
  { key: "sibling", labelEn: "Sibling", labelAr: "الأخ/الأخت" },
  { key: "grandparent", labelEn: "Grandparent", labelAr: "الجد/الجدة" },
  { key: "other", labelEn: "Other", labelAr: "آخر" },
];

interface FamilyMemberMetrics {
  id: string;
  user: User;
  healthScore: number;
  symptomsThisWeek: number;
  activeMedications: number;
  alertsCount: number;
}

export default function FamilyScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showJoinFamilyModal, setShowJoinFamilyModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<User[]>([]);
  const [memberMetrics, setMemberMetrics] = useState<FamilyMemberMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "dashboard">("list");
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    relation: "",
  });
  const [editMemberForm, setEditMemberForm] = useState({
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    role: "member" as "admin" | "member",
  });
  const [joinFamilyCode, setJoinFamilyCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<
    { id: string; name: string; phone: string }[]
  >([]);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [medicationAlertsEnabled, setMedicationAlertsEnabled] = useState(false);

  const { isEnabled: fallDetectionEnabled, toggleFallDetection } =
    useFallDetectionContext();
  const isRTL = i18n.language === "ar";

  useEffect(() => {
    loadFamilyMembers();
  }, [user]);

  useEffect(() => {
    const loadMedicationAlertsSetting = async () => {
      try {
        const enabled = await AsyncStorage.getItem("medication_alerts_enabled");
        if (enabled !== null) {
          setMedicationAlertsEnabled(JSON.parse(enabled));
        } else {
          setMedicationAlertsEnabled(true);
        }
      } catch (error) {
        // Silently fail - default to enabled
      }
    };
    loadMedicationAlertsSetting();
  }, []);

  const loadFamilyMembers = async (isRefresh = false) => {
    if (!user?.familyId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const members = await userService.getFamilyMembers(user.familyId);
      setFamilyMembers(members);

      // Load metrics if in dashboard view
      if (viewMode === "dashboard") {
        await loadMemberMetrics(members);
      }
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في تحميل أعضاء العائلة" : "Failed to load family members"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMemberMetrics = async (members: User[]) => {
    if (!members.length) {
      setMemberMetrics([]);
      return;
    }

    try {
      setLoadingMetrics(true);
      const metricsPromises = members.map(async (member) => {
        try {
          // Fetch symptoms, medications, and alerts for each member
          const [symptoms, medications, alertsCount] = await Promise.all([
            symptomService.getUserSymptoms(member.id),
            medicationService.getUserMedications(member.id),
            alertService.getActiveAlertsCount(member.id),
          ]);

          // Calculate health score
          const recentSymptoms = symptoms.filter(
            (s) =>
              new Date(s.timestamp).getTime() >
              Date.now() - 30 * 24 * 60 * 60 * 1000
          );
          const activeMedications = medications.filter((m) => m.isActive);
          let healthScore = 100;
          healthScore -= recentSymptoms.length * 5;
          healthScore = Math.max(healthScore, 0);

          // Count symptoms this week
          const symptomsThisWeek = symptoms.filter(
            (s) =>
              new Date(s.timestamp).getTime() >
              Date.now() - 7 * 24 * 60 * 60 * 1000
          ).length;

          return {
            id: member.id,
            user: member,
            healthScore,
            symptomsThisWeek,
            activeMedications: activeMedications.length,
            alertsCount,
          };
        } catch (error) {
          // Return default metrics if error
          return {
            id: member.id,
            user: member,
            healthScore: 100,
            symptomsThisWeek: 0,
            activeMedications: 0,
            alertsCount: 0,
          };
        }
      });

      const metrics = await Promise.all(metricsPromises);
      setMemberMetrics(metrics);
    } catch (error) {
      // Silently handle error
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Load metrics when switching to dashboard view
  useEffect(() => {
    if (viewMode === "dashboard" && familyMembers.length > 0) {
      loadMemberMetrics(familyMembers);
    }
  }, [viewMode]);

  // Refresh data when tab is focused
  useFocusEffect(
    useCallback(() => {
      loadFamilyMembers();
    }, [user])
  );

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case "excellent":
        return "#10B981";
      case "good":
        return "#2563EB";
      case "attention":
        return "#F59E0B";
      case "critical":
        return "#EF4444";
      default:
        return "#64748B";
    }
  };

  const getHealthStatusText = (status: string) => {
    const statusMap = {
      excellent: isRTL ? "ممتاز" : "Excellent",
      good: isRTL ? "جيد" : "Good",
      attention: isRTL ? "يحتاج انتباه" : "Needs Attention",
      critical: isRTL ? "حرج" : "Critical",
    };
    return statusMap[status as keyof typeof statusMap] || status;
  };

  const handleInviteMember = async () => {
    if (!(inviteForm.name && inviteForm.relation)) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى ملء الحقول المطلوبة" : "Please fill in required fields"
      );
      return;
    }

    if (!user?.familyId) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "لا توجد عائلة مربوطة" : "No family found"
      );
      return;
    }

    setInviteLoading(true);

    try {
      const code = await familyInviteService.createInvitationCode(
        user.familyId,
        user.id,
        inviteForm.name,
        inviteForm.relation
      );

      setGeneratedCode(code);
      const memberName = inviteForm.name;
      setInviteForm({ name: "", relation: "" });

      // Prepare sharing message
      const shareMessage = isRTL
        ? `مرحباً ${memberName}! تم دعوتك للانضمام إلى مجموعة العائلة الصحية على تطبيق معك.\n\nرمز الدعوة: ${code}\n\n1. حمل تطبيق معك\n2. سجل دخولك أو أنشئ حساب جديد\n3. استخدم رمز الدعوة: ${code}\n\nهذا الرمز صالح لمدة 7 أيام.`
        : `Hi ${memberName}! You've been invited to join our family health group on Maak app.\n\nInvitation Code: ${code}\n\n1. Download the Maak app\n2. Sign in or create a new account\n3. Use invitation code: ${code}\n\nThis code expires in 7 days.`;

      // Show options to share or copy
      Alert.alert(
        isRTL ? "تم إنشاء الدعوة" : "Invitation Created",
        isRTL
          ? `تم إنشاء رمز الدعوة لـ ${memberName}: ${code}\n\nما الذي تريد فعله؟`
          : `Invitation code created for ${memberName}: ${code}\n\nWhat would you like to do?`,
        [
          {
            text: isRTL ? "مشاركة" : "Share",
            onPress: async () => {
              try {
                await Share.share({
                  message: shareMessage,
                  title: isRTL
                    ? "دعوة للانضمام إلى معك"
                    : "Invitation to join Maak",
                });
              } catch (error) {
                // Fallback to copying to clipboard
                await Clipboard.setString(shareMessage);
                Alert.alert(
                  isRTL ? "تم النسخ" : "Copied",
                  isRTL
                    ? "تم نسخ رسالة الدعوة إلى الحافظة"
                    : "Invitation message copied to clipboard"
                );
              }
            },
          },
          {
            text: isRTL ? "نسخ" : "Copy",
            onPress: async () => {
              await Clipboard.setString(shareMessage);
              Alert.alert(
                isRTL ? "تم النسخ" : "Copied",
                isRTL
                  ? "تم نسخ رسالة الدعوة إلى الحافظة"
                  : "Invitation message copied to clipboard"
              );
            },
          },
          {
            text: isRTL ? "حسناً" : "OK",
            style: "cancel",
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في إنشاء رمز الدعوة" : "Failed to generate invite code"
      );
    } finally {
      setInviteLoading(false);
    }
  };

  const handleEditMember = (member: User) => {
    // Check permissions: admins can edit anyone, members can only edit themselves
    const canEdit = user?.role === "admin" || user?.id === member.id;

    if (!canEdit) {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لتعديل هذا العضو"
          : "You do not have permission to edit this member"
      );
      return;
    }

    setEditMemberForm({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      role: member.role,
    });
    setShowEditMemberModal(true);
  };

  const handleSaveEditMember = async () => {
    if (!editMemberForm.firstName.trim()) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى إدخال الاسم الأول" : "Please enter a first name"
      );
      return;
    }

    if (!user) return;

    setEditLoading(true);

    try {
      const updates: Partial<User> = {
        firstName: editMemberForm.firstName.trim(),
        lastName: editMemberForm.lastName.trim(),
      };

      // Only admins can change roles and only for other users (not themselves)
      if (user.role === "admin" && user.id !== editMemberForm.id) {
        if (
          editMemberForm.role !== "admin" &&
          editMemberForm.role !== "member"
        ) {
          Alert.alert(
            isRTL ? "خطأ" : "Error",
            isRTL ? "يرجى اختيار دور صحيح" : "Please select a valid role"
          );
          return;
        }
        updates.role = editMemberForm.role;
      }

      await userService.updateUser(editMemberForm.id, updates);

      // Reload family members to reflect changes
      await loadFamilyMembers();

      setShowEditMemberModal(false);
      setEditMemberForm({ id: "", firstName: "", lastName: "", email: "", role: "member" });

      Alert.alert(
        isRTL ? "تم الحفظ" : "Saved",
        isRTL ? "تم تحديث بيانات العضو بنجاح" : "Member updated successfully"
      );
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في تحديث بيانات العضو" : "Failed to update member"
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteMember = (member: User) => {
    // Check permissions: only admins can delete members, and members can't delete themselves
    if (user?.role !== "admin") {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لحذف أعضاء العائلة"
          : "You do not have permission to remove family members"
      );
      return;
    }

    // Prevent deleting yourself
    if (member.id === user?.id) {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "لا يمكنك حذف نفسك من العائلة"
          : "You cannot remove yourself from the family"
      );
      return;
    }

    Alert.alert(
      isRTL ? "حذف العضو" : "Remove Member",
      isRTL
        ? `هل أنت متأكد من رغبتك في إزالة ${member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName || "User"} من العائلة؟`
        : `Are you sure you want to remove ${member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName || "User"} from the family?`,
      [
        {
          text: isRTL ? "إلغاء" : "Cancel",
          style: "cancel",
        },
        {
          text: isRTL ? "إزالة" : "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);

              // Remove user from family
              await userService.updateUser(member.id, {
                familyId: undefined,
                role: "admin", // Reset to admin for when they create/join another family
              });

              // Reload family members to reflect changes
              await loadFamilyMembers();

              Alert.alert(
                isRTL ? "تم الإزالة" : "Removed",
                isRTL
                  ? "تم إزالة العضو من العائلة بنجاح"
                  : "Member removed from family successfully"
              );
              } catch (error) {
                Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL ? "فشل في إزالة العضو" : "Failed to remove member"
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEmergencySettings = () => {
    setShowEmergencyModal(true);
  };

  const handleToggleMedicationAlerts = async (enabled: boolean) => {
    try {
      setMedicationAlertsEnabled(enabled);
      await AsyncStorage.setItem(
        "medication_alerts_enabled",
        JSON.stringify(enabled)
      );
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في تحديث الإعدادات" : "Failed to update settings"
      );
    }
  };

  const handleAddEmergencyContact = () => {
    try {
      Keyboard.dismiss();

      const nameValue = newContact.name?.trim() || "";
      const phoneValue = newContact.phone?.trim() || "";

      if (!(nameValue && phoneValue)) {
        setTimeout(() => {
          Alert.alert(
            isRTL ? "خطأ" : "Error",
            isRTL ? "يرجى ملء جميع الحقول" : "Please fill in all fields",
            [{ text: isRTL ? "حسناً" : "OK" }],
            { cancelable: true }
          );
        }, 100);
        return;
      }

      const phoneRegex = /^[+]?[\d\s\-()]{10,}$/;
      if (!phoneRegex.test(phoneValue)) {
        setTimeout(() => {
          Alert.alert(
            isRTL ? "خطأ" : "Error",
            isRTL
              ? "يرجى إدخال رقم هاتف صحيح"
              : "Please enter a valid phone number",
            [{ text: isRTL ? "حسناً" : "OK" }],
            { cancelable: true }
          );
        }, 100);
        return;
      }

      const contact = {
        id: Date.now().toString(),
        name: nameValue,
        phone: phoneValue,
      };

      setEmergencyContacts((prev) => [...prev, contact]);
      setNewContact({ name: "", phone: "" });

      setTimeout(() => {
        Alert.alert(
          isRTL ? "تم الحفظ" : "Saved",
          isRTL
            ? "تم إضافة جهة الاتصال بنجاح"
            : "Emergency contact added successfully",
          [{ text: isRTL ? "حسناً" : "OK" }],
          { cancelable: true }
        );
      }, 200);
    } catch (error) {
      Keyboard.dismiss();
      setTimeout(() => {
        Alert.alert(
          isRTL ? "خطأ" : "Error",
          isRTL
            ? "حدث خطأ أثناء إضافة جهة الاتصال"
            : "An error occurred while adding the contact",
          [{ text: isRTL ? "حسناً" : "OK" }],
          { cancelable: true }
        );
      }, 100);
    }
  };

  const handleDeleteEmergencyContact = (contactId: string) => {
    Alert.alert(
      isRTL ? "حذف جهة الاتصال" : "Delete Contact",
      isRTL
        ? "هل أنت متأكد من حذف جهة الاتصال هذه؟"
        : "Are you sure you want to delete this contact?",
      [
        {
          text: isRTL ? "إلغاء" : "Cancel",
          style: "cancel",
        },
        {
          text: isRTL ? "حذف" : "Delete",
          style: "destructive",
          onPress: () => {
            setEmergencyContacts(
              emergencyContacts.filter((c) => c.id !== contactId)
            );
            Alert.alert(
              isRTL ? "تم الحذف" : "Deleted",
              isRTL
                ? "تم حذف جهة الاتصال بنجاح"
                : "Emergency contact deleted successfully"
            );
          },
        },
      ]
    );
  };

  const copyInviteCode = async () => {
    if (!user?.familyId) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "لا توجد عائلة مربوطة" : "No family found"
      );
      return;
    }

    try {
      // Generate a new invitation code for sharing
      const code = await familyInviteService.createInvitationCode(
        user.familyId,
        user.id,
        "Family Member", // Generic name for shared codes
        "Member" // Generic relation for shared codes
      );

      const shareMessage = isRTL
        ? `مرحباً! تم دعوتك للانضمام إلى مجموعة العائلة الصحية على تطبيق معك.\n\nرمز الدعوة: ${code}\n\n1. حمل تطبيق معك\n2. سجل دخولك أو أنشئ حساب جديد\n3. استخدم رمز الدعوة: ${code}\n\nهذا الرمز صالح لمدة 7 أيام.`
        : `Hi! You've been invited to join our family health group on Maak app.\n\nInvitation Code: ${code}\n\n1. Download the Maak app\n2. Sign in or create a new account\n3. Use invitation code: ${code}\n\nThis code expires in 7 days.`;

      // Show options to share or copy
      Alert.alert(
        isRTL ? "رمز الدعوة جاهز" : "Invitation Code Ready",
        isRTL
          ? `رمز الدعوة: ${code}\n\nاختر طريقة المشاركة:`
          : `Invitation Code: ${code}\n\nChoose how to share:`,
        [
          {
            text: isRTL ? "مشاركة" : "Share",
            onPress: async () => {
              try {
                await Share.share({
                  message: shareMessage,
                  title: isRTL
                    ? "دعوة للانضمام إلى معك"
                    : "Invitation to join Maak",
                });
              } catch (error) {
                // Fallback to copying to clipboard
                await Clipboard.setString(shareMessage);
                Alert.alert(
                  isRTL ? "تم النسخ" : "Copied",
                  isRTL
                    ? "تم نسخ رسالة الدعوة إلى الحافظة"
                    : "Invitation message copied to clipboard"
                );
              }
            },
          },
          {
            text: isRTL ? "نسخ الرسالة" : "Copy Message",
            onPress: async () => {
              await Clipboard.setString(shareMessage);
              Alert.alert(
                isRTL ? "تم النسخ" : "Copied",
                isRTL
                  ? "تم نسخ رسالة الدعوة إلى الحافظة"
                  : "Full invitation message copied to clipboard"
              );
            },
          },
          {
            text: isRTL ? "نسخ الرمز فقط" : "Copy Code Only",
            onPress: async () => {
              await Clipboard.setString(code);
              Alert.alert(
                isRTL ? "تم النسخ" : "Copied",
                isRTL
                  ? `تم نسخ رمز الدعوة: ${code}`
                  : `Invitation code copied: ${code}`
              );
            },
          },
          {
            text: isRTL ? "إلغاء" : "Cancel",
            style: "cancel",
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في إنشاء رمز الدعوة" : "Failed to generate invitation code"
      );
    }
  };

  const handleJoinFamily = async () => {
    if (!joinFamilyCode.trim()) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى إدخال رمز الدعوة" : "Please enter the invitation code"
      );
      return;
    }

    if (!user) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يجب تسجيل الدخول أولاً" : "You must be logged in first"
      );
      return;
    }

    setJoinLoading(true);

    try {
      const result = await familyInviteService.useInvitationCode(
        joinFamilyCode.trim(),
        user.id
      );
      if (result.success && result.familyId) {
        // Join the family
        await userService.joinFamily(user.id, result.familyId);

        // Refresh family members and user state
        await loadFamilyMembers();

        setJoinFamilyCode("");
        setShowJoinFamilyModal(false);

        Alert.alert(
          isRTL ? "مرحباً بك في العائلة!" : "Welcome to the Family!",
          isRTL
            ? "تم انضمامك بنجاح! يمكنك الآن رؤية أعضاء عائلتك الجدد في الأسفل."
            : "You have successfully joined! You can now see your new family members below."
        );

        // Force reload the screen data to show the new family
        setTimeout(async () => {
          await loadFamilyMembers();
        }, 1000);
      } else {
        Alert.alert(isRTL ? "رمز غير صحيح" : "Invalid Code", result.message);
      }
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في الانضمام للعائلة" : "Failed to join family"
      );
    } finally {
      setJoinLoading(false);
    }
  };

  const getFamilyStats = () => {
    const totalMembers = familyMembers.length;
    const activeMembers = familyMembers.length; // All loaded members are active
    const totalAlerts = 0; // TODO: Get from alert service
    const avgHealthScore = 85; // TODO: Calculate from health data

    return { totalMembers, activeMembers, totalAlerts, avgHealthScore };
  };

  const { totalMembers, activeMembers, totalAlerts, avgHealthScore } =
    getFamilyStats();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, isRTL && styles.rtlText]}>
            {t("family")}
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#2563EB" size="large" />
          <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
            {isRTL ? "جاري التحميل..." : "Loading..."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {t("family")}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setViewMode(viewMode === "list" ? "dashboard" : "list")}
            style={styles.viewToggleButton}
          >
            {viewMode === "list" ? (
              <Grid3x3 color="#FFFFFF" size={20} />
            ) : (
              <List color="#FFFFFF" size={20} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowInviteModal(true)}
            style={styles.addButton}
          >
            <UserPlus color="#FFFFFF" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            onRefresh={() => loadFamilyMembers(true)}
            refreshing={refreshing}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.content}
      >
        {/* Family Overview */}
        <View style={styles.overviewCard}>
          <Text style={[styles.overviewTitle, isRTL && styles.rtlText]}>
            {isRTL ? "نظرة عامة على العائلة" : "Family Overview"}
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Users color="#2563EB" size={20} />
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                {totalMembers}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {isRTL ? "أفراد" : "Members"}
              </Text>
            </View>

            <View style={styles.statItem}>
              <Heart color="#10B981" size={20} />
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                {avgHealthScore || 0}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {isRTL ? "نقاط الصحة" : "Health Score"}
              </Text>
            </View>

            <View style={styles.statItem}>
              <AlertTriangle color="#F59E0B" size={20} />
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                {totalAlerts}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {isRTL ? "تنبيهات" : "Alerts"}
              </Text>
            </View>
          </View>
        </View>

        {/* Active Alerts */}
        <AlertsCard />

        {/* Family Members */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t("familyMembers")}
          </Text>

          {viewMode === "dashboard" ? (
            // Dashboard View
            loadingMetrics ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#2563EB" size="large" />
              </View>
            ) : (
              <View style={styles.dashboardGrid}>
                {memberMetrics.map((metric) => {
                  const fullName =
                    metric.user.firstName && metric.user.lastName
                      ? `${metric.user.firstName} ${metric.user.lastName}`
                      : metric.user.firstName || "User";
                  const isCurrentUser = metric.user.id === user?.id;

                  return (
                    <TouchableOpacity
                      key={metric.id}
                      style={styles.dashboardCard}
                      onPress={() => handleEditMember(metric.user)}
                    >
                      <View style={styles.dashboardCardHeader}>
                        <Avatar
                          avatarType={metric.user.avatarType}
                          name={fullName}
                          size="lg"
                          source={
                            metric.user.avatar
                              ? { uri: metric.user.avatar }
                              : undefined
                          }
                        />
                        {isCurrentUser && (
                          <View style={styles.currentUserBadge}>
                            <Text style={styles.currentUserBadgeText}>
                              {isRTL ? "أنت" : "You"}
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text
                        style={[styles.dashboardCardName, isRTL && styles.rtlText]}
                        numberOfLines={1}
                      >
                        {fullName}
                      </Text>

                      <View style={styles.dashboardMetrics}>
                        <View style={styles.dashboardMetric}>
                          <Heart
                            color={
                              metric.healthScore >= 80
                                ? "#10B981"
                                : metric.healthScore >= 60
                                  ? "#F59E0B"
                                  : "#EF4444"
                            }
                            size={16}
                          />
                          <Text
                            style={[
                              styles.dashboardMetricValue,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {metric.healthScore}
                          </Text>
                          <Text
                            style={[
                              styles.dashboardMetricLabel,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {isRTL ? "صحة" : "Health"}
                          </Text>
                        </View>

                        <View style={styles.dashboardMetric}>
                          <AlertTriangle color="#F59E0B" size={16} />
                          <Text
                            style={[
                              styles.dashboardMetricValue,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {metric.symptomsThisWeek}
                          </Text>
                          <Text
                            style={[
                              styles.dashboardMetricLabel,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {isRTL ? "أعراض" : "Symptoms"}
                          </Text>
                        </View>

                        <View style={styles.dashboardMetric}>
                          <Heart color="#2563EB" size={16} />
                          <Text
                            style={[
                              styles.dashboardMetricValue,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {metric.activeMedications}
                          </Text>
                          <Text
                            style={[
                              styles.dashboardMetricLabel,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {isRTL ? "أدوية" : "Meds"}
                          </Text>
                        </View>

                        {metric.alertsCount > 0 && (
                          <View style={styles.dashboardMetric}>
                            <AlertTriangle color="#EF4444" size={16} />
                            <Text
                              style={[
                                styles.dashboardMetricValue,
                                styles.alertValue,
                                isRTL && styles.rtlText,
                              ]}
                            >
                              {metric.alertsCount}
                            </Text>
                            <Text
                              style={[
                                styles.dashboardMetricLabel,
                                isRTL && styles.rtlText,
                              ]}
                            >
                              {isRTL ? "تنبيهات" : "Alerts"}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )
          ) : (
            // List View
            <View style={styles.membersList}>
              {familyMembers.map((member) => (
              <View key={member.id} style={styles.memberItem}>
                <View style={styles.memberLeft}>
                  <View style={styles.avatarContainer}>
                    <Avatar
                      avatarType={member.avatarType}
                      badgeColor="#10B981"
                      name={member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName || "User"}
                      showBadge={member.id === user?.id}
                      size="md"
                      source={
                        member.avatar ? { uri: member.avatar } : undefined
                      }
                    />
                  </View>

                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, isRTL && styles.rtlText]}>
                      {member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName || "User"}
                    </Text>
                    <Text
                      style={[styles.memberRelation, isRTL && styles.rtlText]}
                    >
                      {member.role === "admin"
                        ? isRTL
                          ? "مدير"
                          : "Admin"
                        : isRTL
                          ? "عضو"
                          : "Member"}
                    </Text>
                  </View>
                </View>

                <View style={styles.memberRight}>
                  <View style={styles.memberStats}>
                    <View
                      style={[
                        styles.statusIndicator,
                        {
                          backgroundColor: "#10B981",
                        },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {isRTL ? "نشط" : "Active"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.memberActions}>
                    <TouchableOpacity
                      onPress={() => handleEditMember(member)}
                      style={styles.actionButton}
                    >
                      <Edit color="#64748B" size={16} />
                    </TouchableOpacity>
                    {member.id !== user?.id && (
                      <TouchableOpacity
                        onPress={() => handleDeleteMember(member)}
                        style={[styles.actionButton, styles.deleteButton]}
                      >
                        <Trash2 color="#EF4444" size={16} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {isRTL ? "إجراءات سريعة" : "Quick Actions"}
          </Text>

          <View style={styles.quickActions}>
            <TouchableOpacity
              onPress={copyInviteCode}
              style={styles.quickActionButton}
            >
              <Share2 color="#2563EB" size={24} />
              <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                {isRTL ? "مشاركة رمز الدعوة" : "Share Invite Code"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleEmergencySettings}
              style={styles.quickActionButton}
            >
              <Settings color="#F59E0B" size={24} />
              <Text style={[styles.quickActionText, isRTL && styles.rtlText]}>
                {isRTL ? "إعدادات الطوارئ" : "Emergency Settings"}
              </Text>
            </TouchableOpacity>
          </View>

          {!user?.familyId && (
            <TouchableOpacity
              onPress={() => setShowJoinFamilyModal(true)}
              style={styles.joinFamilyButton}
            >
              <Users color="#FFFFFF" size={24} />
              <Text
                style={[styles.joinFamilyButtonText, isRTL && styles.rtlText]}
              >
                {isRTL ? "الانضمام إلى عائلة" : "Join a Family"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Invite Member Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showInviteModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? "دعوة عضو جديد" : "Invite New Member"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowInviteModal(false);
                setInviteForm({
                  name: "",
                  relation: "",
                });
              }}
              style={styles.closeButton}
            >
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Name */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "الاسم الكامل" : "Full Name"} *
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setInviteForm({ ...inviteForm, name: text })
                }
                placeholder={isRTL ? "ادخل الاسم الكامل" : "Enter full name"}
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={inviteForm.name}
              />
            </View>

            {/* Relation */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "صلة القرابة" : "Relationship"} *
              </Text>
              <View style={styles.relationOptions}>
                {RELATIONS.map((relation) => (
                  <TouchableOpacity
                    key={relation.key}
                    onPress={() =>
                      setInviteForm({
                        ...inviteForm,
                        relation: isRTL ? relation.labelAr : relation.labelEn,
                      })
                    }
                    style={[
                      styles.relationOption,
                      inviteForm.relation ===
                        (isRTL ? relation.labelAr : relation.labelEn) &&
                        styles.relationOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.relationOptionText,
                        inviteForm.relation ===
                          (isRTL ? relation.labelAr : relation.labelEn) &&
                          styles.relationOptionTextSelected,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL ? relation.labelAr : relation.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              onPress={handleInviteMember}
              style={styles.inviteButton}
            >
              <Text style={styles.inviteButtonText}>
                {isRTL ? "إرسال الدعوة" : "Send Invitation"}
              </Text>
            </TouchableOpacity>

            {generatedCode && (
              <View style={styles.codeContainer}>
                <Text style={[styles.codeLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "رمز الدعوة" : "Invite Code"}
                </Text>
                <Text style={[styles.codeValue, isRTL && styles.rtlText]}>
                  {generatedCode}
                </Text>
              </View>
            )}

            {inviteLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#2563EB" size="large" />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Emergency Settings Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showEmergencyModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? "إعدادات الطوارئ" : "Emergency Settings"}
            </Text>
            <TouchableOpacity
              onPress={() => setShowEmergencyModal(false)}
              style={styles.closeButton}
            >
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "جهات الاتصال في حالات الطوارئ" : "Emergency Contacts"}
              </Text>
              <Text
                style={[styles.emergencyDescription, isRTL && styles.rtlText]}
              >
                {isRTL
                  ? "سيتم إشعار جهات الاتصال هذه في حالة الطوارئ"
                  : "These contacts will be notified in case of emergency"}
              </Text>

              {/* Emergency Contacts List */}
              {emergencyContacts.map((contact) => (
                <View key={contact.id} style={styles.contactItem}>
                  <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, isRTL && styles.rtlText]}>
                      {contact.name}
                    </Text>
                    <Text
                      style={[styles.contactPhone, isRTL && styles.rtlText]}
                    >
                      {contact.phone}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteEmergencyContact(contact.id)}
                    style={styles.deleteContactButton}
                  >
                    <X color="#EF4444" size={16} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add New Contact Form */}
              <View style={styles.addContactForm}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "إضافة جهة اتصال جديدة" : "Add New Contact"}
                </Text>

                <TextInput
                  onChangeText={(text) =>
                    setNewContact((prev) => ({ ...prev, name: text }))
                  }
                  placeholder={isRTL ? "اسم جهة الاتصال" : "Contact Name"}
                  style={[styles.textInput, isRTL && styles.rtlInput]}
                  textAlign={isRTL ? "right" : "left"}
                  value={newContact.name}
                />

                <TextInput
                  keyboardType="phone-pad"
                  onChangeText={(text) =>
                    setNewContact((prev) => ({ ...prev, phone: text }))
                  }
                  placeholder={isRTL ? "رقم الهاتف" : "Phone Number"}
                  style={[
                    styles.textInput,
                    isRTL && styles.rtlInput,
                    { marginTop: 8 },
                  ]}
                  textAlign={isRTL ? "right" : "left"}
                  value={newContact.phone}
                />

                <Pressable
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={handleAddEmergencyContact}
                  style={({ pressed }) => [
                    styles.addContactButton,
                    pressed && { opacity: 0.7, backgroundColor: "#F3F4F6" },
                  ]}
                >
                  {({ pressed }) => (
                    <>
                      <Plus color="#2563EB" size={20} />
                      <Text
                        style={[styles.addContactText, isRTL && styles.rtlText]}
                      >
                        {isRTL ? "إضافة جهة اتصال" : "Add Contact"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "كشف السقوط" : "Fall Detection"}
              </Text>
              <View style={styles.settingToggle}>
                <Text style={[styles.settingText, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "تفعيل كشف السقوط التلقائي"
                    : "Enable automatic fall detection"}
                </Text>
                <Switch
                  onValueChange={toggleFallDetection}
                  thumbColor={fallDetectionEnabled ? "#FFFFFF" : "#9CA3AF"}
                  trackColor={{ false: "#E5E7EB", true: "#10B981" }}
                  value={fallDetectionEnabled}
                />
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "تنبيهات الأدوية" : "Medication Alerts"}
              </Text>
              <View style={styles.settingToggle}>
                <Text style={[styles.settingText, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "إرسال تنبيهات فوتت الأدوية"
                    : "Send missed medication alerts"}
                </Text>
                <Switch
                  onValueChange={handleToggleMedicationAlerts}
                  thumbColor={medicationAlertsEnabled ? "#FFFFFF" : "#9CA3AF"}
                  trackColor={{ false: "#E5E7EB", true: "#10B981" }}
                  value={medicationAlertsEnabled}
                />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Join Family Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showJoinFamilyModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? "الانضمام إلى عائلة" : "Join a Family"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowJoinFamilyModal(false);
                setJoinFamilyCode("");
              }}
              style={styles.closeButton}
            >
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "رمز الدعوة" : "Invitation Code"}
              </Text>
              <TextInput
                keyboardType="numeric"
                maxLength={6}
                onChangeText={setJoinFamilyCode}
                placeholder={
                  isRTL
                    ? "أدخل رمز الدعوة (6 أرقام)"
                    : "Enter invitation code (6 digits)"
                }
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={joinFamilyCode}
              />
              <Text
                style={[styles.emergencyDescription, isRTL && styles.rtlText]}
              >
                {isRTL
                  ? "أدخل رمز الدعوة المرسل إليك من أحد أفراد العائلة للانضمام إلى مجموعتهم الصحية"
                  : "Enter the invitation code sent to you by a family member to join their health group"}
              </Text>
            </View>

            <TouchableOpacity
              disabled={joinLoading}
              onPress={handleJoinFamily}
              style={[
                styles.inviteButton,
                joinLoading && styles.inviteButtonDisabled,
              ]}
            >
              <Text style={styles.inviteButtonText}>
                {joinLoading
                  ? isRTL
                    ? "جاري الانضمام..."
                    : "Joining..."
                  : isRTL
                    ? "انضم للعائلة"
                    : "Join Family"}
              </Text>
            </TouchableOpacity>

            {joinLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#2563EB" size="large" />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Member Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showEditMemberModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {isRTL ? "تعديل العضو" : "Edit Member"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowEditMemberModal(false);
                setEditMemberForm({
                  id: "",
                  firstName: "",
                  lastName: "",
                  email: "",
                  role: "member",
                });
              }}
              style={styles.closeButton}
            >
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* First Name */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "الاسم الأول" : "First Name"} *
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setEditMemberForm({ ...editMemberForm, firstName: text })
                }
                placeholder={isRTL ? "ادخل الاسم الأول" : "Enter first name"}
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={editMemberForm.firstName}
              />
            </View>

            {/* Last Name */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "اسم العائلة" : "Last Name"}
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setEditMemberForm({ ...editMemberForm, lastName: text })
                }
                placeholder={isRTL ? "ادخل اسم العائلة" : "Enter last name"}
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={editMemberForm.lastName}
              />
            </View>

            {/* Email */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "البريد الإلكتروني" : "Email"} *
              </Text>
              <TextInput
                keyboardType="email-address"
                onChangeText={(text) =>
                  setEditMemberForm({ ...editMemberForm, email: text })
                }
                placeholder={isRTL ? "ادخل البريد الإلكتروني" : "Enter email"}
                style={[styles.textInput, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={editMemberForm.email}
              />
            </View>

            {/* Role */}
            {/* Only show role selection to admins editing other users */}
            {user?.role === "admin" && user.id !== editMemberForm.id && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "الدور" : "Role"} *
                </Text>
                <View style={styles.roleOptions}>
                  {["admin", "member"].map((role) => (
                    <TouchableOpacity
                      key={role}
                      onPress={() =>
                        setEditMemberForm({
                          ...editMemberForm,
                          role: role as "admin" | "member",
                        })
                      }
                      style={[
                        styles.roleOption,
                        editMemberForm.role === role &&
                          styles.roleOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleOptionText,
                          editMemberForm.role === role &&
                            styles.roleOptionTextSelected,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {role === "admin"
                          ? isRTL
                            ? "مدير"
                            : "Admin"
                          : isRTL
                            ? "عضو"
                            : "Member"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSaveEditMember}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>
                {isRTL ? "حفظ" : "Save"}
              </Text>
            </TouchableOpacity>

            {editLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#2563EB" size="large" />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#2563EB",
  },
  title: {
    fontSize: 28,
    fontFamily: "Geist-Bold",
    color: "#FFFFFF",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  viewToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  overviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overviewTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 12,
  },
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  dashboardCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  dashboardCardHeader: {
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
  },
  currentUserBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#2563EB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentUserBadgeText: {
    fontSize: 10,
    fontFamily: "Geist-SemiBold",
    color: "#FFFFFF",
  },
  dashboardCardName: {
    fontSize: 14,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 12,
  },
  dashboardMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  dashboardMetric: {
    alignItems: "center",
    flex: 1,
    minWidth: "45%",
  },
  dashboardMetricValue: {
    fontSize: 18,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginTop: 4,
  },
  alertValue: {
    color: "#EF4444",
  },
  dashboardMetricLabel: {
    fontSize: 10,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginTop: 2,
  },
  membersList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  memberItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  memberLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#FFFFFF",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 2,
  },
  memberRelation: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginBottom: 2,
  },
  memberLastActive: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#94A3B8",
  },
  memberRight: {
    alignItems: "flex-end",
  },
  healthScore: {
    fontSize: 20,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontFamily: "Geist-SemiBold",
    color: "#FFFFFF",
  },
  pendingIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#1E293B",
    marginTop: 8,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#374151",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "Geist-Regular",
    backgroundColor: "#FFFFFF",
  },
  rtlInput: {
    fontFamily: "Cairo-Regular",
  },
  relationOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  relationOption: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  relationOptionSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  relationOptionText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  relationOptionTextSelected: {
    color: "#FFFFFF",
  },
  inviteButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 16,
  },
  inviteButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  inviteButtonText: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#FFFFFF",
  },
  codeContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  codeLabel: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#374151",
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 20,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#64748B",
    marginTop: 16,
  },
  rtlText: {
    fontFamily: "Cairo-Regular",
  },
  memberStats: {
    alignItems: "flex-end",
    marginBottom: 8,
  },
  memberActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  deleteButton: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  emergencyDescription: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#64748B",
    marginBottom: 16,
  },
  addContactButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addContactText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#2563EB",
    marginLeft: 8,
  },
  settingToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
  },
  settingText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#1E293B",
  },
  toggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  toggleInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#2563EB",
  },
  joinFamilyButton: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  joinFamilyButtonText: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#FFFFFF",
    marginLeft: 8,
  },
  roleOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleOption: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  roleOptionSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  roleOptionText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  roleOptionTextSelected: {
    color: "#FFFFFF",
  },
  saveButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#FFFFFF",
  },
  contactItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    color: "#64748B",
  },
  deleteContactButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: "#FEF2F2",
  },
  addContactForm: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
});

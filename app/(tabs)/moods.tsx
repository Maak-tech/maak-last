import { useFocusEffect } from "expo-router";
import { Edit, MoreVertical, Plus, Trash2, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import FamilyDataFilter, {
  type FilterOption,
} from "@/app/components/FamilyDataFilter";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { moodService } from "@/lib/services/moodService";
import { userService } from "@/lib/services/userService";
import type { Mood, User as UserType } from "@/types";

const MOOD_OPTIONS = [
  { value: "veryHappy", emoji: "😄", label: "veryHappy" },
  { value: "happy", emoji: "😊", label: "happy" },
  { value: "neutral", emoji: "😐", label: "neutral" },
  { value: "sad", emoji: "😔", label: "sad" },
  { value: "verySad", emoji: "😢", label: "verySad" },
];

export default function MoodsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState<
    "veryHappy" | "happy" | "neutral" | "sad" | "verySad" | ""
  >("");
  const [intensity, setIntensity] = useState(1);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [stats, setStats] = useState({
    totalMoods: 0,
    avgIntensity: 0,
    moodDistribution: [] as { mood: string; count: number }[],
  });
  const [editingMood, setEditingMood] = useState<Mood | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<UserType[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>({
    id: "personal",
    type: "personal",
    label: "",
  });
  const [selectedTargetUser, setSelectedTargetUser] = useState<string>("");

  const isRTL = i18n.language === "ar";
  const isAdmin = user?.role === "admin";
  const hasFamily = Boolean(user?.familyId);

  const loadMoods = async (isRefresh = false) => {
    if (!user) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Always load family members first if user has family
      let members: UserType[] = [];
      if (user.familyId) {
        members = await userService.getFamilyMembers(user.familyId);
        setFamilyMembers(members);
      }

      // Load data based on selected filter
      if (selectedFilter.type === "family" && user.familyId) {
        // Load family moods and stats (both admins and members can view)
        const [familyMoods, familyStats] = await Promise.all([
          moodService.getFamilyMoods(user.familyId, 50),
          moodService.getFamilyMoodStats(user.familyId, 7),
        ]);

        setMoods(familyMoods);
        setStats(familyStats);
      } else if (selectedFilter.type === "member" && selectedFilter.memberId) {
        // Load specific member moods and stats (both admins and members can view)
        const [memberMoods, memberStats] = await Promise.all([
          moodService.getMemberMoods(selectedFilter.memberId, 50),
          moodService.getMemberMoodStats(selectedFilter.memberId, 7),
        ]);

        setMoods(memberMoods);
        setStats(memberStats);
      } else {
        // Load personal moods and stats (default)
        const [userMoods, moodStats] = await Promise.all([
          moodService.getUserMoods(user.id, 50),
          moodService.getMoodStats(user.id, 7),
        ]);

        setMoods(userMoods);
        setStats(moodStats);
      }
    } catch (error) {
      // Silently handle moods load error
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "حدث خطأ في تحميل البيانات" : "Error loading data"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh data when tab is focused
  useFocusEffect(
    useCallback(() => {
      loadMoods();
    }, [user, selectedFilter])
  );

  useEffect(() => {
    loadMoods();
  }, [user, selectedFilter]);

  const handleFilterChange = (filter: FilterOption) => {
    setSelectedFilter(filter);
  };

  const getMemberName = (userId: string): string => {
    if (userId === user?.id) {
      return isRTL ? "أنت" : "You";
    }
    const member = familyMembers.find((m) => m.id === userId);
    if (!member) {
      return isRTL ? "عضو غير معروف" : "Unknown Member";
    }
    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    if (member.firstName) {
      return member.firstName;
    }
    return isRTL ? "عضو غير معروف" : "Unknown Member";
  };

  const handleAddMood = async () => {
    if (!user) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى تسجيل الدخول" : "Please log in"
      );
      return;
    }

    if (!selectedMood) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى اختيار المزاج" : "Please select a mood"
      );
      return;
    }

    if (!user.id) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "معرف المستخدم غير موجود" : "User ID not found"
      );
      return;
    }

    try {
      setLoading(true);

      if (editingMood) {
        // Check if user can edit this mood
        const canEdit =
          editingMood.userId === user.id ||
          (isAdmin &&
            (selectedFilter.type === "family" ||
              selectedFilter.type === "member"));
        if (!canEdit) {
          Alert.alert(
            isRTL ? "غير مسموح" : "Not Permitted",
            isRTL
              ? "ليس لديك صلاحية لتعديل هذا المزاج"
              : "You do not have permission to edit this mood"
          );
          return;
        }

        // Update existing mood
        const updateData: Partial<Mood> = {
          mood: selectedMood,
          intensity: intensity as 1 | 2 | 3 | 4 | 5,
          ...(notes && { notes }),
        };

        await moodService.updateMood(editingMood.id, updateData);
        setEditingMood(null);
      } else {
        // Add new mood
        const targetUserId = selectedTargetUser || user.id;

        if (!targetUserId) {
          throw new Error("Target user ID is required");
        }

        const moodData: Omit<Mood, "id"> = {
          userId: targetUserId,
          mood: selectedMood as
            | "veryHappy"
            | "happy"
            | "neutral"
            | "sad"
            | "verySad",
          intensity: intensity as 1 | 2 | 3 | 4 | 5,
          timestamp: new Date(),
          activities: [],
          ...(notes && { notes }),
        };

        if (isAdmin && targetUserId !== user.id) {
          // Admin adding mood for another family member
          await moodService.addMoodForUser(moodData, targetUserId);
        } else {
          // User adding mood for themselves
          await moodService.addMood(moodData);
        }
      }

      // Reset form
      setSelectedMood("");
      setIntensity(1);
      setNotes("");
      setSelectedTargetUser("");
      setShowAddModal(false);

      // Reload moods
      await loadMoods();

      Alert.alert(
        isRTL ? "تم الحفظ" : "Saved",
        isRTL
          ? editingMood
            ? "تم تحديث المزاج بنجاح"
            : "تم تسجيل المزاج بنجاح"
          : editingMood
            ? "Mood updated successfully"
            : "Mood logged successfully"
      );
    } catch (error: any) {
      console.error("Error saving mood:", error);

      // Provide more specific error messages
      let errorMessage = isRTL ? "حدث خطأ في حفظ المزاج" : "Error saving mood";

      if (error?.message) {
        if (
          error.message.includes("permission") ||
          error.message.includes("Permission")
        ) {
          errorMessage = isRTL
            ? "ليس لديك صلاحية لحفظ المزاج. يرجى التحقق من إعدادات الحساب."
            : "You don't have permission to save mood. Please check your account settings.";
        } else if (
          error.message.includes("network") ||
          error.message.includes("Network")
        ) {
          errorMessage = isRTL
            ? "خطأ في الاتصال بالإنترنت. يرجى المحاولة مرة أخرى."
            : "Network error. Please try again.";
        } else if (error.message.includes("required")) {
          errorMessage = isRTL
            ? "يرجى ملء جميع الحقول المطلوبة"
            : "Please fill in all required fields";
        } else {
          errorMessage = isRTL
            ? `حدث خطأ في حفظ المزاج: ${error.message}`
            : `Error saving mood: ${error.message}`;
        }
      }

      Alert.alert(isRTL ? "خطأ" : "Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEditMood = (mood: Mood) => {
    // Check permissions
    const canEdit =
      mood.userId === user?.id ||
      (isAdmin &&
        (selectedFilter.type === "family" || selectedFilter.type === "member"));
    if (!canEdit) {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لتعديل هذا المزاج"
          : "You do not have permission to edit this mood"
      );
      return;
    }

    setEditingMood(mood);
    setSelectedMood(mood.mood);
    setIntensity(mood.intensity);
    setNotes(mood.notes || "");
    setSelectedTargetUser(mood.userId);
    setShowAddModal(true);
    setShowActionsMenu(null);
  };

  const handleDeleteMood = (mood: Mood) => {
    // Check permissions
    const canDelete =
      mood.userId === user?.id ||
      (isAdmin &&
        (selectedFilter.type === "family" || selectedFilter.type === "member"));
    if (!canDelete) {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لحذف هذا المزاج"
          : "You do not have permission to delete this mood"
      );
      return;
    }

    Alert.alert(
      isRTL ? "حذف المزاج" : "Delete Mood",
      isRTL
        ? "هل أنت متأكد من رغبتك في حذف هذا المزاج؟"
        : "Are you sure you want to delete this mood?",
      [
        {
          text: isRTL ? "إلغاء" : "Cancel",
          style: "cancel",
        },
        {
          text: isRTL ? "حذف" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await moodService.deleteMood(mood.id);
              await loadMoods();
              setShowActionsMenu(null);
              Alert.alert(
                isRTL ? "تم الحذف" : "Deleted",
                isRTL ? "تم حذف المزاج بنجاح" : "Mood deleted successfully"
              );
            } catch (error) {
              // Silently handle mood delete error
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL ? "حدث خطأ في حذف المزاج" : "Error deleting mood"
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getMoodColor = (moodType: string) => {
    switch (moodType) {
      case "veryHappy":
        return "#10B981";
      case "happy":
        return "#34D399";
      case "neutral":
        return "#F59E0B";
      case "sad":
        return "#F87171";
      case "verySad":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getMoodEmoji = (moodType: string) => {
    const moodOption = MOOD_OPTIONS.find((m) => m.value === moodType);
    return moodOption?.emoji || "😐";
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return isRTL ? "منذ أقل من ساعة" : "Less than an hour ago";
    }
    if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return isRTL
        ? `منذ ${hours} ساعة${hours > 1 ? "ات" : ""}`
        : `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }
    const days = Math.floor(diffInHours / 24);
    return isRTL
      ? `منذ ${days} يوم${days > 1 ? "" : ""}`
      : `${days} day${days > 1 ? "s" : ""} ago`;
  };

  const renderIntensitySelector = () => (
    <View style={styles.intensityContainer}>
      <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
        {isRTL ? "الشدة" : "Intensity"} ({intensity}/5)
      </Text>
      <View style={styles.intensityButtons}>
        {[1, 2, 3, 4, 5].map((level) => (
          <TouchableOpacity
            key={level}
            onPress={() => setIntensity(level)}
            style={[
              styles.intensityButton,
              intensity >= level && styles.intensityButtonActive,
            ]}
          >
            <Text
              style={[
                styles.intensityButtonText,
                intensity >= level && styles.intensityButtonTextActive,
              ]}
            >
              {level}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.intensityLabels}>
        <Text style={[styles.intensityLabel, isRTL && styles.rtlText]}>
          {isRTL ? "خفيف" : "Mild"}
        </Text>
        <Text style={[styles.intensityLabel, isRTL && styles.rtlText]}>
          {isRTL ? "شديد جداً" : "Very Intense"}
        </Text>
      </View>
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Please log in to track moods</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {isRTL ? "تتبع المزاج" : "Mood Tracking"}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setSelectedTargetUser(user.id);
            setShowAddModal(true);
          }}
          style={styles.addButton}
        >
          <Plus color="#FFFFFF" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            onRefresh={() => loadMoods(true)}
            refreshing={refreshing}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.content}
      >
        {/* Enhanced Data Filter */}
        <FamilyDataFilter
          currentUserId={user.id}
          familyMembers={familyMembers}
          hasFamily={hasFamily}
          isAdmin={isAdmin}
          onFilterChange={handleFilterChange}
          selectedFilter={selectedFilter}
        />

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t("thisWeek")}
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                {stats.totalMoods}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {selectedFilter.type === "family"
                  ? isRTL
                    ? "مزاجات العائلة"
                    : "Family Moods"
                  : selectedFilter.type === "member"
                    ? isRTL
                      ? `مزاجات ${selectedFilter.memberName}`
                      : `${selectedFilter.memberName}'s Moods`
                    : isRTL
                      ? "إجمالي المزاجات"
                      : "Total Moods"}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, isRTL && styles.rtlText]}>
                {stats.avgIntensity.toFixed(1)}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
                {isRTL ? "متوسط الشدة" : "Avg Intensity"}
              </Text>
            </View>
          </View>
        </View>

        {/* Moods List */}
        <View style={styles.moodsSection}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {selectedFilter.type === "family"
              ? isRTL
                ? "مزاجات العائلة الأخيرة"
                : "Recent Family Moods"
              : selectedFilter.type === "member"
                ? isRTL
                  ? `مزاجات ${selectedFilter.memberName} الأخيرة`
                  : `${selectedFilter.memberName}'s Recent Moods`
                : isRTL
                  ? "مزاجاتي الأخيرة"
                  : "My Recent Moods"}
          </Text>

          {loading ? (
            <View style={styles.centerContainer}>
              <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
                {isRTL ? "جاري التحميل..." : "Loading..."}
              </Text>
            </View>
          ) : moods.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                {isRTL ? "لا توجد مزاجات مسجلة" : "No moods recorded"}
              </Text>
            </View>
          ) : (
            moods.map((mood) => (
              <View key={mood.id} style={styles.moodCard}>
                <View style={styles.moodHeader}>
                  <View style={styles.moodInfo}>
                    <View style={styles.moodEmojiContainer}>
                      <Text style={styles.moodEmoji}>
                        {getMoodEmoji(mood.mood)}
                      </Text>
                      <Text style={[styles.moodType, isRTL && styles.rtlText]}>
                        {t(mood.mood)}
                      </Text>
                    </View>
                    <View style={styles.moodMeta}>
                      <Text style={[styles.moodDate, isRTL && styles.rtlText]}>
                        {formatDate(mood.timestamp)}
                      </Text>
                      {/* Show member name for family/admin views */}
                      {(selectedFilter.type === "family" ||
                        selectedFilter.type === "member") && (
                        <View style={styles.memberBadge}>
                          <Text
                            style={[
                              styles.memberBadgeText,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {getMemberName(mood.userId)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.moodActions}>
                    <View
                      style={[
                        styles.intensityBadge,
                        { backgroundColor: getMoodColor(mood.mood) },
                      ]}
                    >
                      <Text style={styles.intensityText}>{mood.intensity}</Text>
                    </View>
                    {/* Show action menu only for moods user can manage */}
                    {(mood.userId === user.id ||
                      (isAdmin &&
                        (selectedFilter.type === "family" ||
                          selectedFilter.type === "member"))) && (
                      <TouchableOpacity
                        onPress={() =>
                          setShowActionsMenu(
                            showActionsMenu === mood.id ? null : mood.id
                          )
                        }
                        style={styles.actionsButton}
                      >
                        <MoreVertical color="#64748B" size={16} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {mood.notes && (
                  <Text style={[styles.moodNotes, isRTL && styles.rtlText]}>
                    {mood.notes}
                  </Text>
                )}

                {/* Actions Menu */}
                {showActionsMenu === mood.id && (
                  <View style={styles.actionsMenu}>
                    <TouchableOpacity
                      onPress={() => handleEditMood(mood)}
                      style={styles.actionItem}
                    >
                      <Edit color="#64748B" size={16} />
                      <Text
                        style={[styles.actionText, isRTL && styles.rtlText]}
                      >
                        {isRTL ? "تعديل" : "Edit"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteMood(mood)}
                      style={styles.actionItem}
                    >
                      <Trash2 color="#EF4444" size={16} />
                      <Text
                        style={[
                          styles.actionText,
                          styles.deleteText,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {isRTL ? "حذف" : "Delete"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Mood Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShowAddModal(false);
          setEditingMood(null);
          setSelectedMood("");
          setIntensity(1);
          setNotes("");
        }}
        presentationStyle="pageSheet"
        visible={showAddModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {editingMood
                ? isRTL
                  ? "تعديل المزاج"
                  : "Edit Mood"
                : isRTL
                  ? "إضافة مزاج جديد"
                  : "Add New Mood"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                setEditingMood(null);
                setSelectedMood("");
                setIntensity(1);
                setNotes("");
              }}
              style={styles.closeButton}
            >
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Target User Selector (for admins) */}
            {isAdmin && hasFamily && familyMembers.length > 0 && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "إضافة المزاج لـ" : "Add mood for"}
                </Text>
                <View style={styles.memberSelectionContainer}>
                  {familyMembers.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      onPress={() => setSelectedTargetUser(member.id)}
                      style={[
                        styles.memberOption,
                        selectedTargetUser === member.id &&
                          styles.memberOptionSelected,
                      ]}
                    >
                      <View style={styles.memberInfo}>
                        <Text
                          style={[
                            styles.memberName,
                            selectedTargetUser === member.id &&
                              styles.memberNameSelected,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {member.id === user.id
                            ? isRTL
                              ? "أنت"
                              : "You"
                            : member.firstName && member.lastName
                              ? `${member.firstName} ${member.lastName}`
                              : member.firstName || "User"}
                        </Text>
                        {member.role === "admin" && (
                          <Text
                            style={[
                              styles.memberRole,
                              selectedTargetUser === member.id &&
                                styles.memberRoleSelected,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {isRTL ? "مدير" : "Admin"}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Mood Selection */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "اختر المزاج" : "Select Mood"}
              </Text>
              <View style={styles.moodsGrid}>
                {MOOD_OPTIONS.map((moodOption) => (
                  <TouchableOpacity
                    key={moodOption.value}
                    onPress={() => setSelectedMood(moodOption.value as any)}
                    style={[
                      styles.moodOption,
                      selectedMood === moodOption.value &&
                        styles.moodOptionSelected,
                    ]}
                  >
                    <Text style={styles.moodOptionEmoji}>
                      {moodOption.emoji}
                    </Text>
                    <Text
                      style={[
                        styles.moodOptionText,
                        selectedMood === moodOption.value &&
                          styles.moodOptionTextSelected,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {t(moodOption.label)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Intensity */}
            {renderIntensitySelector()}

            {/* Notes */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t("notes")} ({isRTL ? "اختياري" : "Optional"})
              </Text>
              <TextInput
                multiline
                numberOfLines={3}
                onChangeText={setNotes}
                placeholder={
                  isRTL
                    ? "أضف ملاحظات حول مزاجك..."
                    : "Add notes about your mood..."
                }
                style={[
                  styles.textInput,
                  styles.textArea,
                  isRTL && styles.rtlTextInput,
                ]}
                textAlign={isRTL ? "right" : "left"}
                value={notes}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              disabled={loading}
              onPress={handleAddMood}
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            >
              <Text style={[styles.saveButtonText, isRTL && styles.rtlText]}>
                {loading
                  ? isRTL
                    ? "جاري الحفظ..."
                    : "Saving..."
                  : editingMood
                    ? isRTL
                      ? "تحديث المزاج"
                      : "Update Mood"
                    : isRTL
                      ? "حفظ المزاج"
                      : "Save Mood"}
              </Text>
            </TouchableOpacity>
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
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  title: {
    fontSize: 24,
    fontFamily: "Geist-Bold",
    color: "#1E293B",
  },
  rtlText: {
    fontFamily: "Geist-Bold",
    textAlign: "right",
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
    padding: 20,
  },
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontFamily: "Geist-Bold",
    color: "#2563EB",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
    textAlign: "center",
  },
  moodsSection: {
    marginBottom: 24,
  },
  moodCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  moodHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  moodInfo: {
    flex: 1,
  },
  moodEmojiContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodType: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
  },
  moodMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  moodDate: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  memberBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  memberBadgeText: {
    fontSize: 10,
    fontFamily: "Geist-Medium",
    color: "#6366F1",
  },
  moodActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  intensityBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  intensityText: {
    fontSize: 12,
    fontFamily: "Geist-Bold",
    color: "#FFFFFF",
  },
  actionsButton: {
    padding: 4,
  },
  moodNotes: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    color: "#475569",
    lineHeight: 20,
  },
  actionsMenu: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    gap: 16,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  deleteText: {
    color: "#EF4444",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#64748B",
    textAlign: "center",
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#EF4444",
    textAlign: "center",
  },
  // Modal styles
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
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    marginBottom: 8,
  },
  moodsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  moodOption: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "#F1F5F9",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  moodOptionSelected: {
    backgroundColor: "#EBF4FF",
    borderColor: "#2563EB",
    borderWidth: 2,
  },
  moodOptionEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  moodOptionText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#64748B",
    textAlign: "center",
  },
  moodOptionTextSelected: {
    color: "#2563EB",
    fontFamily: "Geist-SemiBold",
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Geist-Regular",
    color: "#1E293B",
  },
  rtlTextInput: {
    fontFamily: "Geist-Regular",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  intensityContainer: {
    marginBottom: 24,
  },
  intensityButtons: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  intensityButton: {
    flex: 1,
    height: 44,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  intensityButtonActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  intensityButtonText: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#64748B",
  },
  intensityButtonTextActive: {
    color: "#FFFFFF",
  },
  intensityLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  intensityLabel: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  saveButton: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#FFFFFF",
  },
  // Member selection styles
  memberSelectionContainer: {
    gap: 8,
  },
  memberOption: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberOptionSelected: {
    backgroundColor: "#EBF4FF",
    borderColor: "#2563EB",
  },
  memberInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberName: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#1E293B",
  },
  memberNameSelected: {
    color: "#2563EB",
  },
  memberRole: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  memberRoleSelected: {
    color: "#2563EB",
    backgroundColor: "#EBF4FF",
  },
});

import { useNavigation, useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronRight,
  CreditCard,
  Crown,
  RefreshCcw,
  Shield,
  Trash2,
  User,
  Users,
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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useRevenueCat } from "@/hooks/useRevenueCat";
import { useSubscription } from "@/hooks/useSubscription";
import { userService } from "@/lib/services/userService";
import { familyInviteService } from "@/lib/services/familyInviteService";
import type { User as UserType } from "@/types";
import { PLAN_LIMITS } from "@/lib/services/revenueCatService";

export default function AdminSettingsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const {
    subscriptionStatus,
    hasActiveSubscription,
    hasFamilyPlan,
    hasIndividualPlan,
    refreshCustomerInfo,
    restorePurchases,
    isLoading: subscriptionLoading,
  } = useRevenueCat();
  const { planLimits, maxFamilyMembers, maxTotalMembers } = useSubscription();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<UserType[]>([]);
  const [selectedMember, setSelectedMember] = useState<UserType | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);

  const isRTL = i18n.language === "ar";
  const isAdmin = user?.role === "admin";

  // Hide the default header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async (isRefresh = false) => {
    if (!user?.id) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Load family members if user has a family
      if (user.familyId) {
        const members = await userService.getFamilyMembers(user.familyId);
        // Filter out the current user from the list
        setFamilyMembers(members.filter((m) => m.id !== user.id));
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefreshSubscription = async () => {
    try {
      setRefreshing(true);
      await refreshCustomerInfo();
      Alert.alert(
        isRTL ? "نجح" : "Success",
        isRTL ? "تم تحديث حالة الاشتراك" : "Subscription status updated"
      );
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل تحديث حالة الاشتراك" : "Failed to refresh subscription status"
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      setRefreshing(true);
      await restorePurchases();
      Alert.alert(
        t("restoreSuccess"),
        t("restoreSuccessMessage")
      );
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل استعادة المشتريات" : "Failed to restore purchases"
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleMemberPress = (member: UserType) => {
    setSelectedMember(member);
    setShowMemberModal(true);
  };

  const handleRemoveMember = async () => {
    if (!selectedMember || !user?.familyId || !user?.id) return;

    Alert.alert(
      t("confirmRemoval"),
      isRTL
        ? `هل أنت متأكد من إزالة ${selectedMember.firstName} من العائلة؟`
        : `Are you sure you want to remove ${selectedMember.firstName} from the family?`,
      [
        {
          text: t("cancel"),
          style: "cancel",
        },
        {
          text: isRTL ? "إزالة" : "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setRemovingMember(true);
              
              // Use the dedicated removeFamilyMember method
              await userService.removeFamilyMember(
                selectedMember.id,
                user.familyId!,
                user.id
              );
              
              // Reload family members
              await loadData(true);
              setShowMemberModal(false);
              setSelectedMember(null);
              
              Alert.alert(
                t("success"),
                t("memberRemoved")
              );
            } catch (error: any) {
              const errorMessage = error?.message || String(error);
              console.error("Error removing member:", errorMessage);
              Alert.alert(
                t("error"),
                isRTL 
                  ? `فشل إزالة العضو: ${errorMessage}` 
                  : `Failed to remove member: ${errorMessage}`
              );
            } finally {
              setRemovingMember(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (date: Date | null) => {
    if (!date) return isRTL ? "غير محدد" : "Not specified";
    return date.toLocaleDateString(isRTL ? "ar" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getSubscriptionTypeLabel = () => {
    if (hasFamilyPlan) return t("familyPlan");
    if (hasIndividualPlan) return t("individualPlan");
    return t("subscriptionInactive");
  };

  const getSubscriptionPeriodLabel = () => {
    if (!subscriptionStatus.subscriptionPeriod) return "";
    return subscriptionStatus.subscriptionPeriod === "yearly"
      ? t("yearly")
      : t("monthly");
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
    },
    header: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#1E293B" : "#E2E8F0",
      backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
    },
    backButton: {
      padding: 8,
      marginEnd: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: isDark ? "#F1F5F9" : "#1E293B",
      flex: 1,
      textAlign: isRTL ? "right" : "left",
    },
    content: {
      flex: 1,
    },
    section: {
      backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 16,
      padding: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionHeader: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      marginBottom: 16,
    },
    sectionIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginEnd: isRTL ? 0 : 12,
      marginStart: isRTL ? 12 : 0,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: isDark ? "#F1F5F9" : "#1E293B",
      flex: 1,
      textAlign: isRTL ? "right" : "left",
    },
    subscriptionBadge: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
    },
    subscriptionBadgeText: {
      fontSize: 12,
      fontWeight: "600",
    },
    infoRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#334155" : "#E2E8F0",
    },
    infoRowLast: {
      borderBottomWidth: 0,
    },
    infoLabel: {
      fontSize: 14,
      color: isDark ? "#94A3B8" : "#64748B",
      textAlign: isRTL ? "right" : "left",
    },
    infoValue: {
      fontSize: 14,
      fontWeight: "600",
      color: isDark ? "#F1F5F9" : "#1E293B",
      textAlign: isRTL ? "left" : "right",
    },
    planLimitsContainer: {
      backgroundColor: isDark ? "#0F172A" : "#F1F5F9",
      borderRadius: 12,
      padding: 12,
      marginTop: 12,
    },
    planLimitRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
    },
    planLimitLabel: {
      fontSize: 14,
      color: isDark ? "#94A3B8" : "#64748B",
    },
    planLimitValue: {
      fontSize: 14,
      fontWeight: "600",
      color: isDark ? "#F1F5F9" : "#1E293B",
    },
    actionButton: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginTop: 12,
      gap: 8,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: "600",
    },
    memberItem: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#334155" : "#E2E8F0",
    },
    memberItemLast: {
      borderBottomWidth: 0,
    },
    memberAvatar: {
      marginEnd: isRTL ? 0 : 12,
      marginStart: isRTL ? 12 : 0,
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 16,
      fontWeight: "600",
      color: isDark ? "#F1F5F9" : "#1E293B",
      textAlign: isRTL ? "right" : "left",
    },
    memberRole: {
      fontSize: 12,
      color: isDark ? "#94A3B8" : "#64748B",
      marginTop: 2,
      textAlign: isRTL ? "right" : "left",
    },
    memberChevron: {
      opacity: 0.5,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 24,
    },
    emptyText: {
      fontSize: 14,
      color: isDark ? "#94A3B8" : "#64748B",
      marginTop: 8,
      textAlign: "center",
    },
    memberCount: {
      fontSize: 12,
      color: isDark ? "#94A3B8" : "#64748B",
      marginTop: 4,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      maxHeight: "70%",
    },
    modalHeader: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: isDark ? "#F1F5F9" : "#1E293B",
    },
    modalCloseButton: {
      padding: 8,
    },
    modalMemberInfo: {
      alignItems: "center",
      marginBottom: 24,
    },
    modalMemberName: {
      fontSize: 18,
      fontWeight: "600",
      color: isDark ? "#F1F5F9" : "#1E293B",
      marginTop: 12,
    },
    modalMemberEmail: {
      fontSize: 14,
      color: isDark ? "#94A3B8" : "#64748B",
      marginTop: 4,
    },
    modalMemberRole: {
      fontSize: 12,
      color: theme.colors.primary.main,
      marginTop: 4,
      textTransform: "capitalize",
    },
    modalActions: {
      gap: 12,
    },
    removeButton: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: isDark ? "#7F1D1D" : "#FEE2E2",
      gap: 8,
    },
    removeButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: isDark ? "#FCA5A5" : "#DC2626",
    },
  });

  if (loading || subscriptionLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft color={isDark ? "#F1F5F9" : "#1E293B"} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t("adminSettings")}
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color={isDark ? "#F1F5F9" : "#1E293B"} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("adminSettings")}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Subscription Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIcon,
                { backgroundColor: theme.colors.primary.main + "20" },
              ]}
            >
              <CreditCard color={theme.colors.primary.main} size={20} />
            </View>
            <Text style={styles.sectionTitle}>{t("subscription")}</Text>
            <View
              style={[
                styles.subscriptionBadge,
                {
                  backgroundColor: hasActiveSubscription
                    ? theme.colors.accent.success + "20"
                    : theme.colors.accent.warning + "20",
                },
              ]}
            >
              {hasActiveSubscription ? (
                <Crown
                  color={theme.colors.accent.success}
                  size={14}
                />
              ) : (
                <AlertTriangle
                  color={theme.colors.accent.warning}
                  size={14}
                />
              )}
              <Text
                style={[
                  styles.subscriptionBadgeText,
                  {
                    color: hasActiveSubscription
                      ? theme.colors.accent.success
                      : theme.colors.accent.warning,
                  },
                ]}
              >
                {hasActiveSubscription ? t("active") : t("inactive")}
              </Text>
            </View>
          </View>

          {/* Subscription Info */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t("planType")}
            </Text>
            <Text style={styles.infoValue}>{getSubscriptionTypeLabel()}</Text>
          </View>

          {hasActiveSubscription && (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t("billingPeriod")}
                </Text>
                <Text style={styles.infoValue}>
                  {getSubscriptionPeriodLabel()}
                </Text>
              </View>

              <View style={[styles.infoRow, styles.infoRowLast]}>
                <Text style={styles.infoLabel}>
                  {t("expirationDate")}
                </Text>
                <Text style={styles.infoValue}>
                  {formatDate(subscriptionStatus.expirationDate)}
                </Text>
              </View>

              {/* Plan Limits */}
              <View style={styles.planLimitsContainer}>
                <Text
                  style={[
                    styles.infoLabel,
                    { marginBottom: 8, fontWeight: "600" },
                  ]}
                >
                  {t("planLimits")}
                </Text>
                <View style={styles.planLimitRow}>
                  <Text style={styles.planLimitLabel}>
                    {t("maxFamilyMembers")}
                  </Text>
                  <Text style={styles.planLimitValue}>
                    {familyMembers.length} / {maxFamilyMembers}
                  </Text>
                </View>
                <View style={styles.planLimitRow}>
                  <Text style={styles.planLimitLabel}>
                    {t("maxTotalMembers")}
                  </Text>
                  <Text style={styles.planLimitValue}>
                    {familyMembers.length + 1} / {maxTotalMembers}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Actions */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: theme.colors.primary.main + "15" },
            ]}
            onPress={handleRefreshSubscription}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={theme.colors.primary.main} />
            ) : (
              <RefreshCcw color={theme.colors.primary.main} size={18} />
            )}
            <Text
              style={[
                styles.actionButtonText,
                { color: theme.colors.primary.main },
              ]}
            >
              {t("refreshStatus")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: isDark ? "#334155" : "#E2E8F0" },
            ]}
            onPress={handleRestorePurchases}
            disabled={refreshing}
          >
            <CreditCard color={isDark ? "#94A3B8" : "#64748B"} size={18} />
            <Text
              style={[
                styles.actionButtonText,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              {t("restorePurchases")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Family Members Section */}
        <View style={[styles.section, { marginBottom: 32 }]}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIcon,
                { backgroundColor: theme.colors.secondary.main + "20" },
              ]}
            >
              <Users color={theme.colors.secondary.main} size={20} />
            </View>
            <Text style={styles.sectionTitle}>
              {t("linkedFamilyMembers")}
            </Text>
          </View>

          {familyMembers.length > 0 ? (
            <>
              <Text style={styles.memberCount}>
                {isRTL
                  ? `${familyMembers.length} عضو مرتبط`
                  : `${familyMembers.length} member${familyMembers.length > 1 ? "s" : ""} linked`}
              </Text>
              {familyMembers.map((member, index) => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.memberItem,
                    index === familyMembers.length - 1 && styles.memberItemLast,
                  ]}
                  onPress={() => handleMemberPress(member)}
                >
                  <View style={styles.memberAvatar}>
                    <Avatar
                      avatarType={member.avatarType}
                      name={member.firstName}
                      size="md"
                    />
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {member.firstName} {member.lastName}
                    </Text>
                    <Text style={styles.memberRole}>
                      {member.role === "caregiver"
                        ? t("caregiver")
                        : t("member")}
                    </Text>
                  </View>
                  <ChevronRight
                    color={isDark ? "#64748B" : "#94A3B8"}
                    size={20}
                    style={[
                      styles.memberChevron,
                      isRTL && { transform: [{ rotate: "180deg" }] },
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Users color={isDark ? "#475569" : "#CBD5E1"} size={48} />
              <Text style={styles.emptyText}>
                {t("noFamilyMembersLinked")}{"\n"}{t("inviteFromFamilyTab")}
              </Text>
            </View>
          )}

          {/* Invite more members button */}
          {hasActiveSubscription && familyMembers.length < maxFamilyMembers && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: theme.colors.secondary.main + "15" },
              ]}
              onPress={() => router.push("/(tabs)/family")}
            >
              <Users color={theme.colors.secondary.main} size={18} />
              <Text
                style={[
                  styles.actionButtonText,
                  { color: theme.colors.secondary.main },
                ]}
              >
                {t("inviteFamilyMembers")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Member Details Modal */}
      <Modal
        visible={showMemberModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMemberModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowMemberModal(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t("memberDetails")}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowMemberModal(false)}
              >
                <X color={isDark ? "#94A3B8" : "#64748B"} size={24} />
              </TouchableOpacity>
            </View>

            {selectedMember && (
              <>
                <View style={styles.modalMemberInfo}>
                  <Avatar
                    avatarType={selectedMember.avatarType}
                    name={selectedMember.firstName}
                    size="xl"
                  />
                  <Text style={styles.modalMemberName}>
                    {selectedMember.firstName} {selectedMember.lastName}
                  </Text>
                  {selectedMember.email && (
                    <Text style={styles.modalMemberEmail}>
                      {selectedMember.email}
                    </Text>
                  )}
                  <Text style={styles.modalMemberRole}>
                    {selectedMember.role === "caregiver"
                      ? t("caregiver")
                      : t("member")}
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={handleRemoveMember}
                    disabled={removingMember}
                  >
                    {removingMember ? (
                      <ActivityIndicator
                        size="small"
                        color={isDark ? "#FCA5A5" : "#DC2626"}
                      />
                    ) : (
                      <Trash2
                        color={isDark ? "#FCA5A5" : "#DC2626"}
                        size={20}
                      />
                    )}
                    <Text style={styles.removeButtonText}>
                      {t("removeFromFamily")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

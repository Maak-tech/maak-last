import { useNavigation, useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  CreditCard,
  Crown,
  RefreshCcw,
  Trash2,
  Users,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Avatar from "@/components/Avatar";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useRevenueCat } from "@/hooks/useRevenueCat";
import { useSubscription } from "@/hooks/useSubscription";
import { userService } from "@/lib/services/userService";
import type { User as UserType } from "@/types";
import { safeFormatDate } from "@/utils/dateFormat";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This admin screen intentionally combines subscription, family-member management, and modal workflows.
export default function AdminSettingsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const {
    subscriptionStatus,
    hasActiveSubscription,
    hasFamilyPlan,
    refreshCustomerInfo,
    restorePurchases,
    isLoading: subscriptionLoading,
  } = useRevenueCat();
  const { maxFamilyMembers, maxTotalMembers } = useSubscription();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<UserType[]>([]);
  const [selectedMember, setSelectedMember] = useState<UserType | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);

  const isRTL = i18n.language === "ar";

  // Hide the default header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) {
        return;
      }

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
      } catch (_error) {
        // Silently handle error
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.familyId, user?.id]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefreshSubscription = async () => {
    try {
      setRefreshing(true);
      await refreshCustomerInfo();
      Alert.alert(
        isRTL ? "نجح" : "Success",
        isRTL ? "تم تحديث حالة الاشتراك" : "Subscription status updated"
      );
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "فشل تحديث حالة الاشتراك"
          : "Failed to refresh subscription status"
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      setRefreshing(true);
      await restorePurchases();
      Alert.alert(t("restoreSuccess"), t("restoreSuccessMessage"));
    } catch (_error) {
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

  const handleRemoveMember = () => {
    if (!(selectedMember && user?.familyId && user?.id)) {
      return;
    }

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
            const familyId = user.familyId;
            if (!familyId) {
              return;
            }
            try {
              setRemovingMember(true);

              // Use the dedicated removeFamilyMember method
              await userService.removeFamilyMember(
                selectedMember.id,
                familyId,
                user.id
              );

              // Reload family members
              await loadData(true);
              setShowMemberModal(false);
              setSelectedMember(null);

              Alert.alert(t("success"), t("memberRemoved"));
            } catch (error: unknown) {
              const errorMessage = getErrorMessage(error, String(error));
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
    if (!date) {
      return isRTL ? "غير محدد" : "Not specified";
    }
    return safeFormatDate(date, isRTL ? "ar-u-ca-gregory" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getSubscriptionTypeLabel = () => {
    if (hasFamilyPlan) {
      return t("familyPlan");
    }
    return t("subscriptionInactive");
  };

  const getSubscriptionPeriodLabel = () => {
    if (!subscriptionStatus.subscriptionPeriod) {
      return "";
    }
    return subscriptionStatus.subscriptionPeriod === "yearly"
      ? t("yearly")
      : t("monthly");
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "transparent",
    },
    headerWrapper: {
      marginHorizontal: -24,
      marginBottom: -20,
    },
    headerContent: {
      paddingHorizontal: 24,
      paddingTop: 130,
      paddingBottom: 16,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 50,
    },
    headerRowRTL: {
      flexDirection: "row-reverse",
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "rgba(0, 53, 67, 0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
    },
    headerTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    headerTitleText: {
      fontSize: 22,
      fontFamily: "Inter-Bold",
      color: "#003543",
    },
    headerSubtitle: {
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: "rgba(0, 53, 67, 0.85)",
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 40,
      paddingBottom: 40,
    },
    rtlText: {
      textAlign: "right",
    },
    section: {
      backgroundColor: "#FFFFFF",
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
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
      fontFamily: "Inter-Bold",
      color: "#1A1D1F",
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
      fontFamily: "Inter-SemiBold",
    },
    infoRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: "#E5E7EB",
    },
    infoRowLast: {
      borderBottomWidth: 0,
    },
    infoLabel: {
      fontSize: 14,
      fontFamily: "Inter-Regular",
      color: "#64748B",
      textAlign: isRTL ? "right" : "left",
    },
    infoValue: {
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
      color: "#1A1D1F",
      textAlign: isRTL ? "left" : "right",
    },
    planLimitsContainer: {
      backgroundColor: "#F8FAFC",
      borderRadius: 12,
      padding: 16,
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
      fontFamily: "Inter-Regular",
      color: "#64748B",
    },
    planLimitValue: {
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
      color: "#1A1D1F",
    },
    actionButton: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginTop: 12,
      gap: 8,
    },
    actionButtonText: {
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
    },
    memberItem: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: "#E5E7EB",
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
      fontFamily: "Inter-SemiBold",
      color: "#1A1D1F",
      textAlign: isRTL ? "right" : "left",
    },
    memberRole: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: "#64748B",
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
      fontFamily: "Inter-Regular",
      color: "#64748B",
      marginTop: 8,
      textAlign: "center",
    },
    memberCount: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: "#64748B",
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
      backgroundColor: "#FFFFFF",
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
      fontFamily: "Inter-Bold",
      color: "#1A1D1F",
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
      fontFamily: "Inter-SemiBold",
      color: "#1A1D1F",
      marginTop: 12,
    },
    modalMemberEmail: {
      fontSize: 14,
      fontFamily: "Inter-Regular",
      color: "#64748B",
      marginTop: 4,
    },
    modalMemberRole: {
      fontSize: 12,
      fontFamily: "Inter-SemiBold",
      color: "#003543",
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
      backgroundColor: "#FEE2E2",
      gap: 8,
    },
    removeButtonText: {
      fontSize: 16,
      fontFamily: "Inter-SemiBold",
      color: "#DC2626",
    },
  });

  if (loading || subscriptionLoading) {
    return (
      <GradientScreen edges={["top"]} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#003543" size="large" />
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen edges={["top"]} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <View style={styles.headerWrapper}>
          <WavyBackground
            contentPosition="top"
            curve="home"
            height={280}
            variant="teal"
          >
            <View style={styles.headerContent}>
              <View style={[styles.headerRow, isRTL && styles.headerRowRTL]}>
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
                <View style={styles.headerTitle}>
                  <View
                    style={[
                      styles.headerTitleRow,
                      isRTL && styles.headerRowRTL,
                    ]}
                  >
                    <CreditCard color="#EB9C0C" size={20} />
                    <Text style={styles.headerTitleText}>
                      {t("adminSettings")}
                    </Text>
                  </View>
                  <Text
                    style={[styles.headerSubtitle, isRTL && styles.rtlText]}
                  >
                    {isRTL
                      ? "إدارة الاشتراك وأعضاء العائلة"
                      : "Manage subscription and family members"}
                  </Text>
                </View>
              </View>
            </View>
          </WavyBackground>
        </View>
        {/* Subscription Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIcon,
                { backgroundColor: "rgba(0, 53, 67, 0.15)" },
              ]}
            >
              <CreditCard color="#003543" size={20} />
            </View>
            <Text style={styles.sectionTitle}>{t("subscription")}</Text>
            <View
              style={[
                styles.subscriptionBadge,
                {
                  backgroundColor: hasActiveSubscription
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(245, 158, 11, 0.15)",
                },
              ]}
            >
              {hasActiveSubscription ? (
                <Crown color="#10B981" size={14} />
              ) : (
                <AlertTriangle color="#F59E0B" size={14} />
              )}
              <Text
                style={[
                  styles.subscriptionBadgeText,
                  {
                    color: hasActiveSubscription ? "#10B981" : "#F59E0B",
                  },
                ]}
              >
                {hasActiveSubscription ? t("active") : t("inactive")}
              </Text>
            </View>
          </View>

          {/* Subscription Info */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("planType")}</Text>
            <Text style={styles.infoValue}>{getSubscriptionTypeLabel()}</Text>
          </View>

          {hasActiveSubscription ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t("billingPeriod")}</Text>
                <Text style={styles.infoValue}>
                  {getSubscriptionPeriodLabel()}
                </Text>
              </View>

              <View style={[styles.infoRow, styles.infoRowLast]}>
                <Text style={styles.infoLabel}>{t("expirationDate")}</Text>
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
          ) : null}

          {/* Actions */}
          <TouchableOpacity
            disabled={refreshing}
            onPress={handleRefreshSubscription}
            style={[
              styles.actionButton,
              { backgroundColor: "rgba(0, 53, 67, 0.1)" },
            ]}
          >
            {refreshing ? (
              <ActivityIndicator color="#003543" size="small" />
            ) : (
              <RefreshCcw color="#003543" size={18} />
            )}
            <Text style={[styles.actionButtonText, { color: "#003543" }]}>
              {t("refreshStatus")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={refreshing}
            onPress={handleRestorePurchases}
            style={[styles.actionButton, { backgroundColor: "#F1F5F9" }]}
          >
            <CreditCard color="#64748B" size={18} />
            <Text style={[styles.actionButtonText, { color: "#64748B" }]}>
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
                { backgroundColor: "rgba(235, 156, 12, 0.15)" },
              ]}
            >
              <Users color="#EB9C0C" size={20} />
            </View>
            <Text style={styles.sectionTitle}>{t("linkedFamilyMembers")}</Text>
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
                  onPress={() => handleMemberPress(member)}
                  style={[
                    styles.memberItem,
                    index === familyMembers.length - 1 && styles.memberItemLast,
                  ]}
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
                    color="#94A3B8"
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
              <Users color="#CBD5E1" size={48} />
              <Text style={styles.emptyText}>
                {t("noFamilyMembersLinked")}
                {"\n"}
                {t("inviteFromFamilyTab")}
              </Text>
            </View>
          )}

          {/* Invite more members button */}
          {hasActiveSubscription && familyMembers.length < maxFamilyMembers ? (
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/family")}
              style={[
                styles.actionButton,
                { backgroundColor: "rgba(235, 156, 12, 0.1)" },
              ]}
            >
              <Users color="#EB9C0C" size={18} />
              <Text style={[styles.actionButtonText, { color: "#EB9C0C" }]}>
                {t("inviteFamilyMembers")}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      {/* Member Details Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowMemberModal(false)}
        transparent
        visible={showMemberModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowMemberModal(false)}
            style={{ flex: 1 }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("memberDetails")}</Text>
              <TouchableOpacity
                onPress={() => setShowMemberModal(false)}
                style={styles.modalCloseButton}
              >
                <X color="#64748B" size={24} />
              </TouchableOpacity>
            </View>

            {selectedMember ? (
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
                  {selectedMember.email ? (
                    <Text style={styles.modalMemberEmail}>
                      {selectedMember.email}
                    </Text>
                  ) : null}
                  <Text style={styles.modalMemberRole}>
                    {selectedMember.role === "caregiver"
                      ? t("caregiver")
                      : t("member")}
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    disabled={removingMember}
                    onPress={handleRemoveMember}
                    style={styles.removeButton}
                  >
                    {removingMember ? (
                      <ActivityIndicator color="#DC2626" size="small" />
                    ) : (
                      <Trash2 color="#DC2626" size={20} />
                    )}
                    <Text style={styles.removeButtonText}>
                      {t("removeFromFamily")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </GradientScreen>
  );
}

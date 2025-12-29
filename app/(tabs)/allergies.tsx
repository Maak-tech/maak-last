import { useFocusEffect } from "expo-router";
import { AlertTriangle, Edit, MoreVertical, Plus, Trash2, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { allergyService } from "@/lib/services/allergyService";
import type { Allergy } from "@/types";
// Design System Components
import { Button, Card, Input } from "@/components/design-system";
import { Heading, Text, Caption } from "@/components/design-system/Typography";
import { Badge } from "@/components/design-system/AdditionalComponents";

const COMMON_ALLERGIES = [
  "Peanuts",
  "Tree Nuts",
  "Milk",
  "Eggs",
  "Fish",
  "Shellfish",
  "Soy",
  "Wheat",
  "Pollen",
  "Dust Mites",
  "Pet Dander",
  "Mold",
  "Latex",
  "Penicillin",
  "Aspirin",
  "Bee Stings",
  "Sesame",
  "Sulfites",
];

const SEVERITY_OPTIONS = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
  { value: "severe-life-threatening", label: "Severe (Life-threatening)" },
];

export default function AllergiesScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAllergy, setSelectedAllergy] = useState("");
  const [customAllergy, setCustomAllergy] = useState("");
  const [severity, setSeverity] = useState<"mild" | "moderate" | "severe" | "severe-life-threatening">("mild");
  const [reaction, setReaction] = useState("");
  const [notes, setNotes] = useState("");
  const [discoveredDate, setDiscoveredDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [editingAllergy, setEditingAllergy] = useState<Allergy | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);

  const isRTL = i18n.language === "ar";

  const loadAllergies = useCallback(async (isRefresh = false) => {
    if (!user) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const userAllergies = await allergyService.getUserAllergies(user.id, 50);
      setAllergies(userAllergies);
    } catch (error) {
      Alert.alert(
        t("error"),
        t("errorLoadingData")
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, t]);

  useFocusEffect(
    useCallback(() => {
      loadAllergies();
    }, [loadAllergies])
  );

  useEffect(() => {
    loadAllergies();
  }, [loadAllergies]);

  const handleAddAllergy = async () => {
    if (!user) return;

    const allergyName = selectedAllergy || customAllergy;
    if (!allergyName.trim()) {
      Alert.alert(
        t("error"),
        t("pleaseEnterAllergyName")
      );
      return;
    }

    try {
      setLoading(true);

      if (editingAllergy) {
        await allergyService.updateAllergy(editingAllergy.id, {
          name: allergyName,
          severity,
          reaction: reaction.trim() || undefined,
          notes: notes.trim() || undefined,
          discoveredDate,
          timestamp: editingAllergy.timestamp,
          userId: user.id,
        });
      } else {
        await allergyService.addAllergy({
          userId: user.id,
          name: allergyName,
          severity,
          reaction: reaction.trim() || undefined,
          notes: notes.trim() || undefined,
          discoveredDate,
          timestamp: new Date(),
        });
      }

      setShowAddModal(false);
      resetForm();
      loadAllergies();
    } catch (error) {
      Alert.alert(
        t("error"),
        t("errorSavingData")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditAllergy = (allergy: Allergy) => {
    setEditingAllergy(allergy);
    setSelectedAllergy("");
    setCustomAllergy(allergy.name);
    setSeverity(allergy.severity);
    setReaction(allergy.reaction || "");
    setNotes(allergy.notes || "");
    // Safely convert discoveredDate to Date object
    let discoveredDate: Date;
    if (allergy.discoveredDate) {
      if (allergy.discoveredDate instanceof Date) {
        discoveredDate = allergy.discoveredDate;
      } else {
        // Handle potential Firestore Timestamp or other date formats
        const dateValue = allergy.discoveredDate as any;
        if (dateValue?.toDate && typeof dateValue.toDate === "function") {
          discoveredDate = dateValue.toDate();
        } else {
          discoveredDate = new Date(dateValue);
        }
      }
    } else {
      const timestampValue = allergy.timestamp as any;
      if (timestampValue instanceof Date) {
        discoveredDate = timestampValue;
      } else if (timestampValue?.toDate && typeof timestampValue.toDate === "function") {
        discoveredDate = timestampValue.toDate();
      } else {
        discoveredDate = new Date(timestampValue);
      }
    }
    setDiscoveredDate(discoveredDate);
    setShowActionsMenu(null);
    setShowAddModal(true);
  };

  const handleDeleteAllergy = async (allergyId: string) => {
    Alert.alert(
      t("confirmDelete"),
      t("confirmDeleteAllergy"),
      [
        {
          text: t("cancel"),
          style: "cancel",
        },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await allergyService.deleteAllergy(allergyId);
              loadAllergies();
            } catch (error) {
              Alert.alert(
                t("error"),
                t("errorDeletingData")
              );
            }
          },
        },
      ]
    );
    setShowActionsMenu(null);
  };

  const resetForm = () => {
    setEditingAllergy(null);
    setSelectedAllergy("");
    setCustomAllergy("");
    setSeverity("mild");
    setReaction("");
    setNotes("");
    setDiscoveredDate(new Date());
  };

  const formatDate = (date: Date | undefined | any) => {
    if (!date) return "";
    try {
      // Handle Firestore Timestamp objects
      let dateObj: Date;
      if (date?.toDate && typeof date.toDate === "function") {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        dateObj = new Date(date);
      }
      if (isNaN(dateObj.getTime())) return "";
      return dateObj.toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "mild":
        return theme.colors.accent.success;
      case "moderate":
        return theme.colors.accent.warning;
      case "severe":
        return theme.colors.accent.error;
      case "severe-life-threatening":
        return "#DC2626";
      default:
        return theme.colors.text.secondary;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.base,
      backgroundColor: theme.colors.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    title: {
      color: theme.colors.text.primary,
    },
    addButton: {
      backgroundColor: theme.colors.primary.main,
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    content: {
      flex: 1,
    },
    contentInner: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
    },
    statsSection: {
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.base,
    },
    sectionTitle: {
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.md,
    },
    statsGrid: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },
    statCard: {
      flex: 1,
      padding: theme.spacing.lg,
      alignItems: "center",
    },
    statValue: {
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs,
    },
    statLabel: {
      color: theme.colors.text.secondary,
      textAlign: "center",
    },
    allergiesSection: {
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
    allergyCard: {
      marginBottom: theme.spacing.md,
      padding: theme.spacing.lg,
    },
    allergyHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: theme.spacing.sm,
    },
    allergyInfo: {
      flex: 1,
    },
    allergyName: {
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs,
    },
    allergyMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      flexWrap: "wrap",
    },
    allergyDate: {
      color: theme.colors.text.secondary,
    },
    severityBadge: {
      marginEnd: theme.spacing.sm,
    },
    allergyActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    actionsButton: {
      padding: theme.spacing.xs,
    },
    actionsMenu: {
      position: "absolute",
      right: 0,
      top: 30,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.xs,
      minWidth: 120,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      zIndex: 1000,
    },
    actionItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    actionText: {
      color: theme.colors.text.primary,
    },
    actionTextDanger: {
      color: theme.colors.accent.error,
    },
    allergyDetails: {
      marginTop: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.light,
    },
    allergyDetailText: {
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.xs,
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: theme.spacing.xl,
    },
    loadingText: {
      color: theme.colors.text.secondary,
    },
    emptyContainer: {
      paddingVertical: theme.spacing.xl,
      alignItems: "center",
    },
    emptyText: {
      color: theme.colors.text.secondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.colors.background.secondary,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      maxHeight: "90%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.lg,
    },
    modalTitle: {
      color: theme.colors.text.primary,
    },
    closeButton: {
      padding: theme.spacing.xs,
    },
    fieldGroup: {
      marginBottom: theme.spacing.lg,
    },
    fieldLabel: {
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
      fontWeight: "600",
    },
    rtlTextInput: {
      fontFamily: "Geist-Regular",
    },
    allergyOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    allergyOption: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      backgroundColor: theme.colors.background.primary,
    },
    allergyOptionSelected: {
      backgroundColor: theme.colors.primary.main,
      borderColor: theme.colors.primary.main,
    },
    allergyOptionText: {
      color: theme.colors.text.primary,
    },
    allergyOptionTextSelected: {
      color: theme.colors.neutral.white,
    },
    severityContainer: {
      marginBottom: theme.spacing.lg,
    },
    severityButtons: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    severityButton: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      backgroundColor: theme.colors.background.primary,
      alignItems: "center",
    },
    severityButtonActive: {
      backgroundColor: theme.colors.primary.main,
      borderColor: theme.colors.primary.main,
    },
    severityButtonText: {
      color: theme.colors.text.primary,
    },
    severityButtonTextActive: {
      color: theme.colors.neutral.white,
    },
    rtlText: {
      textAlign: "right",
    },
  });

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text color="#EF4444" style={{}}>Please log in to track allergies</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Heading level={4} style={[styles.title, isRTL && styles.rtlText]}>
          {t("allergies")}
        </Heading>
        <TouchableOpacity
          onPress={() => {
            resetForm();
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
            onRefresh={() => loadAllergies(true)}
            refreshing={refreshing}
            tintColor={theme.colors.primary.main}
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Heading level={5} style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t("statistics")}
          </Heading>
          <View style={styles.statsGrid}>
            <Card variant="elevated" style={styles.statCard} onPress={undefined} contentStyle={undefined}>
              <Text weight="bold" size="large" style={[styles.statValue, isRTL && styles.rtlText]}>
                {allergies.length}
              </Text>
              <Caption style={[styles.statLabel, isRTL && styles.rtlText]} numberOfLines={undefined}>
                {t("totalAllergies")}
              </Caption>
            </Card>
            <Card variant="elevated" style={styles.statCard} onPress={undefined} contentStyle={undefined}>
              <Text weight="bold" size="large" style={[styles.statValue, isRTL && styles.rtlText]}>
                {allergies.filter((a) => a.severity === "severe" || a.severity === "severe-life-threatening").length}
              </Text>
              <Caption style={[styles.statLabel, isRTL && styles.rtlText]} numberOfLines={undefined}>
                {t("severeAllergies")}
              </Caption>
            </Card>
          </View>
        </View>

        {/* Allergies List */}
        <View style={styles.allergiesSection}>
          <Heading level={5} style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t("myAllergies")}
          </Heading>

          {loading ? (
            <View style={styles.centerContainer}>
              <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
                {t("loading")}
              </Text>
            </View>
          ) : allergies.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                {t("noAllergiesRecorded")}
              </Text>
            </View>
          ) : (
            allergies.map((allergy) => (
              <Card key={allergy.id} variant="elevated" style={styles.allergyCard} onPress={undefined} contentStyle={undefined}>
                <View style={styles.allergyHeader}>
                  <View style={styles.allergyInfo}>
                    <Text weight="semibold" size="large" style={[styles.allergyName, isRTL && styles.rtlText]}>
                      {allergy.name}
                    </Text>
                    <View style={styles.allergyMeta}>
                      <Caption style={[styles.allergyDate, isRTL && styles.rtlText]} numberOfLines={undefined}>
                        {formatDate(allergy.discoveredDate || allergy.timestamp)}
                      </Caption>
                      <Badge
                        variant={allergy.severity === "mild" ? "success" : allergy.severity === "moderate" ? "warning" : "error"}
                        size="small"
                        style={[
                          styles.severityBadge,
                          { backgroundColor: getSeverityColor(allergy.severity) },
                        ]}
                      >
                        {SEVERITY_OPTIONS.find((opt) => opt.value === allergy.severity)?.label || allergy.severity}
                      </Badge>
                    </View>
                  </View>
                  <View style={styles.allergyActions}>
                    <TouchableOpacity
                      onPress={() =>
                        setShowActionsMenu(
                          showActionsMenu === allergy.id ? null : allergy.id
                        )
                      }
                      style={styles.actionsButton}
                    >
                      <MoreVertical color={theme.colors.text.secondary} size={16} />
                    </TouchableOpacity>
                    {showActionsMenu === allergy.id && (
                      <View style={styles.actionsMenu}>
                        <TouchableOpacity
                          onPress={() => handleEditAllergy(allergy)}
                          style={styles.actionItem}
                        >
                          <Edit color={theme.colors.text.primary} size={16} />
                          <Text style={styles.actionText}>
                            {t("edit")}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteAllergy(allergy.id)}
                          style={styles.actionItem}
                        >
                          <Trash2 color={theme.colors.accent.error} size={16} />
                          <Text style={styles.actionTextDanger}>
                            {t("delete")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
                {(allergy.reaction || allergy.notes) && (
                  <View style={styles.allergyDetails}>
                    {allergy.reaction && (
                      <Text style={[styles.allergyDetailText, isRTL && styles.rtlText]}>
                        <Text weight="semibold" style={{}}>{t("reaction")}: </Text>
                        {allergy.reaction}
                      </Text>
                    )}
                    {allergy.notes && (
                      <Text style={[styles.allergyDetailText, isRTL && styles.rtlText]}>
                        <Text weight="semibold" style={{}}>{t("notes")}: </Text>
                        {allergy.notes}
                      </Text>
                    )}
                  </View>
                )}
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Heading level={4} style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {editingAllergy ? t("editAllergy") : t("addAllergy")}
              </Heading>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                style={styles.closeButton}
              >
                <X color={theme.colors.text.secondary} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t("allergyName")}
              </Text>
              <View style={styles.allergyOptions}>
                {COMMON_ALLERGIES.map((allergy) => (
                  <TouchableOpacity
                    key={allergy}
                    onPress={() => {
                      setSelectedAllergy(allergy);
                      setCustomAllergy("");
                    }}
                    style={[
                      styles.allergyOption,
                      selectedAllergy === allergy && styles.allergyOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.allergyOptionText,
                        selectedAllergy === allergy && styles.allergyOptionTextSelected,
                      ]}
                    >
                      {allergy}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.fieldGroup}>
                <Input
                  label={t("customAllergy")}
                  placeholder={t("orEnterCustomAllergy")}
                  value={customAllergy}
                  onChangeText={(text: string) => {
                    setCustomAllergy(text);
                    if (text) setSelectedAllergy("");
                  }}
                  textAlign={isRTL ? "right" : "left"}
                  style={isRTL && styles.rtlTextInput}
                  error={undefined}
                  helperText={undefined}
                  leftIcon={undefined}
                  rightIcon={undefined}
                />
              </View>

              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t("severity")}
              </Text>
              <View style={styles.severityButtons}>
                {SEVERITY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setSeverity(option.value as typeof severity)}
                    style={[
                      styles.severityButton,
                      severity === option.value && styles.severityButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.severityButtonText,
                        severity === option.value && styles.severityButtonTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.fieldGroup}>
                <Input
                  label={`${t("reaction")} (${t("optional")})`}
                  placeholder={t("reactionOptional")}
                  value={reaction}
                  onChangeText={setReaction}
                  multiline
                  numberOfLines={3}
                  textAlign={isRTL ? "right" : "left"}
                  style={isRTL && styles.rtlTextInput}
                  error={undefined}
                  helperText={undefined}
                  leftIcon={undefined}
                  rightIcon={undefined}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Input
                  label={`${t("notes")} (${t("optional")})`}
                  placeholder={t("notesOptional")}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlign={isRTL ? "right" : "left"}
                  style={isRTL && styles.rtlTextInput}
                  error={undefined}
                  helperText={undefined}
                  leftIcon={undefined}
                  rightIcon={undefined}
                />
              </View>

              <Button
                title={editingAllergy
                  ? isRTL
                    ? "حفظ التغييرات"
                    : "Save Changes"
                  : isRTL
                    ? "إضافة"
                    : "Add"}
                onPress={handleAddAllergy}
                loading={loading}
                style={{ marginTop: theme.spacing.lg }}
                textStyle={undefined}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}


import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Bug,
  Edit,
  Leaf,
  MoreVertical,
  Pill,
  Plus,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// Design System Components
import { Button, Card, Input } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { Caption, Heading, Text } from "@/components/design-system/Typography";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { allergyService } from "@/lib/services/allergyService";
import { userService } from "@/lib/services/userService";
import type { Allergy, User as UserType } from "@/types";
import { safeFormatDate } from "@/utils/dateFormat";

// Allergy keys mapping to translation keys
const ALLERGY_KEYS = [
  "allergyPeanuts",
  "allergyTreeNuts",
  "allergyMilk",
  "allergyEggs",
  "allergyFish",
  "allergyShellfish",
  "allergySoy",
  "allergyWheat",
  "allergyPollen",
  "allergyDustMites",
  "allergyPetDander",
  "allergyMold",
  "allergyLatex",
  "allergyPenicillin",
  "allergyAspirin",
  "allergyBeeStings",
  "allergySesame",
  "allergySulfites",
];

const SEVERITY_OPTIONS_KEYS = [
  { value: "mild", labelKey: "severityMild" },
  { value: "moderate", labelKey: "severityModerate" },
  { value: "severe", labelKey: "severitySevere" },
  {
    value: "severe-life-threatening",
    labelKey: "severitySevereLifeThreatening",
  },
];

type DateLike =
  | Date
  | string
  | number
  | { toDate?: () => Date }
  | null
  | undefined;

const coerceDate = (value: DateLike): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const converted = value.toDate();
    return Number.isNaN(converted.getTime()) ? null : converted;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

type AllergyCardProps = {
  allergy: Allergy;
  severityColors: Record<string, string>;
  isRTL: boolean;
  showActionsMenu: string | null;
  theme: ReturnType<typeof useTheme>["theme"];
  t: ReturnType<typeof useTranslation>["t"];
  styles: Record<string, any>;
  onEdit: (allergy: Allergy) => void;
  onDelete: (id: string) => void;
  onToggleActionsMenu: (id: string) => void;
  classifyAllergy: (name: string) => {
    type: string;
    icon: React.ComponentType<{ color: string; size: number }>;
  };
  getTranslatedAllergyName: (name: string) => string;
  getSeverityLabel: (severity: string) => string;
  getLocalizedAllergyType: (type: string) => string;
  getDiagnosedDateText: (date: Date | null) => string;
  coerceDate: (value: DateLike) => Date | null;
};

const AllergyCard: React.FC<AllergyCardProps> = ({
  allergy,
  severityColors,
  isRTL,
  showActionsMenu,
  theme,
  t,
  styles,
  onEdit,
  onDelete,
  onToggleActionsMenu,
  classifyAllergy,
  getTranslatedAllergyName,
  getSeverityLabel,
  getLocalizedAllergyType,
  getDiagnosedDateText,
  coerceDate,
}) => {
  const { type, icon: Icon } = classifyAllergy(allergy.name);
  const severityColor = severityColors[allergy.severity] || "#F59E0B";
  const diagnosedDate = coerceDate(allergy.discoveredDate || allergy.timestamp);

  return (
    <View style={styles.figmaAllergyCard}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onEdit(allergy)}
        style={styles.figmaAllergyCardHeader}
      >
        <View
          style={[
            styles.figmaAllergyIconWrap,
            { backgroundColor: `${severityColor}1A` },
          ]}
        >
          <Icon color={severityColor} size={20} />
        </View>
        <View style={styles.figmaAllergyCardInfo}>
          <View style={styles.figmaAllergyCardTitleRow}>
            <Text
              numberOfLines={2}
              style={[styles.figmaAllergyCardTitle, isRTL && styles.rtlText]}
            >
              {getTranslatedAllergyName(allergy.name)}
            </Text>
            <View
              style={[
                styles.figmaAllergySeverityBadge,
                { backgroundColor: `${severityColor}1A` },
              ]}
            >
              <Text
                style={[
                  styles.figmaAllergySeverityText,
                  { color: severityColor },
                ]}
              >
                {getSeverityLabel(allergy.severity)}
              </Text>
            </View>
          </View>
          <Text style={[styles.figmaAllergyTypeText, isRTL && styles.rtlText]}>
            {getLocalizedAllergyType(type)}
          </Text>
          <Text
            style={[styles.figmaAllergyReactionText, isRTL && styles.rtlText]}
          >
            <Text style={styles.figmaAllergyReactionLabel}>
              {isRTL ? "رد الفعل:" : "Reaction:"}
            </Text>{" "}
            {allergy.reaction || (isRTL ? "غير محدد" : "Not specified")}
          </Text>
          <Text
            style={[styles.figmaAllergyDiagnosedText, isRTL && styles.rtlText]}
          >
            {isRTL ? "التشخيص:" : "Diagnosed:"}{" "}
            {getDiagnosedDateText(diagnosedDate)}
          </Text>
        </View>
        <View style={styles.figmaAllergyCardActions}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onToggleActionsMenu(allergy.id);
            }}
            style={styles.figmaAllergyActionsButton}
          >
            <MoreVertical color="#6C7280" size={20} />
          </TouchableOpacity>
          {showActionsMenu === allergy.id && (
            <View style={styles.figmaAllergyActionsMenu}>
              <TouchableOpacity
                onPress={() => onEdit(allergy)}
                style={styles.figmaAllergyActionItem}
              >
                <Edit color={theme.colors.text.primary} size={16} />
                <Text style={styles.figmaAllergyActionText}>{t("edit")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDelete(allergy.id)}
                style={styles.figmaAllergyActionItem}
              >
                <Trash2 color={theme.colors.accent.error} size={16} />
                <Text style={styles.figmaAllergyActionTextDanger}>
                  {t("delete")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Legacy screen combines admin/family flows, modal editing, and localized rendering. */
export default function AllergiesScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAllergy, setSelectedAllergy] = useState("");
  const [customAllergy, setCustomAllergy] = useState("");
  const [severity, setSeverity] = useState<
    "mild" | "moderate" | "severe" | "severe-life-threatening"
  >("mild");
  const [reaction, setReaction] = useState("");
  const [notes, setNotes] = useState("");
  const [discoveredDate, setDiscoveredDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [editingAllergy, setEditingAllergy] = useState<Allergy | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<UserType[]>([]);
  const [selectedTargetUser, setSelectedTargetUser] = useState<string>("");
  const severityColors: Record<string, string> = {
    mild: "#FBBF24",
    moderate: "#F97316",
    severe: "#EF4444",
    "severe-life-threatening": "#DC2626",
  };
  const classifyAllergy = (name: string) => {
    const normalized = name.toLowerCase();
    if (
      normalized.includes("penicillin") ||
      normalized.includes("aspirin") ||
      normalized.includes("medication") ||
      normalized.includes("drug")
    ) {
      return { type: "Medication", icon: Pill };
    }
    if (
      normalized.includes("peanut") ||
      normalized.includes("nut") ||
      normalized.includes("milk") ||
      normalized.includes("egg") ||
      normalized.includes("fish") ||
      normalized.includes("shellfish") ||
      normalized.includes("soy") ||
      normalized.includes("wheat") ||
      normalized.includes("sesame")
    ) {
      return { type: "Food", icon: UtensilsCrossed };
    }
    if (
      normalized.includes("pollen") ||
      normalized.includes("dust") ||
      normalized.includes("mold") ||
      normalized.includes("dander") ||
      normalized.includes("latex")
    ) {
      return { type: "Environmental", icon: Leaf };
    }
    if (normalized.includes("bee") || normalized.includes("sting")) {
      return { type: "Insect", icon: Bug };
    }
    return { type: "Other", icon: AlertCircle };
  };
  const severeCount = allergies.filter(
    (allergy) =>
      allergy.severity === "severe" ||
      allergy.severity === "severe-life-threatening"
  ).length;
  const categoryCount = new Set(
    allergies.map((allergy) => classifyAllergy(allergy.name).type)
  ).size;

  const isRTL = i18n.language.toLowerCase().startsWith("ar");
  const isAdmin = user?.role === "admin";
  const hasFamily = Boolean(user?.familyId);

  const loadAllergies = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const familyId = user.familyId;
        const shouldLoadFamilyMembers = Boolean(
          familyId && user.role === "admin"
        );

        // Load allergies first to keep the screen responsive.
        const allergiesPromise = allergyService.getUserAllergies(user.id, 50);

        if (shouldLoadFamilyMembers && familyId) {
          userService
            .getFamilyMembers(familyId)
            .then((members) => setFamilyMembers(members))
            .catch(() => {
              // Non-blocking: family list is only needed for admin modal.
            });
        } else {
          setFamilyMembers([]);
        }

        const userAllergies = await allergiesPromise;
        setAllergies(userAllergies);
      } catch (_error) {
        Alert.alert(t("error"), t("errorLoadingData"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, t]
  );

  useFocusEffect(
    useCallback(() => {
      loadAllergies();
    }, [loadAllergies])
  );

  // Helper function to get translated allergy name
  const getTranslatedAllergyName = (name: string): string => {
    // Check if it's a translation key
    if (ALLERGY_KEYS.includes(name)) {
      return t(name);
    }
    // Handle backward compatibility: map old English names to translation keys
    const englishToKeyMap: Record<string, string> = {
      Peanuts: "allergyPeanuts",
      "Tree Nuts": "allergyTreeNuts",
      Milk: "allergyMilk",
      Eggs: "allergyEggs",
      Fish: "allergyFish",
      Shellfish: "allergyShellfish",
      Soy: "allergySoy",
      Wheat: "allergyWheat",
      Pollen: "allergyPollen",
      "Dust Mites": "allergyDustMites",
      "Pet Dander": "allergyPetDander",
      Mold: "allergyMold",
      Latex: "allergyLatex",
      Penicillin: "allergyPenicillin",
      Aspirin: "allergyAspirin",
      "Bee Stings": "allergyBeeStings",
      Sesame: "allergySesame",
      Sulfites: "allergySulfites",
    };
    if (englishToKeyMap[name]) {
      return t(englishToKeyMap[name]);
    }
    // Otherwise return as-is (custom allergy)
    return name;
  };

  const handleAddAllergy = async () => {
    if (!user) {
      return;
    }

    const allergyName = selectedAllergy || customAllergy;
    if (!allergyName.trim()) {
      Alert.alert(t("error"), t("pleaseEnterAllergyName"));
      return;
    }

    try {
      setLoading(true);

      const targetUserId = selectedTargetUser || user.id;

      if (editingAllergy) {
        await allergyService.updateAllergy(editingAllergy.id, {
          name: allergyName, // Save the key for common allergies, custom text for custom allergies
          severity,
          reaction: reaction.trim() || undefined,
          notes: notes.trim() || undefined,
          discoveredDate,
          timestamp: editingAllergy.timestamp,
          userId: targetUserId,
        });
      } else {
        await allergyService.addAllergy({
          userId: targetUserId,
          name: allergyName, // Save the key for common allergies, custom text for custom allergies
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
    } catch (_error) {
      Alert.alert(t("error"), t("errorSavingData"));
    } finally {
      setLoading(false);
    }
  };

  const handleEditAllergy = (allergy: Allergy) => {
    setEditingAllergy(allergy);
    // Check if it's a translation key (common allergy) or custom allergy
    // Also handle backward compatibility with old English names
    const englishToKeyMap: Record<string, string> = {
      Peanuts: "allergyPeanuts",
      "Tree Nuts": "allergyTreeNuts",
      Milk: "allergyMilk",
      Eggs: "allergyEggs",
      Fish: "allergyFish",
      Shellfish: "allergyShellfish",
      Soy: "allergySoy",
      Wheat: "allergyWheat",
      Pollen: "allergyPollen",
      "Dust Mites": "allergyDustMites",
      "Pet Dander": "allergyPetDander",
      Mold: "allergyMold",
      Latex: "allergyLatex",
      Penicillin: "allergyPenicillin",
      Aspirin: "allergyAspirin",
      "Bee Stings": "allergyBeeStings",
      Sesame: "allergySesame",
      Sulfites: "allergySulfites",
    };
    const allergyKey = ALLERGY_KEYS.includes(allergy.name)
      ? allergy.name
      : englishToKeyMap[allergy.name];

    if (allergyKey) {
      setSelectedAllergy(allergyKey);
      setCustomAllergy("");
    } else {
      setSelectedAllergy("");
      setCustomAllergy(allergy.name);
    }
    setSeverity(allergy.severity);
    setReaction(allergy.reaction || "");
    setNotes(allergy.notes || "");
    setSelectedTargetUser(allergy.userId);
    const parsedDiscoveredDate =
      coerceDate(allergy.discoveredDate as DateLike) ??
      coerceDate(allergy.timestamp as DateLike) ??
      new Date();
    setDiscoveredDate(parsedDiscoveredDate);
    setShowActionsMenu(null);
    setShowAddModal(true);
  };

  const handleDeleteAllergy = (allergyId: string) => {
    Alert.alert(t("confirmDelete"), t("confirmDeleteAllergy"), [
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
          } catch (_error) {
            Alert.alert(t("error"), t("errorDeletingData"));
          }
        },
      },
    ]);
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
    setSelectedTargetUser("");
  };

  const formatDate = (date: DateLike) => {
    const dateObj = coerceDate(date);
    if (!dateObj) {
      return "";
    }

    return safeFormatDate(dateObj, undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getSeverityColor = (severityValue: string) => {
    switch (severityValue) {
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

  const getSeverityVariant = (
    severityValue: string
  ): "success" | "warning" | "error" => {
    switch (severityValue) {
      case "mild":
        return "success";
      case "moderate":
        return "warning";
      default:
        return "error";
    }
  };

  const getMemberDisplayName = (member: UserType): string => {
    if (member.id === user?.id) {
      return isRTL ? "أنت" : "You";
    }

    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }

    return member.firstName || (isRTL ? "مستخدم" : "User");
  };

  const getSubmitButtonTitle = (): string => {
    if (editingAllergy) {
      return isRTL ? "حفظ التغييرات" : "Save Changes";
    }

    return isRTL ? "إضافة" : "Add";
  };

  const getSeverityLabel = (severityValue: string): string => {
    const matchedOption = SEVERITY_OPTIONS_KEYS.find(
      (opt) => opt.value === severityValue
    );

    return matchedOption ? t(matchedOption.labelKey) : severityValue;
  };

  const getLocalizedAllergyType = (type: string): string => {
    if (!isRTL) {
      return type;
    }

    switch (type) {
      case "Medication":
        return "دواء";
      case "Food":
        return "غذاء";
      case "Environmental":
        return "بيئية";
      case "Insect":
        return "حشرة";
      default:
        return "أخرى";
    }
  };

  const getDiagnosedDateText = (diagnosedDate: Date | null): string => {
    if (diagnosedDate) {
      return safeFormatDate(diagnosedDate);
    }
    return isRTL ? "غير متاح" : "N/A";
  };

  const renderAllergiesContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
            {t("loading")}
          </Text>
        </View>
      );
    }

    if (allergies.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
            {t("noAllergiesRecorded")}
          </Text>
        </View>
      );
    }

    return allergies.map((allergy) => (
      <Card
        contentStyle={undefined}
        key={allergy.id}
        pressable={false}
        style={styles.figmaAllergyCard}
        variant="elevated"
      >
        <View style={styles.allergyHeader}>
          <View style={styles.allergyInfo}>
            <Text
              size="large"
              style={[styles.allergyName, isRTL && styles.rtlText]}
              weight="semibold"
            >
              {getTranslatedAllergyName(allergy.name)}
            </Text>
            <View style={styles.allergyMeta}>
              <Caption
                numberOfLines={undefined}
                style={[styles.allergyDate, isRTL && styles.rtlText]}
              >
                {formatDate(allergy.discoveredDate || allergy.timestamp) || ""}
              </Caption>
              <Badge
                size="small"
                style={[
                  styles.severityBadge,
                  {
                    backgroundColor: getSeverityColor(allergy.severity),
                  },
                ]}
                variant={getSeverityVariant(allergy.severity)}
              >
                {getSeverityLabel(allergy.severity)}
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
                  <Text style={styles.actionText}>{t("edit")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteAllergy(allergy.id)}
                  style={styles.actionItem}
                >
                  <Trash2 color={theme.colors.accent.error} size={16} />
                  <Text style={styles.actionTextDanger}>{t("delete")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        {Boolean(allergy.reaction || allergy.notes) && (
          <View style={styles.allergyDetails}>
            {Boolean(allergy.reaction) && (
              <Text style={[styles.allergyDetailText, isRTL && styles.rtlText]}>
                <Text style={{}} weight="semibold">
                  {t("reaction")}:{" "}
                </Text>
                {allergy.reaction}
              </Text>
            )}
            {Boolean(allergy.notes) && (
              <Text style={[styles.allergyDetailText, isRTL && styles.rtlText]}>
                <Text style={{}} weight="semibold">
                  {t("notes")}:{" "}
                </Text>
                {allergy.notes}
              </Text>
            )}
          </View>
        )}
      </Card>
    ));
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    figmaAllergyHeaderWrapper: {
      marginBottom: 12,
    },
    figmaAllergyHeaderContent: {
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 16,
    },
    figmaAllergyHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    figmaAllergyBackButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "rgba(0, 53, 67, 0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    figmaAllergyHeaderTitle: {
      flex: 1,
    },
    figmaAllergyTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    figmaAllergyTitle: {
      fontSize: 22,
      fontFamily: "Inter-Bold",
      color: "#003543",
      flexShrink: 1,
    },
    figmaAllergySubtitle: {
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: "rgba(0, 53, 67, 0.85)",
      lineHeight: 20,
      flexShrink: 1,
    },
    figmaAllergyAddButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "#EB9C0C",
      alignItems: "center",
      justifyContent: "center",
    },
    figmaAllergyContent: {
      paddingHorizontal: 24,
      paddingBottom: 120,
    },
    figmaAllergyAlertBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      padding: 16,
      borderRadius: 16,
      backgroundColor: "rgba(239, 68, 68, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.2)",
      marginBottom: 20,
    },
    figmaAllergyAlertTextWrap: {
      flex: 1,
    },
    figmaAllergyAlertTitle: {
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
      color: "#EF4444",
      marginBottom: 4,
    },
    figmaAllergyAlertText: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: "rgba(239, 68, 68, 0.8)",
    },
    figmaAllergyStatsRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 24,
    },
    figmaAllergyStatCard: {
      flex: 1,
      backgroundColor: "#FFFFFF",
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 8,
      minHeight: 96,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    figmaAllergyStatValue: {
      fontSize: 22,
      fontFamily: "Inter-Bold",
      color: "#003543",
      marginBottom: 4,
    },
    figmaAllergyStatLabel: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: "#6C7280",
      textAlign: "center",
      lineHeight: 18,
      flexShrink: 1,
      width: "100%",
    },
    figmaAllergySection: {
      marginBottom: 24,
    },
    figmaAllergySectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    figmaAllergySectionTitle: {
      fontSize: 18,
      fontFamily: "Inter-Bold",
      color: "#1A1D1F",
      flexShrink: 1,
      marginEnd: 8,
    },
    figmaAllergySectionLink: {
      fontSize: 14,
      fontFamily: "Inter-Medium",
      color: "#003543",
      flexShrink: 1,
    },
    figmaAllergyList: {
      gap: 12,
    },
    figmaAllergyCard: {
      backgroundColor: "#FFFFFF",
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },
    figmaAllergyCardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    figmaAllergyIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    figmaAllergyCardInfo: {
      flex: 1,
    },
    figmaAllergyCardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    figmaAllergyCardTitle: {
      fontSize: 16,
      fontFamily: "Inter-SemiBold",
      color: "#1A1D1F",
      flex: 1,
      minWidth: 0,
    },
    figmaAllergySeverityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    figmaAllergySeverityText: {
      fontSize: 11,
      fontFamily: "Inter-SemiBold",
    },
    figmaAllergyTypeText: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: "#6C7280",
      marginBottom: 4,
      flexShrink: 1,
    },
    figmaAllergyReactionText: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: "#003543",
      marginBottom: 4,
      flexShrink: 1,
    },
    figmaAllergyReactionLabel: {
      fontFamily: "Inter-SemiBold",
    },
    figmaAllergyDiagnosedText: {
      fontSize: 11,
      fontFamily: "Inter-Regular",
      color: "#6C7280",
      flexShrink: 1,
    },
    figmaAllergyPlanCard: {
      backgroundColor: "rgba(249, 115, 22, 0.08)",
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
    },
    figmaAllergyPlanTitle: {
      fontSize: 16,
      fontFamily: "Inter-SemiBold",
      color: "#1A1D1F",
      marginBottom: 6,
    },
    figmaAllergyPlanText: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: "#6C7280",
    },
    figmaAllergyFab: {
      position: "absolute",
      right: 20,
      bottom: 100,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#EB9C0C",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 6,
    },
    figmaAllergyCardActions: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    figmaAllergyActionsButton: {
      padding: 8,
      marginLeft: 4,
    },
    figmaAllergyActionsMenu: {
      position: "absolute",
      right: 0,
      top: 36,
      backgroundColor: "#FFFFFF",
      borderRadius: 12,
      padding: 8,
      minWidth: 120,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 1000,
    },
    figmaAllergyActionItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 10,
    },
    figmaAllergyActionText: {
      fontSize: 14,
      fontFamily: "Inter-Medium",
      color: "#1A1D1F",
    },
    figmaAllergyActionTextDanger: {
      fontSize: 14,
      fontFamily: "Inter-Medium",
      color: "#EF4444",
    },
    figmaAllergyEmptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
      paddingHorizontal: 24,
    },
    figmaAllergyEmptyText: {
      fontSize: 16,
      fontFamily: "Inter-Medium",
      color: "#6C7280",
      marginTop: 16,
      marginBottom: 24,
      textAlign: "center",
    },
    figmaAllergyEmptyAddButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#EB9C0C",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
    },
    figmaAllergyEmptyAddText: {
      fontSize: 16,
      fontFamily: "Inter-SemiBold",
      color: "#FFFFFF",
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
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    backButtonRTL: {
      transform: [{ scaleX: -1 }],
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
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
    },
    statsSection: {
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.base,
      width: "100%",
    },
    sectionTitle: {
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.md,
    },
    sectionTitleRTL: {
      textAlign: "right" as const,
    },
    statsGrid: {
      flexDirection: "row",
      gap: theme.spacing.md,
      flexWrap: "nowrap",
      width: "100%",
    },
    statCard: {
      flex: 1,
      minWidth: 0,
      padding: theme.spacing.lg,
      alignItems: "center",
    },
    statValue: {
      fontSize: 32,
      color: theme.colors.text.primary,
      lineHeight: 38,
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.xs,
      textAlign: "center",
      flexShrink: 1,
      paddingHorizontal: theme.spacing.xs,
      minHeight: 40,
    },
    statLabel: {
      color: theme.colors.text.secondary,
      textAlign: "center",
      flexShrink: 1,
      paddingHorizontal: theme.spacing.xs,
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
      fontSize: 18,
      fontFamily: "Inter-SemiBold",
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
      fontFamily: "Inter-Regular",
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
    memberSelectionContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    memberOption: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      backgroundColor: theme.colors.background.primary,
    },
    memberOptionSelected: {
      backgroundColor: theme.colors.primary.main,
      borderColor: theme.colors.primary.main,
    },
    memberOptionText: {
      fontSize: 14,
      fontFamily: "Inter-Medium",
      color: theme.colors.text.primary,
    },
    memberOptionTextSelected: {
      color: theme.colors.neutral.white,
    },
  });

  if (!user) {
    return (
      <SafeAreaView
        edges={["top"]}
        pointerEvents="box-none"
        style={styles.container}
      >
        <View style={styles.centerContainer}>
          <Text color="#EF4444" style={{}}>
            {t(
              "pleaseLogInToTrackAllergies",
              "Please log in to track allergies"
            )}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container}
    >
      <View style={styles.figmaAllergyHeaderWrapper}>
        <WavyBackground curve="home" height={240} variant="teal">
          <View style={styles.figmaAllergyHeaderContent}>
            <View style={styles.figmaAllergyHeaderRow}>
              <TouchableOpacity
                onPress={() =>
                  params.returnTo === "track"
                    ? router.push("/(tabs)/track")
                    : router.back()
                }
                style={styles.figmaAllergyBackButton}
              >
                <ArrowLeft color="#003543" size={20} />
              </TouchableOpacity>
              <View style={styles.figmaAllergyHeaderTitle}>
                <View style={styles.figmaAllergyTitleRow}>
                  <AlertCircle color="#EB9C0C" size={20} />
                  <Text style={styles.figmaAllergyTitle}>{t("allergies")}</Text>
                </View>
                <Text
                  style={[styles.figmaAllergySubtitle, isRTL && styles.rtlText]}
                >
                  {t("manageAllergyInformation", "Manage allergy information")}
                </Text>
              </View>
            </View>
          </View>
        </WavyBackground>
      </View>

      <ScrollView
        contentContainerStyle={styles.figmaAllergyContent}
        refreshControl={
          <RefreshControl
            onRefresh={() => loadAllergies(true)}
            refreshing={refreshing}
            tintColor={theme.colors.primary.main}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {severeCount > 0 && (
          <View style={styles.figmaAllergyAlertBanner}>
            <AlertCircle color="#EF4444" size={18} />
            <View style={styles.figmaAllergyAlertTextWrap}>
              <Text style={styles.figmaAllergyAlertTitle}>
                {isRTL ? "تنبيه حساسية خطيرة" : "Critical Allergies Alert"}
              </Text>
              <Text style={styles.figmaAllergyAlertText}>
                {isRTL
                  ? `لديك ${severeCount} حالة حساسية شديدة. احمل دواء الطوارئ دائمًا وأبلغ مقدمي الرعاية الصحية.`
                  : `You have ${severeCount} severe allergy. Always carry emergency medication and inform healthcare providers.`}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.figmaAllergyStatsRow}>
          <View style={styles.figmaAllergyStatCard}>
            <Text style={styles.figmaAllergyStatValue}>{allergies.length}</Text>
            <Text style={styles.figmaAllergyStatLabel}>
              {isRTL ? "الإجمالي" : "Total"}
            </Text>
          </View>
          <View style={styles.figmaAllergyStatCard}>
            <Text style={[styles.figmaAllergyStatValue, { color: "#EF4444" }]}>
              {severeCount}
            </Text>
            <Text style={styles.figmaAllergyStatLabel}>
              {isRTL ? "شديدة" : "Severe"}
            </Text>
          </View>
          <View style={styles.figmaAllergyStatCard}>
            <Text style={styles.figmaAllergyStatValue}>{categoryCount}</Text>
            <Text style={styles.figmaAllergyStatLabel}>
              {isRTL ? "الفئات" : "Categories"}
            </Text>
          </View>
        </View>

        <View style={styles.figmaAllergySection}>
          <View style={styles.figmaAllergySectionHeader}>
            <Text style={styles.figmaAllergySectionTitle}>
              {isRTL ? "أنواع الحساسية" : "Known Allergies"}
            </Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  isRTL ? "تصدير" : "Export",
                  isRTL ? "سيتوفر التصدير قريبًا" : "Export coming soon"
                )
              }
            >
              <Text style={styles.figmaAllergySectionLink}>
                {isRTL ? "تصدير" : "Export List"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.figmaAllergyList}>
            {allergies.length === 0 ? (
              <View style={styles.figmaAllergyEmptyState}>
                <AlertCircle color="#94A3B8" size={48} />
                <Text style={styles.figmaAllergyEmptyText}>
                  {t("noAllergiesRecorded")}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    resetForm();
                    setShowAddModal(true);
                  }}
                  style={styles.figmaAllergyEmptyAddButton}
                >
                  <Plus color="#FFFFFF" size={20} />
                  <Text style={styles.figmaAllergyEmptyAddText}>
                    {t("addAllergy")}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              allergies.map((allergy) => (
                <AllergyCard
                  allergy={allergy}
                  classifyAllergy={classifyAllergy}
                  coerceDate={coerceDate}
                  getDiagnosedDateText={getDiagnosedDateText}
                  getLocalizedAllergyType={getLocalizedAllergyType}
                  getSeverityLabel={getSeverityLabel}
                  getTranslatedAllergyName={getTranslatedAllergyName}
                  isRTL={isRTL}
                  key={allergy.id}
                  onDelete={handleDeleteAllergy}
                  onEdit={handleEditAllergy}
                  onToggleActionsMenu={(id) =>
                    setShowActionsMenu(showActionsMenu === id ? null : id)
                  }
                  severityColors={severityColors}
                  showActionsMenu={showActionsMenu}
                  styles={styles}
                  t={t}
                  theme={theme}
                />
              ))
            )}
          </View>
        </View>

        <View style={styles.figmaAllergyPlanCard}>
          <Text style={[styles.figmaAllergyPlanTitle, isRTL && styles.rtlText]}>
            {isRTL ? "خطة الطوارئ" : "Emergency Action Plan"}
          </Text>
          <Text style={[styles.figmaAllergyPlanText, isRTL && styles.rtlText]}>
            {isRTL
              ? "حافظ على تحديث خطة الطوارئ الخاصة بالحساسية وشاركها مع مقدمي الرعاية والطاقم الطبي."
              : "Keep your allergy action plan updated and share it with caregivers and medical professionals."}
          </Text>
        </View>
      </ScrollView>

      <TouchableOpacity
        onPress={() => {
          resetForm();
          setShowAddModal(true);
        }}
        style={styles.figmaAllergyFab}
      >
        <Plus color="#FFFFFF" size={22} />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        transparent={true}
        visible={showAddModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Heading
                level={4}
                style={[styles.modalTitle, isRTL && styles.rtlText]}
              >
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
              {/* Target User Selector (for admins) */}
              {isAdmin && hasFamily && familyMembers.length > 0 && (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                    {isRTL ? "إضافة الحساسية لـ" : "Add allergy for"}
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
                        <Text
                          style={[
                            styles.memberOptionText,
                            selectedTargetUser === member.id &&
                              styles.memberOptionTextSelected,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {getMemberDisplayName(member)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t("allergyName")}
              </Text>
              <View style={styles.allergyOptions}>
                {ALLERGY_KEYS.map((allergyKey) => {
                  const allergyLabel = t(allergyKey);
                  return (
                    <TouchableOpacity
                      key={allergyKey}
                      onPress={() => {
                        setSelectedAllergy(allergyKey);
                        setCustomAllergy("");
                      }}
                      style={[
                        styles.allergyOption,
                        selectedAllergy === allergyKey &&
                          styles.allergyOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.allergyOptionText,
                          selectedAllergy === allergyKey &&
                            styles.allergyOptionTextSelected,
                        ]}
                      >
                        {allergyLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.fieldGroup}>
                <Input
                  error={undefined}
                  helperText={undefined}
                  label={t("customAllergy")}
                  leftIcon={undefined}
                  onChangeText={(text: string) => {
                    setCustomAllergy(text);
                    if (text) {
                      setSelectedAllergy("");
                    }
                  }}
                  placeholder={t("orEnterCustomAllergy")}
                  rightIcon={undefined}
                  style={isRTL && styles.rtlTextInput}
                  textAlign={isRTL ? "right" : "left"}
                  value={customAllergy}
                />
              </View>

              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t("severity")}
              </Text>
              <View style={styles.severityButtons}>
                {SEVERITY_OPTIONS_KEYS.map((option) => (
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
                        severity === option.value &&
                          styles.severityButtonTextActive,
                      ]}
                    >
                      {t(option.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.fieldGroup}>
                <Input
                  error={undefined}
                  helperText={undefined}
                  label={`${t("reaction")} (${t("optional")})`}
                  leftIcon={undefined}
                  multiline
                  numberOfLines={3}
                  onChangeText={setReaction}
                  placeholder={t("reactionOptional")}
                  rightIcon={undefined}
                  style={isRTL && styles.rtlTextInput}
                  textAlign={isRTL ? "right" : "left"}
                  value={reaction}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Input
                  error={undefined}
                  helperText={undefined}
                  label={`${t("notes")} (${t("optional")})`}
                  leftIcon={undefined}
                  multiline
                  numberOfLines={3}
                  onChangeText={setNotes}
                  placeholder={t("notesOptional")}
                  rightIcon={undefined}
                  style={isRTL && styles.rtlTextInput}
                  textAlign={isRTL ? "right" : "left"}
                  value={notes}
                />
              </View>

              <Button
                loading={loading}
                onPress={handleAddAllergy}
                style={{
                  marginTop: theme.spacing.lg,
                  backgroundColor: theme.colors.primary.main,
                }}
                textStyle={{
                  color: theme.colors.neutral.white,
                }}
                title={getSubmitButtonTitle()}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </GradientScreen>
  );
}

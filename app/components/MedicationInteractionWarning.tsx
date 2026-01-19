import { AlertTriangle, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import {
  Caption,
  Heading,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import {
  type DrugInteraction,
  medicationInteractionService,
} from "@/lib/services/medicationInteractionService";
import type { Medication } from "@/types";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

interface MedicationInteractionWarningProps {
  medications: Medication[];
  newMedicationName?: string;
  onDismiss?: () => void;
}

export default function MedicationInteractionWarning({
  medications,
  newMedicationName,
  onDismiss,
}: MedicationInteractionWarningProps) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const styles = createThemedStyles((theme) => ({
    container: {
      marginBottom: theme.spacing.base,
    } as ViewStyle,
    warningCard: {
      backgroundColor: theme.colors.accent.error + "10",
      borderColor: theme.colors.accent.error,
      borderWidth: 2,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.base,
    } as ViewStyle,
    warningHeader: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    } as ViewStyle,
    warningTitle: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.accent.error),
      flex: 1,
    } as TextStyle,
    warningText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
      marginBottom: theme.spacing.xs,
    } as TextStyle,
    viewDetailsButton: {
      marginTop: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.base,
      backgroundColor: theme.colors.accent.error,
      borderRadius: theme.borderRadius.md,
      alignItems: "center" as const,
    } as ViewStyle,
    viewDetailsButtonText: {
      ...getTextStyle(theme, "body", "semibold", theme.colors.neutral.white),
    } as TextStyle,
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    } as ViewStyle,
    modalHeader: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      padding: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    } as ViewStyle,
    modalTitle: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.text.primary),
      fontSize: 20,
    } as TextStyle,
    modalContent: {
      padding: theme.spacing.base,
    } as ViewStyle,
    interactionCard: {
      marginBottom: theme.spacing.base,
      borderLeftWidth: 4,
    } as ViewStyle,
    interactionHeader: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.sm,
    } as ViewStyle,
    interactionMedications: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.text.primary),
      marginBottom: theme.spacing.xs,
    } as TextStyle,
    interactionDescription: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      marginBottom: theme.spacing.sm,
    } as TextStyle,
    effectsList: {
      marginBottom: theme.spacing.sm,
    } as ViewStyle,
    effectsTitle: {
      ...getTextStyle(theme, "body", "semibold", theme.colors.text.primary),
      marginBottom: theme.spacing.xs,
    } as TextStyle,
    effectItem: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      marginLeft: isRTL ? 0 : theme.spacing.base,
      marginRight: isRTL ? theme.spacing.base : 0,
      marginBottom: theme.spacing.xs,
    } as TextStyle,
    recommendationsList: {
      marginTop: theme.spacing.sm,
    } as ViewStyle,
    recommendationItem: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
      marginLeft: isRTL ? 0 : theme.spacing.base,
      marginRight: isRTL ? theme.spacing.base : 0,
      marginBottom: theme.spacing.xs,
    } as TextStyle,
    rtlText: {
      textAlign: (isRTL ? "right" : "left") as
        | "left"
        | "right"
        | "center"
        | "justify"
        | "auto",
    } as TextStyle,
  }))(theme) as any;

  useEffect(() => {
    checkInteractions();
  }, [medications, newMedicationName]);

  const checkInteractions = async () => {
    setLoading(true);
    try {
      let medsToCheck = medications;

      // If checking a new medication, add it temporarily
      if (newMedicationName) {
        const tempMed: Medication = {
          id: "temp",
          userId: medications[0]?.userId || "",
          name: newMedicationName,
          dosage: "",
          frequency: "",
          startDate: new Date(),
          reminders: [],
          isActive: true,
        };
        medsToCheck = [...medications, tempMed];
      }

      const foundInteractions =
        await medicationInteractionService.checkInteractions(medsToCheck);
      setInteractions(foundInteractions);

      // Auto-show modal if major interactions found
      if (foundInteractions.some((i) => i.severity === "major")) {
        setShowModal(true);
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setLoading(false);
    }
  };

  if (loading || interactions.length === 0) {
    return null;
  }

  const majorInteractions = interactions.filter((i) => i.severity === "major");
  const hasMajorInteractions = majorInteractions.length > 0;

  return (
    <View style={styles.container}>
      <Card
        contentStyle={undefined}
        onPress={undefined}
        style={styles.warningCard}
        variant="elevated"
      >
        <View style={styles.warningHeader}>
          <AlertTriangle color={theme.colors.accent.error} size={24} />
          <Heading
            level={5}
            style={[styles.warningTitle, isRTL ? styles.rtlText : {}]}
          >
            {isRTL ? "تحذير: تفاعلات دوائية" : "Warning: Drug Interactions"}
          </Heading>
        </View>
        <TypographyText style={[styles.warningText, isRTL && styles.rtlText]}>
          {isRTL
            ? `تم اكتشاف ${interactions.length} ${interactions.length === 1 ? "تفاعل" : "تفاعلات"} دوائية`
            : `${interactions.length} drug interaction${interactions.length === 1 ? "" : "s"} detected`}
        </TypographyText>
        {hasMajorInteractions && (
          <TypographyText
            style={[
              styles.warningText,
              { color: theme.colors.accent.error, fontWeight: "600" },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL
              ? `⚠️ ${majorInteractions.length} ${majorInteractions.length === 1 ? "تفاعل خطير" : "تفاعلات خطيرة"}`
              : `⚠️ ${majorInteractions.length} major interaction${majorInteractions.length === 1 ? "" : "s"}`}
          </TypographyText>
        )}
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          style={styles.viewDetailsButton}
        >
          <TypographyText style={styles.viewDetailsButtonText}>
            {isRTL ? "عرض التفاصيل" : "View Details"}
          </TypographyText>
        </TouchableOpacity>
      </Card>

      {/* Interaction Details Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShowModal(false);
          onDismiss?.();
        }}
        presentationStyle="pageSheet"
        visible={showModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Heading
              level={5}
              style={[styles.modalTitle, isRTL && styles.rtlText]}
            >
              {isRTL ? "تفاعلات الأدوية" : "Drug Interactions"}
            </Heading>
            <TouchableOpacity
              onPress={() => {
                setShowModal(false);
                onDismiss?.();
              }}
            >
              <X color={theme.colors.text.primary} size={24} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {interactions.map((interaction, index) => (
              <Card
                contentStyle={undefined}
                key={index}
                onPress={undefined}
                style={[
                  styles.interactionCard,
                  {
                    borderLeftColor:
                      medicationInteractionService.getSeverityColor(
                        interaction.severity
                      ),
                  },
                ]}
                variant="elevated"
              >
                <View style={styles.interactionHeader}>
                  <Heading
                    level={6}
                    style={[
                      styles.interactionMedications,
                      isRTL ? styles.rtlText : {},
                    ]}
                  >
                    {interaction.medications.join(" + ")}
                  </Heading>
                  <Badge
                    size="small"
                    style={{
                      borderColor:
                        medicationInteractionService.getSeverityColor(
                          interaction.severity
                        ),
                      backgroundColor:
                        medicationInteractionService.getSeverityColor(
                          interaction.severity
                        ) + "20",
                    }}
                    variant="outline"
                  >
                    <Caption
                      numberOfLines={1}
                      style={{
                        color: medicationInteractionService.getSeverityColor(
                          interaction.severity
                        ),
                      }}
                    >
                      {medicationInteractionService.getSeverityLabel(
                        interaction.severity,
                        isRTL
                      )}
                    </Caption>
                  </Badge>
                </View>

                <TypographyText
                  style={[
                    styles.interactionDescription,
                    isRTL && styles.rtlText,
                  ]}
                >
                  {interaction.description}
                </TypographyText>

                {interaction.effects.length > 0 && (
                  <View style={styles.effectsList}>
                    <Heading
                      level={6}
                      style={[styles.effectsTitle, isRTL ? styles.rtlText : {}]}
                    >
                      {isRTL ? "الآثار المحتملة" : "Potential Effects"}:
                    </Heading>
                    {interaction.effects.map((effect, effectIndex) => (
                      <Text
                        key={effectIndex}
                        style={[styles.effectItem, isRTL && styles.rtlText]}
                      >
                        • {effect}
                      </Text>
                    ))}
                  </View>
                )}

                {interaction.recommendations.length > 0 && (
                  <View style={styles.recommendationsList}>
                    <Heading
                      level={6}
                      style={[styles.effectsTitle, isRTL ? styles.rtlText : {}]}
                    >
                      {isRTL ? "التوصيات" : "Recommendations"}:
                    </Heading>
                    {interaction.recommendations.map((rec, recIndex) => (
                      <Text
                        key={recIndex}
                        style={[
                          styles.recommendationItem,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        • {rec}
                      </Text>
                    ))}
                  </View>
                )}
              </Card>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

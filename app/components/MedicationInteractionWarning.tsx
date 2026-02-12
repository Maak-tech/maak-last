/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Interaction warning UI intentionally handles multiple safety states and detailed modal rendering in one component. */
/* biome-ignore-all lint/nursery/noShadow: Themed style callback naming follows existing project pattern in this file. */
/* biome-ignore-all lint/suspicious/noExplicitAny: Legacy themed style helper returns broad types; narrowed incrementally elsewhere. */
import {
  AlertTriangle,
  X } from "lucide-react-native";
import { useCallback,
  useEffect,
  useMemo,
  useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ScrollView,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

type MedicationInteractionWarningProps = {
  medications: Medication[];
  newMedicationName?: string;
  onDismiss?: () => void;
};

export default function MedicationInteractionWarning({
  medications,
  newMedicationName,
  onDismiss,
}: MedicationInteractionWarningProps) {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const styles = useMemo(
    () =>
      createThemedStyles((theme) => ({
        container: {
          marginBottom: theme.spacing.base,
        } as ViewStyle,
        infoCard: {
          backgroundColor: theme.colors.background.secondary,
          borderColor: theme.colors.border.light,
          borderWidth: 1,
          borderRadius: theme.borderRadius.md,
          padding: theme.spacing.base,
        } as ViewStyle,
        warningCard: {
          backgroundColor: `${theme.colors.accent.error}10`,
          borderColor: theme.colors.accent.error,
          borderWidth: 2,
          borderRadius: theme.borderRadius.md,
          padding: theme.spacing.base,
        } as ViewStyle,
        warningHeader: {
          flexDirection: (isRTL ? "row-reverse" : "row") as
            | "row"
            | "row-reverse",
          alignItems: "center" as const,
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.sm,
        } as ViewStyle,
        warningTitle: {
          ...getTextStyle(
            theme,
            "subheading",
            "bold",
            theme.colors.accent.error
          ),
          flex: 1,
        } as TextStyle,
        warningText: {
          ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
          marginBottom: theme.spacing.xs,
        } as TextStyle,
        infoText: {
          ...getTextStyle(
            theme,
            "body",
            "regular",
            theme.colors.text.secondary
          ),
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
          ...getTextStyle(
            theme,
            "body",
            "semibold",
            theme.colors.neutral.white
          ),
        } as TextStyle,
        modalContainer: {
          flex: 1,
          backgroundColor: theme.colors.background.primary,
        } as ViewStyle,
        modalHeader: {
          flexDirection: (isRTL ? "row-reverse" : "row") as
            | "row"
            | "row-reverse",
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
          flexDirection: (isRTL ? "row-reverse" : "row") as
            | "row"
            | "row-reverse",
          justifyContent: "space-between" as const,
          alignItems: "center" as const,
          marginBottom: theme.spacing.sm,
        } as ViewStyle,
        interactionMedications: {
          ...getTextStyle(
            theme,
            "subheading",
            "bold",
            theme.colors.text.primary
          ),
          marginBottom: theme.spacing.xs,
        } as TextStyle,
        interactionDescription: {
          ...getTextStyle(
            theme,
            "body",
            "regular",
            theme.colors.text.secondary
          ),
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
          ...getTextStyle(
            theme,
            "body",
            "regular",
            theme.colors.text.secondary
          ),
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
      }))(theme) as any,
    [theme, isRTL]
  );

  const effectiveMedicationCount =
    medications.length + (newMedicationName ? 1 : 0);
  const hasEnoughMedications = effectiveMedicationCount >= 2;

  const checkInteractions = useCallback(async () => {
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

      if (medsToCheck.length < 2) {
        setInteractions([]);
        return;
      }

      const foundInteractions =
        await medicationInteractionService.checkInteractions(medsToCheck);
      setInteractions(foundInteractions);

      // Auto-show modal if major interactions found
      if (foundInteractions.some((i) => i.severity === "major")) {
        setShowModal(true);
      }
    } catch (_error) {
      // Silently handle error
    } finally {
      setLoading(false);
    }
  }, [medications, newMedicationName]);

  const medicationSignature = useMemo(
    () => medications.map((medication) => medication.id).join("|"),
    [medications]
  );

  useEffect(() => {
    if (!(medicationSignature || newMedicationName)) {
      setInteractions([]);
      setLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      checkInteractions().catch(() => undefined);
    }, 400);

    return () => clearTimeout(timeout);
  }, [medicationSignature, newMedicationName, checkInteractions]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Card
          contentStyle={undefined}
          pressable={false}
          style={styles.infoCard}
          variant="elevated"
        >
          <TypographyText style={[styles.infoText, isRTL && styles.rtlText]}>
            {isRTL
              ? "جارٍ التحقق من تفاعلات الأدوية..."
              : "Checking medication interactions..."}
          </TypographyText>
        </Card>
      </View>
    );
  }

  if (!hasEnoughMedications) {
    return (
      <View style={styles.container}>
        <Card
          contentStyle={undefined}
          pressable={false}
          style={styles.infoCard}
          variant="elevated"
        >
          <TypographyText style={[styles.infoText, isRTL && styles.rtlText]}>
            {isRTL
              ? "أضف دواءين نشطين على الأقل للتحقق من التفاعلات."
              : "Add at least two active medications to check interactions."}
          </TypographyText>
        </Card>
      </View>
    );
  }

  if (interactions.length === 0) {
    return (
      <View style={styles.container}>
        <Card
          contentStyle={undefined}
          pressable={false}
          style={styles.infoCard}
          variant="elevated"
        >
          <TypographyText style={[styles.infoText, isRTL && styles.rtlText]}>
            {isRTL
              ? "لا توجد تفاعلات معروفة بين الأدوية الحالية."
              : "No known interactions detected for your current medications."}
          </TypographyText>
        </Card>
      </View>
    );
  }

  const majorInteractions = interactions.filter((i) => i.severity === "major");
  const hasMajorInteractions = majorInteractions.length > 0;

  return (
    <View style={styles.container}>
      <Card
        contentStyle={undefined}
        pressable={false}
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
        {hasMajorInteractions ? (
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
        ) : null}
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
            {interactions.map((interaction) => (
              <Card
                contentStyle={undefined}
                key={`${interaction.medications.join("|")}-${interaction.severity}-${interaction.description}`}
                pressable={false}
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
                      backgroundColor: `${medicationInteractionService.getSeverityColor(
                        interaction.severity
                      )}20`,
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
                    {interaction.effects.map((effect) => (
                      <Text
                        key={`${interaction.medications.join("|")}-effect-${effect}`}
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
                    {interaction.recommendations.map((rec) => (
                      <Text
                        key={`${interaction.medications.join("|")}-rec-${rec}`}
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

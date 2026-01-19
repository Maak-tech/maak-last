import type { Medication, MedicationInteractionAlert } from "@/types";
import { medicationService } from "./medicationService";

export interface DrugInteraction {
  severity: "major" | "moderate" | "minor";
  description: string;
  medications: string[];
  effects: string[];
  recommendations: string[];
}

// Common drug interactions database
// In production, this would be integrated with a professional drug interaction API
// like RxNorm, DrugBank, or FDA databases
const DRUG_INTERACTIONS_DB: Record<
  string,
  {
    interactsWith: string[];
    severity: "major" | "moderate" | "minor";
    description: string;
    effects: string[];
    recommendations: string[];
  }
> = {
  // Warfarin interactions (major)
  Warfarin: {
    interactsWith: [
      "Aspirin",
      "Ibuprofen",
      "Naproxen",
      "Paracetamol",
      "Atorvastatin",
      "Simvastatin",
    ],
    severity: "major",
    description:
      "Warfarin interacts with many medications and can cause serious bleeding",
    effects: [
      "Increased risk of bleeding",
      "Bruising",
      "Prolonged bleeding time",
    ],
    recommendations: [
      "Monitor INR regularly",
      "Avoid NSAIDs",
      "Consult doctor before adding new medications",
    ],
  },
  Aspirin: {
    interactsWith: ["Warfarin", "Ibuprofen", "Naproxen", "Metformin"],
    severity: "major",
    description:
      "Aspirin can increase bleeding risk when taken with blood thinners",
    effects: ["Increased bleeding risk", "Stomach irritation"],
    recommendations: ["Avoid with other blood thinners", "Take with food"],
  },
  Ibuprofen: {
    interactsWith: ["Warfarin", "Aspirin", "Lithium", "Methotrexate"],
    severity: "moderate",
    description:
      "Ibuprofen can interact with blood thinners and other medications",
    effects: ["Increased bleeding risk", "Kidney function changes"],
    recommendations: ["Avoid with blood thinners", "Monitor kidney function"],
  },
  // ACE Inhibitors interactions
  Lisinopril: {
    interactsWith: ["Potassium supplements", "Diuretics", "Lithium"],
    severity: "moderate",
    description: "ACE inhibitors can cause potassium buildup",
    effects: ["High potassium levels", "Kidney function changes"],
    recommendations: [
      "Monitor potassium levels",
      "Avoid potassium supplements",
    ],
  },
  Enalapril: {
    interactsWith: ["Potassium supplements", "Diuretics", "Lithium"],
    severity: "moderate",
    description: "ACE inhibitors can cause potassium buildup",
    effects: ["High potassium levels"],
    recommendations: ["Monitor potassium levels"],
  },
  // Statins interactions
  Atorvastatin: {
    interactsWith: ["Warfarin", "Grapefruit juice", "Certain antibiotics"],
    severity: "moderate",
    description: "Atorvastatin can interact with various medications",
    effects: ["Increased statin levels", "Muscle pain risk"],
    recommendations: ["Avoid grapefruit juice", "Monitor for muscle pain"],
  },
  Simvastatin: {
    interactsWith: ["Warfarin", "Grapefruit juice", "Certain antibiotics"],
    severity: "moderate",
    description: "Simvastatin can interact with various medications",
    effects: ["Increased statin levels"],
    recommendations: ["Avoid grapefruit juice"],
  },
  // Metformin interactions
  Metformin: {
    interactsWith: ["Alcohol", "Contrast dye", "Certain heart medications"],
    severity: "moderate",
    description: "Metformin can interact with alcohol and contrast agents",
    effects: ["Lactic acidosis risk", "Kidney function changes"],
    recommendations: ["Avoid alcohol", "Stop before contrast imaging"],
  },
  // Antidepressants interactions
  Sertraline: {
    interactsWith: [
      "MAO inhibitors",
      "Blood thinners",
      "Other antidepressants",
    ],
    severity: "major",
    description: "SSRIs can cause serotonin syndrome when combined",
    effects: ["Serotonin syndrome", "Bleeding risk"],
    recommendations: ["Avoid MAO inhibitors", "Monitor for serotonin syndrome"],
  },
  Fluoxetine: {
    interactsWith: [
      "MAO inhibitors",
      "Blood thinners",
      "Other antidepressants",
    ],
    severity: "major",
    description: "SSRIs can cause serotonin syndrome",
    effects: ["Serotonin syndrome"],
    recommendations: ["Avoid MAO inhibitors"],
  },
  // Antibiotics interactions
  Amoxicillin: {
    interactsWith: ["Birth control pills", "Warfarin"],
    severity: "moderate",
    description: "Antibiotics can reduce effectiveness of birth control",
    effects: ["Reduced birth control effectiveness"],
    recommendations: ["Use backup contraception", "Monitor INR if on warfarin"],
  },
  // Diuretics
  Furosemide: {
    interactsWith: ["Lithium", "Digoxin", "ACE inhibitors"],
    severity: "moderate",
    description: "Diuretics can affect electrolyte levels",
    effects: ["Low potassium", "Dehydration"],
    recommendations: ["Monitor electrolytes", "Stay hydrated"],
  },
};

class MedicationInteractionService {
  /**
   * Normalize medication name for comparison
   */
  private normalizeMedicationName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ");
  }

  /**
   * Find medication in database
   */
  private findMedicationInDB(medicationName: string): string | null {
    const normalized = this.normalizeMedicationName(medicationName);

    // Check exact match first
    for (const [key, _] of Object.entries(DRUG_INTERACTIONS_DB)) {
      if (this.normalizeMedicationName(key) === normalized) {
        return key;
      }
    }

    // Check partial match (medication name contains key or vice versa)
    for (const [key, _] of Object.entries(DRUG_INTERACTIONS_DB)) {
      const normalizedKey = this.normalizeMedicationName(key);
      if (
        normalized.includes(normalizedKey) ||
        normalizedKey.includes(normalized)
      ) {
        return key;
      }
    }

    return null;
  }

  /**
   * Check for interactions between medications
   */
  async checkInteractions(
    medications: Medication[]
  ): Promise<DrugInteraction[]> {
    const interactions: DrugInteraction[] = [];
    const activeMedications = medications.filter((m) => m.isActive);

    // Check each pair of medications
    for (let i = 0; i < activeMedications.length; i++) {
      for (let j = i + 1; j < activeMedications.length; j++) {
        const med1 = activeMedications[i];
        const med2 = activeMedications[j];

        const interaction = this.checkPairInteraction(med1.name, med2.name);
        if (interaction) {
          interactions.push(interaction);
        }
      }
    }

    // Sort by severity (major first)
    interactions.sort((a, b) => {
      const severityOrder = { major: 0, moderate: 1, minor: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return interactions;
  }

  /**
   * Check interaction between two medications
   */
  private checkPairInteraction(
    med1Name: string,
    med2Name: string
  ): DrugInteraction | null {
    const med1Key = this.findMedicationInDB(med1Name);
    const med2Key = this.findMedicationInDB(med2Name);

    if (!(med1Key || med2Key)) {
      return null;
    }

    // Check if med1 interacts with med2
    if (med1Key) {
      const med1Data = DRUG_INTERACTIONS_DB[med1Key];
      const med2Normalized = this.normalizeMedicationName(med2Name);

      for (const interactingMed of med1Data.interactsWith) {
        if (
          this.normalizeMedicationName(interactingMed) === med2Normalized ||
          med2Normalized.includes(
            this.normalizeMedicationName(interactingMed)
          ) ||
          this.normalizeMedicationName(interactingMed).includes(med2Normalized)
        ) {
          return {
            severity: med1Data.severity,
            description: med1Data.description,
            medications: [med1Name, med2Name],
            effects: med1Data.effects,
            recommendations: med1Data.recommendations,
          };
        }
      }
    }

    // Check if med2 interacts with med1
    if (med2Key) {
      const med2Data = DRUG_INTERACTIONS_DB[med2Key];
      const med1Normalized = this.normalizeMedicationName(med1Name);

      for (const interactingMed of med2Data.interactsWith) {
        if (
          this.normalizeMedicationName(interactingMed) === med1Normalized ||
          med1Normalized.includes(
            this.normalizeMedicationName(interactingMed)
          ) ||
          this.normalizeMedicationName(interactingMed).includes(med1Normalized)
        ) {
          return {
            severity: med2Data.severity,
            description: med2Data.description,
            medications: [med1Name, med2Name],
            effects: med2Data.effects,
            recommendations: med2Data.recommendations,
          };
        }
      }
    }

    return null;
  }

  /**
   * Check interactions when adding a new medication
   */
  async checkNewMedicationInteraction(
    userId: string,
    newMedicationName: string
  ): Promise<DrugInteraction[]> {
    try {
      const existingMedications =
        await medicationService.getUserMedications(userId);
      const activeMedications = existingMedications.filter((m) => m.isActive);

      // Create a temporary medication object for the new medication
      const newMedication: Medication = {
        id: "temp",
        userId,
        name: newMedicationName,
        dosage: "",
        frequency: "",
        startDate: new Date(),
        reminders: [],
        isActive: true,
      };

      const allMedications = [...activeMedications, newMedication];
      return this.checkInteractions(allMedications);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get interaction severity color
   */
  getSeverityColor(severity: DrugInteraction["severity"]): string {
    switch (severity) {
      case "major":
        return "#EF4444"; // Red
      case "moderate":
        return "#F59E0B"; // Orange
      case "minor":
        return "#EAB308"; // Yellow
      default:
        return "#64748B"; // Gray
    }
  }

  /**
   * Get interaction severity label
   */
  getSeverityLabel(
    severity: DrugInteraction["severity"],
    isRTL = false
  ): string {
    const labels = {
      major: { en: "Major", ar: "خطير" },
      moderate: { en: "Moderate", ar: "متوسط" },
      minor: { en: "Minor", ar: "بسيط" },
    };
    return isRTL ? labels[severity].ar : labels[severity].en;
  }

  /**
   * Generate real-time interaction alerts for active medications
   */
  async generateRealtimeAlerts(
    userId: string
  ): Promise<MedicationInteractionAlert[]> {
    try {
      const medications = await medicationService.getUserMedications(userId);
      const interactions = await this.checkInteractions(medications);

      const alerts: MedicationInteractionAlert[] = interactions.map(
        (interaction) => ({
          id: `interaction-alert-${Date.now()}-${Math.random()}`,
          userId,
          type: "medication_interaction",
          severity: interaction.severity,
          title: this.getInteractionAlertTitle(interaction, false),
          message: this.getInteractionAlertMessage(interaction, false),
          medications: interaction.medications,
          effects: interaction.effects,
          recommendations: interaction.recommendations,
          timestamp: new Date(),
          acknowledged: false,
          actionable: true,
        })
      );

      return alerts;
    } catch (error) {
      return [];
    }
  }

  /**
   * Check for new interactions when adding a medication and generate alert
   */
  async checkNewMedicationWithAlert(
    userId: string,
    newMedicationName: string
  ): Promise<{
    interactions: DrugInteraction[];
    alert?: MedicationInteractionAlert;
  }> {
    const interactions = await this.checkNewMedicationInteraction(
      userId,
      newMedicationName
    );

    let alert: MedicationInteractionAlert | undefined;

    if (interactions.length > 0) {
      const mostSevere = interactions.sort((a, b) => {
        const severityOrder = { major: 0, moderate: 1, minor: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })[0];

      alert = {
        id: `new-med-alert-${Date.now()}-${Math.random()}`,
        userId,
        type: "new_medication_interaction",
        severity: mostSevere.severity,
        title: "New Medication Interaction Detected",
        message: `Adding ${newMedicationName} may interact with your current medications`,
        medications: mostSevere.medications,
        effects: mostSevere.effects,
        recommendations: mostSevere.recommendations,
        timestamp: new Date(),
        acknowledged: false,
        actionable: true,
      };
    }

    return { interactions, alert };
  }

  /**
   * Get interaction alert title
   */
  private getInteractionAlertTitle(
    interaction: DrugInteraction,
    isRTL = false
  ): string {
    const severity = this.getSeverityLabel(interaction.severity, isRTL);
    return isRTL
      ? `تحذير تفاعل أدوية ${severity}`
      : `${severity} Medication Interaction Alert`;
  }

  /**
   * Get interaction alert message
   */
  private getInteractionAlertMessage(
    interaction: DrugInteraction,
    isRTL = false
  ): string {
    const medNames = interaction.medications.join(" + ");
    return isRTL
      ? `تم اكتشاف تفاعل بين: ${medNames}. ${interaction.description}`
      : `Interaction detected between: ${medNames}. ${interaction.description}`;
  }

  /**
   * Get interaction summary for quick display
   */
  getInteractionSummary(interactions: DrugInteraction[]): {
    total: number;
    bySeverity: Record<string, number>;
    mostSevere: DrugInteraction | null;
  } {
    const bySeverity: Record<string, number> = {
      major: 0,
      moderate: 0,
      minor: 0,
    };

    interactions.forEach((interaction) => {
      bySeverity[interaction.severity]++;
    });

    const mostSevere =
      interactions.length > 0
        ? interactions.sort((a, b) => {
            const severityOrder = { major: 0, moderate: 1, minor: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
          })[0]
        : null;

    return {
      total: interactions.length,
      bySeverity,
      mostSevere,
    };
  }
}

export const medicationInteractionService = new MedicationInteractionService();

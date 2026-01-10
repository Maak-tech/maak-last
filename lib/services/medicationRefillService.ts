import type { Medication } from "@/types";

export interface RefillPrediction {
  medicationId: string;
  medicationName: string;
  dosage: string;
  currentQuantity?: number;
  quantityUnit?: string;
  daysUntilRefill: number;
  estimatedRefillDate: Date;
  urgency: "low" | "medium" | "high" | "critical";
  needsRefill: boolean;
  lastRefillDate?: Date;
}

export interface RefillSummary {
  totalMedications: number;
  needsRefill: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  predictions: RefillPrediction[];
}

class MedicationRefillService {
  /**
   * Calculate daily consumption rate based on frequency and dosage
   */
  private calculateDailyConsumption(frequency: string, dosage: string): number {
    const frequencyLower = frequency.toLowerCase();
    
    // Parse frequency to determine times per day
    let timesPerDay = 1;
    
    if (frequencyLower.includes("once") || frequencyLower === "1" || frequencyLower === "qd") {
      timesPerDay = 1;
    } else if (frequencyLower.includes("twice") || frequencyLower === "2" || frequencyLower === "bid") {
      timesPerDay = 2;
    } else if (
      frequencyLower.includes("three") ||
      frequencyLower.includes("thrice") ||
      frequencyLower === "3" ||
      frequencyLower === "tid"
    ) {
      timesPerDay = 3;
    } else if (frequencyLower.includes("four") || frequencyLower === "4" || frequencyLower === "qid") {
      timesPerDay = 4;
    } else if (frequencyLower.includes("meal")) {
      timesPerDay = 3; // Typically with meals = 3 times
    } else if (frequencyLower.includes("every")) {
      // Try to extract number from "every X hours"
      const hoursMatch = frequencyLower.match(/every\s+(\d+)\s*hours?/i);
      if (hoursMatch) {
        const hours = Number.parseInt(hoursMatch[1]);
        timesPerDay = Math.floor(24 / hours);
      }
    }

    // Parse dosage to determine units per dose
    // This is a simplified parser - assumes 1 unit per dose unless specified
    let unitsPerDose = 1;
    
    // Try to extract number from dosage (e.g., "2 tablets", "1 pill", "500mg")
    const dosageLower = dosage.toLowerCase();
    const numberMatch = dosageLower.match(/(\d+)\s*(tablet|pill|cap|capsule|tab|dose|ml|mg|g)/i);
    if (numberMatch) {
      unitsPerDose = Number.parseInt(numberMatch[1]);
    }

    return timesPerDay * unitsPerDose;
  }

  /**
   * Estimate quantity based on usage patterns if not provided
   */
  private estimateQuantity(
    medication: Medication,
    dailyConsumption: number
  ): number | null {
    // If quantity is already set, use it
    if (medication.quantity !== undefined && medication.quantity !== null) {
      return medication.quantity;
    }

    // Try to estimate based on last refill date and usage
    if (medication.lastRefillDate) {
      const daysSinceRefill = Math.floor(
        (new Date().getTime() - medication.lastRefillDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      
      // Estimate initial quantity (assume 30-day supply)
      const estimatedInitialQuantity = dailyConsumption * 30;
      const estimatedCurrentQuantity = Math.max(
        0,
        estimatedInitialQuantity - daysSinceRefill * dailyConsumption
      );
      
      return estimatedCurrentQuantity;
    }

    // If no quantity or refill date, estimate based on typical supply
    // Most medications come in 30-day supplies
    return dailyConsumption * 30;
  }

  /**
   * Calculate refill prediction for a single medication
   */
  calculateRefillPrediction(medication: Medication): RefillPrediction | null {
    if (!medication.isActive) {
      return null;
    }

    // Skip "as needed" medications as they don't have regular schedules
    if (medication.frequency.toLowerCase().includes("needed")) {
      return null;
    }

    const dailyConsumption = this.calculateDailyConsumption(
      medication.frequency,
      medication.dosage
    );

    if (dailyConsumption <= 0) {
      return null;
    }

    // Get current quantity (estimated or actual)
    const currentQuantity = this.estimateQuantity(medication, dailyConsumption);

    if (currentQuantity === null || currentQuantity <= 0) {
      // Can't predict without quantity
      return null;
    }

    // Calculate days until refill is needed
    const daysUntilRefill = Math.floor(currentQuantity / dailyConsumption);

    // Calculate estimated refill date
    const estimatedRefillDate = new Date();
    estimatedRefillDate.setDate(estimatedRefillDate.getDate() + daysUntilRefill);

    // Determine urgency
    let urgency: "low" | "medium" | "high" | "critical" = "low";
    const reminderDays = medication.refillReminderDays || 7;

    if (daysUntilRefill <= 0) {
      urgency = "critical";
    } else if (daysUntilRefill <= 3) {
      urgency = "high";
    } else if (daysUntilRefill <= reminderDays) {
      urgency = "medium";
    } else {
      urgency = "low";
    }

    const needsRefill = daysUntilRefill <= reminderDays;

    return {
      medicationId: medication.id,
      medicationName: medication.name,
      dosage: medication.dosage,
      currentQuantity,
      quantityUnit: medication.quantityUnit || "units",
      daysUntilRefill,
      estimatedRefillDate,
      urgency,
      needsRefill,
      lastRefillDate: medication.lastRefillDate,
    };
  }

  /**
   * Get refill predictions for all medications
   */
  getRefillPredictions(medications: Medication[]): RefillSummary {
    const predictions: RefillPrediction[] = [];
    let needsRefill = 0;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    medications.forEach((medication) => {
      const prediction = this.calculateRefillPrediction(medication);
      if (prediction) {
        predictions.push(prediction);

        if (prediction.needsRefill) {
          needsRefill++;
        }

        switch (prediction.urgency) {
          case "critical":
            critical++;
            break;
          case "high":
            high++;
            break;
          case "medium":
            medium++;
            break;
          case "low":
            low++;
            break;
        }
      }
    });

    // Sort by urgency (critical first) and days until refill
    predictions.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return a.daysUntilRefill - b.daysUntilRefill;
    });

    return {
      totalMedications: medications.length,
      needsRefill,
      critical,
      high,
      medium,
      low,
      predictions,
    };
  }

  /**
   * Get critical refills (needing immediate attention)
   */
  getCriticalRefills(predictions: RefillPrediction[]): RefillPrediction[] {
    return predictions.filter(
      (p) => p.urgency === "critical" || p.urgency === "high"
    );
  }

  /**
   * Format days until refill as human-readable string
   */
  formatDaysUntilRefill(days: number): string {
    if (days < 0) {
      return "Overdue";
    }
    if (days === 0) {
      return "Today";
    }
    if (days === 1) {
      return "Tomorrow";
    }
    if (days < 7) {
      return `${days} days`;
    }
    if (days < 30) {
      const weeks = Math.floor(days / 7);
      const remainingDays = days % 7;
      if (remainingDays === 0) {
        return `${weeks} week${weeks > 1 ? "s" : ""}`;
      }
      return `${weeks} week${weeks > 1 ? "s" : ""} ${remainingDays} day${remainingDays > 1 ? "s" : ""}`;
    }
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    if (remainingDays === 0) {
      return `${months} month${months > 1 ? "s" : ""}`;
    }
    return `${months} month${months > 1 ? "s" : ""} ${remainingDays} day${remainingDays > 1 ? "s" : ""}`;
  }
}

export const medicationRefillService = new MedicationRefillService();

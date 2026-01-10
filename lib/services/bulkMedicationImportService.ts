import type { Medication, MedicationReminder } from "@/types";

export interface CSVMedicationRow {
  name: string;
  dosage: string;
  frequency: string;
  startDate: string; // Format: YYYY-MM-DD or MM/DD/YYYY
  endDate?: string; // Optional, same format
  reminderTimes?: string; // Comma-separated times like "08:00,20:00" or "8:00 AM,8:00 PM"
  notes?: string;
}

export interface ParsedMedication {
  name: string;
  dosage: string;
  frequency: string;
  startDate: Date;
  endDate?: Date;
  reminders: MedicationReminder[];
  notes?: string;
  isActive: boolean;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{ row: number; medication: string; error: string }>;
  medications: ParsedMedication[];
}

class BulkMedicationImportService {
  /**
   * Parse CSV content into medication rows
   */
  parseCSV(csvContent: string): CSVMedicationRow[] {
    const lines = csvContent.split("\n").filter((line) => line.trim());
    if (lines.length === 0) {
      return [];
    }

    // Parse header row
    const headers = this.parseCSVLine(lines[0]);
    const headerMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      const normalizedHeader = header.trim().toLowerCase();
      headerMap[normalizedHeader] = index;
    });

    // Map common header variations
    const nameIndex =
      headerMap["name"] ??
      headerMap["medication"] ??
      headerMap["medication name"] ??
      headerMap["drug"] ??
      0;
    const dosageIndex =
      headerMap["dosage"] ??
      headerMap["dose"] ??
      headerMap["strength"] ??
      headerMap["amount"] ??
      1;
    const frequencyIndex =
      headerMap["frequency"] ??
      headerMap["how often"] ??
      headerMap["times per day"] ??
      headerMap["schedule"] ??
      2;
    const startDateIndex =
      headerMap["start date"] ??
      headerMap["start"] ??
      headerMap["started"] ??
      headerMap["date started"] ??
      3;
    const endDateIndex =
      headerMap["end date"] ??
      headerMap["end"] ??
      headerMap["ended"] ??
      headerMap["date ended"] ??
      -1;
    const reminderIndex =
      headerMap["reminders"] ??
      headerMap["reminder times"] ??
      headerMap["times"] ??
      headerMap["schedule times"] ??
      -1;
    const notesIndex =
      headerMap["notes"] ??
      headerMap["note"] ??
      headerMap["comments"] ??
      headerMap["remarks"] ??
      -1;

    // Parse data rows
    const medications: CSVMedicationRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const medication: CSVMedicationRow = {
        name: values[nameIndex]?.trim() || "",
        dosage: values[dosageIndex]?.trim() || "",
        frequency: values[frequencyIndex]?.trim() || "",
        startDate: values[startDateIndex]?.trim() || "",
        endDate: endDateIndex >= 0 ? values[endDateIndex]?.trim() : undefined,
        reminderTimes:
          reminderIndex >= 0 ? values[reminderIndex]?.trim() : undefined,
        notes: notesIndex >= 0 ? values[notesIndex]?.trim() : undefined,
      };

      if (medication.name) {
        medications.push(medication);
      }
    }

    return medications;
  }

  /**
   * Parse a CSV line handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        // End of field
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current);
    return result;
  }

  /**
   * Parse date string in various formats
   */
  private parseDate(dateStr: string): Date | null {
    if (!dateStr || !dateStr.trim()) {
      return null;
    }

    // Try ISO format (YYYY-MM-DD)
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return new Date(
        Number.parseInt(year),
        Number.parseInt(month) - 1,
        Number.parseInt(day)
      );
    }

    // Try US format (MM/DD/YYYY or M/D/YYYY)
    const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) {
      const [, month, day, year] = usMatch;
      return new Date(
        Number.parseInt(year),
        Number.parseInt(month) - 1,
        Number.parseInt(day)
      );
    }

    // Try European format (DD/MM/YYYY)
    const euMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (euMatch) {
      const [, day, month, year] = euMatch;
      return new Date(
        Number.parseInt(year),
        Number.parseInt(month) - 1,
        Number.parseInt(day)
      );
    }

    // Try Date.parse as fallback
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) {
      return new Date(parsed);
    }

    return null;
  }

  /**
   * Parse reminder times string
   */
  private parseReminderTimes(
    timesStr: string | undefined,
    frequency: string
  ): MedicationReminder[] {
    const reminders: MedicationReminder[] = [];

    if (timesStr) {
      // Split by comma or semicolon
      const timeStrings = timesStr.split(/[,;]/).map((t) => t.trim());
      timeStrings.forEach((timeStr) => {
        const time = this.parseTimeString(timeStr);
        if (time) {
          reminders.push({
            id: `reminder-${Date.now()}-${Math.random()}`,
            time,
            taken: false,
          });
        }
      });
    }

    // If no reminders provided, generate based on frequency
    if (reminders.length === 0) {
      reminders.push(...this.generateRemindersFromFrequency(frequency));
    }

    return reminders;
  }

  /**
   * Parse time string in various formats (24h, 12h, etc.)
   */
  private parseTimeString(timeStr: string): string | null {
    if (!timeStr || !timeStr.trim()) {
      return null;
    }

    const trimmed = timeStr.trim();

    // Try 24-hour format (HH:MM)
    const time24Match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (time24Match) {
      const [, hour, minute] = time24Match;
      const h = Number.parseInt(hour);
      const m = Number.parseInt(minute);
      if (h >= 0 && h < 24 && m >= 0 && m < 60) {
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      }
    }

    // Try 12-hour format (H:MM AM/PM)
    const time12Match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/i);
    if (time12Match) {
      const [, hour, minute, period] = time12Match;
      let h = Number.parseInt(hour);
      const m = Number.parseInt(minute);

      if (period.toUpperCase() === "PM" && h !== 12) {
        h += 12;
      } else if (period.toUpperCase() === "AM" && h === 12) {
        h = 0;
      }

      if (h >= 0 && h < 24 && m >= 0 && m < 60) {
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      }
    }

    // Try just hour (assume :00 minutes)
    const hourMatch = trimmed.match(/^(\d{1,2})\s*(AM|PM|am|pm)?$/i);
    if (hourMatch) {
      const [, hour, period] = hourMatch;
      let h = Number.parseInt(hour);
      if (period) {
        if (period.toUpperCase() === "PM" && h !== 12) {
          h += 12;
        } else if (period.toUpperCase() === "AM" && h === 12) {
          h = 0;
        }
      }
      if (h >= 0 && h < 24) {
        return `${h.toString().padStart(2, "0")}:00`;
      }
    }

    return null;
  }

  /**
   * Generate default reminders based on frequency
   */
  private generateRemindersFromFrequency(
    frequency: string
  ): MedicationReminder[] {
    const frequencyLower = frequency.toLowerCase();
    const reminders: MedicationReminder[] = [];

    if (
      frequencyLower.includes("once") ||
      frequencyLower === "1" ||
      frequencyLower === "qd"
    ) {
      reminders.push({
        id: `reminder-${Date.now()}-${Math.random()}`,
        time: "09:00",
        taken: false,
      });
    } else if (
      frequencyLower.includes("twice") ||
      frequencyLower === "2" ||
      frequencyLower === "bid"
    ) {
      reminders.push(
        {
          id: `reminder-${Date.now()}-${Math.random()}`,
          time: "09:00",
          taken: false,
        },
        {
          id: `reminder-${Date.now()}-${Math.random()}-2`,
          time: "21:00",
          taken: false,
        }
      );
    } else if (
      frequencyLower.includes("three") ||
      frequencyLower.includes("thrice") ||
      frequencyLower === "3" ||
      frequencyLower === "tid"
    ) {
      reminders.push(
        {
          id: `reminder-${Date.now()}-${Math.random()}`,
          time: "08:00",
          taken: false,
        },
        {
          id: `reminder-${Date.now()}-${Math.random()}-2`,
          time: "14:00",
          taken: false,
        },
        {
          id: `reminder-${Date.now()}-${Math.random()}-3`,
          time: "20:00",
          taken: false,
        }
      );
    } else if (frequencyLower.includes("meal")) {
      reminders.push(
        {
          id: `reminder-${Date.now()}-${Math.random()}`,
          time: "08:00",
          taken: false,
        },
        {
          id: `reminder-${Date.now()}-${Math.random()}-2`,
          time: "13:00",
          taken: false,
        },
        {
          id: `reminder-${Date.now()}-${Math.random()}-3`,
          time: "19:00",
          taken: false,
        }
      );
    } else {
      // Default: once daily at 9 AM
      reminders.push({
        id: `reminder-${Date.now()}-${Math.random()}`,
        time: "09:00",
        taken: false,
      });
    }

    return reminders;
  }

  /**
   * Validate and parse medications from CSV rows
   */
  parseMedications(
    csvRows: CSVMedicationRow[],
    userId: string
  ): ImportResult {
    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
      medications: [],
    };

    csvRows.forEach((row, index) => {
      try {
        // Validate required fields
        if (!row.name || !row.name.trim()) {
          result.errors.push({
            row: index + 2, // +2 because of header and 0-indexing
            medication: row.name || "Unknown",
            error: "Medication name is required",
          });
          result.failed++;
          return;
        }

        if (!row.dosage || !row.dosage.trim()) {
          result.errors.push({
            row: index + 2,
            medication: row.name,
            error: "Dosage is required",
          });
          result.failed++;
          return;
        }

        if (!row.frequency || !row.frequency.trim()) {
          result.errors.push({
            row: index + 2,
            medication: row.name,
            error: "Frequency is required",
          });
          result.failed++;
          return;
        }

        if (!row.startDate || !row.startDate.trim()) {
          result.errors.push({
            row: index + 2,
            medication: row.name,
            error: "Start date is required",
          });
          result.failed++;
          return;
        }

        // Parse dates
        const startDate = this.parseDate(row.startDate);
        if (!startDate || isNaN(startDate.getTime())) {
          result.errors.push({
            row: index + 2,
            medication: row.name,
            error: `Invalid start date format: ${row.startDate}. Use YYYY-MM-DD or MM/DD/YYYY`,
          });
          result.failed++;
          return;
        }

        let endDate: Date | undefined;
        if (row.endDate && row.endDate.trim()) {
          const parsed = this.parseDate(row.endDate);
          if (parsed && !isNaN(parsed.getTime())) {
            endDate = parsed;
          }
          // If end date is invalid, we'll just ignore it and continue
        }

        // Parse reminders
        const reminders = this.parseReminderTimes(row.reminderTimes, row.frequency);

        // Create medication object
        const medication: ParsedMedication = {
          name: row.name.trim(),
          dosage: row.dosage.trim(),
          frequency: row.frequency.trim(),
          startDate,
          endDate,
          reminders,
          notes: row.notes?.trim(),
          isActive: true,
        };

        result.medications.push(medication);
        result.imported++;
      } catch (error) {
        result.errors.push({
          row: index + 2,
          medication: row.name || "Unknown",
          error:
            error instanceof Error ? error.message : "Unknown parsing error",
        });
        result.failed++;
      }
    });

    result.success = result.failed === 0;
    return result;
  }

  /**
   * Generate CSV template for download
   */
  generateCSVTemplate(): string {
    return `Name,Dosage,Frequency,Start Date,End Date,Reminder Times,Notes
Paracetamol,500mg,Once daily,2024-01-01,,09:00,For pain relief
Ibuprofen,200mg,Twice daily,2024-01-01,,09:00 21:00,Take with food
Metformin,500mg,Twice daily,2024-01-01,2024-06-01,08:00 20:00,With meals`;
  }

  /**
   * Import medications from CSV content
   */
  async importFromCSV(
    csvContent: string,
    userId: string
  ): Promise<ImportResult> {
    const csvRows = this.parseCSV(csvContent);
    return this.parseMedications(csvRows, userId);
  }
}

export const bulkMedicationImportService = new BulkMedicationImportService();

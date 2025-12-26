/**
 * Metrics Export Service
 * Handles exporting health metrics to CSV or PDF format
 * Includes: Vitals, Symptoms, Medical History, Medications, and Moods
 */

import * as FileSystem from "expo-file-system";
import { Platform, Share } from "react-native";
import { auth } from "../firebase";
import type { HealthProvider } from "../health/healthMetricsCatalog";
import { getProviderConnection } from "../health/healthSync";
import type { NormalizedMetricPayload } from "../health/healthTypes";
import { medicalHistoryService } from "./medicalHistoryService";
import { medicationService } from "./medicationService";
import { moodService } from "./moodService";
import { symptomService } from "./symptomService";
import type { MedicalHistory, Medication, Mood, Symptom } from "@/types";

export type ExportFormat = "csv" | "pdf";

export interface ExportOptions {
  format: ExportFormat;
  startDate?: Date;
  endDate?: Date;
  provider?: HealthProvider; // If not specified, exports from all connected providers
  userId?: string; // User ID for fetching symptoms, medications, medical history, and moods
}

export interface HealthReportData {
  vitals: NormalizedMetricPayload[];
  symptoms: Symptom[];
  medications: Medication[];
  medicalHistory: MedicalHistory[];
  moods: Mood[];
}

/**
 * Fetch metrics from all available providers (including all available metrics)
 */
const fetchMetricsForExport = async (
  options: ExportOptions
): Promise<NormalizedMetricPayload[]> => {
  const endDate = options.endDate || new Date();
  const startDate =
    options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days

  const { getAvailableMetricsForProvider } = await import(
    "../health/healthMetricsCatalog"
  );

  const allMetrics: NormalizedMetricPayload[] = [];

  // Determine which providers to fetch from based on platform and availability
  const providersToTry: HealthProvider[] = [];

  if (options.provider) {
    providersToTry.push(options.provider);
  } else {
    // Try all providers based on platform
    if (Platform.OS === "ios") {
      providersToTry.push("apple_health");
    } else if (Platform.OS === "android") {
      providersToTry.push("health_connect");
    }
    // Always try Fitbit if available
    providersToTry.push("fitbit");
  }

  for (const provider of providersToTry) {
    try {
      // Check if provider is connected
      const connection = await getProviderConnection(provider);

      // Get all available metrics for this provider
      const availableMetrics = getAvailableMetricsForProvider(provider);

      if (availableMetrics.length === 0) {
        continue;
      }

      // Use "all" to fetch all available metrics, or use selected metrics if connected
      const metricsToFetch =
        connection?.connected && connection.selectedMetrics.length > 0
          ? connection.selectedMetrics
          : availableMetrics.map((m) => m.key);

      let metrics: NormalizedMetricPayload[] = [];

      switch (provider) {
        case "apple_health": {
          // Check if HealthKit is available
          const { appleHealthService } = await import("./appleHealthService");
          const availability = await appleHealthService.checkAvailability();
          if (!availability.available) {
            continue;
          }

          metrics = await appleHealthService.fetchMetrics(
            metricsToFetch,
            startDate,
            endDate
          );
          break;
        }
        case "health_connect": {
          const { healthConnectService } = await import(
            "./healthConnectService"
          );
          metrics = await healthConnectService.fetchMetrics(
            metricsToFetch,
            startDate,
            endDate
          );
          break;
        }
        case "fitbit": {
          // Only fetch if connected
          if (!connection?.connected) {
            continue;
          }
          const { fitbitService } = await import("./fitbitService");
          metrics = await fitbitService.fetchMetrics(
            metricsToFetch,
            startDate,
            endDate
          );
          break;
        }
      }

      allMetrics.push(...metrics);
    } catch (error: any) {
      console.error(
        `[Metrics Export] Error fetching metrics from ${provider}:`,
        error?.message || String(error)
      );
      // Continue with other providers even if one fails
    }
  }

  // If no metrics were fetched from providers, create a catalog export with available metrics info
  if (allMetrics.length === 0) {
    const availableMetrics =
      Platform.OS === "ios"
        ? getAvailableMetricsForProvider("apple_health")
        : Platform.OS === "android"
          ? getAvailableMetricsForProvider("health_connect")
          : [];

    // Create empty metrics entries for available metrics (for catalog reference)
    for (const metric of availableMetrics) {
      allMetrics.push({
        provider: Platform.OS === "ios" ? "apple_health" : "health_connect",
        metricKey: metric.key,
        displayName: metric.displayName,
        unit: metric.unit,
        samples: [], // No data available
      });
    }
  }

  return allMetrics;
};

/**
 * Fetch all health data (vitals, symptoms, medications, medical history, moods)
 */
const fetchAllHealthData = async (
  options: ExportOptions
): Promise<HealthReportData> => {
  const endDate = options.endDate || new Date();
  const startDate =
    options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const userId = options.userId || auth.currentUser?.uid;

  // Fetch vitals metrics
  const vitals = await fetchMetricsForExport(options);

  // Fetch other health data if userId is available
  let symptoms: Symptom[] = [];
  let medications: Medication[] = [];
  let medicalHistory: MedicalHistory[] = [];
  let moods: Mood[] = [];

  if (userId) {
    try {
      // Fetch symptoms within date range
      const allSymptoms = await symptomService.getUserSymptoms(userId, 1000);
      symptoms = allSymptoms.filter(
        (s) =>
          new Date(s.timestamp).getTime() >= startDate.getTime() &&
          new Date(s.timestamp).getTime() <= endDate.getTime()
      );

      // Fetch all medications (not filtered by date as they're ongoing)
      medications = await medicationService.getUserMedications(userId);

      // Fetch medical history (not filtered by date)
      medicalHistory = await medicalHistoryService.getUserMedicalHistory(userId);

      // Fetch moods within date range
      const allMoods = await moodService.getUserMoods(userId, 1000);
      moods = allMoods.filter(
        (m) =>
          new Date(m.timestamp).getTime() >= startDate.getTime() &&
          new Date(m.timestamp).getTime() <= endDate.getTime()
      );
    } catch (error) {
      console.error("[Health Report] Error fetching health data:", error);
      // Continue with vitals only if other data fails
    }
  }

  return {
    vitals,
    symptoms,
    medications,
    medicalHistory,
    moods,
  };
};

/**
 * Convert health data to CSV format
 */
const convertToCSV = (data: HealthReportData): string => {
  const rows: string[] = [];

  // Vitals Section
  rows.push("=== VITALS METRICS ===");
  if (data.vitals.length === 0) {
    rows.push("Metric,Display Name,Unit,Value,Start Date,End Date,Source");
    rows.push("No vitals data available");
  } else {
    rows.push("Metric,Display Name,Unit,Value,Start Date,End Date,Source");
    for (const metric of data.vitals) {
      for (const sample of metric.samples) {
        const row = [
          metric.metricKey,
          `"${metric.displayName.replace(/"/g, '""')}"`,
          metric.unit || "",
          sample.value.toString(),
          sample.startDate,
          sample.endDate || "",
          sample.source || metric.provider,
        ];
        rows.push(row.join(","));
      }
    }
  }

  rows.push("\n=== SYMPTOMS ===");
  if (data.symptoms.length === 0) {
    rows.push("Type,Severity,Description,Date,Location,Duration");
    rows.push("No symptoms recorded");
  } else {
    rows.push("Type,Severity,Description,Date,Location,Duration");
    for (const symptom of data.symptoms) {
      const row = [
        `"${symptom.type.replace(/"/g, '""')}"`,
        symptom.severity.toString(),
        `"${(symptom.description || "").replace(/"/g, '""')}"`,
        new Date(symptom.timestamp).toLocaleDateString(),
        `"${(symptom.location || "").replace(/"/g, '""')}"`,
        `"${(symptom.triggers?.join(", ") || "").replace(/"/g, '""')}"`,
      ];
      rows.push(row.join(","));
    }
  }

  rows.push("\n=== MEDICATIONS ===");
  if (data.medications.length === 0) {
    rows.push("Name,Dosage,Frequency,Start Date,End Date,Status,Notes");
    rows.push("No medications recorded");
  } else {
    rows.push("Name,Dosage,Frequency,Start Date,End Date,Status,Notes");
    for (const med of data.medications) {
      const row = [
        `"${med.name.replace(/"/g, '""')}"`,
        `"${med.dosage.replace(/"/g, '""')}"`,
        `"${med.frequency.replace(/"/g, '""')}"`,
        new Date(med.startDate).toLocaleDateString(),
        med.endDate ? new Date(med.endDate).toLocaleDateString() : "Ongoing",
        med.isActive ? "Active" : "Inactive",
        `"${(med.notes || "").replace(/"/g, '""')}"`,
      ];
      rows.push(row.join(","));
    }
  }

  rows.push("\n=== MEDICAL HISTORY ===");
  if (data.medicalHistory.length === 0) {
    rows.push("Condition,Diagnosed Date,Severity,Status,Notes,Is Family");
    rows.push("No medical history recorded");
  } else {
    rows.push("Condition,Diagnosed Date,Severity,Status,Notes,Is Family,Relation");
    for (const history of data.medicalHistory) {
      const row = [
        `"${history.condition.replace(/"/g, '""')}"`,
        history.diagnosedDate
          ? new Date(history.diagnosedDate).toLocaleDateString()
          : "Unknown",
        history.severity || "Not specified",
        "Ongoing",
        `"${(history.notes || "").replace(/"/g, '""')}"`,
        history.isFamily ? "Yes" : "No",
        history.relation || "",
      ];
      rows.push(row.join(","));
    }
  }

  rows.push("\n=== MOODS ===");
  if (data.moods.length === 0) {
    rows.push("Mood,Intensity,Notes,Date");
    rows.push("No moods recorded");
  } else {
    rows.push("Mood,Intensity,Notes,Date");
    for (const mood of data.moods) {
      const row = [
        mood.mood,
        mood.intensity.toString(),
        `"${(mood.notes || "").replace(/"/g, '""')}"`,
        new Date(mood.timestamp).toLocaleString(),
      ];
      rows.push(row.join(","));
    }
  }

  return rows.join("\n");
};

/**
 * Convert health data to PDF format (HTML that will be converted to PDF)
 */
const convertToPDFHTML = (
  data: HealthReportData,
  startDate: Date,
  endDate: Date
): string => {
  const exportDate = new Date().toLocaleDateString();
  const dateRange = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;

  const totalVitalSamples = data.vitals.reduce(
    (sum, m) => sum + m.samples.length,
    0
  );
  const providers = [...new Set(data.vitals.map((m) => m.provider))];

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
          line-height: 1.6;
        }
        .header {
          border-bottom: 3px solid #007AFF;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #007AFF;
          margin: 0 0 10px 0;
          font-size: 28px;
        }
        .header-info {
          color: #666;
          font-size: 14px;
        }
        .summary {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .summary h2 {
          margin-top: 0;
          color: #333;
          font-size: 18px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin-top: 10px;
        }
        .summary-item {
          background: white;
          padding: 10px;
          border-radius: 6px;
        }
        .summary-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .summary-value {
          font-size: 20px;
          font-weight: bold;
          color: #007AFF;
        }
        .metric-section {
          margin-bottom: 40px;
          page-break-inside: avoid;
        }
        .metric-header {
          background: #007AFF;
          color: white;
          padding: 12px 15px;
          border-radius: 6px 6px 0 0;
          font-weight: bold;
          font-size: 16px;
        }
        .metric-content {
          border: 1px solid #ddd;
          border-top: none;
          padding: 15px;
          border-radius: 0 0 6px 6px;
        }
        .metric-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #eee;
        }
        .metric-info-item {
          flex: 1;
        }
        .metric-info-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
        }
        .metric-info-value {
          font-size: 14px;
          color: #333;
          margin-top: 5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        th {
          background: #f8f8f8;
          padding: 10px;
          text-align: left;
          font-weight: bold;
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          border-bottom: 2px solid #ddd;
        }
        td {
          padding: 10px;
          border-bottom: 1px solid #eee;
          font-size: 13px;
        }
        tr:hover {
          background: #f9f9f9;
        }
        .no-data {
          text-align: center;
          color: #999;
          padding: 20px;
          font-style: italic;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          text-align: center;
          color: #999;
          font-size: 12px;
        }
        @media print {
          .metric-section {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Comprehensive Health Report</h1>
        <div class="header-info">
          <div>Exported: ${exportDate}</div>
          <div>Date Range: ${dateRange}</div>
          <div>Includes: Vitals, Symptoms, Medications, Medical History, and Moods</div>
        </div>
      </div>

      <div class="summary">
        <h2>Summary</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Vital Metrics</div>
            <div class="summary-value">${data.vitals.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Vital Samples</div>
            <div class="summary-value">${totalVitalSamples}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Symptoms</div>
            <div class="summary-value">${data.symptoms.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Medications</div>
            <div class="summary-value">${data.medications.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Medical Conditions</div>
            <div class="summary-value">${data.medicalHistory.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Mood Entries</div>
            <div class="summary-value">${data.moods.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Data Sources</div>
            <div class="summary-value">${providers.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Sources</div>
            <div class="summary-value">${providers.join(", ") || "N/A"}</div>
          </div>
        </div>
      </div>
  `;

  // Add vitals metrics sections
  for (const metric of data.vitals) {
    html += `
      <div class="metric-section">
        <div class="metric-header">${metric.displayName}</div>
        <div class="metric-content">
          <div class="metric-info">
            <div class="metric-info-item">
              <div class="metric-info-label">Metric Key</div>
              <div class="metric-info-value">${metric.metricKey}</div>
            </div>
            <div class="metric-info-item">
              <div class="metric-info-label">Unit</div>
              <div class="metric-info-value">${metric.unit || "N/A"}</div>
            </div>
            <div class="metric-info-item">
              <div class="metric-info-label">Provider</div>
              <div class="metric-info-value">${metric.provider}</div>
            </div>
            <div class="metric-info-item">
              <div class="metric-info-label">Samples</div>
              <div class="metric-info-value">${metric.samples.length}</div>
            </div>
          </div>
    `;

    if (metric.samples.length > 0) {
      html += `
          <table>
            <thead>
              <tr>
                <th>Value</th>
                <th>Unit</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
      `;

      // Limit to first 100 samples to avoid huge PDFs
      const samplesToShow = metric.samples.slice(0, 100);
      for (const sample of samplesToShow) {
        const startDateFormatted = new Date(sample.startDate).toLocaleString();
        const endDateFormatted = sample.endDate
          ? new Date(sample.endDate).toLocaleString()
          : "N/A";

        html += `
              <tr>
                <td>${sample.value}</td>
                <td>${sample.unit || metric.unit || ""}</td>
                <td>${startDateFormatted}</td>
                <td>${endDateFormatted}</td>
                <td>${sample.source || metric.provider}</td>
              </tr>
        `;
      }

      if (metric.samples.length > 100) {
        html += `
              <tr>
                <td colspan="5" style="text-align: center; color: #999; font-style: italic;">
                  ... and ${metric.samples.length - 100} more samples
                </td>
              </tr>
        `;
      }

      html += `
            </tbody>
          </table>
      `;
    } else {
      html += `
          <div class="no-data">No data available for this metric</div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  // Add Symptoms Section
  html += `
      <div class="metric-section">
        <div class="metric-header" style="background: #EF4444;">Symptoms</div>
        <div class="metric-content">
  `;
  if (data.symptoms.length === 0) {
    html += `<div class="no-data">No symptoms recorded in this period</div>`;
  } else {
    html += `
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Severity</th>
                <th>Date</th>
                <th>Location</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
    `;
    const symptomsToShow = data.symptoms.slice(0, 100);
    for (const symptom of symptomsToShow) {
      html += `
              <tr>
                <td>${symptom.type}</td>
                <td>${symptom.severity}/5</td>
                <td>${new Date(symptom.timestamp).toLocaleDateString()}</td>
                <td>${symptom.location || "N/A"}</td>
                <td>${(symptom.description || "").substring(0, 50)}${(symptom.description || "").length > 50 ? "..." : ""}</td>
              </tr>
      `;
    }
    if (data.symptoms.length > 100) {
      html += `
              <tr>
                <td colspan="5" style="text-align: center; color: #999; font-style: italic;">
                  ... and ${data.symptoms.length - 100} more symptoms
                </td>
              </tr>
      `;
    }
    html += `
            </tbody>
          </table>
    `;
  }
  html += `
        </div>
      </div>
  `;

  // Add Medications Section
  html += `
      <div class="metric-section">
        <div class="metric-header" style="background: #3B82F6;">Medications</div>
        <div class="metric-content">
  `;
  if (data.medications.length === 0) {
    html += `<div class="no-data">No medications recorded</div>`;
  } else {
    html += `
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Dosage</th>
                <th>Frequency</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
    `;
    for (const med of data.medications) {
      html += `
              <tr>
                <td>${med.name}</td>
                <td>${med.dosage}</td>
                <td>${med.frequency}</td>
                <td>${new Date(med.startDate).toLocaleDateString()}</td>
                <td>${med.endDate ? new Date(med.endDate).toLocaleDateString() : "Ongoing"}</td>
                <td>${med.isActive ? "Active" : "Inactive"}</td>
              </tr>
      `;
    }
    html += `
            </tbody>
          </table>
    `;
  }
  html += `
        </div>
      </div>
  `;

  // Add Medical History Section
  html += `
      <div class="metric-section">
        <div class="metric-header" style="background: #8B5CF6;">Medical History</div>
        <div class="metric-content">
  `;
  if (data.medicalHistory.length === 0) {
    html += `<div class="no-data">No medical history recorded</div>`;
  } else {
    html += `
          <table>
            <thead>
              <tr>
                <th>Condition</th>
                <th>Diagnosed Date</th>
                <th>Severity</th>
                <th>Type</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
    `;
    for (const history of data.medicalHistory) {
      html += `
              <tr>
                <td>${history.condition}</td>
                <td>${history.diagnosedDate ? new Date(history.diagnosedDate).toLocaleDateString() : "Unknown"}</td>
                <td>${history.severity || "Not specified"}</td>
                <td>${history.isFamily ? `Family (${history.relation || "N/A"})` : "Personal"}</td>
                <td>${(history.notes || "").substring(0, 50)}${(history.notes || "").length > 50 ? "..." : ""}</td>
              </tr>
      `;
    }
    html += `
            </tbody>
          </table>
    `;
  }
  html += `
        </div>
      </div>
  `;

  // Add Moods Section
  html += `
      <div class="metric-section">
        <div class="metric-header" style="background: #10B981;">Mood Tracking</div>
        <div class="metric-content">
  `;
  if (data.moods.length === 0) {
    html += `<div class="no-data">No moods recorded in this period</div>`;
  } else {
    // Calculate mood statistics
    const moodCounts: { [key: string]: number } = {};
    let totalIntensity = 0;
    data.moods.forEach((mood) => {
      moodCounts[mood.mood] = (moodCounts[mood.mood] || 0) + 1;
      totalIntensity += mood.intensity;
    });
    const avgIntensity = data.moods.length > 0 ? (totalIntensity / data.moods.length).toFixed(1) : "0";

    html += `
          <div style="margin-bottom: 15px; padding: 10px; background: #f8f8f8; border-radius: 6px;">
            <strong>Summary:</strong> ${data.moods.length} entries | Average Intensity: ${avgIntensity}/5
          </div>
          <table>
            <thead>
              <tr>
                <th>Mood</th>
                <th>Intensity</th>
                <th>Date</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
    `;
    const moodsToShow = data.moods.slice(0, 100);
    for (const mood of moodsToShow) {
      html += `
              <tr>
                <td>${mood.mood}</td>
                <td>${mood.intensity}/5</td>
                <td>${new Date(mood.timestamp).toLocaleString()}</td>
                <td>${(mood.notes || "").substring(0, 50)}${(mood.notes || "").length > 50 ? "..." : ""}</td>
              </tr>
      `;
    }
    if (data.moods.length > 100) {
      html += `
              <tr>
                <td colspan="4" style="text-align: center; color: #999; font-style: italic;">
                  ... and ${data.moods.length - 100} more mood entries
                </td>
              </tr>
      `;
    }
    html += `
            </tbody>
          </table>
    `;
  }
  html += `
        </div>
      </div>
  `;

  html += `
      <div class="footer">
        Generated by Maak Health App • ${exportDate}
      </div>
    </body>
    </html>
  `;

  return html;
};

/**
 * Export metrics to file and share
 */
export const exportMetrics = async (
  options: ExportOptions,
  onProgress?: (message: string) => void
): Promise<void> => {
  try {
    onProgress?.("Fetching health data...");

    // Fetch all health data (vitals, symptoms, medications, medical history, moods)
    const healthData = await fetchAllHealthData(options);

    // Check if we have any data to export
    const hasData =
      healthData.vitals.length > 0 ||
      healthData.symptoms.length > 0 ||
      healthData.medications.length > 0 ||
      healthData.medicalHistory.length > 0 ||
      healthData.moods.length > 0;

    if (!hasData) {
      throw new Error("No health data available to export");
    }

    onProgress?.("Preparing export file...");

    // Convert to requested format
    let fileUri: string;
    let fileName: string;
    let mimeType: string;

    const startDate =
      options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = options.endDate || new Date();

    if (options.format === "csv") {
      const content = convertToCSV(healthData);
      fileName = `health-report-${new Date().toISOString().split("T")[0]}.csv`;
      mimeType = "text/csv";

      // Save CSV to document directory for sharing
      fileUri = `${FileSystem.documentDirectory || ''}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, content);
    } else {
      // PDF format
      fileName = `health-report-${new Date().toISOString().split("T")[0]}.pdf`;
      mimeType = "application/pdf";

      onProgress?.("Generating PDF...");

      // Generate HTML for PDF
      const html = convertToPDFHTML(healthData, startDate, endDate);

      // Generate PDF using expo-print (dynamic import to handle missing native module)
      try {
        // Check platform - expo-print doesn't work on web
        if (Platform.OS === "web") {
          throw new Error(
            "PDF export is not available on web. Please use CSV format instead or use a native device."
          );
        }

        const Print = await import("expo-print");

        // Check if the function exists (handles cases where module loads but native code isn't linked)
        if (
          !Print.printToFileAsync ||
          typeof Print.printToFileAsync !== "function"
        ) {
          throw new Error(
            "PDF export requires rebuilding the app. The expo-print native module is not available.\n\n" +
              "To rebuild:\n" +
              "- iOS: npx expo run:ios\n" +
              "- Android: npx expo run:android"
          );
        }

        const { uri } = await Print.printToFileAsync({
          html,
          base64: false,
        });

        fileUri = uri;
      } catch (error: any) {
        // Check if it's a native module error or function not found
        const errorMessage = error?.message || String(error);
        const isNativeModuleError =
          errorMessage.includes("native module") ||
          errorMessage.includes("ExpoPrint") ||
          errorMessage.includes("expo-print") ||
          errorMessage.includes("is not a function") ||
          error?.code === "ERR_MODULE_NOT_FOUND";

        if (isNativeModuleError) {
          throw new Error(
            "PDF export requires rebuilding the app. The expo-print native module is not available.\n\n" +
              "To rebuild:\n" +
              "- iOS: npx expo run:ios\n" +
              "- Android: npx expo run:android\n\n" +
              "Alternatively, use CSV format which doesn't require native modules."
          );
        }
        throw error;
      }
    }

    onProgress?.("Sharing file...");

    // Try to use expo-sharing if available, otherwise fall back to React Native Share
    try {
      // Try to import expo-sharing dynamically
      const Sharing = await import("expo-sharing");
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        // Use expo-sharing for better cross-platform file sharing
        await Sharing.shareAsync(fileUri, {
          mimeType,
          dialogTitle: "Export Health Report",
        });
        onProgress?.("Export completed successfully");
        return;
      }
    } catch (error) {
      // expo-sharing not available, fall through to React Native Share
      // Silently handle fallback
    }

    // Fallback: Use React Native Share API
    // On iOS, Share can handle file URLs directly
    // On Android, for CSV we'll share as text content, for PDF we need expo-sharing
    if (Platform.OS === "ios") {
      const shareResult = await Share.share({
        url: fileUri,
        title: "Export Health Report",
      });

      if (shareResult.action === Share.sharedAction) {
        onProgress?.("Export completed successfully");
      } else if (shareResult.action === Share.dismissedAction) {
        onProgress?.("Export cancelled");
      }
    } else {
      // Android: For CSV, share as text content
      // For PDF, expo-sharing should have been used above, but if it failed, show error
      if (options.format === "csv") {
        const content = convertToCSV(healthData);
        const shareResult = await Share.share({
          message: `Health Report Export\n\nFile: ${fileName}\n\n${content.substring(0, 1000)}${content.length > 1000 ? "\n\n... (truncated, use export to get full file)" : ""}`,
          title: "Export Health Report",
        });

        if (shareResult.action === Share.sharedAction) {
          onProgress?.("Export completed successfully");
        } else if (shareResult.action === Share.dismissedAction) {
          onProgress?.("Export cancelled");
        }
      } else {
        // PDF on Android - expo-sharing should have worked above
        // If we reach here, sharing failed
        throw new Error(
          "Unable to share PDF file. Please ensure expo-sharing is properly configured."
        );
      }
    }
  } catch (error: any) {
    console.error(
      "[Metrics Export] Export error:",
      error?.message || String(error)
    );
    throw error;
  }
};

/**
 * Get export statistics (number of metrics, samples, date range)
 */
export const getExportStats = async (
  options: Omit<ExportOptions, "format">
): Promise<{
  vitalsMetricsCount: number;
  vitalsSamplesCount: number;
  symptomsCount: number;
  medicationsCount: number;
  medicalHistoryCount: number;
  moodsCount: number;
  dateRange: { startDate: string; endDate: string };
  providers: string[];
}> => {
  const healthData = await fetchAllHealthData({
    ...options,
    format: "csv", // Format doesn't matter for stats
  });

  const vitalsSamplesCount = healthData.vitals.reduce(
    (sum, m) => sum + m.samples.length,
    0
  );
  const providers = [...new Set(healthData.vitals.map((m) => m.provider))];
  const endDate = options.endDate || new Date();
  const startDate =
    options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return {
    vitalsMetricsCount: healthData.vitals.length,
    vitalsSamplesCount,
    symptomsCount: healthData.symptoms.length,
    medicationsCount: healthData.medications.length,
    medicalHistoryCount: healthData.medicalHistory.length,
    moodsCount: healthData.moods.length,
    dateRange: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    providers,
  };
};

/**
 * Metrics Export Service
 * Handles exporting health metrics to CSV or PDF format
 * Includes: Vitals, Symptoms, Medical History, Medications, and Moods
 */

import { Paths, writeAsStringAsync } from "expo-file-system";
import { Platform, Share } from "react-native";
import { logger } from "@/lib/utils/logger";
import type { MedicalHistory, Medication, Mood, Symptom } from "@/types";
import { safeFormatDate, safeFormatDateTime } from "@/utils/dateFormat";
import { auth } from "../firebase";
import type { HealthProvider } from "../health/healthMetricsCatalog";
import { getProviderConnection } from "../health/healthSync";
import type { NormalizedMetricPayload } from "../health/healthTypes";
import { medicalHistoryService } from "./medicalHistoryService";
import { medicationService } from "./medicationService";
import { moodService } from "./moodService";
import { symptomService } from "./symptomService";

export type ExportFormat = "csv" | "pdf";

export type ExportOptions = {
  format: ExportFormat;
  startDate?: Date;
  endDate?: Date;
  provider?: HealthProvider; // If not specified, exports from all connected providers
  userId?: string; // User ID for fetching symptoms, medications, medical history, and moods
};

export type HealthReportData = {
  vitals: NormalizedMetricPayload[];
  symptoms: Symptom[];
  medications: Medication[];
  medicalHistory: MedicalHistory[];
  moods: Mood[];
};

type ProviderConnection = Awaited<ReturnType<typeof getProviderConnection>>;

const getExportDateRange = (
  options: ExportOptions
): {
  startDate: Date;
  endDate: Date;
} => {
  const endDate = options.endDate || new Date();
  const startDate =
    options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return { startDate, endDate };
};

const getProvidersToTry = (options: ExportOptions): HealthProvider[] => {
  if (options.provider) {
    return [options.provider];
  }

  const providersToTry: HealthProvider[] = [];
  if (Platform.OS === "ios") {
    providersToTry.push("apple_health");
  } else if (Platform.OS === "android") {
    providersToTry.push("health_connect");
  }
  providersToTry.push("fitbit");

  return providersToTry;
};

const getMetricKeysToFetch = (
  connection: ProviderConnection,
  availableMetricKeys: string[]
): string[] => {
  if (connection?.connected && connection.selectedMetrics.length > 0) {
    return connection.selectedMetrics;
  }
  return availableMetricKeys;
};

const fetchProviderMetrics = async (params: {
  provider: HealthProvider;
  metricsToFetch: string[];
  startDate: Date;
  endDate: Date;
  connection: ProviderConnection;
}): Promise<NormalizedMetricPayload[]> => {
  const { provider, metricsToFetch, startDate, endDate, connection } = params;
  switch (provider) {
    case "apple_health": {
      const { appleHealthService } = await import("./appleHealthService");
      const availability = await appleHealthService.checkAvailability();
      if (!availability.available) {
        return [];
      }
      return appleHealthService.fetchMetrics(
        metricsToFetch,
        startDate,
        endDate
      );
    }
    case "health_connect": {
      const { healthConnectService } = await import("./healthConnectService");
      return healthConnectService.fetchMetrics(
        metricsToFetch,
        startDate,
        endDate
      );
    }
    case "fitbit": {
      if (!connection?.connected) {
        return [];
      }
      const { fitbitService } = await import("./fitbitService");
      return fitbitService.fetchMetrics(metricsToFetch, startDate, endDate);
    }
    default: {
      return [];
    }
  }
};

const getFallbackProvider = (): "apple_health" | "health_connect" | null => {
  if (Platform.OS === "ios") {
    return "apple_health";
  }
  if (Platform.OS === "android") {
    return "health_connect";
  }
  return null;
};

const appendCatalogFallbackMetrics = (
  allMetrics: NormalizedMetricPayload[],
  getAvailableMetricsForProvider: (provider: HealthProvider) => Array<{
    key: string;
    displayName: string;
    unit?: string;
  }>
): void => {
  if (allMetrics.length > 0) {
    return;
  }

  const fallbackProvider = getFallbackProvider();
  if (!fallbackProvider) {
    return;
  }

  const availableMetrics = getAvailableMetricsForProvider(fallbackProvider);
  for (const metric of availableMetrics) {
    allMetrics.push({
      provider: fallbackProvider,
      metricKey: metric.key,
      displayName: metric.displayName,
      unit: metric.unit || "",
      samples: [],
    });
  }
};

/**
 * Fetch metrics from all available providers (including all available metrics)
 */
const fetchMetricsForExport = async (
  options: ExportOptions
): Promise<NormalizedMetricPayload[]> => {
  const { startDate, endDate } = getExportDateRange(options);

  const { getAvailableMetricsForProvider } = await import(
    "../health/healthMetricsCatalog"
  );

  const allMetrics: NormalizedMetricPayload[] = [];
  const providersToTry = getProvidersToTry(options);

  for (const provider of providersToTry) {
    try {
      const connection = await getProviderConnection(provider);
      const availableMetrics = getAvailableMetricsForProvider(provider);
      if (availableMetrics.length === 0) {
        continue;
      }

      const metricsToFetch = getMetricKeysToFetch(
        connection,
        availableMetrics.map((metric) => metric.key)
      );
      const metrics = await fetchProviderMetrics({
        provider,
        metricsToFetch,
        startDate,
        endDate,
        connection,
      });

      allMetrics.push(...metrics);
    } catch (error: unknown) {
      logger.error(
        `Error fetching metrics from ${provider}`,
        error,
        "MetricsExportService"
      );
      // Continue with other providers even if one fails
    }
  }

  appendCatalogFallbackMetrics(allMetrics, getAvailableMetricsForProvider);

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
      medicalHistory =
        await medicalHistoryService.getUserMedicalHistory(userId);

      // Fetch moods within date range
      const allMoods = await moodService.getUserMoods(userId, 1000);
      moods = allMoods.filter(
        (m) =>
          new Date(m.timestamp).getTime() >= startDate.getTime() &&
          new Date(m.timestamp).getTime() <= endDate.getTime()
      );
    } catch (error) {
      logger.error("Error fetching health data", error, "MetricsExportService");
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
 * Metrics that should be aggregated by day (sum all samples for the same day)
 */
const DAILY_AGGREGATE_METRICS = [
  "steps",
  "active_energy",
  "distance_walking_running",
  "flights_climbed",
  "exercise_minutes",
  "stand_time",
  "water_intake",
];

/**
 * Aggregate samples by day for metrics that need daily aggregation
 */
const aggregateSamplesByDay = (
  samples: Array<{
    value: number | string;
    startDate: string;
    endDate?: string;
    source?: string;
  }>,
  metricKey: string
): Array<{ value: number; date: string; sources: string[] }> => {
  if (!DAILY_AGGREGATE_METRICS.includes(metricKey)) {
    // Return samples as-is for non-aggregate metrics
    return samples.map((s) => ({
      value:
        typeof s.value === "number"
          ? s.value
          : Number.parseFloat(s.value.toString()) || 0,
      date: s.startDate,
      sources: s.source ? [s.source] : [],
    }));
  }

  // Group samples by day
  const dailyGroups: Record<string, { value: number; sources: Set<string> }> =
    {};

  for (const sample of samples) {
    const sampleDate = new Date(sample.startDate);
    const dayKey = sampleDate.toISOString().split("T")[0]; // YYYY-MM-DD format

    if (!dailyGroups[dayKey]) {
      dailyGroups[dayKey] = { value: 0, sources: new Set() };
    }

    const numValue =
      typeof sample.value === "number"
        ? sample.value
        : Number.parseFloat(sample.value.toString()) || 0;
    dailyGroups[dayKey].value += numValue;

    if (sample.source) {
      dailyGroups[dayKey].sources.add(sample.source);
    }
  }

  // Convert to array and sort by date
  return Object.entries(dailyGroups)
    .map(([date, data]) => ({
      value: data.value,
      date,
      sources: Array.from(data.sources),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Convert health data to CSV format
 */
const escapeCsvValue = (value: string): string =>
  `"${value.replace(/"/g, '""')}"`;

const addVitalsCsvRows = (
  rows: string[],
  vitals: NormalizedMetricPayload[]
): void => {
  rows.push("=== VITALS METRICS ===");
  rows.push("Metric,Display Name,Unit,Value,Date,Source");

  if (vitals.length === 0) {
    rows.push("No vitals data available");
    return;
  }

  for (const metric of vitals) {
    const aggregatedSamples = aggregateSamplesByDay(
      metric.samples,
      metric.metricKey
    );

    for (const aggregated of aggregatedSamples) {
      rows.push(
        [
          metric.metricKey,
          escapeCsvValue(metric.displayName),
          metric.unit || "",
          aggregated.value.toString(),
          aggregated.date,
          aggregated.sources.length > 0
            ? aggregated.sources.join("; ")
            : metric.provider,
        ].join(",")
      );
    }
  }
};

const addSymptomsCsvRows = (rows: string[], symptoms: Symptom[]): void => {
  rows.push("\n=== SYMPTOMS ===");
  rows.push("Type,Severity,Description,Date,Location,Duration");

  if (symptoms.length === 0) {
    rows.push("No symptoms recorded");
    return;
  }

  for (const symptom of symptoms) {
    rows.push(
      [
        escapeCsvValue(symptom.type),
        symptom.severity.toString(),
        escapeCsvValue(symptom.description || ""),
        safeFormatDate(new Date(symptom.timestamp)),
        escapeCsvValue(symptom.location || ""),
        escapeCsvValue(symptom.triggers?.join(", ") || ""),
      ].join(",")
    );
  }
};

const addMedicationsCsvRows = (
  rows: string[],
  medications: Medication[]
): void => {
  rows.push("\n=== MEDICATIONS ===");
  rows.push("Name,Dosage,Frequency,Start Date,End Date,Status,Notes");

  if (medications.length === 0) {
    rows.push("No medications recorded");
    return;
  }

  for (const medication of medications) {
    rows.push(
      [
        escapeCsvValue(medication.name),
        escapeCsvValue(medication.dosage),
        escapeCsvValue(medication.frequency),
        safeFormatDate(new Date(medication.startDate)),
        medication.endDate
          ? safeFormatDate(new Date(medication.endDate))
          : "Ongoing",
        medication.isActive ? "Active" : "Inactive",
        escapeCsvValue(medication.notes || ""),
      ].join(",")
    );
  }
};

const addMedicalHistoryCsvRows = (
  rows: string[],
  medicalHistory: MedicalHistory[]
): void => {
  rows.push("\n=== MEDICAL HISTORY ===");
  rows.push(
    "Condition,Diagnosed Date,Severity,Status,Notes,Is Family,Relation"
  );

  if (medicalHistory.length === 0) {
    rows.push("No medical history recorded");
    return;
  }

  for (const history of medicalHistory) {
    rows.push(
      [
        escapeCsvValue(history.condition),
        history.diagnosedDate
          ? safeFormatDate(new Date(history.diagnosedDate))
          : "Unknown",
        history.severity || "Not specified",
        "Ongoing",
        escapeCsvValue(history.notes || ""),
        history.isFamily ? "Yes" : "No",
        history.relation || "",
      ].join(",")
    );
  }
};

const addMoodsCsvRows = (rows: string[], moods: Mood[]): void => {
  rows.push("\n=== MOODS ===");
  rows.push("Mood,Intensity,Notes,Date");

  if (moods.length === 0) {
    rows.push("No moods recorded");
    return;
  }

  for (const mood of moods) {
    rows.push(
      [
        mood.mood,
        mood.intensity.toString(),
        escapeCsvValue(mood.notes || ""),
        safeFormatDateTime(new Date(mood.timestamp)),
      ].join(",")
    );
  }
};

const convertToCSV = (data: HealthReportData): string => {
  const rows: string[] = [];
  addVitalsCsvRows(rows, data.vitals);
  addSymptomsCsvRows(rows, data.symptoms);
  addMedicationsCsvRows(rows, data.medications);
  addMedicalHistoryCsvRows(rows, data.medicalHistory);
  addMoodsCsvRows(rows, data.moods);
  return rows.join("\n");
};

/**
 * Convert health data to PDF format (HTML that will be converted to PDF)
 */
const PDF_STYLES = `
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
      </style>
`;

const MAX_PDF_ROWS = 100;

const truncatePdfText = (value: string, max = 50): string =>
  value.length > max ? `${value.substring(0, max)}...` : value;

const sectionStart = (title: string, color?: string): string => {
  const style = color ? ` style="background: ${color};"` : "";
  return `
      <div class="metric-section">
        <div class="metric-header"${style}>${title}</div>
        <div class="metric-content">
  `;
};

const sectionEnd = `
        </div>
      </div>
  `;

const buildVitalMetricInfo = (metric: NormalizedMetricPayload): string => `
          <div class="metric-info">
            <div class="metric-info-item"><div class="metric-info-label">Metric Key</div><div class="metric-info-value">${metric.metricKey}</div></div>
            <div class="metric-info-item"><div class="metric-info-label">Unit</div><div class="metric-info-value">${metric.unit || "N/A"}</div></div>
            <div class="metric-info-item"><div class="metric-info-label">Provider</div><div class="metric-info-value">${metric.provider}</div></div>
            <div class="metric-info-item"><div class="metric-info-label">Samples</div><div class="metric-info-value">${metric.samples.length}</div></div>
          </div>
`;

const buildVitalTableHeader = (isAggregated: boolean): string => `
          <table>
            <thead>
              <tr>
                <th>Value</th>
                <th>Unit</th>
                <th>${isAggregated ? "Date" : "Start Date"}</th>
                ${isAggregated ? "" : "<th>End Date</th>"}
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
`;

const buildVitalTableRows = (
  metric: NormalizedMetricPayload,
  aggregatedSamples: Array<{ value: number; date: string; sources: string[] }>,
  isAggregated: boolean
): string => {
  let rows = "";
  for (const aggregated of aggregatedSamples.slice(0, MAX_PDF_ROWS)) {
    rows += `
              <tr>
                <td>${aggregated.value}</td>
                <td>${metric.unit || ""}</td>
                <td>${safeFormatDate(new Date(aggregated.date))}</td>
                ${isAggregated ? "" : "<td>N/A</td>"}
                <td>${aggregated.sources.length > 0 ? aggregated.sources.join("; ") : metric.provider}</td>
              </tr>
    `;
  }

  if (aggregatedSamples.length > MAX_PDF_ROWS) {
    rows += `
              <tr>
                <td colspan="${isAggregated ? "4" : "5"}" style="text-align: center; color: #999; font-style: italic;">
                  ... and ${aggregatedSamples.length - MAX_PDF_ROWS} more ${isAggregated ? "days" : "samples"}
                </td>
              </tr>
    `;
  }

  return rows;
};

const buildSingleVitalSection = (metric: NormalizedMetricPayload): string => {
  let section = `${sectionStart(metric.displayName)}${buildVitalMetricInfo(metric)}`;
  if (metric.samples.length === 0) {
    return `${section}<div class="no-data">No data available for this metric</div>${sectionEnd}`;
  }

  const aggregatedSamples = aggregateSamplesByDay(
    metric.samples,
    metric.metricKey
  );
  const isAggregated = DAILY_AGGREGATE_METRICS.includes(metric.metricKey);
  section += buildVitalTableHeader(isAggregated);
  section += buildVitalTableRows(metric, aggregatedSamples, isAggregated);
  section += `
            </tbody>
          </table>
  `;

  return `${section}${sectionEnd}`;
};

const buildVitalsSection = (vitals: NormalizedMetricPayload[]): string => {
  let html = "";
  for (const metric of vitals) {
    html += buildSingleVitalSection(metric);
  }
  return html;
};

const buildSymptomsSection = (symptoms: Symptom[]): string => {
  let html = sectionStart("Symptoms", "#EF4444");
  if (symptoms.length === 0) {
    return `${html}<div class="no-data">No symptoms recorded in this period</div>${sectionEnd}`;
  }

  html +=
    "<table><thead><tr><th>Type</th><th>Severity</th><th>Date</th><th>Location</th><th>Description</th></tr></thead><tbody>";
  for (const symptom of symptoms.slice(0, MAX_PDF_ROWS)) {
    html += `
      <tr>
        <td>${symptom.type}</td>
        <td>${symptom.severity}/5</td>
        <td>${safeFormatDate(new Date(symptom.timestamp))}</td>
        <td>${symptom.location || "N/A"}</td>
        <td>${truncatePdfText(symptom.description || "")}</td>
      </tr>
    `;
  }

  if (symptoms.length > MAX_PDF_ROWS) {
    html += `<tr><td colspan="5" style="text-align: center; color: #999; font-style: italic;">... and ${symptoms.length - MAX_PDF_ROWS} more symptoms</td></tr>`;
  }

  return `${html}</tbody></table>${sectionEnd}`;
};

const buildMedicationsSection = (medications: Medication[]): string => {
  let html = sectionStart("Medications", "#3B82F6");
  if (medications.length === 0) {
    return `${html}<div class="no-data">No medications recorded</div>${sectionEnd}`;
  }

  html +=
    "<table><thead><tr><th>Name</th><th>Dosage</th><th>Frequency</th><th>Start Date</th><th>End Date</th><th>Status</th></tr></thead><tbody>";
  for (const medication of medications) {
    html += `
      <tr>
        <td>${medication.name}</td>
        <td>${medication.dosage}</td>
        <td>${medication.frequency}</td>
        <td>${safeFormatDate(new Date(medication.startDate))}</td>
        <td>${medication.endDate ? safeFormatDate(new Date(medication.endDate)) : "Ongoing"}</td>
        <td>${medication.isActive ? "Active" : "Inactive"}</td>
      </tr>
    `;
  }

  return `${html}</tbody></table>${sectionEnd}`;
};

const buildMedicalHistorySection = (
  medicalHistory: MedicalHistory[]
): string => {
  let html = sectionStart("Medical History", "#8B5CF6");
  if (medicalHistory.length === 0) {
    return `${html}<div class="no-data">No medical history recorded</div>${sectionEnd}`;
  }

  html +=
    "<table><thead><tr><th>Condition</th><th>Diagnosed Date</th><th>Severity</th><th>Type</th><th>Notes</th></tr></thead><tbody>";
  for (const history of medicalHistory) {
    html += `
      <tr>
        <td>${history.condition}</td>
        <td>${history.diagnosedDate ? safeFormatDate(new Date(history.diagnosedDate)) : "Unknown"}</td>
        <td>${history.severity || "Not specified"}</td>
        <td>${history.isFamily ? `Family (${history.relation || "N/A"})` : "Personal"}</td>
        <td>${truncatePdfText(history.notes || "")}</td>
      </tr>
    `;
  }

  return `${html}</tbody></table>${sectionEnd}`;
};

const buildMoodsSection = (moods: Mood[]): string => {
  let html = sectionStart("Mood Tracking", "#10B981");
  if (moods.length === 0) {
    return `${html}<div class="no-data">No moods recorded in this period</div>${sectionEnd}`;
  }

  let totalIntensity = 0;
  for (const mood of moods) {
    totalIntensity += mood.intensity;
  }
  const avgIntensity =
    moods.length > 0 ? (totalIntensity / moods.length).toFixed(1) : "0";

  html += `
          <div style="margin-bottom: 15px; padding: 10px; background: #f8f8f8; border-radius: 6px;">
            <strong>Summary:</strong> ${moods.length} entries | Average Intensity: ${avgIntensity}/5
          </div>
          <table><thead><tr><th>Mood</th><th>Intensity</th><th>Date</th><th>Notes</th></tr></thead><tbody>
  `;
  for (const mood of moods.slice(0, MAX_PDF_ROWS)) {
    html += `
      <tr>
        <td>${mood.mood}</td>
        <td>${mood.intensity}/5</td>
        <td>${safeFormatDateTime(new Date(mood.timestamp))}</td>
        <td>${truncatePdfText(mood.notes || "")}</td>
      </tr>
    `;
  }

  if (moods.length > MAX_PDF_ROWS) {
    html += `<tr><td colspan="4" style="text-align: center; color: #999; font-style: italic;">... and ${moods.length - MAX_PDF_ROWS} more mood entries</td></tr>`;
  }

  return `${html}</tbody></table>${sectionEnd}`;
};

const convertToPDFHTML = (
  data: HealthReportData,
  startDate: Date,
  endDate: Date
): string => {
  const exportDate = safeFormatDate(new Date());
  const dateRange = `${safeFormatDate(startDate)} - ${safeFormatDate(endDate)}`;
  const totalVitalSamples = data.vitals.reduce(
    (sum, m) => sum + m.samples.length,
    0
  );
  const providers = [...new Set(data.vitals.map((m) => m.provider))];

  const headerAndSummary = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${PDF_STYLES}
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
          <div class="summary-item"><div class="summary-label">Vital Metrics</div><div class="summary-value">${data.vitals.length}</div></div>
          <div class="summary-item"><div class="summary-label">Vital Samples</div><div class="summary-value">${totalVitalSamples}</div></div>
          <div class="summary-item"><div class="summary-label">Symptoms</div><div class="summary-value">${data.symptoms.length}</div></div>
          <div class="summary-item"><div class="summary-label">Medications</div><div class="summary-value">${data.medications.length}</div></div>
          <div class="summary-item"><div class="summary-label">Medical Conditions</div><div class="summary-value">${data.medicalHistory.length}</div></div>
          <div class="summary-item"><div class="summary-label">Mood Entries</div><div class="summary-value">${data.moods.length}</div></div>
          <div class="summary-item"><div class="summary-label">Data Sources</div><div class="summary-value">${providers.length}</div></div>
          <div class="summary-item"><div class="summary-label">Sources</div><div class="summary-value">${providers.join(", ") || "N/A"}</div></div>
        </div>
      </div>
  `;

  const footer = `
      <div class="footer">
        Generated by Maak Health App • ${exportDate}
      </div>
    </body>
    </html>
  `;

  return [
    headerAndSummary,
    buildVitalsSection(data.vitals),
    buildSymptomsSection(data.symptoms),
    buildMedicationsSection(data.medications),
    buildMedicalHistorySection(data.medicalHistory),
    buildMoodsSection(data.moods),
    footer,
  ].join("");
};

type ExportArtifact = {
  fileUri: string;
  fileName: string;
  mimeType: string;
};

const hasExportableHealthData = (healthData: HealthReportData): boolean =>
  healthData.vitals.length > 0 ||
  healthData.symptoms.length > 0 ||
  healthData.medications.length > 0 ||
  healthData.medicalHistory.length > 0 ||
  healthData.moods.length > 0;

const createCsvExportArtifact = async (
  healthData: HealthReportData
): Promise<ExportArtifact> => {
  const content = convertToCSV(healthData);
  const fileName = `health-report-${new Date().toISOString().split("T")[0]}.csv`;
  const fileUri = `${Paths.cache.uri}${fileName}`;
  await writeAsStringAsync(fileUri, content);

  return {
    fileUri,
    fileName,
    mimeType: "text/csv",
  };
};

const createPdfExportArtifact = async (
  healthData: HealthReportData,
  startDate: Date,
  endDate: Date,
  onProgress?: (message: string) => void
): Promise<ExportArtifact> => {
  onProgress?.("Generating PDF...");

  if (Platform.OS === "web") {
    throw new Error(
      "PDF export is not available on web. Please use CSV format instead or use a native device."
    );
  }

  const html = convertToPDFHTML(healthData, startDate, endDate);

  try {
    const Print = await import("expo-print");
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

    return {
      fileUri: uri,
      fileName: `health-report-${new Date().toISOString().split("T")[0]}.pdf`,
      mimeType: "application/pdf",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string })?.code;
    const isNativeModuleError =
      errorMessage.includes("native module") ||
      errorMessage.includes("ExpoPrint") ||
      errorMessage.includes("expo-print") ||
      errorMessage.includes("is not a function") ||
      errorCode === "ERR_MODULE_NOT_FOUND";

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
};

const createExportArtifact = (
  options: ExportOptions,
  healthData: HealthReportData,
  onProgress?: (message: string) => void
): Promise<ExportArtifact> => {
  if (options.format === "csv") {
    return createCsvExportArtifact(healthData);
  }

  const { startDate, endDate } = getExportDateRange(options);
  return createPdfExportArtifact(healthData, startDate, endDate, onProgress);
};

const shareUsingSystemShare = async (
  artifact: ExportArtifact,
  options: ExportOptions,
  healthData: HealthReportData,
  onProgress?: (message: string) => void
): Promise<void> => {
  if (Platform.OS === "ios") {
    const shareResult = await Share.share({
      url: artifact.fileUri,
      title: "Export Health Report",
    });

    if (shareResult.action === Share.sharedAction) {
      onProgress?.("Export completed successfully");
    } else if (shareResult.action === Share.dismissedAction) {
      onProgress?.("Export cancelled");
    }
    return;
  }

  if (options.format === "csv") {
    const content = convertToCSV(healthData);
    const shareResult = await Share.share({
      message: `Health Report Export\n\nFile: ${artifact.fileName}\n\n${content.substring(0, 1000)}${content.length > 1000 ? "\n\n... (truncated, use export to get full file)" : ""}`,
      title: "Export Health Report",
    });

    if (shareResult.action === Share.sharedAction) {
      onProgress?.("Export completed successfully");
    } else if (shareResult.action === Share.dismissedAction) {
      onProgress?.("Export cancelled");
    }
    return;
  }

  throw new Error(
    "Unable to share PDF file. Please ensure expo-sharing is properly configured."
  );
};

const shareExportArtifact = async (
  artifact: ExportArtifact,
  options: ExportOptions,
  healthData: HealthReportData,
  onProgress?: (message: string) => void
): Promise<void> => {
  try {
    const Sharing = await import("expo-sharing");
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(artifact.fileUri, {
        mimeType: artifact.mimeType,
        dialogTitle: "Export Health Report",
      });
      onProgress?.("Export completed successfully");
      return;
    }
  } catch (_error) {
    // Fall through to React Native Share fallback
  }

  await shareUsingSystemShare(artifact, options, healthData, onProgress);
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
    const healthData = await fetchAllHealthData(options);
    if (!hasExportableHealthData(healthData)) {
      throw new Error("No health data available to export");
    }

    onProgress?.("Preparing export file...");
    const artifact = await createExportArtifact(
      options,
      healthData,
      onProgress
    );

    onProgress?.("Sharing file...");
    await shareExportArtifact(artifact, options, healthData, onProgress);
  } catch (error: unknown) {
    logger.error("Export error", error, "MetricsExportService");
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
    format: "csv",
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

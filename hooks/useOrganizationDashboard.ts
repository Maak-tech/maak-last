import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/apiClient";
import type { SortField } from "@/lib/services/cohortRiskService";

type RiskFilter = "all" | "critical" | "high" | "elevated" | "normal";

interface OrgInfo {
  id: string;
  name: string;
}

interface PatientRoster {
  id: string;
  userId: string;
  displayName?: string;
  riskLevel?: "critical" | "high" | "elevated" | "normal";
  riskScore?: number;
  lastVitalSync?: string;
  anomalies?: number;
  missedMeds?: number;
  adherence?: number;
}

interface PatientSnapshot {
  riskScore?: number;
  riskLevel?: "critical" | "high" | "elevated" | "normal";
  vhiScore?: number;
  adherence?: number;
  lastActivity?: string;
}

export interface DashboardPatientEntry {
  roster: PatientRoster;
  snapshot?: PatientSnapshot;
}

interface DashboardSummary {
  total: number;
  criticalCount: number;
  highCount: number;
  elevatedCount: number;
  normalCount: number;
  unacknowledgedAnomalies: number;
}

interface DashboardOptions {
  autoLoad?: boolean;
  refreshIntervalMs?: number;
  cohortId?: string;
}

export interface UseOrganizationDashboardResult {
  org: OrgInfo | null;
  patients: DashboardPatientEntry[];
  filteredPatients: DashboardPatientEntry[];
  summary: DashboardSummary | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  searchQuery: string;
  riskFilter: RiskFilter;
  sortBy: SortField;
  setSearchQuery: (q: string) => void;
  setRiskFilter: (f: RiskFilter) => void;
  setSortBy: (s: SortField) => void;
  refresh: () => Promise<void>;
}

export function useOrganizationDashboard(
  orgId: string | undefined,
  options: DashboardOptions = {}
): UseOrganizationDashboardResult {
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [patients, setPatients] = useState<DashboardPatientEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sortBy, setSortBy] = useState<SortField>("riskScore");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialLoadDone = useRef(false);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    if (initialLoadDone.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const cohortParam = options.cohortId ? `&cohortId=${encodeURIComponent(options.cohortId)}` : "";
      const data = await api.get<{ org?: OrgInfo; patients?: DashboardPatientEntry[] }>(
        `/api/org/${orgId}/patients?search=${encodeURIComponent(searchQuery)}${cohortParam}`
      );
      if (data?.org) setOrg(data.org);
      setPatients(data?.patients ?? []);
    } catch (err) {
      console.warn('[useOrganizationDashboard] Failed to load patients:', err);
      setError(err instanceof Error ? err.message : "Failed to load patients.");
      setPatients([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      initialLoadDone.current = true;
    }
  }, [orgId, searchQuery, options.cohortId]);

  useEffect(() => {
    if (options.autoLoad !== false) {
      refresh();
    }
    if (options.refreshIntervalMs && options.refreshIntervalMs > 0) {
      intervalRef.current = setInterval(refresh, options.refreshIntervalMs);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, options.autoLoad, options.refreshIntervalMs]);

  // Compute filtered + sorted patients
  const filteredPatients: DashboardPatientEntry[] = patients
    .filter((p) => {
      if (riskFilter !== "all" && p.roster.riskLevel !== riskFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (p.roster.displayName ?? "").toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "riskScore":
          return (b.roster.riskScore ?? 0) - (a.roster.riskScore ?? 0);
        case "lastVitalSync":
          return (b.roster.lastVitalSync ?? "").localeCompare(a.roster.lastVitalSync ?? "");
        case "anomalies":
          return (b.roster.anomalies ?? 0) - (a.roster.anomalies ?? 0);
        case "missedMeds":
          return (b.roster.missedMeds ?? 0) - (a.roster.missedMeds ?? 0);
        default:
          return 0;
      }
    });

  // Compute summary
  const summary: DashboardSummary | null =
    patients.length > 0
      ? {
          total: patients.length,
          criticalCount: patients.filter((p) => p.roster.riskLevel === "critical").length,
          highCount: patients.filter((p) => p.roster.riskLevel === "high").length,
          elevatedCount: patients.filter((p) => p.roster.riskLevel === "elevated").length,
          normalCount: patients.filter((p) => p.roster.riskLevel === "normal").length,
          unacknowledgedAnomalies: patients.reduce((acc, p) => acc + (p.roster.anomalies ?? 0), 0),
        }
      : null;

  return {
    org,
    patients,
    filteredPatients,
    summary,
    loading,
    refreshing,
    error,
    searchQuery,
    riskFilter,
    sortBy,
    setSearchQuery,
    setRiskFilter,
    setSortBy,
    refresh,
  };
}

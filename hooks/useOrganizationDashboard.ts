import { useCallback, useEffect, useRef, useState } from "react";
import {
  cohortRiskService,
  type RankedPatient,
  type SortField,
} from "@/lib/services/cohortRiskService";
import { organizationService } from "@/lib/services/organizationService";
import {
  type PopulationSummary,
  populationHealthService,
} from "@/lib/services/populationHealthService";
import type { Organization } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type UseOrganizationDashboardOptions = {
  autoLoad?: boolean;
  refreshIntervalMs?: number; // 0 = no auto-refresh
  cohortId?: string; // filter roster to this cohort
};

type RiskFilter = "all" | "critical" | "high" | "elevated" | "normal";

type UseOrganizationDashboardReturn = {
  org: Organization | null;
  rankedPatients: RankedPatient[];
  filteredPatients: RankedPatient[];
  summary: PopulationSummary | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  riskFilter: RiskFilter;
  sortBy: SortField;
  searchQuery: string;
  setRiskFilter: (filter: RiskFilter) => void;
  setSortBy: (sort: SortField) => void;
  setSearchQuery: (q: string) => void;
  refresh: () => Promise<void>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOrganizationDashboard(
  orgId: string | null | undefined,
  options: UseOrganizationDashboardOptions = {}
): UseOrganizationDashboardReturn {
  const { autoLoad = true, refreshIntervalMs = 0, cohortId } = options;

  const [org, setOrg] = useState<Organization | null>(null);
  const [rankedPatients, setRankedPatients] = useState<RankedPatient[]>([]);
  const [summary, setSummary] = useState<PopulationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sortBy, setSortBy] = useState<SortField>("riskScore");
  const [searchQuery, setSearchQuery] = useState("");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // ─── Load Data ─────────────────────────────────────────────────────────────

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (!orgId) return;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [organization, roster] = await Promise.all([
          organizationService.getOrganization(orgId),
          organizationService.listPatientRoster(orgId, { status: "active", cohortId }),
        ]);

        if (!isMountedRef.current) return;

        setOrg(organization);

        const ranked = await cohortRiskService.rankPatients(roster, sortBy);

        if (!isMountedRef.current) return;

        const snapshots = ranked.map((r) => r.snapshot);
        const pop = populationHealthService.summarize(snapshots);

        setRankedPatients(ranked);
        setSummary(pop);
      } catch (err) {
        if (isMountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to load dashboard"
          );
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [orgId, sortBy, cohortId]
  );

  const refresh = useCallback(async () => {
    await loadDashboard(true);
  }, [loadDashboard]);

  // ─── Auto-load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoLoad && orgId) {
      loadDashboard(false);
    }
  }, [autoLoad, orgId, loadDashboard]);

  // ─── Auto-refresh interval ─────────────────────────────────────────────────

  useEffect(() => {
    if (refreshIntervalMs > 0 && orgId) {
      intervalRef.current = setInterval(() => {
        loadDashboard(true);
      }, refreshIntervalMs);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshIntervalMs, orgId, loadDashboard]);

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ─── Derived: filtered + searched list ─────────────────────────────────────

  const filteredPatients = (() => {
    let list = cohortRiskService.filterByRisk(rankedPatients, riskFilter);

    if (searchQuery.trim()) {
      // Filtering by userId here; the PatientRosterCard resolves names from context
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.roster.userId.toLowerCase().includes(q));
    }

    return list;
  })();

  return {
    org,
    rankedPatients,
    filteredPatients,
    summary,
    loading,
    refreshing,
    error,
    riskFilter,
    sortBy,
    searchQuery,
    setRiskFilter,
    setSortBy,
    setSearchQuery,
    refresh,
  };
}

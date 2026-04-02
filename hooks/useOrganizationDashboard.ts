import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/apiClient";

interface DashboardPatient {
  id: string;
  name: string;
  email?: string;
  riskScore?: number;
  riskLevel?: "critical" | "high" | "elevated" | "normal";
  vhiScore?: number;
  adherence?: number;
  lastActivity?: string;
  cohortId?: string;
  cohortName?: string;
}

interface DashboardOptions {
  autoLoad?: boolean;
  refreshIntervalMs?: number;
}

interface UseOrganizationDashboardResult {
  patients: DashboardPatient[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  refresh: () => Promise<void>;
}

export function useOrganizationDashboard(
  orgId: string | undefined,
  options: DashboardOptions = {}
): UseOrganizationDashboardResult {
  const [patients, setPatients] = useState<DashboardPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await api.get<DashboardPatient[]>(
        `/api/org/${orgId}/patients?search=${encodeURIComponent(searchQuery)}`
      );
      setPatients(data ?? []);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, searchQuery]);

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

  return { patients, loading, searchQuery, setSearchQuery, refresh };
}

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

interface OrgMember {
  id: string;
  userId: string;
  orgId: string;
  role: "admin" | "member" | "caregiver";
  joinedAt: string;
}

interface Organization {
  id: string;
  name: string;
  type: string;
  plan?: string;
  memberCount?: number;
}

interface UseMyOrganizationResult {
  org: Organization | null;
  member: OrgMember | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useMyOrganization(): UseMyOrganizationResult {
  const [org, setOrg] = useState<Organization | null>(null);
  const [member, setMember] = useState<OrgMember | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ org: Organization; member: OrgMember }>("/api/org/me");
      setOrg(data?.org ?? null);
      setMember(data?.member ?? null);
    } catch {
      setOrg(null);
      setMember(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  return { org, member, loading, refresh };
}

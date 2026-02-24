/**
 * useMyOrganization
 *
 * Returns the first active organization the signed-in user belongs to,
 * along with their member record (role, etc.).
 *
 * Backed by `organizationService.getMemberOrganizations()` which performs
 * a Firestore collectionGroup query on `members` subcollections.
 */

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { organizationService } from "@/lib/services/organizationService";
import type { Organization, OrgMember } from "@/types";

export type MyOrganizationResult = {
  /** The first active organization this user belongs to (null while loading or none found). */
  org: Organization | null;
  /** The user's membership record in that organization. */
  member: OrgMember | null;
  /** All organizations this user belongs to. */
  allOrgs: Array<{ org: Organization; member: OrgMember }>;
  loading: boolean;
  error: string | null;
  /** Re-fetch organizations on demand. */
  reload: () => void;
};

export function useMyOrganization(): MyOrganizationResult {
  const { user } = useAuth();
  const [allOrgs, setAllOrgs] = useState<
    Array<{ org: Organization; member: OrgMember }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const reloadCounterRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setAllOrgs([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    organizationService
      .getMemberOrganizations(user.id)
      .then((result) => {
        if (!cancelled && isMountedRef.current) {
          setAllOrgs(result);
        }
      })
      .catch((err) => {
        if (!cancelled && isMountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to load organization"
          );
        }
      })
      .finally(() => {
        if (!cancelled && isMountedRef.current) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, reloadTrigger]);

  const reload = () => {
    reloadCounterRef.current += 1;
    setReloadTrigger(reloadCounterRef.current);
  };

  const first = allOrgs[0] ?? null;

  return {
    org: first?.org ?? null,
    member: first?.member ?? null,
    allOrgs,
    loading,
    error,
    reload,
  };
}

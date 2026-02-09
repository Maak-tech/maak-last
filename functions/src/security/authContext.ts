/**
 * Authentication context extraction and management
 */

import { getUsersCollection } from "../db/collections";
import type { UserRole } from "../db/firestore";

type CallableAuthContext = {
  auth?: {
    uid?: string;
    token?: {
      email?: string;
    };
  };
};

export type AuthContext = {
  uid: string;
  email?: string;
  role?: UserRole;
  familyId?: string;
};

/**
 * Extract auth context from Firebase Functions context
 */
export function extractAuthContext(
  context: CallableAuthContext
): AuthContext | null {
  if (!context.auth?.uid) {
    return null;
  }

  return {
    uid: context.auth.uid,
    email: context.auth.token?.email,
  };
}

/**
 * Enrich auth context with user data from Firestore
 */
export async function enrichAuthContext(
  authContext: AuthContext
): Promise<AuthContext> {
  try {
    const userDoc = await getUsersCollection().doc(authContext.uid).get();

    if (!userDoc.exists) {
      return authContext;
    }

    const userData = userDoc.data();
    if (!userData) {
      return authContext;
    }

    return {
      ...authContext,
      role: userData.role,
      familyId: userData.familyId,
    };
  } catch (_error) {
    // If enrichment fails, return base context
    return authContext;
  }
}

/**
 * Get full auth context (extract + enrich)
 */
export function getAuthContext(
  context: CallableAuthContext
): Promise<AuthContext | null> {
  const baseContext = extractAuthContext(context);
  if (!baseContext) {
    return Promise.resolve(null);
  }

  return enrichAuthContext(baseContext);
}

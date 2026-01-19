/**
 * Family Admin Management
 * Functions for retrieving and managing family administrators
 */

import * as admin from "firebase-admin";
import { logger } from "../../observability/logger";

/**
 * Get all admin users for a family
 *
 * @param familyId - Family ID to query
 * @param traceId - Optional trace ID for logging
 * @returns Array of admin user IDs
 */
export async function getFamilyAdmins(
  familyId: string,
  traceId?: string
): Promise<string[]> {
  logger.debug("Fetching family admins", {
    traceId,
    familyId,
    fn: "getFamilyAdmins",
  });

  try {
    const db = admin.firestore();
    const usersSnapshot = await db
      .collection("users")
      .where("familyId", "==", familyId)
      .where("role", "==", "admin")
      .get();

    const adminIds = usersSnapshot.docs.map((doc) => doc.id);

    logger.debug("Family admins retrieved", {
      traceId,
      familyId,
      adminCount: adminIds.length,
      fn: "getFamilyAdmins",
    });

    return adminIds;
  } catch (error) {
    logger.error("Error fetching family admins", error as Error, {
      traceId,
      familyId,
      fn: "getFamilyAdmins",
    });
    throw error;
  }
}

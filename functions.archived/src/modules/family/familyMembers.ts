/**
 * Family Members Module
 * Handles retrieval of family member relationships
 */

import { getFirestore } from "firebase-admin/firestore";
import { logger } from "../../observability/logger";

/**
 * Get family member IDs for a user
 * Looks up the user's familyId and returns all members of that family
 *
 * @param userId - The user ID to get family for
 * @param excludeUserId - Whether to exclude the user from results (default: true)
 * @param traceId - Optional correlation ID for logging
 * @returns Array of family member user IDs
 */
export async function getFamilyMemberIds(
  userId: string,
  excludeUserId = true,
  traceId?: string
): Promise<string[]> {
  logger.debug("Getting family member IDs", {
    traceId,
    uid: userId,
    excludeUserId,
    fn: "getFamilyMemberIds",
  });

  try {
    const db = getFirestore();
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.familyId) {
      logger.debug("User has no familyId", {
        traceId,
        uid: userId,
        fn: "getFamilyMemberIds",
      });
      return [];
    }

    const familyId = userData.familyId;

    // Get all family members
    const familySnapshot = await db
      .collection("users")
      .where("familyId", "==", familyId)
      .get();

    const memberIds: string[] = [];
    for (const doc of familySnapshot.docs) {
      if (!excludeUserId || doc.id !== userId) {
        memberIds.push(doc.id);
      }
    }

    logger.debug("Family members retrieved", {
      traceId,
      uid: userId,
      familyId,
      memberCount: memberIds.length,
      fn: "getFamilyMemberIds",
    });

    return memberIds;
  } catch (error) {
    logger.error("Failed to get family member IDs", error as Error, {
      traceId,
      uid: userId,
      fn: "getFamilyMemberIds",
    });
    return [];
  }
}

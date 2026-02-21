import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";

async function deleteDocsWhereUserId(params: {
  collectionName: string;
  uid: string;
  traceId: string;
}): Promise<number> {
  const { collectionName, uid, traceId } = params;
  const db = admin.firestore();

  let deleted = 0;
  while (true) {
    const snapshot = await db
      .collection(collectionName)
      .where("userId", "==", uid)
      .limit(500)
      .get();

    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    deleted += snapshot.size;

    // If we got fewer than the page size, we're done.
    if (snapshot.size < 500) {
      break;
    }
  }

  logger.info("Deleted docs where userId matches", {
    traceId,
    uid,
    collectionName,
    deleted,
    fn: "deleteDocsWhereUserId",
  });

  return deleted;
}

async function deleteUserSubcollection(params: {
  uid: string;
  subcollectionName: string;
  traceId: string;
}): Promise<number> {
  const { uid, subcollectionName, traceId } = params;
  const db = admin.firestore();

  const collectionRef = db
    .collection("users")
    .doc(uid)
    .collection(subcollectionName);
  let deleted = 0;

  while (true) {
    const snapshot = await collectionRef.limit(500).get();
    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    deleted += snapshot.size;
    if (snapshot.size < 500) {
      break;
    }
  }

  logger.info("Deleted user subcollection", {
    traceId,
    uid,
    subcollectionName,
    deleted,
    fn: "deleteUserSubcollection",
  });

  return deleted;
}

export const deleteAccount = onCall(
  {
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (request) => {
    const traceId = createTraceId();
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    logger.info("Account deletion requested", {
      traceId,
      uid,
      fn: "deleteAccount",
    });

    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);

    // 1) Delete the user's Firestore doc tree (including subcollections).
    let usedRecursiveDelete = false;
    try {
      const anyDb = db as unknown as {
        recursiveDelete?: (
          ref: admin.firestore.DocumentReference
        ) => Promise<void>;
      };
      if (typeof anyDb.recursiveDelete === "function") {
        usedRecursiveDelete = true;
        await anyDb.recursiveDelete(userRef);
      } else {
        // Fallback: delete the doc itself (subcollections may remain if recursiveDelete
        // isn't available in this Admin SDK version).
        // Best-effort: delete known subcollections first.
        const knownSubcollections = [
          "chatSessions",
          "clinicalIntegrationRequests",
        ];
        for (const subcollectionName of knownSubcollections) {
          try {
            await deleteUserSubcollection({ uid, subcollectionName, traceId });
          } catch (error) {
            logger.warn("Failed to delete user subcollection", {
              traceId,
              uid,
              subcollectionName,
              error: error instanceof Error ? error.message : String(error),
              fn: "deleteAccount",
            });
          }
        }

        await userRef.delete();
      }
    } catch (error) {
      logger.error("Failed to delete users/{uid} doc tree", error as Error, {
        traceId,
        uid,
        fn: "deleteAccount",
      });
      throw new HttpsError(
        "failed-precondition",
        "Could not delete user data at this time"
      );
    }

    // 2) Delete user-scoped documents in known top-level collections.
    // If a collection does not use userId, the query will be empty.
    const collectionsToPurge = [
      "alerts",
      "allergies",
      "calendarEvents",
      "familyInvitations",
      "labResults",
      "medicalHistory",
      "medication_adherence",
      "medications",
      "moods",
      "patients",
      "periodCycles",
      "periodEntries",
      "symptoms",
      "vitals",
    ] as const;

    const purgedCounts: Record<string, number> = {};
    for (const collectionName of collectionsToPurge) {
      try {
        purgedCounts[collectionName] = await deleteDocsWhereUserId({
          collectionName,
          uid,
          traceId,
        });
      } catch (error) {
        // Best-effort cleanup; continue to avoid leaving the Auth user deleted but data intact.
        logger.warn("Failed to purge collection by userId", {
          traceId,
          uid,
          collectionName,
          error: error instanceof Error ? error.message : String(error),
          fn: "deleteAccount",
        });
      }
    }

    // 3) Delete Firebase Auth user (prevents further sign-in).
    try {
      await admin.auth().deleteUser(uid);
    } catch (error) {
      logger.error("Failed to delete Firebase Auth user", error as Error, {
        traceId,
        uid,
        fn: "deleteAccount",
      });
      // Don't throw here; Firestore data is already removed.
    }

    logger.info("Account deletion completed", {
      traceId,
      uid,
      usedRecursiveDelete,
      fn: "deleteAccount",
    });

    return { success: true, traceId, usedRecursiveDelete, purgedCounts };
  }
);

/**
 * FCM Token Cleanup
 * Removes invalid tokens from BOTH legacy and new formats
 */

import * as admin from 'firebase-admin';
import { logger } from '../../observability/logger';

/**
 * Clean up invalid FCM tokens
 * Removes invalid tokens from BOTH:
 * 1. Legacy fcmToken field (if it matches any invalid token)
 * 2. fcmTokens map entries where entry.token matches invalid token
 * 
 * @param invalidTokens - Array of invalid FCM tokens
 */
export async function cleanupInvalidTokens(
  invalidTokens: string[]
): Promise<void> {
  if (invalidTokens.length === 0) {
    return;
  }

  logger.info('Cleaning up invalid FCM tokens', {
    tokenCount: invalidTokens.length,
    fn: 'cleanupInvalidTokens',
  });

  try {
    const db = admin.firestore();
    const invalidTokenSet = new Set(invalidTokens);

    // Firestore 'in' query limit is 10, so process in batches
    const batches: string[][] = [];
    for (let i = 0; i < invalidTokens.length; i += 10) {
      batches.push(invalidTokens.slice(i, i + 10));
    }

    let totalUpdated = 0;

    for (const batch of batches) {
      // Find users with these tokens in legacy fcmToken field
      const usersSnapshot = await db
        .collection('users')
        .where('fcmToken', 'in', batch)
        .get();

      const updateBatch = db.batch();

      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        
        // Remove from legacy fcmToken if it matches any invalid token
        if (userData.fcmToken) {
          const tokenToCheck = Array.isArray(userData.fcmToken) 
            ? userData.fcmToken 
            : [userData.fcmToken];
          
          const hasInvalidToken = tokenToCheck.some(token => invalidTokenSet.has(token));
          
          if (hasInvalidToken) {
            // If it's an array, filter out invalid tokens
            if (Array.isArray(userData.fcmToken)) {
              const validTokens = userData.fcmToken.filter(token => !invalidTokenSet.has(token));
              if (validTokens.length === 0) {
                updateBatch.update(doc.ref, {
                  fcmToken: admin.firestore.FieldValue.delete(),
                });
              } else {
                updateBatch.update(doc.ref, {
                  fcmToken: validTokens,
                });
              }
            } else {
              // Single token - delete it
              updateBatch.update(doc.ref, {
                fcmToken: admin.firestore.FieldValue.delete(),
              });
            }
            totalUpdated++;
          }
        }
      });

      await updateBatch.commit();
    }

    // Also scan for tokens in fcmTokens map
    // This is less efficient but necessary to handle the new format
    // Get all users (in production, you might want to paginate this)
    const allUsersSnapshot = await db.collection('users').limit(1000).get();

    const mapUpdateBatch = db.batch();
    let mapUpdated = 0;

    allUsersSnapshot.forEach((doc) => {
      const userData = doc.data();
      
      if (userData.fcmTokens && typeof userData.fcmTokens === 'object') {
        const updatedTokens = { ...userData.fcmTokens };
        let hasChanges = false;

        for (const deviceId in updatedTokens) {
          const deviceToken = updatedTokens[deviceId];
          const tokenValue = typeof deviceToken === 'object' ? deviceToken.token : deviceToken;
          
          if (tokenValue && invalidTokenSet.has(tokenValue)) {
            delete updatedTokens[deviceId];
            hasChanges = true;
          }
        }

        if (hasChanges) {
          if (Object.keys(updatedTokens).length === 0) {
            // Remove the entire fcmTokens field if no tokens left
            mapUpdateBatch.update(doc.ref, {
              fcmTokens: admin.firestore.FieldValue.delete(),
            });
          } else {
            // Update with cleaned tokens
            mapUpdateBatch.update(doc.ref, {
              fcmTokens: updatedTokens,
            });
          }
          mapUpdated++;
        }
      }
    });

    if (mapUpdated > 0) {
      await mapUpdateBatch.commit();
      totalUpdated += mapUpdated;
    }

    logger.info('Invalid FCM tokens cleaned up', {
      tokenCount: invalidTokens.length,
      usersUpdated: totalUpdated,
      fn: 'cleanupInvalidTokens',
    });
  } catch (error) {
    logger.error('Failed to cleanup invalid tokens', error as Error, {
      tokenCount: invalidTokens.length,
      fn: 'cleanupInvalidTokens',
    });
    // Don't throw - cleanup is non-critical
  }
}

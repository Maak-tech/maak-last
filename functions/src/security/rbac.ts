/**
 * Role-Based Access Control (RBAC)
 * Roles: owner (patient), caregiver, admin
 * Permission checks for patient data and alerts
 */

import * as functions from 'firebase-functions';
import type { AuthContext } from './authContext';
import type { UserRole } from '../db/firestore';
import { getUsersCollection, getCareLinksCollection } from '../db/collections';

export interface RBACContext {
  actor: AuthContext;
  targetUserId?: string;
  patientId?: string;
  familyId?: string;
}

// ============================================================================
// Role Checks
// ============================================================================

export function hasRole(actor: AuthContext, role: UserRole): boolean {
  return actor.role === role;
}

export function isOwner(actor: AuthContext): boolean {
  return hasRole(actor, 'owner');
}

export function isCaregiver(actor: AuthContext): boolean {
  return hasRole(actor, 'caregiver');
}

export function isAdmin(actor: AuthContext): boolean {
  return hasRole(actor, 'admin');
}

// ============================================================================
// Family Checks
// ============================================================================

export function isSameFamily(actorFamilyId?: string, targetFamilyId?: string): boolean {
  if (!actorFamilyId || !targetFamilyId) {
    return false;
  }
  return actorFamilyId === targetFamilyId;
}

// ============================================================================
// Patient Data Permissions
// ============================================================================

/**
 * Check if actor can read patient data
 * - Owner can read own data
 * - Caregivers can read their patients' data
 * - Admins can read family members' data
 */
export async function canReadPatient(ctx: RBACContext): Promise<boolean> {
  const { actor, targetUserId, patientId } = ctx;
  
  const targetId = targetUserId || patientId;
  if (!targetId) {
    return false;
  }

  // Owner reading own data
  if (actor.uid === targetId) {
    return true;
  }

  // Check if actor is caregiver for this patient
  if (isCaregiver(actor)) {
    const careLink = await getCareLinksCollection()
      .where('caregiverId', '==', actor.uid)
      .where('patientId', '==', targetId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (!careLink.empty) {
      return true;
    }
  }

  // Admin checking family member
  if (isAdmin(actor) && actor.familyId) {
    const targetUser = await getUsersCollection().doc(targetId).get();
    if (targetUser.exists) {
      const targetData = targetUser.data();
      if (targetData && isSameFamily(actor.familyId, targetData.familyId)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if actor can write patient data
 * - Owner can write own data
 * - Caregivers with write permissions can write patient data
 * - Admins can write family members' data
 */
export async function canWritePatient(ctx: RBACContext): Promise<boolean> {
  const { actor, targetUserId, patientId } = ctx;
  
  const targetId = targetUserId || patientId;
  if (!targetId) {
    return false;
  }

  // Owner writing own data
  if (actor.uid === targetId) {
    return true;
  }

  // Check if caregiver has write permissions
  if (isCaregiver(actor)) {
    const careLink = await getCareLinksCollection()
      .where('caregiverId', '==', actor.uid)
      .where('patientId', '==', targetId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (!careLink.empty) {
      const careLinkData = careLink.docs[0].data();
      // Check specific permissions
      if (careLinkData.permissions?.canEditMedications || 
          careLinkData.permissions?.canViewVitals) {
        return true;
      }
    }
  }

  // Admin writing family member data
  if (isAdmin(actor) && actor.familyId) {
    const targetUser = await getUsersCollection().doc(targetId).get();
    if (targetUser.exists) {
      const targetData = targetUser.data();
      if (targetData && isSameFamily(actor.familyId, targetData.familyId)) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Alert Permissions
// ============================================================================

/**
 * Check if actor can acknowledge/manage alerts
 * - Caregivers with alert permissions can acknowledge
 * - Admins can acknowledge family alerts
 */
export async function canAcknowledgeAlert(ctx: RBACContext): Promise<boolean> {
  const { actor, targetUserId, patientId } = ctx;
  
  const targetId = targetUserId || patientId;
  if (!targetId) {
    return false;
  }

  // Patient can acknowledge own alerts
  if (actor.uid === targetId) {
    return true;
  }

  // Check if caregiver has alert permissions
  if (isCaregiver(actor)) {
    const careLink = await getCareLinksCollection()
      .where('caregiverId', '==', actor.uid)
      .where('patientId', '==', targetId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (!careLink.empty) {
      const careLinkData = careLink.docs[0].data();
      if (careLinkData.permissions?.canManageAlerts) {
        return true;
      }
    }
  }

  // Admin can acknowledge family alerts
  if (isAdmin(actor) && actor.familyId) {
    const targetUser = await getUsersCollection().doc(targetId).get();
    if (targetUser.exists) {
      const targetData = targetUser.data();
      if (targetData && isSameFamily(actor.familyId, targetData.familyId)) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Assert Helpers (throw on denial)
// ============================================================================

export async function assertCanReadPatient(ctx: RBACContext): Promise<void> {
  const allowed = await canReadPatient(ctx);
  if (!allowed) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You do not have permission to read this patient data'
    );
  }
}

export async function assertCanWritePatient(ctx: RBACContext): Promise<void> {
  const allowed = await canWritePatient(ctx);
  if (!allowed) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You do not have permission to write this patient data'
    );
  }
}

export async function assertCanAcknowledgeAlert(ctx: RBACContext): Promise<void> {
  const allowed = await canAcknowledgeAlert(ctx);
  if (!allowed) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You do not have permission to acknowledge this alert'
    );
  }
}

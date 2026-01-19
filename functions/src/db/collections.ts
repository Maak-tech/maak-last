/**
 * Typed Firestore collection references
 * Collections: Users, Patients, CareLinks, Alerts, Vitals, Medications, Audit
 */

import * as admin from "firebase-admin";
import {
  alertConverter,
  auditLogConverter,
  careLinkConverter,
  medicationConverter,
  patientConverter,
  userConverter,
  vitalConverter,
} from "./converters";

/**
 * Get Firestore instance
 */
export function getDb(): FirebaseFirestore.Firestore {
  return admin.firestore();
}

/**
 * Get typed Users collection
 */
export function getUsersCollection() {
  return getDb().collection("users").withConverter(userConverter);
}

/**
 * Get typed Patients collection
 */
export function getPatientsCollection() {
  return getDb().collection("patients").withConverter(patientConverter);
}

/**
 * Get typed CareLinks collection (caregiver relationships)
 */
export function getCareLinksCollection() {
  return getDb().collection("careLinks").withConverter(careLinkConverter);
}

/**
 * Get typed Alerts collection
 */
export function getAlertsCollection() {
  return getDb().collection("alerts").withConverter(alertConverter);
}

/**
 * Get typed Vitals collection
 */
export function getVitalsCollection() {
  return getDb().collection("vitals").withConverter(vitalConverter);
}

/**
 * Get typed Audit logs collection
 */
export function getAuditLogsCollection() {
  return getDb().collection("audit").withConverter(auditLogConverter);
}

/**
 * Get typed Medications collection
 */
export function getMedicationsCollection() {
  return getDb().collection("medications").withConverter(medicationConverter);
}

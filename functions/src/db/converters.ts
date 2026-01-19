/**
 * Firestore data converters
 * Convert between Firestore documents and TypeScript types
 */

import type {
  Alert,
  AuditLog,
  CareLink,
  Medication,
  Patient,
  User,
  Vital,
} from "./firestore";

// ============================================================================
// User Converter
// ============================================================================

export const userConverter: FirebaseFirestore.FirestoreDataConverter<User> = {
  toFirestore(user: User): FirebaseFirestore.DocumentData {
    const { id, ...data } = user;
    return data;
  },
  fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): User {
    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as User;
  },
};

// ============================================================================
// Patient Converter
// ============================================================================

export const patientConverter: FirebaseFirestore.FirestoreDataConverter<Patient> =
  {
    toFirestore(patient: Patient): FirebaseFirestore.DocumentData {
      const { id, ...data } = patient;
      return data;
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Patient {
      return {
        id: snapshot.id,
        ...snapshot.data(),
      } as Patient;
    },
  };

// ============================================================================
// CareLink Converter
// ============================================================================

export const careLinkConverter: FirebaseFirestore.FirestoreDataConverter<CareLink> =
  {
    toFirestore(careLink: CareLink): FirebaseFirestore.DocumentData {
      const { id, ...data } = careLink;
      return data;
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): CareLink {
      return {
        id: snapshot.id,
        ...snapshot.data(),
      } as CareLink;
    },
  };

// ============================================================================
// Alert Converter
// ============================================================================

export const alertConverter: FirebaseFirestore.FirestoreDataConverter<Alert> = {
  toFirestore(alert: Alert): FirebaseFirestore.DocumentData {
    const { id, ...data } = alert;
    return data;
  },
  fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Alert {
    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as Alert;
  },
};

// ============================================================================
// Vital Converter
// ============================================================================

export const vitalConverter: FirebaseFirestore.FirestoreDataConverter<Vital> = {
  toFirestore(vital: Vital): FirebaseFirestore.DocumentData {
    const { id, ...data } = vital;
    return data;
  },
  fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Vital {
    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as Vital;
  },
};

// ============================================================================
// Medication Converter
// ============================================================================

export const medicationConverter: FirebaseFirestore.FirestoreDataConverter<Medication> =
  {
    toFirestore(medication: Medication): FirebaseFirestore.DocumentData {
      const { id, ...data } = medication;
      return data;
    },
    fromFirestore(
      snapshot: FirebaseFirestore.QueryDocumentSnapshot
    ): Medication {
      return {
        id: snapshot.id,
        ...snapshot.data(),
      } as Medication;
    },
  };

// ============================================================================
// Audit Log Converter
// ============================================================================

export const auditLogConverter: FirebaseFirestore.FirestoreDataConverter<AuditLog> =
  {
    toFirestore(auditLog: AuditLog): FirebaseFirestore.DocumentData {
      const { id, ...data } = auditLog;
      return data;
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): AuditLog {
      return {
        id: snapshot.id,
        ...snapshot.data(),
      } as AuditLog;
    },
  };

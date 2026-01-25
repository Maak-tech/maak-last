/**
 * Firestore type definitions
 * Core data types for the application
 */

import type { Timestamp } from "firebase-admin/firestore";

export { FieldValue, Timestamp } from "firebase-admin/firestore";

// ============================================================================
// User & Auth
// ============================================================================

export type UserRole = "owner" | "caregiver" | "admin";

export interface User {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  familyId?: string;
  fcmToken?: string;
  fcmTokens?: Record<
    string,
    {
      token: string;
      updatedAt: Timestamp;
      platform: string;
      deviceName: string;
    }
  >;
  preferences?: {
    notifications?: {
      enabled?: boolean;
      fallAlerts?: boolean;
      medicationReminders?: boolean;
      symptomAlerts?: boolean;
      vitalAlerts?: boolean;
      trendAlerts?: boolean;
      familyUpdates?: boolean;
    };
    emergencyContacts?: Array<{
      id?: string;
      name: string;
      phone: string;
    }>;
  };
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================================
// Patient
// ============================================================================

export interface Patient {
  id?: string;
  userId: string;
  familyId: string;
  dateOfBirth?: Timestamp;
  gender?: "male" | "female" | "other";
  bloodType?: string;
  allergies?: string[];
  emergencyContacts?: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  medicalHistory?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================================
// CareLink (Caregiver relationship)
// ============================================================================

export interface CareLink {
  id?: string;
  caregiverId: string; // User ID of caregiver
  patientId: string; // User ID of patient
  familyId: string;
  relationship?: string;
  permissions?: {
    canEditMedications?: boolean;
    canViewVitals?: boolean;
    canManageAlerts?: boolean;
  };
  invitedBy?: string;
  invitedAt?: Timestamp;
  acceptedAt?: Timestamp;
  status: "pending" | "active" | "revoked";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================================
// Vital
// ============================================================================

export type VitalType =
  | "heartRate"
  | "bloodPressure"
  | "respiratoryRate"
  | "oxygenSaturation"
  | "bodyTemperature"
  | "weight"
  | "restingHeartRate"
  | "heartRateVariability";

export interface Vital {
  id?: string;
  userId: string;
  patientId?: string;
  type: VitalType;
  value: number;
  unit: string;
  systolic?: number; // For blood pressure
  diastolic?: number; // For blood pressure
  source?: "manual" | "device" | "healthkit" | "googlefit" | "oura" | "garmin";
  deviceId?: string;
  timestamp: Timestamp;
  createdAt?: Timestamp;
}

// ============================================================================
// Alert
// ============================================================================

export type AlertType = "fall" | "vital" | "symptom" | "medication" | "trend";
export type AlertSeverity = "critical" | "warning" | "info";
export type AlertStatus = "active" | "acknowledged" | "resolved" | "dismissed";

export interface Alert {
  id?: string;
  userId: string;
  patientId?: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  data?: Record<string, any>;
  status: AlertStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: Timestamp;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  dismissedBy?: string;
  dismissedAt?: Timestamp;
  notifiedUserIds?: string[];
  timestamp: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================================
// Medication
// ============================================================================

export interface Medication {
  id?: string;
  userId: string;
  patientId?: string;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  prescribedBy?: string;
  prescribedDate?: Timestamp;
  startDate?: Timestamp;
  endDate?: Timestamp;
  isActive: boolean;
  reminders?: Array<{
    id: string;
    time: string; // HH:MM format
    days?: number[]; // 0-6 for days of week
    enabled: boolean;
    notified?: boolean;
    notifiedAt?: Timestamp;
    taken?: boolean;
    takenAt?: Timestamp;
  }>;
  sideEffects?: string[];
  interactions?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================================
// Audit Log
// ============================================================================

export type AuditAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "acknowledge"
  | "invite"
  | "revoke";

export interface AuditLog {
  id?: string;
  userId: string; // Who performed the action
  action: AuditAction;
  resourceType:
    | "user"
    | "patient"
    | "vital"
    | "alert"
    | "medication"
    | "careLink";
  resourceId: string;
  targetUserId?: string; // Who was affected (for patient data access)
  familyId?: string;
  changes?: Record<string, any>; // Before/after snapshots (no PHI)
  ipAddress?: string;
  userAgent?: string;
  timestamp: Timestamp;
}

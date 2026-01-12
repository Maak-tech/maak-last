export type AvatarType =
  | "man"
  | "woman"
  | "boy"
  | "girl"
  | "grandma"
  | "grandpa";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  avatarType?: AvatarType;
  familyId?: string;
  role: "admin" | "member" | "caregiver";
  createdAt: Date;
  onboardingCompleted: boolean;
  isPremium?: boolean;
  phoneNumber?: string;
  preferences: {
    language: "en" | "ar";
    notifications: boolean;
    emergencyContacts: string[];
  };
}

export interface Symptom {
  id: string;
  userId: string;
  type: string;
  severity: 1 | 2 | 3 | 4 | 5;
  description?: string;
  timestamp: Date;
  location?: string;
  triggers?: string[];
  tags?: string[]; // User-defined tags for organization
}

export type MoodType =
  // Positive emotions
  | "veryHappy"
  | "happy"
  | "excited"
  | "content"
  | "grateful"
  | "hopeful"
  | "proud"
  | "calm"
  | "peaceful"
  // Negative emotions
  | "sad"
  | "verySad"
  | "anxious"
  | "angry"
  | "frustrated"
  | "overwhelmed"
  | "hopeless"
  | "guilty"
  | "ashamed"
  | "lonely"
  | "irritable"
  | "restless"
  // Neutral/Other mental states
  | "neutral"
  | "confused"
  | "numb"
  | "detached"
  | "empty"
  | "apathetic"
  | "tired"
  | "stressed";

export interface Mood {
  id: string;
  userId: string;
  mood: MoodType;
  intensity: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  timestamp: Date;
  activities?: string[];
}

export interface Medication {
  id: string;
  userId: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: Date;
  endDate?: Date;
  reminders: MedicationReminder[];
  notes?: string;
  isActive: boolean;
  // Refill tracking fields
  quantity?: number; // Current quantity (e.g., number of pills)
  quantityUnit?: string; // Unit of quantity (e.g., "pills", "tablets", "ml", "doses")
  lastRefillDate?: Date; // Date when medication was last refilled
  refillReminderDays?: number; // Days before running out to send reminder (default: 7)
  tags?: string[]; // User-defined tags for organization
}

export interface MedicationReminder {
  id: string;
  time: string;
  taken: boolean;
  takenAt?: Date | any; // Can be Date or Firestore Timestamp
}

export interface MedicalHistory {
  id: string;
  userId: string;
  condition: string;
  diagnosedDate?: Date;
  severity?: "mild" | "moderate" | "severe";
  notes?: string;
  isFamily: boolean;
  relation?: string;
  familyMemberId?: string; // ID of the family member this record belongs to
  familyMemberName?: string; // Name of the family member for display
  tags?: string[]; // User-defined tags for organization
}

export interface Allergy {
  id: string;
  userId: string;
  name: string;
  severity: "mild" | "moderate" | "severe" | "severe-life-threatening";
  reaction?: string;
  notes?: string;
  discoveredDate?: Date;
  timestamp: Date;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  avatar?: string;
  userId?: string;
  inviteStatus: "pending" | "accepted" | "none";
  lastActive?: Date;
  healthScore?: number;
}

export interface LabResult {
  id: string;
  userId: string;
  testName: string;
  testType: "blood" | "urine" | "imaging" | "other";
  testDate: Date;
  orderedBy?: string; // Doctor/clinic name
  facility?: string; // Lab/hospital name
  results: LabResultValue[];
  notes?: string;
  attachments?: string[]; // URLs to PDFs or images
  tags?: string[];
}

export interface LabResultValue {
  name: string; // e.g., "Glucose", "Cholesterol", "Hemoglobin"
  value: number | string; // Can be numeric or text (e.g., "Negative", "Positive")
  unit?: string; // e.g., "mg/dL", "mmol/L", "%"
  referenceRange?: string; // e.g., "70-100 mg/dL"
  status?: "normal" | "high" | "low" | "abnormal" | "critical";
  flagged?: boolean; // Whether this result was flagged by the lab
}

export interface VitalSign {
  id: string;
  userId: string;
  type: "heartRate" | "bloodPressure" | "temperature" | "weight" | "bloodSugar";
  value: number;
  unit: string;
  timestamp: Date;
  source: "manual" | "device" | "clinic";
}

export interface EmergencyAlert {
  id: string;
  userId: string;
  type: "fall" | "emergency" | "medication" | "vitals";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: Date;
  resolved: boolean;
  responders?: string[];
}

export interface FamilyInvitationCode {
  id: string;
  code: string;
  familyId: string;
  invitedBy: string; // userId who created the invitation
  invitedUserName: string;
  invitedUserRelation: string;
  status: "pending" | "used" | "expired";
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
  usedBy?: string; // userId who used the code
}

export interface Family {
  id: string;
  name: string;
  createdBy: string;
  members: string[]; // array of user IDs
  status: "active" | "inactive";
  createdAt: Date;
}

export type CalendarEventType =
  | "appointment"
  | "medication"
  | "symptom"
  | "lab_result"
  | "vaccination"
  | "reminder"
  | "other";

export type RecurrencePattern =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom";

export interface CalendarEvent {
  id: string;
  userId: string;
  familyId?: string; // If set, event is shared with family
  title: string;
  description?: string;
  type: CalendarEventType;
  startDate: Date;
  endDate?: Date;
  allDay: boolean;
  location?: string;
  attendees?: string[]; // User IDs of attendees
  recurrencePattern?: RecurrencePattern;
  recurrenceEndDate?: Date;
  recurrenceCount?: number; // Number of occurrences
  relatedItemId?: string; // ID of related medication, symptom, etc.
  relatedItemType?: "medication" | "symptom" | "labResult" | "appointment";
  color?: string; // Hex color for calendar display
  reminders?: Array<{
    minutesBefore: number;
    sent: boolean;
  }>;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type AvatarType =
  | "man"
  | "woman"
  | "boy"
  | "girl"
  | "grandma"
  | "grandpa";

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
};

export type CareTeamMember = {
  id: string;
  name: string;
  specialty: string;
  phone?: string;
  email?: string;
};

export type User = {
  id: string;
  email?: string;
  phoneNumber?: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  avatarType?: AvatarType;
  gender?: "male" | "female" | "other";
  familyId?: string;
  role: "admin" | "member" | "caregiver";
  createdAt: Date;
  onboardingCompleted: boolean;
  dashboardTourCompleted?: boolean;
  isPremium?: boolean;
  preferences: {
    language: "en" | "ar";
    notifications: boolean;
    emergencyContacts: EmergencyContact[];
    careTeam?: CareTeamMember[];
  };
};

export type Symptom = {
  id: string;
  userId: string;
  type: string;
  severity: 1 | 2 | 3 | 4 | 5;
  description?: string;
  timestamp: Date;
  location?: string;
  triggers?: string[];
  tags?: string[]; // User-defined tags for organization
};

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

export type Mood = {
  id: string;
  userId: string;
  mood: MoodType;
  intensity: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  timestamp: Date;
  activities?: string[];
};

export type Medication = {
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
};

export type MedicationReminder = {
  id: string;
  time: string;
  taken: boolean;
  takenAt?: Date | unknown; // Can be Date or Firestore Timestamp
  takenBy?: string;
};

export type MedicalHistory = {
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
};

export type Allergy = {
  id: string;
  userId: string;
  name: string;
  severity: "mild" | "moderate" | "severe" | "severe-life-threatening";
  reaction?: string;
  notes?: string;
  discoveredDate?: Date;
  timestamp: Date;
};

export type FamilyMember = {
  id: string;
  name: string;
  relation: string;
  avatar?: string;
  userId?: string;
  inviteStatus: "pending" | "accepted" | "none";
  lastActive?: Date;
  healthScore?: number;
};

export type Family = {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
  status?: "active" | "inactive" | "archived" | string;
  createdAt: Date;
};

export type FamilyInvitationCodeStatus = "pending" | "used" | "expired";

export type FamilyInvitationCode = {
  id: string;
  code: string;
  familyId: string;
  invitedBy: string;
  invitedUserName: string;
  invitedUserRelation: string;
  status: FamilyInvitationCodeStatus;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
};

export type EmergencyAlertType = "fall" | "medication" | "emergency" | string;
export type EmergencyAlertSeverity =
  | "low"
  | "medium"
  | "high"
  | "warning"
  | "critical"
  | string;

export type EmergencyAlert = {
  id: string;
  userId: string;
  type: EmergencyAlertType;
  severity: EmergencyAlertSeverity;
  message: string;
  timestamp: Date;
  responders?: string[];
  acknowledged?: boolean;
  resolved?: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  metadata?: Record<string, unknown>;
};

export type LabResult = {
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
};

export type LabResultValue = {
  name: string; // e.g., "Glucose", "Cholesterol", "Hemoglobin"
  value: number | string; // Can be numeric or text (e.g., "Negative", "Positive")
  unit?: string; // e.g., "mg/dL", "mmol/L", "%"
  referenceRange?: string; // e.g., "70-100 mg/dL"
  status?: "normal" | "high" | "low" | "abnormal" | "critical";
  flagged?: boolean; // Whether this result was flagged by the lab
};

export type VitalSign = {
  id: string;
  userId: string;
  type: "heartRate" | "bloodPressure" | "temperature" | "weight" | "bloodSugar";
  value: number;
  unit: string;
  timestamp: Date;
  source: "manual" | "device" | "clinic";
};

export type ClinicalIntegrationType = "clinic" | "lab" | "radiology";

export type ClinicalIntegrationStatus =
  | "pending"
  | "connected"
  | "error"
  | "disconnected"
  | "approved"
  | "rejected";

export type ClinicalIntegration = {
  id: string;
  userId: string;
  type: ClinicalIntegrationType;
  name: string;
  status: ClinicalIntegrationStatus;
  lastSync?: Date;
  settings?: Record<string, unknown>;
};

export type ClinicalIntegrationRequest = {
  id: string;
  userId: string;
  type: ClinicalIntegrationType;
  providerName: string;
  portalUrl?: string;
  patientId?: string;
  notes?: string;
  status: ClinicalIntegrationStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type RecurrencePattern =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom"
  | "asNeeded";

export type CalendarEventType =
  | "appointment"
  | "medication"
  | "symptom"
  | "lab_result"
  | "vaccination"
  | "reminder"
  | "other";

export type CalendarEventReminder = {
  minutesBefore: number;
  sent: boolean;
  sentAt?: Date;
};

export type CalendarEvent = {
  id: string;
  userId: string;
  title: string;
  type: CalendarEventType;
  description?: string;
  startDate: Date;
  endDate?: Date;
  familyId?: string;
  allDay?: boolean;
  location?: string;
  recurrence?: RecurrencePattern;
  recurrencePattern?: RecurrencePattern;
  recurrenceEndDate?: Date;
  recurrenceCount?: number;
  reminderMinutes?: number[];
  reminders?: CalendarEventReminder[];
  color?: string;
  tags?: string[];
  relatedItemId?: string;
  relatedItemType?: string;
  attendees?: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type MedicationInteractionAlert = {
  id: string;
  userId: string;
  type: "medication_interaction" | "new_medication_interaction" | string;
  severity: "major" | "moderate" | "minor" | string;
  title: string;
  message: string;
  medications: string[];
  effects: string[];
  recommendations: string[];
  timestamp: Date;
  acknowledged?: boolean;
  actionable?: boolean;
};

// Period tracking types
export type PeriodEntry = {
  id: string;
  userId: string;
  startDate: Date;
  endDate?: Date;
  flowIntensity?: "light" | "medium" | "heavy";
  symptoms?: string[]; // e.g., "cramps", "bloating", "headache", "mood swings"
  notes?: string;
  createdAt: Date;
};

export type PeriodCycle = {
  id: string;
  userId: string;
  averageCycleLength?: number; // Average days between periods
  averagePeriodLength?: number; // Average days of period
  lastPeriodStart?: Date;
  nextPeriodPredicted?: Date;
  ovulationPredicted?: Date;
  updatedAt: Date;
};

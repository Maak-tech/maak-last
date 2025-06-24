export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  familyId?: string;
  role: 'admin' | 'member';
  createdAt: Date;
  onboardingCompleted: boolean;
  preferences: {
    language: 'en' | 'ar';
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
}

export interface MedicationReminder {
  id: string;
  time: string;
  taken: boolean;
  takenAt?: Date;
}

export interface MedicalHistory {
  id: string;
  userId: string;
  condition: string;
  diagnosedDate?: Date;
  severity?: 'mild' | 'moderate' | 'severe';
  notes?: string;
  isFamily: boolean;
  relation?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  avatar?: string;
  userId?: string;
  inviteStatus: 'pending' | 'accepted' | 'none';
  lastActive?: Date;
  healthScore?: number;
}

export interface VitalSign {
  id: string;
  userId: string;
  type: 'heartRate' | 'bloodPressure' | 'temperature' | 'weight' | 'bloodSugar';
  value: number;
  unit: string;
  timestamp: Date;
  source: 'manual' | 'device' | 'clinic';
}

export interface EmergencyAlert {
  id: string;
  userId: string;
  type: 'fall' | 'emergency' | 'medication' | 'vitals';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  responders?: string[];
}
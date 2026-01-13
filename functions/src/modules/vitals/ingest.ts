/**
 * Vitals Ingestion Module
 * Pure functions for validation, normalization, and vital reading object creation
 * No Firestore dependencies - fully testable
 */

import type { VitalType, Vital } from '../../db/firestore';

export interface VitalInput {
  userId: string;
  type: VitalType;
  value: number;
  unit: string;
  systolic?: number;
  diastolic?: number;
  source?: 'manual' | 'device' | 'healthkit' | 'googlefit' | 'oura' | 'garmin';
  deviceId?: string;
  timestamp?: Date;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// Validation Rules
// ============================================================================

const VITAL_RANGES: Record<VitalType, { min: number; max: number; unit: string }> = {
  heartRate: { min: 20, max: 250, unit: 'bpm' },
  restingHeartRate: { min: 20, max: 200, unit: 'bpm' },
  heartRateVariability: { min: 0, max: 200, unit: 'ms' },
  bloodPressure: { min: 40, max: 300, unit: 'mmHg' },
  respiratoryRate: { min: 0, max: 60, unit: 'breaths/min' },
  oxygenSaturation: { min: 0, max: 100, unit: '%' },
  bodyTemperature: { min: 25, max: 45, unit: '°C' },
  weight: { min: 0, max: 500, unit: 'kg' },
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate required fields
 */
export function validateRequired(input: Partial<VitalInput>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.userId || input.userId.trim() === '') {
    errors.push({ field: 'userId', message: 'User ID is required' });
  }

  if (!input.type) {
    errors.push({ field: 'type', message: 'Vital type is required' });
  }

  if (input.value === undefined || input.value === null) {
    errors.push({ field: 'value', message: 'Value is required' });
  }

  if (!input.unit || input.unit.trim() === '') {
    errors.push({ field: 'unit', message: 'Unit is required' });
  }

  return errors;
}

/**
 * Validate vital type
 */
export function validateVitalType(type: string): ValidationError[] {
  const validTypes: VitalType[] = [
    'heartRate',
    'restingHeartRate',
    'heartRateVariability',
    'bloodPressure',
    'respiratoryRate',
    'oxygenSaturation',
    'bodyTemperature',
    'weight',
  ];

  if (!validTypes.includes(type as VitalType)) {
    return [{
      field: 'type',
      message: `Invalid vital type. Must be one of: ${validTypes.join(', ')}`,
    }];
  }

  return [];
}

/**
 * Validate value range
 */
export function validateValueRange(
  type: VitalType,
  value: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof value !== 'number' || isNaN(value)) {
    return [{ field: 'value', message: 'Value must be a valid number' }];
  }

  const range = VITAL_RANGES[type];
  if (!range) {
    return [];
  }

  if (value < range.min || value > range.max) {
    errors.push({
      field: 'value',
      message: `Value must be between ${range.min} and ${range.max} ${range.unit}`,
    });
  }

  return errors;
}

/**
 * Validate blood pressure specific fields
 */
export function validateBloodPressure(input: VitalInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (input.type === 'bloodPressure') {
    if (input.systolic === undefined || input.systolic === null) {
      errors.push({ field: 'systolic', message: 'Systolic value is required for blood pressure' });
    } else if (input.systolic < 40 || input.systolic > 300) {
      errors.push({ field: 'systolic', message: 'Systolic must be between 40 and 300 mmHg' });
    }

    if (input.diastolic === undefined || input.diastolic === null) {
      errors.push({ field: 'diastolic', message: 'Diastolic value is required for blood pressure' });
    } else if (input.diastolic < 20 || input.diastolic > 200) {
      errors.push({ field: 'diastolic', message: 'Diastolic must be between 20 and 200 mmHg' });
    }

    // Validate systolic > diastolic
    if (input.systolic && input.diastolic && input.systolic <= input.diastolic) {
      errors.push({
        field: 'bloodPressure',
        message: 'Systolic must be greater than diastolic',
      });
    }
  }

  return errors;
}

/**
 * Validate source
 */
export function validateSource(source?: string): ValidationError[] {
  if (!source) {
    return [];
  }

  const validSources = ['manual', 'device', 'healthkit', 'googlefit', 'oura', 'garmin'];
  if (!validSources.includes(source)) {
    return [{
      field: 'source',
      message: `Invalid source. Must be one of: ${validSources.join(', ')}`,
    }];
  }

  return [];
}

/**
 * Validate complete vital input
 */
export function validateVitalInput(input: Partial<VitalInput>): ValidationResult {
  const allErrors: ValidationError[] = [];

  // Required fields
  allErrors.push(...validateRequired(input));

  // If required fields are missing, return early
  if (allErrors.length > 0) {
    return { isValid: false, errors: allErrors };
  }

  // Type validation
  allErrors.push(...validateVitalType(input.type!));

  // Value range
  if (input.type && input.value !== undefined) {
    allErrors.push(...validateValueRange(input.type as VitalType, input.value));
  }

  // Blood pressure specific
  if (input.type === 'bloodPressure') {
    allErrors.push(...validateBloodPressure(input as VitalInput));
  }

  // Source validation
  allErrors.push(...validateSource(input.source));

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Normalize unit to standard format
 */
export function normalizeUnit(type: VitalType, unit: string): string {
  const unitMap: Record<string, string> = {
    // Heart rate
    'bpm': 'bpm',
    'beats/min': 'bpm',
    'beats per minute': 'bpm',
    
    // Temperature
    '°c': '°C',
    'c': '°C',
    'celsius': '°C',
    '°f': '°F',
    'f': '°F',
    'fahrenheit': '°F',
    
    // Oxygen
    '%': '%',
    'percent': '%',
    'spo2': '%',
    
    // Weight
    'kg': 'kg',
    'kilogram': 'kg',
    'kilograms': 'kg',
    'lb': 'lb',
    'lbs': 'lb',
    'pound': 'lb',
    'pounds': 'lb',
    
    // Blood pressure
    'mmhg': 'mmHg',
    'mm hg': 'mmHg',
    
    // Respiratory rate
    'breaths/min': 'breaths/min',
    'breaths per minute': 'breaths/min',
    'rpm': 'breaths/min',
    
    // HRV
    'ms': 'ms',
    'milliseconds': 'ms',
  };

  const normalized = unitMap[unit.toLowerCase()] || unit;
  
  // Use expected unit for vital type if available
  const expectedUnit = VITAL_RANGES[type]?.unit;
  return expectedUnit || normalized;
}

/**
 * Convert temperature to Celsius if in Fahrenheit
 */
export function normalizeTemperature(value: number, unit: string): { value: number; unit: string } {
  if (unit === '°F' || unit.toLowerCase() === 'f' || unit.toLowerCase() === 'fahrenheit') {
    return {
      value: (value - 32) * (5 / 9),
      unit: '°C',
    };
  }
  return { value, unit: '°C' };
}

/**
 * Convert weight to kg if in pounds
 */
export function normalizeWeight(value: number, unit: string): { value: number; unit: string } {
  if (unit === 'lb' || unit === 'lbs' || unit.toLowerCase() === 'pound' || unit.toLowerCase() === 'pounds') {
    return {
      value: value * 0.453592,
      unit: 'kg',
    };
  }
  return { value, unit: 'kg' };
}

/**
 * Normalize vital value based on type
 */
export function normalizeValue(
  type: VitalType,
  value: number,
  unit: string
): { value: number; unit: string } {
  if (type === 'bodyTemperature') {
    return normalizeTemperature(value, unit);
  }
  
  if (type === 'weight') {
    return normalizeWeight(value, unit);
  }
  
  return { value, unit: normalizeUnit(type, unit) };
}

/**
 * Create normalized VitalReading object
 */
export function createVitalReading(input: VitalInput): Omit<Vital, 'id' | 'createdAt'> {
  const normalized = normalizeValue(input.type, input.value, input.unit);
  
  const vital: Omit<Vital, 'id' | 'createdAt'> = {
    userId: input.userId.trim(),
    type: input.type,
    value: Math.round(normalized.value * 100) / 100, // Round to 2 decimal places
    unit: normalized.unit,
    source: input.source || 'manual',
    timestamp: input.timestamp 
      ? new Date(input.timestamp) as any // Will be converted to Timestamp by Firestore
      : new Date() as any,
  };

  // Add blood pressure fields if applicable
  if (input.type === 'bloodPressure' && input.systolic && input.diastolic) {
    vital.systolic = input.systolic;
    vital.diastolic = input.diastolic;
  }

  // Add device ID if provided
  if (input.deviceId) {
    vital.deviceId = input.deviceId;
  }

  return vital;
}

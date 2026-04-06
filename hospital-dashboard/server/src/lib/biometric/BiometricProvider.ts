export interface RecognitionResult {
  subjectId: string
  confidence: number
  /** True when confidence is in the near-miss range (0.60–0.84).
   *  Near-miss results are NOT used to identify a patient — they are
   *  logged as audit events for QA and safety review, then discarded. */
  isNearMiss: boolean
}

export abstract class BiometricProvider {
  abstract enroll(subjectId: string, imageBuffer: Buffer): Promise<void>
  abstract recognize(imageBuffer: Buffer): Promise<RecognitionResult | null>
  abstract deleteSubject(subjectId: string): Promise<void>
}

/** Confidence thresholds for recognition quality tiers. */
export const CONFIDENCE_MATCH = 0.85      // ≥ this → valid match, create session
export const CONFIDENCE_NEAR_MISS_MIN = 0.60  // ≥ this but < MATCH → near-miss, audit only

export interface RecognitionResult {
  subjectId: string
  confidence: number
}

export abstract class BiometricProvider {
  abstract enroll(subjectId: string, imageBuffer: Buffer): Promise<void>
  abstract recognize(imageBuffer: Buffer): Promise<RecognitionResult | null>
  abstract deleteSubject(subjectId: string): Promise<void>
}

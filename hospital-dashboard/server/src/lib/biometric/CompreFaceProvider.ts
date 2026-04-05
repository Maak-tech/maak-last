import { BiometricProvider, RecognitionResult } from './BiometricProvider.js'

// Default timeouts for CompreFace API calls.
// Enroll/recognize involve image upload + ML inference, so they get more time.
const ENROLL_TIMEOUT_MS    = 30_000  // 30 s — image upload + face embedding
const RECOGNIZE_TIMEOUT_MS = 15_000  // 15 s — face embedding lookup
const DELETE_TIMEOUT_MS    = 10_000  // 10 s — simple DB delete

export class CompreFaceProvider extends BiometricProvider {
  private baseUrl: string
  private apiKey: string

  constructor() {
    super()
    const apiKey = process.env.COMPREFACE_API_KEY
    if (!apiKey) {
      console.warn('[CompreFace] COMPREFACE_API_KEY is not set — biometric recognition will fail.')
    }
    this.baseUrl = process.env.COMPREFACE_URL ?? 'http://localhost:8000'
    this.apiKey = apiKey ?? ''
  }

  async enroll(subjectId: string, imageBuffer: Buffer): Promise<void> {
    const formData = new FormData()
    formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }), 'face.jpg')

    let response: Response
    try {
      response = await fetch(
        `${this.baseUrl}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectId)}`,
        {
          method: 'POST',
          headers: { 'x-api-key': this.apiKey },
          body: formData,
          signal: AbortSignal.timeout(ENROLL_TIMEOUT_MS),
        }
      )
    } catch (err: unknown) {
      throw new Error(`CompreFace enroll network error: ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`CompreFace enroll failed: ${response.status} ${text}`)
    }
  }

  async recognize(imageBuffer: Buffer): Promise<RecognitionResult | null> {
    const formData = new FormData()
    formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }), 'face.jpg')

    let response: Response
    try {
      response = await fetch(
        `${this.baseUrl}/api/v1/recognition/recognize?limit=1&prediction_count=1`,
        {
          method: 'POST',
          headers: { 'x-api-key': this.apiKey },
          body: formData,
          signal: AbortSignal.timeout(RECOGNIZE_TIMEOUT_MS),
        }
      )
    } catch (err: unknown) {
      throw new Error(`CompreFace recognize network error: ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!response.ok) return null

    let data: unknown
    try {
      data = await response.json()
    } catch {
      return null
    }

    // Validate response structure before accessing nested properties
    if (
      typeof data !== 'object' ||
      data === null ||
      !('result' in data) ||
      !Array.isArray((data as { result: unknown }).result)
    ) {
      return null
    }

    const typedData = data as {
      result: Array<{
        subjects?: Array<{ subject: string; similarity: number }>
      }>
    }

    const subjects = typedData.result[0]?.subjects
    if (!subjects || subjects.length === 0) return null

    const best = subjects[0]
    if (
      typeof best !== 'object' ||
      best === null ||
      typeof best.subject !== 'string' ||
      typeof best.similarity !== 'number'
    ) {
      return null
    }

    if (best.similarity < 0.85) return null

    return { subjectId: best.subject, confidence: best.similarity }
  }

  async deleteSubject(subjectId: string): Promise<void> {
    let response: Response
    try {
      response = await fetch(
        `${this.baseUrl}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectId)}`,
        {
          method: 'DELETE',
          headers: { 'x-api-key': this.apiKey },
          signal: AbortSignal.timeout(DELETE_TIMEOUT_MS),
        }
      )
    } catch (err: unknown) {
      throw new Error(`CompreFace deleteSubject network error: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new Error(`CompreFace deleteSubject failed: ${response.status} ${text}`)
    }
  }
}

import { BiometricProvider, RecognitionResult } from './BiometricProvider.js'

export class CompreFaceProvider extends BiometricProvider {
  private baseUrl: string
  private apiKey: string

  constructor() {
    super()
    this.baseUrl = process.env.COMPREFACE_URL ?? 'http://localhost:8000'
    this.apiKey = process.env.COMPREFACE_API_KEY ?? ''
  }

  async enroll(subjectId: string, imageBuffer: Buffer): Promise<void> {
    const formData = new FormData()
    formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }), 'face.jpg')

    const response = await fetch(
      `${this.baseUrl}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectId)}`,
      {
        method: 'POST',
        headers: { 'x-api-key': this.apiKey },
        body: formData,
      }
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`CompreFace enroll failed: ${response.status} ${text}`)
    }
  }

  async recognize(imageBuffer: Buffer): Promise<RecognitionResult | null> {
    const formData = new FormData()
    formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }), 'face.jpg')

    const response = await fetch(
      `${this.baseUrl}/api/v1/recognition/recognize?limit=1&prediction_count=1`,
      {
        method: 'POST',
        headers: { 'x-api-key': this.apiKey },
        body: formData,
      }
    )

    if (!response.ok) return null

    const data = await response.json() as {
      result?: Array<{
        subjects?: Array<{ subject: string; similarity: number }>
      }>
    }

    const subjects = data.result?.[0]?.subjects
    if (!subjects || subjects.length === 0) return null

    const best = subjects[0]
    if (best.similarity < 0.85) return null

    return { subjectId: best.subject, confidence: best.similarity }
  }

  async deleteSubject(subjectId: string): Promise<void> {
    await fetch(
      `${this.baseUrl}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectId)}`,
      {
        method: 'DELETE',
        headers: { 'x-api-key': this.apiKey },
      }
    )
  }
}

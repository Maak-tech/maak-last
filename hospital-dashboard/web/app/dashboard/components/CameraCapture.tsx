'use client'
import { useRef, useEffect, useState, useCallback } from 'react'

interface Props {
  onCapture: (formData: FormData) => void
  loading: boolean
}

export default function CameraCapture({ onCapture, loading }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [streamActive, setStreamActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setStreamActive(true)
          setError(null)
        }
      } catch {
        setError('Camera access denied or not available.')
      }
    }

    startCamera()

    return () => {
      stream?.getTracks().forEach((t) => t.stop())
      setStreamActive(false)
    }
  }, [])

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      const fd = new FormData()
      fd.append('image', blob, 'capture.jpg')
      onCapture(fd)
    }, 'image/jpeg', 0.9)
  }, [onCapture])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-gray-800 rounded-xl border border-gray-700 gap-3">
        <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
        </svg>
        <p className="text-sm text-gray-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-black border border-gray-700">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-48 object-cover"
        />
        {!streamActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-400 text-sm">Starting camera...</p>
          </div>
        )}
        {/* Face guide overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-28 h-36 rounded-full border-2 border-blue-400 border-dashed opacity-60" />
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <button
        onClick={capture}
        disabled={!streamActive || loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {loading ? 'Scanning...' : 'Capture & Identify'}
      </button>
    </div>
  )
}

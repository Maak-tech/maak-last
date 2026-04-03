'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { clearToken } from './api'

const TIMEOUT_MS = 15 * 60 * 1000  // 15 minutes — HIPAA §164.312(a)(1)

export function useAutoLogout() {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function reset() {
      sessionStorage.setItem('hospital_last_active', Date.now().toString())
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        clearToken()
        router.push('/login')
      }, TIMEOUT_MS)
    }

    reset()
    window.addEventListener('mousemove', reset)
    window.addEventListener('keypress', reset)
    window.addEventListener('click', reset)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      window.removeEventListener('mousemove', reset)
      window.removeEventListener('keypress', reset)
      window.removeEventListener('click', reset)
    }
  }, [router])
}

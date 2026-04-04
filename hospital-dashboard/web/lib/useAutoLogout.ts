'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { clearToken } from './api'

const TIMEOUT_MS = 15 * 60 * 1000  // 15 minutes — HIPAA §164.312(a)(1)

// Activity events to watch. Include touch events so that tablet/touchscreen
// users in hospital environments also reset the idle timer.
const ACTIVITY_EVENTS = ['mousemove', 'keypress', 'click', 'touchstart', 'touchmove'] as const

export function useAutoLogout() {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function reset() {
      sessionStorage.setItem('hospital_last_active', Date.now().toString())
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        // Clear both the JWT and the staff info so no PHI-adjacent data lingers
        // after an auto-logout (mirrors what handleLogout() does in page.tsx).
        clearToken()
        sessionStorage.removeItem('hospital_staff')
        router.push('/login')
      }, TIMEOUT_MS)
    }

    reset()
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, reset, { passive: true })

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, reset)
    }
  }, [router])
}

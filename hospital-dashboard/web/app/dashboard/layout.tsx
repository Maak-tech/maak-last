'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/api'
import { useAutoLogout } from '@/lib/useAutoLogout'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  useAutoLogout()

  useEffect(() => {
    // Use getToken() so this check works with the in-memory token store.
    // Reading sessionStorage directly would always return null after the
    // token was moved out of sessionStorage (Bug: redirect loop).
    if (!getToken()) router.push('/login')
  }, [router])

  return <div className="min-h-screen bg-gray-950">{children}</div>
}

'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAutoLogout } from '@/lib/useAutoLogout'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  useAutoLogout()

  useEffect(() => {
    const token = sessionStorage.getItem('hospital_token')
    if (!token) router.push('/login')
  }, [router])

  return <div className="min-h-screen bg-gray-950">{children}</div>
}

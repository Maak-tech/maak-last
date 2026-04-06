import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { userService } from '@/lib/services/userService'

export interface FamilyMember {
  id: string
  userId: string
  name: string
  email: string
  role: 'admin' | 'member'
  familyId: string
  [key: string]: unknown
}

export function useFamilyMembers(familyId: string | null | undefined) {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!familyId) {
      setMembers([])
      setLoading(false)
      return
    }
    try {
      setError(null)
      const data = await userService.getFamilyMembers(familyId)
      setMembers(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load family members')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [familyId])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await load()
  }, [load])

  return { members, setMembers, loading, refreshing, error, load, refresh }
}

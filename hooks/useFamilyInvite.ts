import { useState, useCallback } from 'react'

export function useFamilyInvite(familyId: string | null | undefined) {
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', relation: '' })
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)

  const reset = useCallback(() => {
    setForm({ name: '', relation: '' })
    setGeneratedCode(null)
    setShowModal(false)
  }, [])

  return { showModal, setShowModal, loading, setLoading, form, setForm, generatedCode, setGeneratedCode, reset }
}

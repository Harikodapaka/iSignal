'use client'

import { useState, useEffect, useCallback } from 'react'
import type { IAnalytics } from '@/types'

export function useAnalytics() {
  const [analytics, setAnalytics] = useState<IAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics')
      const data = await res.json()
      if (data.success) setAnalytics(data.data ?? [])
      else setError(data.error ?? 'Failed')
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refetch() }, [refetch])
  return { analytics, loading, error, refetch }
}

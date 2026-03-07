'use client'

import { useState, useEffect, useCallback } from 'react'
import type { IAnalytics } from '@/types'

function getLocalTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export type AnalyticsRange = '7d' | '30d' | '3mo'

export function useAnalytics(metricKey?: string, range: AnalyticsRange = '7d') {
  const [analytics, setAnalytics] = useState<IAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tz = getLocalTz()
      const params = new URLSearchParams({ tz, range })
      if (metricKey) params.set('metric', metricKey)
      const res = await fetch(`/api/analytics?${params}`)
      const data = await res.json()
      if (data.success) setAnalytics(data.data ?? [])
      else setError(data.error ?? 'Failed')
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }, [metricKey, range])

  useEffect(() => { refetch() }, [refetch])
  return { analytics, loading, error, refetch }
}
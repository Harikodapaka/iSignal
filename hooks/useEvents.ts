'use client'

import { useState, useEffect, useCallback } from 'react'
import type { IEvent } from '@/types'

export function useEvents(date?: string) {
  const [events, setEvents] = useState<IEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = date ? `/api/events?date=${date}` : '/api/events'
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) setEvents(data.data ?? [])
      else setError(data.error ?? 'Failed')
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }, [date])

  useEffect(() => { refetch() }, [refetch])
  return { events, loading, error, refetch }
}

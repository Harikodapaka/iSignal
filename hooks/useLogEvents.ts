'use client';

import { useState, useEffect, useCallback } from 'react';
import type { IEvent } from '@/types';

export interface LogFilters {
  startDate: string;
  endDate: string;
  metricKeys: string[];
  page: number;
}

export interface EventPage {
  events: IEvent[];
  total: number;
  page: number;
  limit: number;
}

export function useLogEvents(filters: LogFilters) {
  const [data, setData] = useState<EventPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const metricKeysKey = filters.metricKeys.join(',');

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: String(filters.page),
        limit: '50',
      });
      if (metricKeysKey) params.set('metricKeys', metricKeysKey);

      const res = await fetch(`/api/events?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error ?? 'Failed to load');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate, metricKeysKey, filters.page]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

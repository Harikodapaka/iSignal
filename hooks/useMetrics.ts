'use client';

import { useState, useEffect, useCallback } from 'react';
import type { IMetric } from '@/types';

export function useMetrics(pinnedOnly = false) {
  const [metrics, setMetrics] = useState<IMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = pinnedOnly ? '/api/metrics?pinned=true' : '/api/metrics';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setMetrics(data.data ?? []);
      else setError(data.error ?? 'Failed');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [pinnedOnly]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const togglePin = useCallback(async (metricKey: string, pinned: boolean) => {
    setMetrics((prev) => prev.map((m) => (m.metricKey === metricKey ? { ...m, pinned } : m)));
    try {
      const res = await fetch('/api/metrics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metricKey, pinned }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    } catch {
      setMetrics((prev) => prev.map((m) => (m.metricKey === metricKey ? { ...m, pinned: !pinned } : m)));
      throw new Error('Failed to update');
    }
  }, []);

  // Optimistically update a metric in local state after an edit
  const updateMetric = useCallback((updated: IMetric) => {
    setMetrics((prev) => prev.map((m) => (m.metricKey === updated.metricKey ? { ...m, ...updated } : m)));
  }, []);

  return { metrics, loading, error, refetch, togglePin, updateMetric };
}

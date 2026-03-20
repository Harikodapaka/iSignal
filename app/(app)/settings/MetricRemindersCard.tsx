'use client';

import { useCallback, useEffect, useState } from 'react';
import { Box, Group, Loader, MultiSelect, Stack, Switch, Text } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { GlassCard } from '@/components/ui/GlassCard';
import { getMetricEmoji } from '@/lib/parser';

interface MetricReminder {
  metricKey: string;
  displayName: string;
  reminder?: {
    enabled: boolean;
    times: number[];
  };
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`,
}));

export function MetricRemindersCard() {
  const [metrics, setMetrics] = useState<MetricReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics?pinned=true');
      const data = await res.json();
      if (data.success) {
        setMetrics(data.data ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const toggleReminder = async (metricKey: string, enabled: boolean, times: number[]) => {
    setSaving(metricKey);
    try {
      const res = await fetch('/api/metrics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricKey,
          reminder: { enabled, times },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMetrics((prev) => prev.map((m) => (m.metricKey === metricKey ? { ...m, reminder: { enabled, times } } : m)));
      } else {
        notifications.show({ message: 'Failed to update reminder', color: 'red' });
      }
    } catch {
      notifications.show({ message: 'Network error', color: 'red' });
    } finally {
      setSaving(null);
    }
  };

  const updateTimes = async (metricKey: string, times: number[]) => {
    const metric = metrics.find((m) => m.metricKey === metricKey);
    if (!metric) return;
    await toggleReminder(metricKey, metric.reminder?.enabled ?? true, times);
  };

  if (loading) {
    return (
      <GlassCard>
        <Group justify="center" p="xl">
          <Loader size="sm" color="orange" />
        </Group>
      </GlassCard>
    );
  }

  if (metrics.length === 0) {
    return (
      <GlassCard>
        <Text size="sm" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          No pinned metrics yet. Start logging to see metrics here.
        </Text>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <Stack gap="md">
        <Group gap="xs" align="center">
          <IconClock size={20} style={{ color: 'var(--orange)' }} />
          <Text fw={600} size="sm" style={{ color: 'var(--text-primary)' }}>
            Per-Metric Reminders
          </Text>
        </Group>
        <Text size="xs" style={{ color: 'var(--text-muted)' }}>
          Get reminded to log specific metrics at times you choose. Only sends if you haven&apos;t logged that metric
          yet today.
        </Text>

        <Box
          style={{
            maxHeight: 320,
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          <Stack gap="sm">
            {metrics.map((m) => {
              const enabled = m.reminder?.enabled ?? false;
              const times = m.reminder?.times ?? [];
              const emoji = getMetricEmoji(m.metricKey);
              const isSaving = saving === m.metricKey;

              return (
                <Box
                  key={m.metricKey}
                  p="sm"
                  style={{
                    background: 'var(--card-bg)',
                    borderRadius: 10,
                    border: '1px solid var(--sidebar-border)',
                  }}
                >
                  <Group justify="space-between" align="center" mb={enabled ? 'xs' : 0}>
                    <Group gap="xs">
                      <Text size="sm">{emoji}</Text>
                      <Text size="sm" fw={500} style={{ color: 'var(--text-primary)' }}>
                        {m.displayName}
                      </Text>
                      {isSaving && <Loader size={12} color="orange" />}
                    </Group>
                    <Switch
                      checked={enabled}
                      onChange={() => toggleReminder(m.metricKey, !enabled, times.length > 0 ? times : [9])}
                      disabled={isSaving}
                      size="sm"
                      color="orange"
                    />
                  </Group>

                  {enabled && (
                    <MultiSelect
                      data={HOUR_OPTIONS}
                      value={times.map(String)}
                      onChange={(vals) => updateTimes(m.metricKey, vals.map(Number))}
                      placeholder="Pick reminder times"
                      size="xs"
                      maxValues={5}
                      styles={{
                        input: {
                          background: 'var(--input-bg)',
                          border: '1px solid var(--input-border)',
                          borderRadius: 8,
                        },
                      }}
                    />
                  )}
                </Box>
              );
            })}
          </Stack>
        </Box>

        <Text size="xs" style={{ color: 'var(--text-faint)' }}>
          Reminders are checked hourly. You won&apos;t receive a reminder if the metric is already logged for the day.
        </Text>
      </Stack>
    </GlassCard>
  );
}

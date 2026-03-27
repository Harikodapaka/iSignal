'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Box, Button, Group, Loader, MultiSelect, Stack, Switch, Text, Tooltip } from '@mantine/core';
import { IconBulb, IconClock } from '@tabler/icons-react';
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

interface MetricSuggestion {
  metricKey: string;
  suggestedTimes: number[];
  confidence: 'high' | 'medium' | 'low';
  sampleSize: number;
  peakHourCount: number;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`,
}));

function formatHour(h: number): string {
  return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
}

function formatSuggestionHint(times: number[]): string {
  const formatted = times.map(formatHour);
  if (formatted.length === 1) return `You usually log this around ${formatted[0]}`;
  if (formatted.length === 2) return `You usually log this around ${formatted[0]} and ${formatted[1]}`;
  const last = formatted.pop()!;
  return `You usually log this around ${formatted.join(', ')}, and ${last}`;
}

export function MetricRemindersCard() {
  const [metrics, setMetrics] = useState<MetricReminder[]>([]);
  const [suggestions, setSuggestions] = useState<Map<string, MetricSuggestion>>(new Map());
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

  const fetchSuggestions = useCallback(async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(`/api/metrics/suggestions?tz=${encodeURIComponent(tz)}`);
      const data = await res.json();
      if (data.success && data.data) {
        const map = new Map<string, MetricSuggestion>();
        for (const s of data.data as MetricSuggestion[]) {
          map.set(s.metricKey, s);
        }
        setSuggestions(map);
      }
    } catch {
      /* ignore — suggestions are best-effort */
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    fetchSuggestions();
  }, [fetchMetrics, fetchSuggestions]);

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

  const applySuggestion = async (metricKey: string, suggestedTimes: number[]) => {
    await toggleReminder(metricKey, true, suggestedTimes);
    notifications.show({
      message: 'Smart reminders applied!',
      color: 'orange',
    });
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
            maxHeight: 400,
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
              const suggestion = suggestions.get(m.metricKey);
              // Show suggestion if: has one, reminder not yet enabled, or enabled but no times set
              const showSuggestion = suggestion && (!enabled || times.length === 0);

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
                  <Group justify="space-between" align="center" mb={enabled || showSuggestion ? 'xs' : 0}>
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

                  {/* Smart suggestion banner */}
                  {showSuggestion && (
                    <Box
                      mb="xs"
                      p="xs"
                      style={{
                        background: 'var(--orange-tint)',
                        borderRadius: 8,
                        border: '1px solid color-mix(in srgb, var(--orange) 20%, transparent)',
                      }}
                    >
                      <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                        <Group gap={6} align="center" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                          <IconBulb size={14} color="var(--orange)" style={{ flexShrink: 0 }} />
                          <Text size="xs" style={{ color: 'var(--text-secondary)' }} lineClamp={2}>
                            {formatSuggestionHint(suggestion.suggestedTimes)}
                          </Text>
                          <Tooltip
                            label={`Based on ${suggestion.sampleSize} logs from the last 30 days`}
                            position="top"
                            withArrow
                          >
                            <Badge
                              size="xs"
                              variant="light"
                              color={
                                suggestion.confidence === 'high'
                                  ? 'green'
                                  : suggestion.confidence === 'medium'
                                    ? 'orange'
                                    : 'gray'
                              }
                              style={{ flexShrink: 0 }}
                            >
                              {suggestion.confidence}
                            </Badge>
                          </Tooltip>
                        </Group>
                        <Button
                          size="compact-xs"
                          variant="light"
                          color="orange"
                          onClick={() => applySuggestion(m.metricKey, suggestion.suggestedTimes)}
                          disabled={isSaving}
                          style={{ flexShrink: 0 }}
                        >
                          Apply
                        </Button>
                      </Group>
                    </Box>
                  )}

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
          {suggestions.size > 0 && ' 💡 Smart suggestions are based on your logging patterns.'}
        </Text>
      </Stack>
    </GlassCard>
  );
}

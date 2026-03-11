'use client';

import { Card, Group, Stack, Text, Badge, rem } from '@mantine/core';
import { IconTrendingUp, IconTrendingDown, IconMinus, IconFlame } from '@tabler/icons-react';
import { SparkBars } from '@/components/ui/SparkBars';
import { getMetricColor, getMetricEmoji } from '@/lib/parser';
import type { IAnalytics } from '@/types';

export function MetricCard({ analytics }: { analytics: IAnalytics }) {
  const color = getMetricColor(analytics.metricKey);
  const emoji = getMetricEmoji(analytics.metricKey);
  const isBoolean = analytics.valueType === 'boolean';

  return (
    <Card
      p="md"
      radius="xl"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderTop: `2px solid ${color}`,
        boxShadow: 'var(--card-shadow)',
        transition: 'transform 0.18s, box-shadow 0.18s',
        cursor: 'pointer',
      }}
    >
      <Group justify="space-between" mb="xs" align="flex-start" wrap="nowrap">
        <Group gap={4} style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm" style={{ flexShrink: 0 }}>
            {emoji}
          </Text>
          <Text
            size="xs"
            fw={700}
            tt="uppercase"
            style={{
              letterSpacing: '0.07em',
              fontSize: rem(10),
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {analytics.displayName}
          </Text>
        </Group>

        <Stack gap={0} align="flex-end" style={{ flexShrink: 0 }}>
          <Text fw={700} size="sm" style={{ color, letterSpacing: '-0.02em' }}>
            {isBoolean
              ? `${analytics.monthlyCompletionPct ?? 0}%`
              : analytics.monthlyAvg != null
                ? `${analytics.monthlyAvg}${analytics.unit && analytics.unit !== '/10' ? ` ${analytics.unit}` : ''}`
                : '—'}
          </Text>
          <Text size="xs" style={{ color: 'var(--text-muted)' }}>
            30d avg
          </Text>
        </Stack>
      </Group>

      {isBoolean ? (
        <Text size="xl" fw={800} mb="xs" style={{ letterSpacing: '-0.04em', color }}>
          {analytics.daysCompletedThisWeek ?? 0}
          <Text span size="sm" fw={400} ml={2} style={{ color: 'var(--text-muted)' }}>
            / 7 days
          </Text>
        </Text>
      ) : (
        <Text size="xl" fw={800} mb="xs" style={{ letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
          {analytics.sevenDayAvg ?? 0}
          {analytics.unit && (
            <Text span size="sm" fw={400} ml={3} style={{ color: 'var(--text-muted)' }}>
              {analytics.unit}
            </Text>
          )}
        </Text>
      )}

      {analytics.last7Days && <SparkBars data={analytics.last7Days} color={color} />}

      <Group justify="space-between" mt="xs">
        {isBoolean ? (
          <>
            {(analytics.currentStreak ?? 0) > 0 && (
              <Badge size="xs" variant="light" color="orange" leftSection={<IconFlame size={10} />} radius="xl">
                {analytics.currentStreak} day streak
              </Badge>
            )}
            <Text size="xs" style={{ color: 'var(--text-muted)' }}>
              {analytics.monthlyCompletionPct ?? 0}% this month
            </Text>
          </>
        ) : (
          <>
            <Group gap={4}>
              {analytics.trend === 'up' && <IconTrendingUp size={12} color="var(--green)" />}
              {analytics.trend === 'down' && <IconTrendingDown size={12} color="var(--red)" />}
              {analytics.trend === 'flat' && <IconMinus size={12} color="var(--text-faint)" />}
              <Text
                size="xs"
                style={{
                  color:
                    analytics.trend === 'up'
                      ? 'var(--green)'
                      : analytics.trend === 'down'
                        ? 'var(--red)'
                        : 'var(--text-muted)',
                }}
              >
                {analytics.trendPct ? `${analytics.trendPct}%` : 'stable'}
              </Text>
            </Group>
          </>
        )}
      </Group>
    </Card>
  );
}

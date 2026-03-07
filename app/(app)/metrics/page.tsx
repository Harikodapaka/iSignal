'use client'

import { useState } from 'react'
import { Box, Badge, Group, SimpleGrid, Skeleton, Stack, Switch, Text, ThemeIcon, ActionIcon } from '@mantine/core'
import { IconPencil } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { MetricEditDrawer } from '@/components/metrics/MetricEditDrawer'
import { useMetrics } from '@/hooks/useMetrics'
import { getMetricColor, getMetricEmoji } from '@/lib/parser'
import type { IMetric } from '@/types'

export default function MetricsPage() {
  const { metrics, loading, togglePin, updateMetric } = useMetrics()
  const [editTarget, setEditTarget] = useState<IMetric | null>(null)

  const pinned = metrics.filter(m => m.pinned)
  const unpinned = metrics.filter(m => !m.pinned)

  const handleToggle = async (metricKey: string, pinned: boolean) => {
    try {
      await togglePin(metricKey, pinned)
    } catch {
      notifications.show({ message: 'Failed to update metric', color: 'red', autoClose: 3000 })
    }
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Metrics"
        subtitle={loading ? 'Loading…' : `${metrics.length} tracked · ${pinned.length} pinned`}
      />

      {loading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} height={90} radius="xl" />)}
        </SimpleGrid>
      ) : metrics.length === 0 ? (
        <GlassCard p="xl" style={{ textAlign: 'center' }}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
          <Text fw={600} mb={4} style={{ color: 'var(--text-primary)' }}>No metrics yet</Text>
          <Text size="sm" style={{ color: 'var(--text-muted)' }}>Head to Today and start logging — metrics appear automatically</Text>
        </GlassCard>
      ) : (
        <>
          {pinned.length > 0 && (
            <Box className="fade-in fade-in-1">
              <SectionLabel>📌 Pinned to Dashboard</SectionLabel>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                {pinned.map((m, i) => (
                  <MetricRow key={m.metricKey} metric={m}
                    onToggle={handleToggle}
                    onEdit={() => setEditTarget(m)}
                    delay={i} />
                ))}
              </SimpleGrid>
            </Box>
          )}
          {unpinned.length > 0 && (
            <Box className="fade-in fade-in-2">
              <SectionLabel mt={pinned.length > 0 ? 'md' : undefined}>All Metrics</SectionLabel>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                {unpinned.map((m, i) => (
                  <MetricRow key={m.metricKey} metric={m}
                    onToggle={handleToggle}
                    onEdit={() => setEditTarget(m)}
                    delay={i} />
                ))}
              </SimpleGrid>
            </Box>
          )}
        </>
      )}

      <MetricEditDrawer
        metric={editTarget}
        opened={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={(updated) => {
          updateMetric(updated)
          setEditTarget(null)
        }}
      />
    </Stack>
  )
}

function MetricRow({ metric, onToggle, onEdit, delay }: {
  metric: IMetric
  onToggle: (k: string, p: boolean) => void
  onEdit: () => void
  delay: number
}) {
  const color = getMetricColor(metric.metricKey)
  const emoji = getMetricEmoji(metric.metricKey)
  return (
    <GlassCard p="md" accentColor={metric.pinned ? color : undefined}
      className={`fade-in fade-in-${(delay % 5) + 1}`}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" style={{ minWidth: 0 }}>
          <ThemeIcon size={40} radius="xl" style={{ background: `${color}18`, fontSize: 20, flexShrink: 0 }}>
            {emoji}
          </ThemeIcon>
          <Box style={{ minWidth: 0 }}>
            <Text fw={600} size="sm" truncate style={{ color: 'var(--text-primary)' }}>{metric.displayName}</Text>
            <Group gap={5} mt={3} style={{ flexWrap: 'nowrap' }}>
              <Badge size="xs" variant="light" color="gray" radius="sm">{metric.valueType}</Badge>
              {metric.unit && <Badge size="xs" variant="outline" color="blue" radius="sm">{metric.unit}</Badge>}
              {metric.aggregation && metric.valueType === 'number' && (
                <Badge size="xs" variant="outline" color="violet" radius="sm">{metric.aggregation}</Badge>
              )}
              <Text size="xs" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{metric.frequencyScore}× logged</Text>
            </Group>
          </Box>
        </Group>
        <Group gap="xs" style={{ flexShrink: 0 }}>
          <ActionIcon variant="subtle" size="sm" radius="xl" onClick={onEdit}
            style={{ color: 'var(--text-muted)' }}>
            <IconPencil size={14} />
          </ActionIcon>
          <Switch checked={metric.pinned} onChange={e => onToggle(metric.metricKey, e.currentTarget.checked)}
            color="orange" size="sm" />
        </Group>
      </Group>
    </GlassCard>
  )
}
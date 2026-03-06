'use client'

import { useState } from 'react'
import { Box, Group, SegmentedControl, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core'
import { AreaChart, BarChart } from '@mantine/charts'
import { IconTrendingUp, IconTrendingDown, IconMinus } from '@tabler/icons-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAnalytics } from '@/hooks/useAnalytics'
import { getMetricColor, getMetricEmoji } from '@/lib/parser'
import { DAY_LABELS } from '@/utils/date'

export default function TrendsPage() {
  const { analytics, loading } = useAnalytics()
  const [range, setRange] = useState('7d')

  return (
    <Stack gap="xl">
      <PageHeader
        title="Trends"
        subtitle="Your patterns over time"
        actions={
          <SegmentedControl data={['7d', '30d', '3mo']} value={range} onChange={setRange}
            styles={{ root: { background: 'var(--card-bg)', border: '1px solid var(--card-border)' } }} />
        }
      />

      {loading ? (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {[1,2,3,4].map(i => <Skeleton key={i} height={220} radius="xl" />)}
        </SimpleGrid>
      ) : analytics.length === 0 ? (
        <GlassCard p="xl" style={{ textAlign: 'center' }}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
          <Text fw={600} mb={4} style={{ color: 'var(--text-primary)' }}>No trend data yet</Text>
          <Text size="sm" style={{ color: 'var(--text-muted)' }}>Log a few entries to see your trends here</Text>
        </GlassCard>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {analytics.map((metric, i) => {
            const color = getMetricColor(metric.metricKey)
            const emoji = getMetricEmoji(metric.metricKey)
            const chartData = (metric.last7Days ?? []).map((d, idx) => ({
              day: DAY_LABELS[idx] ?? `D${idx + 1}`,
              value: typeof d.value === 'boolean' ? (d.value ? 1 : 0) : (d.value ?? 0),
            }))

            const TrendIcon = metric.trend === 'up' ? IconTrendingUp : metric.trend === 'down' ? IconTrendingDown : IconMinus
            const trendColor = metric.trend === 'up' ? 'var(--green)' : metric.trend === 'down' ? 'var(--red)' : 'var(--text-faint)'

            return (
              <GlassCard key={metric.metricKey} p="lg" accentColor={color}
                className={`fade-in fade-in-${(i % 4) + 1}`}>
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <Text size="lg">{emoji}</Text>
                    <Box>
                      <Text size="xs" fw={700} tt="uppercase"
                        style={{ letterSpacing: '0.07em', fontSize: 10, color: 'var(--text-muted)' }}>
                        {metric.displayName}
                      </Text>
                      <Group gap={4} align="center">
                        <TrendIcon size={12} color={trendColor} />
                        <Text size="xs" style={{ color: trendColor }}>
                          {metric.trendPct ? `${metric.trendPct}%` : 'stable'}
                        </Text>
                      </Group>
                    </Box>
                  </Group>
                  <Box style={{ textAlign: 'right' }}>
                    <Text fw={700} size="xl" style={{ letterSpacing: '-0.03em', color }}>
                      {metric.valueType === 'boolean' ? `${metric.daysCompletedThisWeek ?? 0}/7` : metric.sevenDayAvg ?? 0}
                      {metric.unit && metric.valueType !== 'boolean' && (
                        <Text span size="sm" fw={400} ml={2} style={{ color: 'var(--text-muted)' }}>{metric.unit}</Text>
                      )}
                    </Text>
                    <Text size="xs" style={{ color: 'var(--text-muted)' }}>7-day avg</Text>
                  </Box>
                </Group>

                {metric.valueType === 'boolean' ? (
                  <BarChart h={100} data={chartData} dataKey="day" series={[{ name: 'value', color }]}
                    withXAxis withYAxis={false} withTooltip={false}
                    barProps={{ radius: [4, 4, 2, 2] }}
                    styles={{ root: { background: 'transparent' } }} />
                ) : (
                  <AreaChart h={100} data={chartData} dataKey="day" series={[{ name: 'value', color }]}
                    withXAxis withYAxis={false} withTooltip withDots={false}
                    curveType="monotone" fillOpacity={0.12}
                    styles={{ root: { background: 'transparent' } }} />
                )}
              </GlassCard>
            )
          })}
        </SimpleGrid>
      )}
    </Stack>
  )
}

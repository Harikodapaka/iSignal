'use client'

import { useState } from 'react'
import { Box, Group, SegmentedControl, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core'
import { AreaChart, BarChart } from '@mantine/charts'
import { IconTrendingUp, IconTrendingDown, IconMinus } from '@tabler/icons-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAnalytics, type AnalyticsRange } from '@/hooks/useAnalytics'
import { getMetricColor, getMetricEmoji } from '@/lib/parser'

// Build x-axis labels from dates depending on range
function buildChartData(
  lastNDays: { date: string; value: number | boolean | null }[],
  range: AnalyticsRange,
  isBoolean: boolean
) {
  return lastNDays.map((d, idx) => {
    let label: string
    if (range === '7d') {
      // Mon Tue Wed …
      label = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
    } else if (range === '30d') {
      // Show label every 5 days
      label = idx % 5 === 0
        ? new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : ''
    } else {
      // 3mo — label every 2 weeks
      label = idx % 14 === 0
        ? new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : ''
    }
    return {
      day: label,
      // Always store full readable date for tooltip — day label is often '' for 30d/3mo
      date: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: isBoolean ? (d.value ? 1 : 0) : (d.value ?? null),
    }
  })
}

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  '7d': '7-day avg',
  '30d': '30-day avg',
  '3mo': '90-day avg',
}

export default function TrendsPage() {
  const [range, setRange] = useState<AnalyticsRange>('7d')
  const { analytics, loading } = useAnalytics(undefined, range)

  return (
    <Stack gap="xl">
      <PageHeader
        title="Trends"
        subtitle="Your patterns over time"
        actions={
          <SegmentedControl
            data={['7d', '30d', '3mo']}
            value={range}
            onChange={v => setRange(v as AnalyticsRange)}
            styles={{ root: { background: 'var(--card-bg)', border: '1px solid var(--card-border)' } }}
          />
        }
      />

      {loading ? (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} height={220} radius="xl" />)}
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
            const days = metric.lastNDays ?? metric.last7Days ?? []
            const chartData = buildChartData(days, range, metric.valueType === 'boolean')

            const TrendIcon = metric.trend === 'up' ? IconTrendingUp : metric.trend === 'down' ? IconTrendingDown : IconMinus
            const trendColor = metric.trend === 'up' ? 'var(--green)' : metric.trend === 'down' ? 'var(--red)' : 'var(--text-faint)'

            // For boolean: show X/N days completed; for number: show avg
            const statValue = metric.valueType === 'boolean'
              ? `${metric.daysCompletedThisWeek ?? 0}/${metric.rangeDays ?? 7}`
              : (metric.rangeAvg ?? metric.sevenDayAvg ?? 0)

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
                      {statValue}
                      {metric.unit && metric.valueType !== 'boolean' && (
                        <Text span size="sm" fw={400} ml={2} style={{ color: 'var(--text-muted)' }}>{metric.unit}</Text>
                      )}
                    </Text>
                    <Text size="xs" style={{ color: 'var(--text-muted)' }}>{RANGE_LABELS[range]}</Text>
                  </Box>
                </Group>

                {metric.valueType === 'boolean' ? (
                  <BarChart h={100} data={chartData} dataKey="day" series={[{ name: 'value', color }]}
                    withXAxis withYAxis={false} withTooltip={false}
                    barProps={{ radius: [4, 4, 2, 2] }}
                    styles={{ root: { background: 'transparent' } }} />
                ) : (
                  <AreaChart h={120} data={chartData} dataKey="day" series={[{ name: 'value', color }]}
                    withXAxis withYAxis
                    yAxisProps={{ width: 36, tick: { fontSize: 10, fill: 'var(--text-muted)' } }}
                    withTooltip withDots
                    dotProps={{ r: 3, strokeWidth: 2 }}
                    curveType="monotone" fillOpacity={0.12}
                    connectNulls
                    tooltipProps={{ labelFormatter: (_: string, payload: { payload?: { date?: string } }[]) => payload?.[0]?.payload?.date ?? '' }}
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
'use client'

import { useState } from 'react'
import { Box, Button, Group, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconBulb, IconLink, IconChartLine, IconAlertTriangle } from '@tabler/icons-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAnalytics } from '@/hooks/useAnalytics'

interface Correlation {
  metricA: string; metricB: string; direction: string; strength: string; insight: string
}
interface WeeklySummary {
  headline: string; highlights: string[]; oneThingToImprove: string; encouragement: string
}

const STRENGTH_COLOR: Record<string, string> = {
  strong: 'var(--green)', moderate: 'var(--orange)', weak: 'var(--text-muted)',
}

export default function InsightsPage() {
  const { analytics } = useAnalytics()
  const [correlations, setCorrelations] = useState<Correlation[]>([])
  const [summary, setSummary] = useState<WeeklySummary | null>(null)
  const [loadingCorr, setLoadingCorr] = useState(false)
  const [loadingSum, setLoadingSum] = useState(false)

  const runCorrelations = async () => {
    setLoadingCorr(true)
    try {
      const events = analytics.flatMap(a =>
        (a.last7Days ?? [])
          .filter(d => d.value !== null && typeof d.value === 'number')
          .map(d => ({ metricKey: a.metricKey, value: d.value as number, date: d.date }))
      )
      if (events.length < 20) {
        setCorrelations([{ metricA: '—', metricB: '—', direction: 'none', strength: 'weak', insight: 'Need more data — keep logging for a few weeks to see correlations.' }])
        return
      }
      const res  = await fetch('/api/analytics/correlations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events }) })
      const data = await res.json()
      if (data.success) setCorrelations(data.data ?? [])
    } finally { setLoadingCorr(false) }
  }

  const runSummary = async () => {
    setLoadingSum(true)
    try {
      const res  = await fetch('/api/analytics/summary', { method: 'POST' })
      const data = await res.json()
      if (data.success) setSummary(data.data)
    } finally { setLoadingSum(false) }
  }

  return (
    <Stack gap="xl">
      <PageHeader title="AI Insights" subtitle="Powered by Gemini Flash · Free tier" />

      {/* Correlations */}
      <GlassCard p="xl" className="fade-in fade-in-1">
        <Group justify="space-between" mb="lg">
          <Group gap="sm">
            <ThemeIcon size={36} radius="xl" style={{ background: 'var(--green-tint)' }}>
              <IconLink size={18} color="var(--green)" />
            </ThemeIcon>
            <Box>
              <Text fw={700} size="md" style={{ color: 'var(--text-primary)' }}>Correlations</Text>
              <Text size="xs" style={{ color: 'var(--text-muted)' }}>Patterns across your metrics</Text>
            </Box>
          </Group>
          <Button size="sm" radius="xl" color="green" variant="light" loading={loadingCorr}
            leftSection={<IconChartLine size={14} />} onClick={runCorrelations}>
            Analyze
          </Button>
        </Group>

        {correlations.length === 0 ? (
          <Text size="sm" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
            Click Analyze to find patterns in your data
          </Text>
        ) : (
          <Stack gap="sm">
            {correlations.map((c, i) => (
              <Group key={i} p="md" style={{ background: 'var(--orange-tint)', borderRadius: 12, border: '1px solid var(--card-border)' }}>
                <IconLink size={16} color="var(--green)" style={{ flexShrink: 0 }} />
                <Box style={{ flex: 1 }}>
                  <Group gap="xs">
                    <Text size="sm" fw={600} style={{ color: 'var(--text-primary)' }}>{c.metricA} → {c.metricB}</Text>
                    <Text size="xs" style={{ color: STRENGTH_COLOR[c.strength] ?? 'var(--text-muted)' }}>{c.strength}</Text>
                  </Group>
                  <Text size="sm" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{c.insight}</Text>
                </Box>
              </Group>
            ))}
          </Stack>
        )}
      </GlassCard>

      {/* Weekly Summary */}
      <GlassCard p="xl" className="fade-in fade-in-2">
        <Group justify="space-between" mb="lg">
          <Group gap="sm">
            <ThemeIcon size={36} radius="xl" style={{ background: 'var(--purple-tint)' }}>
              <IconBulb size={18} color="var(--purple)" />
            </ThemeIcon>
            <Box>
              <Text fw={700} size="md" style={{ color: 'var(--text-primary)' }}>Weekly Summary</Text>
              <Text size="xs" style={{ color: 'var(--text-muted)' }}>AI-generated recap of your week</Text>
            </Box>
          </Group>
          <Button size="sm" radius="xl" color="violet" variant="light" loading={loadingSum}
            leftSection={<IconBulb size={14} />} onClick={runSummary}>
            Generate
          </Button>
        </Group>

        {!summary ? (
          <Text size="sm" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
            Click Generate for your weekly AI summary
          </Text>
        ) : (
          <Stack gap="md">
            <Text fw={700} size="lg" style={{ letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              {summary.headline}
            </Text>
            <Stack gap={6}>
              {summary.highlights.map((h, i) => (
                <Group key={i} gap="xs">
                  <Text style={{ color: 'var(--green)' }}>✓</Text>
                  <Text size="sm" style={{ color: 'var(--text-secondary)' }}>{h}</Text>
                </Group>
              ))}
            </Stack>
            <Group p="md" style={{ background: 'var(--orange-tint)', borderRadius: 12, border: '1px solid var(--card-border)' }}>
              <IconAlertTriangle size={16} color="var(--orange)" style={{ flexShrink: 0 }} />
              <Text size="sm" style={{ color: 'var(--text-secondary)' }}>{summary.oneThingToImprove}</Text>
            </Group>
            <Text size="sm" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{summary.encouragement}</Text>
          </Stack>
        )}
      </GlassCard>
    </Stack>
  )
}

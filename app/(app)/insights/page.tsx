'use client';

import { useState } from 'react';
import { Box, Button, Group, SegmentedControl, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconBulb, IconLink, IconChartLine, IconAlertTriangle } from '@tabler/icons-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAnalytics, type AnalyticsRange } from '@/hooks/useAnalytics';

interface Correlation {
  metricA: string;
  metricB: string;
  direction: string;
  strength: string;
  insight: string;
}
interface WeeklySummary {
  headline: string;
  highlights: string[];
  oneThingToImprove: string;
  encouragement: string;
}

const STRENGTH_COLOR: Record<string, string> = {
  strong: 'var(--green)',
  moderate: 'var(--orange)',
  weak: 'var(--text-muted)',
};

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '3mo': '3 months',
};

const MIN_EVENTS: Record<AnalyticsRange, number> = {
  '7d': 20,
  '30d': 40,
  '3mo': 80,
};

export default function InsightsPage() {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const { analytics } = useAnalytics(undefined, range);
  const [correlations, setCorrelations] = useState<Correlation[]>([]);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loadingCorr, setLoadingCorr] = useState(false);
  const [loadingSum, setLoadingSum] = useState(false);

  const runCorrelations = async () => {
    setLoadingCorr(true);
    try {
      const events = analytics.flatMap((a) =>
        (a.lastNDays ?? a.last7Days ?? [])
          .filter((d) => d.value !== null && typeof d.value === 'number')
          .map((d) => ({ metricKey: a.metricKey, value: d.value as number, date: d.date }))
      );
      if (events.length < MIN_EVENTS[range]) {
        setCorrelations([
          {
            metricA: '—',
            metricB: '—',
            direction: 'none',
            strength: 'weak',
            insight: `Need more data for ${RANGE_LABELS[range]} — keep logging consistently to see correlations.`,
          },
        ]);
        return;
      }
      const res = await fetch('/api/analytics/correlations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
      const data = await res.json();
      if (data.success) setCorrelations(data.data ?? []);
      else
        setCorrelations([
          {
            metricA: '—',
            metricB: '—',
            direction: 'none',
            strength: 'weak',
            insight: data.error ?? 'Analysis failed.',
          },
        ]);
    } finally {
      setLoadingCorr(false);
    }
  };

  const runSummary = async () => {
    setLoadingSum(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch('/api/analytics/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tz }),
      });
      const data = await res.json();
      if (data.success) setSummary(data.data);
    } finally {
      setLoadingSum(false);
    }
  };

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <PageHeader title="AI Insights" subtitle="Powered by Groq · llama-3.1-8b" />
        <SegmentedControl
          size="xs"
          radius="xl"
          value={range}
          onChange={(v) => {
            setRange(v as AnalyticsRange);
            setCorrelations([]);
          }}
          data={[
            { label: '7d', value: '7d' },
            { label: '30d', value: '30d' },
            { label: '3mo', value: '3mo' },
          ]}
          style={{ flexShrink: 0 }}
        />
      </Group>

      {/* Correlations */}
      <GlassCard p="xl" className="fade-in fade-in-1">
        <Group justify="space-between" mb="lg">
          <Group gap="sm">
            <ThemeIcon size={36} radius="xl" style={{ background: 'var(--green-tint)' }}>
              <IconLink size={18} color="var(--green)" />
            </ThemeIcon>
            <Box>
              <Text fw={700} size="md" style={{ color: 'var(--text-primary)' }}>
                Correlations
              </Text>
              <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                Patterns across your metrics · {RANGE_LABELS[range]}
              </Text>
            </Box>
          </Group>
          <Button
            size="sm"
            radius="xl"
            color="green"
            variant="light"
            loading={loadingCorr}
            leftSection={<IconChartLine size={14} />}
            onClick={runCorrelations}
          >
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
              <Group
                key={i}
                p="md"
                style={{ background: 'var(--orange-tint)', borderRadius: 12, border: '1px solid var(--card-border)' }}
              >
                <IconLink size={16} color="var(--green)" style={{ flexShrink: 0 }} />
                <Box style={{ flex: 1 }}>
                  <Group gap="xs">
                    <Text size="sm" fw={600} style={{ color: 'var(--text-primary)' }}>
                      {c.metricA} → {c.metricB}
                    </Text>
                    <Text size="xs" style={{ color: STRENGTH_COLOR[c.strength] ?? 'var(--text-muted)' }}>
                      {c.strength}
                    </Text>
                  </Group>
                  <Text size="sm" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                    {c.insight}
                  </Text>
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
              <Text fw={700} size="md" style={{ color: 'var(--text-primary)' }}>
                Weekly Summary
              </Text>
              <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                AI-generated recap of your last 7 days
              </Text>
            </Box>
          </Group>
          <Button
            size="sm"
            radius="xl"
            color="violet"
            variant="light"
            loading={loadingSum}
            leftSection={<IconBulb size={14} />}
            onClick={runSummary}
          >
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
                  <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
                    {h}
                  </Text>
                </Group>
              ))}
            </Stack>
            <Group
              p="md"
              style={{ background: 'var(--orange-tint)', borderRadius: 12, border: '1px solid var(--card-border)' }}
            >
              <IconAlertTriangle size={16} color="var(--orange)" style={{ flexShrink: 0 }} />
              <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
                {summary.oneThingToImprove}
              </Text>
            </Group>
            <Text size="sm" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {summary.encouragement}
            </Text>
          </Stack>
        )}
      </GlassCard>
    </Stack>
  );
}

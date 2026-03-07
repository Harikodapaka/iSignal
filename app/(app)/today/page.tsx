'use client';

import { useCallback } from 'react';
import { Box, Group, SimpleGrid, Skeleton, Stack, Text, Badge } from '@mantine/core';
import { IconFlame } from '@tabler/icons-react';
import { LogInput } from '@/components/log/LogInput';
import { MetricCard } from '@/components/metrics/MetricCard';
import { PendingAliasPrompt } from '@/components/metrics/PendingAliasPrompt';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useEvents } from '@/hooks/useEvents';
import { getBestStreak, getWeeklyScore, getLoggedToday } from '@/utils/stats';
import { getMetricColor, getMetricEmoji, formatValue } from '@/lib/parser';
import { formatTime } from '@/utils/date';

// ── Activity Rings ────────────────────────────────────────────────────────────
// Outer  = Streak      (red)    — days in a row logging anything
// Middle = Weekly Score (green) — 0-100 computed from trends
// Inner  = Consistency (blue)   — % of pinned metrics logged today
function ActivityRings({ streak, score, consistency }: { streak: number; score: number; consistency: number }) {
  const r = [60, 47, 34]; // radii outer → inner
  const colors = ['var(--red)', 'var(--green)', 'var(--blue)'];
  const trackColors = ['var(--red-tint)', 'var(--green-tint)', 'var(--blue-tint)'];
  const values = [Math.min((streak / 30) * 100, 100), score, consistency];
  const labels = [
    { val: streak, unit: 'days', label: 'Streak', color: 'var(--red)' },
    { val: score, unit: '/100', label: 'Score', color: 'var(--green)' },
    {
      val: `${Math.round(consistency)}%`,
      unit: '',
      label: 'Today',
      color: 'var(--blue)',
    },
  ];

  return (
    <Group gap="xl" align="center" style={{ flexWrap: 'wrap' }}>
      {/* SVG rings */}
      <Box
        style={{
          position: 'relative',
          width: 140,
          height: 140,
          flexShrink: 0,
        }}
      >
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
          {r.map((radius, i) => {
            const circ = 2 * Math.PI * radius;
            const pct = Math.max(values[i], 2);
            return (
              <g key={i}>
                <circle cx="70" cy="70" r={radius} fill="none" stroke={trackColors[i]} strokeWidth="10" />
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={colors[i]}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={circ * (1 - pct / 100)}
                  style={{
                    transition: `stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1) ${i * 0.12}s`,
                  }}
                />
              </g>
            );
          })}
        </svg>
        <Box
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            textAlign: 'center',
          }}
        >
          <Text
            fw={800}
            style={{
              fontSize: 22,
              letterSpacing: '-0.04em',
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            {score}
          </Text>
          <Text size="xs" style={{ color: 'var(--text-muted)' }}>
            score
          </Text>
        </Box>
      </Box>

      {/* Legend */}
      <Stack gap={12}>
        {labels.map(({ val, unit, label, color }) => (
          <Group key={label} gap={10} align="center">
            <Box
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
              }}
            />
            <Text
              size="xs"
              style={{
                width: 68,
                color: 'var(--text-secondary)',
              }}
            >
              {label}
            </Text>
            <Text
              fw={700}
              size="md"
              style={{
                color,
                letterSpacing: '-0.02em',
              }}
            >
              {val}
            </Text>
            {unit && (
              <Text
                size="xs"
                style={{
                  color: 'var(--text-muted)',
                }}
              >
                {unit}
              </Text>
            )}
          </Group>
        ))}
      </Stack>
    </Group>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TodayPage() {
  const { analytics, loading: loadingA, refetch: refetchA } = useAnalytics();
  const { events, refetch: refetchE } = useEvents();

  const handleLogged = useCallback(() => {
    refetchA();
    refetchE();
  }, [refetchA, refetchE]);

  const bestStreak = getBestStreak(analytics);
  const weeklyScore = getWeeklyScore(analytics);
  const loggedToday = getLoggedToday(analytics);
  const totalPinned = analytics.length;
  const consistency = totalPinned > 0 ? (loggedToday / totalPinned) * 100 : 0;

  return (
    <Stack gap="xl">
      <PageHeader title="Today" />
      <PendingAliasPrompt />

      {/* Log bar */}
      <Box className="fade-in fade-in-1">
        <LogInput onLogged={handleLogged} />
      </Box>

      {/* Rings + Quick stats */}
      <Group align="flex-start" gap="md" className="fade-in fade-in-2" style={{ flexWrap: 'wrap' }}>
        {/* Rings */}
        <GlassCard p="lg" style={{ flex: '0 0 auto' }}>
          <Text fw={700} size="sm" mb={4} style={{ color: 'var(--text-primary)' }}>
            Daily Rings
          </Text>
          <Text size="xs" mb="md" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
          <ActivityRings streak={bestStreak} score={weeklyScore} consistency={consistency} />
        </GlassCard>

        {/* Stat pills */}
        <SimpleGrid cols={{ base: 2, sm: 2 }} spacing="sm" style={{ flex: 1, minWidth: 200 }}>
          <GlassCard p="md">
            <Text
              size="xs"
              fw={700}
              tt="uppercase"
              style={{
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}
            >
              Best Streak
            </Text>
            <Group gap={6} align="center">
              <IconFlame size={20} color="var(--orange)" />
              <Text
                fw={800}
                style={{
                  fontSize: 26,
                  letterSpacing: '-0.04em',
                  color: 'var(--text-primary)',
                }}
              >
                {bestStreak}
              </Text>
              <Text
                size="xs"
                style={{
                  color: 'var(--text-muted)',
                }}
              >
                days
              </Text>
            </Group>
          </GlassCard>
          <GlassCard p="md">
            <Text
              size="xs"
              fw={700}
              tt="uppercase"
              style={{
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}
            >
              Weekly Score
            </Text>
            <Text
              fw={800}
              style={{
                fontSize: 26,
                letterSpacing: '-0.04em',
                color: 'var(--green)',
              }}
            >
              {weeklyScore}
            </Text>
          </GlassCard>
          <GlassCard p="md">
            <Text
              size="xs"
              fw={700}
              tt="uppercase"
              style={{
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}
            >
              Logged Today
            </Text>
            <Group gap={4} align="baseline">
              <Text
                fw={800}
                style={{
                  fontSize: 26,
                  letterSpacing: '-0.04em',
                  color: 'var(--orange)',
                }}
              >
                {loggedToday}
              </Text>
              <Text
                size="sm"
                style={{
                  color: 'var(--text-muted)',
                }}
              >
                / {totalPinned}
              </Text>
            </Group>
          </GlassCard>
          <GlassCard p="md">
            <Text
              size="xs"
              fw={700}
              tt="uppercase"
              style={{
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}
            >
              Entries
            </Text>
            <Text
              fw={800}
              style={{
                fontSize: 26,
                letterSpacing: '-0.04em',
                color: 'var(--blue)',
              }}
            >
              {events.length}
            </Text>
          </GlassCard>
        </SimpleGrid>
      </Group>

      {/* Pinned metric cards */}
      {loadingA ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={180} radius="xl" />
          ))}
        </SimpleGrid>
      ) : analytics.length > 0 ? (
        <Box className="fade-in fade-in-3">
          <SectionLabel>Pinned Metrics</SectionLabel>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            {analytics.map((a) => (
              <MetricCard key={a.metricKey} analytics={a} />
            ))}
          </SimpleGrid>
        </Box>
      ) : (
        <GlassCard p="xl" style={{ textAlign: 'center' }}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>⚡</Text>
          <Text fw={600} mb={4} style={{ color: 'var(--text-primary)' }}>
            Start logging to see your metrics
          </Text>
          <Text size="sm" style={{ color: 'var(--text-muted)' }}>
            After 3 logs the metric auto-pins to your dashboard
          </Text>
        </GlassCard>
      )}

      {/* Today's log */}
      <Box className="fade-in fade-in-4">
        <SectionLabel>Today's Log</SectionLabel>
        <GlassCard p={0} style={{ overflow: 'hidden' }}>
          {events.length === 0 ? (
            <Box p="xl" style={{ textAlign: 'center' }}>
              <Text
                size="sm"
                style={{
                  color: 'var(--text-muted)',
                }}
              >
                No entries yet — start logging above!
              </Text>
            </Box>
          ) : (
            events.map((event, i) => {
              const color = getMetricColor(event.metricKey);
              const emoji = getMetricEmoji(event.metricKey);
              return (
                <Group
                  key={String(event._id)}
                  justify="space-between"
                  p="md"
                  className="slide-in"
                  style={{
                    borderBottom: i < events.length - 1 ? '1px solid var(--sep)' : 'none',
                    animationDelay: `${i * 0.04}s`,
                  }}
                >
                  <Group gap="sm">
                    <Box
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <Box>
                      <Group gap={6}>
                        <Text size="sm">{emoji}</Text>
                        <Text
                          size="sm"
                          fw={600}
                          style={{
                            color: 'var(--text-primary)',
                          }}
                        >
                          {event.metricKey}
                        </Text>
                        {event.tags?.map((tag) => (
                          <Badge key={tag} size="xs" variant="light" color="gray" radius="sm">
                            {tag}
                          </Badge>
                        ))}
                      </Group>
                      <Text
                        size="xs"
                        ff="monospace"
                        style={{
                          color: 'var(--text-muted)',
                        }}
                      >
                        {event.rawText}
                      </Text>
                    </Box>
                  </Group>
                  <Box
                    style={{
                      textAlign: 'right',
                    }}
                  >
                    <Text
                      size="sm"
                      fw={700}
                      style={{
                        color,
                      }}
                    >
                      {formatValue(event.value, event.unit, event.valueType)}
                    </Text>
                    <Text
                      size="xs"
                      style={{
                        color: 'var(--text-muted)',
                      }}
                    >
                      {formatTime(event.timestamp)}
                    </Text>
                  </Box>
                </Group>
              );
            })
          )}
        </GlassCard>
      </Box>
    </Stack>
  );
}

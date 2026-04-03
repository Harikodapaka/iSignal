'use client';

import Link from 'next/link';
import { Box, Button, Code, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import {
  IconAt,
  IconBolt,
  IconBulb,
  IconChartLine,
  IconCheck,
  IconHome,
  IconLayoutGrid,
  IconList,
  IconPin,
  IconSparkles,
} from '@tabler/icons-react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';

function Section({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 16,
        padding: 24,
      }}
    >
      <Group gap="sm" mb="md">
        <ThemeIcon size={36} radius="xl" style={{ background: `${color}20` }}>
          {icon}
        </ThemeIcon>
        <Title order={3} style={{ fontSize: 17, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          {title}
        </Title>
      </Group>
      {children}
    </Box>
  );
}

function Row({ label, desc }: { label: React.ReactNode; desc: string }) {
  return (
    <Group gap="sm" align="flex-start" wrap="nowrap" py={6} style={{ borderBottom: '1px solid var(--card-border)' }}>
      <Box style={{ minWidth: 0, flex: '0 0 auto' }}>{label}</Box>
      <Text size="sm" style={{ color: 'var(--text-secondary)', flex: 1 }}>
        {desc}
      </Text>
    </Group>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <Group gap="xs" align="flex-start" wrap="nowrap">
      <IconCheck size={13} color="var(--green)" style={{ marginTop: 3, flexShrink: 0 }} />
      <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </Text>
    </Group>
  );
}

export default function PublicHelpPage() {
  const { data: session } = useSession();
  const isLoggedIn = !!session;

  return (
    <Box style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      {/* Top bar */}
      <Box
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          borderBottom: '1px solid var(--sidebar-border)',
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(24px)',
          padding: '12px 24px',
        }}
      >
        <Group justify="space-between" style={{ maxWidth: 760, margin: '0 auto' }}>
          <Group gap="sm">
            <Image src="/logo.png" alt="iSignal" width={32} height={32} />
            <Text fw={700} style={{ letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
              iSignal
            </Text>
          </Group>
          {isLoggedIn ? (
            <Button
              component={Link}
              href="/today"
              radius="xl"
              size="sm"
              variant="light"
              style={{ background: 'var(--orange-tint)', color: 'var(--orange)' }}
            >
              Back to app
            </Button>
          ) : (
            <Button
              component={Link}
              href="/login"
              radius="xl"
              size="sm"
              style={{ background: 'var(--orange)', color: 'white' }}
            >
              Sign in
            </Button>
          )}
        </Group>
      </Box>

      {/* Content */}
      <Box style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px' }}>
        <Stack gap="xl">
          {/* Hero */}
          <Stack gap="xs" align="center" style={{ textAlign: 'center', paddingBottom: 16 }}>
            <Title
              order={1}
              style={{
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: '-0.04em',
                color: 'var(--text-primary)',
              }}
            >
              How iSignal works
            </Title>
            <Text size="md" style={{ maxWidth: 480, color: 'var(--text-muted)' }}>
              Track anything with plain language. iSignal learns your vocabulary and turns your logs into insights.
            </Text>
          </Stack>

          {/* Logging basics */}
          <Section icon={<IconBolt size={18} color="var(--orange)" />} title="Logging" color="var(--orange)">
            <Text size="sm" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
              Type anything into the log bar and press Enter. iSignal understands natural language.
            </Text>
            <Stack gap={0}>
              <Row label={<Code>I drank 1.5L water</Code>} desc="Natural sentence — AI extracts the metric" />
              <Row label={<Code>sleep 7.5</Code>} desc="Logs 7.5 hours of sleep" />
              <Row label={<Code>workout</Code>} desc="Logs a boolean workout (done / not done)" />
              <Row label={<Code>mood 8</Code>} desc="Logs mood score of 8" />
              <Row label={<Code>protein 142g</Code>} desc="Logs 142g protein — unit parsed automatically" />
              <Row
                label={<Code style={{ whiteSpace: 'nowrap' }}>felt great after meditation</Code>}
                desc="AI resolves to 'meditation' and extracts positive sentiment"
              />
            </Stack>
            <Text size="xs" style={{ color: 'var(--text-muted)', marginTop: 10 }}>
              Known metrics (sleep, mood, workout…) are resolved instantly. Unknown phrases are sent to AI in the
              background — you&apos;ll see a pending toast while it resolves.
            </Text>
          </Section>

          {/* @ syntax */}
          <Section
            icon={<IconAt size={18} color="var(--purple)" />}
            title="@ syntax — create metrics explicitly"
            color="var(--purple)"
          >
            <Text size="sm" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
              Prefix your log with <Code>@metric-key</Code> to skip AI entirely and create exactly the metric you want.
            </Text>
            <Stack gap={0}>
              <Row label={<Code>@meditation</Code>} desc="Creates / logs 'meditation' as a boolean (done)" />
              <Row label={<Code>@mood 7</Code>} desc="Creates / logs 'mood' as a number, value 7" />
              <Row label={<Code>@water:L 1.5</Code>} desc="Creates 'water' with unit L, value 1.5" />
              <Row label={<Code>@pushups 30</Code>} desc="Creates 'pushups' as a number, value 30" />
            </Stack>
          </Section>

          {/* Metrics */}
          <Section icon={<IconPin size={18} color="var(--green)" />} title="Metrics & pinning" color="var(--green)">
            <Stack gap="xs">
              <Bullet>Every unique thing you log becomes a metric automatically.</Bullet>
              <Bullet>
                After logging a metric <strong>3 or more times</strong>, it gets auto-pinned to your Today dashboard.
              </Bullet>
              <Bullet>Unpin a metric from the Metrics page — it won&apos;t be re-pinned automatically.</Bullet>
              <Bullet>
                You can rename a metric, change its unit, or change how daily duplicates are aggregated (sum / average /
                last).
              </Bullet>
            </Stack>
          </Section>

          {/* Alias suggestions */}
          <Section
            icon={<IconSparkles size={18} color="var(--orange)" />}
            title="Alias suggestions"
            color="var(--orange)"
          >
            <Stack gap="xs">
              <Bullet>
                If you log something similar to an existing metric (e.g. &quot;gym&quot; vs &quot;workout&quot;), AI
                suggests merging them.
              </Bullet>
              <Bullet>
                A card appears on the Today page: <strong>Yes, always</strong> merges all past and future events into
                one metric. <strong>No, keep it</strong> keeps them separate forever.
              </Bullet>
              <Bullet>
                Confirming an alias retroactively updates all past events and re-calculates your analytics.
              </Bullet>
            </Stack>
          </Section>

          {/* Pages */}
          <Box
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 16,
              padding: 24,
            }}
          >
            <Title
              order={3}
              style={{ fontSize: 17, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 16 }}
            >
              Pages
            </Title>
            <Stack gap="sm">
              {[
                {
                  Icon: IconHome,
                  color: 'var(--orange)',
                  label: 'Today',
                  desc: 'Log entries, see pinned metric cards with sparklines and 30-day averages, track your daily streak and weekly score.',
                },
                {
                  Icon: IconChartLine,
                  color: 'var(--blue)',
                  label: 'Trends',
                  desc: 'Full chart for each metric over 7 days / 30 days / 3 months.',
                },
                {
                  Icon: IconLayoutGrid,
                  color: 'var(--purple)',
                  label: 'Metrics',
                  desc: 'All your metrics. Pin / unpin, edit display name, unit, and aggregation.',
                },
                {
                  Icon: IconBulb,
                  color: 'var(--green)',
                  label: 'Insights',
                  desc: 'AI-generated correlation analysis and period summary.',
                },
                {
                  Icon: IconList,
                  color: 'var(--text-secondary)',
                  label: 'Logs',
                  desc: 'Browse every logged event. Filter by date range and metric. Edit or delete entries.',
                },
              ].map(({ Icon, color, label, desc }) => (
                <Group key={label} gap="sm" align="flex-start" wrap="nowrap">
                  <ThemeIcon size={30} radius="md" style={{ background: `${color}20`, flexShrink: 0, marginTop: 2 }}>
                    <Icon size={15} color={color} />
                  </ThemeIcon>
                  <Box>
                    <Text size="sm" fw={600} style={{ color: 'var(--text-primary)' }}>
                      {label}
                    </Text>
                    <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
                      {desc}
                    </Text>
                  </Box>
                </Group>
              ))}
            </Stack>
          </Box>

          {/* CTA — only shown when not logged in */}
          {!isLoggedIn && (
            <Stack align="center" gap="md" pt="md">
              <Text size="sm" style={{ color: 'var(--text-muted)' }}>
                Free forever. No credit card required.
              </Text>
              <Button
                component={Link}
                href="/login"
                radius="xl"
                size="lg"
                style={{ background: 'var(--orange)', color: 'white', paddingInline: 40 }}
              >
                Get started with Google
              </Button>
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

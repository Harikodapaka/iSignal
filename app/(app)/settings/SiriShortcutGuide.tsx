'use client';

import { Box, Code, Group, Stack, Text } from '@mantine/core';
import { GlassCard } from '@/components/ui/GlassCard';

const SHORTCUT_STEPS = [
  {
    title: 'Speak Text',
    description: (
      <>
        Type: <Code style={{ fontSize: 11 }}>What do you want to log?</Code>
      </>
    ),
  },
  {
    title: 'Dictate Text',
    description: 'Siri listens for your voice input after the prompt',
  },
  {
    title: 'URL',
    description: 'Paste your webhook URL from step 1',
  },
  {
    title: 'Get Contents of URL',
    lines: [
      <>
        Method: <strong>POST</strong> · Body: <strong>JSON</strong>
      </>,
      <>
        Add key <Code style={{ fontSize: 11 }}>text</Code> with value <strong>Dictated Text</strong> (select from magic
        variables)
      </>,
    ],
  },
  {
    title: 'Get Dictionary Value',
    description: (
      <>
        Get value for key <Code style={{ fontSize: 11 }}>message</Code> from <strong>Contents of URL</strong>
      </>
    ),
  },
  {
    title: 'If',
    lines: [
      <>
        Input: <Code style={{ fontSize: 11 }}>Dictionary Value</Code> · Condition: <strong>has any value</strong>
      </>,
      <>
        → <strong>Speak Text:</strong> <Code style={{ fontSize: 11 }}>Done</Code>
      </>,
      <>
        <strong>Otherwise</strong> → <strong>Speak Text:</strong>{' '}
        <Code style={{ fontSize: 11 }}>Something went wrong</Code>
      </>,
    ],
  },
];

const EXAMPLE_PHRASES = ['sleep 7.5 hours', 'mood 8', 'weight 72 kg', 'water 2 litres', 'ran 5k in 25 min'];

function StepBadge({ number, highlight }: { number: number; highlight?: boolean }) {
  return (
    <Box
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: highlight ? 'var(--orange)' : 'var(--text-muted)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {number}
    </Box>
  );
}

export function SiriShortcutGuide() {
  return (
    <GlassCard>
      <Stack gap="md">
        <Text size="sm" fw={600} style={{ color: 'var(--text-primary)' }}>
          Set up voice logging with Siri
        </Text>

        {/* Step 1 */}
        <Box
          p="sm"
          style={{
            background: 'var(--orange-tint)',
            borderRadius: 10,
            border: '1px solid var(--orange)',
          }}
        >
          <Group gap="xs" mb={6}>
            <StepBadge number={1} highlight />
            <Text size="xs" fw={700} style={{ color: 'var(--orange)' }}>
              Create your webhook URL
            </Text>
          </Group>
          <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
            Use the form above to create a webhook URL and <strong>copy it</strong>. You&apos;ll paste this into the
            Shortcut.
          </Text>
        </Box>

        {/* Step 2 */}
        <Box
          p="sm"
          style={{
            background: 'var(--card-bg)',
            borderRadius: 10,
            border: '1px solid var(--sidebar-border)',
          }}
        >
          <Group gap="xs" mb={6}>
            <StepBadge number={2} />
            <Text size="xs" fw={700} style={{ color: 'var(--text-primary)' }}>
              Create the Siri Shortcut
            </Text>
          </Group>
          <Text size="xs" mb={8} style={{ color: 'var(--text-secondary)' }}>
            Open the <strong>Shortcuts</strong> app on your iPhone and add these actions in order:
          </Text>
          <Stack gap={6}>
            {SHORTCUT_STEPS.map((step, i) => (
              <Group key={i} gap="xs" align="flex-start">
                <Code style={{ fontSize: 11, minWidth: 18, textAlign: 'center' }}>{i + 1}</Code>
                <Box style={{ flex: 1 }}>
                  <Text size="xs" fw={600} style={{ color: 'var(--text-primary)' }}>
                    {step.title}
                  </Text>
                  {step.description && (
                    <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                      {step.description}
                    </Text>
                  )}
                  {step.lines?.map((line, j) => (
                    <Text key={j} size="xs" style={{ color: 'var(--text-muted)' }}>
                      {line}
                    </Text>
                  ))}
                </Box>
              </Group>
            ))}
          </Stack>
        </Box>

        {/* Step 3 */}
        <Box
          p="sm"
          style={{
            background: 'var(--card-bg)',
            borderRadius: 10,
            border: '1px solid var(--sidebar-border)',
          }}
        >
          <Group gap="xs" mb={6}>
            <StepBadge number={3} />
            <Text size="xs" fw={700} style={{ color: 'var(--text-primary)' }}>
              Name it &amp; test
            </Text>
          </Group>
          <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
            Name the shortcut <strong>&quot;Log to iSignal&quot;</strong>, then say:
          </Text>
          <Box
            mt={6}
            p="xs"
            style={{
              background: 'var(--orange-tint)',
              borderRadius: 8,
              textAlign: 'center',
            }}
          >
            <Text size="sm" fw={600} style={{ color: 'var(--orange)' }}>
              &quot;Hey Siri, Log to iSignal&quot;
            </Text>
          </Box>
          <Text size="xs" mt={6} style={{ color: 'var(--text-muted)' }}>
            Siri will ask what to log, listen, post to iSignal, and announce &quot;Done&quot; or &quot;Something went
            wrong.&quot;
          </Text>
        </Box>

        {/* Example phrases */}
        <Box>
          <Text size="xs" fw={600} mb={4} style={{ color: 'var(--text-primary)' }}>
            Example voice entries
          </Text>
          <Group gap={6} wrap="wrap">
            {EXAMPLE_PHRASES.map((phrase) => (
              <Code
                key={phrase}
                style={{
                  fontSize: 11,
                  background: 'var(--card-bg)',
                  border: '1px solid var(--sidebar-border)',
                  borderRadius: 6,
                  padding: '3px 8px',
                }}
              >
                {phrase}
              </Code>
            ))}
          </Group>
        </Box>
      </Stack>
    </GlassCard>
  );
}

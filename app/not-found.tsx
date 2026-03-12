'use client';

import { Box, Button, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Stack align="center" gap="lg" style={{ maxWidth: 360, textAlign: 'center' }}>
        <Image src="/logo.png" alt="iSignal" width={72} height={72} style={{ opacity: 0.5 }} />
        <Stack gap="xs" align="center">
          <Text
            style={{
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              color: 'var(--orange)',
              lineHeight: 1,
            }}
          >
            404
          </Text>
          <Title order={3} style={{ letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Page not found
          </Title>
          <Text c="dimmed" size="sm">
            This route doesn&apos;t exist. Let&apos;s get you back on track.
          </Text>
        </Stack>
        <Button
          component={Link}
          href="/today"
          radius="xl"
          size="md"
          style={{ background: 'var(--orange)', color: 'white' }}
        >
          Go to Today
        </Button>
      </Stack>
    </Box>
  );
}

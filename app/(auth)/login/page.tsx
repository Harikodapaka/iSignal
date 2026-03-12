import { auth, signIn } from '@/auth';
import { Box, Button, Card, Stack, Text, Title } from '@mantine/core';
import { IconBinoculars, IconBrandGoogle } from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect('/today');

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
      <Card
        p="xl"
        radius="xl"
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'rgba(28,28,30,0.85)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Stack align="center" gap="md">
          {/* Logo */}
          <Stack align="center" gap="xs">
            <Image src="/logo.png" alt="iSignal" width={80} height={80} />
            <Title
              order={2}
              style={{
                letterSpacing: '-0.04em',
                color: 'white',
              }}
            >
              iSignal
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              Track anything. Understand everything.
            </Text>
          </Stack>

          {/* Features */}
          <Stack gap="xs" w="100%">
            {[
              '⚡ Log in seconds — no forms, just type',
              '🧠 AI learns your vocabulary over time',
              '📊 Automatic trends and streaks',
              '🔒 Your data, always private',
            ].map((f) => (
              <Text
                key={f}
                size="sm"
                c="dimmed"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {f}
              </Text>
            ))}
          </Stack>

          {/* Sign in */}
          <form
            action={async () => {
              'use server';
              await signIn('google', {
                redirectTo: '/today',
              });
            }}
            style={{ width: '100%' }}
          >
            <Button
              type="submit"
              fullWidth
              size="lg"
              radius="xl"
              leftSection={<IconBrandGoogle size={20} />}
              style={{
                background: 'white',
                color: '#1a1a1a',
                fontWeight: 600,
              }}
            >
              Continue with Google
            </Button>
          </form>

          <Text size="xs" c="dimmed" ta="center">
            Free forever. No credit card required.
          </Text>

          <Text size="xs" c="dimmed" ta="center">
            <Link
              href="/help"
              style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'underline', display: 'flex', gap: '4px' }}
            >
              <IconBinoculars size={18} color="var(--mantine-color-gray-filled)" aria-hidden="true" /> Learn how it
              works
            </Link>
          </Text>
        </Stack>
      </Card>
    </Box>
  );
}

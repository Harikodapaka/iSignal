'use client';

import { useState } from 'react';
import { Box, Button, Group, Stack, Switch, Text } from '@mantine/core';
import { IconBell, IconSparkles } from '@tabler/icons-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function PushNotificationsCard() {
  const push = usePushNotifications();
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const sendTestNotification = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTestResult(`✅ Sent to ${data.sent}/${data.total} device(s)`);
      } else {
        setTestResult(`❌ ${data.error || 'Failed to send'}`);
      }
    } catch {
      setTestResult('❌ Network error');
    } finally {
      setTestSending(false);
    }
  };

  return (
    <GlassCard>
      <Stack gap="md">
        <Group gap="xs" align="center">
          <IconBell size={20} style={{ color: 'var(--orange)' }} />
          <Text fw={600} size="sm" style={{ color: 'var(--text-primary)' }}>
            Daily Reminders
          </Text>
        </Group>

        {!push.isSupported ? (
          <Text size="xs" style={{ color: 'var(--text-muted)' }}>
            Push notifications are not supported in this browser. Try installing the app (Add to Home Screen) for full
            notification support.
          </Text>
        ) : (
          <>
            <Group justify="space-between" align="center">
              <Box style={{ flex: 1 }}>
                <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
                  Get friendly reminders to log your metrics throughout the day.
                </Text>
              </Box>
              <Switch
                checked={push.isSubscribed}
                onChange={() => (push.isSubscribed ? push.unsubscribe() : push.subscribe())}
                disabled={push.loading || push.permission === 'denied'}
                size="md"
                color="orange"
              />
            </Group>

            {push.permission === 'denied' && (
              <Text size="xs" style={{ color: 'var(--red, #e03131)' }}>
                Notifications are blocked. Please enable them in your browser settings and reload this page.
              </Text>
            )}

            {push.isSubscribed && (
              <>
                <Box
                  p="sm"
                  style={{
                    background: 'var(--card-bg)',
                    borderRadius: 8,
                    border: '1px solid var(--sidebar-border)',
                  }}
                >
                  <Stack gap={4}>
                    <Text size="xs" fw={600} style={{ color: 'var(--text-primary)' }}>
                      You&apos;ll receive:
                    </Text>
                    <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                      ☀️ <strong>6 AM</strong> — Good morning + sleep reminder
                    </Text>
                    <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                      💧 <strong>12 PM</strong> — Midday check-in for unlogged metrics
                    </Text>
                    <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                      🌙 <strong>7 PM</strong> — Evening wrap-up with missing metrics
                    </Text>
                  </Stack>
                </Box>
                {/* Smart Reminders toggle */}
                <Box
                  p="sm"
                  style={{
                    background: 'var(--card-bg)',
                    borderRadius: 8,
                    border: '1px solid var(--sidebar-border)',
                  }}
                >
                  <Group justify="space-between" align="center">
                    <Group gap="xs" align="center">
                      <IconSparkles size={16} style={{ color: 'var(--orange)' }} />
                      <Box>
                        <Text size="xs" fw={600} style={{ color: 'var(--text-primary)' }}>
                          Smart Reminders
                        </Text>
                        <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                          Auto-remind based on your logging patterns
                        </Text>
                      </Box>
                    </Group>
                    <Switch
                      checked={push.smartReminders}
                      onChange={() => push.toggleSmartReminders(!push.smartReminders)}
                      size="sm"
                      color="orange"
                    />
                  </Group>
                </Box>

                <Group gap="xs" align="center">
                  <Button size="xs" variant="light" color="orange" onClick={sendTestNotification} loading={testSending}>
                    Send Test Notification
                  </Button>
                  {testResult && (
                    <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                      {testResult}
                    </Text>
                  )}
                </Group>
              </>
            )}
          </>
        )}
      </Stack>
    </GlassCard>
  );
}

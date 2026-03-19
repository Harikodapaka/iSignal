'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  CopyButton,
  ActionIcon,
  Group,
  Stack,
  Text,
  TextInput,
  Code,
  Tooltip,
  Switch,
} from '@mantine/core';
import { IconCopy, IconCheck, IconTrash, IconPlus, IconMicrophone, IconBell } from '@tabler/icons-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface VoiceToken {
  _id: string;
  token: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function SettingsPage() {
  const [tokens, setTokens] = useState<VoiceToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
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

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/voice-tokens');
      const json = await res.json();
      if (json.success) setTokens(json.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const createToken = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/voice-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName || 'Default' }),
      });
      const json = await res.json();
      if (json.success) {
        setJustCreated(json.data.token);
        setNewName('');
        fetchTokens();
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (id: string) => {
    try {
      await fetch(`/api/voice-tokens?id=${id}`, { method: 'DELETE' });
      setTokens((prev) => prev.filter((t) => t._id !== id));
    } catch {
      // ignore
    }
  };

  const getWebhookUrl = (token: string) => `${baseUrl}/api/v/${token}/log`;

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage voice logging and integrations" />

      <Stack gap="xl" mt="lg">
        <SectionLabel>Voice Logging (Siri / Shortcuts)</SectionLabel>

        <GlassCard>
          <Stack gap="md">
            <Group gap="xs" align="center">
              <IconMicrophone size={20} style={{ color: 'var(--orange)' }} />
              <Text fw={600} size="sm" style={{ color: 'var(--text-primary)' }}>
                Webhook URLs
              </Text>
            </Group>
            <Text size="xs" style={{ color: 'var(--text-muted)' }}>
              Create a webhook URL to log metrics from Siri Shortcuts, iOS Shortcuts, or any HTTP client. Each URL is a
              secret — treat it like a password.
            </Text>

            {/* Create new token */}
            <Group gap="xs">
              <TextInput
                placeholder="Label (e.g. iPhone)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                size="xs"
                style={{ flex: 1 }}
              />
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={createToken}
                loading={creating}
                disabled={tokens.length >= 5}
                style={{
                  background: 'var(--orange)',
                  color: '#fff',
                }}
              >
                Create
              </Button>
            </Group>

            {/* Just-created token */}
            {justCreated && (
              <Box
                p="sm"
                style={{
                  background: 'var(--green-tint)',
                  borderRadius: 8,
                  border: '1px solid var(--green)',
                }}
              >
                <Text size="xs" fw={600} mb={4} style={{ color: 'var(--green)' }}>
                  Webhook URL created! Copy it now — it won&apos;t be shown again.
                </Text>
                <Group gap="xs">
                  <Code
                    style={{
                      flex: 1,
                      fontSize: 11,
                      wordBreak: 'break-all',
                      background: 'var(--card-bg)',
                    }}
                  >
                    {getWebhookUrl(justCreated)}
                  </Code>
                  <CopyButton value={getWebhookUrl(justCreated)}>
                    {({ copied, copy }) => (
                      <ActionIcon size="sm" variant="subtle" onClick={copy} color={copied ? 'green' : 'gray'}>
                        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      </ActionIcon>
                    )}
                  </CopyButton>
                </Group>
                <Button
                  size="xs"
                  variant="subtle"
                  mt="xs"
                  onClick={() => setJustCreated(null)}
                  style={{ color: 'var(--text-muted)' }}
                >
                  Dismiss
                </Button>
              </Box>
            )}

            {/* Existing tokens */}
            {loading ? (
              <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                Loading...
              </Text>
            ) : tokens.length === 0 ? (
              <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                No webhook URLs yet. Create one to start logging via Siri.
              </Text>
            ) : (
              <Stack gap="xs">
                {tokens.map((t) => (
                  <Group
                    key={t._id}
                    gap="xs"
                    p="xs"
                    style={{
                      background: 'var(--card-bg)',
                      borderRadius: 8,
                      border: '1px solid var(--sidebar-border)',
                    }}
                  >
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="xs" fw={600} style={{ color: 'var(--text-primary)' }}>
                        {t.name}
                      </Text>
                      <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                        Created {new Date(t.createdAt).toLocaleDateString()}
                        {t.lastUsedAt && ` · Last used ${new Date(t.lastUsedAt).toLocaleDateString()}`}
                      </Text>
                    </Box>
                    <CopyButton value={getWebhookUrl(t.token)}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied!' : 'Copy URL'}>
                          <ActionIcon size="sm" variant="subtle" onClick={copy} color={copied ? 'green' : 'gray'}>
                            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                    <Tooltip label="Revoke">
                      <ActionIcon size="sm" variant="subtle" color="red" onClick={() => revokeToken(t._id)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ))}
              </Stack>
            )}
          </Stack>
        </GlassCard>

        {/* Push Notifications */}
        <SectionLabel>Push Notifications</SectionLabel>
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
                Push notifications are not supported in this browser. Try installing the app (Add to Home Screen) for
                full notification support.
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
                    <Group gap="xs" align="center">
                      <Button
                        size="xs"
                        variant="light"
                        color="orange"
                        onClick={sendTestNotification}
                        loading={testSending}
                      >
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

        {/* Siri Shortcut instructions */}
        <SectionLabel>Siri Shortcut Setup</SectionLabel>
        <GlassCard>
          <Stack gap="md">
            <Text size="sm" fw={600} style={{ color: 'var(--text-primary)' }}>
              Set up voice logging with Siri in 3 steps
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
                <Box
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--orange)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  1
                </Box>
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
                <Box
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--text-muted)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  2
                </Box>
                <Text size="xs" fw={700} style={{ color: 'var(--text-primary)' }}>
                  Create the Siri Shortcut
                </Text>
              </Group>
              <Text size="xs" mb={8} style={{ color: 'var(--text-secondary)' }}>
                Open the <strong>Shortcuts</strong> app on your iPhone and add these actions in order:
              </Text>
              <Stack gap={6}>
                <Group gap="xs" align="flex-start">
                  <Code style={{ fontSize: 11, minWidth: 18, textAlign: 'center' }}>1</Code>
                  <Box style={{ flex: 1 }}>
                    <Text size="xs" fw={600} style={{ color: 'var(--text-primary)' }}>
                      Dictate Text
                    </Text>
                    <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                      Captures your voice input when triggered
                    </Text>
                  </Box>
                </Group>
                <Group gap="xs" align="flex-start">
                  <Code style={{ fontSize: 11, minWidth: 18, textAlign: 'center' }}>2</Code>
                  <Box style={{ flex: 1 }}>
                    <Text size="xs" fw={600} style={{ color: 'var(--text-primary)' }}>
                      URL
                    </Text>
                    <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                      Paste your webhook URL from step 1
                    </Text>
                  </Box>
                </Group>
                <Group gap="xs" align="flex-start">
                  <Code style={{ fontSize: 11, minWidth: 18, textAlign: 'center' }}>3</Code>
                  <Box style={{ flex: 1 }}>
                    <Text size="xs" fw={600} style={{ color: 'var(--text-primary)' }}>
                      Get Contents of URL
                    </Text>
                    <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                      Method: <strong>POST</strong> · Body: <strong>JSON</strong>
                    </Text>
                    <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                      Add key <Code style={{ fontSize: 11 }}>text</Code> with value <strong>Dictated Text</strong>{' '}
                      (select from magic variables)
                    </Text>
                  </Box>
                </Group>
                <Group gap="xs" align="flex-start">
                  <Code style={{ fontSize: 11, minWidth: 18, textAlign: 'center' }}>4</Code>
                  <Box style={{ flex: 1 }}>
                    <Text size="xs" fw={600} style={{ color: 'var(--text-primary)' }}>
                      Speak Text
                    </Text>
                    <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                      Pass <Code style={{ fontSize: 11 }}>Contents of URL</Code> — Siri will read the confirmation aloud
                    </Text>
                  </Box>
                </Group>
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
                <Box
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--text-muted)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  3
                </Box>
                <Text size="xs" fw={700} style={{ color: 'var(--text-primary)' }}>
                  Name it &amp; test
                </Text>
              </Group>
              <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
                Name the shortcut (e.g. <strong>&quot;Log iSignal&quot;</strong>), then say:
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
                  &quot;Hey Siri, Log iSignal&quot;
                </Text>
              </Box>
              <Text size="xs" mt={6} style={{ color: 'var(--text-muted)' }}>
                Siri will listen, log your entry, and speak the confirmation (e.g. &quot;Logged 7.5 hours of
                sleep&quot;).
              </Text>
            </Box>

            {/* Example phrases */}
            <Box>
              <Text size="xs" fw={600} mb={4} style={{ color: 'var(--text-primary)' }}>
                Example voice entries
              </Text>
              <Group gap={6} wrap="wrap">
                {['sleep 7.5 hours', 'mood 8', 'weight 72 kg', 'water 2 litres', 'ran 5k in 25 min'].map((phrase) => (
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
      </Stack>
    </>
  );
}

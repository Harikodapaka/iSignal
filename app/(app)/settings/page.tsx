'use client';

import { useCallback, useEffect, useState } from 'react';
import { Box, Button, CopyButton, ActionIcon, Group, Stack, Text, TextInput, Code, Tooltip } from '@mantine/core';
import { IconCopy, IconCheck, IconTrash, IconPlus, IconMicrophone } from '@tabler/icons-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionLabel } from '@/components/ui/SectionLabel';

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

        {/* Siri Shortcut instructions */}
        <SectionLabel>Siri Shortcut Setup</SectionLabel>
        <GlassCard>
          <Stack gap="sm">
            <Text size="sm" fw={600} style={{ color: 'var(--text-primary)' }}>
              How to set up voice logging with Siri
            </Text>
            <Stack gap={4}>
              <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
                1. Create a webhook URL above and copy it
              </Text>
              <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
                2. Open the <strong>Shortcuts</strong> app on your iPhone
              </Text>
              <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
                3. Create a new shortcut with these actions:
              </Text>
              <Box
                ml="md"
                p="sm"
                style={{
                  background: 'var(--card-bg)',
                  borderRadius: 8,
                  border: '1px solid var(--sidebar-border)',
                }}
              >
                <Stack gap={2}>
                  <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
                    a. <strong>Dictate Text</strong> — captures your voice
                  </Text>
                  <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
                    b. <strong>URL</strong> — paste your webhook URL
                  </Text>
                  <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
                    c. <strong>Get Contents of URL</strong>:
                  </Text>
                  <Text size="xs" ml="md" style={{ color: 'var(--text-secondary)' }}>
                    Method: <strong>POST</strong>
                  </Text>
                  <Text size="xs" ml="md" style={{ color: 'var(--text-secondary)' }}>
                    Request Body: <strong>JSON</strong>
                  </Text>
                  <Text size="xs" ml="md" style={{ color: 'var(--text-secondary)' }}>
                    Key: <Code style={{ fontSize: 11 }}>text</Code> Value: <strong>Dictated Text</strong>
                  </Text>
                  <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
                    d. <strong>Get Dictionary Value</strong> for key <Code style={{ fontSize: 11 }}>message</Code>
                  </Text>
                  <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
                    e. <strong>Show Result</strong> (or <strong>Speak Text</strong>)
                  </Text>
                </Stack>
              </Box>
              <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
                4. Name the shortcut (e.g. &quot;Log iSignal&quot;)
              </Text>
              <Text size="xs" style={{ color: 'var(--text-secondary)' }}>
                5. Say &quot;Hey Siri, Log iSignal&quot; and dictate your entry
              </Text>
            </Stack>
          </Stack>
        </GlassCard>
      </Stack>
    </>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Box, Button, CopyButton, ActionIcon, Group, Stack, Text, TextInput, Code, Tooltip } from '@mantine/core';
import { IconCopy, IconCheck, IconTrash, IconPlus, IconMicrophone } from '@tabler/icons-react';
import { GlassCard } from '@/components/ui/GlassCard';

interface VoiceToken {
  _id: string;
  token: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function WebhookUrlsCard() {
  const [tokens, setTokens] = useState<VoiceToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const getWebhookUrl = (token: string) => `${baseUrl}/api/v/${token}/log`;

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

  return (
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
            style={{ background: 'var(--orange)', color: '#fff' }}
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
  );
}

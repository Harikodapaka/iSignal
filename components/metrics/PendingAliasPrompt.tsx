'use client'

import { useEffect, useState } from 'react'
import { Badge, Box, Button, Group, Stack, Text } from '@mantine/core'
import { IconSparkles } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

interface PendingAlias { _id: string; rawKey: string; suggestedKey: string; confidence: number }

export function PendingAliasPrompt() {
  const [pending, setPending] = useState<PendingAlias[]>([])

  useEffect(() => {
    fetch('/api/aliases').then(r => r.json()).then(d => d.success && setPending(d.data ?? [])).catch(() => {})
  }, [])

  const respond = async (id: string, action: 'confirm' | 'reject') => {
    try {
      await fetch('/api/aliases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pendingId: id, action }) })
      setPending(prev => prev.filter(p => p._id !== id))
      notifications.show({ message: action === 'confirm' ? 'Alias confirmed ✓' : 'Kept as separate metric', color: action === 'confirm' ? 'green' : 'gray', autoClose: 2000 })
    } catch {
      notifications.show({ message: 'Failed to update alias', color: 'red', autoClose: 2000 })
    }
  }

  if (!pending.length) return null

  return (
    <Stack gap="sm">
      {pending.map(p => (
        <Box key={p._id} p="md" style={{
          background: 'var(--blue-tint)', border: '1px solid var(--blue)',
          borderRadius: 16, borderLeft: `3px solid var(--blue)`,
        }}>
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
              <IconSparkles size={16} color="var(--blue)" style={{ flexShrink: 0 }} />
              <Text size="sm" style={{ color: 'var(--text-primary)' }}>
                <Text span fw={700} style={{ color: 'var(--blue)' }}>"{p.rawKey}"</Text>
                {' → did you mean '}
                <Text span fw={700} style={{ color: 'var(--text-primary)' }}>"{p.suggestedKey}"</Text>?
              </Text>
              <Badge size="xs" variant="outline" color="blue">{Math.round(p.confidence * 100)}% sure</Badge>
            </Group>
            <Group gap="xs" style={{ flexShrink: 0 }}>
              <Button size="xs" radius="xl" color="blue" onClick={() => respond(p._id, 'confirm')}>Yes, always</Button>
              <Button size="xs" radius="xl" variant="subtle" color="gray" onClick={() => respond(p._id, 'reject')}>No, keep it</Button>
            </Group>
          </Group>
        </Box>
      ))}
    </Stack>
  )
}

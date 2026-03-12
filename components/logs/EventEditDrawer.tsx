'use client';

import { useState, useEffect } from 'react';
import { Badge, Box, Button, Code, Divider, Drawer, Group, NumberInput, Switch, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { IEvent } from '@/types';

interface Props {
  event: IEvent | null;
  opened: boolean;
  onClose: () => void;
  onSaved: (updated: IEvent) => void;
}

export function EventEditDrawer({ event, opened, onClose, onSaved }: Props) {
  const [numValue, setNumValue] = useState<number | string>('');
  const [boolValue, setBoolValue] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (event) {
      if (event.valueType === 'number') setNumValue(event.value as number);
      else if (event.valueType === 'boolean') setBoolValue(event.value as boolean);
    }
  }, [event]);

  const handleSave = async () => {
    if (!event) return;
    const value = event.valueType === 'boolean' ? boolValue : Number(numValue);
    setSaving(true);
    try {
      const res = await fetch('/api/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: event._id, value }),
      });
      const data = await res.json();
      if (data.success) {
        notifications.show({ message: 'Entry updated', color: 'green', autoClose: 2000 });
        onSaved(data.data);
        onClose();
      } else {
        notifications.show({ message: data.error ?? 'Failed to save', color: 'red', autoClose: 3000 });
      }
    } catch {
      notifications.show({ message: 'Network error', color: 'red', autoClose: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const inputStyles = {
    label: {
      color: 'var(--text-muted)',
      fontSize: 12,
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.07em',
    },
    input: { background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' },
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={700} style={{ color: 'var(--text-primary)' }}>
            Edit entry
          </Text>
          {event && (
            <Badge variant="light" color="gray" size="sm" radius="sm">
              {event.metricKey}
            </Badge>
          )}
        </Group>
      }
      position="right"
      size="sm"
      styles={{
        content: { background: 'var(--card-bg)', borderLeft: '1px solid var(--card-border)' },
        header: { background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' },
      }}
    >
      {event && (
        <Box pt="md">
          <Text
            size="xs"
            fw={600}
            tt="uppercase"
            style={{ letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 4 }}
          >
            Original log
          </Text>
          <Code
            block
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-secondary)',
              fontSize: 13,
            }}
          >
            {event.rawText}
          </Code>
          <Text size="xs" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            {event.date}
          </Text>

          <Divider my="lg" style={{ borderColor: 'var(--card-border)' }} />

          {event.valueType === 'number' && (
            <NumberInput
              label={`Value${event.unit ? ` (${event.unit})` : ''}`}
              value={numValue}
              onChange={setNumValue}
              styles={inputStyles}
            />
          )}

          {event.valueType === 'boolean' && (
            <Group justify="space-between" align="center">
              <Text size="sm" style={{ color: 'var(--text-primary)' }}>
                Completed
              </Text>
              <Switch checked={boolValue} onChange={(e) => setBoolValue(e.currentTarget.checked)} />
            </Group>
          )}

          {event.valueType === 'text' && (
            <Text size="sm" style={{ color: 'var(--text-muted)' }}>
              Text entries cannot be edited.
            </Text>
          )}

          <Divider my="lg" style={{ borderColor: 'var(--card-border)' }} />

          <Group>
            <Button
              variant="default"
              onClick={onClose}
              style={{
                flex: 1,
                background: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-primary)',
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={event.valueType === 'text'}
              style={{ flex: 1, background: 'var(--orange)', color: '#fff' }}
            >
              Save
            </Button>
          </Group>
        </Box>
      )}
    </Drawer>
  );
}

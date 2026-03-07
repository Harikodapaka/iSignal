'use client';

import { useState, useEffect } from 'react';
import {
  Drawer,
  Stack,
  TextInput,
  Group,
  Button,
  Text,
  Box,
  SegmentedControl,
  Divider,
  Badge,
  Radio,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { IMetric } from '@/types';

interface Props {
  metric: IMetric | null;
  opened: boolean;
  onClose: () => void;
  onSaved: (updated: IMetric) => void;
}

const AGG_DATA = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'last', label: 'Last entry' },
];

const AGG_DESCRIPTIONS: Record<string, string> = {
  sum: 'Multiple logs same day add up  (e.g. 1L + 1L + 1L = 3L)',
  avg: 'Multiple logs same day average (e.g. mood 7 + 5 = 6)',
  last: 'Only the last log counts       (e.g. weight — correction replaces)',
};

export function MetricEditDrawer({ metric, opened, onClose, onSaved }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [unit, setUnit] = useState('');
  const [aggregation, setAggregation] = useState<'sum' | 'avg' | 'last'>('avg');
  const [valueType, setValueType] = useState<'number' | 'boolean' | 'text'>('number');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (metric) {
      setDisplayName(metric.displayName);
      setUnit(metric.unit ?? '');
      setAggregation((metric.aggregation ?? 'avg') as 'sum' | 'avg' | 'last');
      setValueType((metric.valueType ?? 'number') as 'number' | 'boolean' | 'text');
    }
  }, [metric]);

  const handleSave = async () => {
    if (!metric) return;
    setSaving(true);
    try {
      const res = await fetch('/api/metrics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricKey: metric.metricKey,
          displayName: displayName.trim(),
          unit: unit.trim() || null,
          aggregation,
          valueType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notifications.show({
          message: 'Metric updated',
          color: 'green',
          autoClose: 2000,
        });
        onSaved(data.data);
        onClose();
      } else {
        notifications.show({
          message: data.error ?? 'Failed to save',
          color: 'red',
          autoClose: 3000,
        });
      }
    } catch {
      notifications.show({
        message: 'Network error',
        color: 'red',
        autoClose: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    metric &&
    (displayName !== metric.displayName ||
      (unit || '') !== (metric.unit ?? '') ||
      aggregation !== (metric.aggregation ?? 'avg') ||
      valueType !== metric.valueType);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={700} style={{ color: 'var(--text-primary)' }}>
            Edit metric
          </Text>
          {metric && (
            <Badge variant="light" color="gray" size="sm" radius="sm">
              {metric.metricKey}
            </Badge>
          )}
        </Group>
      }
      position="right"
      size="sm"
      styles={{
        content: {
          background: 'var(--card-bg)',
          borderLeft: '1px solid var(--card-border)',
        },
        header: {
          background: 'var(--card-bg)',
          borderBottom: '1px solid var(--card-border)',
        },
      }}
    >
      {metric && (
        <Stack gap="lg" pt="md">
          <TextInput
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.currentTarget.value)}
            styles={{
              label: {
                color: 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              },
              input: {
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                color: 'var(--text-primary)',
              },
            }}
          />

          <Box>
            <Text
              size="xs"
              fw={600}
              tt="uppercase"
              mb={6}
              style={{
                letterSpacing: '0.07em',
                color: 'var(--text-muted)',
              }}
            >
              Value type
            </Text>
            <SegmentedControl
              fullWidth
              value={valueType}
              onChange={(v) => setValueType(v as typeof valueType)}
              data={[
                {
                  value: 'number',
                  label: 'Number',
                },
                {
                  value: 'boolean',
                  label: 'Done / not done',
                },
              ]}
              styles={{
                root: {
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                },
              }}
            />
          </Box>

          {valueType === 'number' && (
            <TextInput
              label="Unit"
              placeholder="e.g. h, min, kg, L, /10"
              value={unit}
              onChange={(e) => setUnit(e.currentTarget.value)}
              description="Leave blank if unitless"
              styles={{
                label: {
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                },
                description: {
                  color: 'var(--text-muted)',
                },
                input: {
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-primary)',
                },
              }}
            />
          )}

          {valueType === 'number' && (
            <Box>
              <Text
                size="xs"
                fw={600}
                tt="uppercase"
                mb={6}
                style={{
                  letterSpacing: '0.07em',
                  color: 'var(--text-muted)',
                }}
              >
                When logged multiple times in a day
              </Text>
              <Radio.Group value={aggregation} onChange={(v) => setAggregation(v as typeof aggregation)}>
                <Stack gap="xs">
                  {AGG_DATA.map((opt) => (
                    <Radio.Card
                      key={opt.value}
                      value={opt.value}
                      radius="md"
                      p="sm"
                      styles={{
                        card: {
                          background: 'var(--card-bg)',
                          borderColor: 'var(--card-border)',
                          '&[dataChecked]': {
                            borderColor: 'var(--orange)',
                            background: 'var(--orange-tint)',
                          },
                        },
                      }}
                    >
                      <Group wrap="nowrap" align="flex-start">
                        <Radio.Indicator mt={2} />
                        <Box>
                          <Text
                            size="sm"
                            fw={600}
                            style={{
                              color: 'var(--text-primary)',
                            }}
                          >
                            {opt.label}
                          </Text>
                          <Text
                            size="xs"
                            style={{
                              color: 'var(--text-muted)',
                              marginTop: 2,
                            }}
                          >
                            {AGG_DESCRIPTIONS[opt.value]}
                          </Text>
                        </Box>
                      </Group>
                    </Radio.Card>
                  ))}
                </Stack>
              </Radio.Group>
            </Box>
          )}

          <Divider
            style={{
              borderColor: 'var(--card-border)',
            }}
          />

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
              disabled={!hasChanges}
              style={{
                flex: 1,
                background: 'var(--orange)',
                color: '#fff',
              }}
            >
              Save
            </Button>
          </Group>
        </Stack>
      )}
    </Drawer>
  );
}

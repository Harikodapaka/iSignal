'use client';

import { useState, useMemo } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  MultiSelect,
  Pagination,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { DatePickerInput, type DatesRangeValue } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPencil, IconTrash, IconX } from '@tabler/icons-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { EventEditDrawer } from '@/components/logs/EventEditDrawer';
import { useLogEvents } from '@/hooks/useLogEvents';
import { useMetrics } from '@/hooks/useMetrics';
import { getMetricColor, getMetricEmoji, formatValue } from '@/lib/parser';
import { formatTime } from '@/utils/date';
import type { IEvent } from '@/types';

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return toDateStr(d);
}

export default function LogsPage() {
  const today = toDateStr(new Date());
  const [dateRange, setDateRange] = useState<DatesRangeValue>([new Date(defaultStart()), new Date(today)]);
  // Committed range only updates when both dates are selected — avoids spurious fetches
  const [committedRange, setCommittedRange] = useState({ start: defaultStart(), end: today });
  const [metricKeys, setMetricKeys] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const minDate = new Date(new Date().getFullYear() - 3, 0, 1); // Jan 1, 3 years ago
  const maxDate = new Date(); // today — no future dates

  const { metrics } = useMetrics();
  const metricOptions = useMemo(
    () => metrics.map((m) => ({ value: m.metricKey, label: m.displayName || m.metricKey })),
    [metrics]
  );

  const filters = useMemo(
    () => ({
      startDate: committedRange.start,
      endDate: committedRange.end,
      metricKeys,
      page,
    }),
    [committedRange, metricKeys, page]
  );

  const { data, loading, refetch } = useLogEvents(filters);

  // Edit state
  const [editEvent, setEditEvent] = useState<IEvent | null>(null);
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<IEvent | null>(null);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const [deleting, setDeleting] = useState(false);

  const handleEditClick = (event: IEvent) => {
    setEditEvent(event);
    openEdit();
  };

  const handleDeleteClick = (event: IEvent) => {
    setDeleteTarget(event);
    openDelete();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/events?id=${deleteTarget._id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        notifications.show({ message: 'Entry deleted', color: 'green', autoClose: 2000 });
        closeDelete();
        refetch();
      } else {
        notifications.show({ message: json.error ?? 'Failed', color: 'red', autoClose: 3000 });
      }
    } catch {
      notifications.show({ message: 'Network error', color: 'red', autoClose: 3000 });
    } finally {
      setDeleting(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSaved = (_updated: IEvent) => {
    refetch();
  };

  const clearFilters = () => {
    const start = defaultStart();
    setDateRange([new Date(start), new Date(today)] as DatesRangeValue);
    setCommittedRange({ start, end: today });
    setMetricKeys([]);
    setPage(1);
  };

  const hasFilters = metricKeys.length > 0;
  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  const inputStyles = {
    input: {
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      color: 'var(--text-primary)',
    },
    label: { color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 as const },
  };

  return (
    <Stack gap="xl">
      <PageHeader
        title="Logs"
        subtitle={data ? `${data.total} entr${data.total === 1 ? 'y' : 'ies'}` : 'All logged events'}
      />

      {/* Filters */}
      <GlassCard p="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <DatePickerInput
            type="range"
            label="Date range"
            value={dateRange}
            onChange={(val: DatesRangeValue) => {
              setDateRange(val);
              // Only trigger a fetch once both dates are picked (val can be Date or string)
              if (val[0] && val[1]) {
                const toStr = (v: Date | string) => (v instanceof Date ? toDateStr(v) : String(v).slice(0, 10));
                setCommittedRange({ start: toStr(val[0]), end: toStr(val[1]) });
                setPage(1);
              }
            }}
            minDate={minDate}
            maxDate={maxDate}
            valueFormat="MMM D"
            size="sm"
            styles={inputStyles}
            style={{ flex: 1, minWidth: 180 }}
            popoverProps={{ withinPortal: true }}
          />
          <MultiSelect
            label="Metrics"
            placeholder={metricKeys.length === 0 ? 'All metrics' : undefined}
            data={metricOptions}
            value={metricKeys}
            onChange={(v) => {
              setMetricKeys(v);
              setPage(1);
            }}
            searchable
            clearable
            size="sm"
            styles={inputStyles}
            style={{ flex: 1, minWidth: 160 }}
            maxDropdownHeight={220}
          />
          {hasFilters && (
            <Button variant="subtle" color="gray" size="sm" leftSection={<IconX size={13} />} onClick={clearFilters}>
              Clear
            </Button>
          )}
        </Group>
      </GlassCard>

      {/* Event list */}
      <Box>
        <SectionLabel>Events</SectionLabel>
        <GlassCard p={0}>
          {loading ? (
            <Stack gap={0} p="md">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} height={52} radius="md" mb="xs" />
              ))}
            </Stack>
          ) : !data || data.events.length === 0 ? (
            <Text size="sm" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 16px' }}>
              No entries found for this range.
            </Text>
          ) : (
            <Stack gap={0}>
              {data.events.map((event, i) => {
                const color = getMetricColor(event.metricKey);
                const emoji = getMetricEmoji(event.metricKey);
                const isLast = i === data.events.length - 1;
                return (
                  <Group
                    key={String(event._id)}
                    justify="space-between"
                    px="md"
                    py="sm"
                    wrap="nowrap"
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid var(--card-border)',
                    }}
                  >
                    <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                      <Box
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: color,
                          flexShrink: 0,
                        }}
                      />
                      <Text style={{ fontSize: 16, flexShrink: 0 }}>{emoji}</Text>
                      <Box style={{ minWidth: 0 }}>
                        <Group gap="xs" wrap="nowrap">
                          <Text size="sm" fw={600} truncate style={{ color: 'var(--text-primary)' }}>
                            {event.metricKey}
                          </Text>
                          <Badge size="xs" variant="light" color="gray" radius="sm" style={{ flexShrink: 0 }}>
                            {event.date}
                          </Badge>
                        </Group>
                        <Text size="xs" truncate style={{ color: 'var(--text-muted)' }}>
                          {event.rawText}
                        </Text>
                      </Box>
                    </Group>

                    <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                      <Box style={{ textAlign: 'right' }}>
                        <Text size="sm" fw={700} style={{ color }}>
                          {formatValue(event.value, event.unit, event.valueType)}
                        </Text>
                        <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                          {formatTime(event.timestamp)}
                        </Text>
                      </Box>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="gray"
                        onClick={() => handleEditClick(event)}
                        aria-label="Edit"
                      >
                        <IconPencil size={14} />
                      </ActionIcon>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => handleDeleteClick(event)}
                        aria-label="Delete"
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>
                );
              })}
            </Stack>
          )}
        </GlassCard>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination total={totalPages} value={page} onChange={setPage} size="sm" radius="xl" />
          </Group>
        )}
      </Box>

      {/* Edit drawer */}
      <EventEditDrawer event={editEvent} opened={editOpened} onClose={closeEdit} onSaved={handleSaved} />

      {/* Delete confirmation */}
      <Modal
        opened={deleteOpened}
        onClose={closeDelete}
        title={
          <Text fw={700} style={{ color: 'var(--text-primary)' }}>
            Delete entry?
          </Text>
        }
        centered
        size="sm"
        styles={{
          content: { background: 'var(--card-bg)', border: '1px solid var(--card-border)' },
          header: { background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' },
        }}
      >
        <Stack gap="md">
          {deleteTarget && (
            <Text size="sm" style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.rawText}</strong>
              <br />
              <span style={{ color: 'var(--text-muted)' }}>{deleteTarget.date}</span>
            </Text>
          )}
          <Text size="xs" style={{ color: 'var(--text-muted)' }}>
            This will remove the entry and recalculate analytics. This cannot be undone.
          </Text>
          <Group>
            <Button
              variant="default"
              onClick={closeDelete}
              style={{
                flex: 1,
                background: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-primary)',
              }}
            >
              Cancel
            </Button>
            <Button color="red" loading={deleting} onClick={handleDeleteConfirm} style={{ flex: 1 }}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

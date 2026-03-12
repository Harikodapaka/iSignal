'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Box, ActionIcon, Loader, Group, Text, Badge, Stack, Tooltip, UnstyledButton } from '@mantine/core';
import { IconBolt, IconArrowUp, IconQuestionMark } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { KNOWN_METRICS, parseLogInput, parseAtSyntax, getMetricDisplayName } from '@/lib/parser';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { IMetric } from '@/types';

interface DropdownPos {
  top: number;
  left: number;
  width: number;
}

// Unified suggestion shape for both KNOWN_METRICS and user metrics
interface Suggestion {
  key: string;
  displayName: string;
  emoji: string;
  type: string;
  unit?: string;
  color: string;
}

function toSuggestion(m: (typeof KNOWN_METRICS)[number]): Suggestion {
  return { key: m.key, displayName: m.displayName, emoji: m.emoji, type: m.type, unit: m.unit, color: m.color };
}

export function LogInput({ onLogged }: { onLogged?: () => void }) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dropPos, setDropPos] = useState<DropdownPos | null>(null);
  const [mounted, setMounted] = useState(false);
  const [userMetrics, setUserMetrics] = useState<IMetric[]>([]);

  const online = useOnlineStatus();

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Portal only works client-side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user metrics once on mount for autocomplete + parser hints
  useEffect(() => {
    fetch('/api/metrics')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setUserMetrics(d.data ?? []);
      })
      .catch(() => {});
  }, []);

  // Recalculate dropdown position whenever open state changes or on scroll/resize
  useEffect(() => {
    if (!open || !wrapRef.current) {
      setDropPos(null);
      return;
    }
    const recalc = () => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    };
    recalc();
    window.addEventListener('scroll', recalc, { passive: true });
    window.addEventListener('resize', recalc, { passive: true });
    return () => {
      window.removeEventListener('scroll', recalc);
      window.removeEventListener('resize', recalc);
    };
  }, [open]);

  const updateSuggestions = useCallback(
    (input: string) => {
      // @ syntax — user is explicitly specifying the metric, no autocomplete needed
      if (input.trimStart().startsWith('@')) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      const parts = input.trim().split(/\s+/);
      const key = parts[0].toLowerCase();
      if (!input.trim() || parts.length > 1) {
        setSuggestions([]);
        setOpen(false);
        return;
      }

      // Known metrics that start with the typed key
      const knownHits = KNOWN_METRICS.filter((m) => m.key.startsWith(key) && m.key !== key).map(toSuggestion);

      // User-created metrics that start with the typed key (not already in knownHits)
      const knownKeys = new Set(KNOWN_METRICS.map((m) => m.key));
      const userHits: Suggestion[] = userMetrics
        .filter((m) => m.metricKey.startsWith(key) && m.metricKey !== key && !knownKeys.has(m.metricKey))
        .map((m) => ({
          key: m.metricKey,
          displayName: m.displayName,
          emoji: '📊',
          type: m.valueType,
          unit: m.unit ?? undefined,
          color: '#636366',
        }));

      const hits = [...knownHits, ...userHits].slice(0, 6);
      setSuggestions(hits);
      setOpen(hits.length > 0);
    },
    [userMetrics]
  );

  const handleChange = (val: string) => {
    setValue(val);
    updateSuggestions(val);
  };

  const selectSuggestion = (key: string) => {
    setValue(key + ' ');
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const pollForResolution = (eventId: string, notifId: string) => {
    const delays = [2000, 3000, 5000]; // poll at 2s, 5s, 10s
    let attempt = 0;
    const poll = async () => {
      try {
        const res = await fetch(`/api/events?id=${eventId}`);
        const data = await res.json();
        const key = data.data?.metricKey;
        if (key && key !== '__unknown__') {
          notifications.update({
            id: notifId,
            message: `✓  ${getMetricDisplayName(key)} logged`,
            color: 'green',
            autoClose: 2000,
            loading: false,
            styles: { root: { background: 'var(--card-bg)', border: '1px solid var(--green)' } },
          });
          fetch('/api/metrics')
            .then((r) => r.json())
            .then((d) => {
              if (d.success) setUserMetrics(d.data ?? []);
            })
            .catch(() => {});
          return;
        }
      } catch {
        /* ignore */
      }
      if (attempt < delays.length) {
        attempt++;
        setTimeout(poll, delays[attempt - 1]);
      } else {
        // Gave up — close the pending toast
        notifications.update({
          id: notifId,
          message: '✓  Entry logged',
          color: 'green',
          autoClose: 2000,
          loading: false,
          styles: { root: { background: 'var(--card-bg)', border: '1px solid var(--green)' } },
        });
      }
    };
    setTimeout(poll, delays[0]);
  };

  const handleSubmit = async () => {
    if (!value.trim() || loading) return;
    setLoading(true);
    setOpen(false);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: value.trim(), tz }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const userKeys = userMetrics.map((m) => m.metricKey);
      const atParsed = parseAtSyntax(value.trim());
      const parsed = atParsed ?? parseLogInput(value.trim(), userKeys);
      const notifId = `log-${Date.now()}`;

      if (!parsed && data.data?.id) {
        // AI is resolving async — show pending toast then update it
        notifications.show({
          id: notifId,
          message: '⏳  Figuring out what to log…',
          color: 'gray',
          autoClose: false,
          loading: true,
          styles: { root: { background: 'var(--card-bg)', border: '1px solid var(--card-border)' } },
        });
        pollForResolution(data.data.id, notifId);
      } else {
        const label = parsed?.metricKey ? getMetricDisplayName(parsed.metricKey) : 'Entry';
        notifications.show({
          id: notifId,
          message: `✓  ${label} logged`,
          color: 'green',
          autoClose: 2000,
          styles: { root: { background: 'var(--card-bg)', border: '1px solid var(--green)' } },
        });
      }

      setValue('');
      // Refresh user metrics so new metrics appear in autocomplete immediately
      fetch('/api/metrics')
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setUserMetrics(d.data ?? []);
        })
        .catch(() => {});
      onLogged?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to log';
      const friendly = msg === 'Could not parse input' ? 'Nothing to log — try being more specific' : msg;
      notifications.show({
        message: friendly,
        color: 'red',
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const dropdown =
    open && suggestions.length > 0 && dropPos && mounted
      ? createPortal(
          <div
            style={{
              position: 'fixed',
              top: dropPos.top,
              left: dropPos.left,
              width: dropPos.width,
              zIndex: 9999,
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
            }}
          >
            <Stack gap={0}>
              {suggestions.map((m, i) => (
                <UnstyledButton
                  key={m.key}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(m.key);
                  }}
                  style={{
                    padding: '11px 16px',
                    borderBottom: i < suggestions.length - 1 ? '1px solid var(--sep)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Group justify="space-between">
                    <Group gap="xs">
                      <Text size="sm">{m.emoji}</Text>
                      <Text size="sm" fw={500} style={{ color: 'var(--text-primary)' }}>
                        {m.key}
                      </Text>
                    </Group>
                    <Group gap={6}>
                      <Badge size="xs" variant="light" color="gray" radius="sm">
                        {m.type}
                      </Badge>
                      {m.unit && (
                        <Badge size="xs" variant="outline" color="orange" radius="sm">
                          {m.unit}
                        </Badge>
                      )}
                    </Group>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          </div>,
          document.body
        )
      : null;

  return (
    <Box ref={wrapRef} style={{ position: 'relative', zIndex: 10 }}>
      <Group gap="xs" align="center" wrap="nowrap">
        <Box
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--input-bg)',
            border: `1.5px solid ${focused ? 'var(--orange)' : 'var(--input-border)'}`,
            borderRadius: 24,
            padding: '6px 6px 6px 18px',
            boxShadow: focused ? '0 0 0 4px var(--orange-glow)' : 'var(--card-shadow)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
        >
          <IconBolt size={16} color="var(--orange)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={value}
            disabled={!online}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') setOpen(false);
            }}
            onFocus={() => {
              setFocused(true);
              if (value) updateSuggestions(value);
            }}
            onBlur={() => {
              setFocused(false);
              setTimeout(() => setOpen(false), 150);
            }}
            placeholder={online ? 'sleep 7.5  ·  mood 8  ·  @new-metric:L 1' : 'Offline — logging unavailable'}
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: online ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 15,
              fontFamily: 'inherit',
              caretColor: 'var(--orange)',
              padding: '8px 0',
              cursor: online ? 'text' : 'not-allowed',
            }}
          />
          <Text
            size="xs"
            className="hide-mobile"
            style={{ whiteSpace: 'nowrap', paddingRight: 4, color: 'var(--text-muted)' }}
          >
            ↵ to log
          </Text>
          <ActionIcon
            size={36}
            radius="xl"
            variant="filled"
            onClick={handleSubmit}
            disabled={!value.trim() || loading || !online}
            style={{
              background: value.trim() ? 'var(--orange)' : 'var(--sep2)',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            {loading ? <Loader size={14} color="white" /> : <IconArrowUp size={18} />}
          </ActionIcon>
        </Box>
        <Tooltip label="How to log" position="top" withArrow>
          <ActionIcon
            component={Link}
            href="/help"
            size={40}
            radius="xl"
            variant="subtle"
            color="gray"
            aria-label="Help"
            style={{
              background: 'var(--input-bg)',
              border: '1.5px solid var(--input-border)',
              flexShrink: 0,
            }}
          >
            <IconQuestionMark size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {dropdown}
    </Box>
  );
}

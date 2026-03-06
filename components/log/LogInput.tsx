'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Box, ActionIcon, Loader, Group, Text, Badge, Stack, UnstyledButton } from '@mantine/core'
import { IconBolt, IconArrowUp } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { KNOWN_METRICS, parseLogInput, getMetricDisplayName } from '@/lib/parser'

interface DropdownPos { top: number; left: number; width: number }

export function LogInput({ onLogged }: { onLogged?: () => void }) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<typeof KNOWN_METRICS>([])
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dropPos, setDropPos] = useState<DropdownPos | null>(null)
  const [mounted, setMounted] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Portal only works client-side
  useEffect(() => { setMounted(true) }, [])

  // Recalculate dropdown position whenever open state changes or on scroll/resize
  useEffect(() => {
    if (!open || !wrapRef.current) { setDropPos(null); return }

    const recalc = () => {
      if (!wrapRef.current) return
      const rect = wrapRef.current.getBoundingClientRect()
      setDropPos({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      })
    }

    recalc()
    window.addEventListener('scroll', recalc, { passive: true })
    window.addEventListener('resize', recalc, { passive: true })
    return () => {
      window.removeEventListener('scroll', recalc)
      window.removeEventListener('resize', recalc)
    }
  }, [open])

  const updateSuggestions = useCallback((input: string) => {
    const parts = input.trim().split(/\s+/)
    const key = parts[0].toLowerCase()
    if (!input.trim() || parts.length > 1) { setSuggestions([]); setOpen(false); return }
    const hits = KNOWN_METRICS.filter(m => m.key.startsWith(key) && m.key !== key).slice(0, 6)
    setSuggestions(hits)
    setOpen(hits.length > 0)
  }, [])

  const handleChange = (val: string) => { setValue(val); updateSuggestions(val) }

  const selectSuggestion = (key: string) => {
    setValue(key + ' ')
    setSuggestions([])
    setOpen(false)
    inputRef.current?.focus()
  }

  const handleSubmit = async () => {
    if (!value.trim() || loading) return
    setLoading(true); setOpen(false)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: value.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      const parsed = parseLogInput(value.trim())
      notifications.show({
        message: `✓  ${getMetricDisplayName(parsed?.metricKey ?? value)} logged`,
        color: 'green', autoClose: 2000,
        styles: { root: { background: 'var(--card-bg)', border: '1px solid var(--green)' } },
      })
      setValue('')
      onLogged?.()
    } catch (err: unknown) {
      notifications.show({
        message: err instanceof Error ? err.message : 'Failed to log',
        color: 'red', autoClose: 3000,
      })
    } finally { setLoading(false) }
  }

  const dropdown = open && suggestions.length > 0 && dropPos && mounted
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
              onMouseDown={(e) => { e.preventDefault(); selectSuggestion(m.key) }}
              style={{
                padding: '11px 16px',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--sep)' : 'none',
                cursor: 'pointer',
              }}
            >
              <Group justify="space-between">
                <Group gap="xs">
                  <Text size="sm">{m.emoji}</Text>
                  <Text size="sm" fw={500} style={{ color: 'var(--text-primary)' }}>{m.key}</Text>
                </Group>
                <Group gap={6}>
                  <Badge size="xs" variant="light" color="gray" radius="sm">{m.type}</Badge>
                  {m.unit && <Badge size="xs" variant="outline" color="orange" radius="sm">{m.unit}</Badge>}
                </Group>
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      </div>,
      document.body
    )
    : null

  return (
    <Box ref={wrapRef} style={{ position: 'relative', zIndex: 10 }}>
      {/* Input bar */}
      <Box style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--input-bg)',
        border: `1.5px solid ${focused ? 'var(--orange)' : 'var(--input-border)'}`,
        borderRadius: 24,
        padding: '6px 6px 6px 18px',
        boxShadow: focused ? '0 0 0 4px var(--orange-glow)' : 'var(--card-shadow)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}>
        <IconBolt size={16} color="var(--orange)" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={value}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') setOpen(false)
          }}
          onFocus={() => { setFocused(true); value && updateSuggestions(value) }}
          onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 150) }}
          placeholder="sleep 7.5  ·  workout  ·  mood 8  ·  protein 142"
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 15, fontFamily: 'inherit',
            caretColor: 'var(--orange)', padding: '8px 0',
          }}
        />
        <Text size="xs" className="hide-mobile"
          style={{ whiteSpace: 'nowrap', paddingRight: 4, color: 'var(--text-muted)' }}>
          ↵ to log
        </Text>
        <ActionIcon
          size={36} radius="xl" variant="filled"
          onClick={handleSubmit}
          disabled={!value.trim() || loading}
          style={{
            background: value.trim() ? 'var(--orange)' : 'var(--sep2)',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          {loading ? <Loader size={14} color="white" /> : <IconArrowUp size={18} />}
        </ActionIcon>
      </Box>

      {/* Dropdown rendered into document.body via portal */}
      {dropdown}
    </Box>
  )
}
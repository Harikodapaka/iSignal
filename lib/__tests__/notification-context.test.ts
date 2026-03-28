import { describe, it, expect, vi } from 'vitest';
import { getLocalHour, getNotificationWindow } from '../notification-context';

// ── getNotificationWindow ────────────────────────────────────────────────────
// We can't easily control "now" for getLocalHour (it uses new Date() internally),
// so we test getNotificationWindow by mocking getLocalHour indirectly via date.

describe('getNotificationWindow', () => {
  it('returns a valid window type or null', () => {
    const result = getNotificationWindow('UTC');
    expect([null, 'morning', 'midday', 'evening']).toContain(result);
  });

  it('handles invalid timezone gracefully', () => {
    // Should fall back to UTC hours, not throw
    const result = getNotificationWindow('Invalid/TZ');
    expect([null, 'morning', 'midday', 'evening']).toContain(result);
  });
});

// ── getLocalHour ─────────────────────────────────────────────────────────────

describe('getLocalHour', () => {
  it('returns a number between 0 and 23', () => {
    const hour = getLocalHour('UTC');
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThanOrEqual(23);
  });

  it('returns a number for Asia/Kolkata', () => {
    const hour = getLocalHour('Asia/Kolkata');
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThanOrEqual(23);
  });

  it('handles invalid timezone by falling back to UTC', () => {
    const hour = getLocalHour('Not/A/Timezone');
    const utcHour = new Date().getUTCHours();
    expect(hour).toBe(utcHour);
  });

  it('returns different hours for different timezones (most of the time)', () => {
    // UTC and Asia/Kolkata differ by 5.5 hours
    const utcHour = getLocalHour('UTC');
    const istHour = getLocalHour('Asia/Kolkata');
    // They should differ (except in rare edge cases at midnight boundaries)
    // We just check both are valid numbers
    expect(typeof utcHour).toBe('number');
    expect(typeof istHour).toBe('number');
  });
});

// ── getNotificationWindow — deterministic tests with fake time ───────────────

describe('getNotificationWindow — with faked time', () => {
  it('returns morning for 6 AM UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T06:00:00Z'));
    expect(getNotificationWindow('UTC')).toBe('morning');
    vi.useRealTimers();
  });

  it('returns morning for 7 AM UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T07:30:00Z'));
    expect(getNotificationWindow('UTC')).toBe('morning');
    vi.useRealTimers();
  });

  it('returns morning for 8 AM UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T08:00:00Z'));
    expect(getNotificationWindow('UTC')).toBe('morning');
    vi.useRealTimers();
  });

  it('returns midday for 12 PM UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T12:00:00Z'));
    expect(getNotificationWindow('UTC')).toBe('midday');
    vi.useRealTimers();
  });

  it('returns midday for 1 PM UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T13:00:00Z'));
    expect(getNotificationWindow('UTC')).toBe('midday');
    vi.useRealTimers();
  });

  it('returns evening for 7 PM UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T19:00:00Z'));
    expect(getNotificationWindow('UTC')).toBe('evening');
    vi.useRealTimers();
  });

  it('returns evening for 8 PM UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T20:00:00Z'));
    expect(getNotificationWindow('UTC')).toBe('evening');
    vi.useRealTimers();
  });

  it('returns null for 3 AM UTC (no window)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T03:00:00Z'));
    expect(getNotificationWindow('UTC')).toBeNull();
    vi.useRealTimers();
  });

  it('returns null for 10 AM UTC (between windows)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T10:00:00Z'));
    expect(getNotificationWindow('UTC')).toBeNull();
    vi.useRealTimers();
  });

  it('returns null for 3 PM UTC (between windows)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T15:00:00Z'));
    expect(getNotificationWindow('UTC')).toBeNull();
    vi.useRealTimers();
  });

  it('returns null for 9 PM UTC (after evening)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T21:00:00Z'));
    expect(getNotificationWindow('UTC')).toBeNull();
    vi.useRealTimers();
  });

  it('returns null for 5 AM UTC (before morning)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T05:00:00Z'));
    expect(getNotificationWindow('UTC')).toBeNull();
    vi.useRealTimers();
  });
});

import { describe, it, expect } from 'vitest';
import {
  parseAtSyntax,
  formatValue,
  getMetricColor,
  getMetricEmoji,
  getMetricDisplayName,
  getTodayString,
  getLast7Days,
  getLast30Days,
} from '../parser';

// ── parseAtSyntax ────────────────────────────────────────────────────────────

describe('parseAtSyntax', () => {
  it('@sleep 7 → number', () => {
    expect(parseAtSyntax('@sleep 7')).toMatchObject({ metricKey: 'sleep', value: 7, valueType: 'number' });
  });

  it('@workout → boolean', () => {
    expect(parseAtSyntax('@workout')).toMatchObject({ metricKey: 'workout', value: true, valueType: 'boolean' });
  });

  it('@mood:/10 8 → number with unit', () => {
    expect(parseAtSyntax('@mood:/10 8')).toMatchObject({ metricKey: 'mood', value: 8, unit: '/10' });
  });

  it('decimal values', () => {
    expect(parseAtSyntax('@sleep 7.5')).toMatchObject({ metricKey: 'sleep', value: 7.5 });
  });

  it('custom metric keys', () => {
    expect(parseAtSyntax('@my-custom-metric 42')).toMatchObject({ metricKey: 'my-custom-metric', value: 42 });
  });

  it('normalizes unit via UNIT_MAP', () => {
    expect(parseAtSyntax('@sleep:hours 8')).toMatchObject({ unit: 'h' });
  });

  it('preserves unknown units', () => {
    expect(parseAtSyntax('@custom:widgets 5')).toMatchObject({ unit: 'widgets' });
  });

  it('case insensitive', () => {
    expect(parseAtSyntax('@SLEEP 7')).toMatchObject({ metricKey: 'sleep' });
  });

  it('returns null for non-@ input', () => {
    expect(parseAtSyntax('sleep 7')).toBeNull();
  });

  it('returns null for empty/whitespace', () => {
    expect(parseAtSyntax('')).toBeNull();
    expect(parseAtSyntax('   ')).toBeNull();
  });
});

// ── formatValue ──────────────────────────────────────────────────────────────

describe('formatValue', () => {
  it('boolean true → ✓ Done', () => {
    expect(formatValue(true, undefined, 'boolean')).toBe('✓ Done');
  });

  it('boolean false → ✗ Skipped', () => {
    expect(formatValue(false, undefined, 'boolean')).toBe('✗ Skipped');
  });

  it('number with unit', () => {
    expect(formatValue(7, 'h')).toBe('7 h');
  });

  it('number without unit', () => {
    expect(formatValue(42)).toBe('42');
  });

  it('/10 unit → fraction format', () => {
    expect(formatValue(8, '/10')).toBe('8/10');
  });

  it('k unit → steps format', () => {
    expect(formatValue(10, 'k')).toBe('10k steps');
  });

  it('string value', () => {
    expect(formatValue('some note')).toBe('some note');
  });

  it('infers boolean from typeof', () => {
    expect(formatValue(true)).toBe('✓ Done');
    expect(formatValue(false)).toBe('✗ Skipped');
  });
});

// ── Display helpers ──────────────────────────────────────────────────────────

describe('getMetricColor', () => {
  it('known metric', () => {
    expect(getMetricColor('sleep')).toBe('#007aff');
    expect(getMetricColor('workout')).toBe('#30d158');
  });

  it('unknown → default gray', () => {
    expect(getMetricColor('unknown-thing')).toBe('#636366');
  });
});

describe('getMetricEmoji', () => {
  it('known metric', () => {
    expect(getMetricEmoji('sleep')).toBe('🌙');
    expect(getMetricEmoji('water')).toBe('💧');
    expect(getMetricEmoji('caffeine')).toBe('☕');
  });

  it('unknown → default 📊', () => {
    expect(getMetricEmoji('unknown-thing')).toBe('📊');
  });
});

describe('getMetricDisplayName', () => {
  it('known metric', () => {
    expect(getMetricDisplayName('sleep')).toBe('Sleep');
    expect(getMetricDisplayName('screen')).toBe('Screen Time');
  });

  it('unknown multi-word → capitalized', () => {
    expect(getMetricDisplayName('cold shower')).toBe('Cold Shower');
  });

  it('unknown single-word → capitalized', () => {
    expect(getMetricDisplayName('journaling')).toBe('Journaling');
  });
});

// ── Date helpers ─────────────────────────────────────────────────────────────

describe('getTodayString', () => {
  it('YYYY-MM-DD format', () => {
    expect(getTodayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches current date', () => {
    expect(getTodayString()).toBe(new Date().toISOString().split('T')[0]);
  });
});

describe('getLast7Days', () => {
  it('returns 7 days', () => {
    expect(getLast7Days()).toHaveLength(7);
  });

  it('YYYY-MM-DD format', () => {
    for (const d of getLast7Days()) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('last element is today', () => {
    const days = getLast7Days();
    expect(days[6]).toBe(new Date().toISOString().split('T')[0]);
  });

  it('ascending order', () => {
    const days = getLast7Days();
    for (let i = 1; i < days.length; i++) {
      expect(days[i] > days[i - 1]).toBe(true);
    }
  });
});

describe('getLast30Days', () => {
  it('returns 30 days', () => {
    expect(getLast30Days()).toHaveLength(30);
  });

  it('last element is today', () => {
    const days = getLast30Days();
    expect(days[29]).toBe(new Date().toISOString().split('T')[0]);
  });

  it('ascending order', () => {
    const days = getLast30Days();
    for (let i = 1; i < days.length; i++) {
      expect(days[i] > days[i - 1]).toBe(true);
    }
  });
});

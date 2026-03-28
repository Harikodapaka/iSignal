import { describe, it, expect } from 'vitest';
import { formatSuggestionHint, type MetricSuggestion } from '../smart-reminders';

// ── formatSuggestionHint ─────────────────────────────────────────────────────
// The getSmartSuggestions function requires a DB connection, so we test the
// pure helper. The DB-dependent logic is integration-tested via the API.

function makeSuggestion(overrides: Partial<MetricSuggestion> = {}): MetricSuggestion {
  return {
    metricKey: 'water',
    suggestedTimes: [14],
    confidence: 'high',
    sampleSize: 20,
    peakHourCount: 10,
    ...overrides,
  };
}

describe('formatSuggestionHint', () => {
  it('formats a single time', () => {
    const hint = formatSuggestionHint(makeSuggestion({ suggestedTimes: [14] }));
    expect(hint).toBe('You usually log this around 2 PM');
  });

  it('formats two times with "and"', () => {
    const hint = formatSuggestionHint(makeSuggestion({ suggestedTimes: [9, 14] }));
    expect(hint).toBe('You usually log this around 9 AM and 2 PM');
  });

  it('formats three times with comma and "and"', () => {
    const hint = formatSuggestionHint(makeSuggestion({ suggestedTimes: [9, 14, 19] }));
    expect(hint).toBe('You usually log this around 9 AM, 2 PM, and 7 PM');
  });

  it('formats midnight as 12 AM', () => {
    const hint = formatSuggestionHint(makeSuggestion({ suggestedTimes: [0] }));
    expect(hint).toBe('You usually log this around 12 AM');
  });

  it('formats noon as 12 PM', () => {
    const hint = formatSuggestionHint(makeSuggestion({ suggestedTimes: [12] }));
    expect(hint).toBe('You usually log this around 12 PM');
  });

  it('formats morning hours correctly', () => {
    const hint = formatSuggestionHint(makeSuggestion({ suggestedTimes: [6] }));
    expect(hint).toBe('You usually log this around 6 AM');
  });

  it('formats late evening correctly', () => {
    const hint = formatSuggestionHint(makeSuggestion({ suggestedTimes: [23] }));
    expect(hint).toBe('You usually log this around 11 PM');
  });
});

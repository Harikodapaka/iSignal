import type { LogInputParsed } from '@/types';
import { KNOWN_METRICS } from '@/lib/metrics';
import {
  UNIT_MAP,
  NOISE_WORDS,
  VERB_TOKENS,
  UNIT_CONVERSIONS,
  SERVING_CONVERSIONS,
  METRIC_ALIAS_UNITS,
  SENTIMENT_SCORES,
  CONTEXT_OVERRIDES,
  HALF_PATTERN,
  HALF_PLACEHOLDER,
} from '@/lib/parser-constants';

export { KNOWN_METRICS } from '@/lib/metrics';
export { UNIT_MAP, NOISE_WORDS, VERB_TOKENS } from '@/lib/parser-constants';

// ── Levenshtein distance (for typo tolerance) ────────────────────────────────
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        a[j - 1] === b[i - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

// ── Metric lookup — exact match + controlled fuzzy (distance ≤ 1) ────────────
// Fuzzy only fires if the token isn't a noise word and is ≥ 3 chars long.
// This catches "slep→sleep", "wokrout→workout" without false positives.
export function findMetric(key: string) {
  const lower = key.toLowerCase().trim();
  // 1. Exact match on key or alias
  const exact = KNOWN_METRICS.find((m) => m.key === lower || m.aliases?.includes(lower));
  if (exact) return exact;

  // 2. Fuzzy match (Levenshtein ≤ 1) — skip noise words and short tokens
  if (lower.length >= 3 && !NOISE_WORDS.has(lower)) {
    for (const m of KNOWN_METRICS) {
      if (levenshtein(lower, m.key) <= 1) return m;
      if (m.aliases?.some((a) => a.indexOf(' ') === -1 && levenshtein(lower, a) <= 1)) return m;
    }
  }
  return undefined;
}

// ── Smart token picker ────────────────────────────────────────────────────────
// Score: key=3, alias=2, pair=+0.5, verb=-0.5, user-exact=3.5, user-partial=2.5

type Metric = NonNullable<ReturnType<typeof findMetric>>;

function scoreMatch(token: string, metric: Metric, isPair: boolean): number {
  const lower = token.toLowerCase();
  const score = metric.key === lower ? 3 : 2; // key=3, alias=2 (no fuzzy=1 anymore)
  return score + (isPair ? 0.5 : 0) - (VERB_TOKENS.has(lower) ? 0.5 : 0);
}

function pickMetricKey(
  keyTokens: string[],
  userKeys: string[] = []
): { key: string; metric: ReturnType<typeof findMetric> } {
  const candidates: { key: string; metric: ReturnType<typeof findMetric>; score: number }[] = [];

  // Single token exact match
  for (const token of keyTokens) {
    const m = findMetric(token);
    if (m) candidates.push({ key: m.key, metric: m, score: scoreMatch(token, m, false) });
  }

  // Adjacent pair exact match (e.g. "screen time", "protein shake")
  for (let i = 0; i < keyTokens.length - 1; i++) {
    const pair = `${keyTokens[i]} ${keyTokens[i + 1]}`;
    const m = findMetric(pair);
    if (m) candidates.push({ key: m.key, metric: m, score: scoreMatch(pair, m, true) });
  }

  // Match user-created metric keys — "watched jurassic park movie" → "watched movie"
  const lower = keyTokens.join(' ');
  for (const uk of userKeys) {
    const ukLower = uk.toLowerCase();
    if (lower === ukLower) {
      candidates.push({ key: uk, metric: undefined, score: 3.5 });
    } else if (lower.includes(ukLower) || ukLower.split(' ').every((w) => keyTokens.includes(w))) {
      candidates.push({ key: uk, metric: undefined, score: 2.5 });
    }
  }

  if (candidates.length > 0) {
    const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
    return { key: best.key, metric: best.metric };
  }

  // No match — return compound key, let AI handle it
  const compound = keyTokens.join(' ');
  return { key: compound, metric: undefined };
}

// ── Public API ────────────────────────────────────────────────────────────────
export function getMetricColor(key: string): string {
  return findMetric(key)?.color ?? '#636366';
}
export function getMetricEmoji(key: string): string {
  return findMetric(key)?.emoji ?? '📊';
}
export function getMetricDisplayName(key: string): string {
  const known = findMetric(key);
  if (known) return known.displayName;
  return key
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── @ explicit metric syntax ──────────────────────────────────────────────────
// @metric-key          → boolean, value=true
// @metric-key 5        → number, no unit
// @metric-key:L 1      → number, unit=L
// @metric-key:h 7.5    → number, unit=h (normalised via UNIT_MAP)
export function parseAtSyntax(raw: string): LogInputParsed | null {
  const match = raw.trim().match(/^@([\w-]+)(?::(\S+))?\s*([\d.]+)?/i);
  if (!match) return null;

  const metricKey = match[1].toLowerCase();
  const rawUnit = match[2] ?? null;
  const unit = rawUnit ? (UNIT_MAP[rawUnit.toLowerCase()] ?? rawUnit) : undefined;
  const rawValue = match[3] ?? null;

  if (rawValue !== null) {
    return { metricKey, value: parseFloat(rawValue), valueType: 'number', unit };
  }
  return { metricKey, value: true, valueType: 'boolean', unit };
}

// ── Unit conversion ──────────────────────────────────────────────────────────
function convertUnit(value: number, fromUnit: string, toUnit: string): { value: number; unit: string } | null {
  const conversions = UNIT_CONVERSIONS[fromUnit];
  if (!conversions || conversions[toUnit] === undefined) return null;
  const converted = Math.round(value * conversions[toUnit] * 100) / 100;
  return { value: converted, unit: toUnit };
}

// ── Multi-metric splitter ─────────────────────────────────────────────────────
// Splits "ran 5k and drank 2L water" into ["ran 5k", "drank 2L water"]
function splitMultiMetric(raw: string): string[] {
  // Protect "and a half" from being split
  const protected_ = raw.replace(HALF_PATTERN, HALF_PLACEHOLDER);
  const segments = protected_
    .split(/\b(?:and|then|also|plus)\b|[,;]/i)
    .map((s) => s.trim())
    .filter(Boolean)
    // Restore "and a half" in each segment
    .map((s) => s.replace(new RegExp(HALF_PLACEHOLDER, 'g'), 'and a half'));
  return segments.length > 0 ? segments : [raw];
}

// ── Contextual alias overrides ───────────────────────────────────────────────
function checkContextOverrides(raw: string): { forcedKey?: string; blockedKeys: Set<string> } {
  const blockedKeys = new Set<string>();
  let forcedKey: string | undefined;

  for (const override of CONTEXT_OVERRIDES) {
    if (override.pattern.test(raw)) {
      if (override.metricKey !== '__block__') {
        forcedKey = override.metricKey;
      }
      if (override.blockKeys) {
        for (const k of override.blockKeys) blockedKeys.add(k);
      }
    }
  }
  return { forcedKey, blockedKeys };
}

// ── Serving conversion ───────────────────────────────────────────────────────
function convertServing(metricKey: string, value: number, unit: string): { value: number; unit: string } | null {
  const conversions = SERVING_CONVERSIONS[metricKey];
  if (!conversions) return null;
  const conversion = conversions[unit];
  if (!conversion) return null;
  return { value: Math.round(value * conversion.factor * 100) / 100, unit: conversion.unit };
}

// ── Sentiment inference ──────────────────────────────────────────────────────
function inferSentimentValue(text: string): number | null {
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    if (SENTIMENT_SCORES[word] !== undefined) return SENTIMENT_SCORES[word];
  }
  return null;
}

// ── Single segment parser (internal) ─────────────────────────────────────────
function parseSingleSegment(trimmed: string, userMetricKeys: string[] = []): LogInputParsed | null {
  if (!trimmed) return null;

  // Fix #4: Handle "and a half" → add 0.5 to preceding number
  const halfNormalized = trimmed.replace(/(\d+\.?\d*)\s+and\s+a\s+half\b/gi, (_, num) => String(parseFloat(num) + 0.5));

  // Check context overrides before tokenizing
  const { forcedKey, blockedKeys } = checkContextOverrides(halfNormalized);

  const tokens = halfNormalized
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''))
    .filter(Boolean);
  const keyTokens: string[] = [];
  let value: number | null = null;
  let unit: string | null = null;

  for (const token of tokens) {
    if (/^\d+(\.\d+)?$/.test(token)) {
      value = parseFloat(token);
      continue;
    }
    const numUnit = token.match(/^(\d+\.?\d*)([a-z]+)$/);
    if (numUnit) {
      value = parseFloat(numUnit[1]);
      unit = UNIT_MAP[numUnit[2]] ?? numUnit[2];
      continue;
    }
    // Fix #1: If token is both a unit AND a metric alias, treat as metric key (not unit)
    if (UNIT_MAP[token] && !METRIC_ALIAS_UNITS.has(token)) {
      unit = UNIT_MAP[token];
      continue;
    }
    if (NOISE_WORDS.has(token)) continue;
    keyTokens.push(token);
  }

  // If context override forced a key (e.g. "energy drink" → caffeine)
  if (forcedKey) {
    const forcedMetric = findMetric(forcedKey);
    // Apply serving conversion for forced keys too
    if (value !== null && unit) {
      const serving = convertServing(forcedKey, value, unit);
      if (serving) {
        return { metricKey: forcedKey, value: serving.value, valueType: 'number', unit: serving.unit };
      }
    }
    const resolvedUnit = unit ?? forcedMetric?.unit ?? undefined;
    if (value !== null) return { metricKey: forcedKey, value, valueType: 'number', unit: resolvedUnit };
    return { metricKey: forcedKey, value: true, valueType: 'boolean' };
  }

  if (!keyTokens.length) return null;
  const { key: metricKey, metric: known } = pickMetricKey(keyTokens, userMetricKeys);

  // Fix #12: If the resolved key is in blockedKeys, skip it and try next candidate
  if (blockedKeys.has(metricKey)) {
    return null;
  }

  // Fix: "10k steps" → 10000 steps. When unit parsed as 'km' (from 'k' shorthand)
  // but the metric expects 'steps', treat 'k' as ×1000 multiplier, not kilometers.
  if (value !== null && unit === 'km' && known?.unit === 'steps') {
    value = value * 1000;
    unit = null;
  }

  // Fix #3: Smart unit inference — auto-fill from metric's default unit
  const resolvedUnit = unit ?? known?.unit ?? undefined;

  // Fix #8 & #9: Serving size conversion (cups of coffee → mg, scoops of protein → g)
  if (value !== null && unit) {
    const serving = convertServing(metricKey, value, unit);
    if (serving) {
      return { metricKey, value: serving.value, valueType: 'number', unit: serving.unit };
    }
  }

  // Unit conversion — convert between compatible units to match the metric's expected unit
  let resolvedValue = value;
  if (value !== null && unit && known?.unit && unit !== known.unit) {
    const converted = convertUnit(value, unit, known.unit);
    if (converted !== null) {
      resolvedValue = converted.value;
      return { metricKey, value: resolvedValue, valueType: 'number', unit: known.unit };
    }
  }

  if (resolvedValue !== null) return { metricKey, value: resolvedValue, valueType: 'number', unit: resolvedUnit };

  // Fix: If a known numeric metric (e.g. mood /10) matched but no number was found,
  // infer a value from sentiment words instead of falling back to boolean.
  if (known?.type === 'number' && known?.unit === '/10') {
    const text = keyTokens.join(' ');
    const sentimentValue = inferSentimentValue(text);
    if (sentimentValue !== null) {
      return { metricKey, value: sentimentValue, valueType: 'number', unit: resolvedUnit };
    }
  }

  return { metricKey, value: true, valueType: 'boolean' };
}

// ── Public API: parseLogInput ────────────────────────────────────────────────
// Returns a single parsed result (first match) for backward compatibility.
export function parseLogInput(raw: string, userMetricKeys: string[] = []): LogInputParsed | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return parseSingleSegment(trimmed, userMetricKeys);
}

// ── Public API: parseLogInputMulti ───────────────────────────────────────────
// Splits on conjunctions (and, then, also, commas) and returns all parsed metrics.
// "ran 5k and drank 2L water" → [{metricKey:"run", value:5, unit:"km"}, {metricKey:"water", value:2, unit:"L"}]
export function parseLogInputMulti(raw: string, userMetricKeys: string[] = []): LogInputParsed[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const segments = splitMultiMetric(trimmed);

  // Single segment — just use normal parser
  if (segments.length <= 1) {
    const result = parseSingleSegment(trimmed, userMetricKeys);
    return result ? [result] : [];
  }

  const results: LogInputParsed[] = [];
  for (const segment of segments) {
    const parsed = parseSingleSegment(segment, userMetricKeys);
    if (parsed) results.push(parsed);
  }
  return results;
}

export function formatValue(value: boolean | number | string, unit?: string, valueType?: string): string {
  if (valueType === 'boolean' || typeof value === 'boolean') return value ? '✓ Done' : '✗ Skipped';
  if (typeof value === 'number') {
    if (unit === '/10') return `${value}/10`;
    // Format step counts nicely: 5000 → "5,000 steps"
    if (unit === 'steps') {
      return `${value.toLocaleString('en-US')} steps`;
    }
    // Legacy: old events stored with unit='k' (before fix)
    if (unit === 'k') {
      return `${value.toLocaleString('en-US')} steps`;
    }
    return unit ? `${value} ${unit}` : `${value}`;
  }
  return String(value);
}

export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

export function getLast30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split('T')[0];
  });
}

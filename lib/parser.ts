import type { LogInputParsed } from '@/types';
import { KNOWN_METRICS } from '@/lib/metrics';
import { UNIT_MAP, NOISE_WORDS, VERB_TOKENS } from '@/lib/parser-constants';

export { KNOWN_METRICS } from '@/lib/metrics';
export { UNIT_MAP, NOISE_WORDS, VERB_TOKENS } from '@/lib/parser-constants';

// ── Metric lookup — exact match only, no fuzzy ────────────────────────────────
// Fuzzy matching was removed: too many false positives (shit→shot→alcohol etc.)
// Typos and slang are handled by the AI fallback which writes aliases for next time.
export function findMetric(key: string) {
  const lower = key.toLowerCase().trim();
  return KNOWN_METRICS.find((m) => m.key === lower || m.aliases?.includes(lower));
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

export function parseLogInput(raw: string, userMetricKeys: string[] = []): LogInputParsed | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const tokens = trimmed.toLowerCase().split(/\s+/);
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
    if (UNIT_MAP[token]) {
      unit = UNIT_MAP[token];
      continue;
    }
    if (NOISE_WORDS.has(token)) continue;
    keyTokens.push(token);
  }

  if (!keyTokens.length) return null;
  const { key: metricKey, metric: known } = pickMetricKey(keyTokens, userMetricKeys);

  if (value !== null) return { metricKey, value, valueType: 'number', unit: unit ?? known?.unit };
  return { metricKey, value: true, valueType: 'boolean' };
}

export function formatValue(value: boolean | number | string, unit?: string, valueType?: string): string {
  if (valueType === 'boolean' || typeof value === 'boolean') return value ? '✓ Done' : '✗ Skipped';
  if (typeof value === 'number') {
    if (unit === '/10') return `${value}/10`;
    if (unit === 'k') return `${value}k steps`;
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

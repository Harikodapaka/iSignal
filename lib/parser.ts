import type { LogInputParsed } from '@/types';
import { KNOWN_METRICS } from '@/lib/metrics';
import { UNIT_MAP, NOISE_WORDS, VERB_TOKENS } from '@/lib/parser-constants';

export { KNOWN_METRICS } from '@/lib/metrics';
export { UNIT_MAP, NOISE_WORDS, VERB_TOKENS } from '@/lib/parser-constants';

// ── Levenshtein edit distance ─────────────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 3) return 99;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

function maxDistance(word: string): number {
  if (word.length <= 3) return 0;
  if (word.length <= 7) return 1; // distance 2 causes too many false matches (shaved→shake etc.)
  return 2;
}

// Flat lookup table: every key + alias → metric index
const ALL_TERMS: { term: string; metricIdx: number }[] = [];
for (let i = 0; i < KNOWN_METRICS.length; i++) {
  const m = KNOWN_METRICS[i];
  ALL_TERMS.push({ term: m.key, metricIdx: i });
  for (const alias of m.aliases ?? []) ALL_TERMS.push({ term: alias, metricIdx: i });
}

// ── Metric lookup ─────────────────────────────────────────────────────────────
export function findMetric(key: string) {
  const lower = key.toLowerCase().trim();
  const exact = KNOWN_METRICS.find((m) => m.key === lower || m.aliases?.includes(lower));
  if (exact) return exact;

  const threshold = maxDistance(lower);
  if (threshold === 0) return undefined;

  let bestDist = threshold + 1,
    bestIdx = -1;
  for (const { term, metricIdx } of ALL_TERMS) {
    if (Math.abs(term.length - lower.length) > threshold) continue;
    const dist = levenshtein(lower, term);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = metricIdx;
    }
  }
  return bestIdx >= 0 ? KNOWN_METRICS[bestIdx] : undefined;
}

// ── Smart token picker ────────────────────────────────────────────────────────
// Score: key=3, alias=2, fuzzy=1, pair=+0.5, verb=-0.5, user-exact=3.5, user-partial=2.5

type Metric = NonNullable<ReturnType<typeof findMetric>>;

function scoreMatch(token: string, metric: Metric, isPair: boolean): number {
  const lower = token.toLowerCase();
  let score = metric.key === lower ? 3 : metric.aliases?.includes(lower) ? 2 : 1;
  if (isPair) score += 0.5;
  if (VERB_TOKENS.has(lower)) score -= 0.5;
  return score;
}

function pickMetricKey(
  keyTokens: string[],
  userKeys: string[] = []
): { key: string; metric: ReturnType<typeof findMetric> } {
  const candidates: { key: string; metric: ReturnType<typeof findMetric>; score: number }[] = [];

  for (const token of keyTokens) {
    const m = findMetric(token);
    if (m) candidates.push({ key: m.key, metric: m, score: scoreMatch(token, m, false) });
  }
  for (let i = 0; i < keyTokens.length - 1; i++) {
    const pair = `${keyTokens[i]} ${keyTokens[i + 1]}`;
    const m = findMetric(pair);
    if (m) candidates.push({ key: m.key, metric: m, score: scoreMatch(pair, m, true) });
  }

  // Match user-created keys — "watched jurassic park movie" → "watched movie"
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
  const compound = keyTokens.join(' ');
  return { key: compound, metric: findMetric(compound) };
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

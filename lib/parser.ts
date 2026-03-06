import type { LogInputParsed, ValueType } from '@/types'

export const KNOWN_METRICS: {
  key: string
  displayName: string
  type: ValueType
  unit?: string
  aliases?: string[]
  color: string
  emoji: string
}[] = [
    { key: 'sleep', displayName: 'Sleep', type: 'number', unit: 'h', aliases: ['slept', 'sleeping', 'hours sleep', 'hrs sleep'], color: '#007aff', emoji: '🌙' },
    { key: 'workout', displayName: 'Workout', type: 'boolean', unit: undefined, aliases: ['gym', 'exercise', 'training', 'lifted', 'worked out', 'exercised'], color: '#30d158', emoji: '💪' },
    { key: 'protein', displayName: 'Protein', type: 'number', unit: 'g', aliases: ['proteins'], color: '#ff9f0a', emoji: '🥩' },
    { key: 'mood', displayName: 'Mood', type: 'number', unit: '/10', aliases: ['feeling', 'vibe', 'emotions'], color: '#bf5af2', emoji: '😊' },
    { key: 'water', displayName: 'Water', type: 'number', unit: 'L', aliases: ['hydration', 'fluids'], color: '#40cbe0', emoji: '💧' },
    { key: 'steps', displayName: 'Steps', type: 'number', unit: 'k', aliases: ['walked', 'walking'], color: '#ff375f', emoji: '👟' },
    { key: 'weight', displayName: 'Weight', type: 'number', unit: 'kg', aliases: ['bodyweight', 'mass'], color: '#ff9f0a', emoji: '⚖️' },
    { key: 'meditation', displayName: 'Meditation', type: 'number', unit: 'min', aliases: ['meditated', 'mindfulness'], color: '#40cbe0', emoji: '🧘' },
    { key: 'reading', displayName: 'Reading', type: 'number', unit: 'min', aliases: ['read', 'books'], color: '#ffd60a', emoji: '📚' },
    { key: 'caffeine', displayName: 'Caffeine', type: 'number', unit: 'mg', aliases: ['coffee', 'espresso'], color: '#a2845e', emoji: '☕' },
    { key: 'calories', displayName: 'Calories', type: 'number', unit: 'kcal', aliases: ['cal', 'cals', 'kcal'], color: '#ff453a', emoji: '🍽️' },
    { key: 'run', displayName: 'Run', type: 'number', unit: 'km', aliases: ['running', 'ran', 'jog', 'jogged'], color: '#30d158', emoji: '🏃' },
    { key: 'energy', displayName: 'Energy', type: 'number', unit: '/10', aliases: [], color: '#ffd60a', emoji: '⚡' },
    { key: 'stress', displayName: 'Stress', type: 'number', unit: '/10', aliases: ['anxiety', 'anxious'], color: '#ff453a', emoji: '😰' },
    { key: 'screen', displayName: 'Screen Time', type: 'number', unit: 'h', aliases: ['screen time', 'screentime', 'phone'], color: '#636366', emoji: '📱' },
    { key: 'alcohol', displayName: 'Alcohol', type: 'boolean', unit: undefined, aliases: ['drinks', 'drinking', 'drank'], color: '#ff9f0a', emoji: '🍺' },
  ]

const UNIT_MAP: Record<string, string> = {
  hrs: 'h', hr: 'h', hours: 'h', hour: 'h',
  mins: 'min', minutes: 'min', minute: 'min',
  kg: 'kg', kgs: 'kg', lbs: 'lb', pounds: 'lb',
  g: 'g', grams: 'g', gram: 'g',
  l: 'L', liters: 'L', liter: 'L', ml: 'ml',
  k: 'k', km: 'km', miles: 'mi',
  kcal: 'kcal', cal: 'kcal', cals: 'kcal',
  mg: 'mg',
}

const NOISE_WORDS = new Set([
  'and', 'the', 'a', 'an', 'i', 'my', 'me',
  'felt', 'feeling', 'feel', 'great', 'good', 'bad', 'okay', 'ok',
  'today', 'tonight', 'this', 'morning', 'night', 'evening', 'afternoon',
  'after', 'before', 'about', 'around', 'just', 'only', 'post', 'pre',
  'did', 'had', 'got', 'have', 'was', 'were', 'am', 'is',
  'some', 'bit', 'little', 'much', 'very', 'really', 'quite',
])

// ── Levenshtein edit distance ─────────────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  // Early exits
  if (m === 0) return n
  if (n === 0) return m
  if (Math.abs(m - n) > 3) return 99 // can't possibly be within threshold

  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = temp
    }
  }
  return dp[n]
}

// Max allowed edit distance — scales with word length so short words are stricter
function maxDistance(word: string): number {
  if (word.length <= 3) return 0  // "gym", "run" — exact only, too short to fuzz
  if (word.length <= 5) return 1  // "sleep" → "sleept" ✓, "slept" → "sleep" ✓
  if (word.length <= 8) return 2  // "workout" → "workuot" ✓
  return 2                         // longer words — still cap at 2
}

// Build a flat lookup table: every key + alias → canonical metric key
const ALL_TERMS: { term: string; metricIdx: number }[] = []
for (let i = 0; i < KNOWN_METRICS.length; i++) {
  const m = KNOWN_METRICS[i]
  ALL_TERMS.push({ term: m.key, metricIdx: i })
  for (const alias of m.aliases ?? []) {
    ALL_TERMS.push({ term: alias, metricIdx: i })
  }
}

export function findMetric(key: string) {
  const lower = key.toLowerCase().trim()

  // 1. Exact match first (fastest path)
  const exact = KNOWN_METRICS.find(
    (m) => m.key === lower || m.aliases?.includes(lower)
  )
  if (exact) return exact

  // 2. Fuzzy match — find the closest term within allowed edit distance
  const threshold = maxDistance(lower)
  if (threshold === 0) return undefined // too short — don't fuzz

  let bestDist = threshold + 1
  let bestIdx = -1

  for (const { term, metricIdx } of ALL_TERMS) {
    // Skip terms much longer/shorter than input — fast pre-filter
    if (Math.abs(term.length - lower.length) > threshold) continue
    const dist = levenshtein(lower, term)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = metricIdx
    }
  }

  return bestIdx >= 0 ? KNOWN_METRICS[bestIdx] : undefined
}

export function getMetricColor(key: string): string {
  return findMetric(key)?.color ?? '#636366'
}

export function getMetricEmoji(key: string): string {
  return findMetric(key)?.emoji ?? '📊'
}

export function getMetricDisplayName(key: string): string {
  const known = findMetric(key)
  if (known) return known.displayName
  return key.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function parseLogInput(raw: string): LogInputParsed | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const tokens = trimmed.toLowerCase().split(/\s+/)
  const keyTokens: string[] = []
  let value: number | null = null
  let unit: string | null = null

  for (const token of tokens) {
    // Pure number
    if (/^\d+(\.\d+)?$/.test(token)) {
      value = parseFloat(token)
      continue
    }
    // Number + unit glued (e.g. "7.5h", "142g")
    const numUnit = token.match(/^(\d+\.?\d*)([a-z]+)$/)
    if (numUnit) {
      value = parseFloat(numUnit[1])
      unit = UNIT_MAP[numUnit[2]] ?? numUnit[2]
      continue
    }
    // Standalone unit
    if (UNIT_MAP[token]) {
      unit = UNIT_MAP[token]
      continue
    }
    // Noise
    if (NOISE_WORDS.has(token)) continue
    // Key token
    keyTokens.push(token)
  }

  const rawKey = keyTokens.join(' ')
  if (!rawKey) return null

  const known = findMetric(rawKey)
  const metricKey = known?.key ?? rawKey

  if (value !== null) {
    return {
      metricKey,
      value,
      valueType: 'number',
      unit: unit ?? known?.unit,
    }
  }

  return {
    metricKey,
    value: true,
    valueType: 'boolean',
  }
}

export function formatValue(
  value: boolean | number | string,
  unit?: string,
  valueType?: string
): string {
  if (valueType === 'boolean' || typeof value === 'boolean') {
    return value ? '✓ Done' : '✗ Skipped'
  }
  if (typeof value === 'number') {
    if (unit === '/10') return `${value}/10`
    if (unit === 'k') return `${value}k steps`
    return unit ? `${value} ${unit}` : `${value}`
  }
  return String(value)
}

export function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

export function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
}

export function getLast30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().split('T')[0]
  })
}
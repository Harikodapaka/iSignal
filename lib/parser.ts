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
    {
      key: 'sleep', displayName: 'Sleep', type: 'number', unit: 'h', color: '#007aff', emoji: '🌙',
      aliases: [
        'slept', 'sleeping', 'nap', 'napped', 'napping', 'kip', 'crashed', 'snooze', 'snoozed',
        'dozed', 'doze', 'rest', 'rested', 'resting', 'bedtime', 'shut eye', 'shuteye',
        'hours sleep', 'hrs sleep', 'hours of sleep', 'night sleep', 'sleep time',
      ],
    },
    {
      key: 'workout', displayName: 'Workout', type: 'boolean', unit: undefined, color: '#30d158', emoji: '💪',
      aliases: [
        'gym', 'exercise', 'exercised', 'exercising', 'training', 'trained', 'lift', 'lifted', 'lifting',
        'leg', 'legs', 'chest', 'back', 'shoulders', 'shoulder', 'arms', 'biceps', 'triceps', 'core', 'abs',
        'worked out', 'hit gym', 'hit the gym', 'weights', 'weight training',
        'sweat', 'grind', 'hiit', 'cardio', 'circuit', 'crossfit',
        'push day', 'pull day', 'leg day', 'chest day', 'back day', 'arms day',
        'bodybuilding', 'strength', 'gainz', 'gains',
      ],
    },
    {
      key: 'protein', displayName: 'Protein', type: 'number', unit: 'g', color: '#ff9f0a', emoji: '🥩',
      aliases: [
        'proteins', 'whey', 'protein shake', 'shake', 'grams protein', 'protein intake',
        'protein count', 'daily protein', 'macros protein',
      ],
    },
    {
      key: 'mood', displayName: 'Mood', type: 'number', unit: '/10', color: '#bf5af2', emoji: '😊',
      aliases: [
        'vibe', 'vibes', 'emotions', 'emotion',
        'mental', 'mental health', 'happiness', 'happy', 'sad', 'meh', 'blah',
        'moody', 'spirits', 'mindset', 'great',
      ],
    },
    {
      key: 'water', displayName: 'Water', type: 'number', unit: 'L', color: '#40cbe0', emoji: '💧',
      aliases: [
        'hydration', 'hydrated', 'fluids', 'fluid', 'h2o', 'drank water', 'drinking water',
        'water intake', 'liters water', 'litres water', 'cups water', 'glasses water',
        'glasses of water', 'cups of water',
      ],
    },
    {
      key: 'steps', displayName: 'Steps', type: 'number', unit: 'k', color: '#ff375f', emoji: '👟',
      aliases: [
        'walked', 'walking', 'walk', 'steps taken', 'step count', 'stepcount',
        'pedometer', 'paced', 'daily steps', 'total steps',
      ],
    },
    {
      key: 'weight', displayName: 'Weight', type: 'number', unit: 'kg', color: '#ff9f0a', emoji: '⚖️',
      aliases: [
        'bodyweight', 'body weight', 'bw', 'mass', 'weighed', 'scale', 'scale weight',
        'heaviness', 'body mass', 'current weight', 'morning weight',
      ],
    },
    {
      key: 'meditation', displayName: 'Meditation', type: 'number', unit: 'min', color: '#40cbe0', emoji: '🧘',
      aliases: [
        'meditated', 'meditating', 'mindfulness', 'mindful', 'breathwork', 'breathing exercise',
        'breathing', 'breathe', 'calm', 'wim hof', 'zen', 'centered', 'grounded',
        'body scan', 'visualization', 'guided meditation',
      ],
    },
    {
      key: 'reading', displayName: 'Reading', type: 'number', unit: 'min', color: '#ffd60a', emoji: '📚',
      aliases: [
        'read', 'reads', 'books', 'book', 'reading time', 'pages', 'page',
        'studied', 'study', 'studying', 'learning', 'learned', 'literature',
        'nonfiction', 'fiction',
      ],
    },
    {
      key: 'caffeine', displayName: 'Caffeine', type: 'number', unit: 'mg', color: '#a2845e', emoji: '☕',
      aliases: [
        'coffee', 'coffees', 'espresso', 'chai', 'tea', 'teas', 'matcha', 'latte', 'lattes',
        'cappuccino', 'americano', 'cold brew', 'brew', 'green tea', 'black tea',
        'energy drink', 'red bull', 'redbull', 'monster', 'preworkout', 'pre-workout',
        'pre workout', 'pre workouts',
        'cup of coffee', 'cup of tea', 'cups of coffee',
      ],
    },
    {
      key: 'calories', displayName: 'Calories', type: 'number', unit: 'kcal', color: '#ff453a', emoji: '🍽️',
      aliases: [
        'cal', 'cals', 'kcal', 'calorie', 'caloric', 'intake', 'food intake',
        'total calories', 'daily calories', 'calorie count', 'eaten', 'consumed',
        'nutrition', 'diet', 'macros',
      ],
    },
    {
      key: 'run', displayName: 'Run', type: 'number', unit: 'km', color: '#30d158', emoji: '🏃',
      aliases: [
        'running', 'ran', 'jog', 'jogged', 'jogging', 'sprint', 'sprinted', 'sprinting',
        'treadmill', 'outdoor run', 'morning run', '5k', '10k', 'half marathon',
        'marathon', 'pace run', 'tempo run', 'easy run',
      ],
    },
    {
      key: 'energy', displayName: 'Energy', type: 'number', unit: '/10', color: '#ffd60a', emoji: '⚡',
      aliases: [
        'energized', 'energy level', 'energy levels', 'tired', 'tiredness',
        'fatigue', 'fatigued', 'exhausted', 'exhaustion', 'drained', 'sluggish',
        'lethargic', 'lethargy', 'alert', 'awake', 'wired', 'crash', 'crashed',
        'vigor', 'vitality',
      ],
    },
    {
      key: 'stress', displayName: 'Stress', type: 'number', unit: '/10', color: '#ff453a', emoji: '😰',
      aliases: [
        'anxiety', 'anxious', 'stressed', 'stressful', 'overwhelmed', 'tense',
        'tension', 'burnout', 'pressure', 'worry', 'worried', 'worrying',
        'panic', 'panicked', 'nervous', 'nervousness', 'cortisol',
      ],
    },
    {
      key: 'screen', displayName: 'Screen Time', type: 'number', unit: 'h', color: '#636366', emoji: '📱',
      aliases: [
        'screen time', 'screentime', 'phone', 'phone time', 'device time',
        'scrolling', 'scrolled', 'social media', 'doom scroll', 'doom scrolling',
        'doomscrolling', 'tv', 'television', 'netflix', 'youtube', 'instagram',
        'twitter', 'tiktok', 'online', 'browsing',
      ],
    },
    {
      key: 'alcohol', displayName: 'Alcohol', type: 'boolean', unit: undefined, color: '#ff9f0a', emoji: '🍺',
      aliases: [
        'drinks', 'drinking', 'drank', 'booze', 'boozy', 'drunk', 'tipsy', 'buzzed',
        'beer', 'beers', 'wine', 'wines', 'whiskey', 'whisky', 'vodka', 'spirits',
        'pint', 'pints', 'shots', 'shot', 'cocktail', 'cocktails', 'liquor',
        'gin', 'rum', 'tequila', 'brandy', 'champagne', 'prosecco',
      ],
    },
  ]

const UNIT_MAP: Record<string, string> = {
  // time
  h: 'h', hr: 'h', hrs: 'h', hour: 'h', hours: 'h',
  min: 'min', mins: 'min', minute: 'min', minutes: 'min',
  sec: 'sec', secs: 'sec', second: 'sec', seconds: 'sec',
  // weight / mass
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  g: 'g', grams: 'g', gram: 'g',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  // volume / liquid
  l: 'L', L: 'L', liter: 'L', liters: 'L', litre: 'L', litres: 'L',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml',
  cup: 'cup', cups: 'cup',
  glass: 'glass', glasses: 'glass',
  // distance
  km: 'km', kms: 'km', kilometer: 'km', kilometers: 'km', kilometre: 'km',
  mi: 'mi', mile: 'mi', miles: 'mi',
  m: 'm', meter: 'm', meters: 'm', metre: 'm',
  k: 'k',
  // energy
  kcal: 'kcal', cal: 'kcal', cals: 'kcal', calorie: 'kcal', calories: 'kcal',
  // other
  mg: 'mg', mcg: 'mcg',
  steps: 'steps',
  x: 'x', times: 'x', reps: 'reps', sets: 'sets',
  percent: '%', '%': '%',
}

// Words that carry no metric meaning — stripped before key matching.
// Words that carry no metric meaning — stripped before key matching.
const NOISE_WORDS = new Set([
  // articles
  'a', 'an', 'the',
  // pronouns
  'i', 'my', 'me', 'it', 'its', 'we', 'our', 'you', 'your', 'they', 'their',
  // conjunctions
  'and', 'or', 'but', 'so', 'yet', 'nor',
  // prepositions
  'at', 'in', 'on', 'to', 'of', 'by', 'for', 'up', 'as',
  'with', 'from', 'into', 'onto', 'upon', 'over', 'under', 'about',
  'around', 'after', 'before', 'during', 'through', 'without', 'within',
  'between', 'among', 'along', 'across', 'behind', 'below', 'above',
  'near', 'off', 'out', 'per', 'since', 'than', 'until', 'via',
  // filler verbs
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did',
  'have', 'has', 'had',
  'get', 'got', 'gotten',
  'go', 'went', 'gone',
  'put', 'place', 'take', 'took', 'make', 'made', 'keep', 'kept',
  'try', 'tried', 'need', 'want', 'let', 'like',
  'doing', 'going', 'coming',
  // qualifiers & adverbs
  'very', 'really', 'quite', 'just', 'only', 'too', 'so',
  'super', 'pretty', 'kinda', 'sorta', 'barely', 'almost', 'nearly',
  'slightly', 'totally', 'absolutely', 'extremely', 'incredibly',
  // descriptors — never identify a metric on their own
  'good', 'bad', 'okay', 'ok', 'fine', 'well', 'nice',
  'amazing', 'awesome', 'terrible', 'horrible', 'decent', 'solid',
  'intense', 'hard', 'easy', 'quick', 'slow', 'fast', 'long', 'short',
  'heavy', 'light', 'big', 'small', 'high', 'low', 'full', 'empty',
  // completion words
  'done', 'finished', 'finish', 'completed', 'complete',
  'started', 'start', 'beginning', 'ended', 'end',
  // quantity words
  'some', 'any', 'all', 'few', 'many', 'much', 'more', 'less',
  'bit', 'little', 'lot', 'lots', 'enough', 'half', 'whole',
  'couple', 'several', 'multiple', 'bunch',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  // time words
  'today', 'tonight', 'yesterday', 'tomorrow',
  'now', 'later', 'soon', 'already', 'still', 'again',
  'this', 'last', 'next', 'past', 'current',
  'morning', 'afternoon', 'evening', 'night', 'midnight', 'noon',
  'early', 'late', 'daily', 'weekly', 'monthly',
  // filler nouns — wrap activities but are not metrics themselves
  'session', 'sessions', 'practice', 'routine', 'time', 'times',
  'thing', 'stuff', 'count', 'level', 'levels', 'amount', 'total',
  'number', 'value', 'effort', 'day', 'days', 'week', 'weeks',
  // 'feeling' is always filler — the word AFTER it is the real signal
  // e.g. 'feeling anxious' → anxious=stress, 'feeling exhausted' → exhausted=energy
  'feel', 'felt', 'feeling', 'feelings', 'feels',
  // misc
  'seems', 'seemed', 'actually', 'basically', 'honestly', 'literally',
  'probably', 'maybe', 'perhaps', 'sure', 'yes', 'no', 'not',
])


// ── Levenshtein edit distance ─────────────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  if (Math.abs(m - n) > 3) return 99

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

function maxDistance(word: string): number {
  if (word.length <= 3) return 0
  if (word.length <= 5) return 1
  if (word.length <= 8) return 2
  return 2
}

// Flat lookup table: every key + alias → metric index
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

  // 1. Exact match
  const exact = KNOWN_METRICS.find(
    (m) => m.key === lower || m.aliases?.includes(lower)
  )
  if (exact) return exact

  // 2. Fuzzy match
  const threshold = maxDistance(lower)
  if (threshold === 0) return undefined

  let bestDist = threshold + 1
  let bestIdx = -1

  for (const { term, metricIdx } of ALL_TERMS) {
    if (Math.abs(term.length - lower.length) > threshold) continue
    const dist = levenshtein(lower, term)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = metricIdx
    }
  }

  return bestIdx >= 0 ? KNOWN_METRICS[bestIdx] : undefined
}

// ── Smart token picker ────────────────────────────────────────────────────────
// Collects ALL candidate matches across every token and pair, scores them,
// then returns the highest-confidence match.
//
// Scoring prevents "drank coffee" → alcohol by ensuring "coffee" (noun, exact
// alias for caffeine) beats "drank" (action verb, alias for alcohol).
//
// Score:
//   exact key match   = 3
//   exact alias match = 2
//   fuzzy match       = 1
//   pair match        = +0.5 bonus
//   action verb token = -0.5 penalty

const VERB_TOKENS = new Set([
  'drank', 'ate', 'had', 'did', 'went', 'ran', 'walked', 'jogged', 'cycled',
  'swam', 'hiked', 'lifted', 'exercised', 'trained', 'stretched', 'worked',
  'slept', 'napped', 'rested', 'felt', 'logged', 'tracked', 'completed',
  'finished', 'done', 'started', 'stopped', 'took', 'made', 'built',
  'created', 'read', 'wrote', 'studied', 'learned', 'practiced',
  'meditated', 'breathed', 'relaxed', 'cleaned', 'organized',
  'cooked', 'bought', 'ordered', 'met', 'called', 'messaged',
  'planned', 'reviewed', 'reflected', 'journaled', 'traveled',
  'drove', 'commuted', 'workedout', 'fasted', 'played', 'performed', 'sang', 'danced', 'coded'])

type Metric = NonNullable<ReturnType<typeof findMetric>>

function scoreMatch(token: string, metric: Metric, isPair: boolean): number {
  const lower = token.toLowerCase()
  let score = 0
  if (metric.key === lower) score = 3  // exact key hit
  else if (metric.aliases?.includes(lower)) score = 2  // exact alias hit
  else score = 1  // fuzzy hit
  if (isPair) score += 0.5  // longer match = more specific
  if (VERB_TOKENS.has(lower)) score -= 0.5  // action verbs are weaker signals
  return score
}

function pickMetricKey(keyTokens: string[]): { key: string; metric: ReturnType<typeof findMetric> } {
  const candidates: { key: string; metric: Metric; score: number }[] = []

  // Score every single token
  for (const token of keyTokens) {
    const m = findMetric(token)
    if (m) candidates.push({ key: m.key, metric: m, score: scoreMatch(token, m, false) })
  }

  // Score adjacent pairs (handles "screen time", "worked out", etc.)
  for (let i = 0; i < keyTokens.length - 1; i++) {
    const pair = `${keyTokens[i]} ${keyTokens[i + 1]}`
    const m = findMetric(pair)
    if (m) candidates.push({ key: m.key, metric: m, score: scoreMatch(pair, m, true) })
  }

  // Pick highest scoring candidate
  if (candidates.length > 0) {
    const best = candidates.reduce((a, b) => b.score > a.score ? b : a)
    return { key: best.key, metric: best.metric }
  }

  // No match — join all tokens, let AI handle it later
  const compound = keyTokens.join(' ')
  return { key: compound, metric: findMetric(compound) }
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
    // Noise — drop it
    if (NOISE_WORDS.has(token)) continue
    // Key token — keep
    keyTokens.push(token)
  }

  if (!keyTokens.length) return null

  // Smart pick: scan tokens individually and in pairs before joining
  const { key: metricKey, metric: known } = pickMetricKey(keyTokens)

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
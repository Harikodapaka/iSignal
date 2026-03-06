import { cache } from './cache'
import MetricModel from '@/models/Metric'
import { connectDB } from './mongodb'

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`

// ── Core Gemini caller ────────────────────────────────────────────────────────
async function gemini(prompt: string, maxTokens = 150): Promise<string> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens },
      }),
    })

    clearTimeout(timeout)
    if (!res.ok) { console.error(`Gemini API error: ${res.status}`); return '' }

    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  } catch (err) {
    console.error('Gemini call failed:', err)
    return ''
  }
}

function parseJSON<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim()) as T
  } catch {
    return fallback
  }
}

// ── Metric keys helper ────────────────────────────────────────────────────────
// Shared by both AI functions that need the user's known metric keys.
// Cache-first: MongoDB only on miss. TTL 5 min, invalidated on new metric creation.

export async function getUserMetricKeys(userId: string): Promise<string[]> {
  // 1. Try cache
  const cached = await cache.getMetricKeys(userId)
  if (cached) {
    console.debug(`[cache hit] metrics:keys:${userId} (${cached.length} keys)`)
    return cached
  }

  // 2. Cache miss — fetch from DB
  await connectDB()
  const metrics = await MetricModel
    .find({ userId }, { metricKey: 1, _id: 0 })
    .lean()
  const keys = metrics.map((m) => m.metricKey)

  // 3. Populate cache for next call
  await cache.setMetricKeys(userId, keys)
  console.debug(`[cache miss] metrics:keys:${userId} — fetched ${keys.length} keys from DB`)

  return keys
}

// ── 1. Alias Resolution ───────────────────────────────────────────────────────
// Called when a token wasn't recognized by the parser or fuzzy matcher.
// existingMetrics is the user's known keys — the grounding Gemini needs.

export async function aiResolveAlias(
  rawKey: string,
  existingMetrics: string[]
): Promise<{ match: string | null; confidence: number }> {
  if (!existingMetrics.length) return { match: null, confidence: 0 }

  const text = await gemini(
    `You are a health tracking assistant.
User typed: "${rawKey}"
Existing metric keys: ${JSON.stringify(existingMetrics)}

Does the user input map to one of the existing keys?
Respond ONLY with JSON, no markdown:
{ "match": "existing_key_or_null", "confidence": 0.0 }

Rules:
- Only match if semantically clear
- Return null if genuinely a new concept
- confidence >= 0.85 means auto-apply`,
    80
  )

  return parseJSON(text, { match: null, confidence: 0 })
}

// ── 2. Natural Language Extraction ───────────────────────────────────────────
// Called when the tokenizer produces an unrecognised key from a sentence.
// Uses the same cached metric keys as alias resolution — no extra DB hit.

export async function aiExtractMetrics(
  raw: string,
  userId: string
): Promise<{ metricKey: string; value: number | null; unit: string | null; confidence: number }[]> {
  // Fetch user's known keys from cache (or DB on miss) — this is the grounding
  const existingMetrics = await getUserMetricKeys(userId)

  const text = await gemini(
    `Extract health metrics from this natural language input.
Input: "${raw}"
Known metric keys: ${JSON.stringify(existingMetrics)}

Rules:
- Prefer matching to a known key over inventing a new one
- Only extract items you are confident about (confidence > 0.6)
- For boolean metrics (workout, alcohol) set value to 1
- Match typos and alternate phrasings to known keys where obvious

Respond ONLY with a JSON array, no markdown:
[{ "metricKey": "string", "value": null_or_number, "unit": null_or_string, "confidence": 0.0 }]`,
    200
  )

  return parseJSON(text, [])
}

// ── 3. Context Extraction ─────────────────────────────────────────────────────
// Annotates a saved event with sentiment + tags. Never corrects the metricKey.

export async function aiExtractContext(
  raw: string,
  metricKey: string
): Promise<{ sentiment: string; tags: string[]; note: string | null }> {
  const text = await gemini(
    `User logged "${metricKey}" with this note: "${raw}"
Extract sentiment and relevant tags.
Respond ONLY with JSON, no markdown:
{ "sentiment": "positive|negative|neutral", "tags": ["max 3 short tags"], "note": "brief note or null" }`,
    100
  )

  return parseJSON(text, { sentiment: 'neutral', tags: [], note: null })
}

// ── 4. Anomaly Detection ──────────────────────────────────────────────────────

export async function aiDetectAnomaly(
  metricKey: string,
  todayValue: number,
  recentValues: number[]
): Promise<{ anomaly: boolean; severity: string; message: string }> {
  if (recentValues.length < 5) return { anomaly: false, severity: 'none', message: '' }

  const avg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length
  const diff = Math.abs(todayValue - avg)

  // Skip AI if obviously normal — save rate limit
  if (diff < avg * 0.25) return { anomaly: false, severity: 'none', message: '' }

  const text = await gemini(
    `Metric: ${metricKey}
Recent values (14 days): ${JSON.stringify(recentValues)}
Today: ${todayValue}
14-day average: ${avg.toFixed(1)}

Is today's value anomalous?
Respond ONLY with JSON, no markdown:
{ "anomaly": true_or_false, "severity": "low|medium|high", "message": "one short sentence" }`,
    80
  )

  return parseJSON(text, { anomaly: false, severity: 'none', message: '' })
}

// ── 5. Correlation Engine ─────────────────────────────────────────────────────

export async function aiCorrelations(
  events: { metricKey: string; value: number; date: string }[]
): Promise<{ metricA: string; metricB: string; direction: string; strength: string; insight: string }[]> {
  if (events.length < 20) return []

  const text = await gemini(
    `Analyze 30 days of health tracking data and find meaningful correlations.
Data: ${JSON.stringify(events.slice(0, 200))}

Respond ONLY with JSON array, no markdown:
[{ "metricA": "string", "metricB": "string", "direction": "positive|negative", "strength": "weak|moderate|strong", "insight": "one sentence" }]

Return max 3 strongest correlations only.`,
    400
  )

  return parseJSON(text, [])
}

// ── 6. Weekly Summary ─────────────────────────────────────────────────────────

export async function aiWeeklySummary(weeklyData: object): Promise<{
  headline: string
  highlights: string[]
  oneThingToImprove: string
  encouragement: string
} | null> {
  const text = await gemini(
    `You are a warm personal health coach. Write a brief weekly summary.
Be specific, encouraging, and actionable. Avoid generic advice.
Data: ${JSON.stringify(weeklyData)}

Respond ONLY with JSON, no markdown:
{
  "headline": "punchy one-liner summarizing the week",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "oneThingToImprove": "one specific, actionable suggestion",
  "encouragement": "one warm, personal sentence"
}`,
    350
  )

  return parseJSON(text, null)
}
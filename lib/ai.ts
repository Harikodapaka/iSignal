import { cache } from './cache';
import MetricModel from '@/models/Metric';
import { connectDB } from './mongodb';

// ── Gemini rate limit ─────────────────────────────────────────────────────────
// Free tier: 15 RPM. We cap at 10/min per user to stay safe.
// Uses the same token-bucket cache as the events rate limiter.
const AI_MAX_RPM = 500; // Gemini 2.0 Flash free tier: 1500 RPM — we cap at 500 to stay safe

async function checkAIRateLimit(userId: string): Promise<boolean> {
  const rl = await cache.checkRateLimit(userId, 'groq', AI_MAX_RPM, 60);
  if (!rl.allowed) {
    console.warn(`[AI] rate limit hit for ${userId} — ${AI_MAX_RPM} calls/min exceeded`);
  }
  return rl.allowed;
}

// ── Result cache ──────────────────────────────────────────────────────────────
// Identical inputs produce identical outputs — cache by a hash of the prompt.
// TTL: 1 hour. Prevents duplicate calls for the same typo/sentence.

function hashKey(prefix: string, input: string): string {
  // Simple djb2 hash — no crypto needed, just needs to be collision-resistant enough
  let h = 5381;
  const s = prefix + '|' + input;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return `ai:${(h >>> 0).toString(36)}`;
}

async function cachedGeminiCall<T>(
  cacheKey: string,
  fn: () => Promise<T>,
  userId: string,
  ttl = 3600
): Promise<T | null> {
  // Check result cache first — skip Gemini entirely if we've seen this before
  const cached = await cache.get<T>(cacheKey);
  if (cached !== null) {
    console.log(`[AI] cache hit: ${cacheKey}`);
    return cached;
  }

  // Check rate limit before calling Gemini
  const allowed = await checkAIRateLimit(userId);
  if (!allowed) return null;

  const result = await fn();
  if (result !== null && result !== undefined) {
    await cache.set(cacheKey, result, ttl);
  }
  return result;
}

// ── Groq caller (OpenAI-compatible) ──────────────────────────────────────────
// Model: llama-3.1-8b-instant — 14,400 req/day free, no region restrictions.
// Docs: https://console.groq.com/docs/rate-limits

const GROQ_MODEL = 'llama-3.1-8b-instant';

async function groq(prompt: string, maxTokens = 150, retryCount = 1): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.error('[AI] GROQ_API_KEY is not set');
    return '';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: maxTokens,
      }),
    });

    clearTimeout(timeout);

    if (res.status === 429) {
      if (retryCount > 0) {
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '2', 10);
        console.warn(`[AI] Groq 429 — waiting ${retryAfter}s then retrying once`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        return groq(prompt, maxTokens, 0);
      }
      console.error('[AI] Groq 429 — retry exhausted, giving up');
      return '';
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[AI] Groq HTTP ${res.status}:`, body.slice(0, 200));
      return '';
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    console.log(`[AI] Groq ok (${text.length} chars):`, text.slice(0, 100));
    return text;
  } catch (err) {
    clearTimeout(timeout);
    console.error('[AI] Groq call failed:', err);
    return '';
  }
}

function parseJSON<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim()) as T;
  } catch {
    console.error('[AI] JSON parse failed for:', text.slice(0, 100));
    return fallback;
  }
}

// ── Metric keys helper ────────────────────────────────────────────────────────
export async function getUserMetricKeys(userId: string): Promise<string[]> {
  const cached = await cache.getMetricKeys(userId);
  if (cached) {
    console.log(`[AI] metric keys cache hit (${cached.length} keys)`);
    return cached;
  }

  await connectDB();
  const metrics = await MetricModel.find({ userId }, { metricKey: 1, _id: 0 }).lean();
  const keys = metrics.map((m) => m.metricKey);

  await cache.setMetricKeys(userId, keys);
  console.log(`[AI] metric keys loaded from DB: ${keys.length}`);
  return keys;
}

// ── 1. Alias Resolution ───────────────────────────────────────────────────────
export async function aiResolveAlias(
  rawKey: string,
  existingMetrics: string[],
  userId: string
): Promise<{ match: string | null; confidence: number }> {
  if (!existingMetrics.length) return { match: null, confidence: 0 };

  // Filter out the input itself — we only want to map to a DIFFERENT canonical key
  const candidates = existingMetrics.filter((k) => k !== rawKey);
  if (!candidates.length) return { match: null, confidence: 0 };

  const ck = hashKey('alias', rawKey + candidates.sort().join(','));
  const result = await cachedGeminiCall(
    ck,
    async () => {
      console.log(`[AI] aiResolveAlias: "${rawKey}" against [${candidates.join(', ')}]`);
      const text = await groq(
        `You are a health tracking assistant helping map user input to canonical metric keys.

User input: "${rawKey}"
Canonical metric keys to choose from: ${JSON.stringify(candidates)}

Task: Does the user input clearly refer to one of the canonical keys above?
- "chai" → "caffeine" ✓ (chai is a caffeinated drink)
- "booze" → "alcohol" ✓ (booze means alcohol)
- "deepwork" → null ✓ (genuinely new concept, not in the list)
- "run" → "steps" ✗ (related but not the same metric)

Respond ONLY with JSON, no markdown, no explanation:
{ "match": "canonical_key_or_null", "confidence": 0.0 }

If unsure, return null. Only match when semantically clear and direct.`,
        80
      );
      const parsed = parseJSON(text, { match: null as string | null, confidence: 0 });
      // Hard guard: reject if model hallucinated the input key back
      if (parsed.match === rawKey) {
        console.warn(`[AI] aiResolveAlias: model returned input as match — rejecting`);
        return { match: null, confidence: 0 };
      }
      // Reject if match isn't actually in our candidates list
      if (parsed.match && !candidates.includes(parsed.match)) {
        console.warn(`[AI] aiResolveAlias: model returned "${parsed.match}" not in candidates — rejecting`);
        return { match: null, confidence: 0 };
      }
      return parsed;
    },
    userId,
    3600
  );

  return result ?? { match: null, confidence: 0 };
}

// ── 2. Natural Language Extraction ───────────────────────────────────────────
export async function aiExtractMetrics(
  raw: string,
  userId: string
): Promise<{ metricKey: string; value: number | null; unit: string | null; confidence: number }[]> {
  const existingMetrics = await getUserMetricKeys(userId);

  const ck = hashKey('extract_v3', raw);
  const result = await cachedGeminiCall(
    ck,
    async () => {
      console.log(`[AI] aiExtractMetrics: "${raw}"`);
      const text = await groq(
        `You are extracting a health/lifestyle metric from a user's log entry.

User input: "${raw}"
Known metric keys (you MUST pick from this list): ${JSON.stringify(existingMetrics)}

Rules:
- Correct any spelling mistakes in the input before interpreting it (e.g. "slep" → "sleep", "meeditation" → "meditation", "wter" → "water")
- metricKey MUST be one of the known keys above — never invent a new key
- Match semantically — consider typos, abbreviations, slang, and indirect phrasing
- Extract only the single best matching metric
- value: the numeric value if explicitly mentioned, OR infer from sentiment for scored metrics (/10 scale): "awesome"/"amazing" → 9, "good" → 7, "okay" → 5, "bad"/"terrible" → 3
- unit: the unit if mentioned, otherwise null
- If nothing maps to a known key with confidence > 0.7, return an empty array []

Examples:
  input: "put chai for 5 mins", keys: ["caffeine","meditation","sleep"]
  → [{ "metricKey": "caffeine", "value": null, "unit": null, "confidence": 0.75 }]

  input: "had booze with friends", keys: ["alcohol","sleep","workout"]
  → [{ "metricKey": "alcohol", "value": 1, "unit": null, "confidence": 0.95 }]

  input: "feeling awesome", keys: ["mood","sleep","workout"]
  → [{ "metricKey": "mood", "value": 9, "unit": null, "confidence": 0.95 }]

  input: "slept 7 hrs", keys: ["sleep","workout","mood"]
  → [{ "metricKey": "sleep", "value": 7, "unit": "h", "confidence": 0.99 }]

  input: "wter 2L", keys: ["water","sleep","mood"]
  → [{ "metricKey": "water", "value": 2, "unit": "L", "confidence": 0.95 }]

  input: "random gibberish xyz", keys: ["sleep","workout"]
  → []

Respond ONLY with a JSON array, no markdown, no explanation:
[{ "metricKey": "known_key", "value": null_or_number, "unit": null_or_string, "confidence": 0.0 }]`,
        150
      );
      const parsed = parseJSON<{ metricKey: string; value: number | null; unit: string | null; confidence: number }[]>(
        text,
        []
      );
      // Hard guard: only keep results where metricKey is actually in the known list
      const valid = parsed.filter((r) => existingMetrics.includes(r.metricKey));
      if (valid.length !== parsed.length) {
        console.warn(`[AI] aiExtractMetrics: dropped ${parsed.length - valid.length} hallucinated keys`);
      }
      return valid;
    },
    userId,
    1800 // extraction results good for 30 min
  );

  return result ?? [];
}

// ── 3. Context Extraction ─────────────────────────────────────────────────────
// Only called for genuinely ambiguous or long-form inputs.
// Skip entirely for known metrics with short inputs — not worth the API call.

export async function aiExtractContext(
  raw: string,
  metricKey: string,
  userId: string
): Promise<{ sentiment: string; tags: string[]; note: string | null }> {
  const fallback = { sentiment: 'neutral', tags: [] as string[], note: null };

  const ck = hashKey('ctx', raw + metricKey);
  const result = await cachedGeminiCall(
    ck,
    async () => {
      console.log(`[AI] aiExtractContext: "${metricKey}"`);
      const text = await groq(
        `User logged "${metricKey}" with this note: "${raw}"
Extract sentiment and relevant tags.
Respond ONLY with JSON, no markdown:
{ "sentiment": "positive|negative|neutral", "tags": ["max 3 short tags"], "note": "brief note or null" }`,
        100
      );
      return parseJSON(text, fallback);
    },
    userId,
    3600
  );

  return result ?? fallback;
}

// ── 4. Anomaly Detection ──────────────────────────────────────────────────────
export async function aiDetectAnomaly(
  metricKey: string,
  todayValue: number,
  recentValues: number[],
  userId: string
): Promise<{ anomaly: boolean; severity: string; message: string }> {
  const fallback = { anomaly: false, severity: 'none', message: '' };
  if (recentValues.length < 5) return fallback;

  const avg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  if (Math.abs(todayValue - avg) < avg * 0.25) return fallback;

  const ck = hashKey('anomaly', metricKey + todayValue + recentValues.slice(-7).join(','));
  const result = await cachedGeminiCall(
    ck,
    async () => {
      const text = await groq(
        `Metric: ${metricKey}
Recent values (14 days): ${JSON.stringify(recentValues)}
Today: ${todayValue}, 14-day average: ${avg.toFixed(1)}

Is today's value anomalous?
Respond ONLY with JSON, no markdown:
{ "anomaly": true_or_false, "severity": "low|medium|high", "message": "one short sentence" }`,
        80
      );
      return parseJSON(text, fallback);
    },
    userId,
    3600
  );

  return result ?? fallback;
}

// ── 5. Correlation Engine ─────────────────────────────────────────────────────
export async function aiCorrelations(
  events: { metricKey: string; value: number; date: string }[],
  userId: string
): Promise<{ metricA: string; metricB: string; direction: string; strength: string; insight: string }[]> {
  if (events.length < 20) return [];

  const ck = hashKey('corr', userId + events.length + events[events.length - 1]?.date);
  const result = await cachedGeminiCall(
    ck,
    async () => {
      const text = await groq(
        `Analyze 30 days of health tracking data and find meaningful correlations.
Data: ${JSON.stringify(events.slice(0, 200))}

Respond ONLY with JSON array, no markdown:
[{ "metricA": "string", "metricB": "string", "direction": "positive|negative", "strength": "weak|moderate|strong", "insight": "one sentence" }]

Return max 3 strongest correlations only.`,
        400
      );
      return parseJSON(text, []);
    },
    userId,
    1800
  );

  return result ?? [];
}

// ── 6. Weekly Summary ─────────────────────────────────────────────────────────
export async function aiWeeklySummary(
  weeklyData: object,
  userId: string
): Promise<{
  headline: string;
  highlights: string[];
  oneThingToImprove: string;
  encouragement: string;
} | null> {
  const ck = hashKey('summary', userId + new Date().toISOString().slice(0, 10));
  const result = await cachedGeminiCall(
    ck,
    async () => {
      const text = await groq(
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
      );
      return parseJSON(text, null);
    },
    userId,
    3600 // one summary per day is enough
  );

  return result ?? null;
}

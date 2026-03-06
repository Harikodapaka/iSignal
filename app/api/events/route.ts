import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import { cache } from '@/lib/cache'
import { parseLogInput, getMetricDisplayName, getTodayString, findMetric, KNOWN_METRICS } from '@/lib/parser'
import { aiResolveAlias, aiExtractMetrics, aiExtractContext, getUserMetricKeys } from '@/lib/ai'
import EventModel from '@/models/Event'
import MetricModel from '@/models/Metric'
import AliasModel from '@/models/Alias'
import PendingAliasModel from '@/models/PendingAlias'
import type { ApiResponse, IEvent } from '@/types'

const LogSchema = z.object({
  rawText: z.string().min(1, 'Cannot be empty').max(200, 'Too long').trim(),
})

// ── GET /api/events?date=YYYY-MM-DD ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' }, { status: 401 }
      )
    }

    await connectDB()
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') ?? getTodayString()

    const events = await EventModel
      .find({ userId: session.user.id, date })
      .sort({ timestamp: -1 })
      .maxTimeMS(5000)
      .lean()

    return NextResponse.json<ApiResponse<IEvent[]>>({ success: true, data: events as IEvent[] })
  } catch (err) {
    console.error('GET /api/events error:', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to fetch events' }, { status: 500 }
    )
  }
}

// ── POST /api/events ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' }, { status: 401 }
      )
    }

    const userId = session.user.id

    // Rate limit: 60 logs per minute
    const rl = await cache.checkRateLimit(userId, 'events', 60, 60)
    if (!rl.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Too many requests. Slow down.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid JSON' }, { status: 400 }
      )
    }

    const validated = LogSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: validated.error.errors[0].message }, { status: 400 }
      )
    }

    const { rawText } = validated.data
    await connectDB()

    // ── Parse input ───────────────────────────────────────────────────────────
    const parsed = parseLogInput(rawText)
    if (!parsed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Could not parse input' }, { status: 400 }
      )
    }

    // ── Fast path alias resolution (cache → DB, no AI blocking) ──────────────
    const aliasCacheKey = `alias:${userId}:${parsed.metricKey}`
    let resolvedKey = parsed.metricKey

    const cachedAlias = await cache.get<string>(aliasCacheKey)
    if (cachedAlias) {
      resolvedKey = cachedAlias
    } else {
      const alias = await AliasModel.findOne({
        rawKey: parsed.metricKey,
        $or: [{ userId }, { userId: null }],
      })
        .sort({ userId: -1 })
        .lean()

      if (alias?.canonicalKey) {
        resolvedKey = alias.canonicalKey
        await cache.set(aliasCacheKey, resolvedKey, 3600)
        await AliasModel.updateOne({ _id: alias._id }, { $inc: { usageCount: 1 } })
      }
    }

    // ── Save event immediately — never block on AI ────────────────────────────
    const now = new Date()
    const event = await EventModel.create({
      userId,
      timestamp: now.toISOString(),
      date: getTodayString(),
      rawText,
      metricKey: resolvedKey,
      value: parsed.value,
      valueType: parsed.valueType,
      unit: parsed.unit,
    })

    // ── Upsert metric + increment frequency ───────────────────────────────────
    const known = findMetric(resolvedKey)
    const isNewMetric = !(await MetricModel.exists({ userId, metricKey: resolvedKey }))

    await MetricModel.findOneAndUpdate(
      { userId, metricKey: resolvedKey },
      {
        $setOnInsert: {
          displayName: known?.displayName ?? getMetricDisplayName(resolvedKey),
          valueType: parsed.valueType,
          unit: parsed.unit,
          pinned: false,
        },
        $inc: { frequencyScore: 1 },
      },
      { upsert: true, new: true }
    )

    // Auto-pin at frequency 3
    await MetricModel.findOneAndUpdate(
      { userId, metricKey: resolvedKey, frequencyScore: { $gte: 3 }, pinned: false },
      { $set: { pinned: true } }
    )

    // ── Invalidate caches ─────────────────────────────────────────────────────
    await cache.del(`analytics:${userId}:${resolvedKey}`)
    await cache.del(`metrics:pinned:${userId}`)

    // If this is a brand-new metric key, the cached keys list is stale
    if (isNewMetric) {
      await cache.invalidateMetricKeys(userId)
    }

    // ── Background AI — fire-and-forget, never blocking ───────────────────────

    const isSentence = rawText.trim().split(/\s+/).length > 3
    const isUnknown = !known && !cachedAlias

    if (isSentence) {
      // Sentence input: attempt full metric extraction, then context annotation
      triggerMetricExtraction(String(event._id), rawText, resolvedKey, userId).catch(() => { })
    } else if (isUnknown) {
      // Short but unrecognised token: attempt alias resolution only
      triggerAIResolution(parsed.metricKey, userId).catch(() => { })
    }

    return NextResponse.json<ApiResponse<IEvent>>(
      { success: true, data: event.toObject() as IEvent },
      { status: 201 }
    )
  } catch (err) {
    console.error('POST /api/events error:', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to create event' }, { status: 500 }
    )
  }
}

// ── triggerAIResolution ───────────────────────────────────────────────────────
// For short unknown tokens (e.g. "deepwork", "nap").
// Uses cache-first getUserMetricKeys — no DB query if keys are warm.

async function triggerAIResolution(rawKey: string, userId: string) {
  const existingKeys = await getUserMetricKeys(userId)
  if (!existingKeys.length) return

  const result = await aiResolveAlias(rawKey, existingKeys)
  if (!result.match) return

  if (result.confidence >= 0.85) {
    // High confidence — auto-create alias, no user prompt needed
    await AliasModel.findOneAndUpdate(
      { rawKey: rawKey.toLowerCase(), userId: null },
      { canonicalKey: result.match, createdBy: 'ai', confidence: result.confidence },
      { upsert: true }
    )
  } else if (result.confidence >= 0.5) {
    // Medium confidence — queue for user confirmation ("did you mean X?")
    await PendingAliasModel.findOneAndUpdate(
      { rawKey, userId, status: 'pending' },
      { suggestedKey: result.match, confidence: result.confidence, status: 'pending' },
      { upsert: true }
    )
  }
  // < 0.5 — genuinely new concept, do nothing
}

// ── triggerMetricExtraction ───────────────────────────────────────────────────
// For sentence inputs (e.g. "I went to bed and sleept 7h").
// Step 1: ask Gemini to extract the correct metricKey + value from the sentence.
// Step 2: if Gemini finds a better key, patch the saved event + metric.
// Step 3: also extract sentiment/tags regardless.

async function triggerMetricExtraction(
  eventId: string,
  rawText: string,
  currentMetricKey: string,
  userId: string,
) {
  // Step 1 — AI metric extraction (uses cached keys internally)
  const extracted = await aiExtractMetrics(rawText, userId)

  if (extracted.length > 0) {
    const best = extracted.reduce((a, b) => a.confidence > b.confidence ? a : b)

    // Only patch if Gemini is confident and found a different/better key
    if (best.confidence >= 0.7 && best.metricKey !== currentMetricKey) {
      const known = KNOWN_METRICS.find(m => m.key === best.metricKey)

      // Patch the event
      await EventModel.findByIdAndUpdate(eventId, {
        $set: {
          metricKey: best.metricKey,
          ...(best.value !== null ? { value: best.value } : {}),
          ...(best.unit !== null ? { unit: best.unit } : {}),
        },
      })

      // Ensure the corrected metric exists
      await MetricModel.findOneAndUpdate(
        { userId, metricKey: best.metricKey },
        {
          $setOnInsert: {
            displayName: known?.displayName ?? getMetricDisplayName(best.metricKey),
            valueType: best.value !== null ? 'number' : 'boolean',
            unit: best.unit,
            pinned: false,
          },
          $inc: { frequencyScore: 1 },
        },
        { upsert: true, new: true }
      )

      // Cache the alias so the next typo resolves instantly without AI
      await AliasModel.findOneAndUpdate(
        { rawKey: currentMetricKey.toLowerCase(), userId: null },
        { canonicalKey: best.metricKey, createdBy: 'ai', confidence: best.confidence },
        { upsert: true }
      )

      // Invalidate keys cache — we may have added a new metric
      await cache.invalidateMetricKeys(userId)
    }
  }

  // Step 2 — Context annotation (sentiment + tags) regardless of key correction
  const ctx = await aiExtractContext(rawText, currentMetricKey)
  if (ctx.sentiment !== 'neutral' || ctx.tags.length || ctx.note) {
    await EventModel.findByIdAndUpdate(eventId, {
      $set: { sentiment: ctx.sentiment, tags: ctx.tags, note: ctx.note },
    })
  }
}
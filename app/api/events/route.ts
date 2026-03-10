import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import { cache } from '@/lib/cache';
import { parseLogInput, getMetricDisplayName, findMetric, KNOWN_METRICS } from '@/lib/parser';
import { toLocalDateString, parseTzParam } from '@/lib/timezone';
import { aiResolveAlias, aiExtractMetrics, getUserMetricKeys } from '@/lib/ai';
import EventModel from '@/models/Event';
import MetricModel from '@/models/Metric';
import AliasModel from '@/models/Alias';
import PendingAliasModel from '@/models/PendingAlias';
import type { ApiResponse, IEvent } from '@/types';

const LogSchema = z.object({
  rawText: z.string().min(1, 'Cannot be empty').max(200, 'Too long').trim(),
  tz: z.string().max(50).optional(),
});

// ── GET /api/events?date=YYYY-MM-DD ──────────────────────────────────────────
// Infer the best aggregation type for a user-created metric.
// Known metrics have it set explicitly; this covers anything logged on the fly.
function inferAggregation(valueType: string, unit?: string | null): 'sum' | 'avg' | 'last' {
  if (valueType === 'boolean') return 'last';
  if (!unit) return 'avg'; // no unit → likely a score
  if (unit === '/10') return 'avg'; // explicit score scale
  return 'sum'; // has a real unit (min, km, g, L, mg, etc.) → additive
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { searchParams } = new URL(req.url);
    const tz = parseTzParam(searchParams);
    const date = searchParams.get('date') ?? toLocalDateString(tz);

    const events = await EventModel.find({ userId: session.user.id, date })
      .sort({ timestamp: -1 })
      .maxTimeMS(5000)
      .lean();

    return NextResponse.json<ApiResponse<IEvent[]>>({ success: true, data: events as unknown as IEvent[] });
  } catch (err) {
    console.error('GET /api/events error:', err);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to fetch events' }, { status: 500 });
  }
}

// ── POST /api/events ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const rl = await cache.checkRateLimit(userId, 'events', 60, 60);
    if (!rl.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Too many requests. Slow down.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const validated = LogSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { rawText, tz } = validated.data;
    await connectDB();

    // Load user metric keys first so parser can match user-created metrics
    // (e.g. "watched jurassic park movie" → "watched movie")
    const userMetricKeys = await getUserMetricKeys(userId);
    const parsed = parseLogInput(rawText, userMetricKeys);

    // Parser returns null when all tokens are noise words (e.g. "feeling awesome").
    // For multi-word inputs, save a temporary event and let AI extract the real metric.
    // For single words, reject — there's genuinely nothing to log.
    if (!parsed) {
      const words = rawText.trim().split(/\s+/);
      if (words.length < 2) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Could not parse input' },
          { status: 400 }
        );
      }
      // Multi-word: save as unknown and let AI figure it out
      const tempEvent = await EventModel.create({
        userId,
        timestamp: new Date().toISOString(),
        date: toLocalDateString(tz),
        rawText,
        metricKey: '__unknown__',
        value: true,
        valueType: 'boolean',
        unit: null,
      });
      triggerMetricExtraction(String(tempEvent._id), rawText, '__unknown__', userId).catch((err) =>
        console.error('[events] triggerMetricExtraction failed:', err)
      );
      return NextResponse.json<ApiResponse<{ id: string }>>({ success: true, data: { id: String(tempEvent._id) } });
    }

    // ── Fast path alias resolution (cache → DB, no AI) ────────────────────────
    const aliasCacheKey = `alias:${userId}:${parsed.metricKey}`;
    let resolvedKey = parsed.metricKey;

    const cachedAlias = await cache.get<string>(aliasCacheKey);
    if (cachedAlias) {
      resolvedKey = cachedAlias;
    } else {
      const alias = await AliasModel.findOne({
        rawKey: parsed.metricKey,
        $or: [{ userId }, { userId: null }],
      })
        .sort({ userId: -1 })
        .lean();

      if (alias?.canonicalKey) {
        resolvedKey = alias.canonicalKey;
        await cache.set(aliasCacheKey, resolvedKey, 3600);
        await AliasModel.updateOne({ _id: alias._id }, { $inc: { usageCount: 1 } });
      }
    }

    // ── Resolve unit: typed > KNOWN_METRICS > existing DB metric ────────────
    const known = findMetric(resolvedKey);
    const existingMetric =
      parsed.unit == null && known?.unit == null
        ? await MetricModel.findOne({ userId, metricKey: resolvedKey }).lean()
        : null;
    const resolvedUnit = parsed.unit ?? known?.unit ?? existingMetric?.unit ?? null;

    // ── Save event immediately ────────────────────────────────────────────────
    const isNewMetric = !existingMetric && !(await MetricModel.exists({ userId, metricKey: resolvedKey }));

    const event = await EventModel.create({
      userId,
      timestamp: new Date().toISOString(),
      date: toLocalDateString(tz),
      rawText,
      metricKey: resolvedKey,
      value: parsed.value,
      valueType: parsed.valueType,
      unit: resolvedUnit,
    });

    await MetricModel.findOneAndUpdate(
      { userId, metricKey: resolvedKey },
      {
        $setOnInsert: {
          displayName: known?.displayName ?? getMetricDisplayName(resolvedKey),
          valueType: parsed.valueType,
          unit: resolvedUnit,
          aggregation: known?.aggregation ?? inferAggregation(parsed.valueType, resolvedUnit),
          pinned: false,
        },
        $inc: { frequencyScore: 1 },
      },
      { upsert: true, new: true }
    );

    await MetricModel.findOneAndUpdate(
      { userId, metricKey: resolvedKey, frequencyScore: { $gte: 3 }, pinned: false },
      { $set: { pinned: true } }
    );

    await cache.del(`analytics:${userId}:${resolvedKey}`);
    await cache.del(`metrics:pinned:${userId}`);
    if (isNewMetric) await cache.invalidateMetricKeys(userId);

    // ── Background AI — only when parser couldn't resolve the key ─────────────
    // Rules:
    //   sentence + unknown key → aiExtractMetrics (1 call, fixes the key)
    //   short unknown token    → aiResolveAlias   (1 call, alias lookup)
    //   known key (any length) → NO AI call at all
    //
    // This means a user logging "workout 45" or "sleep 7.5" never hits Gemini.
    // AI only fires when the parser genuinely couldn't identify the metric.

    const isSentence = rawText.trim().split(/\s+/).length > 3;
    const isUnknown = !known && !cachedAlias;

    if (isUnknown) {
      if (isSentence) {
        console.log(`[events] unknown sentence, scheduling extraction: "${rawText}"`);
        waitUntil(
          triggerMetricExtraction(String(event._id), rawText, resolvedKey, userId).catch((err) =>
            console.error('[events] triggerMetricExtraction failed:', err)
          )
        );
      } else {
        console.log(`[events] unknown token "${resolvedKey}", scheduling alias resolution`);
        waitUntil(
          triggerAIResolution(parsed.metricKey, userId).catch((err) =>
            console.error('[events] triggerAIResolution failed:', err)
          )
        );
      }
    } else {
      console.log(`[events] known metric "${resolvedKey}" — skipping AI`);
    }

    return NextResponse.json<ApiResponse<IEvent>>(
      { success: true, data: event.toObject() as unknown as IEvent },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/events error:', err);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to create event' }, { status: 500 });
  }
}

// ── triggerAIResolution ───────────────────────────────────────────────────────
async function triggerAIResolution(rawKey: string, userId: string) {
  const existingKeys = await getUserMetricKeys(userId);
  if (!existingKeys.length) return;

  const result = await aiResolveAlias(rawKey, existingKeys, userId);
  if (!result.match) return;

  // AI aliases are always user-scoped and always go through pending confirmation.
  // Global aliases (userId: null) are reserved for human-confirmed mappings only.
  if (result.confidence >= 0.5) {
    await PendingAliasModel.findOneAndUpdate(
      { rawKey, userId, status: 'pending' },
      { suggestedKey: result.match, confidence: result.confidence, status: 'pending' },
      { upsert: true }
    );
    console.log(`[AI] pending alias: "${rawKey}" → "${result.match}" (${result.confidence})`);
  }
}

// ── triggerMetricExtraction ───────────────────────────────────────────────────
// Only called when metric key was unknown — 1 Gemini call max.
// Context annotation (sentiment/tags) removed — not displayed in UI yet,
// not worth burning rate limit budget on.

async function triggerMetricExtraction(eventId: string, rawText: string, currentMetricKey: string, userId: string) {
  console.log(`[AI] triggerMetricExtraction: "${rawText}"`);

  const extracted = await aiExtractMetrics(rawText, userId);
  if (!extracted.length) return;

  const best = extracted.reduce((a, b) => (a.confidence > b.confidence ? a : b));
  if (best.confidence < 0.7 || best.metricKey === currentMetricKey) return;

  console.log(`[AI] correcting: "${currentMetricKey}" → "${best.metricKey}" (${best.confidence})`);

  const known = KNOWN_METRICS.find((m) => m.key === best.metricKey);

  const resolvedUnit = best.unit ?? known?.unit ?? null;
  // If AI returned no value but the known metric is numeric, default to true-ish sentinel.
  // For number metrics: use known default or leave null so the event stores a meaningful type.
  // valueType must always match the known metric — never store boolean for a number metric.
  const resolvedValueType = known?.type ?? (best.value !== null ? 'number' : 'boolean');
  const resolvedValue = best.value !== null ? best.value : resolvedValueType === 'boolean' ? true : null;

  await EventModel.findByIdAndUpdate(eventId, {
    $set: {
      metricKey: best.metricKey,
      valueType: resolvedValueType,
      ...(resolvedValue !== null ? { value: resolvedValue } : {}),
      ...(resolvedUnit !== null ? { unit: resolvedUnit } : {}),
    },
  });

  await MetricModel.findOneAndUpdate(
    { userId, metricKey: best.metricKey },
    {
      $setOnInsert: {
        displayName: known?.displayName ?? getMetricDisplayName(best.metricKey),
        valueType: resolvedValueType,
        unit: resolvedUnit,
        aggregation: known?.aggregation ?? inferAggregation(resolvedValueType, resolvedUnit),
        pinned: false,
      },
      $inc: { frequencyScore: 1 },
    },
    { upsert: true, new: true }
  );

  // Write alias so next time the same raw input resolves instantly without AI.
  // Skip if currentMetricKey is '__unknown__' — it's a placeholder, not a real raw input,
  // and aliasing it would make ALL future unrecognised inputs resolve to this metric.
  if (currentMetricKey !== '__unknown__') {
    await AliasModel.findOneAndUpdate(
      { rawKey: currentMetricKey.toLowerCase(), userId },
      { canonicalKey: best.metricKey, createdBy: 'ai', confidence: best.confidence },
      { upsert: true }
    );
  }

  // Delete the orphan metric if it was only just created (frequencyScore === 1)
  // Don't try to delete '__unknown__' — it's not a real metric doc
  if (currentMetricKey !== '__unknown__') {
    await MetricModel.deleteOne({ userId, metricKey: currentMetricKey, frequencyScore: { $lte: 1 } });
  }

  await Promise.all([
    cache.del(`alias:${userId}:${currentMetricKey}`),
    cache.del(`analytics:${userId}:${currentMetricKey}`),
    cache.del(`metrics:pinned:${userId}`),
    cache.invalidateMetricKeys(userId),
  ]);
}

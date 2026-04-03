import { connectDB } from '@/lib/mongodb';
import { cache } from '@/lib/cache';
import { parseLogInput, parseLogInputMulti, parseAtSyntax, getMetricDisplayName, findMetric } from '@/lib/parser';
import { toLocalDateString } from '@/lib/timezone';
import { aiResolveAlias, aiExtractMetrics, aiExtractContext, getUserMetricKeys } from '@/lib/ai';
import EventModel from '@/models/Event';
import MetricModel from '@/models/Metric';
import AliasModel from '@/models/Alias';
import PendingAliasModel from '@/models/PendingAlias';
import type { IEvent } from '@/types';

function inferAggregation(valueType: string, unit?: string | null): 'sum' | 'avg' | 'last' {
  if (valueType === 'boolean') return 'last';
  if (!unit) return 'avg';
  if (unit === '/10') return 'avg';
  return 'sum';
}

export type LogResult =
  | { ok: true; event: IEvent; pending?: false; multi?: LogResult[] }
  | { ok: true; id: string; pending: true }
  | { ok: false; error: string; status: number };

/**
 * Core logging logic shared by the web app and external voice endpoints.
 * Handles parsing, event creation, metric upsert, cache invalidation, and background AI.
 *
 * @param userId  - authenticated user's MongoDB _id
 * @param rawText - the log input string (1–200 chars)
 * @param tz      - IANA timezone string (optional)
 * @param backgroundFn - optional callback to schedule background work (e.g. waitUntil on Vercel)
 */
export async function logEvent(
  userId: string,
  rawText: string,
  tz?: string,
  backgroundFn?: (p: Promise<unknown>) => void
): Promise<LogResult> {
  await connectDB();

  // ── @ explicit metric syntax — bypass parser and AI entirely ───────────
  const atParsed = parseAtSyntax(rawText);
  if (atParsed) {
    const { metricKey: atKey, value: atValue, valueType: atValueType, unit: atUnit } = atParsed;
    const resolvedUnit = atUnit ?? null;
    const isNewMetric = !(await MetricModel.exists({ userId, metricKey: atKey }));

    const event = await EventModel.create({
      userId,
      timestamp: new Date().toISOString(),
      date: toLocalDateString(tz),
      rawText,
      metricKey: atKey,
      value: atValue,
      valueType: atValueType,
      unit: resolvedUnit,
    });

    await MetricModel.findOneAndUpdate(
      { userId, metricKey: atKey },
      {
        $setOnInsert: {
          displayName: getMetricDisplayName(atKey),
          valueType: atValueType,
          unit: resolvedUnit,
          aggregation: inferAggregation(atValueType, resolvedUnit),
          pinned: false,
        },
        $inc: { frequencyScore: 1 },
      },
      { upsert: true }
    );

    await MetricModel.findOneAndUpdate(
      { userId, metricKey: atKey, frequencyScore: { $gte: 3 }, pinned: false, userUnpinned: { $ne: true } },
      { $set: { pinned: true } }
    );

    await cache.del(`analytics:${userId}:${atKey}`);
    await cache.del(`metrics:pinned:${userId}`);
    if (isNewMetric) await cache.invalidateMetricKeys(userId);

    return { ok: true, event: event.toObject() as unknown as IEvent };
  }

  // Load user metric keys so parser can match user-created metrics
  const userMetricKeys = await getUserMetricKeys(userId);

  // ── Multi-metric: split on "and", commas, etc. ─────────────────────────────
  const multiParsed = parseLogInputMulti(rawText, userMetricKeys);
  if (multiParsed.length > 1) {
    const results: LogResult[] = [];
    for (const p of multiParsed) {
      // Create event directly from parsed data, preserving the original raw text
      const resolvedUnit = p.unit ?? null;
      const isNewMetric = !(await MetricModel.exists({ userId, metricKey: p.metricKey }));

      const event = await EventModel.create({
        userId,
        timestamp: new Date().toISOString(),
        date: toLocalDateString(tz),
        rawText,
        metricKey: p.metricKey,
        value: p.value,
        valueType: p.valueType,
        unit: resolvedUnit,
      });

      await MetricModel.findOneAndUpdate(
        { userId, metricKey: p.metricKey },
        {
          $setOnInsert: {
            displayName: getMetricDisplayName(p.metricKey),
            valueType: p.valueType,
            unit: resolvedUnit,
            aggregation: inferAggregation(p.valueType, resolvedUnit),
            pinned: false,
          },
          $inc: { frequencyScore: 1 },
        },
        { upsert: true }
      );

      await MetricModel.findOneAndUpdate(
        { userId, metricKey: p.metricKey, frequencyScore: { $gte: 3 }, pinned: false, userUnpinned: { $ne: true } },
        { $set: { pinned: true } }
      );

      await cache.del(`analytics:${userId}:${p.metricKey}`);
      await cache.del(`metrics:pinned:${userId}`);
      if (isNewMetric) await cache.invalidateMetricKeys(userId);

      // Background AI: extract sentiment, tags, and note
      const eventId = String(event._id);
      const bgWork = aiExtractContext(rawText, p.metricKey, userId)
        .then(async (ctx) => {
          if (ctx.sentiment !== 'neutral' || ctx.tags.length > 0 || ctx.note) {
            await EventModel.findByIdAndUpdate(eventId, {
              $set: { sentiment: ctx.sentiment, tags: ctx.tags, note: ctx.note },
            }).catch(() => {});
          }
        })
        .catch(() => {});
      if (backgroundFn) backgroundFn(bgWork);

      results.push({ ok: true, event: event.toObject() as unknown as IEvent });
    }
    // Return the first successful result with all multi results attached
    const firstOk = results.find((r) => r.ok);
    if (firstOk && firstOk.ok && 'event' in firstOk) {
      return { ...firstOk, multi: results };
    }
    return results[0];
  }

  const parsed = parseLogInput(rawText, userMetricKeys);

  // Parser returns null when all tokens are noise words
  if (!parsed) {
    const words = rawText.trim().split(/\s+/);
    if (words.length < 2) {
      return { ok: false, error: 'Could not parse input', status: 400 };
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
    const extraction = triggerMetricExtraction(String(tempEvent._id), rawText, '__unknown__', userId).catch((err) =>
      console.error('[events] triggerMetricExtraction failed:', err)
    );
    if (backgroundFn) backgroundFn(extraction);
    return { ok: true, id: String(tempEvent._id), pending: true };
  }

  // ── Fast path alias resolution (cache → DB, no AI) ──────────────────────
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

  // ── Resolve unit ─────────────────────────────────────────────────────────
  const known = findMetric(resolvedKey);
  const existingMetric = await MetricModel.findOne({ userId, metricKey: resolvedKey }).lean();
  const metricExpectedUnit = known?.unit ?? existingMetric?.unit ?? null;
  const resolvedUnit = parsed.unit ?? metricExpectedUnit;

  // ── Unit conversion for user-customized metrics ────────────────────────
  // If the user's metric expects a different unit than what was parsed,
  // convert (e.g. user typed "workout 80mins" but metric unit is "h" → 1.33h)
  let finalValue = parsed.value;
  let finalUnit = resolvedUnit;
  if (typeof parsed.value === 'number' && parsed.unit && metricExpectedUnit && parsed.unit !== metricExpectedUnit) {
    const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
      min: { h: 1 / 60, sec: 60 },
      h: { min: 60, sec: 3600 },
      sec: { min: 1 / 60, h: 1 / 3600 },
      kg: { lb: 2.20462, g: 1000, oz: 35.274 },
      lb: { kg: 0.453592, g: 453.592, oz: 16 },
      g: { kg: 0.001, lb: 0.00220462, oz: 0.035274 },
      oz: { g: 28.3495, kg: 0.0283495, lb: 0.0625 },
      L: { ml: 1000, cup: 4.22675, glass: 4 },
      ml: { L: 0.001, cup: 0.00422675, glass: 0.004 },
      cup: { L: 0.236588, ml: 236.588, glass: 1 },
      glass: { L: 0.25, ml: 250, cup: 1 },
      km: { mi: 0.621371, m: 1000 },
      mi: { km: 1.60934, m: 1609.34 },
      m: { km: 0.001, mi: 0.000621371 },
    };
    const factor = UNIT_CONVERSIONS[parsed.unit]?.[metricExpectedUnit];
    if (factor !== undefined) {
      finalValue = Math.round(parsed.value * factor * 100) / 100;
      finalUnit = metricExpectedUnit;
    }
  }

  // ── Save event immediately ───────────────────────────────────────────────
  const isNewMetric = !existingMetric;

  const event = await EventModel.create({
    userId,
    timestamp: new Date().toISOString(),
    date: toLocalDateString(tz),
    rawText,
    metricKey: resolvedKey,
    value: finalValue,
    valueType: parsed.valueType,
    unit: finalUnit,
  });

  // Skip metric creation for unknown keys — AI will suggest an alias.
  // The metric will be created when the user confirms (merge into target)
  // or rejects (keep as standalone) the alias suggestion.
  const willTriggerAI = !known && !cachedAlias;

  if (!willTriggerAI) {
    await MetricModel.findOneAndUpdate(
      { userId, metricKey: resolvedKey },
      {
        $setOnInsert: {
          displayName: known?.displayName ?? getMetricDisplayName(resolvedKey),
          valueType: parsed.valueType,
          unit: finalUnit,
          aggregation: known?.aggregation ?? inferAggregation(parsed.valueType, finalUnit),
          pinned: false,
        },
        $inc: { frequencyScore: 1 },
      },
      { upsert: true, new: true }
    );

    await MetricModel.findOneAndUpdate(
      { userId, metricKey: resolvedKey, frequencyScore: { $gte: 3 }, pinned: false, userUnpinned: { $ne: true } },
      { $set: { pinned: true } }
    );
  }

  await cache.del(`analytics:${userId}:${resolvedKey}`);
  await cache.del(`metrics:pinned:${userId}`);
  if (isNewMetric) await cache.invalidateMetricKeys(userId);

  // ── Background AI — only when parser couldn't resolve the key ───────────
  const isSentence = rawText.trim().split(/\s+/).length > 3;
  const isUnknown = !known && !cachedAlias;

  if (isUnknown) {
    const bgWork = isSentence
      ? triggerMetricExtraction(String(event._id), rawText, resolvedKey, userId).catch((err) =>
          console.error('[events] triggerMetricExtraction failed:', err)
        )
      : triggerAIResolution(parsed.metricKey, userId).catch((err) =>
          console.error('[events] triggerAIResolution failed:', err)
        );

    if (backgroundFn) {
      backgroundFn(bgWork);
    }
  }

  return { ok: true, event: event.toObject() as unknown as IEvent };
}

// ── triggerAIResolution ─────────────────────────────────────────────────────
async function triggerAIResolution(rawKey: string, userId: string) {
  const existingKeys = await getUserMetricKeys(userId);
  if (!existingKeys.length) return;

  const result = await aiResolveAlias(rawKey, existingKeys, userId);
  if (!result.match) return;

  if (result.confidence >= 0.5) {
    await PendingAliasModel.findOneAndUpdate(
      { rawKey, userId, status: 'pending' },
      { suggestedKey: result.match, confidence: result.confidence, status: 'pending' },
      { upsert: true }
    );
  }
}

// ── triggerMetricExtraction ─────────────────────────────────────────────────
// Extracts the intended metric from a natural language sentence.
// Instead of auto-correcting silently, creates a PendingAlias so the user
// can confirm or reject the suggestion via the UI prompt.
async function triggerMetricExtraction(eventId: string, rawText: string, currentMetricKey: string, userId: string) {
  const extracted = await aiExtractMetrics(
    rawText,
    userId,
    currentMetricKey !== '__unknown__' ? currentMetricKey : undefined
  );
  if (!extracted.length) return;

  const best = extracted.reduce((a, b) => (a.confidence > b.confidence ? a : b));
  if (best.metricKey === currentMetricKey) return;
  if (best.confidence < 0.5) return;

  const rawKey = currentMetricKey !== '__unknown__' ? currentMetricKey : rawText.trim().toLowerCase();

  // Create a PendingAlias for the user to confirm — don't auto-correct
  await PendingAliasModel.findOneAndUpdate(
    { rawKey, userId, status: 'pending' },
    {
      suggestedKey: best.metricKey,
      confidence: best.confidence,
      status: 'pending',
      ...(eventId ? { eventId } : {}),
    },
    { upsert: true }
  );

  // Still extract context (sentiment, tags, notes) in the background
  aiExtractContext(rawText, currentMetricKey, userId)
    .then(async (ctx: { sentiment: string; tags: string[]; note: string | null }) => {
      if (ctx.sentiment !== 'neutral' || ctx.tags.length > 0 || ctx.note) {
        await EventModel.findByIdAndUpdate(eventId, {
          $set: { sentiment: ctx.sentiment, tags: ctx.tags, note: ctx.note },
        }).catch(() => {});
      }
    })
    .catch(() => {});
}

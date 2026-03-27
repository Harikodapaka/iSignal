import EventModel from '@/models/Event';

/**
 * Smart per-metric reminder suggestions.
 *
 * Analyzes the last N days of logging history to find each metric's
 * most common logging hour(s). Returns up to `maxSuggestions` hours
 * per metric, sorted by frequency.
 *
 * Algorithm:
 * 1. Fetch all events for a user in the last `lookbackDays` days
 * 2. Group by metricKey
 * 3. For each metric, bucket timestamps into hours (in user's timezone)
 * 4. Find peak hours (≥ 20% of max bucket count, minimum 2 occurrences)
 * 5. Return sorted by frequency descending
 */

export interface MetricSuggestion {
  metricKey: string;
  suggestedTimes: number[]; // Hours 0-23, sorted by frequency desc
  confidence: 'high' | 'medium' | 'low';
  sampleSize: number; // Total events analyzed for this metric
  peakHourCount: number; // How many events fell in the top hour
}

const MIN_EVENTS_FOR_SUGGESTION = 3; // Need at least 3 logs to suggest
const MIN_BUCKET_COUNT = 2; // A bucket needs ≥ 2 hits to qualify
const PEAK_THRESHOLD = 0.2; // Bucket must be ≥ 20% of max to qualify
const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_SUGGESTIONS_PER_METRIC = 3;

/**
 * Get the hour (0-23) from an ISO timestamp in a given timezone.
 */
function getHourInTimezone(isoTimestamp: string, tz: string): number {
  try {
    const date = new Date(isoTimestamp);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(formatter.format(date), 10);
  } catch {
    return new Date(isoTimestamp).getUTCHours();
  }
}

/**
 * Analyze a user's logging history and suggest optimal reminder times
 * for each metric they've logged.
 */
export async function getSmartSuggestions(
  userId: string,
  tz: string,
  options?: {
    lookbackDays?: number;
    maxSuggestions?: number;
    metricKeys?: string[]; // Only analyze these metrics (optional filter)
  }
): Promise<MetricSuggestion[]> {
  const lookbackDays = options?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const maxSuggestions = options?.maxSuggestions ?? MAX_SUGGESTIONS_PER_METRIC;

  // Calculate cutoff date
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  const cutoffISO = cutoff.toISOString();

  // Build query
  const query: Record<string, unknown> = {
    userId,
    timestamp: { $gte: cutoffISO },
  };
  if (options?.metricKeys?.length) {
    query.metricKey = { $in: options.metricKeys };
  }

  // Fetch events — only need timestamp and metricKey
  const events = await EventModel.find(query).select('metricKey timestamp').lean().maxTimeMS(10000);

  if (events.length === 0) return [];

  // Group by metricKey
  const byMetric = new Map<string, string[]>(); // metricKey → timestamps[]
  for (const event of events) {
    const e = event as { metricKey: string; timestamp: string };
    if (!byMetric.has(e.metricKey)) byMetric.set(e.metricKey, []);
    byMetric.get(e.metricKey)!.push(e.timestamp);
  }

  const suggestions: MetricSuggestion[] = [];

  for (const [metricKey, timestamps] of byMetric) {
    if (timestamps.length < MIN_EVENTS_FOR_SUGGESTION) continue;

    // Bucket into hours
    const hourBuckets = new Array(24).fill(0);
    for (const ts of timestamps) {
      const hour = getHourInTimezone(ts, tz);
      hourBuckets[hour]++;
    }

    const maxCount = Math.max(...hourBuckets);
    if (maxCount < MIN_BUCKET_COUNT) continue;

    // Find qualifying hours (≥ threshold of max)
    const threshold = Math.max(MIN_BUCKET_COUNT, Math.floor(maxCount * PEAK_THRESHOLD));
    const qualifyingHours: { hour: number; count: number }[] = [];

    for (let h = 0; h < 24; h++) {
      if (hourBuckets[h] >= threshold) {
        qualifyingHours.push({ hour: h, count: hourBuckets[h] });
      }
    }

    // Sort by frequency descending, take top N
    qualifyingHours.sort((a, b) => b.count - a.count);
    const topHours = qualifyingHours.slice(0, maxSuggestions);

    if (topHours.length === 0) continue;

    // Determine confidence
    const peakRatio = topHours[0].count / timestamps.length;
    const confidence: 'high' | 'medium' | 'low' =
      peakRatio >= 0.5 && timestamps.length >= 10
        ? 'high'
        : peakRatio >= 0.3 || timestamps.length >= 7
          ? 'medium'
          : 'low';

    suggestions.push({
      metricKey,
      suggestedTimes: topHours.map((h) => h.hour),
      confidence,
      sampleSize: timestamps.length,
      peakHourCount: topHours[0].count,
    });
  }

  // Sort by confidence (high first), then by sample size
  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort(
    (a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence] || b.sampleSize - a.sampleSize
  );

  return suggestions;
}

/**
 * Format a suggestion into a human-readable string.
 * e.g. "You usually log this around 2 PM"
 * e.g. "You usually log this around 9 AM and 7 PM"
 */
export function formatSuggestionHint(suggestion: MetricSuggestion): string {
  const formatHour = (h: number) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);

  const times = suggestion.suggestedTimes.map(formatHour);

  if (times.length === 1) {
    return `You usually log this around ${times[0]}`;
  }
  if (times.length === 2) {
    return `You usually log this around ${times[0]} and ${times[1]}`;
  }
  const last = times.pop()!;
  return `You usually log this around ${times.join(', ')}, and ${last}`;
}

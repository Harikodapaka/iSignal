import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import { cache } from '@/lib/cache';
import { aiWeeklySummary } from '@/lib/ai';
import { getLastNDays } from '@/lib/timezone';
import EventModel from '@/models/Event';
import MetricModel from '@/models/Metric';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body0 = await req
      .clone()
      .json()
      .catch(() => ({}));
    const tz = typeof body0.tz === 'string' ? body0.tz : null;
    const range = typeof body0.range === 'string' ? body0.range : '7d';
    const nDays = range === '3mo' ? 90 : range === '30d' ? 30 : 7;

    // Rate limit: 3 summaries per hour
    const rl = await cache.checkRateLimit(userId, 'aiSummary', 3, 3600);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    await connectDB();

    // Fetch current period AND prior period for comparison
    const currentDays = getLastNDays(nDays, tz);
    const priorDays = getLastNDays(nDays * 2, tz).slice(0, nDays);

    const [currentEvents, priorEvents, metrics] = await Promise.all([
      EventModel.find({ userId, date: { $in: currentDays } })
        .maxTimeMS(5000)
        .lean(),
      EventModel.find({ userId, date: { $in: priorDays } })
        .maxTimeMS(5000)
        .lean(),
      MetricModel.find({ userId, pinned: true }).lean(),
    ]);

    // Helper: aggregate daily values for a set of events
    function aggregateDaily(metricEvents: typeof currentEvents, valueType: string, agg: 'sum' | 'avg' | 'last') {
      const uniqueDates = [...new Set(metricEvents.map((e) => e.date as string))].sort();
      const dailyValues: { date: string; value: number | boolean | null }[] = uniqueDates.map((date) => {
        const dayEvents = metricEvents.filter((e) => e.date === date);
        if (valueType === 'boolean') {
          return { date, value: dayEvents.length > 0 };
        }
        const vals = dayEvents.map((e) => Number(e.value)).filter((v) => !isNaN(v));
        if (!vals.length) return { date, value: null };
        let value: number;
        if (agg === 'sum') value = vals.reduce((a, b) => a + b, 0);
        else if (agg === 'last') value = vals[vals.length - 1];
        else value = vals.reduce((a, b) => a + b, 0) / vals.length;
        return { date, value: Math.round(value * 10) / 10 };
      });
      return { dailyValues, uniqueDates };
    }

    function numericAvg(values: (number | boolean | null)[]): number | null {
      const nums = values.filter((v): v is number => typeof v === 'number' && v !== null);
      return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
    }

    // Build enriched data per metric
    const enrichedData = metrics.map((m) => {
      const agg: 'sum' | 'avg' | 'last' =
        (m.aggregation as 'sum' | 'avg' | 'last') ?? (m.unit === '/10' ? 'avg' : m.unit ? 'sum' : 'avg');

      const currentMetricEvents = currentEvents.filter((e) => e.metricKey === m.metricKey);
      const priorMetricEvents = priorEvents.filter((e) => e.metricKey === m.metricKey);

      const current = aggregateDaily(currentMetricEvents, m.valueType, agg);
      const prior = aggregateDaily(priorMetricEvents, m.valueType, agg);

      const currentAvg = numericAvg(current.dailyValues.map((d) => d.value));
      const priorAvg = numericAvg(prior.dailyValues.map((d) => d.value));

      // Week-over-week delta
      let delta: string | null = null;
      if (currentAvg !== null && priorAvg !== null && priorAvg !== 0) {
        const pct = Math.round(((currentAvg - priorAvg) / priorAvg) * 100);
        delta = pct > 0 ? `+${pct}%` : `${pct}%`;
      }

      // Day-of-week patterns (which days they skip or are most active)
      const dayOfWeekCounts = new Array(7).fill(0);
      for (const d of current.dailyValues) {
        const dayIdx = new Date(d.date + 'T12:00:00').getDay();
        dayOfWeekCounts[dayIdx]++;
      }
      const mostActiveDay = DAY_NAMES[dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts))];
      const skippedDays = DAY_NAMES.filter((_, i) => dayOfWeekCounts[i] === 0);

      // Best and worst day (for number metrics)
      let bestDay: { date: string; value: number; dayName: string } | null = null;
      let worstDay: { date: string; value: number; dayName: string } | null = null;
      if (m.valueType === 'number') {
        const numDays = current.dailyValues.filter(
          (d): d is { date: string; value: number } => typeof d.value === 'number'
        );
        if (numDays.length > 0) {
          const sorted = [...numDays].sort((a, b) => b.value - a.value);
          const best = sorted[0];
          const worst = sorted[sorted.length - 1];
          bestDay = { ...best, dayName: DAY_NAMES[new Date(best.date + 'T12:00:00').getDay()] };
          worstDay = { ...worst, dayName: DAY_NAMES[new Date(worst.date + 'T12:00:00').getDay()] };
        }
      }

      // Weekday vs weekend averages (pre-computed so AI doesn't guess from dates)
      let weekdayAvg: number | null = null;
      let weekendAvg: number | null = null;
      if (m.valueType === 'number') {
        const weekdayVals: number[] = [];
        const weekendVals: number[] = [];
        for (const d of current.dailyValues) {
          if (typeof d.value !== 'number') continue;
          const dayIdx = new Date(d.date + 'T12:00:00').getDay();
          if (dayIdx === 0 || dayIdx === 6) weekendVals.push(d.value);
          else weekdayVals.push(d.value);
        }
        weekdayAvg = weekdayVals.length
          ? Math.round((weekdayVals.reduce((a, b) => a + b, 0) / weekdayVals.length) * 10) / 10
          : null;
        weekendAvg = weekendVals.length
          ? Math.round((weekendVals.reduce((a, b) => a + b, 0) / weekendVals.length) * 10) / 10
          : null;
      }

      // Streak: consecutive days logged (from most recent backward)
      const allDates = current.uniqueDates.sort().reverse();
      let streak = 0;
      if (allDates.length > 0) {
        let cursor = new Date(currentDays[currentDays.length - 1]); // today
        for (const date of allDates) {
          const d = new Date(date);
          const diff = Math.round((cursor.getTime() - d.getTime()) / 86400000);
          if (diff === 0 || diff === 1) {
            streak++;
            cursor = d;
          } else break;
        }
      }

      return {
        metric: m.metricKey,
        displayName: m.displayName,
        type: m.valueType,
        unit: m.unit,
        aggregation: agg,
        daysLogged: current.uniqueDates.length,
        totalDays: nDays,
        currentAvg,
        priorAvg,
        delta,
        streak,
        mostActiveDay,
        skippedDays: skippedDays.length <= 3 ? skippedDays : `${skippedDays.length} days`,
        bestDay,
        worstDay,
        weekdayAvg,
        weekendAvg,
        // Keep raw daily values compact for AI
        dailyValues: current.dailyValues,
      };
    });

    const summary = await aiWeeklySummary(enrichedData, userId, range);
    if (!summary) {
      return NextResponse.json({ success: false, error: 'AI unavailable — try again shortly' }, { status: 503 });
    }

    return NextResponse.json({ success: true, data: summary });
  } catch (err) {
    console.error('POST /api/analytics/summary error:', err);
    return NextResponse.json({ success: false, error: 'Failed to generate summary' }, { status: 500 });
  }
}

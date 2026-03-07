import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import { cache } from '@/lib/cache';
import { getLastNDays } from '@/lib/timezone';
import { parseTzParam } from '@/lib/timezone';
import EventModel from '@/models/Event';
import MetricModel from '@/models/Metric';
import type { ApiResponse, IAnalytics, IEvent } from '@/types';

function getCurrentStreak(dates: string[], today: string): number {
  const unique = [...new Set(dates)].sort().reverse();
  let streak = 0;
  let cursor = new Date(today);

  for (const date of unique) {
    const d = new Date(date);
    const diff = Math.round((cursor.getTime() - d.getTime()) / 86400000);
    if (diff === 0 || diff === 1) {
      streak++;
      cursor = d;
    } else break;
  }
  return streak;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const tz = parseTzParam(searchParams);
    const metricKey = searchParams.get('metric');
    const rangeParam = searchParams.get('range') ?? '7d';
    const rangeDays = rangeParam === '3mo' ? 90 : rangeParam === '30d' ? 30 : 7;

    // Check cache
    const cacheKey = metricKey
      ? `analytics:${userId}:${metricKey}:${rangeParam}`
      : `analytics:${userId}:all:${rangeParam}`;

    const cached = await cache.get<IAnalytics[]>(cacheKey);
    if (cached) {
      return NextResponse.json<ApiResponse<IAnalytics[]>>({
        success: true,
        data: cached,
      });
    }

    await connectDB();

    const query: Record<string, unknown> = { userId, pinned: true };
    if (metricKey) query.metricKey = metricKey;

    const metrics = await MetricModel.find(query).sort({ frequencyScore: -1 }).maxTimeMS(5000).lean();

    const today = getLastNDays(1, tz)[0];
    const lastN = getLastNDays(rangeDays, tz); // the requested range
    const last30 = getLastNDays(30, tz); // always fetch 30 for streak/monthly stats

    const analytics: IAnalytics[] = await Promise.all(
      metrics.map(async (metric) => {
        const [eventsN, events30] = await Promise.all([
          EventModel.find({
            userId,
            metricKey: metric.metricKey,
            date: { $in: lastN },
          })
            .maxTimeMS(3000)
            .lean<IEvent[]>()
            .catch(() => [] as IEvent[]),
          EventModel.find({
            userId,
            metricKey: metric.metricKey,
            date: { $in: last30 },
          })
            .maxTimeMS(3000)
            .lean<IEvent[]>()
            .catch(() => [] as IEvent[]),
        ]);

        const base: IAnalytics = {
          metricKey: metric.metricKey,
          displayName: metric.displayName,
          valueType: metric.valueType,
          unit: metric.unit,
        };

        // Today's value for boolean metrics (number metrics set it inside their block)
        const todayEvents = eventsN.filter((e) => e.date === today);
        if (metric.valueType === 'boolean') {
          base.todayValue = todayEvents.length ? true : null;
        }

        if (metric.valueType === 'boolean') {
          const daysN = new Set(eventsN.map((e) => e.date)).size;
          const days30 = new Set(events30.map((e) => e.date)).size;
          return {
            ...base,
            daysCompletedThisWeek: daysN,
            currentStreak: getCurrentStreak(
              events30.map((e) => e.date),
              today
            ),
            monthlyCompletionPct: Math.round((days30 / 30) * 100),
            rangeDays: rangeDays,
            lastNDays: lastN.map((date) => ({
              date,
              value: eventsN.some((e) => e.date === date),
            })),
            last7Days: lastN.map((date) => ({
              // back-compat alias
              date,
              value: eventsN.some((e) => e.date === date),
            })),
          };
        }

        if (metric.valueType === 'number') {
          // Use stored aggregation, or infer from unit if missing (old metrics pre-migration)
          const agg: 'sum' | 'avg' | 'last' =
            (metric.aggregation as 'sum' | 'avg' | 'last') ??
            (metric.unit === '/10' ? 'avg' : metric.unit ? 'sum' : 'avg');

          // Collapse multiple same-day events into one daily value per aggregation type
          function dailyValue(events: typeof eventsN, date: string): number | null {
            const dayEvents = events.filter((e) => e.date === date);
            if (!dayEvents.length) return null;
            const vals = dayEvents.map((e) => Number(e.value)).filter((v) => !isNaN(v));
            if (!vals.length) return null;
            if (agg === 'sum') return vals.reduce((a, b) => a + b, 0);
            if (agg === 'last') return vals[vals.length - 1];
            return vals.reduce((a, b) => a + b, 0) / vals.length; // avg
          }

          // Build per-day values for N and 30 days
          const dailyN = lastN.map((date) => dailyValue(eventsN, date));
          const daily30 = last30.map((date) => dailyValue(events30, date));

          const presentN = dailyN.filter((v): v is number => v !== null);
          const present30 = daily30.filter((v): v is number => v !== null);

          const avgN = presentN.length ? presentN.reduce((a, b) => a + b, 0) / presentN.length : 0;
          const avg30 = present30.length ? present30.reduce((a, b) => a + b, 0) / present30.length : 0;

          // Today: sum/last/avg of today's events
          base.todayValue = dailyValue(eventsN, today);

          // Trend: compare last 20% of range vs prior 80%
          const splitAt = Math.floor(dailyN.length * 0.7);
          const recent3vals = dailyN.slice(splitAt).filter((v): v is number => v !== null);
          const prior4vals = dailyN.slice(0, splitAt).filter((v): v is number => v !== null);
          const avgRecent = recent3vals.length ? recent3vals.reduce((a, b) => a + b, 0) / recent3vals.length : 0;
          const avgPrior = prior4vals.length ? prior4vals.reduce((a, b) => a + b, 0) / prior4vals.length : 0;

          let trend: 'up' | 'down' | 'flat' = 'flat';
          let trendPct = 0;
          if (avgPrior > 0) {
            trendPct = Math.round(((avgRecent - avgPrior) / avgPrior) * 100);
            if (trendPct > 3) trend = 'up';
            else if (trendPct < -3) trend = 'down';
          }

          return {
            ...base,
            sevenDayAvg: Math.round(avgN * 10) / 10, // now reflects the selected range
            monthlyAvg: Math.round(avg30 * 10) / 10,
            rangeAvg: Math.round(avgN * 10) / 10,
            rangeDays: rangeDays,
            trend,
            trendPct: Math.abs(trendPct),
            lastNDays: lastN.map((date, idx) => ({
              date,
              value: dailyN[idx],
            })),
            last7Days: lastN.map((date, idx) => ({
              date,
              value: dailyN[idx],
            })), // back-compat
          };
        }

        return base;
      })
    );

    // Cache for 5 minutes
    await cache.set(cacheKey, analytics, 300);

    return NextResponse.json<ApiResponse<IAnalytics[]>>({
      success: true,
      data: analytics,
    });
  } catch (err) {
    console.error('GET /api/analytics error:', err);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to compute analytics' },
      { status: 500 }
    );
  }
}

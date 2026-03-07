import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import { cache } from '@/lib/cache'
import { getLastNDays } from '@/lib/timezone'
import { parseTzParam } from '@/lib/timezone'
import EventModel from '@/models/Event'
import MetricModel from '@/models/Metric'
import type { ApiResponse, IAnalytics } from '@/types'

function getCurrentStreak(dates: string[], today: string): number {
  const unique = [...new Set(dates)].sort().reverse()
  let streak = 0
  let cursor = new Date(today)

  for (const date of unique) {
    const d = new Date(date)
    const diff = Math.round((cursor.getTime() - d.getTime()) / 86400000)
    if (diff === 0 || diff === 1) {
      streak++
      cursor = d
    } else break
  }
  return streak
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { searchParams } = new URL(req.url)
    const tz = parseTzParam(searchParams)
    const metricKey = searchParams.get('metric')

    // Check cache
    const cacheKey = metricKey
      ? `analytics:${userId}:${metricKey}`
      : `analytics:${userId}:all`

    const cached = await cache.get<IAnalytics[]>(cacheKey)
    if (cached) {
      return NextResponse.json<ApiResponse<IAnalytics[]>>({ success: true, data: cached })
    }

    await connectDB()

    const query: Record<string, unknown> = { userId, pinned: true }
    if (metricKey) query.metricKey = metricKey

    const metrics = await MetricModel.find(query)
      .sort({ frequencyScore: -1 })
      .maxTimeMS(5000)
      .lean()

    const today = getLastNDays(1, tz)[0]
    const last7 = getLastNDays(7, tz)
    const last30 = getLastNDays(30, tz)

    const analytics: IAnalytics[] = await Promise.all(
      metrics.map(async (metric) => {
        const [events7, events30] = await Promise.all([
          EventModel.find({
            userId,
            metricKey: metric.metricKey,
            date: { $in: last7 },
          }).maxTimeMS(3000).lean().catch(() => []),
          EventModel.find({
            userId,
            metricKey: metric.metricKey,
            date: { $in: last30 },
          }).maxTimeMS(3000).lean().catch(() => []),
        ])

        const base: IAnalytics = {
          metricKey: metric.metricKey,
          displayName: metric.displayName,
          valueType: metric.valueType,
          unit: metric.unit,
        }

        // Today's value
        const todayEvents = events7.filter((e) => e.date === today)
        base.todayValue = todayEvents.length
          ? metric.valueType === 'boolean'
            ? true
            : Number(todayEvents[todayEvents.length - 1].value)
          : null

        if (metric.valueType === 'boolean') {
          const days7 = new Set(events7.map((e) => e.date)).size
          const days30 = new Set(events30.map((e) => e.date)).size
          return {
            ...base,
            daysCompletedThisWeek: days7,
            currentStreak: getCurrentStreak(events30.map((e) => e.date), today),
            monthlyCompletionPct: Math.round((days30 / 30) * 100),
            last7Days: last7.map((date) => ({
              date,
              value: events7.some((e) => e.date === date),
            })),
          }
        }

        if (metric.valueType === 'number') {
          const nums7 = events7.map((e) => Number(e.value)).filter((v) => !isNaN(v))
          const nums30 = events30.map((e) => Number(e.value)).filter((v) => !isNaN(v))
          const avg7 = nums7.length ? nums7.reduce((a, b) => a + b, 0) / nums7.length : 0
          const avg30 = nums30.length ? nums30.reduce((a, b) => a + b, 0) / nums30.length : 0

          // Trend: compare last 3 vs prior 4 days
          const recent3 = events7.filter((e) => last7.slice(4).includes(e.date))
          const prior4 = events7.filter((e) => last7.slice(0, 4).includes(e.date))
          const avgRecent = recent3.length
            ? recent3.reduce((a, e) => a + Number(e.value), 0) / recent3.length : 0
          const avgPrior = prior4.length
            ? prior4.reduce((a, e) => a + Number(e.value), 0) / prior4.length : 0

          let trend: 'up' | 'down' | 'flat' = 'flat'
          let trendPct = 0
          if (avgPrior > 0) {
            trendPct = Math.round(((avgRecent - avgPrior) / avgPrior) * 100)
            if (trendPct > 3) trend = 'up'
            else if (trendPct < -3) trend = 'down'
          }

          return {
            ...base,
            sevenDayAvg: Math.round(avg7 * 10) / 10,
            monthlyAvg: Math.round(avg30 * 10) / 10,
            trend,
            trendPct: Math.abs(trendPct),
            last7Days: last7.map((date) => {
              const dayEvents = events7.filter((e) => e.date === date)
              const val = dayEvents.length
                ? dayEvents.reduce((a, e) => a + Number(e.value), 0) / dayEvents.length
                : null
              return { date, value: val }
            }),
          }
        }

        return base
      })
    )

    // Cache for 5 minutes
    await cache.set(cacheKey, analytics, 300)

    return NextResponse.json<ApiResponse<IAnalytics[]>>({ success: true, data: analytics })
  } catch (err) {
    console.error('GET /api/analytics error:', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to compute analytics' },
      { status: 500 }
    )
  }
}
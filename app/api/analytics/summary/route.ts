import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import { cache } from '@/lib/cache'
import { aiWeeklySummary } from '@/lib/ai'
import { getLastNDays, parseTzParam } from '@/lib/timezone'
import EventModel from '@/models/Event'
import MetricModel from '@/models/Metric'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    // Summary route is POST with no body params, so we read tz from body
    const body0 = await req.clone().json().catch(() => ({}))
    const tz = typeof body0.tz === 'string' ? body0.tz : null

    // Rate limit: 3 summaries per hour
    const rl = await cache.checkRateLimit(userId, 'aiSummary', 3, 3600)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Try again later.' },
        { status: 429 }
      )
    }

    await connectDB()
    const last7 = getLastNDays(7, tz)

    const [events, metrics] = await Promise.all([
      EventModel.find({ userId, date: { $in: last7 } }).maxTimeMS(5000).lean(),
      MetricModel.find({ userId, pinned: true }).lean(),
    ])

    // Build weekly summary object
    const weeklyData = metrics.map((m) => {
      const metricEvents = events.filter((e) => e.metricKey === m.metricKey)
      return {
        metric: m.metricKey,
        displayName: m.displayName,
        type: m.valueType,
        unit: m.unit,
        entries: metricEvents.map((e) => ({ date: e.date, value: e.value })),
        daysLogged: new Set(metricEvents.map((e) => e.date)).size,
      }
    })

    const summary = await aiWeeklySummary(weeklyData, userId)
    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'AI unavailable — try again shortly' },
        { status: 503 }
      )
    }

    return NextResponse.json({ success: true, data: summary })
  } catch (err) {
    console.error('POST /api/analytics/summary error:', err)
    return NextResponse.json({ success: false, error: 'Failed to generate summary' }, { status: 500 })
  }
}
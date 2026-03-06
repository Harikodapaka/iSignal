import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import { cache } from '@/lib/cache'
import { aiWeeklySummary } from '@/lib/ai'
import { getLast7Days } from '@/lib/parser'
import EventModel from '@/models/Event'
import MetricModel from '@/models/Metric'

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Rate limit: 3 summaries per hour
    const rl = await cache.checkRateLimit(userId, 'aiSummary', 3, 3600)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Try again later.' },
        { status: 429 }
      )
    }

    await connectDB()
    const last7 = getLast7Days()

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

    const summary = await aiWeeklySummary(weeklyData)
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

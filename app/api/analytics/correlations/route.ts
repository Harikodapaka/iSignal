import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { cache } from '@/lib/cache'
import { aiCorrelations } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Rate limit AI calls
    const rl = await cache.checkRateLimit(userId, 'aiInsights', 5, 3600) // 5 per hour
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many AI requests. Try again later.' },
        { status: 429 }
      )
    }

    const body = await req.json().catch(() => ({ events: [] }))
    const correlations = await aiCorrelations(body.events ?? [])

    return NextResponse.json({ success: true, data: correlations })
  } catch (err) {
    console.error('POST /api/analytics/correlations error:', err)
    return NextResponse.json({ success: false, error: 'Failed to compute correlations' }, { status: 500 })
  }
}

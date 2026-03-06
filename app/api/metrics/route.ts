import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import { cache } from '@/lib/cache'
import MetricModel from '@/models/Metric'
import type { ApiResponse, IMetric } from '@/types'

// ── GET /api/metrics?pinned=true ──
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
    const pinnedOnly = searchParams.get('pinned') === 'true'

    const cacheKey = pinnedOnly ? `metrics:pinned:${userId}` : `metrics:all:${userId}`
    const cached = await cache.get<IMetric[]>(cacheKey)
    if (cached) return NextResponse.json<ApiResponse<IMetric[]>>({ success: true, data: cached })

    await connectDB()
    const query: Record<string, unknown> = { userId }
    if (pinnedOnly) query.pinned = true

    const metrics = await MetricModel
      .find(query)
      .sort({ pinned: -1, frequencyScore: -1 })
      .maxTimeMS(5000)
      .lean()

    await cache.set(cacheKey, metrics, pinnedOnly ? 300 : 120)

    return NextResponse.json<ApiResponse<IMetric[]>>({ success: true, data: metrics as IMetric[] })
  } catch (err) {
    console.error('GET /api/metrics error:', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

const PatchSchema = z.object({
  metricKey: z.string().min(1),
  pinned: z.boolean(),
})

// ── PATCH /api/metrics — toggle pin ──
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => null)
    const validated = PatchSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      )
    }

    await connectDB()
    const userId = session.user.id
    const { metricKey, pinned } = validated.data

    const metric = await MetricModel.findOneAndUpdate(
      { userId, metricKey },
      { $set: { pinned } },
      { new: true }
    )

    if (!metric) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Metric not found' },
        { status: 404 }
      )
    }

    // Invalidate cache
    await cache.del(`metrics:pinned:${userId}`)
    await cache.del(`metrics:all:${userId}`)

    return NextResponse.json<ApiResponse<IMetric>>({ success: true, data: metric.toObject() as IMetric })
  } catch (err) {
    console.error('PATCH /api/metrics error:', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to update metric' },
      { status: 500 }
    )
  }
}

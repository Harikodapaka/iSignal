import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import { cache } from '@/lib/cache'
import AliasModel from '@/models/Alias'
import PendingAliasModel from '@/models/PendingAlias'
import EventModel from '@/models/Event'
import type { ApiResponse } from '@/types'

// ── GET pending aliases for current user ──
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectDB()
    const pending = await PendingAliasModel
      .find({ userId: session.user.id, status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()

    return NextResponse.json({ success: true, data: pending })
  } catch (err) {
    console.error('GET /api/aliases error:', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to fetch aliases' },
      { status: 500 }
    )
  }
}

const ConfirmSchema = z.object({
  pendingId: z.string(),
  action: z.enum(['confirm', 'reject']),
})

// ── POST — confirm or reject a pending alias ──
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => null)
    const validated = ConfirmSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      )
    }

    await connectDB()
    const userId = session.user.id
    const { pendingId, action } = validated.data

    const pending = await PendingAliasModel.findOne({ _id: pendingId, userId })
    if (!pending) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Pending alias not found' },
        { status: 404 }
      )
    }

    if (action === 'confirm') {
      // Write confirmed alias
      await AliasModel.findOneAndUpdate(
        { rawKey: pending.rawKey, userId },
        {
          canonicalKey: pending.suggestedKey,
          createdBy: 'user',
          confidence: 1.0,
        },
        { upsert: true }
      )

      // Retroactively update past events
      await EventModel.updateMany(
        { userId, metricKey: pending.rawKey },
        { $set: { metricKey: pending.suggestedKey } }
      )

      // Invalidate alias cache
      await cache.del(`alias:${userId}:${pending.rawKey}`)
    } else {
      // Write negative alias — never suggest again
      await AliasModel.findOneAndUpdate(
        { rawKey: pending.rawKey, userId },
        { canonicalKey: pending.rawKey, createdBy: 'user', confidence: 1.0 },
        { upsert: true }
      )
    }

    await PendingAliasModel.findByIdAndUpdate(pendingId, { status: action === 'confirm' ? 'confirmed' : 'rejected' })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/aliases error:', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to process alias' },
      { status: 500 }
    )
  }
}

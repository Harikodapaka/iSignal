import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import { cache } from '@/lib/cache';
import MetricModel from '@/models/Metric';
import { findMetric } from '@/lib/parser';
import type { ApiResponse, IMetric } from '@/types';

// ── GET /api/metrics?pinned=true ──
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const pinnedOnly = searchParams.get('pinned') === 'true';

    const cacheKey = pinnedOnly ? `metrics:pinned:${userId}` : `metrics:all:${userId}`;
    const cached = await cache.get<IMetric[]>(cacheKey);
    if (cached) return NextResponse.json<ApiResponse<IMetric[]>>({ success: true, data: cached });

    await connectDB();
    const query: Record<string, unknown> = { userId };
    if (pinnedOnly) query.pinned = true;

    const metrics = await MetricModel.find(query).sort({ pinned: -1, frequencyScore: -1 }).maxTimeMS(5000).lean();

    // Backfill unit for any metrics that were created before the unit-fallback fix
    const patched = metrics.map((m) => {
      if (m.unit != null) return m;
      const known = findMetric(m.metricKey);
      if (!known?.unit) return m;
      // Write fix to DB async — don't block the response
      MetricModel.updateOne({ _id: m._id }, { $set: { unit: known.unit } }).catch(() => {});
      return { ...m, unit: known.unit };
    });

    await cache.set(cacheKey, patched, pinnedOnly ? 300 : 120);

    return NextResponse.json<ApiResponse<IMetric[]>>({ success: true, data: patched as unknown as IMetric[] });
  } catch (err) {
    console.error('GET /api/metrics error:', err);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to fetch metrics' }, { status: 500 });
  }
}

const PatchSchema = z.object({
  metricKey: z.string().min(1),
  pinned: z.boolean().optional(),
  displayName: z.string().min(1).max(50).optional(),
  unit: z.string().max(20).optional().nullable(),
  aggregation: z.enum(['sum', 'avg', 'last']).optional(),
  valueType: z.enum(['boolean', 'number', 'text']).optional(),
});

// ── PATCH /api/metrics — update any editable field ──
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const validated = PatchSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    await connectDB();
    const userId = session.user.id;
    const { metricKey, ...updates } = validated.data;

    // Build $set from whichever fields were provided
    const $set: Record<string, unknown> = {};
    if (updates.pinned !== undefined) {
      $set.pinned = updates.pinned;
      // Track explicit unpin so auto-pin logic never overrides user intent
      if (updates.pinned === false) $set.userUnpinned = true;
      if (updates.pinned === true) $set.userUnpinned = false;
    }
    if (updates.displayName !== undefined) $set.displayName = updates.displayName;
    if (updates.unit !== undefined) $set.unit = updates.unit;
    if (updates.aggregation !== undefined) $set.aggregation = updates.aggregation;
    if (updates.valueType !== undefined) $set.valueType = updates.valueType;

    const metric = await MetricModel.findOneAndUpdate({ userId, metricKey }, { $set }, { new: true });

    if (!metric) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Metric not found' }, { status: 404 });
    }

    // Invalidate metric + analytics caches
    await cache.del(`metrics:pinned:${userId}`);
    await cache.del(`metrics:all:${userId}`);
    // Analytics cache must be cleared too if unit/aggregation changed
    for (const suffix of ['7d', '30d', '3mo']) {
      await cache.del(`analytics:${userId}:all:${suffix}`);
      await cache.del(`analytics:${userId}:${metricKey}:${suffix}`);
    }

    return NextResponse.json<ApiResponse<IMetric>>({ success: true, data: metric.toObject() as unknown as IMetric });
  } catch (err) {
    console.error('PATCH /api/metrics error:', err);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to update metric' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import { cache } from '@/lib/cache';
import { parseTzParam } from '@/lib/timezone';
import { toLocalDateString } from '@/lib/timezone';
import { logEvent } from '@/lib/log-event';
import EventModel from '@/models/Event';
import type { ApiResponse, IEvent } from '@/types';

const LogSchema = z.object({
  rawText: z.string().min(1, 'Cannot be empty').max(200, 'Too long').trim(),
  tz: z.string().max(50).optional(),
});

// ── GET /api/events?date=YYYY-MM-DD ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    await connectDB();
    const { searchParams } = new URL(req.url);
    const tz = parseTzParam(searchParams);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Range mode — used by the /logs page
    if (startDate && endDate) {
      const metricKeysParam = searchParams.get('metricKeys');
      const metricKeys = metricKeysParam ? metricKeysParam.split(',').filter(Boolean) : [];
      const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
      const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));
      const query: Record<string, unknown> = { userId, date: { $gte: startDate, $lte: endDate } };
      if (metricKeys.length === 1) query.metricKey = metricKeys[0];
      else if (metricKeys.length > 1) query.metricKey = { $in: metricKeys };

      const [events, total] = await Promise.all([
        EventModel.find(query)
          .sort({ date: -1, timestamp: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .maxTimeMS(5000)
          .lean(),
        EventModel.countDocuments(query).maxTimeMS(5000),
      ]);

      return NextResponse.json({ success: true, data: { events, total, page, limit } });
    }

    // Single-day mode — today page
    const date = searchParams.get('date') ?? toLocalDateString(tz);
    const events = await EventModel.find({ userId, date }).sort({ timestamp: -1 }).maxTimeMS(5000).lean();

    return NextResponse.json<ApiResponse<IEvent[]>>({ success: true, data: events as unknown as IEvent[] });
  } catch (err) {
    console.error('GET /api/events error:', err);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to fetch events' }, { status: 500 });
  }
}

// ── DELETE /api/events?id=... ─────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Missing id' }, { status: 400 });

    await connectDB();
    const event = await EventModel.findOneAndDelete({ _id: id, userId }).lean();
    if (!event) return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Not found' }, { status: 404 });

    const mk = event.metricKey;
    await Promise.all([
      cache.del(`analytics:${userId}:${mk}:7d`),
      cache.del(`analytics:${userId}:${mk}:30d`),
      cache.del(`analytics:${userId}:${mk}:3mo`),
      cache.del(`analytics:${userId}:all:7d`),
      cache.del(`analytics:${userId}:all:30d`),
      cache.del(`analytics:${userId}:all:3mo`),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/events error:', err);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to delete event' }, { status: 500 });
  }
}

// ── PATCH /api/events ─────────────────────────────────────────────────────────
const PatchEventSchema = z.object({
  id: z.string().min(1),
  value: z.union([z.number(), z.boolean(), z.string()]),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const body = await req.json().catch(() => null);
    const validated = PatchEventSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    await connectDB();
    const { id, value } = validated.data;
    const event = await EventModel.findOneAndUpdate({ _id: id, userId }, { $set: { value } }, { new: true }).lean();

    if (!event) return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Not found' }, { status: 404 });

    const mk = event.metricKey;
    await Promise.all([
      cache.del(`analytics:${userId}:${mk}:7d`),
      cache.del(`analytics:${userId}:${mk}:30d`),
      cache.del(`analytics:${userId}:${mk}:3mo`),
      cache.del(`analytics:${userId}:all:7d`),
      cache.del(`analytics:${userId}:all:30d`),
      cache.del(`analytics:${userId}:all:3mo`),
    ]);

    return NextResponse.json<ApiResponse<IEvent>>({ success: true, data: event as unknown as IEvent });
  } catch (err) {
    console.error('PATCH /api/events error:', err);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to update event' }, { status: 500 });
  }
}

// ── POST /api/events ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const rl = await cache.checkRateLimit(userId, 'events', 60, 60);
    if (!rl.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Too many requests. Slow down.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const validated = LogSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { rawText, tz } = validated.data;
    const result = await logEvent(userId, rawText, tz, (p) => waitUntil(p));

    if (!result.ok) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: result.error }, { status: result.status });
    }

    if (result.pending) {
      return NextResponse.json<ApiResponse<{ id: string }>>({ success: true, data: { id: result.id } });
    }

    return NextResponse.json<ApiResponse<IEvent>>({ success: true, data: result.event }, { status: 201 });
  } catch (err) {
    console.error('POST /api/events error:', err);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to create event' }, { status: 500 });
  }
}

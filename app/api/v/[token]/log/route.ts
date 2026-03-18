import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { cache } from '@/lib/cache';
import { logEvent } from '@/lib/log-event';
import VoiceTokenModel, { IVoiceToken } from '@/models/VoiceToken';

const VoiceLogSchema = z.object({
  text: z.string().min(1, 'Cannot be empty').max(200, 'Too long').trim(),
  tz: z.string().max(50).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 });
    }

    await connectDB();

    // Look up the voice token to get the userId
    const voiceToken = await VoiceTokenModel.findOne({ token }).lean<IVoiceToken>();
    if (!voiceToken) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = voiceToken.userId;

    // Rate limit per user
    const rl = await cache.checkRateLimit(userId, 'events', 60, 60);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests. Slow down.' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const validated = VoiceLogSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ success: false, error: validated.error.errors[0].message }, { status: 400 });
    }

    const { text, tz } = validated.data;
    const result = await logEvent(userId, text, tz);

    // Update lastUsedAt (fire and forget)
    VoiceTokenModel.updateOne({ _id: voiceToken._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    if (result.pending) {
      return NextResponse.json({
        success: true,
        message: 'Logged. AI is resolving the metric.',
      });
    }

    // Return a simple response that Siri can speak
    const event = result.event;
    return NextResponse.json(
      {
        success: true,
        metric: event.metricKey,
        value: event.value,
        unit: event.unit,
        message: `Logged ${event.metricKey}${event.value !== true ? ': ' + event.value : ''}${event.unit ? ' ' + event.unit : ''}`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/v/[token]/log error:', err);
    return NextResponse.json({ success: false, error: 'Failed to log' }, { status: 500 });
  }
}

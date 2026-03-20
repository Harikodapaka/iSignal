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
  const start = Date.now();
  try {
    const { token } = await params;
    console.log(`[voice-log] ▶ POST /api/v/[token]/log — token=${token?.slice(0, 8)}...`);

    if (!token) {
      console.log('[voice-log] ✗ Missing token');
      return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 });
    }

    await connectDB();
    console.log(`[voice-log] DB connected (${Date.now() - start}ms)`);

    // Look up the voice token to get the userId
    const voiceToken = await VoiceTokenModel.findOne({ token }).lean<IVoiceToken>();
    if (!voiceToken) {
      console.log(`[voice-log] ✗ Invalid token: ${token.slice(0, 8)}...`);
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = voiceToken.userId;
    console.log(`[voice-log] Token valid — userId=${userId} (${Date.now() - start}ms)`);

    // Rate limit per user
    const rl = await cache.checkRateLimit(userId, 'events', 60, 60);
    if (!rl.allowed) {
      console.log(`[voice-log] ✗ Rate limited — userId=${userId}`);
      return NextResponse.json({ success: false, error: 'Too many requests. Slow down.' }, { status: 429 });
    }

    const body = await req.json().catch((err) => {
      console.log(`[voice-log] ✗ JSON parse error:`, err?.message);
      return null;
    });
    if (!body) {
      console.log('[voice-log] ✗ Invalid JSON body (null after parse)');
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }
    console.log(`[voice-log] Body:`, JSON.stringify(body));

    const validated = VoiceLogSchema.safeParse(body);
    if (!validated.success) {
      const errMsg = validated.error.errors[0].message;
      console.log(`[voice-log] ✗ Validation failed: ${errMsg}`, JSON.stringify(validated.error.errors));
      return NextResponse.json({ success: false, error: errMsg }, { status: 400 });
    }

    const { text, tz } = validated.data;
    console.log(`[voice-log] Parsed — text="${text}" tz=${tz ?? 'none'} (${Date.now() - start}ms)`);

    const result = await logEvent(userId, text, tz);
    console.log(`[voice-log] logEvent result — ok=${result.ok} (${Date.now() - start}ms)`);

    // Update lastUsedAt (fire and forget)
    VoiceTokenModel.updateOne({ _id: voiceToken._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

    if (!result.ok) {
      console.log(`[voice-log] ✗ logEvent error: ${result.error} (status=${result.status})`);
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    if (result.pending) {
      console.log(`[voice-log] ✓ Pending — AI resolving (${Date.now() - start}ms)`);
      return NextResponse.json({
        success: true,
        message: 'Logged. AI is resolving the metric.',
      });
    }

    // Return a simple response that Siri can speak
    const event = result.event;
    console.log(`[voice-log] ✓ Logged ${event.metricKey}=${event.value} ${event.unit ?? ''} (${Date.now() - start}ms)`);
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
    console.error(`[voice-log] ✗ Unhandled error (${Date.now() - start}ms):`, err);
    return NextResponse.json({ success: false, error: 'Failed to log' }, { status: 500 });
  }
}

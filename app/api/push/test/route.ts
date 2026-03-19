import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import PushSubscription from '@/models/PushSubscription';
import { sendPush } from '@/lib/push-sender';

// POST — send a test notification to the current user
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const subs = await PushSubscription.find({
      userId: session.user.id,
      enabled: true,
    }).lean();

    if (subs.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active push subscriptions. Enable notifications in Settings first.',
      });
    }

    let sent = 0;
    const errors: string[] = [];
    for (const sub of subs) {
      try {
        const result = await sendPush(
          {
            endpoint: sub.endpoint as string,
            keys: sub.keys as { p256dh: string; auth: string },
          },
          {
            title: 'iSignal test! 🎉',
            body: "If you're reading this, push notifications are working!",
            url: '/today',
          }
        );
        if (result === 'sent') sent++;
      } catch (err) {
        const msg = (err as Error).message || String(err);
        console.error('[push/test] Send failed:', msg);
        errors.push(msg);
      }
    }

    return NextResponse.json({
      success: sent > 0,
      sent,
      total: subs.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[push/test] Error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message || 'Server error' }, { status: 500 });
  }
}

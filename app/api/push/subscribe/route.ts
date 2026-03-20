import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import PushSubscription from '@/models/PushSubscription';

// POST — subscribe to push notifications
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription, timezone } = await req.json();
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ success: false, error: 'Invalid subscription' }, { status: 400 });
    }

    await connectDB();

    // Delete any old subscriptions for this user (prevents stale 410 endpoints)
    const deleted = await PushSubscription.deleteMany({
      userId: session.user.id,
      endpoint: { $ne: subscription.endpoint },
    });
    if (deleted.deletedCount > 0) {
      console.log(`[push/subscribe] Cleaned ${deleted.deletedCount} old subscription(s)`);
    }

    // Upsert by endpoint (same browser re-subscribing updates keys)
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        userId: session.user.id,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        enabled: true,
        timezone: timezone || 'UTC',
        lastNotifiedAt: {},
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[push/subscribe] POST error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// DELETE — unsubscribe from push notifications
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint } = await req.json();
    if (!endpoint) {
      return NextResponse.json({ success: false, error: 'Missing endpoint' }, { status: 400 });
    }

    await connectDB();
    await PushSubscription.deleteOne({ endpoint, userId: session.user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[push/subscribe] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// GET — check subscription status
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const count = await PushSubscription.countDocuments({
      userId: session.user.id,
      enabled: true,
    });

    return NextResponse.json({ success: true, subscribed: count > 0 });
  } catch (error) {
    console.error('[push/subscribe] GET error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import PushSubscription from '@/models/PushSubscription';
import MetricModel from '@/models/Metric';
import EventModel from '@/models/Event';
import { sendPush } from '@/lib/push-sender';
import { buildNotificationContext, getNotificationWindow, getLocalHour } from '@/lib/notification-context';
import {
  getMorningMessage,
  getMiddayMessage,
  getEveningMessage,
  getMetricReminderMessage,
} from '@/lib/notification-messages';
import { toLocalDateString } from '@/lib/timezone';

export const maxDuration = 30; // Allow up to 30s for batch sending

export async function POST(req: NextRequest) {
  // Authenticate with CRON_SECRET
  const authHeader = req.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();

    // Fetch all enabled subscriptions
    const subscriptions = await PushSubscription.find({ enabled: true }).lean();

    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No active subscriptions' });
    }

    // Group subscriptions by userId
    const byUser = new Map<string, typeof subscriptions>();
    for (const sub of subscriptions) {
      const userId = sub.userId as string;
      if (!byUser.has(userId)) byUser.set(userId, []);
      byUser.get(userId)!.push(sub);
    }

    let sent = 0;
    let skipped = 0;
    let cleaned = 0;

    // Process each user
    const results = await Promise.allSettled(
      Array.from(byUser.entries()).map(async ([userId, userSubs]) => {
        // Use the timezone from the first subscription
        const tz = (userSubs[0].timezone as string) || 'UTC';
        const window = getNotificationWindow(tz);

        if (!window) {
          skipped += userSubs.length;
          return; // Not time for any notification in this timezone
        }

        // Check if already notified in this window today
        const today = toLocalDateString(tz);
        const notifiedKey = `${window}:${today}`;
        const lastNotified = (userSubs[0].lastNotifiedAt as Record<string, string>) || {};

        if (lastNotified[notifiedKey]) {
          skipped += userSubs.length;
          return; // Already sent this window today
        }

        // Build notification context
        const ctx = await buildNotificationContext(userId, tz);

        // Pick the right message based on window
        let message;
        switch (window) {
          case 'morning':
            message = getMorningMessage(ctx);
            break;
          case 'midday':
            message = getMiddayMessage(ctx);
            break;
          case 'evening':
            message = getEveningMessage(ctx);
            break;
        }

        // Send to all of this user's subscriptions
        for (const sub of userSubs) {
          const result = await sendPush(
            {
              endpoint: sub.endpoint as string,
              keys: sub.keys as { p256dh: string; auth: string },
            },
            message
          );

          if (result === 'sent') {
            sent++;
            // Mark as notified
            await PushSubscription.updateOne(
              { _id: sub._id },
              { $set: { [`lastNotifiedAt.${notifiedKey}`]: new Date() } }
            );
          } else if (result === 'gone') {
            // Subscription expired — clean up
            await PushSubscription.deleteOne({ _id: sub._id });
            cleaned++;
          }
        }

        // ── Per-metric reminders ──
        const localHour = getLocalHour(tz);
        const metricsWithReminders = await MetricModel.find({
          userId,
          'reminder.enabled': true,
          'reminder.times': localHour,
        })
          .select('metricKey displayName')
          .lean()
          .maxTimeMS(5000);

        if (metricsWithReminders.length > 0) {
          // Check which metrics have already been logged today
          const todayEvents = await EventModel.find({ userId, date: today }).select('metricKey').lean().maxTimeMS(5000);
          const loggedKeys = new Set(todayEvents.map((e) => (e as { metricKey: string }).metricKey));

          for (const metric of metricsWithReminders) {
            const mk = metric as { metricKey: string; displayName: string };
            if (loggedKeys.has(mk.metricKey)) continue; // Already logged today

            const metricNotifKey = `metric:${mk.metricKey}:${localHour}:${today}`;
            const alreadySent = (userSubs[0].lastNotifiedAt as Record<string, string>)?.[metricNotifKey];
            if (alreadySent) continue;

            const metricMessage = getMetricReminderMessage(mk.metricKey, mk.displayName);

            for (const sub of userSubs) {
              const result = await sendPush(
                {
                  endpoint: sub.endpoint as string,
                  keys: sub.keys as { p256dh: string; auth: string },
                },
                metricMessage
              );

              if (result === 'sent') {
                sent++;
                await PushSubscription.updateOne(
                  { _id: sub._id },
                  { $set: { [`lastNotifiedAt.${metricNotifKey}`]: new Date() } }
                );
              } else if (result === 'gone') {
                await PushSubscription.deleteOne({ _id: sub._id });
                cleaned++;
              }
            }
          }
        }
      })
    );

    // Count errors
    const errors = results.filter((r) => r.status === 'rejected').length;

    console.log(`[cron/notifications] sent=${sent} skipped=${skipped} cleaned=${cleaned} errors=${errors}`);

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      cleaned,
      errors,
    });
  } catch (error) {
    console.error('[cron/notifications] Error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

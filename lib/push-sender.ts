import webpush from 'web-push';

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    throw new Error('VAPID keys not configured');
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:noreply@isignal.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidConfigured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Send a push notification to a browser subscription.
 * Returns 'sent' on success, 'gone' if the subscription is expired/invalid.
 */
export async function sendPush(subscription: PushSubscriptionData, payload: PushPayload): Promise<'sent' | 'gone'> {
  ensureVapid();
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify({
        ...payload,
        icon: payload.icon || '/android-icon-192x192.png',
        badge: payload.badge || '/favicon-96x96.png',
        url: payload.url || '/today',
      })
    );
    return 'sent';
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    console.error('[push-sender] Send failed, status:', statusCode);
    if (statusCode === 410 || statusCode === 404) {
      return 'gone'; // subscription expired — caller should delete it
    }
    throw err; // re-throw so callers can see the actual error
  }
}

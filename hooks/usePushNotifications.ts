'use client';

import { useCallback, useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(true);

  // Check support and current status on mount
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setIsSupported(supported);

    if (!supported) {
      setLoading(false);
      return;
    }

    setPermission(Notification.permission);

    // Check if already subscribed
    navigator.serviceWorker.ready.then(async (reg) => {
      try {
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;

    setLoading(true);
    try {
      // Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setLoading(false);
        return false;
      }

      // Get SW registration
      const reg = await navigator.serviceWorker.ready;

      // Unsubscribe any existing push subscription first (clean slate)
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      // Subscribe to push
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error('[push] VAPID public key not configured');
        setLoading(false);
        return false;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });

      const subJson = subscription.toJSON();

      // Send subscription to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subJson,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsSubscribed(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[push] Subscribe error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;

    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Remove from server
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error('[push] Unsubscribe error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  return {
    isSubscribed,
    isSupported,
    permission,
    loading,
    subscribe,
    unsubscribe,
  };
}

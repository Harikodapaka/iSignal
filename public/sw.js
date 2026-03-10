/* global self, caches, URL */

// iSignal Service Worker
// Version: 1.0.0
//
// Current: minimal SW to satisfy PWA install criteria
// Future:  offline support, background sync, push notifications

const SW_VERSION = 'isignal-v1'

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', () => {
    // TODO: add offline shell caching here
    // const STATIC_CACHE_URLS = ['/', '/today', '/trends', '/metrics']
    // event.waitUntil(
    //   caches.open(SW_VERSION).then((cache) => cache.addAll(STATIC_CACHE_URLS))
    // )
    self.skipWaiting()
})

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== SW_VERSION)
                    .map((key) => caches.delete(key))
            )
        )
    )
    self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url)

    // Never intercept API calls or non-GET requests
    if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
        return
    }

    // TODO: cache-first for static assets (_next/static/*)
    // TODO: network-first with offline fallback for navigation
})

// ── Background Sync (future) ──────────────────────────────────────────────────
// self.addEventListener('sync', (event) => {
//   if (event.tag === 'sync-events') {
//     event.waitUntil(replayQueuedEvents())
//   }
// })

// ── Push Notifications (future) ───────────────────────────────────────────────
// self.addEventListener('push', (event) => { ... })
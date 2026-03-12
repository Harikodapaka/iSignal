/* global self, caches, URL, fetch, Response */

// iSignal Service Worker
// Version: 3.0.0
//
// Strategy:
//  - Cache-first forever for _next/static/* (content-hashed)
//  - Cache-first with TTL + size cap for images
//  - Network-first for navigation with offline fallback (last cached page)

// ── Config (tune these to find the sweet spot) ──────────────────────────────
const CACHE_CONFIG = {
    IMAGE_TTL_HOURS: 24,   // Serve image from cache for this long before revalidating
    IMAGE_MAX_ENTRIES: 60, // Max images to keep cached (FIFO eviction beyond this)
}

const STATIC_CACHE = 'isignal-static-v2'
const IMAGE_CACHE = 'isignal-images-v1'
const PAGES_CACHE = 'isignal-pages-v1'

const KNOWN_CACHES = [STATIC_CACHE, IMAGE_CACHE, PAGES_CACHE]

// Returns true if a cached response is still within its TTL.
// Uses the standard HTTP `Date` response header.
function isFresh(response, maxAgeHours) {
    const date = response.headers.get('Date')
    if (!date) return false // no Date header → treat as stale, always revalidate
    const ageHours = (Date.now() - new Date(date).getTime()) / 3_600_000
    return ageHours < maxAgeHours
}

// Delete the oldest (FIFO) entries when a cache grows past maxEntries.
async function trimCache(cacheName, maxEntries) {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    if (keys.length > maxEntries) {
        const toDelete = keys.slice(0, keys.length - maxEntries)
        await Promise.all(toDelete.map((k) => cache.delete(k)))
    }
}

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', () => {
    self.skipWaiting()
})

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => !KNOWN_CACHES.includes(key))
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

    // Cache-first forever for Next.js static assets (content-hashed filenames)
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(
            caches.open(STATIC_CACHE).then((cache) =>
                cache.match(event.request).then((cached) => {
                    if (cached) return cached
                    return fetch(event.request).then((response) => {
                        if (response.ok) cache.put(event.request, response.clone())
                        return response
                    })
                })
            )
        )
        return
    }

    // Images: cache-first with TTL revalidation + size cap
    if (
        url.pathname.match(/\.(png|ico|jpg|jpeg|svg|webp)$/) &&
        url.origin === self.location.origin
    ) {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(async (cache) => {
                const cached = await cache.match(event.request)

                // Serve from cache if still fresh
                if (cached && isFresh(cached, CACHE_CONFIG.IMAGE_TTL_HOURS)) {
                    return cached
                }

                // Stale or missing — fetch fresh from network
                try {
                    const response = await fetch(event.request)
                    if (response.ok) {
                        await cache.put(event.request, response.clone())
                        trimCache(IMAGE_CACHE, CACHE_CONFIG.IMAGE_MAX_ENTRIES) // non-blocking
                    }
                    return response
                } catch {
                    // Offline — return stale copy rather than nothing
                    return cached ?? Response.error()
                }
            })
        )
        return
    }

    // Navigation: network-first, cache on success, offline fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.ok) {
                        const cloned = response?.clone?.()
                        caches
                            .open(PAGES_CACHE)
                            .then((cache) => cache.put(event.request, cloned))
                    }
                    return response
                })
                .catch(() =>
                    // Offline — return the cached version of this URL, or fall back
                    // to the last cached /today as the app shell
                    caches.open(PAGES_CACHE).then((cache) =>
                        cache
                            .match(event.request)
                            .then((cached) => cached ?? cache.match('/today'))
                    )
                )
        )
        return
    }
})

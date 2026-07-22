/*
 * Cožy service worker — hand-written (Turbopack has no Serwist/webpack plugin),
 * runtime caching only, no build-time precache manifest.
 *
 * Strategies:
 *  - navigations            → network-first, fallback to cache, then cached '/'
 *  - /_next/static/*        → cache-first (content-hashed, immutable; includes
 *                             the next/font self-hosted woff2 files)
 *  - Supabase /rest/v1/ GET → network-first, fallback to cache (last-known data offline)
 *
 * Bump VERSION to invalidate all caches on the next activate.
 */

const VERSION = 'v7';
const PAGES = `cozy-pages-${VERSION}`;
const STATIC = `cozy-static-${VERSION}`;
const DATA = `cozy-data-${VERSION}`;
const ALL_CACHES = [PAGES, STATIC, DATA];

const SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

// The DATA cache accumulates a new entry per distinct REST URL — per-date
// calendar queries alone would grow it without bound. Oldest entries beyond
// the cap are evicted after each write (Cache keys are insertion-ordered).
const DATA_MAX_ENTRIES = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      // addAll is atomic — one transient failure would block the whole
      // install. Cache each shell asset independently instead.
      .then((cache) => Promise.allSettled(SHELL.map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Evict oldest entries beyond maxEntries. cache.put re-appends an existing
// request, so insertion order ≈ recency for network-first traffic.
async function pruneCache(cache, maxEntries) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - maxEntries; i++) await cache.delete(keys[i]);
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const write = cache.put(request, response.clone());
      if (cacheName === DATA) write.then(() => pruneCache(cache, DATA_MAX_ENTRIES)).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGES, '/'));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }

  // Supabase REST reads — matches any Supabase origin without hardcoding it.
  // Auth (/auth/v1/) and functions (/functions/v1/) are deliberately untouched.
  if (url.pathname.startsWith('/rest/v1/')) {
    event.respondWith(networkFirst(request, DATA));
    return;
  }
});

// ─── Web push ────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  // Always show a notification — iOS revokes subscriptions that receive
  // pushes without a user-visible result.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Cožy';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      tag: payload.tag,
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  const tab = targetUrl.includes('#') ? targetUrl.split('#')[1] : '';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        const client = clients[0];
        if (tab) client.postMessage({ type: 'navigate', tab });
        return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  // Best-effort resubscribe; the client reconciles the DB row on next app open.
  const oldSub = event.oldSubscription;
  if (!oldSub || !oldSub.options) return;
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: oldSub.options.applicationServerKey,
      })
      .catch(() => {}),
  );
});

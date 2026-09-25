/* ==========================================================================
   bilo PWA Service Worker
   Provides App Shell Cache & Network-First / Stale-While-Revalidate Caching
   ========================================================================== */

const CACHE_NAME = 'bilo-pwa-v1.1.2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/bilo-icon-dark.png',
  '/bilo-icon-light.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap',
  'https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css',
  'https://cdn-uicons.flaticon.com/2.6.0/uicons-solid-rounded/css/uicons-solid-rounded.css',
  'https://cdn-uicons.flaticon.com/2.6.0/uicons-brands/css/uicons-brands.css'
];

// Install Event: Pre-cache App Shell & Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[bilo SW] Pre-caching application shell & styles');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[bilo SW] Static asset cache warning:', err);
      });
    })
  );
});

// Message Event: Skip waiting when client prompts update reload
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate Event: Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[bilo SW] Cleaning old cache bucket:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Cache Strategy
self.addEventListener('fetch', (event) => {
  // Ignore non-GET HTTP calls
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Supabase API queries: NEVER intercept, cache, or respond to Supabase requests from SW.
  // Bypass Service Worker completely so browser handles network requests directly to Supabase.
  if (url.hostname.endsWith('.supabase.co') || url.hostname === 'supabase.co') {
    return;
  }

  // 2. Navigation / App Shell HTML: Network first with Cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match(event.request);
        })
    );
    return;
  }

  // 3. Static Assets (JS, CSS, Fonts, Images): Cache First with Background Revalidation
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

/* ==========================================================================
   Push Notifications & Notification Interactions
   ========================================================================== */

// Push Event Listener: Receives Web Push Payloads & Renders Native Notification
self.addEventListener('push', (event) => {
  let data = {
    title: 'bilo Task Manager',
    body: 'You have a new update in your workspace.',
    icon: '/bilo-icon-dark.png',
    badge: '/bilo-icon-dark.png',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = { ...data, ...parsed };
      } else if (typeof parsed === 'string') {
        data.body = parsed;
      }
    } catch (e) {
      try {
        const textContent = event.data.text();
        if (textContent) {
          data.body = textContent;
        }
      } catch (textErr) {
        console.warn('[bilo SW] Failed to parse push payload text:', textErr);
      }
    }
  }

  const options = {
    body: String(data.body || 'You have a new update in your workspace.'),
    icon: data.icon || '/bilo-icon-dark.png',
    badge: data.badge || '/bilo-icon-dark.png',
    vibrate: [100, 50, 100],
    data: data.data || { url: '/' },
    actions: data.actions || [
      { action: 'open', title: 'Open Workspace' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  const notificationTitle = String(data.title || 'bilo Task Manager');

  event.waitUntil(
    self.registration.showNotification(notificationTitle, options).catch((err) => {
      console.error('[bilo SW] showNotification failed:', err);
    })
  );
});

// Notification Click Listener: Focuses Window or Opens URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});


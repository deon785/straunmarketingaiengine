// public/sw.js - FINAL CORRECTED VERSION
const CACHE_NAME = 'straun-static-v1';

// Only cache essential static files
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/pwa-192x192.png',
  '/pwa-512x512.png'
];

// Install - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  // ✅ ADD THIS: Force waiting service worker to become active
  self.skipWaiting();
});

// Activate - clean old caches and take control
self.addEventListener('activate', event => {
  console.log('[SW] Activating');
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  // ✅ ADD THIS: Take control of all clients immediately
  self.clients.claim();
});

// Fetch - network first, Vercel handles updates
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // CRITICAL FIX: Skip ALL problematic requests
  if (url.startsWith('ws://') || 
      url.startsWith('wss://') ||
      url.includes('/realtime/') ||
      url.includes('supabase.co') ||
      url.includes('sentry.io') ||
      url.includes('ingest') ||
      url.includes('/api/') || 
      url.includes('/supabase/')) {
    // ✅ Just pass through, don't log too much (optional)
    // console.log('[SW] Bypassing:', url.split('?')[0]);
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        // Only offline fallback
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        return caches.match(event.request);
      })
  );
});

// Keep push notifications
self.addEventListener('push', event => {
  if (event.data) {
    event.waitUntil(
      self.registration.showNotification('StraunAI', {
        body: event.data.text(),
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        vibrate: [200, 100, 200]
      })
    );
  }
});
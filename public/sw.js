// public/sw.js - MINIMALIST VERSION (BEST FOR YOUR CASE)
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

// Install - just cache, no activation tricks
self.addEventListener('install', event => {
  console.log('[SW] Installing');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Activate - clean old caches, NO claiming
self.addEventListener('activate', event => {
  console.log('[SW] Activating');
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});

// Fetch - network first, Vercel handles updates
self.addEventListener('fetch', event => {
  // Skip API calls
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('/supabase/')) {
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

// Keep push notifications (if needed)
self.addEventListener('push', event => {
  if (event.data) {
    event.waitUntil(
      self.registration.showNotification('StraunAI', {
        body: event.data.text(),
        icon: '/pwa-192x192.png'
      })
    );
  }
});
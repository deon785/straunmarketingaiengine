// public/sw.js - FIXED VERSION
const CACHE_NAME = 'straun-static-v1';
const OFFLINE_URL = '/offline.html';

// Only cache these exact assets (NO API routes)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  OFFLINE_URL
];

// Install - cache static assets only
self.addEventListener('install', event => {
  console.log('[SW] Installing');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Only cache what exists
      for (const asset of STATIC_ASSETS) {
        try {
          const response = await fetch(asset);
          if (response.ok) {
            await cache.put(asset, response);
          }
        } catch (e) {
          console.log(`[SW] Could not cache ${asset}`);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating');
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// Fetch - NETWORK FIRST for all navigation (CRITICAL FIX)
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // CRITICAL: NEVER cache API calls or Supabase requests
  if (url.includes('/rest/v1/') || 
      url.includes('/functions/') ||
      url.includes('/auth/') ||
      url.includes('supabase.co') ||
      url.includes('?') ||
      event.request.method !== 'GET') {
    // Go straight to network, don't try cache
    event.respondWith(fetch(event.request));
    return;
  }
  
  // For navigation (page loads) - NETWORK FIRST, then fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Only show offline page if completely offline
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }
  
  // For static assets - cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
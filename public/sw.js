// public/sw.js - COMPLETE PRODUCTION VERSION WITH ERROR HANDLING

const CACHE_NAME = 'straun-static-v1';
const OFFLINE_URL = '/offline.html';

// Only cache these exact assets (NO API routes)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  OFFLINE_URL
];

// List of external domains that should NEVER be cached or logged as errors
const EXTERNAL_DOMAINS = [
  'googleapis.com',
  'googletagmanager.com',
  'gtag',
  'npm/',
  'unpkg.com',
  'cdn.jsdelivr.net'
];

// Helper to check if URL is external resource that we should silently ignore
function shouldSilentlyIgnore(url) {
  return EXTERNAL_DOMAINS.some(domain => url.includes(domain));
}

// ========== GLOBAL ERROR HANDLERS (CRITICAL) ==========
self.addEventListener('error', (event) => {
  console.error('[SW] Uncaught error:', event.error);
  // Prevent SW from crashing
  event.preventDefault();
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
  // Prevent SW from crashing
  event.preventDefault();
});

// ========== SERVICE WORKER LIFECYCLE ==========
self.addEventListener('install', event => {
  console.log('[SW] Installing');
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        for (const asset of STATIC_ASSETS) {
          try {
            const response = await fetch(asset);
            if (response && response.ok) {
              await cache.put(asset, response);
              console.log(`[SW] Cached: ${asset}`);
            } else {
              console.warn(`[SW] Failed to cache: ${asset}`);
            }
          } catch (err) {
            console.warn(`[SW] Error caching ${asset}:`, err);
          }
        }
        console.log('[SW] Install completed');
      } catch (err) {
        console.error('[SW] Install failed:', err);
      }
    })()
  );
  
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating');
  
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter(key => key !== CACHE_NAME).map(key => {
            console.log(`[SW] Deleting old cache: ${key}`);
            return caches.delete(key);
          })
        );
        console.log('[SW] Activation completed');
      } catch (err) {
        console.error('[SW] Activation failed:', err);
      }
    })()
  );
  
  // Take control of all clients immediately
  event.waitUntil(self.clients.claim());
});

// ========== PUSH NOTIFICATIONS (WITH ERROR HANDLING) ==========
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  // Default notification data
  let notificationData = {
    title: 'StraunAI',
    body: 'You have a new notification',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    url: '/app'
  };
  
  // Parse push data safely
  if (event.data) {
    try {
      const parsed = event.data.json();
      notificationData = { ...notificationData, ...parsed };
    } catch (err) {
      console.warn('[SW] Could not parse push data as JSON, using text:', err);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }
  
  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(notificationData.title, {
          body: notificationData.body,
          icon: notificationData.icon,
          badge: notificationData.badge,
          vibrate: notificationData.vibrate,
          data: { url: notificationData.url },
          requireInteraction: false,
          silent: false
        });
        console.log('[SW] Notification shown successfully');
      } catch (err) {
        console.error('[SW] Failed to show notification:', err);
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/app';
  
  event.waitUntil(
    (async () => {
      try {
        // Get all window clients
        const windowClients = await clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });
        
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            await client.focus();
            console.log('[SW] Focused existing window');
            return;
          }
        }
        
        // Open new window if no existing one
        if (clients.openWindow) {
          await clients.openWindow(urlToOpen);
          console.log('[SW] Opened new window');
        }
      } catch (err) {
        console.error('[SW] Failed to handle notification click:', err);
        // Fallback: try to open window anyway
        try {
          await clients.openWindow('/app');
        } catch (fallbackErr) {
          console.error('[SW] Fallback also failed:', fallbackErr);
        }
      }
    })()
  );
});

// ========== FETCH HANDLING - SIMPLIFIED ==========
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const request = event.request;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip browser extensions and non-http
  if (!url.protocol.startsWith('http')) return;
  
  // NEVER intercept API calls or auth
  if (url.pathname.includes('/rest/v1/') || 
      url.pathname.includes('/auth/') ||
      url.hostname.includes('supabase.co')) {
    return; // Let browser handle normally
  }
  
  // For static assets only - cache first, network fallback
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|json)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  }
  
  // For everything else (including navigation to /app) - let browser handle it
});


// ========== PERIODIC CACHE CLEANUP (OPTIONAL) ==========
// Run cleanup once a week to remove old cache entries
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

// Check if periodic sync is supported before adding listener
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'clean-caches') {
      event.waitUntil(cleanCaches());
    }
  });
}

async function cleanCaches() {
  try {
    const cacheNames = await caches.keys();
    const now = Date.now();
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const dateHeader = response.headers.get('date');
          if (dateHeader) {
            const cacheDate = new Date(dateHeader).getTime();
            if (now - cacheDate > ONE_WEEK) {
              await cache.delete(request);
              console.log('[SW] Deleted old cache entry:', request.url);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[SW] Cache cleanup failed:', err);
  }
}
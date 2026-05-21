// public/push-sw.js
// This ONLY handles push notifications, NOT navigation

self.addEventListener('install', () => {
  console.log('[Push SW] Installing');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Push SW] Activating');
  event.waitUntil(self.clients.claim());
});

// Handle push notifications only
self.addEventListener('push', (event) => {
  console.log('[Push SW] Push received');
  
  let data = { title: 'StraunAI', body: 'New notification' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      data: { url: '/' }
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

// DO NOT handle fetch events here - let main SW handle them
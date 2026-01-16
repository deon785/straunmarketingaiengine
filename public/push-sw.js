// public/push-sw.js - Push notification service worker
self.addEventListener("push", function(event) {
  console.log("Push notification received");
  
  let data = {
    title: "StraunAI",
    body: "New notification!",
    icon: "/pwa-192x192.png",
    badge: "/favicon.ico"
  };
  
  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json };
    } catch (e) {
      console.log("Push data not JSON");
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: { url: "/" },
    vibrate: [200, 100, 200]
  };
  
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", function(event) {
  console.log("Notification clicked");
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});

self.addEventListener("install", function() {
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil(clients.claim());
});


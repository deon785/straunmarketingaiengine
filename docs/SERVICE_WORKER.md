# 📱 Service Worker Documentation

## Overview

The Service Worker (SW) provides **offline support**, **push notifications**, and **caching** for the Straun Marketing AI Engine PWA.

### File Location
`public/sw.js`

### Key Features
- ✅ Offline support with fallback page
- ✅ Push notifications
- ✅ Static asset caching
- ✅ Background sync support
- ✅ Automatic cache cleanup

---

## 📋 SW Lifecycle Events

### 1. Install Event

**Purpose:** Cache static assets during installation.

```javascript
self.addEventListener('install', event => {
  // Cache static assets
  // Skip waiting to activate immediately
});
```

**Cached Assets:**
- `/` (root)
- `/index.html`
- `/manifest.json`
- `/offline.html` (fallback page)

### 2. Activate Event

**Purpose:** Clean up old caches and take control.

```javascript
self.addEventListener('activate', event => {
  // Delete old caches
  // Claim all clients
});
```

**Cache Strategy:**
- Keep only `straun-static-v1`
- Delete all other caches
- Immediately control all pages

### 3. Fetch Event

**Purpose:** Serve cached assets or fallback.

```javascript
self.addEventListener('fetch', event => {
  // Skip API calls
  // Cache-first for static assets
  // Network-first for everything else
});
```

**Fetch Strategy:**

| Asset Type | Strategy | Description |
|------------|----------|-------------|
| Static Assets (JS, CSS, Images) | Cache First | Serve from cache, update in background |
| HTML Pages | Network First | Try network, fallback to cache |
| API Calls | Skip SW | Never intercept |
| Supabase Calls | Skip SW | Never intercept |

**Excluded URLs:**
- Supabase API (`/rest/v1/`, `/auth/`)
- External domains (Google APIs, CDN)
- Non-GET requests

---

## 🔔 Push Notifications

### Push Event Handler

```javascript
self.addEventListener('push', (event) => {
  // Parse notification data
  // Show notification
});
```

**Notification Payload:**
```json
{
  "title": "StraunAI",
  "body": "You have a new notification",
  "icon": "/pwa-192x192.png",
  "badge": "/pwa-192x192.png",
  "vibrate": [200, 100, 200],
  "url": "/app"
}
```

**Notification Behavior:**
- Requires interaction: `false`
- Silent: `false`
- Vibrate pattern: 200ms on, 100ms off, 200ms on

### Notification Click Handler

```javascript
self.addEventListener('notificationclick', (event) => {
  // Close notification
  // Focus existing window or open new
  // Navigate to specified URL
});
```

**Click Behavior:**
1. Closes the notification
2. Checks for existing window
3. Focuses existing window if found
4. Opens new window if none exists
5. Navigates to `/app` (or custom URL)

---

## 🗑️ Cache Cleanup

### Periodic Cache Cleanup

```javascript
// Run weekly
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

// Check if periodic sync is supported
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'clean-caches') {
      event.waitUntil(cleanCaches());
    }
  });
}
```

**Cleanup Process:**
1. Get all cache names
2. For each cache, check each request
3. Get response date header
4. Delete if older than 7 days

---

## 🛡️ Error Handling

### Global Error Handlers

```javascript
// Catch uncaught errors
self.addEventListener('error', (event) => {
  console.error('[SW] Uncaught error:', event.error);
  event.preventDefault(); // Prevent crash
});

// Catch unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
  event.preventDefault(); // Prevent crash
});
```

### Silent Ignore for External Resources

```javascript
const EXTERNAL_DOMAINS = [
  'googleapis.com',
  'googletagmanager.com',
  'gtag',
  'npm/',
  'unpkg.com',
  'cdn.jsdelivr.net'
];

function shouldSilentlyIgnore(url) {
  return EXTERNAL_DOMAINS.some(domain => url.includes(domain));
}
```

**Purpose:** Prevent noise from third-party resources that fail to load.

---

## 📦 Caching Strategy

### Static Assets Cached

| Asset | Purpose |
|-------|---------|
| `/` | Root page |
| `/index.html` | Main HTML |
| `/manifest.json` | PWA manifest |
| `/offline.html` | Offline fallback |

### Asset Types Cached

```javascript
// Matched by extension
.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|json)$
```

### Cache-First Strategy

1. Check cache for asset
2. If found, serve from cache
3. If not found, fetch from network
4. Cache response for future use
5. Serve response

### Network-First Strategy

1. Try network request
2. If success, cache and serve
3. If fail, serve from cache (if available)
4. If cache miss, serve offline page

---

## 🔧 Service Worker Registration

### Frontend Registration Code

```javascript
// In your app (SocialAIMarketingEngine.jsx)
useEffect(() => {
  const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return;
    }
    
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registered:', registration.scope);
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('🔄 New service worker found');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('✨ New version available');
            showToastNotification('New version available! Refresh to update.');
          }
        });
      });
      
      // Check if we should auto-subscribe to push
      const hasPromptedForPush = localStorage.getItem('push_prompted');
      if (!hasPromptedForPush && user && isProfileComplete) {
        setTimeout(async () => {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            localStorage.setItem('push_prompted', 'true');
          }
        }, 5000);
      }
      
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  };
  
  registerServiceWorker();
}, [user, isProfileComplete]);
```

### Push Subscription Registration

```javascript
// Subscribe to push notifications
const subscribeToPush = async () => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      showToastNotification('❌ Please allow notifications');
      return false;
    }

    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    }
    
    // Send subscription to server
    const result = await callEdgeFunction('send-push-notifications', {
      action: 'subscribe',
      subscription: subscription,
      userId: user.id,
      userAgent: navigator.userAgent
    });
    
    if (result.success) {
      showToastNotification('✅ Push notifications enabled!');
      return true;
    }
    
  } catch (error) {
    console.error('Push subscription error:', error);
    showToastNotification('⚠️ Error enabling notifications');
  }
  
  return false;
};
```

---

## 🧪 Testing

### Test Service Worker Registration

```javascript
// In browser console
navigator.serviceWorker.getRegistration()
  .then(reg => console.log('SW Registration:', reg));
```

### Test Push Notifications

```javascript
// In browser console (with SW active)
navigator.serviceWorker.ready.then(reg => {
  reg.showNotification('Test', {
    body: 'Working!',
    icon: '/pwa-192x192.png'
  });
});
```

### Test Offline Mode

1. Open app in browser
2. Open DevTools → Application → Service Workers
3. Check "Offline" checkbox
4. Navigate to pages
5. Offline fallback should appear

### Test Cache Cleanup

```javascript
// In browser console
caches.keys().then(keys => console.log('Caches:', keys));
caches.open('straun-static-v1').then(cache => 
  cache.keys().then(requests => 
    console.log('Cache entries:', requests.map(r => r.url))
  )
);
```

---

## 🔍 Debugging

### Chrome DevTools

1. Open DevTools (F12)
2. Go to **Application** tab
3. Click **Service Workers**
4. View:
   - Registration status
   - Cache storage
   - Push notifications
   - Sync events

### Common Issues

#### "Service Worker registration failed"
- Check if `sw.js` exists in `public/`
- Check for syntax errors
- Check HTTPS (required for SW)
- Clear browser cache

#### "Push not working"
- Check VAPID keys
- Check notification permission
- Check subscription in database
- Check Edge Function logs

#### "Offline not working"
- Check cache storage
- Check `offline.html` exists
- Check fetch event handling
- Check network requests

---

## 📊 Performance

### Cache Size
- Static assets: ~2-5MB
- Images: depends on usage
- Cache limit: browser managed (usually 50MB+)

### Cache Strategy Benefits
- Faster load times (cached assets)
- Reduced bandwidth usage
- Offline support
- Better user experience

### Browser Support
- Chrome: ✅ Full support
- Firefox: ✅ Full support
- Safari: ⚠️ Limited (some features)
- Edge: ✅ Full support

---

## 🔒 Security

### Service Worker Security

1. **HTTPS Required**
   - Service Workers only work on HTTPS
   - Localhost allowed for development

2. **Same Origin Policy**
   - SW can only control pages from same origin
   - Cannot intercept cross-origin requests

3. **No Sensitive Data in Cache**
   - Never cache user data (tokens, passwords)
   - Cache only static assets
   - Use network for dynamic content

4. **Sanitize Push Data**
   - Never trust push data
   - Sanitize before showing
   - Validate all payloads

---

## 📝 Updating the Service Worker

### Version Strategy

The SW uses a cache name for versioning:

```javascript
const CACHE_NAME = 'straun-static-v1';
```

**To update:**
1. Change `CACHE_NAME` version
2. Update `STATIC_ASSETS` if needed
3. Deploy new `sw.js`
4. Browser will install new SW
5. Old SW will be cleaned up

### Update Flow

1. User visits page
2. Browser checks for SW update
3. New SW installed in background
4. User navigates away and back
5. New SW activated
6. Old cache deleted

### Force Update

```javascript
// In browser console
navigator.serviceWorker.getRegistration()
  .then(reg => reg.update());
```

---

## 🚀 Deployment Checklist

- [ ] `sw.js` in `public/` folder
- [ ] `offline.html` in `public/` folder
- [ ] `manifest.json` configured
- [ ] VAPID keys generated and added to env
- [ ] Push subscription endpoint working
- [ ] Cache strategy tested
- [ ] Offline mode working
- [ ] Push notifications working
- [ ] Error handlers in place
- [ ] Cache cleanup configured

---

## 📚 Related Documentation

- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [VAPID Keys Guide](https://web.dev/articles/push-notifications-web-push-protocol)

---

## 🆘 Troubleshooting

### "Failed to register Service Worker"

**Solution:**
1. Check file path: `/sw.js` (must be at root)
2. Check for syntax errors
3. Check HTTPS or localhost
4. Check browser console for errors

### "Push notification not showing"

**Solution:**
1. Check notification permission
2. Check VAPID keys
3. Check Edge Function logs
4. Check subscription in database

### "Offline page not showing"

**Solution:**
1. Check `offline.html` exists
2. Check fetch event handler
3. Check cache contains offline page
4. Check network tab for errors

---

**Related Files:**
- `public/sw.js` - Service Worker
- `public/offline.html` - Offline fallback
- `public/manifest.json` - PWA manifest
- `src/PushNotificationHandler.jsx` - Push UI
- `supabase/functions/send-push-notifications/` - Push Edge Function

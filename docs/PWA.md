# 📱 Progressive Web App (PWA) Documentation

## Overview

The Straun Marketing AI Engine is a **Progressive Web App** that provides a native-app-like experience in the browser.

### Key Features
- ✅ Installable on home screen
- ✅ Offline support
- ✅ Push notifications
- ✅ Full-screen experience
- ✅ Fast loading
- ✅ App-like navigation

---

## 📋 Manifest.json Configuration

### File Location
`public/manifest.json`

### Complete Configuration

```json
{
  "name": "Straun Marketing AI Engine",
  "short_name": "StraunAI",
  "description": "AI-Powered Marketing Platform - Buy & Sell Products",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#667eea",
  "orientation": "portrait-primary",
  "scope": "./",
  "categories": ["business", "shopping", "social"],
  "icons": [
    {
      "src": "./pwa-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "./pwa-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "./pwa-maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "screenshots": [
    {
      "src": "./screenshot1.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Dashboard Screenshot"
    },
    {
      "src": "./screenshot2.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Mobile Screenshot"
    }
  ]
}
```

### Field Breakdown

| Field | Description | Value |
|-------|-------------|-------|
| `name` | Full app name | "Straun Marketing AI Engine" |
| `short_name` | Short version for home screen | "StraunAI" |
| `description` | App description for search engines | "AI-Powered Marketing Platform..." |
| `start_url` | Landing page when opened | "./" |
| `display` | Display mode | "standalone" (full-screen) |
| `background_color` | Splash screen background | "#ffffff" |
| `theme_color` | Browser UI theme | "#667eea" |
| `orientation` | Screen orientation | "portrait-primary" |
| `scope` | Pages included in app | "./" |
| `categories` | App store categories | ["business", "shopping", "social"] |

### Icons

| Icon | Size | Purpose | Description |
|------|------|---------|-------------|
| `pwa-192x192.png` | 192x192 | any | Standard app icon |
| `pwa-512x512.png` | 512x512 | any | High-res app icon |
| `pwa-maskable-512x512.png` | 512x512 | maskable | Adaptive icon (Android) |

### Screenshots (Optional)

| Screenshot | Size | Form Factor | Description |
|------------|------|-------------|-------------|
| `screenshot1.png` | 1280x720 | wide (desktop) | Desktop dashboard view |
| `screenshot2.png` | 750x1334 | narrow (mobile) | Mobile app view |

---

## 🏠 Installation Prompts

### Before Install Prompt

```javascript
// In SocialAIMarketingEngine.jsx
useEffect(() => {
  const handleBeforeInstallPrompt = (e) => {
    e.preventDefault();
    setDeferredPrompt(e);
    setShowInstallPrompt(true);
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  
  return () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  };
}, []);
```

### Install Prompt UI

```jsx
const PWAInstallPrompt = () => {
  if (!showInstallPrompt) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    sessionStorage.setItem('pwaPrompted', 'true');
  };

  return (
    <div className="pwa-install-prompt-overlay">
      <div className="pwa-install-prompt">
        <button className="pwa-install-close" onClick={handleDismiss}>×</button>
        <div className="pwa-install-content">
          <div className="pwa-install-icon">📱</div>
          <h3>Install Our App!</h3>
          <p>Get faster access, work offline, and receive notifications</p>
          <div className="pwa-install-features">
            <div className="pwa-feature">⚡ Faster loading</div>
            <div className="pwa-feature">📶 Works offline</div>
            <div className="pwa-feature">🔔 Push notifications</div>
            <div className="pwa-feature">🏠 Home screen icon</div>
          </div>
          <button className="pwa-install-button" onClick={handleInstall}>
            📲 Install Now
          </button>
          <button className="pwa-dismiss-button" onClick={handleDismiss}>
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
};
```

### iOS Install Instructions

For iOS devices (Safari only):

1. Tap the **Share** button (📤)
2. Scroll down and tap **"Add to Home Screen"**
3. Tap **"Add"** in the top right
4. App appears on home screen

---

## 📡 Service Worker Registration

### Registration Code

```javascript
// In SocialAIMarketingEngine.jsx
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
      
      // Ask for push notification permission
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

---

## 🔔 Push Notifications

### Push API Integration

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
    
    // Save subscription to database
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

### VAPID Key Conversion

```javascript
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

---

## 📱 iOS PWA Support

### iOS Limitations

| Feature | iOS Support | Workaround |
|---------|-------------|------------|
| Service Workers | ✅ Safari only | Must use Safari |
| Push Notifications | ❌ Not supported | Use web-based alerts |
| Installation | ✅ "Add to Home Screen" | Manual install |
| Offline Support | ✅ Yes | Works with SW |
| Full-screen | ✅ Yes | Standalone mode |

### iOS Meta Tags

```html
<!-- Add to index.html for iOS -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="StraunAI">
```

### iOS Splash Screens

```html
<!-- iPad Pro (12.9") -->
<link rel="apple-touch-startup-image" href="./splash-2732x2048.png" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)">

<!-- iPad (10.2") -->
<link rel="apple-touch-startup-image" href="./splash-2160x1620.png" media="(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2)">

<!-- iPhone 12/13/14 (6.1") -->
<link rel="apple-touch-startup-image" href="./splash-1170x2532.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)">
```

---

## 📊 PWA Audit Checklist

### Lighthouse PWA Score

**Target:** > 90

| Category | Score | Status |
|----------|-------|--------|
| Installable | 100% | ✅ |
| PWA Optimized | 100% | ✅ |
| Fast | 90%+ | ✅ |
| Accessible | 90%+ | ✅ |
| Best Practices | 90%+ | ✅ |

### Required Files

- [x] `manifest.json` - App manifest
- [x] `sw.js` - Service Worker
- [x] `offline.html` - Offline fallback
- [x] `pwa-192x192.png` - App icon
- [x] `pwa-512x512.png` - High-res icon
- [x] `pwa-maskable-512x512.png` - Adaptive icon

### Required Meta Tags

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#667eea">
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/pwa-192x192.png">
```

---

## 🚀 Deployment

### Vercel Deployment

```bash
# Deploy to Vercel
vercel --prod

# Verify PWA
# Check: https://your-app.vercel.app
```

### Netlify Deployment

```bash
# Deploy to Netlify
netlify deploy --prod

# Verify PWA
# Check: https://your-app.netlify.app
```

### Manual Deployment

1. Build the app:
   ```bash
   npm run build
   ```

2. Upload `dist/` folder to hosting
3. Verify `dist/sw.js` exists
4. Verify `dist/manifest.json` exists

---

## 🔍 Testing PWA

### Using Chrome DevTools

1. Open DevTools (F12)
2. Go to **Application** tab
3. Check:
   - **Manifest**: All fields present
   - **Service Workers**: Registered and active
   - **Storage**: Cache contents
   - **Installability**: Show "Install" button

### Using Lighthouse

1. Open DevTools
2. Go to **Lighthouse** tab
3. Select **PWA** category
4. Generate report
5. Fix any issues found

### Using PWA Builder

1. Go to [pwabuilder.com](https://pwabuilder.com)
2. Enter your app URL
3. Download package
4. Follow recommendations

---

## 🎨 Customization

### Theme Colors

```json
{
  "background_color": "#ffffff",
  "theme_color": "#667eea"
}
```

### Splash Screen Colors

```html
<!-- Add to index.html -->
<meta name="theme-color" content="#667eea">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

### App Name

```json
{
  "name": "Straun Marketing AI Engine",
  "short_name": "StraunAI"
}
```

---

## 🆘 Troubleshooting

### "App not installable"

**Solutions:**
1. Check `manifest.json` has all required fields
2. Check `sw.js` is registered
3. Check HTTPS (required for PWA)
4. Check `start_url` is correct
5. Check icons are valid

### "Offline not working"

**Solutions:**
1. Check `sw.js` fetch handler
2. Check cache contains assets
3. Check `offline.html` exists
4. Check browser console for errors

### "Push notifications not working"

**Solutions:**
1. Check VAPID keys are set
2. Check notification permission
3. Check subscription in database
4. Check Edge Function logs

### "iOS installation not working"

**Solutions:**
1. Must use Safari (not Chrome)
2. Check Apple meta tags
3. Check `apple-touch-icon` exists
4. Check splash screen sizes

---

## 📚 Resources

### Official Documentation
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Manifest Guide](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

### Tools
- [PWA Builder](https://www.pwabuilder.com)
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/)
- [Workbox](https://developers.google.com/workbox)

---

## ✅ PWA Checklist

- [ ] HTTPS enabled
- [ ] Manifest.json configured
- [ ] Service Worker registered
- [ ] Offline fallback page
- [ ] App icons (192x192, 512x512)
- [ ] Maskable icon (512x512)
- [ ] Theme colors set
- [ ] Push notifications configured
- [ ] iOS meta tags added
- [ ] Lighthouse PWA score > 90

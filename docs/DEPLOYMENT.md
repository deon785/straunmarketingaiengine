# 🚀 Deployment Guide

## Overview

The Straun Marketing AI Engine can be deployed on various platforms. This guide covers the most common deployment scenarios.

---

## Prerequisites

### Required Accounts
1. **Supabase** (free tier)
2. **Vercel** or **Netlify** (free tier)
3. **GitHub** (for repository)

### Required Tools
- Node.js v18+
- npm or yarn
- Git

---

## Environment Variables

### Required Variables

```env
# Supabase (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Google Analytics (Optional)
VITE_GA_TRACKING_ID=G-XXXXXXXXXX

# Sentry (Optional)
VITE_SENTRY_DSN=https://your-dsn@ingest.sentry.io/12345

# Push Notifications (Optional)
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

### How to Get Each Variable

**Supabase:**
1. Go to your Supabase dashboard
2. Click "Settings" → "API"
3. Copy URL and anon key

**Google Analytics:**
1. Create property in Google Analytics
2. Get tracking ID (G-XXXXXXXXXX)

**Sentry:**
1. Create project in Sentry
2. Get DSN from project settings

**VAPID Key:**
1. Generate using `web-push` library
2. Save both public and private keys

---

## Deployment Options

### Option 1: Vercel (Recommended)

#### Step 1: Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/social-ai-marketing-app.git
git push -u origin main
```

#### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add Environment Variables
6. Click "Deploy"

#### Step 3: Add Environment Variables in Vercel

In Vercel Dashboard:
1. Go to your project → Settings → Environment Variables
2. Add each variable with its value
3. Re-deploy if needed

---

### Option 2: Netlify

#### Step 1: Push Code to GitHub
(Same as above)

#### Step 2: Deploy to Netlify

1. Go to [netlify.com](https://netlify.com)
2. Click "Add New Site" → "Import an existing project"
3. Connect GitHub and select repository
4. Configure:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
5. Add Environment Variables
6. Click "Deploy Site"

---

### Option 3: Cloudflare Pages

1. Go to Cloudflare Dashboard → Pages
2. Connect to GitHub
3. Select repository
4. Configure:
   - **Build Command**: `npm run build`
   - **Build Output**: `dist`
   - **Environment Variables**: Add all
5. Deploy

---

### Option 4: Static Hosting (Any Host)

#### Build the App

```bash
npm run build
```

#### Upload `dist` Folder

Upload the entire `dist` folder to your hosting provider:
- AWS S3 + CloudFront
- Google Cloud Storage
- Firebase Hosting
- Any static hosting

---

## Supabase Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Note your URL and anon key

### 2. Run Database Migrations

In Supabase SQL Editor, run:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create all tables (see DATABASE.md)
-- Create all functions (see DATABASE.md)
-- Create all RLS policies (see DATABASE.md)
-- Create all triggers (see DATABASE.md)
```

### 3. Set Up Storage

1. Go to Storage → Create Bucket
2. Name: `product-images`
3. Set to public
4. Add RLS policies:

```sql
-- Allow public reads
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Allow authenticated uploads
CREATE POLICY "Authenticated Uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );
```

### 4. Set Up Authentication

1. Go to Authentication → Providers
2. Enable Email/Password
3. (Optional) Configure email templates
4. Set up redirect URLs in Site URL:
   - Production: `https://yourapp.com`
   - Development: `http://localhost:5173`

---

## PWA Configuration

### Manifest.json

Update `public/manifest.json`:

```json
{
  "name": "Straun Marketing AI Engine",
  "short_name": "Straun AI",
  "description": "AI-powered social marketplace",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#667eea",
  "icons": [
    {
      "src": "/pwa-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/pwa-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Service Worker

Update `public/sw.js` for your app:

```javascript
// Core assets to cache
const CACHE_NAME = 'straun-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/Straun-logo.png'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Push event
self.addEventListener('push', event => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' }
    })
  );
});
```

---

## Domain Setup

### Custom Domain (Vercel)

1. Go to your project → Settings → Domains
2. Add your domain
3. Follow DNS instructions
4. Wait for propagation (5-30 minutes)

### Custom Domain (Netlify)

1. Go to Site Settings → Domain Management
2. Add custom domain
3. Configure DNS settings
4. Wait for propagation

---

## SSL/HTTPS

All major platforms automatically provide SSL:
- **Vercel**: Auto SSL (Let's Encrypt)
- **Netlify**: Auto SSL
- **Cloudflare**: Auto SSL
- **Custom Hosting**: Use Let's Encrypt

---

## Monitoring

### Sentry Setup

```javascript
// In App.jsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.PROD ? 'production' : 'development',
  tracesSampleRate: 0.1,
});
```

### Google Analytics Setup

```javascript
// In App.jsx
import ReactGA from "react-ga4";

ReactGA.initialize(import.meta.env.VITE_GA_TRACKING_ID);
ReactGA.send({ hitType: "pageview", page: window.location.pathname });
```

### Supabase Monitoring

1. Go to Supabase Dashboard
2. Click "Database" → "Metrics"
3. View:
   - Query performance
   - API requests
   - Auth events
   - Storage usage

---

## Performance Monitoring

### Lighthouse

Run Lighthouse in Chrome DevTools:
1. Open Chrome DevTools (F12)
2. Go to "Lighthouse" tab
3. Click "Generate Report"

### Vercel Analytics

1. Enable Vercel Analytics in project settings
2. Add to `index.html` or use Vercel's analytics package

### Web Vitals

Monitor Core Web Vitals:
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)

---

## Post-Deployment Checklist

### ✅ Production Checklist

- [ ] Environment variables set
- [ ] Database migrations run
- [ ] RLS policies enabled
- [ ] Storage bucket created
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] PWA manifest configured
- [ ] Service worker registered
- [ ] Analytics tracking working
- [ ] Error tracking working
- [ ] Push notifications working
- [ ] WhatsApp links working
- [ ] Image upload working
- [ ] Search functionality working
- [ ] Authentication working
- [ ] Notifications working
- [ ] Payment gateway (if applicable)

### ✅ Performance Checklist

- [ ] Lighthouse score > 90
- [ ] Page load < 3 seconds
- [ ] First Contentful Paint < 1.8s
- [ ] Time to Interactive < 3.8s
- [ ] All images optimized
- [ ] Code splitting enabled
- [ ] Caching headers set
- [ ] Gzip compression enabled

---

## Troubleshooting

### Common Issues

#### "Failed to fetch products"

**Solution:**
1. Check Supabase URL and key
2. Verify RLS policies
3. Check network tab for errors
4. Ensure user is authenticated

#### "Image upload failed"

**Solution:**
1. Check storage bucket exists
2. Verify RLS policies for storage
3. Check file size limits
4. Verify content-type is correct

#### "Push notifications not working"

**Solution:**
1. Check VAPID keys
2. Verify service worker registration
3. Check browser permissions
4. Check Edge Function logs

#### "WhatsApp contact not working"

**Solution:**
1. Check phone number format
2. Verify country code
3. Test with different browsers
4. Check console for errors

#### "Authentication failing"

**Solution:**
1. Check Supabase URL
2. Verify anon key
3. Check email/password
4. Check redirect URL configuration

---

## Rollback

### Vercel Rollback

1. Go to Vercel dashboard
2. Select deployment
3. Click "Promote" (for previous deployment)

### Netlify Rollback

1. Go to Netlify dashboard
2. Click "Deploys"
3. Click "Publish" on previous deployment

### Git Rollback

```bash
git revert HEAD
git push
# Or
git reset --hard <commit-hash>
git push --force
```

---

## Backup Strategy

### Database Backup

Supabase automatically backs up:
- Daily backups available
- Point-in-time recovery (Pro plans)

### Manual Backup

```bash
# Export database
pg_dump -h your-db-host -U your-user -d your-db > backup.sql

# Import database
psql -h your-db-host -U your-user -d your-db < backup.sql
```

### File Backup

Back up storage bucket files:
- Use Supabase CLI
- Download manually
- Use third-party backup service

---

## Security Checklist

- [ ] HTTPS enabled
- [ ] RLS policies configured
- [ ] Input sanitization (DOMPurify)
- [ ] CORS configuration
- [ ] Environment variables secure
- [ ] Rate limiting enabled
- [ ] CSRF protection
- [ ] Session timeout set
- [ ] Email verification enabled
- [ ] Password requirements enforced

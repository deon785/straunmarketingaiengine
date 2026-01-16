import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      
      // Development options
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
      
      includeAssets: [
        'favicon.ico', 
        'apple-touch-icon.png', 
        'mask-icon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png'
      ],
      
      manifest: {
        name: 'Straun Marketing AI Engine',
        short_name: 'StraunAI',
        description: 'AI-Powered Marketing Platform - Find Buyers & Sellers Instantly',
        theme_color: '#667eea',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      
      // ✅ CHANGE TO generateSW (REMOVE injectManifest config)
      strategies: 'generateSW',
      
      // ✅ KEEP workbox configuration (it works with generateSW)
      workbox: {
        importScripts: ['/push-sw.js'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ],
        navigateFallback: null,
      }
    })
  ],
  
  server: {
    headers: {
      'Service-Worker-Allowed': '/',
    }
  },
  
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  
  base: './'
})
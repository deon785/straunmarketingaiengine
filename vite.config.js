import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production'
  
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        
        devOptions: {
          enabled: !isProduction,  // Enable in development
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
        
        strategies: 'generateSW',
        
        workbox: {
          // ✅ Keep your push-sw.js for notifications
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
                  maxAgeSeconds: 60 * 60 * 24
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
                  maxAgeSeconds: 60 * 60 * 24 * 365
                }
              }
            }
          ],
          navigateFallback: null,
        }
      })
    ],
    
    server: {
      port: 5173,
      open: true,  // Auto-open browser when dev starts
      host: true,  // Allow access from network (for mobile testing)
      headers: {
        'Service-Worker-Allowed': '/',
      }
    },
    
    build: {
      outDir: 'dist',
      sourcemap: !isProduction,  // Source maps only in development
      
      // ✅ PASTE THE NEW CODE HERE - INSIDE the build object
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Core React libraries (users may have cached from other sites)
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            // Supabase (large SDK, changes infrequently)
            if (id.includes('@supabase') || id.includes('supabase')) {
              return 'vendor-supabase';
            }
            // Sentry (error tracking, not critical for initial render)
            if (id.includes('@sentry')) {
              return 'vendor-sentry';
            }
            // All other dependencies go to main chunk
            return null;
          }
        }
      }
    },
    
    // ✅ KEY FIX: Different base for dev vs production
    base: isProduction ? './' : '/',
  }
})
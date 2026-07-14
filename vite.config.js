import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  
  return {
    plugins: [
      react(),
      // VitePWA removed - using custom sw.js instead
    ],
    
    optimizeDeps: {
      include: ['browser-image-compression']
    },
    
    server: {
      port: 5173,
      open: true,
      host: true,
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 5173,
        timeout: 120000,
        overlay: false // Prevents error overlay from showing on HMR issues
      },
      headers: {
        'Service-Worker-Allowed': '/',
        'Cache-Control': 'no-store' // Prevents caching during development
      },
      watch: {
        usePolling: false,
        interval: 1000
      }
    },
    
    build: {
      outDir: 'dist',
      sourcemap: !isProduction,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react'
            }
            if (id.includes('@supabase') || id.includes('supabase')) {
              return 'vendor-supabase'
            }
            if (id.includes('@sentry')) {
              return 'vendor-sentry'
            }
            return null
          }
        }
      }
    },
    
    base: isProduction ? './' : '/',
    
    preview: {
      port: 4173,
      host: true
    }
  }
})
// lib/supabase.js or lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

// Use import.meta.env for Vite instead of process.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

// Create a single supabase client for the entire app
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'x-application-name': 'your-app-name'
    }
  }
})

// Optional: Add connection health check (client-side only)
export const checkRealtimeConnection = () => {
  if (typeof window === 'undefined') return false
  
  const channel = supabase.channel('health-check')
  
  channel.subscribe((status) => {
    console.log('Realtime connection status:', status)
    if (status === 'CHANNEL_ERROR') {
      console.error('Realtime connection failed')
    }
  })
  
  setTimeout(() => {
    supabase.removeChannel(channel)
  }, 5000)
  
  return true
}
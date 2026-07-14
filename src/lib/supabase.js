// lib/supabase.js - SIMPLE & RELIABLE (NO PROXY)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create supabase client
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
      heartbeatInterval: 30000
    }
  }
})

// ========== SIMPLE RETRY FUNCTION ==========
export async function queryWithRetry(queryFn, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await queryFn()
      if (result?.error) throw result.error
      return result
    } catch (error) {
      if (attempt === maxRetries) {
        console.error('[Query] Failed:', error)
        return { error, data: null }
      }
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// ========== RESILIENT HELPER FUNCTIONS ==========
export async function upsertPushSubscription(userId, subscription) {
  return queryWithRetry(async () => {
    return await supabase
      .from('push_subscriptions')
      .upsert({ 
        user_id: userId,
        subscription: subscription,
        updated_at: new Date().toISOString(),
        is_active: true
      })
  })
}

export async function resilientSelect(table, columns = '*', filters = {}) {
  return queryWithRetry(async () => {
    let query = supabase.from(table).select(columns)
    
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value)
    })
    
    return await query
  })
}

// ========== PUSH NOTIFICATION ERROR HANDLER ==========
export async function sendPushNotification(userId, notification, options = {}) {
  const { retries = 2, retryDelay = 2000 } = options
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('send-notification', {
        body: {
          userId,
          notification,
          attempt: attempt + 1
        }
      })
      
      if (error) throw error
      
      console.log(`[Push] Notification sent successfully to ${userId}`)
      return { success: true, data }
      
    } catch (error) {
      console.error(`[Push] Attempt ${attempt + 1} failed:`, error)
      
      if (attempt === retries) {
        return {
          success: false,
          error: error.message || 'Failed to send notification',
          willRetry: false
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
    }
  }
  
  return { success: false, error: 'Max retries exceeded' }
}

// ========== EDGE FUNCTION CALL WITH RETRY ==========
export async function callEdgeFunction(functionName, payload, options = {}) {
  const { retries = 2, timeout = 15000 } = options
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (error) throw error
      
      return { success: true, data }
      
    } catch (error) {
      console.error(`[Edge Function] ${functionName} attempt ${attempt + 1} failed:`, error)
      
      if (attempt === retries || error.name === 'AbortError') {
        return {
          success: false,
          error: error.message || 'Function call failed',
          timeout: error.name === 'AbortError'
        }
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  return { success: false, error: 'Max retries exceeded' }
}

// ========== SINGLE DEFAULT EXPORT ==========
export default {
  supabase,
  queryWithRetry,
  upsertPushSubscription,
  resilientSelect,
  sendPushNotification,
  callEdgeFunction
}
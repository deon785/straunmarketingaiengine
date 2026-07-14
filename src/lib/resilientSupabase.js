// lib/resilientSupabase.js - Resilience wrapper without proxy issues

import { supabase } from './supabase';

// ========== RETRY FUNCTION ==========
async function withRetry(fn, maxRetries = 3, context = '') {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      
      // Check for Supabase error in response
      if (result?.error) {
        throw result.error;
      }
      
      if (attempt > 1) {
        console.log(`[Resilient] Success after ${attempt} retries - ${context}`);
      }
      return result;
      
    } catch (error) {
      lastError = error;
      
      // Don't retry certain errors
      if (error.message?.includes('permission') || 
          error.message?.includes('auth') ||
          error.message?.includes('invalid')) {
        console.error(`[Resilient] Non-retryable error:`, error.message);
        return { error, data: null };
      }
      
      if (attempt === maxRetries) {
        console.error(`[Resilient] Failed after ${maxRetries} retries:`, error.message);
        return { error, data: null };
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`[Resilient] Retry ${attempt}/${maxRetries - 1} in ${delay}ms - ${context}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// ========== RESILIENT DATABASE OPERATIONS ==========

export const resilientDB = {
  // Get a single record by ID
  async getById(table, id, userIdField = 'user_id') {
    return withRetry(async () => {
      return await supabase
        .from(table)
        .select('*')
        .eq(userIdField, id)
        .maybeSingle();
    }, 3, `getById ${table}`);
  },
  
  // Get multiple records with filters
  async getWhere(table, filters = {}, select = '*') {
    return withRetry(async () => {
      let query = supabase.from(table).select(select);
      
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      
      return await query;
    }, 3, `getWhere ${table}`);
  },
  
  // Insert a record
  async insert(table, data) {
    return withRetry(async () => {
      return await supabase.from(table).insert(data).select();
    }, 3, `insert ${table}`);
  },
  
  // Update a record
  async update(table, data, matchField, matchValue) {
    return withRetry(async () => {
      return await supabase
        .from(table)
        .update(data)
        .eq(matchField, matchValue)
        .select();
    }, 3, `update ${table}`);
  },
  
  // Upsert (insert or update)
  async upsert(table, data, onConflict = 'user_id') {
    return withRetry(async () => {
      return await supabase
        .from(table)
        .upsert(data, { onConflict })
        .select();
    }, 3, `upsert ${table}`);
  },
  
  // Delete a record
  async delete(table, matchField, matchValue) {
    return withRetry(async () => {
      return await supabase
        .from(table)
        .delete()
        .eq(matchField, matchValue);
    }, 2, `delete ${table}`);
  }
};

// ========== RESILIENT AUTH OPERATIONS ==========

export const resilientAuth = {
  async signUp(email, password, options = {}) {
    return withRetry(async () => {
      return await supabase.auth.signUp({
        email,
        password,
        options
      });
    }, 2, 'auth signUp');
  },
  
  async signIn(email, password) {
    return withRetry(async () => {
      return await supabase.auth.signInWithPassword({
        email,
        password
      });
    }, 2, 'auth signIn');
  },
  
  async signOut() {
    return withRetry(async () => {
      return await supabase.auth.signOut();
    }, 1, 'auth signOut');
  },
  
  async getSession() {
    return withRetry(async () => {
      return await supabase.auth.getSession();
    }, 2, 'auth getSession');
  },
  
  async getUser() {
    return withRetry(async () => {
      return await supabase.auth.getUser();
    }, 2, 'auth getUser');
  },
  
  async resetPassword(email, redirectTo) {
    return withRetry(async () => {
      return await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      });
    }, 2, 'auth resetPassword');
  }
};

// ========== RESILIENT PUSH SUBSCRIPTION ==========

export async function savePushSubscription(userId, subscription) {
  return resilientDB.upsert('push_subscriptions', {
    user_id: userId,
    subscription: subscription,
    updated_at: new Date().toISOString(),
    is_active: true
  });
}

// ========== EXPORT ==========
export default {
  db: resilientDB,
  auth: resilientAuth,
  savePushSubscription
};
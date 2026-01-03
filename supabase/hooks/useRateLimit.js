// src/hooks/useRateLimit.js
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useRateLimit = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [limits, setLimits] = useState({});

  // Check rate limit for a specific action
  const checkLimit = useCallback(async (action, customLimit = null) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Define default limits per action
      const defaultLimits = {
        SEARCH: { limit: 15, window: 1 },      // 15 searches per minute
        CONTACT: { limit: 10, window: 0.5 },   // 10 contacts per 30 seconds
        SAVE: { limit: 20, window: 1 },        // 20 saves per minute
        PRODUCT_CREATE: { limit: 3, window: 5 }, // 3 products per 5 minutes
        NOTIFICATION_SEND: { limit: 20, window: 1 } // 20 notifications per minute
      };

      const config = customLimit || defaultLimits[action] || defaultLimits.SEARCH;
      
      const { data, error: rpcError } = await supabase.rpc('check_rate_limit', {
        p_user_id: user.id,
        p_action: action,
        p_limit: config.limit,
        p_window_minutes: config.window
      });

      if (rpcError) throw rpcError;

      // Update local state
      setLimits(prev => ({
        ...prev,
        [action]: data
      }));

      return data;

    } catch (err) {
      console.error('Rate limit check error:', err);
      setError(err.message);
      
      // Fail open - allow action if rate limit check fails
      return {
        allowed: true,
        attempts: 0,
        remaining: 999,
        message: 'Rate limit check failed, proceeding anyway.'
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset rate limit for an action (admin/developer use)
  const resetLimit = useCallback(async (action) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      await supabase
        .from('rate_limits')
        .delete()
        .eq('user_id', user.id)
        .eq('action', action);

      setLimits(prev => {
        const newLimits = { ...prev };
        delete newLimits[action];
        return newLimits;
      });

      return { success: true };
    } catch (err) {
      console.error('Reset limit error:', err);
      return { success: false, error: err.message };
    }
  }, []);

  return {
    checkLimit,
    resetLimit,
    limits,
    loading,
    error
  };
};
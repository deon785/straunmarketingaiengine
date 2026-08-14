// ============================================
// src/smartRateLimiter.js - FIXED
// ============================================

import { userMonitor } from './userBehaviorMonitor.js';
import { supabase } from './lib/supabase.js';

export class SmartRateLimiter {
    constructor(behaviorAnalyzer) {
        this.behaviorAnalyzer = behaviorAnalyzer || userMonitor;
        // ✅ Default limits per action
        this.defaultLimits = {
            CONTACT: { limit: 50, window: 1 },       // 50 contacts per minute
            SEARCH: { limit: 15, window: 1 },         // 15 searches per minute
            SAVE_WISHLIST: { limit: 20, window: 1 },  // 20 saves per minute
            PROFILE_SETUP: { limit: 3, window: 5 },   // 3 setups per 5 minutes
            NOTIFICATION_SEND: { limit: 20, window: 1 }
        };
    }

    // ✅ Main method your app calls
    async checkAndUpdate(userId, action, options = {}) {
        // 1. Get the limit config
        const config = this.defaultLimits[action] || { limit: 10, window: 1 };
        const limit = options.limit || config.limit;
        const windowMinutes = options.window || config.window;

        console.log(`🔍 Rate limit check: ${action} (limit: ${limit}, window: ${windowMinutes}min)`);

        // 2. Check behavior analyzer first
        if (this.behaviorAnalyzer?.isBlocked && this.behaviorAnalyzer.isBlocked(userId)) {
            return {
                allowed: false,
                reason: 'Temporarily blocked due to suspicious activity',
                remaining: 0,
                total: limit,
                reset_in: 15 * 60
            };
        }

        // 3. Check database rate limit
        try {
            // ✅ Call the database function - it returns true/false
            const { data, error } = await supabase.rpc('check_rate_limit', {
                p_user_id: userId,
                p_action: action,
                p_limit: limit,
                p_window_minutes: windowMinutes
            });

            if (error) {
                console.warn('DB rate limit error:', error);
                // ✅ Fail open - allow if DB fails
                return {
                    allowed: true,
                    remaining: limit,
                    total: limit,
                    reason: 'Rate limit check unavailable'
                };
            }

            // ✅ Get current attempts from the table
            const { data: record } = await supabase
                .from('rate_limits')
                .select('attempts')
                .eq('user_id', userId)
                .eq('action', action)
                .maybeSingle();

            const attempts = record?.attempts || 0;
            const remaining = Math.max(0, limit - attempts);
            const allowed = data === true;

            console.log(`📊 Rate limit result: ${allowed ? '✅ ALLOWED' : '❌ BLOCKED'} (${remaining}/${limit} remaining)`);

            return {
                allowed: allowed,
                remaining: remaining,
                total: limit,
                attempts: attempts,
                reset_in: windowMinutes * 60,
                reason: allowed ? 'OK' : 'Rate limit exceeded'
            };

        } catch (error) {
            console.error('Rate limit check failed:', error);
            // ✅ Fail open
            return {
                allowed: true,
                remaining: limit,
                total: limit,
                reason: 'Error checking rate limit'
            };
        }
    }

    // ✅ Static methods for backward compatibility
    static async checkAndLog(userId, action, data = {}, dbLimitConfig = null) {
        const instance = new SmartRateLimiter();
        return instance.checkAndUpdate(userId, action, {
            data: data,
            limit: dbLimitConfig?.limit,
            window: dbLimitConfig?.window
        });
    }

    static async protectAction(userId, action, callback, options = {}) {
        const instance = new SmartRateLimiter();
        const check = await instance.checkAndUpdate(userId, action, {
            limit: options.limit || 10,
            window: options.window || 1,
            data: options.data
        });
        
        if (!check.allowed) {
            throw new Error(`Action blocked: ${check.reason}`);
        }
        
        return callback();
    }
}

export default SmartRateLimiter;
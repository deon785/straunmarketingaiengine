// src/smartRateLimiter.js - FIXED VERSION

import { userMonitor } from './userBehaviorMonitor.js';
import { supabase } from './lib/supabase.js';

// ✅ DEV MODE DETECTION
const isDevMode = import.meta.env?.DEV || 
                  process?.env?.NODE_ENV === 'development' ||
                  (typeof window !== 'undefined' && window?.location?.hostname === 'localhost');

export class SmartRateLimiter {
    constructor(behaviorAnalyzer) {
        this.behaviorAnalyzer = behaviorAnalyzer || userMonitor;
        
        // ✅ Default limits per action
        this.defaultLimits = {
            CONTACT: { limit: isDevMode ? 999 : 50, window: 1 },    // 50 contacts per minute
            SEARCH: { limit: isDevMode ? 999 : 100, window: 1 },    // 100 searches per minute
            SAVE_WISHLIST: { limit: isDevMode ? 999 : 20, window: 1 },
            PROFILE_SETUP: { limit: isDevMode ? 999 : 3, window: 5 },
            NOTIFICATION_SEND: { limit: isDevMode ? 999 : 20, window: 1 }
        };
        
        console.log(`🔒 Rate limiter initialized (${isDevMode ? 'DEV MODE - Unlimited' : 'Production mode'})`);
    }

    // ✅ Main method - JUST calls the database function
    async checkAndUpdate(userId, action, options = {}) {
        // ✅ DEV MODE: Always allow
        if (isDevMode) {
            console.log(`🔓 [DEV MODE] Allowing ${action} (rate limit bypassed)`);
            return {
                allowed: true,
                remaining: 999,
                total: 999,
                reset_in: 0,
                reason: 'Development mode - unlimited'
            };
        }

        if (!userId) {
            return {
                allowed: true,
                remaining: 999,
                total: 999,
                reason: 'No user ID provided'
            };
        }

        // ✅ Get limit config
        const config = this.defaultLimits[action] || { limit: 10, window: 1 };
        const limit = options.limit || config.limit;
        const windowMinutes = options.window || config.window;

        console.log(`🔍 Rate limit check: ${action} (${limit}/${windowMinutes}min)`);

        // ✅ Check behavior analyzer
        if (this.behaviorAnalyzer?.isBlocked && this.behaviorAnalyzer.isBlocked(userId)) {
            return {
                allowed: false,
                reason: 'Temporarily blocked due to suspicious activity',
                remaining: 0,
                total: limit,
                reset_in: 15 * 60
            };
        }

        // ✅ CALL THE DATABASE FUNCTION
        try {
            const { data, error } = await supabase.rpc('check_rate_limit', {
                p_user_id: userId,
                p_action: action,
                p_limit: limit,
                p_window_minutes: windowMinutes
            });

            if (error) {
                console.warn('DB rate limit error:', error);
                // ✅ Fallback: allow if DB fails
                return {
                    allowed: true,
                    remaining: limit,
                    total: limit,
                    reason: 'Database error - allowing'
                };
            }

            // ✅ Return the result from the function
            return {
                allowed: data?.allowed ?? true,
                remaining: data?.remaining ?? limit,
                total: data?.total ?? limit,
                attempts: data?.attempts ?? 0,
                reset_in: data?.reset_in ?? 0,
                reason: data?.allowed ? 'OK' : 'Rate limit exceeded'
            };

        } catch (error) {
            console.error('Rate limit check failed:', error);
            // ✅ Fail open - allow if function fails
            return {
                allowed: true,
                remaining: limit,
                total: limit,
                reason: 'Function error - allowing'
            };
        }
    }

    // ✅ Clear user limits (on logout)
    async clearUserLimits(userId) {
        if (!userId) return;
        
        try {
            await supabase
                .from('rate_limits')
                .delete()
                .eq('user_id', userId);
            
            console.log(`✅ Rate limits cleared for user: ${userId.substring(0, 8)}...`);
        } catch (error) {
            console.warn('Failed to clear rate limits:', error);
        }
    }

    // ✅ Get current status (DOES NOT increment)
    async getStatus(userId, action) {
        if (!userId) return { attempts: 0, remaining: 10, total: 10 };
        
        try {
            const { data: record } = await supabase
                .from('rate_limits')
                .select('attempts, limit, window_start')
                .eq('user_id', userId)
                .eq('action', action)
                .maybeSingle();
            
            if (record) {
                const limit = record.limit || 10;
                const attempts = record.attempts || 0;
                return {
                    attempts: attempts,
                    remaining: Math.max(0, limit - attempts),
                    total: limit
                };
            }
        } catch (error) {
            // Ignore
        }
        
        return { attempts: 0, remaining: 10, total: 10 };
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
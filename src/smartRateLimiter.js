// smartRateLimiter.js
import { userMonitor } from './userBehaviorMonitor.js';
import { supabase } from './lib/supabase.js'; // Add supabase import

export class SmartRateLimiter {
    constructor(behaviorAnalyzer) {
        this.behaviorAnalyzer = behaviorAnalyzer || userMonitor;
    }

    // Instance method that your app expects
    async checkAndUpdate(userId, action, options = {}) {
        // 1. Check if user is temporarily blocked
        if (this.behaviorAnalyzer.isBlocked && this.behaviorAnalyzer.isBlocked(userId)) {
            return {
                allowed: false,
                reason: 'Temporarily blocked due to suspicious activity',
                blockDuration: 15 // minutes
            };
        }
        
        // 2. Check behavior patterns
        let behaviorCheck = { isSuspicious: false };
        
        // Try different method names
        if (this.behaviorAnalyzer.logAction) {
            behaviorCheck = this.behaviorAnalyzer.logAction(userId, action, options);
        } else if (this.behaviorAnalyzer.recordUserAction) {
            behaviorCheck = this.behaviorAnalyzer.recordUserAction(userId, action, options);
        }
        
        if (behaviorCheck.isSuspicious) {
            // If very suspicious, temporary block
            if (behaviorCheck.score && behaviorCheck.score > 5) {
                if (this.behaviorAnalyzer.temporaryBlock) {
                    this.behaviorAnalyzer.temporaryBlock(userId, 30);
                }
                return {
                    allowed: false,
                    reason: `Blocked: ${behaviorCheck.reason}`,
                    blockDuration: 30
                };
            }
            
            return {
                allowed: false,
                reason: behaviorCheck.reason,
                warning: true
            };
        }
        
        // 3. Check database rate limit (only if configured)
        if (options.limit && options.window) {
            try {
                const { data: dbResult, error } = await supabase.rpc('check_rate_limit', {
                    p_user_id: userId,
                    p_action: action,
                    p_limit: options.limit,
                    p_window_minutes: options.window
                });
                
                if (error) {
                    console.warn('DB rate limit error:', error);
                    // Continue with client-side only
                } else if (dbResult && !dbResult.allowed) {
                    return {
                        allowed: false,
                        reason: dbResult.message || 'Rate limit exceeded',
                        remaining: dbResult.remaining || 0,
                        total: dbResult.total || 0,
                        reset_in: dbResult.reset_in || 0,
                        source: 'database'
                    };
                }
            } catch (err) {
                console.error('Rate limit check failed:', err);
            }
        }
        
        return { 
            allowed: true,
            remaining: options.limit || 10,
            total: options.limit || 10
        };
    }
    
    // Keep your static methods for backward compatibility
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
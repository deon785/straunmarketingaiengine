class UserBehaviorMonitor {
    constructor() {
        this.userActions = new Map();
        this.suspiciousPatterns = [];
        this.blockedUsers = new Set();
    }

    recordUserAction(userId, action, data = {}) {
        return this.logAction(userId, action, data);
    }
    
    
    // Track user actions
    logAction(userId, action, data = {}) {
        const timestamp = Date.now();
        const key = `${userId}_${action}`;
        
        if (!this.userActions.has(key)) {
            this.userActions.set(key, []);
        }
        
        const actions = this.userActions.get(key);
        actions.push({ timestamp, data });
        
        // Keep only last 100 actions per user per action type
        if (actions.length > 100) {
            actions.shift();
        }
        
        // Check for suspicious patterns
        return this.checkForSuspiciousBehavior(userId, action);
    }
    
    // Detect suspicious patterns
    checkForSuspiciousBehavior(userId, action) {
        const key = `${userId}_${action}`;
        const actions = this.userActions.get(key) || [];
        const now = Date.now();
        
        // Pattern 1: Too fast repetition (bot-like)
        if (actions.length >= 3) {
            const recentActions = actions.slice(-3);
            const timeDiff = recentActions[2].timestamp - recentActions[0].timestamp;
            
            if (timeDiff < 1000) {
                this.suspiciousPatterns.push({
                    userId,
                    action,
                    pattern: 'TOO_FAST',
                    timestamp: now
                });
                return { 
                    isSuspicious: true, 
                    reason: 'Actions too fast',
                    score: 3 // ADD SCORE
                };
            }
        }
        
        // Pattern 2: Exact same actions (scripted)
        if (actions.length >= 5) {
            const recentActions = actions.slice(-5);
            const allSame = recentActions.every((a, i, arr) => 
                i === 0 || JSON.stringify(a.data) === JSON.stringify(arr[i-1].data)
            );
            
            if (allSame) {
                this.suspiciousPatterns.push({
                    userId,
                    action,
                    pattern: 'EXACT_REPETITION',
                    timestamp: now
                });
                return { 
                    isSuspicious: true, 
                    reason: 'Exact repetition detected',
                    score: 5 // ADD SCORE
                };
            }
        }
        
        // Pattern 3: High frequency
        const oneMinuteAgo = now - 60000;
        const recentActions = actions.filter(a => a.timestamp > oneMinuteAgo);
        
        let maxActions = 10;
        const actionLimits = {
            'SEARCH': 30,
            'CONTACT': 10,
            'SAVE': 20,
            'PRODUCT_CREATE': 5,
        };
        
        maxActions = actionLimits[action] || maxActions;
        
        if (recentActions.length > maxActions) {
            this.suspiciousPatterns.push({
                userId,
                action,
                pattern: 'HIGH_FREQUENCY',
                count: recentActions.length,
                timestamp: now
            });
            return { 
                isSuspicious: true, 
                reason: `Too many ${action} actions (${recentActions.length} in 1 minute)`,
                score: Math.min(10, recentActions.length - maxActions) // ADD SCORE
            };
        }
        
        return { 
            isSuspicious: false,
            score: 0 // ADD SCORE FOR CONSISTENCY
        };
    }

    // Get suspicious users
    getSuspiciousUsers(minutes = 5) {
        const cutoff = Date.now() - (minutes * 60000);
        const recentSuspicious = this.suspiciousPatterns.filter(p => p.timestamp > cutoff);
        
        // Group by user
        const userScores = {};
        recentSuspicious.forEach(pattern => {
            if (!userScores[pattern.userId]) {
                userScores[pattern.userId] = { count: 0, patterns: [] };
            }
            userScores[pattern.userId].count++;
            userScores[pattern.userId].patterns.push(pattern.pattern);
        });
        
        return Object.entries(userScores)
            .filter(([userId, data]) => data.count >= 3) // At least 3 suspicious patterns
            .map(([userId, data]) => ({
                userId,
                score: data.count,
                patterns: data.patterns,
                isBlocked: this.blockedUsers.has(userId)
            }));
    }
    
    // Temporarily block a user
    temporaryBlock(userId, minutes = 15) {
        this.blockedUsers.add(userId);
        
        // Auto-unblock after time
        setTimeout(() => {
            this.blockedUsers.delete(userId);
        }, minutes * 60000);
        
        return { blocked: true, until: Date.now() + (minutes * 60000) };
    }
    
    // Check if user is blocked
    isBlocked(userId) {
        return this.blockedUsers.has(userId);
    }
}

// Singleton instance
export const userMonitor = new UserBehaviorMonitor();

export { UserBehaviorMonitor as UserBehaviorAnalyzer };

// Default export
export default UserBehaviorMonitor;
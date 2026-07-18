// src/utils/errorRecovery.js - COMPLETE WORKING VERSION

import React, { useCallback, useState } from 'react'; 
import * as Sentry from "@sentry/react";

// Error severity levels
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
  IGNORE: 'ignore'
};

// Recovery strategies
class ErrorRecovery {
  constructor() {
    this.recoveryAttempts = new Map();
    this.recoveryTimers = new Map();
  }

  async handleError(error, context = {}) {
    const errorType = this.classifyError(error);
    const severity = this.getSeverity(errorType);
    
    if (severity === ErrorSeverity.IGNORE) {
      console.log(`[Recovery] Ignoring ${errorType} error (no action needed)`);
      return { recovered: true, shouldRetry: false };
    }
    
    console.log(`[Recovery] Handling ${errorType} error with severity ${severity}`);
    
    switch(severity) {
      case ErrorSeverity.LOW:
        return this.handleLowSeverity(error, context);
      case ErrorSeverity.MEDIUM:
        return this.handleMediumSeverity(error, context);
      case ErrorSeverity.HIGH:
        return this.handleHighSeverity(error, context);
      case ErrorSeverity.CRITICAL:
        return this.handleCriticalSeverity(error, context);
      case 'COLUMN_ERROR':
        return this.handleColumnError(error, context);
      default:
        return this.handleFallback(error, context);
    }
  }

  handleColumnError(error, context) {
    console.warn('[Recovery] Database column missing:', error.message);
    
    if (context.showToast) {
        context.showToast({
            type: 'error',
            message: 'Database schema issue: "rating" column missing. Please contact support.',
            duration: 5000
        });
    }
    
    return { 
        recovered: false, 
        shouldRetry: false,
        needsAction: true,
        message: 'Missing "rating" column in profiles table'
    };
  }

  classifyError(error) {
    const message = error?.message?.toLowerCase() || '';
    const stack = error?.stack?.toLowerCase() || '';
    
    if (message.includes('column') && 
        message.includes('does not exist') && 
        message.includes('rating')) {
        return 'COLUMN_ERROR';
    }
    
    if (message.includes('resource') || 
        message.includes('unexpected identifier') ||
        (message.includes('failed to fetch') && message.includes('sw.js'))) {
        return 'RESOURCE_ERROR';
    }
    
    if (message.includes('failed to fetch') || 
        message.includes('network') ||
        message.includes('offline') ||
        message.includes('connection')) {
        return 'NETWORK_ERROR';
    }
    
    if (message.includes('dynamically imported module') ||
        message.includes('failed to load') ||
        message.includes('import') ||
        message.includes('chunk')) {
        return 'MODULE_LOAD_ERROR';
    }
    
    if (message.includes('supabase') ||
        message.includes('postgres') ||
        message.includes('database')) {
        return 'DATABASE_ERROR';
    }
    
    if (message.includes('auth') ||
        message.includes('session') ||
        message.includes('token') ||
        message.includes('permission')) {
        return 'AUTH_ERROR';
    }
    
    if (message.includes('service worker') ||
        message.includes('sw.js') ||
        message.includes('push')) {
        return 'SERVICE_WORKER_ERROR';
    }
    
    if (message.includes('memory') ||
        message.includes('heap') ||
        message.includes('out of memory')) {
        return 'MEMORY_ERROR';
    }
    
    if (message.includes('render') ||
        message.includes('react') ||
        message.includes('component')) {
        return 'RENDER_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }

  getSeverity(errorType) {
    const attemptCount = this.recoveryAttempts.get(errorType) || 0;
    
    if (errorType === 'RESOURCE_ERROR') {
      return ErrorSeverity.IGNORE;
    }
    
    if (attemptCount > 5) return ErrorSeverity.CRITICAL;
    if (attemptCount > 3) return ErrorSeverity.HIGH;
    if (attemptCount > 1) return ErrorSeverity.MEDIUM;
    
    const severityMap = {
      'NETWORK_ERROR': ErrorSeverity.LOW,
      'MODULE_LOAD_ERROR': ErrorSeverity.MEDIUM,
      'DATABASE_ERROR': ErrorSeverity.MEDIUM,
      'AUTH_ERROR': ErrorSeverity.HIGH,
      'SERVICE_WORKER_ERROR': ErrorSeverity.LOW,
      'MEMORY_ERROR': ErrorSeverity.CRITICAL,
      'RENDER_ERROR': ErrorSeverity.HIGH,
      'UNKNOWN_ERROR': ErrorSeverity.MEDIUM
    };
    
    return severityMap[errorType] || ErrorSeverity.MEDIUM;
  }

  async handleLowSeverity(error, context) {
    const errorType = this.classifyError(error);
    const attemptCount = (this.recoveryAttempts.get(errorType) || 0) + 1;
    this.recoveryAttempts.set(errorType, attemptCount);
    
    const retryDelay = Math.min(1000 * attemptCount, 5000);
    
    console.log(`[Recovery] Auto-retry ${attemptCount} in ${retryDelay}ms`);
    
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (context.retryFunction) {
          context.retryFunction().then(resolve).catch(resolve);
        } else if (context.url) {
          fetch(context.url).then(resolve).catch(resolve);
        } else {
          resolve({ recovered: false });
        }
      }, retryDelay);
      
      this.recoveryTimers.set(errorType, timer);
    });
  }

  async handleMediumSeverity(error, context) {
    if (Math.random() < 0.1) {
      Sentry.captureException(error, {
        tags: { severity: 'medium', autoRecovered: true },
        extra: context
      });
    }
    return this.handleLowSeverity(error, context);
  }

  async handleHighSeverity(error, context) {
    Sentry.captureException(error, {
      tags: { severity: 'high' },
      extra: context
    });
    
    const errorType = this.classifyError(error);
    const attemptCount = (this.recoveryAttempts.get(errorType) || 0) + 1;
    this.recoveryAttempts.set(errorType, attemptCount);
    
    if (context.showToast) {
      context.showToast({
        type: 'error',
        message: 'Something went wrong. Retrying automatically...',
        duration: 3000
      });
    }
    
    const retryDelay = Math.min(2000 * Math.pow(2, attemptCount - 1), 10000);
    
    return new Promise((resolve) => {
      setTimeout(async () => {
        if (context.retryFunction) {
          const result = await context.retryFunction();
          resolve(result);
        } else {
          resolve({ recovered: false });
        }
      }, retryDelay);
    });
  }

  async handleCriticalSeverity(error, context) {
    Sentry.captureException(error, {
      tags: { severity: 'critical', willReload: true },
      extra: context
    });
    
    const errorType = this.classifyError(error);
    const attemptCount = (this.recoveryAttempts.get(errorType) || 0) + 1;
    
    if (attemptCount > 2) {
      if (context.showFallback) {
        context.showFallback(error);
      }
      return { recovered: false, needsReload: false };
    }
    
    this.recoveryAttempts.set(errorType, attemptCount);
    
    if (context.showToast) {
      context.showToast({
        type: 'error',
        message: 'Critical error. Reloading page in 3 seconds...',
        duration: 3000
      });
    }
    
    setTimeout(() => {
      console.log('[Recovery] Performing critical recovery - reloading page');
      
      if (context.saveState) {
        context.saveState();
      }
      
      sessionStorage.setItem('lastReload', Date.now().toString());
      sessionStorage.setItem('reloadReason', error?.message || 'Unknown error');
      
      window.location.reload();
    }, 3000);
    
    return { recovered: false, willReload: true };
  }

  async handleFallback(error, context) {
    console.error('[Recovery] Unhandled error type:', error);
    
    Sentry.captureException(error, {
      tags: { severity: 'unknown' },
      extra: context
    });
    
    return { recovered: false };
  }

  resetRecoveryAttempts(errorType) {
    this.recoveryAttempts.delete(errorType);
    const timer = this.recoveryTimers.get(errorType);
    if (timer) {
      clearTimeout(timer);
      this.recoveryTimers.delete(errorType);
    }
  }

  isInReloadLoop() {
    const lastReload = sessionStorage.getItem('lastReload');
    if (!lastReload) return false;
    
    const timeSinceReload = Date.now() - parseInt(lastReload);
    return timeSinceReload < 5000;
  }

  getStats() {
    return {
      attempts: Object.fromEntries(this.recoveryAttempts),
      activeTimers: this.recoveryTimers.size
    };
  }
}

// Create singleton instance
const errorRecovery = new ErrorRecovery();

// ========== HELPER FUNCTIONS FOR COMPONENTS ==========

export function withRecovery(asyncFn, context = {}) {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      const result = await errorRecovery.handleError(error, {
        ...context,
        retryFunction: () => asyncFn(...args)
      });
      
      if (result.recovered) {
        return result;
      }
      throw error;
    }
  };
}

export function useErrorRecovery() {
  const [isRecovering, setIsRecovering] = useState(false);
  const [lastError, setLastError] = useState(null);
  
  const recover = useCallback(async (error, context = {}) => {
    setIsRecovering(true);
    setLastError(error);
    
    const result = await errorRecovery.handleError(error, context);
    
    setIsRecovering(false);
    return result;
  }, []);
  
  return { recover, isRecovering, lastError };
}

export function executeWithRecovery(asyncFn, context = {}) {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      const result = await errorRecovery.handleError(error, context);
      if (result.recovered) {
        return result;
      }
      throw error;
    }
  };
}

// ✅ CRITICAL FIX: Export errorRecovery as BOTH named AND default
export { errorRecovery };  // ← THIS WAS MISSING!
export default errorRecovery;
export { ErrorRecovery };
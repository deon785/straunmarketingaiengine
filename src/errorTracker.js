// src/errorTracker.js
import { supabase } from './lib/supabase';

class ErrorTracker {
    constructor() {
        this.errorCache = [];
        this.batchSize = 10;
        this.flushInterval = 30000; // 30 seconds
        this.isFlushing = false;
        
        // Start auto-flush
        setInterval(() => this.flush(), this.flushInterval);
    }

    async trackError(error, context = {}) {
        const errorData = {
            error_code: error.code || 'UNKNOWN_ERROR',
            error_message: error.message || 'Unknown error occurred',
            error_stack: error.stack,
            route: context.route || window.location.pathname,
            user_id: context.userId || null,
            user_agent: navigator.userAgent,
            severity: context.severity || 'error',
            timestamp: new Date().toISOString()
        };

        // Add to cache
        this.errorCache.push(errorData);

        // Update summary in real-time
        this.updateSummary(errorData);

        // Flush if batch is full
        if (this.errorCache.length >= this.batchSize) {
            this.flush();
        }

        return errorData;
    }

    async updateSummary(errorData) {
        try {
            await supabase.rpc('update_error_summary', {
                p_error_code: errorData.error_code,
                p_error_message: errorData.error_message,
                p_user_id: errorData.user_id
            });
        } catch (e) {
            console.warn('Error updating summary:', e);
        }
    }

    async flush() {
        if (this.isFlushing || this.errorCache.length === 0) return;
        
        this.isFlushing = true;
        
        try {
            const errors = [...this.errorCache];
            this.errorCache = [];

            const { error } = await supabase
                .from('error_tracking')
                .insert(errors);

            if (error) {
                console.warn('Failed to flush errors:', error);
                this.errorCache = [...errors, ...this.errorCache];
            }
        } catch (e) {
            console.warn('Error flushing errors:', e);
        } finally {
            this.isFlushing = false;
        }
    }

    async getErrorSummary() {
        const { data, error } = await supabase
            .from('error_summary')
            .select('*')
            .order('total_occurrences', { ascending: false });

        if (error) return [];
        return data || [];
    }

    async getRecentErrors(limit = 100) {
        const { data, error } = await supabase
            .from('error_tracking')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) return [];
        return data || [];
    }

    async resolveError(errorCode) {
        const { error } = await supabase
            .from('error_summary')
            .update({ resolved: true, updated_at: new Date().toISOString() })
            .eq('error_code', errorCode);

        return !error;
    }
}

const errorTracker = new ErrorTracker();
export default errorTracker;
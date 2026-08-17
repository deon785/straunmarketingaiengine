// src/AdminErrorAnalytics.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

const AdminErrorAnalytics = () => {
    const [errorData, setErrorData] = useState([]);
    const [errorStats, setErrorStats] = useState({
        totalErrors: 0,
        uniqueUsers: 0,
        activeErrors: 0,
        resolvedErrors: 0,
        mostCommon: null,
        resetHistory: []
    });
    const [loading, setLoading] = useState(true);
    const [selectedError, setSelectedError] = useState(null);
    const [resetMessage, setResetMessage] = useState('');
    const [weeklySummary, setWeeklySummary] = useState(null);

    useEffect(() => {
        loadErrorAnalytics();
        const interval = setInterval(loadErrorAnalytics, 30000);
        return () => clearInterval(interval);
    }, []);

    // ✅ FIXED: Calculate weekly summary
    const calculateWeeklySummary = (errorData) => {
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const weeklyErrors = errorData.filter(e => {
            const lastOccurrence = e.last_occurrence ? new Date(e.last_occurrence) : new Date(0);
            return lastOccurrence >= sevenDaysAgo;
        });

        const totalErrorsThisWeek = weeklyErrors.reduce((sum, e) => sum + e.total_occurrences, 0);

        return {
            hasErrors: totalErrorsThisWeek > 0,
            totalErrors: totalErrorsThisWeek,
            uniqueErrorTypes: weeklyErrors.length,
            errorDetails: weeklyErrors.map(e => ({
                code: e.error_code,
                message: e.error_message,
                count: e.total_occurrences,
                users: e.unique_users
            })),
            daysWithoutErrors: totalErrorsThisWeek === 0 ? 7 : 0,
            lastErrorDate: weeklyErrors.length > 0 ? weeklyErrors[0].last_occurrence : null
        };
    };

    // ✅ FIXED: Load error analytics
    const loadErrorAnalytics = async () => {
        setLoading(true);
        try {
            const { data: summary, error } = await supabase
                .from('error_summary')
                .select('*')
                .order('total_occurrences', { ascending: false });

            if (error) throw error;

            const summaryData = summary || [];
            
            // Calculate stats
            const totalErrors = summaryData.reduce((sum, e) => sum + e.total_occurrences, 0);
            const uniqueUsers = summaryData.reduce((sum, e) => sum + e.unique_users, 0);
            const activeErrors = summaryData.filter(e => !e.resolved).length;
            const resolvedErrors = summaryData.filter(e => e.resolved).length;
            const mostCommon = summaryData.length > 0 ? summaryData[0] : null;
            
            // ✅ FIXED: Calculate weekly summary from the data
            const weekly = calculateWeeklySummary(summaryData);

            // ✅ FIXED: Set data correctly
            setErrorData(summaryData);        // Full array for table
            setWeeklySummary(weekly);          // Weekly summary object
            setErrorStats({
                totalErrors,
                uniqueUsers,
                activeErrors,
                resolvedErrors,
                mostCommon,
                resetHistory: summaryData.filter(e => e.reset_count > 0)
            });

        } catch (err) {
            console.error('Error loading error analytics:', err);
        } finally {
            setLoading(false);
        }
    };

    // Reset count for specific error
    const resetErrorCount = async (errorCode) => {
        if (!window.confirm(`Reset count for error "${errorCode}"?`)) return;

        try {
            const { error } = await supabase
                .from('error_summary')
                .update({ 
                    total_occurrences: 0, 
                    unique_users: 0,
                    reset_count: supabase.sql`reset_count + 1`,
                    last_reset: new Date().toISOString()
                })
                .eq('error_code', errorCode);

            if (error) throw error;

            setResetMessage(`✅ Count for "${errorCode}" has been reset!`);
            setTimeout(() => setResetMessage(''), 3000);
            await loadErrorAnalytics();

        } catch (err) {
            alert('❌ Failed to reset count: ' + err.message);
        }
    };

    // Reset all error counts
    const resetAllErrorCounts = async () => {
        if (!window.confirm('⚠️ Reset ALL error counts to 0?')) return;

        try {
            const { error } = await supabase
                .from('error_summary')
                .update({ 
                    total_occurrences: 0, 
                    unique_users: 0,
                    reset_count: supabase.sql`reset_count + 1`,
                    last_reset: new Date().toISOString()
                });

            if (error) throw error;

            setResetMessage('✅ All error counts have been reset!');
            setTimeout(() => setResetMessage(''), 3000);
            await loadErrorAnalytics();

        } catch (err) {
            alert('❌ Failed to reset counts: ' + err.message);
        }
    };

    // Auto-reset errors with 100+ occurrences
    const checkAndAutoReset = async () => {
        const errorsToReset = errorData.filter(e => e.total_occurrences >= 100);
        
        if (errorsToReset.length > 0) {
            const errorCodes = errorsToReset.map(e => e.error_code);
            
            try {
                const { error } = await supabase
                    .from('error_summary')
                    .update({ 
                        total_occurrences: 0, 
                        unique_users: 0,
                        reset_count: supabase.sql`reset_count + 1`,
                        last_reset: new Date().toISOString()
                    })
                    .in('error_code', errorCodes);

                if (!error) {
                    console.log(`🔄 Auto-reset ${errorsToReset.length} errors`);
                    await loadErrorAnalytics();
                }
            } catch (err) {
                console.error('Auto-reset failed:', err);
            }
        }
    };

    // Run auto-reset check every minute
    useEffect(() => {
        const interval = setInterval(checkAndAutoReset, 60000);
        return () => clearInterval(interval);
    }, [errorData]);

    const getTrendIcon = (trend) => {
        if (trend === 'up') return '📈';
        if (trend === 'down') return '📉';
        return '➡️';
    };

    if (loading) {
        return <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Loading error analytics...</div>;
    }

    return (
        <div>
            {/* Header */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '20px',
                flexWrap: 'wrap',
                gap: '10px'
            }}>
                <h2 style={{ color: '#000', margin: 0 }}>📊 Error Analytics</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={resetAllErrorCounts}
                        style={{
                            padding: '8px 16px',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        🔄 Reset All Counts
                    </button>
                    <button
                        onClick={loadErrorAnalytics}
                        style={{
                            padding: '8px 16px',
                            background: '#0d6efd',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {resetMessage && (
                <div style={{
                    padding: '12px',
                    background: '#d4edda',
                    color: '#155724',
                    borderRadius: '6px',
                    marginBottom: '15px',
                    border: '1px solid #c3e6cb'
                }}>
                    {resetMessage}
                </div>
            )}

            {/* ✅ NEW: Weekly Summary Report */}
            {weeklySummary && (
                <div style={{
                    background: weeklySummary.hasErrors ? '#fff3cd' : '#d4edda',
                    border: `2px solid ${weeklySummary.hasErrors ? '#ffc107' : '#28a745'}`,
                    borderRadius: '8px',
                    padding: '15px',
                    marginBottom: '20px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div>
                            <h4 style={{ margin: '0 0 5px 0', color: weeklySummary.hasErrors ? '#856404' : '#155724' }}>
                                📅 Weekly Report (Last 7 Days)
                            </h4>
                            {weeklySummary.hasErrors ? (
                                <div>
                                    <p style={{ margin: '0', color: '#856404', fontWeight: 'bold' }}>
                                        ⚠️ {weeklySummary.totalErrors} errors this week ({weeklySummary.uniqueErrorTypes} unique types)
                                    </p>
                                    <div style={{ marginTop: '8px' }}>
                                        {weeklySummary.errorDetails.map((err, idx) => (
                                            <div key={idx} style={{
                                                fontSize: '13px',
                                                color: '#856404',
                                                padding: '4px 0',
                                                borderBottom: idx < weeklySummary.errorDetails.length - 1 ? '1px solid #ffe8a1' : 'none'
                                            }}>
                                                • <strong>{err.code}</strong>: {err.message} — {err.count} occurrences, {err.users} users affected
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p style={{ margin: '0', color: '#155724', fontSize: '16px', fontWeight: 'bold' }}>
                                    ✅ 7 days without errors! Everything is running smoothly.
                                </p>
                            )}
                        </div>
                        <div style={{ fontSize: '13px', color: weeklySummary.hasErrors ? '#856404' : '#155724', marginTop: '8px' }}>
                            {weeklySummary.hasErrors && weeklySummary.lastErrorDate && (
                                <span>Last error: {new Date(weeklySummary.lastErrorDate).toLocaleString()}</span>
                            )}
                            {!weeklySummary.hasErrors && (
                                <span>🎉 Perfect week!</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '15px',
                marginBottom: '25px'
            }}>
                <div style={{
                    background: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    borderLeft: '4px solid #dc3545',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc3545' }}>
                        {errorStats.totalErrors}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6c757d' }}>Total Errors</div>
                </div>

                <div style={{
                    background: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    borderLeft: '4px solid #0d6efd',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0d6efd' }}>
                        {errorStats.uniqueUsers}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6c757d' }}>Affected Users</div>
                </div>

                <div style={{
                    background: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    borderLeft: '4px solid #ffc107',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffc107' }}>
                        {errorStats.activeErrors}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6c757d' }}>Active Errors</div>
                </div>

                <div style={{
                    background: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    borderLeft: '4px solid #28a745',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#28a745' }}>
                        {errorStats.resolvedErrors}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6c757d' }}>Resolved Errors</div>
                </div>
            </div>

            {/* Most Common Error Alert */}
            {errorStats.mostCommon && (
                <div style={{
                    background: '#fff3cd',
                    border: '2px solid #ffc107',
                    borderRadius: '8px',
                    padding: '15px',
                    marginBottom: '20px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                            <h4 style={{ margin: '0 0 5px 0', color: '#856404' }}>🔥 Most Common Error</h4>
                            <p style={{ margin: 0, color: '#856404' }}>
                                <strong>Message:</strong> {errorStats.mostCommon.error_message}
                            </p>
                            <p style={{ margin: '5px 0 0 0', color: '#856404', fontSize: '13px' }}>
                                <strong>Occurrences:</strong> {errorStats.mostCommon.total_occurrences} | 
                                <strong> Users:</strong> {errorStats.mostCommon.unique_users} |
                                <strong> Trend:</strong> {getTrendIcon(errorStats.mostCommon.trend)} {errorStats.mostCommon.trend}
                            </p>
                        </div>
                        <button
                            onClick={() => resetErrorCount(errorStats.mostCommon.error_code)}
                            style={{
                                padding: '6px 14px',
                                background: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            Reset Count
                        </button>
                    </div>
                </div>
            )}

            {/* Error Table */}
            <div style={{
                background: 'white',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8f9fa' }}>
                        <tr>
                            <th style={{ padding: '12px', textAlign: 'left', color: '#000' }}>Error</th>
                            <th style={{ padding: '12px', textAlign: 'center', color: '#000' }}>Count</th>
                            <th style={{ padding: '12px', textAlign: 'center', color: '#000' }}>Users</th>
                            <th style={{ padding: '12px', textAlign: 'center', color: '#000' }}>Trend</th>
                            <th style={{ padding: '12px', textAlign: 'center', color: '#000' }}>Status</th>
                            <th style={{ padding: '12px', textAlign: 'center', color: '#000' }}>Last Reset</th>
                            <th style={{ padding: '12px', textAlign: 'center', color: '#000' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {errorData.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
                                    ✅ No errors tracked yet
                                </td>
                            </tr>
                        ) : (
                            errorData.map((error, index) => (
                                <tr key={error.error_code} style={{
                                    borderTop: '1px solid #dee2e6',
                                    background: index % 2 === 0 ? 'white' : '#f8f9fa'
                                }}>
                                    <td style={{ padding: '10px' }}>
                                        <div>
                                            <strong style={{ color: '#000' }}>{error.error_code}</strong>
                                            <div style={{ fontSize: '12px', color: '#6c757d' }}>
                                                {error.error_message}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ 
                                        padding: '10px', 
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        color: error.total_occurrences > 50 ? '#dc3545' : 
                                               error.total_occurrences > 20 ? '#ffc107' : '#28a745'
                                    }}>
                                        {error.total_occurrences}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center', color: '#000' }}>
                                        {error.unique_users}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center', fontSize: '20px' }}>
                                        {getTrendIcon(error.trend)}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '3px 10px',
                                            borderRadius: '12px',
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            background: error.resolved ? '#28a745' : '#dc3545',
                                            color: 'white'
                                        }}>
                                            {error.resolved ? '✅ Resolved' : '⚠️ Active'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center', fontSize: '12px', color: '#6c757d' }}>
                                        {error.last_reset ? new Date(error.last_reset).toLocaleDateString() : 'Never'}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                        <button
                                            onClick={() => resetErrorCount(error.error_code)}
                                            style={{
                                                padding: '4px 12px',
                                                background: '#dc3545',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '11px'
                                            }}
                                        >
                                            Reset
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Reset History */}
            {errorStats.resetHistory.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <h4 style={{ color: '#000', marginBottom: '10px' }}>🔄 Reset History</h4>
                    <div style={{
                        background: '#f8f9fa',
                        padding: '15px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#6c757d'
                    }}>
                        {errorStats.resetHistory.map((error, index) => (
                            <div key={index} style={{
                                padding: '5px 0',
                                borderBottom: index < errorStats.resetHistory.length - 1 ? '1px solid #dee2e6' : 'none'
                            }}>
                                <strong style={{ color: '#000' }}>{error.error_code}</strong>
                                {' '}- Reset {error.reset_count} times, Last reset: {error.last_reset ? new Date(error.last_reset).toLocaleString() : 'N/A'}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Auto-reset Status */}
            <div style={{
                marginTop: '15px',
                padding: '10px',
                background: '#e7f5ff',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#0c5460',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            }}>
                <span>🔄 Auto-reset: Errors with 100+ occurrences will be reset automatically</span>
                <span style={{
                    padding: '2px 8px',
                    background: '#0d6efd',
                    color: 'white',
                    borderRadius: '10px',
                    fontSize: '10px'
                }}>
                    Active
                </span>
            </div>
        </div>
    );
};

export default AdminErrorAnalytics;
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase'; 

// ✅ Add fetchWithRetry helper
const fetchWithRetry = async (fetchFn, maxRetries = 3) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFn();
    } catch (err) {
      lastError = err;
      console.warn(`Fetch attempt ${i + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  throw lastError;
};

const PriceAlertDashboard = ({ userId }) => {
    const [alerts, setAlerts] = useState([]);
    const [stats, setStats] = useState({
        total_alerts: 0,
        active_alerts: 0,
        triggered_alerts: 0,
        total_savings: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // ✅ Memoize functions with useCallback
    const loadAlerts = useCallback(async () => {
        if (!userId) {
            setError('User ID is required');
            setLoading(false);
            return;
        }
        
        // ✅ Check offline status
        if (!navigator.onLine) {
            setError('You are offline. Please connect to the internet to view alerts.');
            setLoading(false);
            return;
        }
        
        try {
            // ✅ Use fetchWithRetry
            const result = await fetchWithRetry(() => supabase
                .from('price_alerts')
                .select(`
                    *,
                    products:product_id (
                        id,
                        name,
                        price,
                        location,
                        image_url
                    )
                `)
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
            );

            if (result.error) {
                console.error('Error loading alerts:', result.error);
                setError('Failed to load alerts');
                setAlerts([]);
            } else {
                setAlerts(result.data || []);
                setError(null);
            }
        } catch (err) {
            console.error('Unexpected error loading alerts:', err);
            setError('Unable to load alerts');
            setAlerts([]);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const loadStats = useCallback(async () => {
        if (!userId) return;
        
        // ✅ Check offline status
        if (!navigator.onLine) {
            console.log('Offline - stats will show cached values');
            return;
        }
        
        try {
            // ✅ Use fetchWithRetry
            const result = await fetchWithRetry(() => supabase
                .rpc('get_price_alert_stats', { user_id_param: userId })
            );

            if (result.error) {
                console.error('Error loading stats:', result.error);
            } else if (result.data && result.data[0]) {
                setStats({
                    total_alerts: result.data[0].total_alerts || 0,
                    active_alerts: result.data[0].active_alerts || 0,
                    triggered_alerts: result.data[0].triggered_alerts || 0,
                    total_savings: result.data[0].total_savings || 0
                });
            }
        } catch (err) {
            console.error('Unexpected error loading stats:', err);
        }
    }, [userId]);

    const removeAlert = useCallback(async (alertId) => {
        if (!alertId) return;
        
        try {
            // ✅ Use fetchWithRetry
            const result = await fetchWithRetry(() => supabase
                .from('price_alerts')
                .update({ is_active: false })
                .eq('id', alertId)
            );

            if (result.error) {
                console.error('Error removing alert:', result.error);
                setError('Failed to remove alert. Please try again.');
                return;
            }

            await Promise.all([loadAlerts(), loadStats()]);
            setError(null);
        } catch (err) {
            console.error('Unexpected error removing alert:', err);
            setError('Failed to remove alert. Please try again.');
        }
    }, [loadAlerts, loadStats]);

    useEffect(() => {
        if (!userId) {
            setError('User ID is required');
            setLoading(false);
            return;
        }
        loadAlerts();
        loadStats();
    }, [userId, loadAlerts, loadStats]);

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid #f3f3f3',
                    borderTop: '3px solid #667eea',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 15px auto'
                }} />
                <p>Loading alerts...</p>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px' }}>
            <h2 style={{ marginBottom: '20px' }}>💰 Price Alerts Dashboard</h2>
            
            {/* ✅ Enhanced Error Message with Retry Button */}
            {error && (
                <div style={{
                    background: '#ff4444',
                    color: 'white',
                    padding: '10px 15px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px'
                }}>
                    <span>⚠️ {error}</span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                            onClick={() => {
                                setError(null);
                                Promise.all([loadAlerts(), loadStats()]);
                            }}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: '1px solid white',
                                color: 'white',
                                padding: '4px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            🔄 Retry
                        </button>
                        <button 
                            onClick={() => setError(null)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '18px',
                                fontWeight: 'bold'
                            }}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}
            
            {/* Stats Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '15px',
                marginBottom: '30px'
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.active_alerts || 0}</div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>Active Alerts</div>
                </div>
                
                <div style={{
                    background: 'linear-gradient(135deg, #f093fb, #f5576c)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.triggered_alerts || 0}</div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>Triggered Alerts</div>
                </div>
                
                <div style={{
                    background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                        ${stats.total_savings?.toFixed(2) || '0.00'}
                    </div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>Total Savings</div>
                </div>
            </div>
            
            {/* Alerts List */}
            {alerts.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    background: '#f9f9f9',
                    borderRadius: '12px'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔔</div>
                    <h3 style={{ color: '#333' }}>No Price Alerts Yet</h3>
                    <p style={{ color: '#333' }}>
                        Set price alerts on products you're interested in.
                        We'll notify you when prices drop!
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {alerts.map(alert => {
                        const product = alert.products;
                        const isTriggered = alert.is_triggered === true;
                        const currentPrice = product?.price || 0;
                        const targetPrice = alert.target_price || 0;
                        const savings = targetPrice - currentPrice;
                        
                        return (
                            <div key={alert.id} style={{
                                background: isTriggered ? '#e8f5e9' : 'white',
                                border: `2px solid ${isTriggered ? '#4CAF50' : '#e0e0e0'}`,
                                borderRadius: '12px',
                                padding: '15px',
                                transition: 'all 0.3s ease'
                            }}>
                                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                    {product?.image_url && (
                                        <img 
                                            src={product.image_url} 
                                            alt={product.name || 'Product'}
                                            style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover' }}
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: '0 0 5px 0' }}>
                                            {product?.name || 'Unknown Product'}
                                        </h4>
                                        <div style={{ display: 'flex', gap: '15px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                            <span style={{ color: '#666' }}>
                                                Current: <strong style={{ color: isTriggered ? '#4CAF50' : '#333' }}>
                                                    ${currentPrice.toFixed(2)}
                                                </strong>
                                            </span>
                                            <span style={{ color: '#666' }}>
                                                Alert at: <strong>${targetPrice.toFixed(2)}</strong>
                                            </span>
                                            {isTriggered && savings > 0 && (
                                                <span style={{ color: '#4CAF50' }}>
                                                    Savings: <strong>${savings.toFixed(2)}</strong>
                                                </span>
                                            )}
                                        </div>
                                        {isTriggered ? (
                                            <div style={{
                                                background: '#4CAF50',
                                                color: 'white',
                                                padding: '5px 10px',
                                                borderRadius: '5px',
                                                display: 'inline-block',
                                                fontSize: '12px'
                                            }}>
                                                🎉 Alert Triggered! Price dropped below your target!
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => removeAlert(alert.id)}
                                                style={{
                                                    background: '#ff4444',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '5px 15px',
                                                    borderRadius: '5px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                Remove Alert
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default React.memo(PriceAlertDashboard);
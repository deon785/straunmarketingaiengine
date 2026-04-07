import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

const PriceAlertDashboard = ({ userId }) => {
    const [alerts, setAlerts] = useState([]);
    const [stats, setStats] = useState({
        total_alerts: 0,
        active_alerts: 0,
        triggered_alerts: 0,
        total_savings: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAlerts();
        loadStats();
    }, [userId]);

    const loadAlerts = async () => {
        const { data, error } = await supabase
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
            .order('created_at', { ascending: false });

        if (!error && data) {
            setAlerts(data);
        }
        setLoading(false);
    };

    const loadStats = async () => {
        const { data, error } = await supabase
            .rpc('get_price_alert_stats', { user_id_param: userId });

        if (!error && data && data[0]) {
            setStats(data[0]);
        }
    };

    const removeAlert = async (alertId) => {
        const { error } = await supabase
            .from('price_alerts')
            .update({ is_active: false })
            .eq('id', alertId);

        if (!error) {
            loadAlerts();
            loadStats();
        }
    };

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '20px' }}>Loading alerts...</div>;
    }

    return (
        <div style={{ padding: '20px' }}>
            <h2 style={{ marginBottom: '20px' }}>💰 Price Alerts Dashboard</h2>
            
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
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.active_alerts}</div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>Active Alerts</div>
                </div>
                
                <div style={{
                    background: 'linear-gradient(135deg, #f093fb, #f5576c)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.triggered_alerts}</div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>Triggered Alerts</div>
                </div>
                
                <div style={{
                    background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>${stats.total_savings?.toFixed(2) || '0'}</div>
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
                    <h3>No Price Alerts Yet</h3>
                    <p style={{ color: '#666' }}>
                        Set price alerts on products you're interested in.
                        We'll notify you when prices drop!
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {alerts.map(alert => (
                        <div key={alert.id} style={{
                            background: alert.is_triggered ? '#e8f5e9' : 'white',
                            border: `2px solid ${alert.is_triggered ? '#4CAF50' : '#e0e0e0'}`,
                            borderRadius: '12px',
                            padding: '15px',
                            transition: 'all 0.3s ease'
                        }}>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                {alert.products?.image_url && (
                                    <img 
                                        src={alert.products.image_url} 
                                        alt={alert.products.name}
                                        style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover' }}
                                    />
                                )}
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: '0 0 5px 0' }}>{alert.products?.name}</h4>
                                    <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
                                        <span style={{ color: '#666' }}>
                                            Current: <strong style={{ color: alert.is_triggered ? '#4CAF50' : '#333' }}>
                                                ${alert.products?.price}
                                            </strong>
                                        </span>
                                        <span style={{ color: '#666' }}>
                                            Alert at: <strong>${alert.target_price}</strong>
                                        </span>
                                        {alert.current_price && (
                                            <span style={{ color: '#4CAF50' }}>
                                                Savings: <strong>${(alert.target_price - alert.current_price).toFixed(2)}</strong>
                                            </span>
                                        )}
                                    </div>
                                    {alert.is_triggered ? (
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
                    ))}
                </div>
            )}
        </div>
    );
};

export default PriceAlertDashboard;
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

// ============ HELPER FUNCTIONS ============
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

// === SANITIZATION HELPER FUNCTIONS ===
const sanitizeInput = (input, maxLength = 100) => {
    if (!input) return '';
    return input
        .toString()
        .trim()
        .replace(/[<>"'`&;\\]/g, '')
        .substring(0, maxLength);
};

const sanitizeLocation = (location) => {
    if (!location) return '';
    return location
        .trim()
        .replace(/[<>"'`&;\\]/g, '')
        .replace(/\s+/g, ' ')
        .substring(0, 100);
};

const sanitizeProductName = (name) => {
    if (!name) return '';
    return name
        .trim()
        .replace(/[<>"'`&;\\]/g, '')
        .replace(/\s+/g, ' ')
        .substring(0, 200);
};

const ToolsPanel = ({ user, selectedMode, onBack, showToastNotification }) => {
    const [searchAlerts, setSearchAlerts] = useState([]);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertSearchTerm, setAlertSearchTerm] = useState('');
    const [alertPriceMin, setAlertPriceMin] = useState('');
    const [alertPriceMax, setAlertPriceMax] = useState('');
    const [alertLocation, setAlertLocation] = useState('');
    const [loadingAlerts, setLoadingAlerts] = useState(false);
    const [error, setError] = useState(null);
    const [creatingAlert, setCreatingAlert] = useState(false);
    const [deletingAlertId, setDeletingAlertId] = useState(null);
    const [togglingAlertId, setTogglingAlertId] = useState(null);

    // ============ FETCH SEARCH ALERTS ============
    const fetchSearchAlerts = async () => {
        if (!user?.id) {
            console.log('No user ID available for fetching alerts');
            return;
        }

        setLoadingAlerts(true);
        setError(null);
        
        try {
            const result = await fetchWithRetry(() =>
                supabase
                    .from('search_alerts')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
            );

            if (result.error) throw result.error;
            
            setSearchAlerts(result.data || []);
        } catch (error) {
            console.error('Error fetching search alerts:', error);
            setError('Failed to load search alerts. Please try again.');
            if (showToastNotification) {
                showToastNotification('⚠️ Failed to load search alerts');
            }
            setSearchAlerts([]);
        } finally {
            setLoadingAlerts(false);
        }
    };

    // ============ CREATE SEARCH ALERT ============
    const createSearchAlert = async () => {
        // ✅ Validate user
        if (!user?.id) {
            const msg = 'Please log in to create search alerts';
            if (showToastNotification) {
                showToastNotification('⚠️ ' + msg);
            } else {
                alert(msg);
            }
            return;
        }

        // ✅ Validate search term
        if (!alertSearchTerm || !alertSearchTerm.trim()) {
            const msg = 'Please enter a search term for the alert';
            if (showToastNotification) {
                showToastNotification('⚠️ ' + msg);
            } else {
                alert(msg);
            }
            return;
        }

        // ✅ Validate price range
        const minPrice = parseFloat(alertPriceMin);
        const maxPrice = parseFloat(alertPriceMax);
        
        if (alertPriceMin && alertPriceMax && minPrice > maxPrice) {
            const msg = 'Minimum price cannot be greater than maximum price';
            if (showToastNotification) {
                showToastNotification('⚠️ ' + msg);
            } else {
                alert(msg);
            }
            return;
        }
        
        if (alertPriceMin && minPrice < 0) {
            const msg = 'Price cannot be negative';
            if (showToastNotification) {
                showToastNotification('⚠️ ' + msg);
            } else {
                alert(msg);
            }
            return;
        }
        
        if (alertPriceMax && maxPrice < 0) {
            const msg = 'Price cannot be negative';
            if (showToastNotification) {
                showToastNotification('⚠️ ' + msg);
            } else {
                alert(msg);
            }
            return;
        }

        // ✅ Check offline
        if (!navigator.onLine) {
            const msg = 'You are offline. Please connect to the internet to create alerts.';
            if (showToastNotification) {
                showToastNotification('⚠️ ' + msg);
            } else {
                alert(msg);
            }
            return;
        }

        setCreatingAlert(true);
        setError(null);

        try {
            const sanitizedTerm = sanitizeProductName(alertSearchTerm);
            const sanitizedLocation = alertLocation ? sanitizeLocation(alertLocation) : null;

            const alertData = {
                user_id: user.id,
                search_term: sanitizedTerm,
                min_price: alertPriceMin && alertPriceMin !== '' ? Number(alertPriceMin) : null,
                max_price: alertPriceMax && alertPriceMax !== '' ? Number(alertPriceMax) : null,
                location: sanitizedLocation,
                is_active: true,
                last_notified_at: null,
                created_at: new Date().toISOString()
            };

            const result = await fetchWithRetry(() =>
                supabase.from('search_alerts').insert([alertData])
            );

            if (result.error) throw result.error;

            const msg = '✅ Search alert created! You\'ll be notified when new matching products are listed.';
            if (showToastNotification) {
                showToastNotification(msg);
            } else {
                alert(msg);
            }
            
            // Reset form
            setAlertSearchTerm('');
            setAlertPriceMin('');
            setAlertPriceMax('');
            setAlertLocation('');
            setShowAlertModal(false);
            
            // Refresh alerts
            await fetchSearchAlerts();
            
        } catch (error) {
            console.error('Error creating search alert:', error);
            const msg = error.message || 'Failed to create search alert. Please try again.';
            setError(msg);
            if (showToastNotification) {
                showToastNotification('❌ ' + msg);
            } else {
                alert(msg);
            }
        } finally {
            setCreatingAlert(false);
        }
    };

    // ============ DELETE SEARCH ALERT ============
    const deleteSearchAlert = async (alertId) => {
        if (!alertId) {
            setError('Invalid alert ID');
            return;
        }
        
        // ✅ Use confirm safely
        if (!window.confirm('Are you sure you want to delete this alert?')) return;

        setDeletingAlertId(alertId);
        setError(null);
        
        try {
            const result = await fetchWithRetry(() =>
                supabase.from('search_alerts').delete().eq('id', alertId)
            );

            if (result.error) throw result.error;

            // Update local state
            setSearchAlerts(prev => prev.filter(alert => alert.id !== alertId));
            
            const msg = '✅ Alert deleted successfully.';
            if (showToastNotification) {
                showToastNotification(msg);
            } else {
                alert(msg);
            }
            
        } catch (error) {
            console.error('Error deleting alert:', error);
            const msg = 'Failed to delete alert. Please try again.';
            setError(msg);
            if (showToastNotification) {
                showToastNotification('❌ ' + msg);
            } else {
                alert(msg);
            }
        } finally {
            setDeletingAlertId(null);
        }
    };

    // ============ TOGGLE ALERT STATUS ============
    const toggleAlertStatus = async (alertId, currentStatus) => {
        if (!alertId) {
            setError('Invalid alert ID');
            return;
        }
        
        setTogglingAlertId(alertId);
        setError(null);
        
        try {
            const result = await fetchWithRetry(() =>
                supabase
                    .from('search_alerts')
                    .update({ is_active: !currentStatus })
                    .eq('id', alertId)
            );

            if (result.error) throw result.error;

            // Update local state
            setSearchAlerts(prev => 
                prev.map(alert => 
                    alert.id === alertId 
                        ? { ...alert, is_active: !currentStatus }
                        : alert
                )
            );
            
            const msg = `✅ Alert ${!currentStatus ? 'activated' : 'paused'} successfully.`;
            if (showToastNotification) {
                showToastNotification(msg);
            } else {
                alert(msg);
            }
            
        } catch (error) {
            console.error('Error toggling alert status:', error);
            const msg = 'Failed to update alert. Please try again.';
            setError(msg);
            if (showToastNotification) {
                showToastNotification('❌ ' + msg);
            } else {
                alert(msg);
            }
        } finally {
            setTogglingAlertId(null);
        }
    };

    // ============ MODAL CLOSE ============
    const handleModalClose = () => {
        setShowAlertModal(false);
        setError(null);
    };

    // ============ INITIAL LOAD ============
    useEffect(() => {
        if (user && user.id && selectedMode === 'buyer') {
            fetchSearchAlerts();
        }
    }, [user, selectedMode]);

    // ============ RENDER ============
    return (
        <div className="tools-panel" style={{
            background: '#1e1e1e',
            minHeight: '100vh',
            color: '#ffffff',
            padding: '20px'
        }}>
            <div className="tools-header" style={{
                marginBottom: '30px',
                padding: '20px',
                background: '#2a2a2a',
                borderRadius: '12px',
                border: '1px solid #3a3a3a'
            }}>
                <button onClick={onBack} className="back-button" style={{
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '20px'
                }}>
                    ← Back to Search
                </button>
                <h2 style={{ margin: 0, color: '#ffffff', fontSize: '24px' }}>🔧 Tools & Features</h2>
            </div>

            {/* Error Message */}
            {error && (
                <div style={{
                    background: '#ff4444',
                    color: 'white',
                    padding: '10px 15px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>⚠️ {error}</span>
                    <button 
                        onClick={() => setError(null)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '18px'
                        }}
                    >
                        ×
                    </button>
                </div>
            )}

            <div className="tools-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '20px'
            }}>
                {/* Search Alerts Tool */}
                <div className="tool-card" style={{
                    background: '#2a2a2a',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #3a3a3a',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                    <div className="tool-icon" style={{ 
                        fontSize: '32px', 
                        marginBottom: '15px',
                        color: '#667eea' 
                    }}>🔔</div>
                    <h3 style={{ 
                        margin: '0 0 10px 0', 
                        color: '#ffffff', 
                        fontSize: '18px' 
                    }}>Search Alerts</h3>
                    <p style={{ 
                        margin: '0 0 15px 0', 
                        color: '#cccccc', 
                        fontSize: '14px', 
                        lineHeight: '1.5' 
                    }}>
                        Get notified when new products match your saved searches.
                    </p>
                    
                    <div className="tool-stats" style={{
                        background: 'rgba(102, 126, 234, 0.2)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        marginBottom: '15px',
                        fontSize: '12px',
                        color: '#9bb1ff',
                        fontWeight: 'bold',
                        border: '1px solid rgba(102, 126, 234, 0.3)'
                    }}>
                        <span>{loadingAlerts ? 'Loading...' : `${searchAlerts.length} Active Alerts`}</span>
                    </div>
                    
                    <div className="tool-actions" style={{ display: 'flex', gap: '10px' }}>
                        <button 
                            onClick={() => setShowAlertModal(true)}
                            className="tool-primary-btn"
                            style={{
                                flex: 1,
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                border: 'none',
                                padding: '12px',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                fontSize: '14px',
                                transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            + New Alert
                        </button>
                        <button 
                            onClick={fetchSearchAlerts}
                            disabled={loadingAlerts}
                            className="tool-secondary-btn"
                            style={{
                                flex: 1,
                                background: '#3a3a3a',
                                color: '#cccccc',
                                border: '1px solid #4a4a4a',
                                padding: '12px',
                                borderRadius: '8px',
                                cursor: loadingAlerts ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                transition: 'all 0.3s ease',
                                opacity: loadingAlerts ? 0.6 : 1
                            }}
                            onMouseEnter={(e) => !loadingAlerts && (e.currentTarget.style.background = '#444444')}
                            onMouseLeave={(e) => !loadingAlerts && (e.currentTarget.style.background = '#3a3a3a')}
                        >
                            {loadingAlerts ? 'Loading...' : 'Refresh'}
                        </button>
                    </div>

                    {/* Search Alerts List */}
                    {searchAlerts.length > 0 && (
                        <div className="alerts-list" style={{ 
                            marginTop: '20px', 
                            borderTop: '1px solid #3a3a3a', 
                            paddingTop: '15px' 
                        }}>
                            <h4 style={{ 
                                margin: '0 0 10px 0', 
                                fontSize: '16px',
                                color: '#ffffff' 
                            }}>Your Alerts:</h4>
                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {searchAlerts.map(alert => (
                                    <div key={alert.id} className="alert-item" style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px',
                                        background: '#2a2a2a',
                                        borderRadius: '8px',
                                        marginBottom: '8px',
                                        border: '1px solid #3a3a3a',
                                        transition: 'all 0.3s ease',
                                        opacity: (deletingAlertId === alert.id || togglingAlertId === alert.id) ? 0.6 : 1
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#333333'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#2a2a2a'}
                                    >
                                        <div className="alert-content" style={{ flex: 1 }}>
                                            <strong style={{ 
                                                fontSize: '14px', 
                                                color: '#ffffff',
                                                display: 'block',
                                                marginBottom: '4px'
                                            }}>
                                                {alert.search_term}
                                            </strong>
                                            <div style={{ 
                                                fontSize: '12px', 
                                                color: '#aaaaaa', 
                                                marginTop: '4px' 
                                            }}>
                                                {alert.min_price && (
                                                    <div>Min Price: <strong style={{color: '#4CAF50'}}>${alert.min_price}</strong></div>
                                                )}
                                                {alert.max_price && (
                                                    <div>Max Price: <strong style={{color: '#4CAF50'}}>${alert.max_price}</strong></div>
                                                )}
                                                {alert.location && (
                                                    <div>Location: <strong style={{color: '#667eea'}}>{alert.location}</strong></div>
                                                )}
                                                <div>Status: 
                                                    <span style={{
                                                        color: alert.is_active ? '#4CAF50' : '#ff9800',
                                                        fontWeight: 'bold',
                                                        marginLeft: '5px'
                                                    }}>
                                                        {alert.is_active ? 'Active 🔔' : 'Paused ⏸️'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="alert-actions" style={{ display: 'flex', gap: '5px' }}>
                                            <button
                                                onClick={() => toggleAlertStatus(alert.id, alert.is_active)}
                                                disabled={togglingAlertId === alert.id}
                                                title={alert.is_active ? 'Pause alert' : 'Activate alert'}
                                                style={{
                                                    background: 'rgba(76, 175, 80, 0.2)',
                                                    border: '1px solid rgba(76, 175, 80, 0.3)',
                                                    cursor: togglingAlertId === alert.id ? 'not-allowed' : 'pointer',
                                                    padding: '6px',
                                                    borderRadius: '4px',
                                                    fontSize: '14px',
                                                    color: alert.is_active ? '#4CAF50' : '#ff9800',
                                                    transition: 'all 0.3s ease',
                                                    opacity: togglingAlertId === alert.id ? 0.6 : 1
                                                }}
                                                onMouseEnter={(e) => !togglingAlertId === alert.id && (e.currentTarget.style.background = 'rgba(76, 175, 80, 0.3)')}
                                                onMouseLeave={(e) => !togglingAlertId === alert.id && (e.currentTarget.style.background = 'rgba(76, 175, 80, 0.2)')}
                                            >
                                                {togglingAlertId === alert.id ? '⏳' : (alert.is_active ? '⏸️' : '▶️')}
                                            </button>
                                            <button
                                                onClick={() => deleteSearchAlert(alert.id)}
                                                disabled={deletingAlertId === alert.id}
                                                title="Delete alert"
                                                style={{
                                                    background: 'rgba(255, 68, 68, 0.2)',
                                                    border: '1px solid rgba(255, 68, 68, 0.3)',
                                                    cursor: deletingAlertId === alert.id ? 'not-allowed' : 'pointer',
                                                    padding: '6px',
                                                    borderRadius: '4px',
                                                    fontSize: '14px',
                                                    color: '#ff4444',
                                                    transition: 'all 0.3s ease',
                                                    opacity: deletingAlertId === alert.id ? 0.6 : 1
                                                }}
                                                onMouseEnter={(e) => !deletingAlertId === alert.id && (e.currentTarget.style.background = 'rgba(255, 68, 68, 0.3)')}
                                                onMouseLeave={(e) => !deletingAlertId === alert.id && (e.currentTarget.style.background = 'rgba(255, 68, 68, 0.2)')}
                                            >
                                                {deletingAlertId === alert.id ? '⌛' : '🗑️'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {!loadingAlerts && searchAlerts.length === 0 && (
                        <div style={{
                            marginTop: '15px',
                            padding: '20px',
                            textAlign: 'center',
                            background: '#1e1e1e',
                            borderRadius: '8px',
                            border: '1px dashed #3a3a3a'
                        }}>
                            <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>
                                No alerts yet. Create one to get notified about new products!
                            </p>
                        </div>
                    )}
                </div>

                {/* Coming Soon Tool Card */}
                <div className="tool-card" style={{
                    background: '#2a2a2a',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #3a3a3a',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                    <div className="tool-icon" style={{ 
                        fontSize: '32px', 
                        marginBottom: '15px',
                        color: '#667eea' 
                    }}>📊</div>
                    <h3 style={{ 
                        margin: '0 0 10px 0', 
                        color: '#ffffff', 
                        fontSize: '18px' 
                    }}>Coming Soon</h3>
                    <p style={{ 
                        margin: '0 0 15px 0', 
                        color: '#cccccc', 
                        fontSize: '14px', 
                        lineHeight: '1.5' 
                    }}>
                        More tools and features will be added here soon!
                    </p>
                    <div style={{
                        background: 'rgba(102, 126, 234, 0.1)',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(102, 126, 234, 0.2)',
                        marginTop: '15px'
                    }}>
                        <p style={{ 
                            margin: 0, 
                            fontSize: '12px', 
                            color: '#9bb1ff' 
                        }}>
                            <strong>✨ Planned Features:</strong>
                        </p>
                        <ul style={{ 
                            margin: '8px 0 0 0', 
                            paddingLeft: '20px',
                            color: '#aaaaaa',
                            fontSize: '12px'
                        }}>
                            <li>Price comparison tool</li>
                            <li>Seller ratings & reviews</li>
                            <li>Advanced search filters</li>
                            <li>Saved search templates</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Search Alert Modal */}
            {showAlertModal && (
                <div className="modal-overlay" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.8)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }} onClick={handleModalClose}>
                    <div className="modal-content" style={{
                        background: '#2a2a2a',
                        borderRadius: '12px',
                        padding: '25px',
                        maxWidth: '500px',
                        width: '90%',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        border: '1px solid #3a3a3a',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px'
                        }}>
                            <h3 style={{ 
                                margin: 0, 
                                color: '#ffffff',
                                fontSize: '20px'
                            }}>🔔 Create Search Alert</h3>
                            <button 
                                onClick={handleModalClose}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '28px',
                                    cursor: 'pointer',
                                    color: '#cccccc',
                                    padding: '0',
                                    lineHeight: '1'
                                }}
                            >
                                ×
                            </button>
                        </div>
                        
                        {/* Modal Error */}
                        {error && (
                            <div style={{
                                background: '#ff4444',
                                color: 'white',
                                padding: '10px',
                                borderRadius: '8px',
                                marginBottom: '15px',
                                fontSize: '13px'
                            }}>
                                ⚠️ {error}
                            </div>
                        )}
                        
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ 
                                display: 'block', 
                                marginBottom: '8px', 
                                fontWeight: 'bold',
                                color: '#ffffff' 
                            }}>
                                Search Term *
                            </label>
                            <input
                                type="text"
                                value={alertSearchTerm}
                                onChange={(e) => setAlertSearchTerm(e.target.value)}
                                placeholder="What are you looking for? (e.g., iPhone 13, Laptop)"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: '#1e1e1e',
                                    border: '2px solid #3a3a3a',
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    color: '#ffffff',
                                    outline: 'none'
                                }}
                            />
                        </div>
                        
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ 
                                display: 'block', 
                                marginBottom: '8px', 
                                fontWeight: 'bold',
                                color: '#ffffff' 
                            }}>
                                Price Range (Optional)
                            </label>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <input
                                    type="number"
                                    value={alertPriceMin}
                                    onChange={(e) => setAlertPriceMin(e.target.value)}
                                    placeholder="Min $"
                                    min="0"
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: '#1e1e1e',
                                        border: '2px solid #3a3a3a',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        outline: 'none'
                                    }}
                                />
                                <span style={{color: '#cccccc'}}>to</span>
                                <input
                                    type="number"
                                    value={alertPriceMax}
                                    onChange={(e) => setAlertPriceMax(e.target.value)}
                                    placeholder="Max $"
                                    min="0"
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: '#1e1e1e',
                                        border: '2px solid #3a3a3a',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>
                        
                        <div style={{ marginBottom: '25px' }}>
                            <label style={{ 
                                display: 'block', 
                                marginBottom: '8px', 
                                fontWeight: 'bold',
                                color: '#ffffff' 
                            }}>
                                Location (Optional)
                            </label>
                            <input
                                type="text"
                                value={alertLocation}
                                onChange={(e) => setAlertLocation(e.target.value)}
                                placeholder="City or area (e.g., New York)"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: '#1e1e1e',
                                    border: '2px solid #3a3a3a',
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    color: '#ffffff',
                                    outline: 'none'
                                }}
                            />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={createSearchAlert}
                                disabled={!alertSearchTerm.trim() || creatingAlert}
                                style={{
                                    flex: 1,
                                    background: (!alertSearchTerm.trim() || creatingAlert) 
                                        ? '#3a3a3a' 
                                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '14px',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    fontSize: '16px',
                                    cursor: (!alertSearchTerm.trim() || creatingAlert) ? 'not-allowed' : 'pointer',
                                    opacity: (!alertSearchTerm.trim() || creatingAlert) ? 0.6 : 1,
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (alertSearchTerm.trim() && !creatingAlert) {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (alertSearchTerm.trim() && !creatingAlert) {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }
                                }}
                            >
                                {creatingAlert ? 'Creating...' : 'Create Alert'}
                            </button>
                            <button
                                onClick={handleModalClose}
                                disabled={creatingAlert}
                                style={{
                                    padding: '14px 20px',
                                    background: '#3a3a3a',
                                    color: '#cccccc',
                                    border: '1px solid #4a4a4a',
                                    borderRadius: '8px',
                                    cursor: creatingAlert ? 'not-allowed' : 'pointer',
                                    fontSize: '16px',
                                    transition: 'all 0.3s ease',
                                    opacity: creatingAlert ? 0.6 : 1
                                }}
                                onMouseEnter={(e) => {
                                    if (!creatingAlert) {
                                        e.currentTarget.style.background = '#444444';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!creatingAlert) {
                                        e.currentTarget.style.background = '#3a3a3a';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                        
                        <div style={{ 
                            marginTop: '20px', 
                            padding: '15px', 
                            background: 'rgba(102, 126, 234, 0.1)',
                            borderRadius: '8px',
                            border: '1px solid rgba(102, 126, 234, 0.2)'
                        }}>
                            <p style={{ 
                                margin: 0, 
                                fontSize: '14px', 
                                color: '#9bb1ff',
                                lineHeight: '1.5'
                            }}>
                                <strong>💡 How it works:</strong> We'll monitor new listings and notify you when products match your search criteria.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ToolsPanel;
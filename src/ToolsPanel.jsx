import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

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

    // Fetch user's search alerts
    const fetchSearchAlerts = async () => {
        if (!user) return;

        setLoadingAlerts(true);
        try {
            const { data, error } = await supabase
                .from('search_alerts')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            setSearchAlerts(data || []);
        } catch (error) {
            console.error('Error fetching search alerts:', error);
            if (showToastNotification) {
                showToastNotification('Failed to load search alerts');
            }
        } finally {
            setLoadingAlerts(false);
        }
    };

    // Create a search alert
    const createSearchAlert = async () => {
        if (!user) {
            alert('Please log in to create search alerts');
            return;
        }

        if (!alertSearchTerm.trim()) {
            alert('Please enter a search term for the alert');
            return;
        }

        // Add price validation
        if (alertPriceMin && alertPriceMax && Number(alertPriceMin) > Number(alertPriceMax)) {
            alert('Minimum price cannot be greater than maximum price');
            return;
        }
        
        // Add price sanity check
        if (alertPriceMin && Number(alertPriceMin) < 0) {
            alert('Price cannot be negative');
            return;
        }
        
        if (alertPriceMax && Number(alertPriceMax) < 0) {
            alert('Price cannot be negative');
            return;
        }

        try {
            const sanitizedTerm = sanitizeProductName(alertSearchTerm);
            const sanitizedLocation = alertLocation ? sanitizeLocation(alertLocation) : null;

            const alertData = {
                user_id: user.id,
                search_term: sanitizedTerm,
                min_price: alertPriceMin ? Number(alertPriceMin) : null,
                max_price: alertPriceMax ? Number(alertPriceMax) : null,
                location: sanitizedLocation,
                is_active: true,
                last_notified_at: null,
                created_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('search_alerts')
                .insert([alertData]);

            if (error) throw error;

            alert('✅ Search alert created! You\'ll be notified when new matching products are listed.');
            
            // Reset form
            setAlertSearchTerm('');
            setAlertPriceMin('');
            setAlertPriceMax('');
            setAlertLocation('');
            setShowAlertModal(false);
            
            // Refresh alerts
            fetchSearchAlerts();
            
        } catch (error) {
            console.error('Error creating search alert:', error);
            alert('Failed to create search alert. Please try again.');
        }
    };

    // Delete a search alert
    const deleteSearchAlert = async (alertId) => {
        if (!confirm('Are you sure you want to delete this alert?')) return;

        try {
            const { error } = await supabase
                .from('search_alerts')
                .delete()
                .eq('id', alertId);

            if (error) throw error;

            // Update local state
            setSearchAlerts(prev => prev.filter(alert => alert.id !== alertId));
            
            if (showToastNotification) {
                showToastNotification('✅ Alert deleted successfully.');
            } else {
                alert('✅ Alert deleted successfully.');
            }
            
        } catch (error) {
            console.error('Error deleting alert:', error);
            alert('Failed to delete alert. Please try again.');
        }
    };

    // Toggle alert status (active/inactive)
    const toggleAlertStatus = async (alertId, currentStatus) => {
        try {
            const { error } = await supabase
                .from('search_alerts')
                .update({ is_active: !currentStatus })
                .eq('id', alertId);

            if (error) throw error;

            // Update local state
            setSearchAlerts(prev => 
                prev.map(alert => 
                    alert.id === alertId 
                        ? { ...alert, is_active: !currentStatus }
                        : alert
                )
            );
            
            if (showToastNotification) {
                showToastNotification(`✅ Alert ${!currentStatus ? 'activated' : 'paused'} successfully.`);
            } else {
                alert(`✅ Alert ${!currentStatus ? 'activated' : 'paused'} successfully.`);
            }
            
        } catch (error) {
            console.error('Error toggling alert status:', error);
            alert('Failed to update alert. Please try again.');
        }
    };

    useEffect(() => {
        if (user && selectedMode === 'buyer') {
            fetchSearchAlerts();
        }
    }, [user, selectedMode]);

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
                            className="tool-secondary-btn"
                            style={{
                                flex: 1,
                                background: '#3a3a3a',
                                color: '#cccccc',
                                border: '1px solid #4a4a4a',
                                padding: '12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#444444'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#3a3a3a'}
                        >
                            Refresh
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
                                        transition: 'all 0.3s ease'
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
                                                title={alert.is_active ? 'Pause alert' : 'Activate alert'}
                                                style={{
                                                    background: 'rgba(76, 175, 80, 0.2)',
                                                    border: '1px solid rgba(76, 175, 80, 0.3)',
                                                    cursor: 'pointer',
                                                    padding: '6px',
                                                    borderRadius: '4px',
                                                    fontSize: '14px',
                                                    color: alert.is_active ? '#4CAF50' : '#ff9800',
                                                    transition: 'all 0.3s ease'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(76, 175, 80, 0.3)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(76, 175, 80, 0.2)'}
                                            >
                                                {alert.is_active ? '⏸️' : '▶️'}
                                            </button>
                                            <button
                                                onClick={() => deleteSearchAlert(alert.id)}
                                                title="Delete alert"
                                                style={{
                                                    background: 'rgba(255, 68, 68, 0.2)',
                                                    border: '1px solid rgba(255, 68, 68, 0.3)',
                                                    cursor: 'pointer',
                                                    padding: '6px',
                                                    borderRadius: '4px',
                                                    fontSize: '14px',
                                                    color: '#ff4444',
                                                    transition: 'all 0.3s ease'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 68, 68, 0.3)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 68, 68, 0.2)'}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Add more tool cards as needed */}
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
                }}>
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
                    }}>
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
                                onClick={() => setShowAlertModal(false)}
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
                                disabled={!alertSearchTerm.trim()}
                                style={{
                                    flex: 1,
                                    background: !alertSearchTerm.trim() 
                                        ? '#3a3a3a' 
                                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '14px',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    fontSize: '16px',
                                    cursor: !alertSearchTerm.trim() ? 'not-allowed' : 'pointer',
                                    opacity: !alertSearchTerm.trim() ? 0.6 : 1,
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (alertSearchTerm.trim()) {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (alertSearchTerm.trim()) {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }
                                }}
                            >
                                Create Alert
                            </button>
                            <button
                                onClick={() => setShowAlertModal(false)}
                                style={{
                                    padding: '14px 20px',
                                    background: '#3a3a3a',
                                    color: '#cccccc',
                                    border: '1px solid #4a4a4a',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#444444';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#3a3a3a';
                                    e.currentTarget.style.transform = 'translateY(0)';
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
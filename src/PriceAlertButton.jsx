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

const PriceAlertButton = ({ product, userId, onAlertSet }) => {
    const [targetPrice, setTargetPrice] = useState('');
    const [hasAlert, setHasAlert] = useState(false);
    const [existingAlert, setExistingAlert] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [suggestedPrice, setSuggestedPrice] = useState(null);
    const [error, setError] = useState(null);

    // Check if product exists
    if (!product || !product.id) {
        return null;
    }

    // ✅ Memoize functions
    const checkExistingAlert = useCallback(async () => {
        if (!userId) return;
        
        try {
            // ✅ Use fetchWithRetry
            const result = await fetchWithRetry(() => supabase
                .from('price_alerts')
                .select('*')
                .eq('user_id', userId)
                .eq('product_id', product.id)
                .maybeSingle()
            );
            
            if (!result.error && result.data) {
                setHasAlert(true);
                setExistingAlert(result.data);
                setTargetPrice(result.data.target_price?.toString() || '');
            }
        } catch (err) {
            console.error('Error checking existing alert:', err);
            // Silent fail - don't crash
        }
    }, [userId, product.id]);

    const calculateSuggestedPrice = useCallback(() => {
        if (product?.price && typeof product.price === 'number') {
            const discount = product.price * 0.15;
            const suggested = (product.price - discount).toFixed(2);
            setSuggestedPrice(suggested);
        }
    }, [product.price]);

    useEffect(() => {
        checkExistingAlert();
        calculateSuggestedPrice();
    }, [checkExistingAlert, calculateSuggestedPrice]);

    const setPriceAlert = async () => {
        // ✅ Check offline status
        if (!navigator.onLine) {
            setError('You are offline. Please connect to the internet to set alerts.');
            return;
        }
        
        if (!targetPrice) {
            setError('Please enter a target price');
            return;
        }
        
        const targetPriceNum = parseFloat(targetPrice);
        if (isNaN(targetPriceNum)) {
            setError('Please enter a valid number');
            return;
        }
        
        if (targetPriceNum >= product.price) {
            setError('Alert price must be lower than current price');
            return;
        }

        setLoading(true);
        setError(null);
        
        try {
            // ✅ Use fetchWithRetry
            const result = await fetchWithRetry(() => supabase
                .from('price_alerts')
                .upsert({
                    user_id: userId,
                    product_id: product.id,
                    target_price: targetPriceNum,
                    current_price: product.price,
                    is_active: true,
                    is_triggered: false,
                    updated_at: new Date().toISOString()
                })
                .select()
                .maybeSingle()
            );

            if (result.error) throw result.error;

            setHasAlert(true);
            setExistingAlert(result.data);
            setShowModal(false);
            setTargetPrice('');
            
            if (onAlertSet) onAlertSet(true);
            
            alert(`✅ Price alert set! We'll notify you when "${product.name}" drops below $${targetPriceNum}`);
        } catch (error) {
            console.error('Error setting price alert:', error);
            setError(error.message || 'Failed to set price alert. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const removeAlert = async () => {
        // ✅ Check offline status
        if (!navigator.onLine) {
            setError('You are offline. Please connect to the internet to remove alerts.');
            return;
        }
        
        if (!userId || !product?.id) return;
        
        setLoading(true);
        setError(null);
        
        try {
            // ✅ Use fetchWithRetry
            const result = await fetchWithRetry(() => supabase
                .from('price_alerts')
                .update({ is_active: false })
                .eq('user_id', userId)
                .eq('product_id', product.id)
            );

            if (result.error) throw result.error;

            setHasAlert(false);
            setExistingAlert(null);
            setTargetPrice('');
            
            if (onAlertSet) onAlertSet(false);
            
            alert('🔕 Price alert removed');
        } catch (error) {
            console.error('Error removing alert:', error);
            setError(error.message || 'Failed to remove alert. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getSavingsMessage = () => {
        if (existingAlert && existingAlert.current_price) {
            const savings = existingAlert.target_price - existingAlert.current_price;
            if (savings > 0) {
                return `💸 You could save $${savings.toFixed(2)}!`;
            }
        }
        return null;
    };

    return (
        <>
            {/* Error Message */}
            {error && (
                <div style={{
                    background: '#ff4444',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    marginTop: '10px',
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
                            fontSize: '16px'
                        }}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Alert Button */}
            {!hasAlert ? (
                <button
                    onClick={() => {
                        setError(null);
                        setShowModal(true);
                    }}
                    style={{
                        width: '100%',
                        backgroundColor: '#FF9800',
                        color: 'white',
                        border: 'none',
                        padding: '10px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        marginTop: '10px'
                    }}
                >
                    <span>🔔</span>
                    Set Price Alert
                </button>
            ) : (
                <div style={{
                    width: '100%',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '8px',
                    marginTop: '10px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '12px', opacity: 0.9 }}>
                                Alert at ${existingAlert?.target_price?.toFixed(2) || '?'}
                            </div>
                            {getSavingsMessage() && (
                                <div style={{ fontSize: '11px', marginTop: '3px' }}>
                                    {getSavingsMessage()}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={removeAlert}
                            disabled={loading}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                color: 'white',
                                padding: '5px 10px',
                                borderRadius: '5px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontSize: '12px',
                                opacity: loading ? 0.6 : 1
                            }}
                        >
                            {loading ? '...' : 'Remove'}
                        </button>
                    </div>
                </div>
            )}

            {/* Price Alert Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }} onClick={() => setShowModal(false)}>
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        maxWidth: '400px',
                        width: '100%',
                        padding: '24px',
                        position: 'relative'
                    }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setShowModal(false)}
                            style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                background: 'none',
                                border: 'none',
                                fontSize: '24px',
                                cursor: 'pointer',
                                color: '#666'
                            }}
                        >
                            ×
                        </button>
                        
                        <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>
                            🔔 Set Price Alert
                        </h3>
                        
                        <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
                            Get notified when "{product.name}" drops to your target price
                        </p>
                        
                        <div style={{ marginBottom: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span style={{ fontWeight: 'bold' }}>Current Price:</span>
                                <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>${product.price?.toFixed(2) || '0'}</span>
                            </div>
                            
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                                    Alert me when price drops below:
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span>$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max={product.price - 0.01}
                                        value={targetPrice}
                                        onChange={(e) => setTargetPrice(e.target.value)}
                                        placeholder={suggestedPrice}
                                        style={{
                                            flex: 1,
                                            padding: '10px',
                                            border: '2px solid #ddd',
                                            borderRadius: '8px',
                                            fontSize: '16px'
                                        }}
                                    />
                                </div>
                            </div>
                            
                            {suggestedPrice && (
                                <button
                                    onClick={() => setTargetPrice(suggestedPrice)}
                                    style={{
                                        background: '#f0f0f0',
                                        border: 'none',
                                        padding: '5px 10px',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        marginBottom: '15px'
                                    }}
                                >
                                    💡 Suggested: ${suggestedPrice}
                                </button>
                            )}
                            
                            <div style={{
                                background: '#f0f7ff',
                                padding: '12px',
                                borderRadius: '8px',
                                marginTop: '15px'
                            }}>
                                <div style={{ fontSize: '12px', color: '#666' }}>
                                    📊 When price drops below your target:
                                </div>
                                <ul style={{ fontSize: '12px', color: '#666', margin: '5px 0 0 20px' }}>
                                    <li>You'll get an instant notification</li>
                                    <li>The product will be highlighted in your wishlist</li>
                                    <li>You can act fast before others do!</li>
                                </ul>
                            </div>
                        </div>
                        
                        <button
                            onClick={setPriceAlert}
                            disabled={loading || !targetPrice || parseFloat(targetPrice) >= product.price}
                            style={{
                                width: '100%',
                                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                color: 'white',
                                border: 'none',
                                padding: '12px',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                cursor: (loading || !targetPrice || parseFloat(targetPrice) >= product.price) ? 'not-allowed' : 'pointer',
                                opacity: (loading || !targetPrice || parseFloat(targetPrice) >= product.price) ? 0.6 : 1
                            }}
                        >
                            {loading ? 'Setting Alert...' : '🔔 Set Price Alert'}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default React.memo(PriceAlertButton);
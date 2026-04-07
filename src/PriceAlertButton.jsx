import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

const PriceAlertButton = ({ product, userId, onAlertSet }) => {
    const [targetPrice, setTargetPrice] = useState('');
    const [hasAlert, setHasAlert] = useState(false);
    const [existingAlert, setExistingAlert] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [suggestedPrice, setSuggestedPrice] = useState(null);

    useEffect(() => {
        checkExistingAlert();
        calculateSuggestedPrice();
    }, [product.id]);

    const checkExistingAlert = async () => {
        if (!userId) return;
        
        const { data, error } = await supabase
            .from('price_alerts')
            .select('*')
            .eq('user_id', userId)
            .eq('product_id', product.id)
            .maybeSingle();
        
        if (data && !error) {
            setHasAlert(true);
            setExistingAlert(data);
            setTargetPrice(data.target_price);
        }
    };

    const calculateSuggestedPrice = () => {
        // Suggest a price 10-20% below current price
        if (product.price) {
            const discount = product.price * 0.15; // 15% discount
            const suggested = (product.price - discount).toFixed(2);
            setSuggestedPrice(suggested);
        }
    };

    const setPriceAlert = async () => {
        if (!targetPrice || targetPrice >= product.price) {
            alert('Alert price must be lower than current price');
            return;
        }

        setLoading(true);
        
        try {
            const { data, error } = await supabase
                .from('price_alerts')
                .upsert({
                    user_id: userId,
                    product_id: product.id,
                    target_price: parseFloat(targetPrice),
                    current_price: product.price,
                    is_active: true,
                    is_triggered: false,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            setHasAlert(true);
            setExistingAlert(data);
            setShowModal(false);
            
            if (onAlertSet) onAlertSet(true);
            
            alert(`✅ Price alert set! We'll notify you when "${product.name}" drops below $${targetPrice}`);
        } catch (error) {
            console.error('Error setting price alert:', error);
            alert('Failed to set price alert. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const removeAlert = async () => {
        setLoading(true);
        
        try {
            const { error } = await supabase
                .from('price_alerts')
                .update({ is_active: false })
                .eq('user_id', userId)
                .eq('product_id', product.id);

            if (error) throw error;

            setHasAlert(false);
            setExistingAlert(null);
            setTargetPrice('');
            
            if (onAlertSet) onAlertSet(false);
            
            alert('🔕 Price alert removed');
        } catch (error) {
            console.error('Error removing alert:', error);
            alert('Failed to remove alert. Please try again.');
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
            {/* Alert Button */}
            {!hasAlert ? (
                <button
                    onClick={() => setShowModal(true)}
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
                                Alert at ${existingAlert?.target_price}
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
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            Remove
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
                                <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>${product.price}</span>
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
                            disabled={loading || !targetPrice || targetPrice >= product.price}
                            style={{
                                width: '100%',
                                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                color: 'white',
                                border: 'none',
                                padding: '12px',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                cursor: (loading || !targetPrice || targetPrice >= product.price) ? 'not-allowed' : 'pointer',
                                opacity: (loading || !targetPrice || targetPrice >= product.price) ? 0.6 : 1
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

export default PriceAlertButton;
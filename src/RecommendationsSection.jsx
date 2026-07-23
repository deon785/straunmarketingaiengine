// RecommendationsSection.jsx - COMPLETE FIXED VERSION WITH ALTERNATIVE PROSPECTS

import React, { useState, useEffect } from 'react';
import RecommendationEngine from './recommendationEngine';

const RecommendationsSection = ({ 
    userId, 
    currentProductId = null, 
    onProductClick,
    isAlternative = false,
    isSimilar = false,
    isAlternativeProspects = false, 
    searchTerm = ''
}) => {
    const [personalized, setPersonalized] = useState([]);
    const [trending, setTrending] = useState([]);
    const [similar, setSimilar] = useState([]);
    const [alternativeProspects, setAlternativeProspects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('personalized');

    let engine = null;
    try {
        engine = new RecommendationEngine(userId);
    } catch (err) {
        console.error('Failed to initialize recommendation engine:', err);
        setError('Recommendation engine unavailable');
    }

    useEffect(() => {
        if (engine) {
            loadRecommendations();
        } else {
            setLoading(false);
            setError('Recommendation engine not available');
        }
    }, [userId, currentProductId, searchTerm, isAlternative, isSimilar, isAlternativeProspects]);

    const trackView = async (productId) => {
        if (!engine) return;
        try {
            await engine.trackBehavior(productId, 'view');
        } catch (err) {
            console.error('Failed to track view:', err);
        }
    };

    const loadRecommendations = async () => {
        setLoading(true);
        setError(null);
        
        try {
            let personalizedRecs = [];
            let trendingRecs = [];
            let similarRecs = [];
            let prospectsRecs = [];
            
            // ✅ NEW: Alternative prospects for sellers
            if (isAlternativeProspects && searchTerm) {
                try {
                    if (engine && typeof engine.getAlternativeProspects === 'function') {
                        prospectsRecs = await engine.getAlternativeProspects(searchTerm, 8);
                        console.log(`✅ Found ${prospectsRecs.length} alternative prospects`);
                    }
                } catch (err) {
                    console.error('Error loading alternative prospects:', err);
                }
            }
            // ✅ If no search results, show alternative products (Buyer mode)
            else if (isAlternative && searchTerm) {
                try {
                    if (engine && typeof engine.getAlternativeProducts === 'function') {
                        personalizedRecs = await engine.getAlternativeProducts(searchTerm, 8);
                    }
                } catch (err) {
                    console.error('Error loading alternative products:', err);
                }
            }
            // ✅ If search has results, show similar products
            else if (isSimilar && currentProductId) {
                try {
                    if (engine && typeof engine.getSimilarProducts === 'function') {
                        similarRecs = await engine.getSimilarProducts(currentProductId, 6);
                    }
                } catch (err) {
                    console.error('Error loading similar products:', err);
                }
            }
            // ✅ Default: show personalized
            else {
                try {
                    if (engine && typeof engine.getPersonalizedRecommendations === 'function') {
                        personalizedRecs = await engine.getPersonalizedRecommendations(8);
                    }
                } catch (err) {
                    console.error('Error loading personalized recommendations:', err);
                }
            }

            // ✅ Also load trending as backup
            try {
                if (engine && typeof engine.getTrendingProducts === 'function') {
                    trendingRecs = await engine.getTrendingProducts(4);
                }
            } catch (trendingErr) {
                console.error('Error loading trending products:', trendingErr);
            }

            // ✅ If we're showing similar products but none found, fallback to personalized
            if (isSimilar && similarRecs.length === 0) {
                try {
                    if (engine && typeof engine.getPersonalizedRecommendations === 'function') {
                        personalizedRecs = await engine.getPersonalizedRecommendations(6);
                    }
                } catch (err) {
                    console.error('Error loading fallback recommendations:', err);
                }
            }

            setPersonalized(personalizedRecs || []);
            setTrending(trendingRecs || []);
            setSimilar(similarRecs || []);
            setAlternativeProspects(prospectsRecs || []);
            
        } catch (error) {
            console.error('Error loading recommendations:', error);
            setError('Failed to load recommendations');
        } finally {
            setLoading(false);
        }
    };
    
    // ✅ Render product card (for products)
    const renderProductCard = (product) => {
        if (!product || !product.id) return null;
        
        let label = null;
        if (product.is_alternative) {
            label = <span style={{ 
                fontSize: '10px', 
                color: '#FF9800',
                background: '#FFF3E0',
                padding: '2px 8px',
                borderRadius: '4px',
                display: 'inline-block',
                marginTop: '5px'
            }}>💡 Alternative</span>;
        } else if (product.is_similar) {
            label = <span style={{ 
                fontSize: '10px', 
                color: '#2196F3',
                background: '#E3F2FD',
                padding: '2px 8px',
                borderRadius: '4px',
                display: 'inline-block',
                marginTop: '5px'
            }}>🔍 Similar</span>;
        }
        
        return (
            <div
                key={product.id}
                onClick={() => {
                    trackView(product.id);
                    if (onProductClick) onProductClick(product);
                }}
                style={{
                    background: 'white',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    border: '1px solid #e0e0e0'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
            >
                {product.image_url ? (
                    <img 
                        src={product.image_url} 
                        alt={product.name || 'Product'}
                        style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                        }}
                    />
                ) : null}
                <div style={{ 
                    width: '100%', 
                    height: '150px', 
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: product.image_url ? 'none' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '48px'
                }}>
                    🛍️
                </div>
                
                <div style={{ padding: '12px' }}>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 'bold' }}>
                        {product.name || 'Unnamed Product'}
                    </h4>
                    <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold', 
                        color: '#4CAF50',
                        marginBottom: '5px'
                    }}>
                        ${product.price || '0'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                        📍 {product.location || 'Location N/A'}
                    </div>
                    {product.similarity_score && (
                        <div style={{ 
                            fontSize: '11px', 
                            color: '#FF9800',
                            marginTop: '5px'
                        }}>
                            {Math.round(product.similarity_score * 100)}% match
                        </div>
                    )}
                    {label}
                </div>
            </div>
        );
    };

    // ✅ Render prospect card (for alternative prospects - Seller mode)
    const renderProspectCard = (prospect) => {
        if (!prospect || !prospect.id) return null;
        
        return (
            <div
                key={prospect.id}
                style={{
                    background: 'white',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    border: '1px solid #e0e0e0',
                    padding: '15px',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '18px'
                    }}>
                        {prospect.email ? prospect.email.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
                            Potential Customer
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                            {prospect.email || 'No email'}
                        </div>
                    </div>
                </div>
                
                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#555' }}>
                    📍 {prospect.location || 'Location not specified'}
                    {prospect.isSameLocation && (
                        <span style={{ 
                            marginLeft: '8px',
                            color: '#4CAF50',
                            fontWeight: 'bold',
                            fontSize: '11px'
                        }}>
                            ✅ Same Location
                        </span>
                    )}
                </div>
                
                <div style={{ marginBottom: '10px', fontSize: '13px', color: '#555' }}>
                    🎯 Interested in: <span style={{ fontWeight: 'bold', color: '#333' }}>
                        {prospect.interests?.slice(0, 3).join(', ') || prospect.interest || 'Various'}
                    </span>
                </div>
                
                {prospect.is_alternative && (
                    <div style={{ 
                        fontSize: '11px', 
                        color: '#FF9800',
                        background: '#FFF3E0',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        display: 'inline-block',
                        marginBottom: '10px'
                    }}>
                        💡 Alternative (similar interests)
                    </div>
                )}
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => {
                            if (window.confirm(`Contact ${prospect.email || 'this prospect'} via WhatsApp?`)) {
                                // Open WhatsApp
                                const phone = prospect.phone_number || '';
                                const message = `Hi! I saw you're interested in ${prospect.interest || 'products'}. I have something that might interest you. Are you available to chat?`;
                                const encodedMessage = encodeURIComponent(message);
                                const cleanPhone = phone.replace(/\D/g, '');
                                const finalNumber = cleanPhone.startsWith('263') ? cleanPhone : `263${cleanPhone.replace(/^0/, '')}`;
                                window.open(`https://wa.me/${finalNumber}?text=${encodedMessage}`, '_blank');
                            }
                        }}
                        style={{
                            flex: 1,
                            backgroundColor: '#25D366',
                            color: 'white',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px'
                        }}
                        disabled={!prospect.phone_number}
                    >
                        💬 WhatsApp
                    </button>
                    <button
                        onClick={() => {
                            const phone = prospect.phone_number || '';
                            if (phone) window.open(`tel:${phone}`, '_self');
                        }}
                        style={{
                            flex: 1,
                            backgroundColor: '#3182ce',
                            color: 'white',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px'
                        }}
                        disabled={!prospect.phone_number}
                    >
                        📞 Call
                    </button>
                    <button
                        onClick={() => {
                            const phone = prospect.phone_number || '';
                            if (phone) {
                                const message = `Hi, I saw you're interested in ${prospect.interest || 'products'}. I have something that might interest you.`;
                                window.open(`sms:${phone}?body=${encodeURIComponent(message)}`, '_self');
                            }
                        }}
                        style={{
                            flex: 1,
                            backgroundColor: '#f6ad55',
                            color: 'white',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px'
                        }}
                        disabled={!prospect.phone_number}
                    >
                        ✉️ SMS
                    </button>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    border: '3px solid #f3f3f3', 
                    borderTop: '3px solid #667eea', 
                    borderRadius: '50%', 
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                }} />
                <p style={{ marginTop: '10px', color: '#666' }}>Loading recommendations...</p>
            </div>
        );
    }

    // ✅ Check if we have any recommendations
    const hasPersonalized = personalized.length > 0;
    const hasTrending = trending.length > 0;
    const hasSimilar = similar.length > 0;
    const hasProspects = alternativeProspects.length > 0;

    // ✅ If showing alternative prospects, only show prospects
    if (isAlternativeProspects) {
        if (!hasProspects) {
            return (
                <div style={{ 
                    textAlign: 'center', 
                    padding: '30px',
                    color: '#666'
                }}>
                    <p>No alternative prospects found. Try a different search term.</p>
                </div>
            );
        }

        return (
            <div style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '16px' }}>
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>👥</span>
                        Alternative Prospects
                    </h3>
                    <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#666' }}>
                        Based on similar interests, these buyers might be interested in your products
                    </p>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '15px'
                }}>
                    {alternativeProspects.map(renderProspectCard)}
                </div>
            </div>
        );
    }

    if (error && !hasPersonalized && !hasTrending && !hasSimilar) {
        return null;
    }

    if (!hasPersonalized && !hasTrending && !hasSimilar) {
        return null;
    }

    return (
        <div style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '16px' }}>
            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' , color: '#1a1a1a' }}>
                    <span>🎯</span>
                    {isAlternative ? 'You might also like these:' : 'Recommended for You'}
                </h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#666' }}>
                    {isAlternative 
                        ? 'Based on your search, here are some alternatives you might like'
                        : isSimilar
                        ? 'Similar products you might be interested in'
                        : 'Based on your interests and browsing history'}
                </p>
            </div>

            {/* Tab Navigation - Only show tabs that have content */}
            <div style={{ 
                display: 'flex', 
                gap: '10px', 
                marginBottom: '20px',
                borderBottom: '2px solid #e0e0e0',
                paddingBottom: '10px',
                flexWrap: 'wrap'
            }}>
                {hasPersonalized && (
                    <button
                        onClick={() => setActiveTab('personalized')}
                        style={{
                            background: activeTab === 'personalized' ? '#667eea' : 'transparent',
                            color: activeTab === 'personalized' ? 'white' : '#1a1a1a',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            transition: 'all 0.2s'
                        }}
                    >
                        🎯 For You ({personalized.length})
                    </button>
                )}
                {hasTrending && (
                    <button
                        onClick={() => setActiveTab('trending')}
                        style={{
                            background: activeTab === 'trending' ? '#667eea' : 'transparent',
                            color: activeTab === 'trending' ? 'white' : '#1a1a1a',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        🔥 Trending ({trending.length})
                    </button>
                )}
                {hasSimilar && (
                    <button
                        onClick={() => setActiveTab('similar')}
                        style={{
                            background: activeTab === 'similar' ? '#667eea' : 'transparent',
                            color: activeTab === 'similar' ? 'white' : '#1a1a1a',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        🔍 Similar Items ({similar.length})
                    </button>
                )}
            </div>

            {/* Recommendations Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '15px'
            }}>
                {activeTab === 'personalized' && personalized.map(renderProductCard)}
                {activeTab === 'trending' && trending.map(renderProductCard)}
                {activeTab === 'similar' && similar.map(renderProductCard)}
            </div>

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default RecommendationsSection;
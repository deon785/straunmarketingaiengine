import React, { useState, useEffect } from 'react';
import RecommendationEngine from './recommendationEngine';

const RecommendationsSection = ({ userId, currentProductId = null, onProductClick }) => {
    const [personalized, setPersonalized] = useState([]);
    const [trending, setTrending] = useState([]);
    const [similar, setSimilar] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('personalized');

    const engine = new RecommendationEngine(userId);

    useEffect(() => {
        loadRecommendations();
    }, [userId, currentProductId]);

    const loadRecommendations = async () => {
        setLoading(true);
        
        try {
            const [personalizedRecs, trendingRecs, similarRecs] = await Promise.all([
                engine.getPersonalizedRecommendations(8),
                engine.getTrendingProducts(6),
                currentProductId ? engine.getSimilarProducts(currentProductId, 6) : Promise.resolve([])
            ]);

            setPersonalized(personalizedRecs || []);
            setTrending(trendingRecs || []);
            setSimilar(similarRecs || []);
        } catch (error) {
            console.error('Error loading recommendations:', error);
        } finally {
            setLoading(false);
        }
    };

    const trackView = async (productId) => {
        await engine.trackBehavior(productId, 'view');
    };

    const renderProductCard = (product) => (
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
                    alt={product.name}
                    style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                />
            ) : (
                <div style={{ 
                    width: '100%', 
                    height: '150px', 
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '48px'
                }}>
                    🛍️
                </div>
            )}
            
            <div style={{ padding: '12px' }}>
                <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 'bold' }}>
                    {product.name}
                </h4>
                <div style={{ 
                    fontSize: '18px', 
                    fontWeight: 'bold', 
                    color: '#4CAF50',
                    marginBottom: '5px'
                }}>
                    ${product.price}
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
            </div>
        </div>
    );

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

    const hasRecommendations = (personalized.length > 0 || trending.length > 0 || similar.length > 0);

    if (!hasRecommendations) {
        return null;
    }

    return (
        <div style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '16px' }}>
            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>🎯</span>
                    Recommended for You
                </h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#666' }}>
                    Based on your interests and browsing history
                </p>
            </div>

            {/* Tab Navigation */}
            <div style={{ 
                display: 'flex', 
                gap: '10px', 
                marginBottom: '20px',
                borderBottom: '2px solid #e0e0e0',
                paddingBottom: '10px'
            }}>
                {personalized.length > 0 && (
                    <button
                        onClick={() => setActiveTab('personalized')}
                        style={{
                            background: activeTab === 'personalized' ? '#667eea' : 'transparent',
                            color: activeTab === 'personalized' ? 'white' : '#666',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            transition: 'all 0.2s'
                        }}
                    >
                        🎯 For You
                    </button>
                )}
                {trending.length > 0 && (
                    <button
                        onClick={() => setActiveTab('trending')}
                        style={{
                            background: activeTab === 'trending' ? '#667eea' : 'transparent',
                            color: activeTab === 'trending' ? 'white' : '#666',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        🔥 Trending
                    </button>
                )}
                {similar.length > 0 && currentProductId && (
                    <button
                        onClick={() => setActiveTab('similar')}
                        style={{
                            background: activeTab === 'similar' ? '#667eea' : 'transparent',
                            color: activeTab === 'similar' ? 'white' : '#666',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        🔍 Similar Items
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
// RecommendationsSection.jsx - COMPLETE FIXED VERSION WITH ALTERNATIVE PROSPECTS
import React, { useState, useEffect } from 'react';
import RecommendationEngine from './recommendationEngine';
import { supabase } from './lib/supabase';

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

    const [contactProduct, setContactProduct] = useState(null);
    const [savingWishlist, setSavingWishlist] = useState(false);
    const [savedIds, setSavedIds] = useState(new Set()); // track already-saved products

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

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;

        (async () => {
            try {
                const { data, error } = await supabase
                    .from('saved_items')
                    .select('product_id')
                    .eq('user_id', userId)
                    .eq('item_type', 'product');

                if (error) throw error;
                if (cancelled) return;

                setSavedIds(new Set((data || []).map(r => r.product_id).filter(Boolean)));
            } catch (err) {
                console.error('Failed to load saved ids:', err);
            }
        })();

        return () => { cancelled = true; };
    }, [userId]);

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

            // ✅ Helper: Fetch fallback products directly from database
            const fetchFallbackProducts = async (limit = 8) => {
                try {
                    const { data, error } = await supabase
                        .from('products')
                        .select(`
                            id,
                            name,
                            price,
                            location,
                            description,
                            image_url,
                            phone_number,
                            seller_id,
                            created_at,
                            profiles:seller_id (
                                user_id,
                                username,
                                location,
                                phone_number,
                                is_seller,
                                is_buyer
                            )
                        `)
                        .eq('status', 'active')
                        .neq('seller_id', userId || '00000000-0000-0000-0000-000000000000')
                        .order('created_at', { ascending: false })
                        .limit(limit);

                    if (error) {
                        console.error('Fallback error:', error);
                        return [];
                    }

                    return data?.map(product => ({
                        ...product,
                        image_url: product.image_url || null,
                        profiles: product.profiles || null
                    })) || [];

                } catch (error) {
                    console.error('Fallback error:', error);
                    return [];
                }
            };

            // ✅ Alternative prospects for sellers
            if (isAlternativeProspects && searchTerm) {
                try {
                    if (engine && typeof engine.getAlternativeProspects === 'function') {
                        prospectsRecs = await engine.getAlternativeProspects(searchTerm, 8);
                    }
                } catch (err) {
                    console.error('Error loading alternative prospects:', err);
                }
                // ✅ If no prospects found, show fallback products
                if (!prospectsRecs || prospectsRecs.length === 0) {
                    prospectsRecs = await fetchFallbackProducts(8);
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
                // ✅ If no alternatives, show fallback
                if (!personalizedRecs || personalizedRecs.length === 0) {
                    personalizedRecs = await fetchFallbackProducts(8);
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
                // ✅ If no similar, show fallback
                if (!similarRecs || similarRecs.length === 0) {
                    similarRecs = await fetchFallbackProducts(6);
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
                // ✅ If no personalized, show fallback
                if (!personalizedRecs || personalizedRecs.length === 0) {
                    personalizedRecs = await fetchFallbackProducts(8);
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
            // ✅ If no trending, show fallback
            if (!trendingRecs || trendingRecs.length === 0) {
                trendingRecs = await fetchFallbackProducts(4);
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
                if (!personalizedRecs || personalizedRecs.length === 0) {
                    personalizedRecs = await fetchFallbackProducts(6);
                }
            }

            setPersonalized(personalizedRecs || []);
            setTrending(trendingRecs || []);
            setSimilar(similarRecs || []);
            setAlternativeProspects(prospectsRecs || []);
            
            // ✅ Log what we found
            console.log('📊 Recommendations loaded:', {
                personalized: personalizedRecs?.length || 0,
                trending: trendingRecs?.length || 0,
                similar: similarRecs?.length || 0,
                prospects: prospectsRecs?.length || 0
            });

        } catch (error) {
            console.error('Error loading recommendations:', error);
            setError('Failed to load recommendations');
            // ✅ Fallback to direct database query
            try {
                const { data } = await supabase
                    .from('products')
                    .select(`
                        id,
                        name,
                        price,
                        location,
                        description,
                        image_url,
                        phone_number,
                        seller_id,
                        created_at
                    `)
                    .eq('status', 'active')
                    .neq('seller_id', userId || '00000000-0000-0000-0000-000000000000')
                    .order('created_at', { ascending: false })
                    .limit(8);
                    
                if (data && data.length > 0) {
                    setPersonalized(data);
                    setError(null);
                }
            } catch (fallbackErr) {
                console.error('Fallback error:', fallbackErr);
            }
        } finally {
            setLoading(false);
        }
    };
    
    // ✅ Render product card (for products)
    const renderProductCard = (product) => {
        if (!product || !product.id) return null;
        
        // ✅ Safe data extraction
        const productName = product.name || product.product_name || 'Unnamed Product';
        const productPrice = product.price || product.product_price || 0;
        const productImage = product.image_url || product.image || product.product_image || null;
        const productLocation = product.location || product.seller_location || 'Location N/A';
        const productPhone = product.phone_number || product.seller_phone || null;
        const productSeller = product.profiles?.username || product.seller?.username || null;
        
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
                    // otherwise open contact modal
                    setContactProduct(product);
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
                {/* ✅ Product Image with better fallback */}
                {productImage ? (
                    <img 
                        src={productImage} 
                        alt={productName}
                        style={{ 
                            width: '100%', 
                            height: '150px', 
                            objectFit: 'cover',
                            background: '#f0f0f0'
                        }}
                        onError={(e) => {
                            e.target.style.display = 'none';
                            const parent = e.target.parentElement;
                            const fallback = parent.querySelector('.image-fallback');
                            if (fallback) fallback.style.display = 'flex';
                        }}
                    />
                ) : null}
                
                {/* ✅ Fallback when no image */}
                <div 
                    className="image-fallback"
                    style={{
                        width: '100%', 
                        height: productImage ? '0' : '150px',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        display: productImage ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '48px',
                        transition: 'height 0.3s'
                    }}
                >
                    🛍️
                </div>
                
                <div style={{ padding: '12px' }}>
                    {/* ✅ Product Name - ALWAYS SHOW */}
                    <h4 style={{ 
                        margin: '0 0 5px 0', 
                        fontSize: '14px', 
                        fontWeight: 'bold',
                        color: '#333',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                    }}>
                        {productName}
                    </h4>
                    
                    {/* ✅ Price */}
                    <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold', 
                        color: '#16a34a',
                        marginBottom: '5px'
                    }}>
                        ${typeof productPrice === 'number' ? productPrice.toFixed(2) : '0.00'}
                    </div>
                    
                    {/* ✅ Location */}
                    <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
                        📍 {productLocation}
                    </div>
                    
                    {/* ✅ Seller (if available) */}
                    {productSeller && (
                        <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
                            👤 {productSeller}
                        </div>
                    )}
                    
                    {/* ✅ Phone (if available) */}
                    {productPhone && (
                        <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
                            📞 {productPhone}
                        </div>
                    )}
                    
                    {/* ✅ Similarity score */}
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

    // ✅ Inline contact-seller modal
    const renderContactModal = () => {
        if (!contactProduct) return null;

        const product = contactProduct;
        const rawPhone = getSellerPhone(product);
        const waNumber = toWhatsAppNumber(rawPhone);
        const alreadySaved = savedIds.has(product.id);
        const productImage = product.image_url || product.image || null;

        return (
            <div
                onClick={() => setContactProduct(null)}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1000,
                    background: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        background: 'white',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '420px',
                        padding: '24px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
                    }}
                >
                    {/* Product preview */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                        {productImage ? (
                            <img
                                src={productImage}
                                alt={product.name}
                                style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '10px',
                                    objectFit: 'cover'
                                }}
                            />
                        ) : (
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg,#667eea,#764ba2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '28px'
                            }}>🛍️</div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{
                                fontWeight: 'bold',
                                fontSize: '15px',
                                color: '#1a1a1a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                {product.name || 'Product'}
                            </div>
                            <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                                ${typeof product.price === 'number' ? product.price.toFixed(2) : product.price}
                                {product.location ? ` • ${product.location}` : ''}
                            </div>
                        </div>
                    </div>

                    {/* Heading */}
                    <h2 style={{
                        margin: '0 0 4px 0',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: '#1a1a1a'
                    }}>
                        How do you want to talk to the seller?
                    </h2>
                    <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#666' }}>
                        Reach out now, or save it for later.
                    </p>

                    {/* Talk Now — WhatsApp */}
                    <button
                        onClick={() => handleTalkNow(product)}
                        disabled={!waNumber}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            background: waNumber ? '#25D366' : '#b0b0b0',
                            color: 'white',
                            border: 'none',
                            padding: '14px',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            fontSize: '15px',
                            cursor: waNumber ? 'pointer' : 'not-allowed',
                            marginBottom: '10px'
                        }}
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        {waNumber ? 'Talk Now on WhatsApp' : 'No phone number available'}
                    </button>

                    {/* Save to Wishlist */}
                    <button
                        onClick={() => handleSaveWishlist(product)}
                        disabled={savingWishlist || alreadySaved}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            background: alreadySaved ? '#e8f5e9' : '#f1f3f5',
                            color: alreadySaved ? '#2e7d32' : '#1a1a1a',
                            border: 'none',
                            padding: '14px',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            fontSize: '15px',
                            cursor: alreadySaved ? 'default' : 'pointer',
                            marginBottom: '10px'
                        }}
                    >
                        {alreadySaved ? '✓ Saved to Wishlist' : (savingWishlist ? 'Saving…' : '🔖 Save to Wishlist')}
                    </button>

                    {/* Cancel */}
                    <button
                        onClick={() => setContactProduct(null)}
                        style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            color: '#666',
                            fontSize: '13px',
                            padding: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        Maybe later
                    </button>
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

    // ✅ Normalize phone for WhatsApp (Zimbabwe default → change country code if needed)
    const toWhatsAppNumber = (phone) => {
        if (!phone) return null;
        let p = String(phone).replace(/\D/g, '');
        if (p.startsWith('0')) p = '263' + p.slice(1);
        if (!p.startsWith('263') && p.length <= 10) p = '263' + p;
        return p;
    };

    // ✅ Get phone from either product row or joined seller profile
    const getSellerPhone = (product) => {
        if (!product) return null;
        return (
            product.phone_number ||
            product.seller_phone ||
            product.profiles?.phone_number ||
            null
        );
    };

    // ✅ Fire-and-forget track
    const trackContactClick = (productId) => {
        if (engine) engine.trackBehavior(productId, 'contact_click');
    };

    // ✅ WhatsApp open
    const handleTalkNow = (product) => {
        const rawPhone = getSellerPhone(product);
        const waNumber = toWhatsAppNumber(rawPhone);

        if (!waNumber) {
            alert('This seller has not added a phone number yet.');
            return;
        }

        const productUrl = `${window.location.origin}/product/${product.id}`;
        const sellerName = product.profiles?.username || 'there';
        const message = encodeURIComponent(
            `Hi ${sellerName}, I'm interested in your listing "${product.name}" ` +
            `(${product.price}). Is it still available?\n\n${productUrl}`
        );

        trackContactClick(product.id);
        window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank');
        setContactProduct(null);
    };

    // ✅ Save to wishlist (uses `saved_items` table)
    const handleSaveWishlist = async (product) => {
        if (!userId) {
            alert('Please log in to save items.');
            return;
        }
        setSavingWishlist(true);
        try {
            const { error } = await supabase
                .from('saved_items')
                .insert({
                    user_id: userId,
                    item_type: 'product',
                    product_id: product.id,
                    product_name: product.name || 'Unnamed Product',
                    product_price: typeof product.price === 'number' ? product.price : null,
                    product_image: product.image_url || product.image || null,
                    seller_location: product.location || product.profiles?.location || null,
                    seller_phone: getSellerPhone(product) || null,
                    created_at: new Date().toISOString()
                });

            if (error) {
                // 23505 = unique violation → already saved, treat as success
                if (error.code === '23505') {
                    setSavedIds(prev => new Set(prev).add(product.id));
                    setContactProduct(null);
                    return;
                }
                throw error;
            }

            setSavedIds(prev => new Set(prev).add(product.id));
            setContactProduct(null);
        } catch (err) {
            console.error('Wishlist save failed:', err);
            alert('Could not save to wishlist. Try again.');
        } finally {
            setSavingWishlist(false);
        }
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
                    {renderContactModal()}
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
            {renderContactModal()}
        </div>
    );
};

export default RecommendationsSection;
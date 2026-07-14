import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase';
import RecommendationEngine from './recommendationEngine';

// Add this helper function
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

// ✅ OPTIMIZED: Better image optimization with size control
const getOptimizedImageUrl = (url, width = 300, height = 200) => {
    if (!url) return null;
    if (url.includes('supabase.co/storage')) {
        const separator = url.includes('?') ? '&' : '?';
        // ✅ Smaller images = faster load
        return `${url}${separator}width=${width}&height=${height}&quality=40&resize=cover&format=webp`;
    }
    return url;
};

const DailyDeals = ({ userId, userReferralCount, onClaimDeal }) => {
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState({});
    const [claiming, setClaiming] = useState({});
    const [nextRefreshIn, setNextRefreshIn] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);
    const [productCheck, setProductCheck] = useState(null);
    const [loadedCount, setLoadedCount] = useState(6);
    const [imagesLoaded, setImagesLoaded] = useState(0);
    const [imagesLoading, setImagesLoading] = useState(true);
    
    // Modal state for product details
    const [selectedDeal, setSelectedDeal] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [sellerDetails, setSellerDetails] = useState(null);
    const [loadingSeller, setLoadingSeller] = useState(false);
    
    // ✅ Track loading status
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Configuration
    const DEAL_DURATION_MINUTES = 30;
    const NUMBER_OF_DEALS = 12;
    // ✅ REDUCED: Fetch fewer products for faster loading
    const FETCH_LIMIT = Math.min(NUMBER_OF_DEALS * 2, 30); // Changed from 100 to 30
    const refreshIntervalRef = useRef(null);
    const countdownIntervalRef = useRef(null);
    
    const getResponsiveDealCount = () => {
        const width = window.innerWidth;
        if (width < 640) return 4;
        if (width < 1024) return 6;
        return 12;
    };
    
    const [visibleDealCount, setVisibleDealCount] = useState(getResponsiveDealCount());

    // ✅ Track image loading
    useEffect(() => {
        if (deals.length > 0) {
            const visibleDeals = deals.slice(0, loadedCount);
            let loaded = 0;
            const total = visibleDeals.length;
            
            if (total === 0) {
                setImagesLoaded(0);
                setImagesLoading(false);
                return;
            }
            
            // Reset image tracking when deals change
            setImagesLoaded(0);
            setImagesLoading(true);
            
            // Preload images
            visibleDeals.forEach(deal => {
                if (deal.product?.image_url) {
                    const img = new Image();
                    img.src = getOptimizedImageUrl(deal.product.image_url, 200, 150);
                    img.onload = () => {
                        loaded++;
                        setImagesLoaded(loaded);
                        if (loaded >= total) {
                            setImagesLoading(false);
                        }
                    };
                    img.onerror = () => {
                        loaded++;
                        setImagesLoaded(loaded);
                        if (loaded >= total) {
                            setImagesLoading(false);
                        }
                    };
                } else {
                    loaded++;
                    setImagesLoaded(loaded);
                    if (loaded >= total) {
                        setImagesLoading(false);
                    }
                }
            });
        }
    }, [deals, loadedCount]);

    // ✅ Get personalized deals using RecommendationEngine
    const getPersonalizedDeals = useCallback(async (limit = NUMBER_OF_DEALS) => {
        console.log('🔄 Getting personalized deals...');
        
        try {
            const engine = new RecommendationEngine(userId);
            
            // ✅ 1️⃣ FIRST: Try personalized recommendations
            let personalized = await engine.getPersonalizedRecommendations(limit);
            if (personalized && personalized.length > 0) {
                console.log(`✅ Found ${personalized.length} personalized deals`);
                return personalized;
            }
            
            // ✅ 2️⃣ SECOND: Try trending products
            console.log('🔄 No personalized deals, trying trending...');
            const trending = await engine.getTrendingProducts(limit);
            if (trending && trending.length > 0) {
                console.log(`✅ Found ${trending.length} trending deals`);
                return trending;
            }
            
            // ✅ 3️⃣ THIRD: Random products (ONLY HERE - Daily Deals fallback)
            console.log('🔄 No trending deals, using random...');
            const random = await engine.getRandomProducts(limit);
            console.log(`✅ Found ${random.length} random deals`);
            return random || [];
            
        } catch (error) {
            console.error('❌ Error getting personalized deals:', error);
            // ✅ Even on error, try random as last resort
            try {
                const engine = new RecommendationEngine(userId);
                const random = await engine.getRandomProducts(limit);
                return random || [];
            } catch (fallbackError) {
                console.error('❌ Fallback also failed:', fallbackError);
                return [];
            }
        }
    }, [userId]);

    // Load deals with personalization
    const loadRandomDeals = useCallback(async () => {
        if (!userId) {
            console.error('❌ Cannot load deals: No userId provided');
            setLoading(false);
            return;
        }

        if (!navigator.onLine) {
            console.log('Offline - using cached deals if available');
            const cachedDeals = localStorage.getItem('currentDeals');
            if (cachedDeals) {
                try {
                    const parsed = JSON.parse(cachedDeals);
                    setDeals(parsed);
                    setLoading(false);
                    return;
                } catch (e) {
                    console.warn('Failed to parse cached deals');
                }
            }
            setLoading(false);
            return;
        }

        console.log('🔄 Loading personalized deals...');
        setLoading(true);
        setImagesLoading(true);
        
        try {
            // ✅ STEP 1: Get personalized deals
            let personalizedProducts = await getPersonalizedDeals(NUMBER_OF_DEALS);
            
            if (personalizedProducts && personalizedProducts.length > 0) {
                // ✅ Convert to deal format with personalized flag
                const newDeals = personalizedProducts.map((product, index) => {
                    const originalPrice = parseFloat(product.price);
                    const maxQuantity = product.quantity || product.stock || 10;
                    
                    return {
                        id: `deal-${product.id}-${Date.now()}-${index}`,
                        product_id: product.id,
                        product: product,
                        original_price: originalPrice,
                        max_quantity: maxQuantity,
                        sold_count: 0,
                        end_time: new Date(Date.now() + DEAL_DURATION_MINUTES * 60 * 1000).toISOString(),
                        is_active: true,
                        seller_referral_points: 0,
                        seller_name: product.profiles?.username || 'Seller',
                        is_personalized: true,
                        source: product.is_alternative ? 'alternative' : 'personalized'
                    };
                });
                
                setDeals(newDeals);
                setLastRefresh(new Date());
                setNextRefreshIn(DEAL_DURATION_MINUTES * 60);
                const initialCount = Math.min(visibleDealCount, newDeals.length);
                setLoadedCount(initialCount);
                
                localStorage.setItem('lastDealsRefresh', new Date().toISOString());
                localStorage.setItem('currentDeals', JSON.stringify(newDeals.map(d => d.product_id)));
                console.log(`✅ ${newDeals.length} personalized deals loaded!`);
                setLoading(false);
                return;
            }
            
            // ✅ STEP 2: Fallback to random deals
            console.log('🔄 No personalized deals, loading random...');
            
            // Get current user's location
            const { data: userProfile, error: profileError } = await fetchWithRetry(() => supabase
                .from('profiles')
                .select('location')
                .eq('user_id', userId)
                .maybeSingle());
            
            const userLocation = userProfile?.location || '';
            
            // ✅ Fetch fewer products for faster loading
            const { data: allProducts, error } = await fetchWithRetry(() => supabase
                .from('products')
                .select('*')  // ✅ Just get products, no joins
                .eq('status', 'active')
                .limit(FETCH_LIMIT)); // ✅ Using reduced limit
            
            if (error) throw error;
            
            if (!allProducts || allProducts.length === 0) {
                setDeals([]);
                setLoading(false);
                setImagesLoading(false);
                return;
            }

            // ✅ Get seller names separately - NO JOINS
            const sellerIds = [...new Set(allProducts.map(p => p.seller_id).filter(Boolean))];
            let sellersMap = {};

            if (sellerIds.length > 0) {
                const { data: sellers, error: sellersError } = await fetchWithRetry(() => supabase
                    .from('profiles')
                    .select('user_id, username, location')
                    .in('user_id', sellerIds));
                
                if (!sellersError && sellers) {
                    sellersMap = Object.fromEntries(sellers.map(s => [s.user_id, s.username]));
                }
            }

            // ✅ Add seller name to each product
            const productsWithSellers = allProducts.map(product => ({
                ...product,
                seller_name: sellersMap[product.seller_id] || 'Seller'
            }));

            // Random selection
            const shuffled = [...productsWithSellers];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            const selectedProducts = shuffled.slice(0, NUMBER_OF_DEALS);

                    
            const newDeals = selectedProducts.map((product, index) => {
                const originalPrice = parseFloat(product.price);
                const maxQuantity = product.quantity || product.stock || 10;
                
                return {
                    id: `deal-${product.id}-${Date.now()}-${index}`,
                    product_id: product.id,
                    product: product,
                    original_price: originalPrice,
                    max_quantity: maxQuantity,
                    sold_count: 0,
                    end_time: new Date(Date.now() + DEAL_DURATION_MINUTES * 60 * 1000).toISOString(),
                    is_active: true,
                    seller_referral_points: 0,
                    seller_name: product.seller_name || 'Seller',
                    is_personalized: false,
                    source: 'random'
                };
            });
            
            setDeals(newDeals);
            setLastRefresh(new Date());
            setNextRefreshIn(DEAL_DURATION_MINUTES * 60);
            const initialCount = Math.min(visibleDealCount, newDeals.length);
            setLoadedCount(initialCount);
            
            localStorage.setItem('lastDealsRefresh', new Date().toISOString());
            localStorage.setItem('currentDeals', JSON.stringify(newDeals.map(d => d.product_id)));
            
            console.log(`✅ ${newDeals.length} random deals loaded!`);
            
        } catch (error) {
            console.error('❌ Error loading deals:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, NUMBER_OF_DEALS, DEAL_DURATION_MINUTES, visibleDealCount, getPersonalizedDeals, FETCH_LIMIT]);

    // Check products in database
    const checkProductsInDatabase = async () => {
        console.log('🔍 Checking for products in database...');
        
        try {
            // ✅ Use head: true for count only - NO JOINS
            const { count, error } = await fetchWithRetry(() => supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'active'));
            
            if (error) {
                console.error('❌ Error checking products:', error);
                setProductCheck({ error: error.message, count: 0 });
                return;
            }
            
            console.log(`📦 Found ${count || 0} available products`);
            setProductCheck({ success: true, count: count || 0 });
            
        } catch (err) {
            console.error('❌ Failed to check products:', err);
            setProductCheck({ error: err.message, count: 0 });
        }
    };

    // View product details with seller info
    const viewProductDetails = async (deal) => {
        console.log('👁️ Viewing product details for:', deal.product?.name);
        setSelectedDeal(deal);
        setLoadingSeller(true);
        setShowModal(true);
        
        try {
            const { data: sellerData, error } = await fetchWithRetry(() => supabase
                .from('profiles')
                .select('*')
                .eq('user_id', deal.product.seller_id)
                .maybeSingle()
            );
            
            if (!error && sellerData) {
                setSellerDetails(sellerData);
            }
            
            await fetchWithRetry(() => supabase
                .from('products')
                .update({ views: (deal.product.views || 0) + 1 })
                .eq('id', deal.product_id)
            );
                
        } catch (error) {
            console.error('Error fetching seller details:', error);
        } finally {
            setLoadingSeller(false);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedDeal(null);
        setSellerDetails(null);
    };

    // Update countdown timers
    const updateCountdowns = useCallback(() => {
        const newTimeLeft = {};
        const now = new Date().getTime();
        let allExpired = true;
        
        deals.forEach(deal => {
            const end = new Date(deal.end_time).getTime();
            const diff = end - now;
            
            if (diff > 0) {
                allExpired = false;
                const minutes = Math.floor((diff % (3600000)) / (1000 * 60));
                const seconds = Math.floor((diff % (60000)) / 1000);
                newTimeLeft[deal.id] = { minutes, seconds };
            } else {
                newTimeLeft[deal.id] = { minutes: 0, seconds: 0 };
            }
        });
        
        setTimeLeft(newTimeLeft);
        
        if (allExpired && deals.length > 0) {
            console.log('⏰ All deals expired, loading new ones...');
            loadRandomDeals();
        }
    }, [deals, loadRandomDeals]);

    // Auto-refresh timer
    useEffect(() => {
        if (nextRefreshIn !== null && nextRefreshIn > 0) {
            const timer = setTimeout(() => {
                setNextRefreshIn(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (nextRefreshIn === 0) {
            loadRandomDeals();
        }
    }, [nextRefreshIn, loadRandomDeals]);

    // Initial load and refresh interval
    useEffect(() => {
        if (userId) {
            loadRandomDeals();
            refreshIntervalRef.current = setInterval(() => {
                loadRandomDeals();
            }, DEAL_DURATION_MINUTES * 60 * 1000);
            return () => {
                if (refreshIntervalRef.current) {
                    clearInterval(refreshIntervalRef.current);
                    refreshIntervalRef.current = null;
                }
            };
        }
    }, [loadRandomDeals, DEAL_DURATION_MINUTES, userId]);

    // Countdown interval
    useEffect(() => {
        countdownIntervalRef.current = setInterval(updateCountdowns, 1000);
        return () => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
            }
        };
    }, [updateCountdowns]);

    // Responsive design: update visible deals on resize
    useEffect(() => {
        const handleResize = () => {
            const newCount = getResponsiveDealCount();
            setVisibleDealCount(newCount);
            setLoadedCount(Math.min(newCount, deals.length));
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [deals.length]);

    // Initial product check
    useEffect(() => {
        if (!userId) {
            console.error('❌ ERROR: userId prop is missing!');
            setLoading(false);
            setProductCheck({ error: 'userId is required', count: 0 });
            return;
        }
        
        const timeout = setTimeout(() => {
            if (loading) {
                console.log('Loading timeout - forcing stop');
                setLoading(false);
            }
        }, 5000);
        
        checkProductsInDatabase();
        
        return () => clearTimeout(timeout);
    }, [userId]);

    // Check if deal is available
    const canAccessDeal = (deal) => {
        return userReferralCount >= (deal.referral_required || 0) && deal.sold_count < deal.max_quantity;
    };

    // Claim a deal
    const claimDeal = async (deal) => {
        console.log('🎯 Claiming deal:', deal.product?.name);
        
        if (deal.sold_count >= deal.max_quantity) {
            alert('❌ This deal is sold out!');
            return;
        }

        setClaiming(prev => ({ ...prev, [deal.id]: true }));

        setTimeout(() => {
            alert(`🎉 Deal claimed! You selected "${deal.product?.name}"`);
            console.log('✅ Deal claimed successfully:', deal.product?.name);
            
            setDeals(prev => prev.map(d => 
                d.id === deal.id ? { ...d, sold_count: d.sold_count + 1 } : d
            ));
            
            if (onClaimDeal) {
                onClaimDeal(deal);
            }
            
            setClaiming(prev => ({ ...prev, [deal.id]: false }));
        }, 500);
    };

    // ✅ OPTIMIZED: Load more deals with preloading
    const loadMoreDeals = () => {
        const nextCount = Math.min(loadedCount + 6, deals.length);
        setIsLoadingMore(true);
        
        // ✅ Preload images in background
        const newDeals = deals.slice(loadedCount, nextCount);
        newDeals.forEach(deal => {
            if (deal.product?.image_url) {
                const img = new Image();
                img.src = getOptimizedImageUrl(deal.product.image_url, 200, 150);
            }
        });
        
        setLoadedCount(nextCount);
        setTimeout(() => setIsLoadingMore(false), 300);
    };

    const formatTimeDisplay = (time) => {
        if (!time) return '';
        if (time.minutes === 0 && time.seconds === 0) return 'Expired';
        return `${time.minutes}m ${time.seconds}s`;
    };

    const handleManualRefresh = () => {
        if (window.confirm('Refresh deals now? New personalized deals will appear.')) {
            console.log('🔄 Manual refresh triggered');
            setLoadedCount(visibleDealCount);
            loadRandomDeals();
        }
    };

    // Product Image Component with better missing image handling , better loading
    const ProductImage = React.memo(({ product, style, modalStyle }) => {
        const [imgError, setImgError] = useState(false);
        const [isLoading, setIsLoading] = useState(true);
        
        const getInitialLetter = () => {
            if (!product?.name) return '?';
            return product.name.charAt(0).toUpperCase();
        };
        
        const hasImage = product?.image_url && typeof product.image_url === 'string' && product.image_url.trim() !== '';
        
        if (!hasImage || imgError) {
            return (
                <div style={{
                    ...(style || styles.dealImagePlaceholder),
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    fontSize: '48px',
                    fontWeight: 'bold',
                    height: style?.height || '180px',
                    width: '100%',
                    minHeight: '180px'
                }}>
                    <div>{getInitialLetter()}</div>
                    <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '5px' }}>
                        {product?.name || 'Product'}
                    </div>
                </div>
            );
        }
        
        return (
            <div style={{ 
                position: 'relative', 
                width: '100%', 
                height: style?.height || '180px', 
                overflow: 'hidden',
                background: '#1a1a1a',
                minHeight: '180px'
            }}>
                {/* ✅ Background placeholder - shows immediately, no blinking */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    fontSize: '48px',
                    fontWeight: 'bold',
                    zIndex: 0
                }}>
                    <div>{getInitialLetter()}</div>
                    <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '5px' }}>
                        {product?.name || 'Product'}
                    </div>
                </div>
                
                {/* ✅ Image fades in smoothly - no blinking */}
                <img 
                    src={getOptimizedImageUrl(product.image_url, 200, 150)} 
                    alt={product.name || 'Product'}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: isLoading ? 0 : 1,
                        transition: 'opacity 0.4s ease-in-out',
                        zIndex: 1
                    }}
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                        setImgError(true);
                        setIsLoading(false);
                    }}
                    loading="lazy"
                />
            </div>
        );
    });

    // Show error if no userId
    if (!userId) {
        return (
            <div style={styles.errorContainer}>
                <div style={styles.errorIcon}>⚠️</div>
                <h4>Daily Deals Unavailable</h4>
                <p>Please log in to see available deals.</p>
                <small>UserId prop is required</small>
            </div>
        );
    }

    // Show loading state
    if (loading && deals.length === 0) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>Finding hot deals for you...</p>
            </div>
        );
    }

    if (deals.length === 0 && !loading) {
        return (
            <div style={styles.emptyContainer}>
                <div style={styles.emptyIcon}>🔥</div>
                <h4>No Products Available</h4>
                <p>Product check result: {productCheck?.count || 0} products found.</p>
                {productCheck?.count === 0 && (
                    <p style={{ fontSize: '12px', color: '#888', marginTop: '10px' }}>
                        📝 No products in database. Add products to see deals here.
                    </p>
                )}
                <button onClick={handleManualRefresh} style={styles.refreshButton}>
                    🔄 Refresh Now
                </button>
            </div>
        );
    }

    // Get visible deals based on loaded count
    const visibleDeals = deals.slice(0, loadedCount);
    const hasMoreDeals = loadedCount < deals.length;
    const hasPersonalized = deals.some(d => d.is_personalized);

    return (
        <>
            <div style={styles.container}>
                <div style={styles.header}>
                    <div>
                        <h3 style={styles.title}>🔥 Daily Deals 🔥</h3>
                        <p style={styles.subtitle}>
                            {hasPersonalized
                                ? '🎯 Personalized deals based on your interests!'
                                : 'Limited time offers - New deals every 30 minutes!'}
                        </p>
                        {productCheck && (
                            <p style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                                📦 {productCheck.count} products available • Showing {visibleDeals.length} of {deals.length} deals
                                {hasPersonalized && ' • 🎯 Personalized'}
                                {imagesLoading && visibleDeals.length > 0 && (
                                    <span style={{ marginLeft: '8px', color: '#667eea' }}>
                                        • 📸 Loading images ({imagesLoaded}/{visibleDeals.length})
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                    <div style={styles.headerRight}>
                        {nextRefreshIn !== null && (
                            <div style={styles.refreshTimer}>
                                <span>🔄 Next refresh: </span>
                                <strong>
                                    {Math.floor(nextRefreshIn / 60)}m {nextRefreshIn % 60}s
                                </strong>
                            </div>
                        )}
                        <button onClick={handleManualRefresh} style={styles.manualRefreshIcon} title="Refresh deals">
                            🔄
                        </button>
                    </div>
                </div>

                <div style={styles.dealsGrid}>
                    {visibleDeals.map(deal => {
                        const timeRemaining = timeLeft[deal.id];
                        const product = deal.product;
                        const isSoldOut = deal.sold_count >= deal.max_quantity;
                        
                        return (
                            <div 
                                key={deal.id} 
                                style={{
                                    ...styles.dealCard,
                                    opacity: isSoldOut ? 0.6 : 1,
                                    cursor: 'pointer',
                                    border: deal.is_personalized ? '2px solid #667eea' : '1px solid #404040'
                                }}
                                onClick={() => viewProductDetails(deal)}
                            >
                                {isSoldOut && (
                                    <div style={styles.soldOutBadge}>Sold Out!</div>
                                )}
                                {deal.is_personalized && !isSoldOut && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '10px',
                                        left: '10px',
                                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                        color: 'white',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        zIndex: 1
                                    }}>
                                        🎯 Personalized
                                    </div>
                                )}
                                
                                <ProductImage 
                                    product={product} 
                                    style={styles.dealImage}
                                />
                                
                                <div style={styles.dealContent}>
                                    <h4 style={styles.dealName}>{product?.name || 'Unknown Product'}</h4>
                                    
                                    <div style={styles.dealInfo}>
                                        <div style={styles.location}>
                                            📍 {product?.location || 'Unknown'}
                                        </div>
                                        <div style={styles.seller}>
                                            👤 {deal.seller_name || 'Seller'}
                                        </div>
                                        <div style={styles.stock}>
                                            🎫 {deal.max_quantity - deal.sold_count} left
                                        </div>
                                    </div>
                                    
                                    {timeRemaining && timeRemaining.minutes > 0 && !isSoldOut && (
                                        <div style={styles.timer}>
                                            ⏰ Expires in: {formatTimeDisplay(timeRemaining)}
                                        </div>
                                    )}
                                    
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            claimDeal(deal);
                                        }}
                                        disabled={isSoldOut}
                                        style={{
                                            ...styles.claimButton,
                                            background: isSoldOut ? '#f44336' : 
                                                       'linear-gradient(135deg, #667eea, #764ba2)',
                                        }}
                                    >
                                        {claiming[deal.id] ? 'Claiming...' : 
                                        isSoldOut ? 'Sold Out' :
                                        '🔥 Claim Deal'
                                        }
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                {hasMoreDeals && (
                    <div style={styles.loadMoreContainer}>
                        <button 
                            onClick={loadMoreDeals} 
                            style={{
                                ...styles.loadMoreButton,
                                opacity: isLoadingMore ? 0.7 : 1,
                                cursor: isLoadingMore ? 'not-allowed' : 'pointer'
                            }}
                            disabled={isLoadingMore}
                        >
                            {isLoadingMore ? 'Loading...' : `Load More Deals (${deals.length - loadedCount} remaining)`}
                        </button>
                    </div>
                )}
                
                <div style={styles.footer}>
                    <p style={styles.footerText}>
                        {hasPersonalized 
                            ? '🎯 These deals are personalized based on your interests! Refresh to get new recommendations.' 
                            : '🎲 New random deals appear every 30 minutes!'}
                        <br />
                        <small>Top sellers with more referrals get priority placement</small>
                    </p>
                </div>
            </div>

            {/* Product Details Modal */}
            {showModal && selectedDeal && (
                <div style={styles.modalOverlay} onClick={closeModal}>
                    <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <button style={styles.modalClose} onClick={closeModal}>×</button>
                        
                        {loadingSeller ? (
                            <div style={styles.modalLoading}>
                                <div style={styles.spinnerSmall}></div>
                                <p>Loading seller details...</p>
                            </div>
                        ) : (
                            <>
                                <div style={styles.modalImageContainer}>
                                    <ProductImage 
                                        product={selectedDeal.product} 
                                        style={styles.modalImage}
                                        modalStyle={true}
                                    />
                                </div>
                                
                                <div style={styles.modalBody}>
                                    <h2 style={styles.modalTitle}>{selectedDeal.product?.name}</h2>
                                    
                                    {selectedDeal.is_personalized && (
                                        <div style={{
                                            background: 'linear-gradient(135deg, #667eea20, #764ba220)',
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            marginBottom: '15px',
                                            fontSize: '13px',
                                            color: '#667eea'
                                        }}>
                                            🎯 This deal was personalized for you based on your interests!
                                        </div>
                                    )}
                                    
                                    <div style={styles.modalSection}>
                                        <h4>📝 Description</h4>
                                        <p>{selectedDeal.product?.description || 'No description available.'}</p>
                                    </div>
                                    
                                    <div style={styles.modalSection}>
                                        <h4>👤 Seller Information</h4>
                                        <div style={styles.sellerInfo}>
                                            <div style={styles.sellerAvatar}>
                                                {sellerDetails?.avatar_url ? (
                                                    <img src={sellerDetails.avatar_url} alt="Seller" style={styles.avatar} />
                                                ) : (
                                                    <div style={styles.avatarPlaceholder}>
                                                        {sellerDetails?.username?.charAt(0) || selectedDeal.seller_name?.charAt(0) || 'S'}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={styles.sellerDetails}>
                                                <p><strong>Name:</strong> {sellerDetails?.username || selectedDeal.seller_name || 'Unknown Seller'}</p>
                                                <p><strong>Location:</strong> 📍 {sellerDetails?.location || selectedDeal.product?.location || 'Unknown'}</p>
                                                <p><strong>Rating:</strong> ⭐ {sellerDetails?.rating || 'New Seller'}/5</p>
                                                <p><strong>Referral Points:</strong> 🎁 {selectedDeal.seller_referral_points || 0} referrals</p>
                                                {sellerDetails?.email && (
                                                    <p><strong>Contact:</strong> 📧 {sellerDetails.email}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div style={styles.modalSection}>
                                        <h4>📊 Deal Details</h4>
                                        <ul style={styles.dealDetailsList}>
                                            <li>🔥 Limited stock: {selectedDeal.max_quantity - selectedDeal.sold_count} left</li>
                                            <li>⏰ Deal expires in: {timeLeft[selectedDeal.id] ? formatTimeDisplay(timeLeft[selectedDeal.id]) : 'Expiring soon'}</li>
                                            <li>📅 Listed on: {new Date(selectedDeal.product?.created_at).toLocaleDateString()}</li>
                                            {selectedDeal.is_personalized && (
                                                <li>🎯 Personalized for you based on your interests</li>
                                            )}
                                        </ul>
                                    </div>
                                    
                                    <button
                                        onClick={() => {
                                            closeModal();
                                            claimDeal(selectedDeal);
                                        }}
                                        disabled={claiming[selectedDeal.id] || selectedDeal.sold_count >= selectedDeal.max_quantity}
                                        style={{
                                            ...styles.modalClaimButton,
                                            background: selectedDeal.sold_count >= selectedDeal.max_quantity ? '#f44336' :
                                                       'linear-gradient(135deg, #667eea, #764ba2)'
                                        }}
                                    >
                                        {claiming[selectedDeal.id] ? 'Claiming...' :
                                         selectedDeal.sold_count >= selectedDeal.max_quantity ? 'Sold Out' :
                                         `🔥 Claim Now`}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

const styles = {
    container: {
        background: 'linear-gradient(135deg, #667eea15, #764ba215)',
        borderRadius: '16px',
        padding: '20px',
        margin: '20px 0'
    },
    errorContainer: {
        textAlign: 'center',
        padding: '60px 20px',
        background: '#2d2d2d',
        borderRadius: '12px',
        color: '#fff'
    },
    errorIcon: {
        fontSize: '48px',
        marginBottom: '15px'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '15px'
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    title: {
        fontSize: '24px',
        margin: '0 0 5px 0',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
    },
    subtitle: {
        fontSize: '13px',
        color: '#b0b0b0',
        margin: 0
    },
    refreshTimer: {
        background: '#2a2a2a',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: 'bold',
        color: '#FF9800'
    },
    manualRefreshIcon: {
        background: '#2a2a2a',
        border: '1px solid #444',
        borderRadius: '50%',
        width: '36px',
        height: '36px',
        cursor: 'pointer',
        fontSize: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff'
    },
    dealsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '20px',
        maxHeight: '70vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '5px',
        scrollBehavior: 'smooth'
    },
    dealCard: {
        background: '#2d2d2d',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        position: 'relative',
        cursor: 'pointer',
        border: '1px solid #404040'
    },
    hotBadge: {
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'linear-gradient(135deg, #FF6B6B, #FF4444)',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 'bold',
        zIndex: 1,
        animation: 'pulse 1s infinite'
    },
    soldOutBadge: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: '#f44336',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 'bold',
        zIndex: 1
    },
    dealImage: {
        width: '100%',
        height: '180px',
        objectFit: 'cover'
    },
    dealImagePlaceholder: {
        width: '100%',
        height: '180px',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '48px',
        fontWeight: 'bold',
        color: 'white'
    },
    imageSkeleton: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: '#1a1a1a',
        overflow: 'hidden'
    },
    dealContent: {
        padding: '15px'
    },
    dealName: {
        margin: '0 0 10px 0',
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#ffffff',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    priceSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '10px',
        flexWrap: 'wrap'
    },
    originalPrice: {
        textDecoration: 'line-through',
        color: '#888',
        fontSize: '14px'
    },
    dealPrice: {
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#4CAF50'
    },
    dealInfo: {
        fontSize: '13px',
        color: '#b0b0b0',
        marginBottom: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
    },
    location: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    },
    seller: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    },
    stock: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        color: '#FF9800'
    },
    timer: {
        background: '#1a1a1a',
        padding: '8px',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: 'bold',
        color: '#FF9800',
        marginBottom: '10px'
    },
    claimButton: {
        width: '100%',
        color: 'white',
        border: 'none',
        padding: '12px',
        borderRadius: '8px',
        fontWeight: 'bold',
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'transform 0.2s'
    },
    loadingContainer: {
        textAlign: 'center',
        padding: '40px',
        color: '#fff'
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '3px solid #444',
        borderTop: '3px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 15px'
    },
    emptyContainer: {
        textAlign: 'center',
        padding: '60px 20px',
        background: '#2d2d2d',
        borderRadius: '12px',
        color: '#fff'
    },
    emptyIcon: {
        fontSize: '48px',
        marginBottom: '15px'
    },
    refreshButton: {
        marginTop: '15px',
        padding: '10px 20px',
        background: '#667eea',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer'
    },
    loadMoreContainer: {
        textAlign: 'center',
        marginTop: '20px'
    },
    loadMoreButton: {
        background: '#2a2a2a',
        border: '1px solid #667eea',
        color: '#667eea',
        padding: '10px 24px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        transition: 'all 0.2s'
    },
    footer: {
        textAlign: 'center',
        marginTop: '20px',
        paddingTop: '15px',
        borderTop: '1px solid #404040'
    },
    footerText: {
        fontSize: '12px',
        color: '#888',
        margin: 0
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        overflow: 'auto'
    },
    modalContent: {
        background: '#2d2d2d',
        borderRadius: '16px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative',
        animation: 'slideUp 0.3s ease',
        border: '1px solid #404040'
    },
    modalClose: {
        position: 'absolute',
        top: '15px',
        right: '15px',
        background: 'rgba(0,0,0,0.5)',
        color: 'white',
        border: 'none',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        fontSize: '24px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1
    },
    modalImageContainer: {
        width: '100%',
        height: '250px',
        overflow: 'hidden'
    },
    modalImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    modalBody: {
        padding: '24px'
    },
    modalTitle: {
        fontSize: '24px',
        margin: '0 0 15px 0',
        color: '#ffffff'
    },
    modalPriceSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
        flexWrap: 'wrap'
    },
    modalOriginalPrice: {
        textDecoration: 'line-through',
        color: '#888',
        fontSize: '16px'
    },
    modalDealPrice: {
        fontSize: '28px',
        fontWeight: 'bold',
        color: '#4CAF50'
    },
    modalSection: {
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '1px solid #404040'
    },
    sellerInfo: {
        display: 'flex',
        gap: '15px',
        marginTop: '10px'
    },
    sellerAvatar: {
        flexShrink: 0
    },
    avatar: {
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        objectFit: 'cover'
    },
    avatarPlaceholder: {
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        fontWeight: 'bold',
        color: 'white'
    },
    sellerDetails: {
        flex: 1,
        color: '#e0e0e0'
    },
    dealDetailsList: {
        margin: '10px 0 0 20px',
        color: '#b0b0b0'
    },
    modalClaimButton: {
        width: '100%',
        padding: '14px',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 'bold',
        fontSize: '16px',
        cursor: 'pointer',
        marginTop: '10px'
    },
    modalLoading: {
        textAlign: 'center',
        padding: '60px',
        color: '#fff'
    },
    spinnerSmall: {
        width: '30px',
        height: '30px',
        border: '3px solid #444',
        borderTop: '3px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 15px'
    }
};

// Add keyframes animation
if (!document.getElementById('daily-deals-styles')) {
    const styleSheet = document.createElement("style");
    styleSheet.id = 'daily-deals-styles';

    styleSheet.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(50px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.7;
            }
        }
        .skeleton-shimmer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
    `;
    document.head.appendChild(styleSheet);
}

export default React.memo(DailyDeals);
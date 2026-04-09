import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';

const DailyDeals = ({ userId, userReferralCount, onClaimDeal }) => {
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState({});
    const [claiming, setClaiming] = useState({});
    const [nextRefreshIn, setNextRefreshIn] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);
    const [activeDealIds, setActiveDealIds] = useState([]);
    
    // Modal state for product details
    const [selectedDeal, setSelectedDeal] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [sellerDetails, setSellerDetails] = useState(null);
    const [loadingSeller, setLoadingSeller] = useState(false);

    // Configuration
    const DEAL_DURATION_MINUTES = 30;
    const NUMBER_OF_DEALS = 6;
    const REFRESH_ON_PAGE_VIEW = true;
    const MIN_DISCOUNT = 20;
    const MAX_DISCOUNT = 60;

    // Fetch seller referral points
    const getSellerReferralPoints = async (sellerId) => {
        try {
            // Count completed referrals for this seller
            const { data, error } = await supabase
                .from('referrals')
                .select('id')
                .eq('referrer_id', sellerId)
                .eq('status', 'completed');
            
            if (error) throw error;
            return data?.length || 0;
        } catch (error) {
            console.error('Error fetching seller points:', error);
            return 0;
        }
    };

    // Load random deals with seller referral points
    const loadRandomDeals = useCallback(async () => {
        setLoading(true);
        
        try {
            // Get current user's location
            const { data: userProfile } = await supabase
                .from('profiles')
                .select('location')
                .eq('user_id', userId)
                .single();
            
            const userLocation = userProfile?.location || '';
            
            // Fetch available products
            const { data: allProducts, error } = await supabase
                .from('products')
                .select(`
                    id,
                    name,
                    description,
                    price,
                    image_url,
                    location,
                    seller_id,
                    views,
                    created_at,
                    seller:profiles!seller_id (
                        id,
                        username,
                        email,
                        location,
                        rating,
                        avatar_url
                    )
                `)
                .eq('is_available', true);
            
            if (error) throw error;
            
            if (!allProducts || allProducts.length === 0) {
                setDeals([]);
                setLoading(false);
                return;
            }
            
            // Get referral points for each seller
            const productsWithScores = await Promise.all(
                allProducts.map(async (product) => {
                    const referralPoints = await getSellerReferralPoints(product.seller_id);
                    
                    let score = 0;
                    
                    // Primary: Referral points (most important)
                    score += referralPoints * 10; // Each referral = 10 points
                    
                    // Secondary: Location match (bonus)
                    if (userLocation && product.location === userLocation) {
                        score += 50;
                    }
                    
                    // Tertiary: Product popularity (small bonus)
                    score += Math.min((product.views || 0) / 10, 50);
                    
                    return { 
                        ...product, 
                        score,
                        seller_referral_points: referralPoints
                    };
                })
            );
            
            // Sort by score (highest referral points first)
            const sortedByScore = productsWithScores.sort((a, b) => b.score - a.score);
            
            // Separate products with scores vs without
            const productsWithScoresOnly = sortedByScore.filter(p => p.score > 0);
            const productsWithoutScores = sortedByScore.filter(p => p.score === 0);
            
            let selectedProducts = [];
            
            // Tiered selection based on referral points
            if (productsWithScoresOnly.length >= NUMBER_OF_DEALS) {
                // Case 1: Enough products from sellers with referrals
                selectedProducts = productsWithScoresOnly.slice(0, NUMBER_OF_DEALS);
                console.log('✅ Taking top 6 products from sellers with highest referral points');
                
            } else if (productsWithScoresOnly.length > 0) {
                // Case 2: Some products from sellers with referrals
                const remainingSlots = NUMBER_OF_DEALS - productsWithScoresOnly.length;
                selectedProducts = [...productsWithScoresOnly];
                
                // Fill with random products
                const shuffledRandom = [...productsWithoutScores];
                for (let i = shuffledRandom.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffledRandom[i], shuffledRandom[j]] = [shuffledRandom[j], shuffledRandom[i]];
                }
                selectedProducts.push(...shuffledRandom.slice(0, remainingSlots));
                console.log(`✅ Taking ${productsWithScoresOnly.length} from top sellers + ${remainingSlots} random products`);
                
            } else {
                // Case 3: No sellers have referral points - show random
                const shuffled = [...allProducts];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                selectedProducts = shuffled.slice(0, NUMBER_OF_DEALS);
                console.log('🎲 No referral points found - showing random products');
            }
            
            // Create deal objects
            const newDeals = selectedProducts.map(product => {
                const discountPercent = Math.floor(Math.random() * (MAX_DISCOUNT - MIN_DISCOUNT + 1)) + MIN_DISCOUNT;
                const originalPrice = product.price;
                const dealPrice = +(originalPrice * (1 - discountPercent / 100)).toFixed(2);
                const referralRequired = Math.floor(Math.random() * 6);
                const maxQuantity = Math.floor(Math.random() * 16) + 5;
                const alreadyClaimed = activeDealIds.includes(product.id);
                
                return {
                    id: `deal-${product.id}-${Date.now()}`,
                    product_id: product.id,
                    product: product, // Full product object
                    original_price: originalPrice,
                    deal_price: dealPrice,
                    discount_percentage: discountPercent,
                    referral_required: referralRequired,
                    max_quantity: maxQuantity,
                    sold_count: alreadyClaimed ? 1 : 0,
                    end_time: new Date(Date.now() + DEAL_DURATION_MINUTES * 60 * 1000).toISOString(),
                    is_active: true,
                    already_claimed: alreadyClaimed,
                    seller_referral_points: product.seller_referral_points
                };
            });
            
            setDeals(newDeals);
            setLastRefresh(new Date());
            setNextRefreshIn(DEAL_DURATION_MINUTES * 60);
            
            localStorage.setItem('lastDealsRefresh', new Date().toISOString());
            localStorage.setItem('currentDeals', JSON.stringify(newDeals.map(d => d.product_id)));
            
        } catch (error) {
            console.error('Error loading random deals:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, NUMBER_OF_DEALS, DEAL_DURATION_MINUTES, MIN_DISCOUNT, MAX_DISCOUNT, activeDealIds]);

    // View product details with seller info
    const viewProductDetails = async (deal) => {
        setSelectedDeal(deal);
        setLoadingSeller(true);
        setShowModal(true);
        
        try {
            // Fetch additional seller details
            const { data: sellerData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', deal.product.seller_id)
                .single();
            
            if (!error && sellerData) {
                setSellerDetails(sellerData);
            }
            
            // Increment product view count
            await supabase
                .from('products')
                .update({ views: (deal.product.views || 0) + 1 })
                .eq('id', deal.product_id);
                
        } catch (error) {
            console.error('Error fetching seller details:', error);
        } finally {
            setLoadingSeller(false);
        }
    };

    // Close modal
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
            console.log('All deals expired, loading new ones...');
            loadRandomDeals();
        }
    }, [deals, loadRandomDeals]);

    // Handle refresh timer
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
        loadRandomDeals();
        const refreshInterval = setInterval(() => {
            loadRandomDeals();
        }, DEAL_DURATION_MINUTES * 60 * 1000);
        
        return () => clearInterval(refreshInterval);
    }, [loadRandomDeals, DEAL_DURATION_MINUTES]);

    // Update countdown every second
    useEffect(() => {
        const countdownInterval = setInterval(updateCountdowns, 1000);
        return () => clearInterval(countdownInterval);
    }, [updateCountdowns]);

    const canAccessDeal = (deal) => {
        return userReferralCount >= deal.referral_required && !deal.already_claimed;
    };

    const claimDeal = async (deal) => {
        if (deal.already_claimed) {
            alert('❌ You already claimed this deal!');
            return;
        }
        
        if (!canAccessDeal(deal)) {
            alert(`⚠️ You need ${deal.referral_required} referrals to access this deal! Invite friends to unlock.`);
            return;
        }

        if (deal.sold_count >= deal.max_quantity) {
            alert('❌ This deal is sold out!');
            return;
        }

        setClaiming(prev => ({ ...prev, [deal.id]: true }));

        // Simulate claim process
        setTimeout(() => {
            alert(`🎉 Deal claimed! You saved $${(deal.original_price - deal.deal_price).toFixed(2)}!`);
            
            setDeals(prev => prev.map(d => 
                d.id === deal.id ? { ...d, sold_count: d.sold_count + 1, already_claimed: true } : d
            ));
            
            setActiveDealIds(prev => [...prev, deal.product_id]);
            
            const claimedDeals = JSON.parse(localStorage.getItem('claimedDeals') || '[]');
            localStorage.setItem('claimedDeals', JSON.stringify([...claimedDeals, deal.product_id]));
            
            if (onClaimDeal) {
                onClaimDeal(deal);
            }
            
            setClaiming(prev => ({ ...prev, [deal.id]: false }));
        }, 500);
    };

    const formatTimeDisplay = (time) => {
        if (!time) return '';
        if (time.minutes === 0 && time.seconds === 0) return 'Expired';
        return `${time.minutes}m ${time.seconds}s`;
    };

    const handleManualRefresh = () => {
        if (window.confirm('Refresh deals now? New random deals will appear.')) {
            loadRandomDeals();
        }
    };

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>Finding hot deals for you...</p>
            </div>
        );
    }

    if (deals.length === 0) {
        return (
            <div style={styles.emptyContainer}>
                <div style={styles.emptyIcon}>🔥</div>
                <h4>No Products Available</h4>
                <p>Check back soon for new deals!</p>
                <button onClick={handleManualRefresh} style={styles.refreshButton}>
                    🔄 Refresh Now
                </button>
            </div>
        );
    }

    return (
        <>
            <div style={styles.container}>
                <div style={styles.header}>
                    <div>
                        <h3 style={styles.title}>🔥 Daily Deals 🔥</h3>
                        <p style={styles.subtitle}>
                            Limited time offers - New deals every {DEAL_DURATION_MINUTES} minutes!
                        </p>
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
                    {deals.map(deal => {
                        const accessible = canAccessDeal(deal);
                        const timeRemaining = timeLeft[deal.id];
                        const product = deal.product;
                        const isSoldOut = deal.sold_count >= deal.max_quantity;
                        const isClaimed = deal.already_claimed;
                        
                        return (
                            <div 
                                key={deal.id} 
                                style={{
                                    ...styles.dealCard,
                                    opacity: isClaimed ? 0.7 : 1,
                                    border: isClaimed ? '2px solid #4CAF50' : 'none',
                                    cursor: 'pointer'
                                }}
                                onClick={() => viewProductDetails(deal)}
                            >
                                {isClaimed && (
                                    <div style={styles.claimedBadge}>✓ Claimed!</div>
                                )}
                                
                                {deal.seller_referral_points > 0 && (
                                    <div style={styles.topSellerBadge}>
                                        ⭐ Top Seller ({deal.seller_referral_points} referrals)
                                    </div>
                                )}
                                
                                {product?.image_url ? (
                                    <img 
                                        src={product.image_url} 
                                        alt={product.name}
                                        style={styles.dealImage}
                                    />
                                ) : (
                                    <div style={styles.dealImagePlaceholder}>🛍️</div>
                                )}
                                
                                <div style={styles.dealContent}>
                                    <h4 style={styles.dealName}>{product?.name}</h4>
                                    
                                    <div style={styles.priceSection}>
                                        <span style={styles.originalPrice}>${deal.original_price}</span>
                                        <span style={styles.dealPrice}>${deal.deal_price}</span>
                                        <span style={styles.discountBadge}>
                                            -{deal.discount_percentage}%
                                        </span>
                                    </div>
                                    
                                    <div style={styles.dealInfo}>
                                        <div style={styles.location}>
                                            📍 {product?.location || 'Unknown'}
                                        </div>
                                        <div style={styles.seller}>
                                            👤 {product?.seller?.username || product?.seller?.email?.split('@')[0] || 'Seller'}
                                        </div>
                                    </div>
                                    
                                    <div style={styles.referralRequired}>
                                        {deal.referral_required === 0 ? 
                                            '🎁 No referrals needed' : 
                                            `👥 Requires ${deal.referral_required}+ referrals`
                                        }
                                    </div>
                                    
                                    {timeRemaining && timeRemaining.minutes > 0 && !isClaimed && (
                                        <div style={styles.timer}>
                                            ⏰ Expires in: {formatTimeDisplay(timeRemaining)}
                                        </div>
                                    )}
                                    
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent opening modal
                                            claimDeal(deal);
                                        }}
                                        disabled={!accessible || claiming[deal.id] || isSoldOut || isClaimed}
                                        style={{
                                            ...styles.claimButton,
                                            background: isClaimed ? '#4CAF50' : 
                                                       !accessible ? '#999' : 
                                                       isSoldOut ? '#f44336' : 
                                                       'linear-gradient(135deg, #667eea, #764ba2)',
                                        }}
                                    >
                                        {claiming[deal.id] ? 'Claiming...' : 
                                         isClaimed ? '✓ Claimed' :
                                         !accessible ? '🔒 Need More Referrals' :
                                         isSoldOut ? 'Sold Out' :
                                         '🔥 Claim Deal'
                                        }
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                <div style={styles.footer}>
                    <p style={styles.footerText}>
                        🎲 New random deals appear every {DEAL_DURATION_MINUTES} minutes!
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
                                    {selectedDeal.product?.image_url ? (
                                        <img 
                                            src={selectedDeal.product.image_url} 
                                            alt={selectedDeal.product.name}
                                            style={styles.modalImage}
                                        />
                                    ) : (
                                        <div style={styles.modalImagePlaceholder}>🛍️</div>
                                    )}
                                </div>
                                
                                <div style={styles.modalBody}>
                                    <h2 style={styles.modalTitle}>{selectedDeal.product?.name}</h2>
                                    
                                    <div style={styles.modalPriceSection}>
                                        <span style={styles.modalOriginalPrice}>${selectedDeal.original_price}</span>
                                        <span style={styles.modalDealPrice}>${selectedDeal.deal_price}</span>
                                        <span style={styles.modalDiscount}>-{selectedDeal.discount_percentage}% OFF</span>
                                    </div>
                                    
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
                                                        {sellerDetails?.username?.charAt(0) || selectedDeal.product?.seller?.username?.charAt(0) || 'S'}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={styles.sellerDetails}>
                                                <p><strong>Name:</strong> {sellerDetails?.username || selectedDeal.product?.seller?.username || 'Unknown Seller'}</p>
                                                <p><strong>Location:</strong> 📍 {sellerDetails?.location || selectedDeal.product?.location || 'Unknown'}</p>
                                                <p><strong>Rating:</strong> ⭐ {sellerDetails?.rating || selectedDeal.product?.seller?.rating || 'New Seller'}/5</p>
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
                                            <li>👥 Referrals needed: {selectedDeal.referral_required === 0 ? 'None!' : `${selectedDeal.referral_required}+ referrals`}</li>
                                            <li>⏰ Deal expires in: {timeLeft[selectedDeal.id] ? formatTimeDisplay(timeLeft[selectedDeal.id]) : 'Expiring soon'}</li>
                                            <li>📅 Listed on: {new Date(selectedDeal.product?.created_at).toLocaleDateString()}</li>
                                        </ul>
                                    </div>
                                    
                                    <button
                                        onClick={() => {
                                            closeModal();
                                            claimDeal(selectedDeal);
                                        }}
                                        disabled={!canAccessDeal(selectedDeal) || claiming[selectedDeal.id] || 
                                                  selectedDeal.sold_count >= selectedDeal.max_quantity || 
                                                  selectedDeal.already_claimed}
                                        style={{
                                            ...styles.modalClaimButton,
                                            background: selectedDeal.already_claimed ? '#4CAF50' :
                                                       !canAccessDeal(selectedDeal) ? '#999' :
                                                       selectedDeal.sold_count >= selectedDeal.max_quantity ? '#f44336' :
                                                       'linear-gradient(135deg, #667eea, #764ba2)'
                                        }}
                                    >
                                        {claiming[selectedDeal.id] ? 'Claiming...' :
                                         selectedDeal.already_claimed ? '✓ Already Claimed' :
                                         !canAccessDeal(selectedDeal) ? '🔒 Need More Referrals' :
                                         selectedDeal.sold_count >= selectedDeal.max_quantity ? 'Sold Out' :
                                         '🔥 Claim This Deal'}
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
        maxHeight: '60vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '5px',
        scrollBehavior: 'smooth',
        overscrollBehavior: 'contain'
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
    topSellerBadge: {
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'linear-gradient(135deg, #FFD700, #FFA500)',
        color: '#333',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 'bold',
        zIndex: 1
    },
    claimedBadge: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: '#4CAF50',
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
        color: 'white'
    },
    dealContent: {
        padding: '15px'
    },
    dealName: {
        margin: '0 0 10px 0',
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#ffffff'
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
    discountBadge: {
        background: '#FF9800',
        color: 'white',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold'
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
    referralRequired: {
        fontSize: '12px',
        color: '#b0b0b0',
        marginBottom: '10px'
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
    // Modal styles
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
    modalImagePlaceholder: {
        width: '100%',
        height: '250px',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '64px',
        color: 'white'
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
    modalDiscount: {
        background: '#FF9800',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '14px',
        fontWeight: 'bold'
    },
    modalSection: {
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '1px solid #404040'
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
const styleSheet = document.createElement("style");
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
`;
document.head.appendChild(styleSheet);

export default DailyDeals;
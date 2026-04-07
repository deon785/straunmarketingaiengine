import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';

const DailyDeals = ({ userId, userReferralCount, onClaimDeal }) => {
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState({});
    const [claiming, setClaiming] = useState({});
    const [nextRefreshIn, setNextRefreshIn] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);
    const [activeDealIds, setActiveDealIds] = useState([]); // Track claimed deals

    // Configuration - Easily adjustable
    const DEAL_DURATION_MINUTES = 30; // How long deals last (30 minutes)
    const NUMBER_OF_DEALS = 6; // How many deals to show (6 products)
    const REFRESH_ON_PAGE_VIEW = true; // Refresh when user comes to page
    const MIN_DISCOUNT = 20; // Minimum discount percentage (20%)
    MAX_DISCOUNT = 60; // Maximum discount percentage (60%)

    // Load random deals - Core rotation function
    const loadRandomDeals = useCallback(async () => {
        setLoading(true);
        
        try {
            // Get current user's location for personalized deals
            const { data: userProfile } = await supabase
                .from('profiles')
                .select('location')
                .eq('user_id', userId)
                .single();
            
            const userLocation = userProfile?.location || '';
            
            // Fetch available products (not sold out)
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
                    seller:profiles!seller_id (
                        username,
                        location,
                        rating
                    )
                `)
                .eq('is_available', true)
                .order('views', { ascending: false });
            
            if (error) throw error;
            
            if (!allProducts || allProducts.length === 0) {
                setDeals([]);
                setLoading(false);
                return;
            }
            
            // Score products for smarter selection
            const scoredProducts = allProducts.map(product => {
                let score = 0;
                
                // Bonus for products near user location (50 points)
                if (userLocation && product.location === userLocation) {
                    score += 50;
                }
                
                // Bonus for popular products (up to 100 points based on views)
                score += Math.min(product.views || 0, 100);
                
                // Random factor for variety (0-30 points)
                score += Math.random() * 30;
                
                return { ...product, score };
            });
            
            // Sort by score and take top deals
            const sortedProducts = scoredProducts.sort((a, b) => b.score - a.score);
            const selectedProducts = sortedProducts.slice(0, NUMBER_OF_DEALS);
            
            // Create deal objects with random discounts
            const newDeals = selectedProducts.map(product => {
                // Random discount between MIN_DISCOUNT and MAX_DISCOUNT
                const discountPercent = Math.floor(Math.random() * (MAX_DISCOUNT - MIN_DISCOUNT + 1)) + MIN_DISCOUNT;
                const originalPrice = product.price;
                const dealPrice = +(originalPrice * (1 - discountPercent / 100)).toFixed(2);
                
                // Random referral requirement (0-5 referrals)
                const referralRequired = Math.floor(Math.random() * 6);
                
                // Random quantity available (5-20 units)
                const maxQuantity = Math.floor(Math.random() * 16) + 5;
                
                // Check if user already claimed this product in current session
                const alreadyClaimed = activeDealIds.includes(product.id);
                
                return {
                    id: `deal-${product.id}-${Date.now()}`,
                    product_id: product.id,
                    products: product,
                    original_price: originalPrice,
                    deal_price: dealPrice,
                    discount_percentage: discountPercent,
                    referral_required: referralRequired,
                    max_quantity: maxQuantity,
                    sold_count: alreadyClaimed ? 1 : 0,
                    end_time: new Date(Date.now() + DEAL_DURATION_MINUTES * 60 * 1000).toISOString(),
                    is_active: true,
                    already_claimed: alreadyClaimed
                };
            });
            
            setDeals(newDeals);
            setLastRefresh(new Date());
            setNextRefreshIn(DEAL_DURATION_MINUTES * 60);
            
            // Store in localStorage to persist across page refreshes
            localStorage.setItem('lastDealsRefresh', new Date().toISOString());
            localStorage.setItem('currentDeals', JSON.stringify(newDeals.map(d => d.product_id)));
            
        } catch (error) {
            console.error('Error loading random deals:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, NUMBER_OF_DEALS, DEAL_DURATION_MINUTES, MIN_DISCOUNT, MAX_DISCOUNT, activeDealIds]);

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
        
        // Auto-refresh when all deals expire
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

    // Check if we should refresh on page load
    useEffect(() => {
        const lastRefreshTime = localStorage.getItem('lastDealsRefresh');
        const storedDeals = localStorage.getItem('currentDeals');
        
        if (REFRESH_ON_PAGE_VIEW && lastRefreshTime && storedDeals) {
            const lastRefreshDate = new Date(lastRefreshTime);
            const minutesSinceRefresh = (Date.now() - lastRefreshDate.getTime()) / (1000 * 60);
            
            // If deals are older than DEAL_DURATION_MINUTES, refresh
            if (minutesSinceRefresh >= DEAL_DURATION_MINUTES) {
                loadRandomDeals();
            } else {
                // Load existing deals from storage or fetch new
                loadRandomDeals();
            }
        } else {
            loadRandomDeals();
        }
        
        // Set up auto-refresh interval
        const refreshInterval = setInterval(() => {
            loadRandomDeals();
        }, DEAL_DURATION_MINUTES * 60 * 1000);
        
        return () => clearInterval(refreshInterval);
    }, [loadRandomDeals, DEAL_DURATION_MINUTES, REFRESH_ON_PAGE_VIEW]);

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
            
            // Update local state
            setDeals(prev => prev.map(d => 
                d.id === deal.id ? { ...d, sold_count: d.sold_count + 1, already_claimed: true } : d
            ));
            
            // Track claimed deal
            setActiveDealIds(prev => [...prev, deal.product_id]);
            
            // Store in localStorage
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

    // Manual refresh handler
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
                    const product = deal.products;
                    const isSoldOut = deal.sold_count >= deal.max_quantity;
                    const isClaimed = deal.already_claimed;
                    
                    return (
                        <div key={deal.id} style={{
                            ...styles.dealCard,
                            opacity: isClaimed ? 0.7 : 1,
                            border: isClaimed ? '2px solid #4CAF50' : 'none'
                        }}>
                            {isClaimed && (
                                <div style={styles.claimedBadge}>✓ Claimed!</div>
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
                                    <div style={styles.referralRequired}>
                                        {deal.referral_required === 0 ? 
                                            '🎁 No referrals needed' : 
                                            `👥 Requires ${deal.referral_required}+ referrals`
                                        }
                                    </div>
                                </div>
                                
                                {timeRemaining && timeRemaining.minutes > 0 && !isClaimed && (
                                    <div style={styles.timer}>
                                        ⏰ Expires in: {formatTimeDisplay(timeRemaining)}
                                    </div>
                                )}
                                
                                {isClaimed && (
                                    <div style={styles.claimedMessage}>
                                        ✅ You claimed this deal!
                                    </div>
                                )}
                                
                                {!isClaimed && (
                                    <div style={styles.stockInfo}>
                                        🔥 {deal.max_quantity - deal.sold_count} left at this price!
                                    </div>
                                )}
                                
                                <button
                                    onClick={() => claimDeal(deal)}
                                    disabled={!accessible || claiming[deal.id] || isSoldOut || isClaimed}
                                    style={{
                                        ...styles.claimButton,
                                        background: isClaimed ? '#4CAF50' : 
                                                   !accessible ? '#999' : 
                                                   isSoldOut ? '#f44336' : 
                                                   'linear-gradient(135deg, #667eea, #764ba2)',
                                        opacity: (!accessible || claiming[deal.id] || isSoldOut || isClaimed) ? 0.6 : 1,
                                        cursor: (!accessible || claiming[deal.id] || isSoldOut || isClaimed) ? 'not-allowed' : 'pointer'
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
                    <small>Discounts range from {MIN_DISCOUNT}% to {MAX_DISCOUNT}% off</small>
                </p>
            </div>
        </div>
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
        color: '#666',
        margin: 0
    },
    refreshTimer: {
        background: '#FFF3E0',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: 'bold',
        color: '#FF9800'
    },
    manualRefreshIcon: {
        background: '#f0f0f0',
        border: '1px solid #ddd',
        borderRadius: '50%',
        width: '36px',
        height: '36px',
        cursor: 'pointer',
        fontSize: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    dealsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '20px'
    },
    dealCard: {
        background: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'transform 0.2s',
        position: 'relative'
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
        fontSize: '48px'
    },
    dealContent: {
        padding: '15px'
    },
    dealName: {
        margin: '0 0 10px 0',
        fontSize: '16px',
        fontWeight: 'bold'
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
        color: '#999',
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
        color: '#666',
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
    referralRequired: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    },
    timer: {
        background: '#FFF3E0',
        padding: '8px',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: 'bold',
        color: '#FF9800',
        marginBottom: '10px'
    },
    stockInfo: {
        fontSize: '12px',
        color: '#4CAF50',
        marginBottom: '15px',
        fontWeight: 'bold'
    },
    claimedMessage: {
        fontSize: '12px',
        color: '#4CAF50',
        marginBottom: '15px',
        fontWeight: 'bold',
        textAlign: 'center',
        padding: '8px',
        background: '#E8F5E9',
        borderRadius: '8px'
    },
    claimButton: {
        width: '100%',
        color: 'white',
        border: 'none',
        padding: '12px',
        borderRadius: '8px',
        fontWeight: 'bold',
        fontSize: '14px',
        transition: 'transform 0.2s'
    },
    loadingContainer: {
        textAlign: 'center',
        padding: '40px'
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '3px solid #f3f3f3',
        borderTop: '3px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 15px'
    },
    emptyContainer: {
        textAlign: 'center',
        padding: '60px 20px',
        background: 'white',
        borderRadius: '12px'
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
        borderTop: '1px solid #e0e0e0'
    },
    footerText: {
        fontSize: '12px',
        color: '#999',
        margin: 0
    }
};

export default DailyDeals;
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from './lib/supabase';

// ============================================
// HELPERS
// ============================================
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

const getOptimizedImageUrl = (url, width = 300, height = 200) => {
    if (!url) return null;
    if (url.includes('supabase.co/storage')) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}width=${width}&height=${height}&quality=40&resize=cover&format=webp`;
    }
    return url;
};

// Module-level cache: remembers which images already loaded this session
const imageLoadedCache = new Set();

// ============================================
// PRODUCT IMAGE — Flicker-proof
// ============================================
const ProductImage = React.memo(({ product, style }) => {
    const imageUrl = product?.image_url || product?.image || null;
    const hasImage = imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '';

    const optimizedSrc = useMemo(
        () => hasImage ? getOptimizedImageUrl(imageUrl, 200, 150) : null,
        [imageUrl, hasImage]
    );

    const [imgError, setImgError] = useState(false);
    // If cached, start as loaded (no fade)
    const [isLoading, setIsLoading] = useState(() => {
        return optimizedSrc ? !imageLoadedCache.has(optimizedSrc) : false;
    });

    const getInitialLetter = () => {
        if (!product?.name) return '?';
        return product.name.charAt(0).toUpperCase();
    };

    // No image or error — show placeholder only
    if (!hasImage || imgError) {
        return (
            <div style={{
                ...(style || {}),
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
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            minHeight: '180px'
        }}>
            {/* Placeholder — ONLY shown while loading */}
            {isLoading && (
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0,
                    width: '100%', height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
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
            )}

            <img
                src={optimizedSrc}
                alt={product.name || 'Product'}
                style={{
                    position: 'absolute',
                    top: 0, left: 0,
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    // No transition if already cached (instant), else fade in once
                    opacity: isLoading ? 0 : 1,
                    transition: isLoading ? 'opacity 0.25s ease-in' : 'none',
                    zIndex: 1
                }}
                onLoad={() => {
                    if (optimizedSrc) imageLoadedCache.add(optimizedSrc);
                    setIsLoading(false);
                }}
                onError={() => {
                    setImgError(true);
                    setIsLoading(false);
                }}
                loading="lazy"
                decoding="async"
            />
        </div>
    );
});

// ============================================
// DEAL TIMER — Isolated so it doesn't re-render the card
// ============================================
const DealTimer = React.memo(({ endTime }) => {
    const [remaining, setRemaining] = useState(null);

    useEffect(() => {
        const compute = () => {
            const diff = new Date(endTime).getTime() - Date.now();
            if (diff > 0) {
                setRemaining({
                    minutes: Math.floor(diff / 60000),
                    seconds: Math.floor((diff % 60000) / 1000)
                });
            } else {
                setRemaining({ minutes: 0, seconds: 0 });
            }
        };
        compute();
        const id = setInterval(compute, 1000);
        return () => clearInterval(id);
    }, [endTime]);

    if (!remaining || (remaining.minutes === 0 && remaining.seconds === 0)) return null;

    return (
        <div style={styles.timer}>
            ⏰ Expires in: {remaining.minutes}m {remaining.seconds}s
        </div>
    );
});

// ============================================
// REFRESH TIMER — Isolated so it doesn't re-render the header
// ============================================
const RefreshTimer = React.memo(({ nextRefreshIn }) => {
    if (nextRefreshIn === null) return null;
    
    return (
        <div style={styles.refreshTimer}>
            <span>🔄 Next refresh: </span>
            <strong>
                {Math.floor(nextRefreshIn / 60)}m {nextRefreshIn % 60}s
            </strong>
        </div>
    );
});

// ============================================
// DEAL CARD — Memoized
// ============================================
const DealCard = React.memo(({ deal, isSoldOut, isClaiming, onView, onClaim }) => {
    const product = deal.product;

    return (
        <div
            style={{
                ...styles.dealCard,
                opacity: isSoldOut ? 0.6 : 1,
                cursor: 'pointer',
                border: deal.is_personalized ? '2px solid #667eea' : '1px solid #404040'
            }}
            onClick={() => onView(deal)}
        >
            {isSoldOut && <div style={styles.soldOutBadge}>Sold Out!</div>}
            {deal.is_personalized && !isSoldOut && (
                <div style={{
                    position: 'absolute',
                    top: '10px', left: '10px',
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

            {deal.seller_referral_count >= 5 && !isSoldOut && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                    color: '#000',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    zIndex: 1
                }}>
                    🏆 Top Seller
                </div>
            )}

            <ProductImage product={product} style={styles.dealImage} />

            <div style={styles.dealContent}>
                <h4 style={styles.dealName}>{product?.name || 'Unknown Product'}</h4>

                <div style={styles.dealInfo}>
                    <div style={styles.location}>📍 {product?.location || 'Unknown'}</div>
                    <div style={styles.seller}>👤 {deal.seller_name || 'Seller'}</div>
                    <div style={styles.stock}>🎫 {deal.max_quantity - deal.sold_count} left</div>
                </div>

                {!isSoldOut && <DealTimer endTime={deal.end_time} />}

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClaim(deal);
                    }}
                    disabled={isSoldOut}
                    style={{
                        ...styles.claimButton,
                        background: isSoldOut ? '#f44336' : 'linear-gradient(135deg, #667eea, #764ba2)'
                    }}
                >
                    {isClaiming ? 'Claiming...' : isSoldOut ? 'Sold Out' : '🔥 Claim Deal'}
                </button>
            </div>
        </div>
    );
}, (prev, next) => {
    // Only re-render if the deal itself changed (not if a timer ticked)
    return (
        prev.deal.id === next.deal.id &&
        prev.deal.sold_count === next.deal.sold_count &&
        prev.deal.max_quantity === next.deal.max_quantity &&
        prev.deal.end_time === next.deal.end_time &&
        prev.isSoldOut === next.isSoldOut &&
        prev.isClaiming === next.isClaiming
    );
});

// ============================================
// MAIN COMPONENT
// ============================================
const DailyDeals = ({ userId, userReferralCount, onClaimDeal }) => {
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState({});
    const [nextRefreshIn, setNextRefreshIn] = useState(null);
    const [productCheck, setProductCheck] = useState(null);
    const [loadedCount, setLoadedCount] = useState(6);
    const [imagesLoaded, setImagesLoaded] = useState(0);
    const [imagesLoading, setImagesLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const [selectedDeal, setSelectedDeal] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [sellerDetails, setSellerDetails] = useState(null);
    const [loadingSeller, setLoadingSeller] = useState(false);

    // ✅ CHANGED: 10 minutes
    const DEAL_DURATION_MINUTES = 10;
    
    const refreshIntervalRef = useRef(null);
    const [lastRefresh, setLastRefresh] = useState(null);

    const getResponsiveDealCount = () => {
        const width = window.innerWidth;
        if (width < 640) return 4;
        if (width < 1024) return 6;
        return 12;
    };

    const [visibleDealCount, setVisibleDealCount] = useState(getResponsiveDealCount());

    // Image preloading tracker
    useEffect(() => {
        if (deals.length > 0) {
            const visible = deals.slice(0, loadedCount);
            let loaded = 0;
            const total = visible.length;
            if (total === 0) {
                setImagesLoaded(0);
                setImagesLoading(false);
                return;
            }
            setImagesLoaded(0);
            setImagesLoading(true);
            visible.forEach(deal => {
                if (deal.product?.image_url) {
                    const img = new Image();
                    img.src = getOptimizedImageUrl(deal.product.image_url, 200, 150);
                    const done = () => {
                        loaded++;
                        setImagesLoaded(loaded);
                        if (loaded >= total) setImagesLoading(false);
                    };
                    img.onload = done;
                    img.onerror = done;
                } else {
                    loaded++;
                    setImagesLoaded(loaded);
                    if (loaded >= total) setImagesLoading(false);
                }
            });
        }
    }, [deals, loadedCount]);

    // Load deals
    const loadDailyDeals = useCallback(async () => {
        setLoading(true);
        setImagesLoading(true);

        try {
            // ============================================
            // STEP 1: Fetch server-managed rotation deals
            // ============================================
            const { data: dailyDeals, error } = await supabase
                .from('daily_deals')
                .select(`
                    id,
                    product_id,
                    seller_id,
                    original_price,
                    deal_price,
                    discount_percentage,
                    referral_required,
                    max_quantity,
                    sold_count,
                    rotation_slot,
                    start_time,
                    end_time,
                    is_active,
                    products:product_id (
                        id,
                        name,
                        description,
                        image_url,
                        location,
                        phone_number,
                        views,
                        created_at,
                        status
                    )
                `)
                .eq('is_active', true)
                .order('rotation_slot', { ascending: true })
                .limit(30);

            if (error) throw error;

            if (!dailyDeals || dailyDeals.length === 0) {
                console.log('⚠️ No active deals in daily_deals table');
                setDeals([]);
                setLoading(false);
                setImagesLoading(false);
                return;
            }

            // ============================================
            // STEP 2: Fetch seller info + referral counts
            // ============================================
            const sellerIds = [...new Set(dailyDeals.map(d => d.seller_id).filter(Boolean))];
            let sellersMap = {};
            let referralCountMap = {};

            if (sellerIds.length > 0) {
                try {
                    const { data: sellers } = await supabase
                        .from('profiles')
                        .select('user_id, username, location, rating, phone_number')
                        .in('user_id', sellerIds);

                    if (sellers) {
                        sellersMap = Object.fromEntries(sellers.map(s => [s.user_id, s]));
                    }

                    const { data: referrals } = await supabase
                        .from('referrals')
                        .select('referrer_id')
                        .in('referrer_id', sellerIds)
                        .eq('status', 'completed');

                    referrals?.forEach(r => {
                        referralCountMap[r.referrer_id] = (referralCountMap[r.referrer_id] || 0) + 1;
                    });
                } catch (e) {
                    console.warn('Could not fetch seller info:', e);
                }
            }

            // ============================================
            // STEP 3: Fetch user's interests (safe for guests)
            // ============================================
            let userInterests = [];
            if (userId) {
                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('interests')
                        .eq('user_id', userId)
                        .maybeSingle();

                    if (profile?.interests) {
                        if (Array.isArray(profile.interests)) {
                            userInterests = profile.interests.filter(Boolean);
                        } else if (typeof profile.interests === 'string') {
                            try {
                                const parsed = JSON.parse(profile.interests);
                                userInterests = Array.isArray(parsed)
                                    ? parsed.filter(Boolean)
                                    : [profile.interests].filter(Boolean);
                            } catch {
                                userInterests = [profile.interests].filter(Boolean);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Could not load interests:', e);
                    userInterests = [];
                }
            }

            userInterests = userInterests
                .map(i => String(i).toLowerCase().trim())
                .filter(i => i.length >= 2);

            // ============================================
            // STEP 4: Build deal objects
            // ============================================
            const builtDeals = dailyDeals
                .filter(d => d.products)
                .map(d => {
                    const seller = sellersMap[d.seller_id] || {};
                    const productName = String(d.products.name || '').toLowerCase();
                    const productDesc = String(d.products.description || '').toLowerCase();

                    let matchScore = 0;
                    if (userInterests.length > 0 && productName) {
                        userInterests.forEach(interest => {
                            if (productName.includes(interest) || interest.includes(productName)) {
                                matchScore += 2;
                            } else if (productDesc.includes(interest)) {
                                matchScore += 1;
                            }
                        });
                    }

                    return {
                        id: `deal-${d.id}`,
                        deal_id: d.id,
                        product_id: d.product_id,
                        product: {
                            ...d.products,
                            seller_rating: seller.rating || 0,
                            seller_name: seller.username || 'Seller',
                        },
                        original_price: Number(d.original_price) || 0,
                        deal_price: Number(d.deal_price) || 0,
                        discount_percentage: Number(d.discount_percentage) || 0,
                        referral_required: d.referral_required || 0,
                        max_quantity: d.max_quantity || 1,
                        sold_count: d.sold_count || 0,
                        end_time: d.end_time,
                        start_time: d.start_time,
                        is_active: d.is_active,
                        rotation_slot: d.rotation_slot || 0,
                        seller_name: seller.username || 'Seller',
                        seller_rating: seller.rating || 0,
                        seller_referral_count: referralCountMap[d.seller_id] || 0,
                        seller_referral_points: 0,
                        is_personalized: matchScore > 0,
                        match_score: matchScore,
                        source: matchScore > 0 ? 'personalized' : 'rotation'
                    };
                });

            if (builtDeals.length === 0) {
                console.log('⚠️ No valid deals after filtering');
                setDeals([]);
                setLoading(false);
                setImagesLoading(false);
                return;
            }

            // ============================================
            // STEP 5: Smart mix — cap personalized, interleave
            // ============================================
            const PERSONALIZED_CAP_RATIO = 0.6;
            const MAX_PERSONALIZED = Math.max(1, Math.ceil(builtDeals.length * PERSONALIZED_CAP_RATIO));

            const personalizedItems = builtDeals
                .filter(d => d.is_personalized)
                .sort((a, b) => {
                    if (b.match_score !== a.match_score) return b.match_score - a.match_score;
                    return a.rotation_slot - b.rotation_slot;
                });

            const rotationItems = builtDeals
                .filter(d => !d.is_personalized)
                .sort((a, b) => a.rotation_slot - b.rotation_slot);

            // ✅ Helper to sync timer to earliest end_time
            const syncRefreshTimer = (items) => {
                const earliestEnd = items.reduce(
                    (min, d) => Math.min(min, new Date(d.end_time).getTime()),
                    Infinity
                );
                if (isFinite(earliestEnd)) {
                    setNextRefreshIn(Math.max(1, Math.floor((earliestEnd - Date.now()) / 1000)));
                }
            };

            // ✅ EDGE CASE 1: No personalized (new user, guest, no interests)
            if (personalizedItems.length === 0) {
                console.log(`✅ Loaded ${rotationItems.length} deals (all rotation — no interests)`);
                setDeals(rotationItems);
                setLoadedCount(Math.min(visibleDealCount, rotationItems.length));
                setLastRefresh(new Date());
                syncRefreshTimer(rotationItems);
                return;
            }

            // ✅ EDGE CASE 2: All personalized (no rotation available)
            if (rotationItems.length === 0) {
                console.log(`✅ Loaded ${personalizedItems.length} deals (all personalized — no rotation available)`);
                setDeals(personalizedItems);
                setLoadedCount(Math.min(visibleDealCount, personalizedItems.length));
                setLastRefresh(new Date());
                syncRefreshTimer(personalizedItems);
                return;
            }

            // ✅ NORMAL CASE: Mix personalized + rotation
            const cappedPersonalized = personalizedItems.slice(0, MAX_PERSONALIZED);
            const overflowPersonalized = personalizedItems.slice(MAX_PERSONALIZED);

            const mixed = [];
            let pIdx = 0;
            let rIdx = 0;
            let consecutiveP = 0;

            while (pIdx < cappedPersonalized.length || rIdx < rotationItems.length) {
                const takePersonalized =
                    pIdx < cappedPersonalized.length &&
                    consecutiveP < 2 &&
                    (mixed.length === 0 || consecutiveP < 1 || Math.random() < 0.7);

                if (takePersonalized) {
                    mixed.push(cappedPersonalized[pIdx++]);
                    consecutiveP++;
                } else if (rIdx < rotationItems.length) {
                    mixed.push(rotationItems[rIdx++]);
                    consecutiveP = 0;
                } else if (pIdx < cappedPersonalized.length) {
                    mixed.push(cappedPersonalized[pIdx++]);
                    consecutiveP++;
                } else {
                    break;
                }
            }

            mixed.push(...overflowPersonalized);

            setDeals(mixed);
            setLoadedCount(Math.min(visibleDealCount, mixed.length));
            setLastRefresh(new Date());
            syncRefreshTimer(mixed);

            const personalizedCount = mixed.filter(d => d.is_personalized).length;
            console.log(
                `✅ Loaded ${mixed.length} deals ` +
                `(${personalizedCount} personalized, ${mixed.length - personalizedCount} rotation, ` +
                `cap=${MAX_PERSONALIZED})`
            );

        } catch (error) {
            console.error('❌ Error loading daily deals:', error);
            setDeals([]);
            setLoading(false);
            setImagesLoading(false);
        } finally {
            setLoading(false);
        }
    }, [userId, visibleDealCount]);

    // Check product count
    const checkProductsInDatabase = async () => {
        try {
            const { count, error } = await fetchWithRetry(() => supabase
                .from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'));
            if (error) {
                setProductCheck({ error: error.message, count: 0 });
                return;
            }
            setProductCheck({ success: true, count: count || 0 });
        } catch (err) {
            setProductCheck({ error: err.message, count: 0 });
        }
    };

    const viewProductDetails = async (deal) => {
        setSelectedDeal(deal);
        setLoadingSeller(true);
        setShowModal(true);
        try {
            const { data: sellerData, error } = await fetchWithRetry(() => supabase
                .from('profiles').select('*').eq('user_id', deal.product.seller_id).maybeSingle());
            if (!error && sellerData) setSellerDetails(sellerData);
            await fetchWithRetry(() => supabase
                .from('products').update({ views: (deal.product.views || 0) + 1 }).eq('id', deal.product_id));
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

    // ✅ Auto refresh countdown — ONLY updates the "Next refresh" number (no image re-render)
    useEffect(() => {
        if (nextRefreshIn === null) return;
        if (nextRefreshIn <= 0) {
            loadDailyDeals();
            return;
        }
        const timer = setTimeout(() => {
            setNextRefreshIn(prev => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [nextRefreshIn, loadDailyDeals]);

    // Initial load + 10-min refresh interval
    useEffect(() => {
        loadDailyDeals();
        refreshIntervalRef.current = setInterval(() => {
            loadDailyDeals();
        }, DEAL_DURATION_MINUTES * 60 * 1000);
        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = null;
            }
        };
    }, [loadDailyDeals, DEAL_DURATION_MINUTES]);

    // Responsive resize
    useEffect(() => {
        const handleResize = () => {
            const newCount = getResponsiveDealCount();
            setVisibleDealCount(newCount);
            setLoadedCount(Math.min(newCount, deals.length));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [deals.length]);

    // Product check
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (loading) setLoading(false);
        }, 5000);
        checkProductsInDatabase();
        return () => clearTimeout(timeout);
    }, []);

    const claimDeal = async (deal) => {
        if (!userId) {
            if (onClaimDeal) onClaimDeal(deal);
            return;
        }
        if (deal.sold_count >= deal.max_quantity) return;

        setClaiming(prev => ({ ...prev, [deal.id]: true }));

        try {
            const { data: currentUser } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
            const { data: seller } = await supabase.from('profiles').select('*').eq('user_id', deal.product.seller_id).maybeSingle();

            const isBuyer = currentUser?.is_buyer === true;
            const isSeller = currentUser?.is_seller === true;

            if (isBuyer) {
                await supabase.from('claimed_deals').insert({
                    user_id: userId,
                    deal_id: deal.product_id,
                    deal_name: deal.product?.name,
                    deal_price: deal.product?.price,
                    deal_image: deal.product?.image_url,
                    seller_id: deal.product.seller_id,
                    seller_name: seller?.username || 'Seller',
                    seller_phone: seller?.phone_number || deal.product?.phone_number,
                    claimed_at: new Date().toISOString(),
                    status: 'pending'
                });

                await supabase.from('notifications').insert({
                    user_id: deal.product.seller_id,
                    sender_id: userId,
                    message: `🎉 A buyer claimed your daily deal: "${deal.product?.name}"!`,
                    link_type: 'deal_claimed',
                    buyer_phone: currentUser?.phone_number || 'No phone provided',
                    product_image: deal.product?.image_url,
                    is_read: false,
                    created_at: new Date().toISOString()
                });

                setDeals(prev => prev.map(d =>
                    d.id === deal.id ? { ...d, sold_count: d.sold_count + 1 } : d
                ));

                if (onClaimDeal) onClaimDeal(deal);
            } else if (isSeller && deal.product.seller_id === userId) {
                const { data: buyers } = await supabase.from('claimed_deals')
                    .select(`*, buyer:user_id (user_id, username, phone_number)`)
                    .eq('deal_id', deal.product_id).eq('status', 'pending');

                if (!buyers || buyers.length === 0) {
                    window.alert('No buyers have claimed this deal yet.');
                    return;
                }

                // Show list + ask which number to contact
                const buyerList = buyers.map((b, i) =>
                    `${i + 1}. ${b.buyer?.username || 'Anonymous'}\n   📱 ${b.buyer?.phone_number || 'No phone'}`
                ).join('\n\n');

                const input = window.prompt(
                    `📋 Buyers who claimed "${deal.product?.name}":\n\n${buyerList}\n\n` +
                    `Enter a number (1–${buyers.length}) to WhatsApp them,\n` +
                    `or leave blank to cancel:`,
                    '1'
                );

                const pickedIndex = parseInt(input, 10) - 1;
                if (isNaN(pickedIndex) || pickedIndex < 0 || pickedIndex >= buyers.length) {
                    return;
                }

                const picked = buyers[pickedIndex];
                if (!picked?.buyer?.phone_number) {
                    window.alert('That buyer has no phone number.');
                    return;
                }

                const clean = picked.buyer.phone_number.replace(/\D/g, '');
                const finalNum = clean.startsWith('263') ? clean : `263${clean.replace(/^0/, '')}`;
                const msg = encodeURIComponent(
                    `Hi ${picked.buyer.username || ''}! I saw you claimed my deal "${deal.product?.name}". Are you still interested?`
                );
                window.open(`https://wa.me/${finalNum}?text=${msg}`, '_blank');

                await supabase.from('claimed_deals').update({ status: 'contacted' }).eq('id', picked.id);
            }

            // Seller contact
            if (seller?.phone_number && !isSeller) {
                const showContact = window.confirm(`📱 Contact Seller?\n\nName: ${seller?.username || 'Seller'}\nPhone: ${seller?.phone_number}\n\nClick OK to WhatsApp them.`);
                if (showContact) {
                    const clean = seller.phone_number.replace(/\D/g, '');
                    const finalNum = clean.startsWith('263') ? clean : `263${clean.replace(/^0/, '')}`;
                    const msg = encodeURIComponent(`Hi! I'm interested in your deal: "${deal.product?.name}"`);
                    window.open(`https://wa.me/${finalNum}?text=${msg}`, '_blank');
                }
            }
        } catch (error) {
            console.error('❌ Error claiming deal:', error);
        } finally {
            setClaiming(prev => ({ ...prev, [deal.id]: false }));
        }
    };

    const loadMoreDeals = () => {
        const nextCount = Math.min(loadedCount + 6, deals.length);
        setIsLoadingMore(true);
        deals.slice(loadedCount, nextCount).forEach(deal => {
            if (deal.product?.image_url) {
                const img = new Image();
                img.src = getOptimizedImageUrl(deal.product.image_url, 200, 150);
            }
        });
        setLoadedCount(nextCount);
        setTimeout(() => setIsLoadingMore(false), 300);
    };

    const handleManualRefresh = () => {
        if (window.confirm('Refresh deals now? New deals will appear.')) {
            setLoadedCount(visibleDealCount);
            loadDailyDeals();
        }
    };

    // Render
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
                <p>Check back soon — new deals every 10 minutes.</p>
                <button onClick={handleManualRefresh} style={styles.refreshButton}>🔄 Refresh Now</button>
            </div>
        );
    }

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
                                : 'Limited time offers — new deals every 10 minutes!'}
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
                        <RefreshTimer nextRefreshIn={nextRefreshIn} />
                        <button onClick={handleManualRefresh} style={styles.manualRefreshIcon} title="Refresh deals">
                            🔄
                        </button>
                    </div>
                </div>

                <div style={styles.dealsGrid}>
                    {visibleDeals.map(deal => (
                        <DealCard
                            key={deal.id}
                            deal={deal}
                            isSoldOut={deal.sold_count >= deal.max_quantity}
                            isClaiming={claiming[deal.id]}
                            onView={viewProductDetails}
                            onClaim={claimDeal}
                        />
                    ))}
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
                            : '🎲 New random deals appear every 10 minutes!'}
                        <br />
                        <small>Top sellers with more referrals get priority placement</small>
                    </p>
                </div>
            </div>

            {/* Modal */}
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
                                    <ProductImage product={selectedDeal.product} style={styles.modalImage} />
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
                                                <div style={styles.avatarPlaceholder}>
                                                    {sellerDetails?.username?.charAt(0) || selectedDeal.seller_name?.charAt(0) || 'S'}
                                                </div>
                                            </div>
                                            <div style={styles.sellerDetails}>
                                                <p><strong>Name:</strong> {sellerDetails?.username || selectedDeal.seller_name || 'Unknown Seller'}</p>
                                                <p><strong>Location:</strong> 📍 {sellerDetails?.location || selectedDeal.product?.location || 'Unknown'}</p>
                                                <p>
                                                    <strong>Rating:</strong>{' '}
                                                    {sellerDetails?.rating
                                                        ? <>⭐ {Number(sellerDetails.rating).toFixed(1)}/5</>
                                                        : '⭐ New Seller'}
                                                </p>
                                                <p>
                                                    <strong>Referrals:</strong> 🎁 {selectedDeal.seller_referral_count || 0} successful
                                                    {selectedDeal.seller_referral_points > 0 && (
                                                        <> · {selectedDeal.seller_referral_points} pts</>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={styles.modalSection}>
                                        <h4>📊 Deal Details</h4>
                                        <ul style={styles.dealDetailsList}>
                                            <li>🔥 Limited stock: {selectedDeal.max_quantity - selectedDeal.sold_count} left</li>
                                            <li>📅 Listed on: {new Date(selectedDeal.product?.created_at).toLocaleDateString()}</li>
                                            {selectedDeal.is_personalized && <li>🎯 Personalized for you</li>}
                                            {selectedDeal.seller_referral_count > 0 && (
                                                <li>🏆 Top Seller ({selectedDeal.seller_referral_count} referrals)</li>
                                            )}
                                        </ul>
                                    </div>

                                    <button
                                        onClick={() => { closeModal(); claimDeal(selectedDeal); }}
                                        disabled={claiming[selectedDeal.id] || selectedDeal.sold_count >= selectedDeal.max_quantity}
                                        style={{
                                            ...styles.modalClaimButton,
                                            background: selectedDeal.sold_count >= selectedDeal.max_quantity
                                                ? '#f44336'
                                                : 'linear-gradient(135deg, #667eea, #764ba2)'
                                        }}
                                    >
                                        {claiming[selectedDeal.id] ? 'Claiming...' :
                                         selectedDeal.sold_count >= selectedDeal.max_quantity ? 'Sold Out' :
                                         '🔥 Claim Now'}
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

// ============================================
// STYLES
// ============================================
const styles = {
    container: { background: 'linear-gradient(135deg, #667eea15, #764ba215)', borderRadius: '16px', padding: '20px', margin: '20px 0' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' },
    headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
    title: { fontSize: '24px', margin: '0 0 5px 0', background: 'linear-gradient(135deg, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    subtitle: { fontSize: '13px', color: '#b0b0b0', margin: 0 },
    refreshTimer: { background: '#2a2a2a', padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', color: '#FF9800' },
    manualRefreshIcon: { background: '#2a2a2a', border: '1px solid #444', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
    dealsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', maxHeight: '70vh', overflowY: 'auto', padding: '5px' },
    dealCard: { background: '#2d2d2d', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', position: 'relative', cursor: 'pointer', border: '1px solid #404040' },
    soldOutBadge: { position: 'absolute', top: '10px', right: '10px', background: '#f44336', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', zIndex: 2 },
    dealImage: { width: '100%', height: '180px', objectFit: 'cover' },
    dealContent: { padding: '15px' },
    dealName: { margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    dealInfo: { fontSize: '13px', color: '#b0b0b0', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' },
    location: { display: 'flex', alignItems: 'center', gap: '4px' },
    seller: { display: 'flex', alignItems: 'center', gap: '4px' },
    stock: { display: 'flex', alignItems: 'center', gap: '4px', color: '#FF9800' },
    timer: { background: '#1a1a1a', padding: '8px', borderRadius: '8px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', color: '#FF9800', marginBottom: '10px' },
    claimButton: { width: '100%', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' },
    loadingContainer: { textAlign: 'center', padding: '40px', color: '#fff' },
    spinner: { width: '40px', height: '40px', border: '3px solid #444', borderTop: '3px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 15px' },
    emptyContainer: { textAlign: 'center', padding: '60px 20px', background: '#2d2d2d', borderRadius: '12px', color: '#fff' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px' },
    refreshButton: { marginTop: '15px', padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
    loadMoreContainer: { textAlign: 'center', marginTop: '20px' },
    loadMoreButton: { background: '#2a2a2a', border: '1px solid #667eea', color: '#667eea', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
    footer: { textAlign: 'center', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #404040' },
    footerText: { fontSize: '12px', color: '#888', margin: 0 },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px', overflow: 'auto' },
    modalContent: { background: '#2d2d2d', borderRadius: '16px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto', position: 'relative', border: '1px solid #404040' },
    modalClose: { position: 'absolute', top: '15px', right: '15px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    modalImageContainer: { width: '100%', height: '250px', overflow: 'hidden' },
    modalImage: { width: '100%', height: '100%', objectFit: 'cover' },
    modalBody: { padding: '24px' },
    modalTitle: { fontSize: '24px', margin: '0 0 15px 0', color: '#ffffff' },
    modalSection: { marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #404040' },
    sellerInfo: { display: 'flex', gap: '15px', marginTop: '10px' },
    sellerAvatar: { flexShrink: 0 },
    avatarPlaceholder: { width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', color: 'white' },
    sellerDetails: { flex: 1, color: '#e0e0e0' },
    dealDetailsList: { margin: '10px 0 0 20px', color: '#b0b0b0' },
    modalClaimButton: { width: '100%', padding: '14px', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginTop: '10px' },
    modalLoading: { textAlign: 'center', padding: '60px', color: '#fff' },
    spinnerSmall: { width: '30px', height: '30px', border: '3px solid #444', borderTop: '3px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 15px' }
};

// Keyframes
if (!document.getElementById('daily-deals-styles')) {
    const s = document.createElement("style");
    s.id = 'daily-deals-styles';
    s.textContent = `
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(s);
}

export default React.memo(DailyDeals);
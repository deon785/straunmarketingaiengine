import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import DailyDeals from './DailyDeals';
import ReferralProgram from './ReferralProgram';
import ChatList from './ChatList';
import PriceAlertDashboard from './PriceAlertDashboard';
import WishlistManager from './WishlistManager';

const UserDashboard = ({ userId, userName, userEmail, selectedMode, onBackToSocial }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState({
        profileViews: 0,
        productViews: 0,
        saves: 0,
        messages: 0,
        unreadMessages: 0,
        rating: 0,
        totalSales: 0,
        totalPurchases: 0,
        totalSaved: 0,
        // Buyer-specific stats
        wishlistCount: 0,
        orderCount: 0,
        totalSpent: 0,
        activeAlerts: 0,
        savedSearchesCount: 0
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [userReferralCount, setUserReferralCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [orderHistory, setOrderHistory] = useState([]);
    const [savedSearches, setSavedSearches] = useState([]);
    const [wishlistItems, setWishlistItems] = useState([]);
    const [priceAlerts, setPriceAlerts] = useState([]);
    
    // State for modals/children
    const [selectedChat, setSelectedChat] = useState(null);
    const [showChatList, setShowChatList] = useState(false);
    const [showWishlistModal, setShowWishlistModal] = useState(false);

    // Handle browser back button
    useEffect(() => {
        const handlePopState = (event) => {
            if (location.pathname === '/dashboard') {
                window.history.pushState(null, '', '/dashboard');
            }
        };

        window.history.pushState({ dashboard: true }, '', '/dashboard');
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [location.pathname]);

    useEffect(() => {
        loadDashboardData();
    }, [userId, selectedMode]);

    const loadDashboardData = async () => {
        setLoading(true);
        
        try {
            // Get user's referral count
            const { data: referrals } = await supabase
                .from('referrals')
                .select('id')
                .eq('referrer_id', userId)
                .eq('status', 'completed');
            
            setUserReferralCount(referrals?.length || 0);

            // Get stats based on mode
            if (selectedMode === 'seller') {
                const { data: products } = await supabase
                    .from('products')
                    .select('views, price, sold')
                    .eq('seller_id', userId);
                
                const { data: messages } = await supabase
                    .from('messages')
                    .select('id, is_read')
                    .eq('receiver_id', userId);
                
                const { data: ratings } = await supabase
                    .from('ratings')
                    .select('score')
                    .eq('rated_user_id', userId);
                
                const { data: productSaves } = await supabase
                    .from('saved_items')
                    .select('product_id')
                    .in('product_id', products?.map(p => p.id) || []);
                
                const avgRating = ratings?.length > 0 
                    ? (ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length).toFixed(1)
                    : '0';
                
                setStats({
                    profileViews: products?.reduce((sum, p) => sum + (p.views || 0), 0) || 0,
                    productViews: products?.length || 0,
                    saves: productSaves?.length || 0,
                    messages: messages?.length || 0,
                    unreadMessages: messages?.filter(m => !m.is_read).length || 0,
                    rating: avgRating,
                    totalSales: products?.filter(p => p.sold)?.length || 0,
                    totalPurchases: 0,
                    totalSaved: 0,
                    wishlistCount: 0,
                    orderCount: 0,
                    totalSpent: 0,
                    activeAlerts: 0,
                    savedSearchesCount: 0
                });
            } else {
                // BUYER MODE STATS
                // 1. Get wishlist count
                const { count: wishlistCount } = await supabase
                    .from('saved_items')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId);
                
                // 2. Get wishlist items for total value
                const { data: savedItems } = await supabase
                    .from('saved_items')
                    .select('product_price')
                    .eq('user_id', userId);
                
                const totalSaved = savedItems?.reduce((sum, item) => sum + (item.product_price || 0), 0) || 0;
                
                // 3. Get order history (if orders table exists)
                let orderCount = 0;
                let totalSpent = 0;
                let ordersData = [];
                try {
                    const { data: orders, error: ordersError } = await supabase
                        .from('orders')
                        .select('*, products(name, price)')
                        .eq('buyer_id', userId)
                        .order('created_at', { ascending: false });
                    
                    if (!ordersError && orders) {
                        ordersData = orders;
                        orderCount = orders.length;
                        totalSpent = orders.reduce((sum, order) => sum + (order.total_price || order.product_price || 0), 0);
                        setOrderHistory(orders);
                    }
                } catch (e) {
                    console.log('Orders table may not exist yet');
                }
                
                // 4. Get active price alerts
                let activeAlerts = 0;
                let alertsData = [];
                try {
                    const { data: alerts, error: alertsError } = await supabase
                        .from('price_alerts')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('is_active', true);
                    
                    if (!alertsError && alerts) {
                        alertsData = alerts;
                        activeAlerts = alerts.length;
                        setPriceAlerts(alerts);
                    }
                } catch (e) {
                    console.log('Price alerts table may not exist yet');
                }
                
                // 5. Get saved searches
                let savedSearchesCount = 0;
                let searchesData = [];
                try {
                    const { data: searches, error: searchesError } = await supabase
                        .from('saved_searches')
                        .select('*')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false });
                    
                    if (!searchesError && searches) {
                        searchesData = searches;
                        savedSearchesCount = searches.length;
                        setSavedSearches(searches);
                    }
                } catch (e) {
                    console.log('Saved searches table may not exist yet');
                }
                
                setStats({
                    profileViews: 0,
                    productViews: 0,
                    saves: savedItems?.length || 0,
                    messages: 0,
                    unreadMessages: 0,
                    rating: 0,
                    totalSales: 0,
                    totalPurchases: orderCount,
                    totalSaved: totalSaved,
                    wishlistCount: wishlistCount || 0,
                    orderCount: orderCount,
                    totalSpent: totalSpent,
                    activeAlerts: activeAlerts,
                    savedSearchesCount: savedSearchesCount
                });
                
                setWishlistItems(savedItems || []);
            }

            // Get recent activity - MODIFIED for buyer
            const { data: activities } = await supabase
                .from('user_activities')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (!activities || activities.length === 0) {
                const sampleActivities = [];
                
                if (selectedMode === 'seller') {
                    const { data: productViews } = await supabase
                        .from('products')
                        .select('name, views, updated_at')
                        .eq('seller_id', userId)
                        .order('updated_at', { ascending: false })
                        .limit(3);
                    
                    productViews?.forEach(product => {
                        if (product.views > 0) {
                            sampleActivities.push({
                                id: `view-${Date.now()}`,
                                activity_type: 'view',
                                message: `Someone viewed your "${product.name}" listing`,
                                created_at: product.updated_at || new Date().toISOString()
                            });
                        }
                    });
                } else {
                    // Buyer sample activities
                    const { data: savedItems } = await supabase
                        .from('saved_items')
                        .select('product_name')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(3);
                    
                    savedItems?.forEach(item => {
                        sampleActivities.push({
                            id: `save-${Date.now()}`,
                            activity_type: 'save',
                            message: `You saved "${item.product_name || 'a product'}" to your wishlist`,
                            created_at: new Date().toISOString()
                        });
                    });
                    
                    if (savedItems?.length === 0) {
                        sampleActivities.push({
                            id: 'welcome-1',
                            activity_type: 'welcome',
                            message: 'Welcome to Straun Marketing! Start searching for products you love.',
                            created_at: new Date().toISOString()
                        });
                    }
                }
                
                setRecentActivity(sampleActivities);
            } else {
                setRecentActivity(activities);
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const handleBack = () => {
        if (selectedChat) {
            setSelectedChat(null);
            setShowChatList(true);
        } else if (showChatList) {
            setShowChatList(false);
            setActiveTab('overview');
        } else if (showWishlistModal) {
            setShowWishlistModal(false);
            setActiveTab('overview');
        } else if (activeTab !== 'overview') {
            setActiveTab('overview');
        } else {
            if (onBackToSocial) {
                onBackToSocial();
            } else {
                navigate('/app');
            }
        }
    };

    // Delete saved search
    const deleteSavedSearch = async (searchId) => {
        const { error } = await supabase
            .from('saved_searches')
            .delete()
            .eq('id', searchId);
        
        if (!error) {
            setSavedSearches(savedSearches.filter(s => s.id !== searchId));
            setStats(prev => ({ ...prev, savedSearchesCount: prev.savedSearchesCount - 1 }));
        }
    };

    // Re-run a saved search
    const runSavedSearch = (searchTerm) => {
        if (onBackToSocial) {
            onBackToSocial();
            // Pass search term back to social page
            setTimeout(() => {
                window.location.href = `/app?q=${encodeURIComponent(searchTerm)}`;
            }, 100);
        }
    };

    if (selectedChat) {
        return (
            <div style={styles.chatContainer}>
                <div style={styles.chatHeader}>
                    <button onClick={() => setSelectedChat(null)} style={styles.backButton}>
                        ← Back
                    </button>
                    <h3>Chat with {selectedChat.otherUser?.username || 'User'}</h3>
                </div>
                <div style={styles.placeholderChat}>
                    <p>Chat component would go here</p>
                    <button onClick={() => setSelectedChat(null)}>Close Chat</button>
                </div>
            </div>
        );
    }

    if (showChatList) {
        return (
            <div style={styles.chatContainer}>
                <div style={styles.chatHeader}>
                    <button onClick={() => setShowChatList(false)} style={styles.backButton}>
                        ← Back to Dashboard
                    </button>
                    <h3>Messages</h3>
                </div>
                <ChatList 
                    userId={userId}
                    onSelectChat={(chat) => {
                        setSelectedChat(chat);
                        setShowChatList(false);
                    }}
                    onClose={() => setShowChatList(false)}
                />
            </div>
        );
    }

    // Wishlist Modal View
    if (showWishlistModal) {
        return (
            <div style={styles.wishlistFullscreen}>
                <div style={styles.wishlistHeader}>
                    <button onClick={() => setShowWishlistModal(false)} style={styles.backButton}>
                        ← Back to Dashboard
                    </button>
                    <h3>❤️ My Wishlist ({stats.wishlistCount} items)</h3>
                </div>
                <WishlistManager onBack={() => setShowWishlistModal(false)} />
            </div>
        );
    }

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {activeTab !== 'overview' && (
                <button onClick={handleBack} style={styles.backButtonTop}>
                    ← Back to Overview
                </button>
            )}

            <div style={styles.welcomeHeader}>
                <div>
                    <h2 style={styles.greeting}>{getGreeting()}, {userName?.split('@')[0] || 'User'}! 👋</h2>
                    <p style={styles.welcomeText}>
                        Welcome back to your {selectedMode === 'seller' ? 'seller' : 'buyer'} dashboard
                    </p>
                </div>
                <div style={styles.referralBadge}>
                    🎁 {userReferralCount} Referrals
                </div>
            </div>

            {/* Tab Navigation - Updated for Buyer */}
            <div style={styles.tabNav}>
                <button onClick={() => setActiveTab('overview')} style={{...styles.tabButton, background: activeTab === 'overview' ? 'var(--primary-color)' : 'var(--light-bg)', color: activeTab === 'overview' ? 'white' : 'var(--text-secondary)'}}>📊 Overview</button>
                <button onClick={() => setActiveTab('deals')} style={{...styles.tabButton, background: activeTab === 'deals' ? 'var(--primary-color)' : 'var(--light-bg)', color: activeTab === 'deals' ? 'white' : 'var(--text-secondary)'}}>🔥 Daily Deals</button>
                <button onClick={() => setActiveTab('wishlist')} style={{...styles.tabButton, background: activeTab === 'wishlist' ? 'var(--primary-color)' : 'var(--light-bg)', color: activeTab === 'wishlist' ? 'white' : 'var(--text-secondary)'}}>❤️ Wishlist ({stats.wishlistCount})</button>
                {selectedMode === 'buyer' && (
                    <button onClick={() => setActiveTab('orders')} style={{...styles.tabButton, background: activeTab === 'orders' ? 'var(--primary-color)' : 'var(--light-bg)', color: activeTab === 'orders' ? 'white' : 'var(--text-secondary)'}}>📦 Orders ({stats.orderCount})</button>
                )}
                {selectedMode === 'buyer' && (
                    <button onClick={() => setActiveTab('searches')} style={{...styles.tabButton, background: activeTab === 'searches' ? 'var(--primary-color)' : 'var(--light-bg)', color: activeTab === 'searches' ? 'white' : 'var(--text-secondary)'}}>🔍 Saved Searches ({stats.savedSearchesCount})</button>
                )}
                <button onClick={() => setActiveTab('referrals')} style={{...styles.tabButton, background: activeTab === 'referrals' ? 'var(--primary-color)' : 'var(--light-bg)', color: activeTab === 'referrals' ? 'white' : 'var(--text-secondary)'}}>👥 Referrals</button>
                <button onClick={() => { setShowChatList(true); setActiveTab('messages'); }} style={{...styles.tabButton, background: activeTab === 'messages' ? 'var(--primary-color)' : 'var(--light-bg)', color: activeTab === 'messages' ? 'white' : 'var(--text-secondary)'}}>💬 Messages</button>
                <button onClick={() => setActiveTab('alerts')} style={{...styles.tabButton, background: activeTab === 'alerts' ? 'var(--primary-color)' : 'var(--light-bg)', color: activeTab === 'alerts' ? 'white' : 'var(--text-secondary)'}}>🔔 Price Alerts ({stats.activeAlerts})</button>
            </div>

            {/* Tab Content */}
            <div style={styles.tabContent}>
                {activeTab === 'overview' && (
                    <div>
                        <div style={styles.statsGrid}>
                            {selectedMode === 'seller' ? (
                                <>
                                    <StatCard icon="👀" label="Profile Views" value={stats.profileViews} />
                                    <StatCard icon="❤️" label="Product Saves" value={stats.saves} />
                                    <StatCard icon="💬" label="Messages" value={stats.messages} badge={stats.unreadMessages} />
                                    <StatCard icon="⭐" label="Rating" value={stats.rating} />
                                    <StatCard icon="💰" label="Total Sales" value={stats.totalSales} />
                                </>
                            ) : (
                                <>
                                    <StatCard icon="❤️" label="Wishlist" value={stats.wishlistCount} />
                                    <StatCard icon="📦" label="Orders" value={stats.orderCount} />
                                    <StatCard icon="💰" label="Total Spent" value={`$${stats.totalSpent.toFixed(2)}`} />
                                    <StatCard icon="🔔" label="Price Alerts" value={stats.activeAlerts} />
                                    <StatCard icon="🎯" label="Saved Searches" value={stats.savedSearchesCount} />
                                    <StatCard icon="💎" label="Wishlist Value" value={`$${stats.totalSaved.toFixed(2)}`} />
                                </>
                            )}
                        </div>

                        <div style={styles.activitySection}>
                            <h4 style={styles.sectionTitle}>📋 Recent Activity</h4>
                            {recentActivity.length === 0 ? (
                                <p style={styles.noActivity}>No recent activity yet. Start searching for products!</p>
                            ) : (
                                <div style={styles.activityList}>
                                    {recentActivity.map((activity, index) => (
                                        <div key={activity.id || index} style={styles.activityItem}>
                                            <span style={styles.activityIcon}>
                                                {activity.activity_type === 'search' || activity.activity_type === 'view' ? '👀' :
                                                 activity.activity_type === 'save' ? '❤️' :
                                                 activity.activity_type === 'contact' ? '💬' : 
                                                 activity.activity_type === 'welcome' ? '👋' : '📊'}
                                            </span>
                                            <div style={styles.activityDetails}>
                                                <div style={styles.activityMessage}>
                                                    {activity.message || (
                                                        activity.activity_type === 'search' ? `Searched for "${activity.metadata?.searchTerm}"` :
                                                        activity.activity_type === 'view' ? `Someone viewed your listing` :
                                                        activity.activity_type === 'save' ? `You saved an item` :
                                                        `Activity recorded`
                                                    )}
                                                </div>
                                                <div style={styles.activityTime}>
                                                    {new Date(activity.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={styles.tipsSection}>
                            <h4 style={styles.sectionTitle}>💡 Quick Tips</h4>
                            <div style={styles.tipsList}>
                                {selectedMode === 'seller' ? (
                                    <>
                                        <div style={styles.tipItem}>✨ Add clear photos to increase views by 200%</div>
                                        <div style={styles.tipItem}>⚡ Respond to messages within 5 minutes for best results</div>
                                        <div style={styles.tipItem}>🎯 Share your referral link to earn rewards</div>
                                        <div style={styles.tipItem}>🔥 Check Daily Deals for limited-time offers</div>
                                    </>
                                ) : (
                                    <>
                                        <div style={styles.tipItem}>❤️ Save products to your wishlist to track price drops</div>
                                        <div style={styles.tipItem}>🔔 Set price alerts to get notified when items go on sale</div>
                                        <div style={styles.tipItem}>🔍 Save your favorite searches for quick access</div>
                                        <div style={styles.tipItem}>🎯 Share your referral link to earn bonus points</div>
                                        <div style={styles.tipItem}>🔥 Check Daily Deals for limited-time discounts</div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'wishlist' && (
                    <div style={styles.wishlistContainer}>
                        <div style={styles.wishlistHeader}>
                            <h3>❤️ My Wishlist</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                {stats.wishlistCount} saved {stats.wishlistCount === 1 ? 'item' : 'items'} · Total value: ${stats.totalSaved.toFixed(2)}
                            </p>
                        </div>
                        <WishlistManager onBack={() => setActiveTab('overview')} />
                    </div>
                )}

                <WishlistManager 
                onBack={() => setShowWishlistModal(false)}
                onBackToSearch={onBackToSocial}  // Optional separate handler
                />

                {activeTab === 'orders' && selectedMode === 'buyer' && (
                    <div style={styles.ordersSection}>
                        <h3>📦 Order History</h3>
                        {orderHistory.length === 0 ? (
                            <div style={styles.emptyState}>
                                <div style={{ fontSize: '48px', marginBottom: '10px' }}>📦</div>
                                <h4>No orders yet</h4>
                                <p>When you purchase items, they'll appear here.</p>
                                <button onClick={() => { if(onBackToSocial) onBackToSocial(); }} style={styles.emptyStateButton}>
                                    Start Shopping
                                </button>
                            </div>
                        ) : (
                            <div style={styles.ordersList}>
                                {orderHistory.map((order) => (
                                    <div key={order.id} style={styles.orderCard}>
                                        <div style={styles.orderHeader}>
                                            <span style={styles.orderId}>Order #{order.id?.slice(0, 8)}</span>
                                            <span style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div style={styles.orderDetails}>
                                            <div style={styles.orderProduct}>
                                                <strong>{order.products?.name || 'Product'}</strong>
                                                <span>Quantity: {order.quantity || 1}</span>
                                            </div>
                                            <div style={styles.orderTotal}>
                                                ${order.total_price || order.product_price || 0}
                                            </div>
                                        </div>
                                        <div style={styles.orderStatus}>
                                            <span className={`status-${order.status || 'pending'}`}>
                                                {order.status || 'Pending'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'searches' && selectedMode === 'buyer' && (
                    <div style={styles.searchesSection}>
                        <h3>🔍 Saved Searches</h3>
                        {savedSearches.length === 0 ? (
                            <div style={styles.emptyState}>
                                <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔍</div>
                                <h4>No saved searches yet</h4>
                                <p>Save your favorite searches to quickly find products you love.</p>
                                <button onClick={() => { if(onBackToSocial) onBackToSocial(); }} style={styles.emptyStateButton}>
                                    Go Search
                                </button>
                            </div>
                        ) : (
                            <div style={styles.searchesList}>
                                {savedSearches.map((search) => (
                                    <div key={search.id} style={styles.searchCard}>
                                        <div style={styles.searchInfo}>
                                            <div style={styles.searchTerm}>
                                                <span style={{ fontSize: '20px' }}>🔍</span>
                                                <strong>"{search.search_term}"</strong>
                                            </div>
                                            {search.min_price || search.max_price ? (
                                                <div style={styles.searchFilters}>
                                                    {search.min_price && <span>Min: ${search.min_price}</span>}
                                                    {search.max_price && <span>Max: ${search.max_price}</span>}
                                                    {search.location && <span>📍 {search.location}</span>}
                                                </div>
                                            ) : null}
                                            <div style={styles.searchMeta}>
                                                Saved on {new Date(search.created_at).toLocaleDateString()}
                                                {search.last_notified_at && (
                                                    <span> · Last notified: {new Date(search.last_notified_at).toLocaleDateString()}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div style={styles.searchActions}>
                                            <button onClick={() => runSavedSearch(search.search_term)} style={styles.runSearchBtn}>
                                                🔍 Run Search
                                            </button>
                                            <button onClick={() => deleteSavedSearch(search.id)} style={styles.deleteSearchBtn}>
                                                🗑️ Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'deals' && (
                    <DailyDeals 
                        userId={userId}
                        userReferralCount={userReferralCount}
                        onClaimDeal={(deal) => {
                            loadDashboardData();
                        }}
                    />
                )}

                {activeTab === 'referrals' && (
                    <ReferralProgram 
                        userId={userId}
                        userName={userName}
                        onReferralComplete={() => {
                            loadDashboardData();
                        }}
                    />
                )}

                {activeTab === 'alerts' && (
                    <PriceAlertDashboard userId={userId} />
                )}
            </div>
        </div>
    );
};

const StatCard = ({ icon, label, value, badge }) => (
    <div style={styles.statCard}>
        <div style={styles.statIcon}>{icon}</div>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statLabel}>
            {label}
            {badge > 0 && <span style={styles.statBadge}>{badge}</span>}
        </div>
    </div>
);

const styles = {
    container: {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px'
    },
    backButtonTop: {
        background: 'var(--light-bg)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-primary)',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        marginBottom: '15px',
        fontSize: '14px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px'
    },
    chatContainer: {
        maxWidth: '800px',
        margin: '0 auto',
        padding: '20px'
    },
    chatHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '1px solid var(--border-color)'
    },
    backButton: {
        background: 'var(--light-bg)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-primary)',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px'
    },
    placeholderChat: {
        textAlign: 'center',
        padding: '40px',
        background: 'var(--card-bg)',
        borderRadius: '12px'
    },
    welcomeHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '25px',
        flexWrap: 'wrap',
        gap: '15px'
    },
    greeting: {
        fontSize: '24px',
        margin: '0 0 5px 0',
        color: 'var(--text-primary)'
    },
    welcomeText: {
        color: 'var(--text-secondary)',
        margin: 0
    },
    referralBadge: {
        background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '20px',
        fontWeight: 'bold',
        fontSize: '14px'
    },
    tabNav: {
        display: 'flex',
        gap: '10px',
        marginBottom: '25px',
        flexWrap: 'wrap',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '10px'
    },
    tabButton: {
        padding: '8px 16px',
        border: 'none',
        borderRadius: '20px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        transition: 'all 0.2s'
    },
    tabContent: {
        minHeight: '400px'
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '15px',
        marginBottom: '25px'
    },
    statCard: {
        background: 'var(--card-bg)',
        padding: '20px',
        borderRadius: '12px',
        textAlign: 'center',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--border-color)',
        position: 'relative'
    },
    statIcon: {
        fontSize: '32px',
        marginBottom: '10px'
    },
    statValue: {
        fontSize: '28px',
        fontWeight: 'bold',
        color: 'var(--primary-color)',
        marginBottom: '5px'
    },
    statLabel: {
        fontSize: '13px',
        color: 'var(--text-secondary)'
    },
    statBadge: {
        background: 'var(--danger-color)',
        color: 'white',
        borderRadius: '50%',
        padding: '2px 6px',
        fontSize: '10px',
        marginLeft: '5px'
    },
    activitySection: {
        background: 'var(--card-bg)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '25px',
        border: '1px solid var(--border-color)'
    },
    sectionTitle: {
        margin: '0 0 15px 0',
        fontSize: '16px',
        color: 'var(--text-primary)'
    },
    activityList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    activityItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px',
        background: 'var(--light-bg)',
        borderRadius: '8px'
    },
    activityIcon: {
        fontSize: '20px'
    },
    activityDetails: {
        flex: 1
    },
    activityMessage: {
        fontSize: '13px',
        color: 'var(--text-primary)'
    },
    activityTime: {
        fontSize: '11px',
        color: 'var(--text-light)',
        marginTop: '3px'
    },
    noActivity: {
        textAlign: 'center',
        color: 'var(--text-light)',
        padding: '20px'
    },
    tipsSection: {
        background: '#000000',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid var(--border-color)'
    },
    tipsList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },
    tipItem: {
        fontSize: '13px',
        color: '#e0e0e0',  // Light gray text
        padding: '8px 12px',
        background: '#111111',  // Slightly lighter than black for each tip
        borderRadius: '8px',
        margin: '2px 0'
    },
    loadingContainer: {
        textAlign: 'center',
        padding: '60px'
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '3px solid var(--border-color)',
        borderTop: '3px solid var(--primary-color)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 15px'
    },
    wishlistContainer: {
        background: 'var(--card-bg)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid var(--border-color)'
    },
    wishlistHeader: {
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '1px solid var(--border-color)'
    },
    wishlistFullscreen: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#121212',
        zIndex: 20000,
        overflow: 'auto',
        padding: '20px'
    },
    ordersSection: {
        background: 'var(--card-bg)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid var(--border-color)'
    },
    ordersList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        marginTop: '15px'
    },
    orderCard: {
        background: 'var(--light-bg)',
        borderRadius: '10px',
        padding: '15px',
        border: '1px solid var(--border-color)'
    },
    orderHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '10px',
        paddingBottom: '10px',
        borderBottom: '1px solid var(--border-color)'
    },
    orderId: {
        fontWeight: 'bold',
        color: 'var(--primary-color)'
    },
    orderDate: {
        fontSize: '12px',
        color: 'var(--text-light)'
    },
    orderDetails: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px'
    },
    orderProduct: {
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
    },
    orderTotal: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: 'var(--primary-color)'
    },
    orderStatus: {
        textAlign: 'right',
        fontSize: '12px'
    },
    searchesSection: {
        background: 'var(--card-bg)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid var(--border-color)'
    },
    searchesList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        marginTop: '15px'
    },
    searchCard: {
        background: 'var(--light-bg)',
        borderRadius: '10px',
        padding: '15px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '15px',
        border: '1px solid var(--border-color)'
    },
    searchInfo: {
        flex: 1
    },
    searchTerm: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '8px'
    },
    searchFilters: {
        display: 'flex',
        gap: '15px',
        fontSize: '12px',
        color: 'var(--text-light)',
        marginBottom: '5px'
    },
    searchMeta: {
        fontSize: '11px',
        color: 'var(--text-light)'
    },
    searchActions: {
        display: 'flex',
        gap: '10px'
    },
    runSearchBtn: {
        background: 'var(--primary-color)',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px'
    },
    deleteSearchBtn: {
        background: 'var(--danger-color)',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px'
    },
    emptyState: {
        textAlign: 'center',
        padding: '60px 20px',
        color: 'var(--text-secondary)'
    },
    emptyStateButton: {
        marginTop: '20px',
        padding: '10px 24px',
        background: 'var(--primary-color)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px'
    }
};

export default UserDashboard;
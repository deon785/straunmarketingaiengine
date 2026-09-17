import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import DailyDeals from './DailyDeals';
import ReferralProgram from './ReferralProgram';
import ChatList from './ChatList';
import PriceAlertDashboard from './PriceAlertDashboard';
import WishlistManager from './WishlistManager';
import { useAuthState } from './AuthContext';
import TopNavigationBar from './TopNavigationBar';

// ============================================
// DESIGN TOKENS
// ============================================
const T = {
    bg: '#0d0d10',
    cardBg: '#ffffff',
    cardText: '#09090b',
    cardMuted: '#6b7280',
    softBg: '#f3f4f6',
    softText: '#1f2937',
    softMuted: '#6b7280',
    darkSurface: '#1a1a20',
    red: '#ef4444',
    accent: '#7c3aed',
    textOnDark: '#ffffff',
    textOnDarkMuted: 'rgba(255,255,255,0.55)',
    border: 'rgba(255,255,255,0.06)',
    radius: '16px',
};

const HEXAGON_PATTERN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.01'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

// ============================================
// STAT CARD COMPONENT
// ============================================
const StatCard = ({ icon, label, value, badge, highlight, locked }) => {
    if (locked) {
        return (
            <div style={{
                background: T.darkSurface,
                border: '1.5px dashed rgba(255,255,255,0.15)',
                borderRadius: T.radius,
                padding: '32px 20px',
                textAlign: 'center',
                position: 'relative',
            }}>
                <div style={{ position: 'absolute', top: '14px', right: '14px', fontSize: '14px', opacity: 0.5 }}>🔒</div>
                <div style={{ fontSize: '32px', marginBottom: '16px' }}>{icon}</div>
                <div style={{ fontSize: '38px', fontWeight: '900', color: 'rgba(255,255,255,0.3)', letterSpacing: '-1.5px', lineHeight: 1, marginBottom: '8px' }}>
                    {value}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>{label}</div>
            </div>
        );
    }

    if (highlight) {
        return (
            <div style={{
                background: 'linear-gradient(135deg, #ffffff, #f4f0ff)',
                border: '1.5px solid #a855f7',
                borderRadius: T.radius,
                padding: '32px 20px',
                textAlign: 'center',
            }}>
                <div style={{ fontSize: '32px', marginBottom: '16px' }}>{icon}</div>
                <div style={{ fontSize: '38px', fontWeight: '900', color: '#09090b', letterSpacing: '-1.5px', lineHeight: 1, marginBottom: '8px' }}>
                    {value}
                </div>
                <div style={{ fontSize: '13px', color: T.cardMuted, fontWeight: '500' }}>{label}</div>
            </div>
        );
    }

    return (
        <div style={{
            background: T.cardBg,
            borderRadius: T.radius,
            padding: '32px 20px',
            textAlign: 'center',
            position: 'relative',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>{icon}</div>
            <div style={{ fontSize: '38px', fontWeight: '900', color: '#09090b', letterSpacing: '-1.5px', lineHeight: 1, marginBottom: '8px' }}>
                {value}
            </div>
            <div style={{ fontSize: '13px', color: T.cardMuted, fontWeight: '500' }}>
                {label}
                {badge > 0 && (
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: T.red,
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: '700',
                        minWidth: '18px',
                        height: '18px',
                        padding: '0 5px',
                        borderRadius: '10px',
                        marginLeft: '6px',
                    }}>{badge}</span>
                )}
            </div>
        </div>
    );
};

const UserDashboard = ({userId: propUserId, userName: propUserName, userEmail: propUserEmail, selectedMode, onBackToSocial, unreadNotifications = 0, onNotificationsClick}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user: authUser } = useAuthState();
    
    // ✅ Fallback: use prop OR auth context
    const userId = propUserId || authUser?.id;
    const userName = propUserName || authUser?.email?.split('@')[0] || 'User';
    const userEmail = propUserEmail || authUser?.email;
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
    
    const [selectedChat, setSelectedChat] = useState(null);
    const [showChatList, setShowChatList] = useState(false);
    const [showWishlistModal, setShowWishlistModal] = useState(false);
    
    const [searchesSubTab, setSearchesSubTab] = useState('saved');
    const [newInterest, setNewInterest] = useState('');
    const [addingInterest, setAddingInterest] = useState(false);

    const [claimedDeals, setClaimedDeals] = useState([]);
    const [showClaimedDeals, setShowClaimedDeals] = useState(false);
    const [profileData, setProfileData] = useState(null);
    const [error, setError] = useState('');

    const showToastNotification = (msg) => {
        // Simple console toast — swap for your real toast system if you have one
        console.log('[Toast]', msg);
    };

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
        // ✅ Only load when we actually have a userId
        if (userId) {
            loadDashboardData();
            loadProfileData();
        }
    }, [userId, selectedMode]);

    const loadDashboardData = async () => {
        // ✅ GUARD: Don't fire queries without a valid userId
        if (!userId || userId === 'undefined') {
            console.warn('[Dashboard] No userId — skipping data fetch');
            setLoading(false);
            return;
        }
        
        setLoading(true);
      
        try {
            const { data: referrals } = await supabase
                .from('referrals')
                .select('id')
                .eq('referrer_id', userId)
                .eq('status', 'completed');
            
            setUserReferralCount(referrals?.length || 0);

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
                const { count: wishlistCount } = await supabase
                    .from('saved_items')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId);
                
                const { data: savedItems } = await supabase
                    .from('saved_items')
                    .select('product_price')
                    .eq('user_id', userId);
                
                const totalSaved = savedItems?.reduce((sum, item) => sum + (item.product_price || 0), 0) || 0;
                
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

    const loadProfileData = async () => {
        if (!userId) return;
        try {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();
            setProfileData(data || { interests: [] });
        } catch (e) {
            console.error('[loadProfileData] Error:', e);
            setProfileData({ interests: [] });
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

    const fetchClaimedDeals = async () => {
        if (!userId) return;
        try {
            const { data, error } = await supabase
                .from('claimed_deals')
                .select('*')
                .eq('user_id', userId)
                .order('claimed_at', { ascending: false });

            if (!error) {
                setClaimedDeals(data || []);
            }
        } catch (error) {
            console.error('Error fetching claimed deals:', error);
        }
    };

    // ✅ SIMPLIFIED: Just go back to overview
    const goBack = () => {
        setActiveTab('overview');
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

     const renderTopBar = () => (
        <TopNavigationBar
            user={authUser || { email: userEmail }}
            selectedMode={selectedMode}
            profileData={profileData}
            loading={false}
            onSwitchMode={() => navigate('/app')}
            onSignOut={() => navigate('/login')}
            onSettingsClick={() => navigate('/app')}
            isAdmin={false}
            isHidden={false}
            unreadNotifications={unreadNotifications}
            onNotificationsClick={onNotificationsClick || (() => navigate('/notifications'))}
        />
    );

    // ✅ Add interest
    const addInterest = async () => {
        if (!newInterest.trim()) {
            setError('Please enter an interest');
            return;
        }

        // Check if interest already exists
        if (profileData?.interests?.some(i => i.toLowerCase() === newInterest.trim().toLowerCase())) {
            showToastNotification('This interest is already added');
            return;
        }

        setAddingInterest(true);

        try {
            const currentInterests = profileData?.interests || [];
            const updatedInterests = [...currentInterests, newInterest.trim()];
            
            const { error } = await supabase
                .from('profiles')
                .update({ interests: updatedInterests })
                .eq('user_id', userId);

            if (error) throw error;

            // Update local state
            setProfileData(prev => ({
                ...prev,
                interests: updatedInterests
            }));
            
            setNewInterest('');
            showToastNotification(`✅ "${newInterest.trim()}" added to your interests!`);

        } catch (error) {
            console.error('Error adding interest:', error);
            showToastNotification('Failed to add interest');
        } finally {
            setAddingInterest(false);
        }
    };

    // ✅ Remove interest
    const removeInterest = async (index) => {
        try {
            const currentInterests = profileData?.interests || [];
            const updatedInterests = currentInterests.filter((_, i) => i !== index);
            
            const { error } = await supabase
                .from('profiles')
                .update({ interests: updatedInterests })
                .eq('user_id', userId);

            if (error) throw error;

            // Update local state
            setProfileData(prev => ({
                ...prev,
                interests: updatedInterests
            }));
            
            showToastNotification('Interest removed');

        } catch (error) {
            console.error('Error removing interest:', error);
            showToastNotification('Failed to remove interest');
        }
    };


    // Re-run a saved search
    const runSavedSearch = (searchTerm) => {
        if (onBackToSocial) {
            onBackToSocial();
            setTimeout(() => {
                navigate(`/app?q=${encodeURIComponent(searchTerm)}`);
            }, 100);
        }
    };

     // ============================================
    // SHARED PAGE STYLES
    // ============================================
    const pageWrapper = {
        minHeight: '100vh',
        background: T.bg,
        color: T.textOnDark,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    };
    const containerStyle = {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
    };
    const btnPrimary = {
        background: '#ffffff',
        color: '#09090b',
        border: 'none',
        padding: '12px 20px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontFamily: 'inherit',
    };
    const btnSecondary = {
        background: 'transparent',
        color: '#ffffff',
        border: '1.5px solid rgba(255,255,255,0.15)',
        padding: '12px 20px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontFamily: 'inherit',
    };
    const backBtn = {
        background: 'transparent',
        color: '#ffffff',
        border: '1.5px solid rgba(255,255,255,0.15)',
        padding: '10px 18px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '20px',
        fontFamily: 'inherit',
    };
    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '28px',
    };
    const sectionWhite = {
        background: '#ffffff',
        borderRadius: T.radius,
        padding: '28px 32px',
        marginBottom: '20px',
        color: '#09090b',
    };
    const sectionSoft = {
        background: T.softBg,
        borderRadius: T.radius,
        padding: '28px 32px',
        marginBottom: '20px',
        color: '#09090b',
    };
    const sectionTitle = {
        fontSize: '20px',
        fontWeight: '800',
        color: '#0d0d10',
        marginBottom: '20px',
        letterSpacing: '-0.3px',
    };
    const welcomeHeaderStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '28px',
        paddingBottom: '24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    };
    const greetingStyle = {
        fontSize: '38px',
        fontWeight: '900',
        letterSpacing: '-1.5px',
        margin: '0 0 6px 0',
        color: '#ffffff',
        lineHeight: 1.1,
    };
    const welcomeTextStyle = {
        fontSize: '15px',
        color: 'rgba(255,255,255,0.5)',
        margin: 0,
        fontWeight: '500',
    };
    const referralBadgeStyle = {
        background: '#ffffff',
        color: '#09090b',
        padding: '10px 18px',
        borderRadius: '24px',
        fontSize: '13px',
        fontWeight: '800',
    };
    const tabsRowStyle = {
        display: 'flex',
        gap: '8px',
        marginBottom: '28px',
        overflowX: 'auto',
        paddingBottom: '4px',
    };
    const loadingWrap = {
        textAlign: 'center',
        paddingTop: '80px',
    };
    const spinner = {
        width: '40px',
        height: '40px',
        border: '3px solid rgba(255,255,255,0.15)',
        borderTop: '3px solid #a855f7',
        borderRadius: '50%',
        margin: '0 auto 16px',
        animation: 'spin 1s linear infinite',
    };

    const spinKeyframes = <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>;


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

    // ✅ GUEST MODE: Show limited dashboard for non-logged-in users
    if (!userId) {
        return (
            <div style={styles.container }>
                {/* Top nav bar */}
                <div style={styles.topNavBar}>
                    <button 
                        onClick={() => navigate('/')} 
                        style={styles.navButtonSecondary}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(124, 58, 237, 0.15)';
                            e.currentTarget.style.borderColor = '#9333ea';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                        }}
                    >
                        🏠 Home
                    </button>
                    <button 
                        onClick={() => navigate('/app')} 
                        style={styles.navButtonPrimary}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 10px rgba(124, 58, 237, 0.2)';
                        }}
                    >
                        ← Back to Search
                    </button>
                </div>
                <div style={styles.welcomeHeader}>
                    <div style={styles.referralBadge}>
                        🎁 {userReferralCount} Referrals
                    </div>
                </div>

                {/* Public Preview Cards */}
                <div style={styles.statsGrid}>
                    <StatCard icon="🔥" label="Daily Deals" value="12" highlight={true} />
                    <StatCard icon="🛒" label="Active Products" value="100+" highlight={true} />
                    <StatCard icon="💬" label="Sellers Online" value="24" highlight={true} />
                    <StatCard icon="🎯" label="Your Interests" value="?" locked={true} />
                    <StatCard icon="❤️" label="Your Wishlist" value="?" locked={true} />
                    <StatCard icon="📦" label="Your Orders" value="?" locked={true} />
                </div>

                {/* Sign-In Prompt */}
                <div style={{
                    background: 'var(--card-bg)',
                    border: '2px dashed var(--secondary-color)',
                    borderRadius: '16px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    marginTop: '30px'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔓</div>
                    <h3 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', fontSize: '22px' }}>
                        Unlock Your Full Dashboard
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 24px', lineHeight: 1.6 }}>
                        Sign up to track your wishlist, orders, saved searches, price alerts, referrals, and more!
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => navigate('/login?intent=buyer')}
                            style={{
                                padding: '12px 32px',
                                background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '15px',
                                cursor: 'pointer',
                                boxShadow: 'var(--shadow-md)'
                            }}
                        >
                            🚀 Sign Up Free
                        </button>
                        <button
                            onClick={() => navigate('/login?fresh=true')}
                            style={{
                                padding: '12px 32px',
                                background: 'var(--light-bg)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '15px',
                                cursor: 'pointer'
                            }}
                        >
                            Log In
                        </button>
                    </div>
                </div>
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
            {/* Top navigation bar */}
            {renderTopBar()}

            {/* Home + Back to Search row (Home first) */}
            <div style={styles.topNavBar}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => navigate('/')}
                        style={styles.navButtonSecondary}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(124, 58, 237, 0.15)';
                            e.currentTarget.style.borderColor = '#9333ea';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                        }}
                    >
                        🏠 Home
                    </button>
                    <button
                        onClick={() => {
                            if (onBackToSocial) {
                                onBackToSocial();
                            } else {
                                navigate('/app');
                            }
                        }}
                        style={styles.navButtonPrimary}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 10px rgba(124, 58, 237, 0.2)';
                        }}
                    >
                        ← Back to Search
                    </button>
                </div>
            <div style={styles.navSpacer}></div>
        </div>
                            

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

            {/* Tab Navigation */}
            <div style={styles.tabNav}>
                <button onClick={() => setActiveTab('overview')} style={{...styles.tabButton, background: activeTab === 'overview' ? 'var(--primary-color)' : 'var(--light-bg)', color: activeTab === 'overview' ? 'white' : 'var(--text-secondary)'}}>📊 Overview</button>
                <button onClick={() => setActiveTab('deals')} style={{...styles.tabButton, background: activeTab === 'deals' ? 'var(--primary-color)' : 'var(--light-bg)', color: activeTab === 'deals' ? 'white' : 'var(--text-secondary)'}}>🔥 Daily Deals</button>
                <button onClick={() => { setActiveTab('claimed_deals'); fetchClaimedDeals(); }} style={{...styles.tabButton, background: activeTab === 'claimed_deals' ? 'var(--primary-color)' : 'var(--light-bg)', color: activeTab === 'claimed_deals' ? 'white' : 'var(--text-secondary)'}}> 🎁 Claimed Deals ({claimedDeals.length})</button>
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
                                    {recentActivity
                                        .filter(a => a.activity_type !== 'page_view')
                                        .map((activity, index) => (
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
                            <button onClick={goBack} style={styles.backButton}>
                                ← Back to Dashboard
                            </button>
                            <h3>❤️ My Wishlist</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                {stats.wishlistCount} saved {stats.wishlistCount === 1 ? 'item' : 'items'} · Total value: ${stats.totalSaved.toFixed(2)}
                            </p>
                        </div>
                        <WishlistManager onBack={goBack} />
                    </div>
                )}

                {activeTab === 'orders' && selectedMode === 'buyer' && (
                    <div style={styles.ordersSection}>
                        <div style={styles.ordersHeader}>
                            <button onClick={goBack} style={styles.backButton}>
                                ← Back to Dashboard
                            </button>
                            <h3>📦 Order History</h3>
                        </div>           

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
                        {/* ✅ Add Tab Navigation inside the searches section */}
                        <div style={{
                            display: 'flex',
                            gap: '10px',
                            marginBottom: '20px',
                            borderBottom: '2px solid var(--border-color)',
                            paddingBottom: '10px'
                        }}>
                            <button
                                onClick={() => setSearchesSubTab('saved')}
                                style={{
                                    padding: '8px 20px',
                                    background: searchesSubTab === 'saved' ? 'var(--primary-color)' : 'transparent',
                                    color: searchesSubTab === 'saved' ? 'white' : 'var(--text-secondary)',
                                    border: 'none',
                                    borderRadius: '20px',
                                    cursor: 'pointer',
                                    fontWeight: searchesSubTab === 'saved' ? 'bold' : 'normal'
                                }}
                            >
                                🔍 Saved Searches ({savedSearches.length})
                            </button>
                            <button
                                onClick={() => setSearchesSubTab('interests')}
                                style={{
                                    padding: '8px 20px',
                                    background: searchesSubTab === 'interests' ? 'var(--primary-color)' : 'transparent',
                                    color: searchesSubTab === 'interests' ? 'white' : 'var(--text-secondary)',
                                    border: 'none',
                                    borderRadius: '20px',
                                    cursor: 'pointer',
                                    fontWeight: searchesSubTab === 'interests' ? 'bold' : 'normal'
                                }}
                            >
                                🎯 Interests ({profileData?.interests?.length || 0})
                            </button>
                        </div>

                        {/* Saved Searches Sub-Tab */}
                        {searchesSubTab === 'saved' && (
                            <>
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
                            </>
                        )}

                        {/* ✅ Interests Sub-Tab */}
                        {searchesSubTab === 'interests' && (
                            <div>
                                {/* Info Message */}
                                <div style={{
                                    background: '#1e3a5f',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    marginBottom: '16px',
                                    borderLeft: '3px solid #667eea'
                                }}>
                                    <p style={{ margin: '0', fontSize: '13px', color: '#b0c4de' }}>
                                        💡 Add your interests so sellers can find you with relevant products!
                                    </p>
                                </div>

                                {/* Add Interest Input */}
                                <div style={{
                                    display: 'flex',
                                    gap: '10px',
                                    marginBottom: '16px'
                                }}>
                                    <input
                                        type="text"
                                        value={newInterest}
                                        onChange={(e) => setNewInterest(e.target.value)}
                                        placeholder="e.g., electronics, books, clothing, phones..."
                                        style={{
                                            flex: 1,
                                            padding: '10px 14px',
                                            background: 'var(--card-bg)',
                                            border: '2px solid var(--border-color)',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            color: 'var(--text-primary)',
                                            outline: 'none'
                                        }}
                                        onFocus={(e) => { e.target.style.borderColor = '#667eea'; }}
                                        onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; }}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                addInterest();
                                            }
                                        }}
                                        disabled={addingInterest}
                                    />
                                    <button
                                        onClick={addInterest}
                                        disabled={addingInterest}
                                        style={{
                                            padding: '10px 24px',
                                            background: addingInterest ? '#555' : 'linear-gradient(135deg, #667eea, #764ba2)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: addingInterest ? 'not-allowed' : 'pointer',
                                            fontWeight: 'bold',
                                            opacity: addingInterest ? 0.7 : 1,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {addingInterest ? 'Adding...' : '➕ Add'}
                                    </button>
                                </div>

                                {/* Interest Tags */}
                                {!profileData?.interests || profileData.interests.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                                        <div style={{ fontSize: '32px', marginBottom: '10px' }}>🎯</div>
                                        <p>No interests added yet</p>
                                        <p style={{ fontSize: '12px', marginTop: '5px' }}>
                                            Add interests above to help sellers find you
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '10px'
                                    }}>
                                        {profileData.interests.map((interest, index) => (
                                            <div key={index} style={{
                                                background: 'linear-gradient(135deg, #667eea30, #764ba230)',
                                                padding: '8px 16px',
                                                borderRadius: '20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                border: '1px solid #667eea50'
                                            }}>
                                                <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{interest}</span>
                                                <button
                                                    onClick={() => removeInterest(index)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: '#888',
                                                        fontSize: '16px',
                                                        padding: '0 4px',
                                                        transition: 'color 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => (e.target.style.color = '#ff4444')}
                                                    onMouseLeave={(e) => (e.target.style.color = '#888')}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Footer Note */}
                                <div style={{
                                    marginTop: '20px',
                                    padding: '12px',
                                    background: 'var(--light-bg)',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    color: 'var(--text-secondary)'
                                }}>
                                    <p style={{ margin: 0 }}>
                                        📌 Your interests are shared with sellers to help them find you with relevant products.
                                        <br />
                                        <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                                            You can add up to 20 interests. Be specific for better matches!
                                        </span>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'deals' && (
                    <div style={styles.dealsSection}>
                        <div style={styles.dealsHeader}>
                            <button onClick={goBack} style={styles.backButton}>
                                ← Back to Dashboard
                            </button>
                            <h3>🔥 Daily Deals</h3>
                        </div>
                        <DailyDeals 
                            userId={userId}
                            userReferralCount={userReferralCount}
                            onClaimDeal={(deal) => {
                                loadDashboardData();
                            }}
                        />
                    </div>
                )}

                {/* ✅ ADD THIS NEW SECTION FOR CLAIMED DEALS */}
                {activeTab === 'claimed_deals' && (
                    <div style={styles.claimedDealsSection}>
                        <div style={styles.claimedDealsHeader}>
                            <button onClick={goBack} style={styles.backButton}>
                                ← Back to Dashboard
                            </button>
                            <h3>🎁 My Claimed Deals</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                Deals you have claimed from Daily Deals
                            </p>
                        </div>

                        {claimedDeals.length === 0 ? (
                            <div style={styles.emptyState}>
                                <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎁</div>
                                <h4>No claimed deals yet</h4>
                                <p>Go to Daily Deals and claim a deal to see it here.</p>
                                <button 
                                    onClick={() => setActiveTab('deals')} 
                                    style={styles.emptyStateButton}
                                >
                                    🔥 View Daily Deals
                                </button>
                            </div>
                        ) : (
                            <div style={styles.claimedDealsList}>
                                {claimedDeals.map((claim) => (
                                    <div key={claim.id} style={styles.claimedDealCard}>
                                        <div style={styles.claimedDealImage}>
                                            {claim.deal_image ? (
                                                <img 
                                                    src={claim.deal_image} 
                                                    alt={claim.deal_name}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover',
                                                        borderRadius: '8px'
                                                    }}
                                                />
                                            ) : (
                                                <div style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '32px',
                                                    color: 'white',
                                                    borderRadius: '8px'
                                                }}>
                                                    🎁
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div style={styles.claimedDealInfo}>
                                            <div style={styles.claimedDealName}>
                                                <strong>{claim.deal_name}</strong>
                                                <span style={{
                                                    padding: '2px 10px',
                                                    borderRadius: '12px',
                                                    fontSize: '11px',
                                                    fontWeight: '500',
                                                    background: claim.status === 'pending' ? '#fff3cd' : 
                                                            claim.status === 'contacted' ? '#dbeafe' : '#dcfce7',
                                                    color: claim.status === 'pending' ? '#856404' : 
                                                        claim.status === 'contacted' ? '#1e40af' : '#166534'
                                                }}>
                                                    {claim.status === 'pending' ? '⏳ Pending' :
                                                    claim.status === 'contacted' ? '📱 Contacted' : '✅ Completed'}
                                                </span>
                                            </div>
                                            
                                            <div style={styles.claimedDealDetails}>
                                                <span>💰 ${claim.deal_price || '0'}</span>
                                                <span>👤 {claim.seller_name || 'Unknown Seller'}</span>
                                                <span>📅 {new Date(claim.claimed_at).toLocaleDateString()}</span>
                                            </div>
                                            
                                            <div style={styles.claimedDealActions}>
                                                {claim.seller_phone && (
                                                    <button
                                                        onClick={() => {
                                                            const cleanPhone = claim.seller_phone.replace(/\D/g, '');
                                                            const finalNumber = cleanPhone.startsWith('263') 
                                                                ? cleanPhone 
                                                                : `263${cleanPhone.replace(/^0/, '')}`;
                                                            const message = encodeURIComponent(
                                                                `Hi! I claimed your deal "${claim.deal_name}". Is it still available?`
                                                            );
                                                            window.open(`https://wa.me/${finalNumber}?text=${message}`, '_blank');
                                                        }}
                                                        style={{
                                                            padding: '8px 16px',
                                                            background: '#25D366',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontSize: '13px',
                                                            fontWeight: '500',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                        }}
                                                    >
                                                        💬 Contact Seller
                                                    </button>
                                                )}
                                                
                                                {claim.seller_id && (
                                                    <button
                                                        onClick={() => {
                                                            // Navigate to seller profile
                                                            navigate(`/profile/${claim.seller_id}`);
                                                        }}
                                                        style={{
                                                            padding: '8px 16px',
                                                            background: '#667eea',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontSize: '13px',
                                                            fontWeight: '500',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                        }}
                                                    >
                                                        👤 View Seller
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'referrals' && (
                    <div style={styles.referralsSection}>
                        <div style={styles.referralsHeader}>
                            <button onClick={goBack} style={styles.backButton}>
                                ← Back to Dashboard
                            </button>
                            <h3>👥 Referrals</h3>
                        </div>
                        <ReferralProgram 
                            userId={userId}
                            userName={userName}
                            onReferralComplete={() => {
                                loadDashboardData();
                            }}
                        />
                    </div>
                )}

                {activeTab === 'alerts' && (
                    <div style={styles.alertsSection}>
                        <div style={styles.alertsHeader}>
                            <button onClick={goBack} style={styles.backButton}>
                                ← Back to Dashboard
                            </button>
                            <h3>🔔 Price Alerts</h3>
                        </div>
                        <PriceAlertDashboard userId={userId} />
                    </div>
                )}

            </div>
        </div>
    );
};

const styles = {
    container: {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px',
        backgroundColor: '#0d0d10',
        backgroundImage: HEXAGON_PATTERN,
        backgroundSize: '28px 49px',
        backgroundRepeat: 'repeat',
        backgroundAttachment: 'fixed',
        minHeight: '100vh'
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
    navButtonPrimary: {
        background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
        boxShadow: 'var(--shadow-sm)'
    },
    navButtonSecondary: {
        background: 'var(--light-bg)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-color)',
        padding: '8px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease'
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
    statCardHighlight: {
        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(114, 9, 183, 0.05))',
        border: '1px solid var(--secondary-color)',
    },
    statCardLocked: {
        background: 'var(--light-bg)',
        border: '1px dashed var(--border-color)',
        opacity: 0.6
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
    statValueHighlight: {
        background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
    },
    statValueLocked: {
        color: 'var(--text-light)'
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
        background: 'var(--card-bg)',
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
        color: 'var(--text-primary)',
        padding: '8px 12px',
        background: 'var(--light-bg)',
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
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap'
    },
    wishlistFullscreen: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--card-bg)',
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
    ordersHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap'
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
    searchesHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap'
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
    dealsSection: {
        background: 'var(--card-bg)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid var(--border-color)'
    },
    dealsHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap'
    },
    referralsSection: {
        background: 'var(--card-bg)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid var(--border-color)'
    },
    referralsHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap'
    },
    alertsSection: {
        background: 'var(--card-bg)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid var(--border-color)'
    },
    alertsHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap'
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
    },
    topNavBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        paddingBottom: '10px',
        borderBottom: '1px solid var(--border-color)',
        position: 'relative',
        background: 'var(--card-bg)'
    },
    backNavButton: {
        background: 'transparent',
        border: '1px solid var(--border-color)',
        color: 'var(--text-primary)',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
        fontWeight: '500'
    },
    navSpacer: {
        flex: 1
    },
    claimedDealsSection: {
        background: 'var(--card-bg)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid var(--border-color)',
        minHeight: '300px'
    },
    claimedDealsHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap'
    },
    claimedDealsList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        marginTop: '15px'
    },
    claimedDealCard: {
        display: 'flex',
        gap: '16px',
        background: 'var(--light-bg)',
        borderRadius: '10px',
        padding: '15px',
        border: '1px solid var(--border-color)',
        transition: 'all 0.2s',
        alignItems: 'center'
    },
    claimedDealImage: {
        width: '80px',
        height: '80px',
        borderRadius: '8px',
        overflow: 'hidden',
        flexShrink: 0
    },
    claimedDealInfo: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    claimedDealName: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap'
    },
    claimedDealDetails: {
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap',
        fontSize: '13px',
        color: 'var(--text-secondary)'
    },
    claimedDealActions: {
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        marginTop: '5px'
    },
};

export default UserDashboard;
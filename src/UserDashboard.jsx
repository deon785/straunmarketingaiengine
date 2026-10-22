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
// DESIGN TOKENS (UPDATED FOR DARK MODE)
// ============================================
const T = {
    bg: '#ffffff',
    cardBg: '#ffffff',
    cardText: '#1a1a1a',
    cardMuted: '#6b7280',
    softBg: '#f9fafb',
    softText: '#1a1a1a',
    softMuted: '#6b7280',
    darkSurface: '#f3f4f6',
    red: '#ef4444',
    accent: '#7c3aed',
    textOnDark: '#1a1a1a',       // rename mentally to "textOnLight"
    textOnDarkMuted: '#6b7280',
    border: '#e5e7eb',
    radius: '16px',
};

// ============================================
// STAT CARD COMPONENT (UPDATED FOR DARK MODE)
// ============================================
const StatCard = ({ icon, label, value, badge, highlight, locked }) => {
    if (locked) {
        return (
            <div style={{
                background: '#111111',              // ✅ black
                border: '1px dashed #333',
                borderRadius: T.radius,
                padding: '32px 20px',
                textAlign: 'center',
                position: 'relative',
                opacity: 0.95,
            }}>
                <div style={{ position: 'absolute', top: '14px', right: '14px', fontSize: '14px', opacity: 0.55, color: '#fff' }}>🔒</div>
                <div style={{ fontSize: '32px', marginBottom: '16px', filter: 'grayscale(0.6)', opacity: 0.85 }}>{icon}</div>
                <div style={{ fontSize: '38px', fontWeight: '900', color: '#6b7280', letterSpacing: '-1.5px', lineHeight: 1, marginBottom: '8px' }}>
                    {value}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '600' }}>{label}</div>
            </div>
        );
    }

    if (highlight) {
        return (
            <div style={{
                background: '#111111',              // ✅ black
                border: '1.5px solid #7c3aed',
                borderRadius: T.radius,
                padding: '32px 20px',
                textAlign: 'center',
                boxShadow: '0 8px 24px -14px rgba(124,58,237,0.5)',
            }}>
                <div style={{ fontSize: '32px', marginBottom: '16px' }}>{icon}</div>
                <div style={{ fontSize: '38px', fontWeight: '900', color: '#ffffff', letterSpacing: '-1.5px', lineHeight: 1, marginBottom: '8px' }}>
                    {value}
                </div>
                <div style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: '600' }}>{label}</div>
            </div>
        );
    }

    return (
        <div style={{
            background: '#111111',                  // ✅ black
            border: '1px solid #2a2a30',
            borderRadius: T.radius,
            padding: '32px 20px',
            textAlign: 'center',
            position: 'relative',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 12px 30px -20px rgba(0,0,0,0.5)',
        }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>{icon}</div>
            <div style={{ fontSize: '38px', fontWeight: '900', color: '#ffffff', letterSpacing: '-1.5px', lineHeight: 1, marginBottom: '8px' }}>
                {value}
            </div>
            <div style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: '600' }}>
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
    const { user: authUser, loading: authLoading } = useAuthState();
    
    const userId = propUserId || authUser?.id;
    const userName = propUserName || authUser?.email?.split('@')[0] || 'User';
    const userEmail = propUserEmail || authUser?.email;
    
    // ✅ This checks if we passed a tab in the state, otherwise defaults to 'overview'
    const [activeTab, setActiveTab] = useState(location.state?.tab || 'overview');
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
        sellersContacted: 0,
        totalSpent: 0,
        activeAlerts: 0,
        savedSearchesCount: 0
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [userReferralCount, setUserReferralCount] = useState(0);
    const [loading, setLoading] = useState(true);
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
        console.log('[Toast]', msg);
    };

    // ✅ REMOVED the popstate trap so browser back button works naturally.

    useEffect(() => {
        if (userId) {
            loadDashboardData();
            loadProfileData();
        }
    }, [userId, selectedMode]);

    const loadDashboardData = async () => {
        // ✅ Wait for auth to resolve
        if (authLoading) {
            return (
                <div style={styles.loadingContainer}>
                    {spinKeyframes}
                    <div style={styles.spinner}></div>
                    <p style={{ color: '#a1a1aa' }}>Loading your dashboard...</p>
                </div>
            );
        }

        // ✅ Now this only fires if auth resolved AND user really isn't signed in
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
                    activeAlerts: 0,
                    savedSearchesCount: 0,
                    sellersContacted: sellersContacted
                });
            } else {
                // BUYER MODE STATS
                const { count: wishlistCount } = await supabase
                    .from('saved_items')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId);
                
                // ✅ NEW: Fetch unique sellers contacted
                let sellersContacted = 0;
                try {
                    const { data: sentMessages, error: msgError } = await supabase
                        .from('messages')
                        .select('receiver_id')
                        .eq('sender_id', userId);

                    if (!msgError && sentMessages) {
                        // Uses a Set to count ONLY unique sellers (prevents counting the same seller 10 times)
                        const uniqueSellers = new Set(sentMessages.map(m => m.receiver_id));
                        sellersContacted = uniqueSellers.size;
                    }
                } catch (e) {
                    console.log('Messages table error:', e);
                }

                const { data: savedItems } = await supabase
                    .from('saved_items')
                    .select('product_price')
                    .eq('user_id', userId);
                
                const totalSaved = savedItems?.reduce((sum, item) => sum + (item.product_price || 0), 0) || 0;
                
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

    const goBack = () => {
        setActiveTab('overview');
    };

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

    const addInterest = async () => {
        if (!newInterest.trim()) {
            setError('Please enter an interest');
            return;
        }

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

    const removeInterest = async (index) => {
        try {
            const currentInterests = profileData?.interests || [];
            const updatedInterests = currentInterests.filter((_, i) => i !== index);
            
            const { error } = await supabase
                .from('profiles')
                .update({ interests: updatedInterests })
                .eq('user_id', userId);

            if (error) throw error;

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

    const runSavedSearch = (searchTerm) => {
        if (onBackToSocial) {
            onBackToSocial();
            setTimeout(() => {
                navigate(`/app?q=${encodeURIComponent(searchTerm)}`);
            }, 100);
        }
    };

    // ============================================
    // SHARED PAGE STYLES (DARK MODE)
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
        background: '#1a1a1f',             // ✅ Dark section
        borderRadius: T.radius,
        padding: '28px 32px',
        marginBottom: '20px',
        color: '#ffffff',
        border: '1px solid #2a2a30',
    };
    const sectionSoft = {
        background: '#1e1e24',             // ✅ Darker soft section
        borderRadius: T.radius,
        padding: '28px 32px',
        marginBottom: '20px',
        color: '#ffffff',
        border: '1px solid #2a2a30',
    };
    const sectionTitle = {
        fontSize: '20px',
        fontWeight: '800',
        color: '#ffffff',
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

    const spinKeyframes = <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ✅ Dashboard tabs — real CSS with working hover */
        .dash-tab {
            padding: 10px 16px;
            border: 1.5px solid transparent;
            border-radius: 10px;
            cursor: pointer;
            font-size: 13.5px;
            font-weight: 600;
            font-family: inherit;
            white-space: nowrap;
            background: transparent;
            color: #a1a1aa;
            transition: all 0.2s ease;
            outline: none;
        }


        .dash-tab.active {
            background: #ffffff;
            color: #0f172a;
            border-color: #7c3aed;
            box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.25);
            font-weight: 700;
        }

        .dash-tab.active:hover {
            background: #ffffff;
            color: #0f172a;
        }
    `}</style>;

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
                        ← Back to Overview
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

    if (showWishlistModal) {
        return (
            <div style={styles.wishlistFullscreen}>
                <div style={styles.wishlistHeader}>
                   <button onClick={goBack} style={styles.backButton}>
                        ← Back to Overview
                    </button>
                    <h3>❤️ My Wishlist ({stats.wishlistCount} items)</h3>
                </div>
                <WishlistManager onBack={() => setShowWishlistModal(false)} />
            </div>
        );
    }

    if (!userId) {
        return (
            <div style={styles.container}>
                {spinKeyframes}
                {renderTopBar()}

                <div style={styles.topNavBar}>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            background: 'linear-gradient(135deg, #d6336c, #7c3aed)',
                            border: 'none',
                            color: '#ffffff',
                            padding: '9px 18px',
                            borderRadius: '10px',
                            fontSize: '14px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 14px -6px rgba(214,51,108,0.5)',
                        }}
                    >
                        🏠 Home
                    </button>

                    <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                        🛒 Buyer Dashboard
                    </div>

                    <button
                        onClick={() => navigate('/app')}
                        style={{
                            background: 'linear-gradient(135deg, #d6336c, #7c3aed)',
                            border: 'none',
                            color: '#ffffff',
                            padding: '9px 18px',
                            borderRadius: '10px',
                            fontSize: '14px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 14px -6px rgba(214,51,108,0.5)',
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

                <div style={styles.statsGrid}>
                    <StatCard icon="🔥" label="Daily Deals" value="12" highlight={true} />
                    <StatCard icon="🛒" label="Active Products" value="100+" highlight={true} />
                    <StatCard icon="💬" label="Sellers Online" value="24" highlight={true} />
                    <StatCard icon="🎯" label="Your Interests" value="?" locked={true} />
                    <StatCard icon="❤️" label="Your Wishlist" value="?" locked={true} />
                    <StatCard icon="📦" label="Your Orders" value="?" locked={true} />
                </div>

                <div style={{
                    background: '#ffffff',
                    border: '2px dashed #e5e7eb',
                    borderRadius: '16px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    marginTop: '30px',
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔓</div>
                    <h3 style={{ margin: '0 0 12px 0', color: '#1a1a1a', fontSize: '22px' }}>
                        Unlock Your Full Dashboard
                    </h3>
                    <p style={{ color: '#6b7280', maxWidth: '500px', margin: '0 auto 24px', lineHeight: 1.6 }}>
                        Sign up to track your wishlist, orders, saved searches, price alerts, referrals, and more!
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => navigate('/login?intent=buyer')}
                            style={{
                                padding: '12px 32px',
                                background: 'linear-gradient(135deg, #d6336c, #7c3aed)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '15px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 14px -6px rgba(214,51,108,0.5)',
                            }}
                        >
                            🚀 Sign Up Free
                        </button>
                        <button
                            onClick={() => navigate('/login?fresh=true')}
                            style={{
                                padding: '12px 32px',
                                background: 'transparent',
                                color: '#1a1a1a',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '15px',
                                cursor: 'pointer',
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
                {spinKeyframes}
                <div style={styles.spinner}></div>
                <p style={{ color: '#a1a1aa' }}>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {spinKeyframes}
            {renderTopBar()}

            {/* ✅ New Dashboard Top Bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 0',
                marginBottom: '20px',
                borderBottom: '1px solid #2a2a30',
                flexWrap: 'wrap',
                gap: '12px',
            }}>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        background: 'linear-gradient(135deg, #d6336c, #7c3aed , #d6336c)',
                        border: 'none',
                        color: '#ffffff',
                        padding: '9px 18px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontFamily: 'inherit',
                        boxShadow: '0 4px 14px -6px rgba(214,51,108,0.5)',
                        opacity: 0.9,
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px -6px rgba(214,51,108,0.7)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 14px -6px rgba(214,51,108,0.5)';
                    }}
                >
                    ← Back to Home
                </button>

                <div style={{
                    fontSize: '13px',
                    color: '#a1a1aa',
                    fontWeight: '500',
                }}>
                    {selectedMode === 'seller' ? '💼 Seller Dashboard' : '🛒 Buyer Dashboard'}
                </div>

                <button
                    onClick={() => {
                        if (onBackToSocial) { onBackToSocial(); }
                        else { navigate('/app'); }
                    }}
                    style={{
                        background: 'linear-gradient(135deg, #d6336c, #7c3aed)',
                        border: 'none',
                        color: '#ffffff',
                        padding: '9px 18px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontFamily: 'inherit',
                        boxShadow: '0 4px 14px -6px rgba(214,51,108,0.5)',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px -6px rgba(214,51,108,0.7)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 14px -6px rgba(214,51,108,0.5)';
                    }}
                >
                    🔍 Back to Search
                </button>
            </div>

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
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`dash-tab ${activeTab === 'overview' ? 'active' : ''}`}
                >
                    📊 Overview
                </button>

                <button
                    onClick={() => setActiveTab('deals')}
                    className={`dash-tab ${activeTab === 'deals' ? 'active' : ''}`}
                >
                    🔥 Daily Deals
                </button>

                <button
                    onClick={() => { setActiveTab('claimed_deals'); fetchClaimedDeals(); }}
                    className={`dash-tab ${activeTab === 'claimed_deals' ? 'active' : ''}`}
                >
                    🎁 Claimed Deals ({claimedDeals.length})
                </button>

                <button
                    onClick={() => setActiveTab('wishlist')}
                    className={`dash-tab ${activeTab === 'wishlist' ? 'active' : ''}`}
                >
                    ❤️ Wishlist ({stats.wishlistCount})
                </button>

                {selectedMode === 'buyer' && (
                    <button
                        onClick={() => setActiveTab('searches')}
                        className={`dash-tab ${activeTab === 'searches' ? 'active' : ''}`}
                    >
                        🔍 Saved Searches ({stats.savedSearchesCount})
                    </button>
                )}

                <button
                    onClick={() => setActiveTab('referrals')}
                    className={`dash-tab ${activeTab === 'referrals' ? 'active' : ''}`}
                >
                    👥 Referrals
                </button>

                <button
                    onClick={() => { setShowChatList(true); setActiveTab('messages'); }}
                    className={`dash-tab ${activeTab === 'messages' ? 'active' : ''}`}
                >
                    💬 Messages
                </button>

                <button
                    onClick={() => setActiveTab('alerts')}
                    className={`dash-tab ${activeTab === 'alerts' ? 'active' : ''}`}
                >
                    🔔 Price Alerts ({stats.activeAlerts})
                </button>
            </div>

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
                                    <StatCard icon="💬" label="Sellers Contacted" value={stats.sellersContacted} />
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
                    
                    <WishlistManager onBack={goBack} />                
                )}

                {activeTab === 'searches' && selectedMode === 'buyer' && (
                    <div style={styles.searchesSection}>
                        <div style={{
                            display: 'flex',
                            gap: '10px',
                            marginBottom: '20px',
                            borderBottom: '2px solid #2a2a30',
                            paddingBottom: '10px'
                        }}>
                            <button
                                onClick={() => setSearchesSubTab('saved')}
                                style={{
                                    padding: '8px 20px',
                                    background: searchesSubTab === 'saved' ? '#7c3aed' : 'transparent',
                                    color: searchesSubTab === 'saved' ? 'white' : '#a1a1aa',
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
                                    background: searchesSubTab === 'interests' ? '#7c3aed' : 'transparent',
                                    color: searchesSubTab === 'interests' ? 'white' : '#a1a1aa',
                                    border: 'none',
                                    borderRadius: '20px',
                                    cursor: 'pointer',
                                    fontWeight: searchesSubTab === 'interests' ? 'bold' : 'normal'
                                }}
                            >
                                🎯 Interests ({profileData?.interests?.length || 0})
                            </button>
                        </div>

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

                        {searchesSubTab === 'interests' && (
                            <div>
                               <div style={{
                                    background: '#1e1e24',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    marginBottom: '16px',
                                    borderLeft: '3px solid #7c3aed',
                                }}>
                                    <p style={{ margin: '0', fontSize: '13px', color: '#a1a1aa' }}>
                                        💡 Add your interests so sellers can find you with relevant products!
                                    </p>
                                </div>

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
                                            background: '#1a1a1f',
                                            border: '2px solid #2a2a30',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            color: '#ffffff',
                                            outline: 'none'
                                        }}
                                        onFocus={(e) => { e.target.style.borderColor = '#7c3aed'; }}
                                        onBlur={(e) => { e.target.style.borderColor = '#2a2a30'; }}
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
                                            background: addingInterest ? '#555' : 'linear-gradient(135deg, #d6336c, #7c3aed)',
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

                                {!profileData?.interests || profileData.interests.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '30px', color: '#a1a1aa' }}>
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
                                                background: 'rgba(124, 58, 237, 0.15)',
                                                padding: '8px 16px',
                                                borderRadius: '20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                border: '1px solid rgba(124, 58, 237, 0.3)'
                                            }}>
                                                <span style={{ fontSize: '14px', color: '#ffffff' }}>{interest}</span>
                                                <button
                                                    onClick={() => removeInterest(index)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: '#a1a1aa',
                                                        fontSize: '16px',
                                                        padding: '0 4px',
                                                        transition: 'color 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => (e.target.style.color = '#ff4444')}
                                                    onMouseLeave={(e) => (e.target.style.color = '#a1a1aa')}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{
                                    marginTop: '20px',
                                    padding: '12px',
                                    background: '#1e1e24',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    color: '#a1a1aa'
                                }}>
                                    <p style={{ margin: 0 }}>
                                        📌 Your interests are shared with sellers to help them find you with relevant products.
                                        <br />
                                        <span style={{ fontSize: '11px', color: '#71717a' }}>
                                            You can add up to 20 interests. Be specific for better matches!
                                        </span>
                                    </p>
                                </div>
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

                {activeTab === 'claimed_deals' && (
                    <div style={styles.claimedDealsSection}>
                        <div style={styles.claimedDealsHeader}>
                            <h3>🎁 My Claimed Deals</h3>
                            <p style={{ color: '#a1a1aa', fontSize: '13px' }}>
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
                                                    background: 'linear-gradient(135deg, #d6336c, #7c3aed)',
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
                                                    background: claim.status === 'pending' ? 'rgba(255, 243, 205, 0.2)' : 
                                                            claim.status === 'contacted' ? 'rgba(219, 234, 254, 0.2)' : 'rgba(220, 252, 231, 0.2)',
                                                    color: claim.status === 'pending' ? '#fbbf24' : 
                                                        claim.status === 'contacted' ? '#60a5fa' : '#4ade80'
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
                                                            navigate(`/buyer/shop/${claim.seller_id}`, {
                                                                state: {
                                                                    sellerId: claim.seller_id,
                                                                    sellerName: claim.seller_name || 'Seller Shop', 
                                                                    claimedProductId: claim.product_id 
                                                                }
                                                            });
                                                        }}
                                                        style={{
                                                            padding: '8px 16px',
                                                            background: '#7c3aed',
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
                                                        🏪 View Seller Shop
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
        minHeight: '100vh',
        background: '#ffffff',
        color: '#1a1a1a',
    },
    backButtonTop: {
        background: '#f3f4f6',
        border: '1px solid #e5e7eb',
        color: '#1a1a1a',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        marginBottom: '15px',
        fontSize: '14px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
    },
    chatContainer: {
        maxWidth: '800px',
        margin: '0 auto',
        padding: '20px',
    },
    chatHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '1px solid #e5e7eb',
    },
    backButton: {
        background: '#f3f4f6',
        border: '1px solid #e5e7eb',
        color: '#1a1a1a',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
    },
    placeholderChat: {
        textAlign: 'center',
        padding: '40px',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        color: '#1a1a1a',
    },
    welcomeHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '25px',
        flexWrap: 'wrap',
        gap: '15px',
    },
    greeting: {
        fontSize: '24px',
        margin: '0 0 5px 0',
        color: '#1a1a1a',
    },
    welcomeText: {
        color: '#6b7280',
        margin: 0,
    },
    referralBadge: {
        background: 'linear-gradient(135deg, #d6336c, #7c3aed)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '20px',
        fontWeight: 'bold',
        fontSize: '14px',
        boxShadow: '0 4px 14px -6px rgba(214,51,108,0.5)',
    },
    tabNav: {
        display: 'flex',
        gap: '6px',
        marginBottom: '25px',
        flexWrap: 'wrap',
        background: '#000000',
        borderRadius: '14px',
        padding: '6px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 8px 24px -14px rgba(0,0,0,0.15)',
    },
    tabContent: {
        minHeight: '400px',
    },
    navButtonPrimary: {
        background: 'linear-gradient(135deg, #d6336c, #7c3aed)',
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
        boxShadow: '0 4px 14px -6px rgba(214,51,108,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
        position: 'relative',
        overflow: 'hidden',
    },
    navButtonSecondary: {
        background: '#f3e8ff',
        color: '#7c3aed',
        border: '1px solid #c084fc',
        padding: '8px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '15px',
        marginBottom: '25px',
    },
    statCard: {
        background: '#ffffff',
        padding: '20px',
        borderRadius: '12px',
        textAlign: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        border: '1px solid #000000',
        position: 'relative',
    },
    statCardHighlight: {
        background: '#ffffff',
        border: '1px solid #7c3aed',
    },
    statCardLocked: {
        background: '#f9fafb',
        border: '1px dashed #d1d5db',
        opacity: 0.85,
    },
    statIcon: {
        fontSize: '32px',
        marginBottom: '10px',
    },
    statValue: {
        fontSize: '28px',
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: '5px',
    },
    statValueHighlight: {
        background: 'linear-gradient(135deg, #d6336c, #7c3aed)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
    },
    statValueLocked: {
        color: '#9ca3af',
    },
    statLabel: {
        fontSize: '13px',
        color: '#6b7280',
    },
    statBadge: {
        background: '#ef4444',
        color: 'white',
        borderRadius: '50%',
        padding: '2px 6px',
        fontSize: '10px',
        marginLeft: '5px',
    },
    activitySection: {
        background: '#000000',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '25px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    },
    sectionTitle: {
        margin: '0 0 15px 0',
        fontSize: '16px',
        color: '#fdfdfd',
        fontWeight: '700',
    },
    activityList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    activityItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px',
        background: '#010101',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
    },
    activityIcon: {
        fontSize: '20px',
    },
    activityDetails: {
        flex: 1,
    },
    activityMessage: {
        fontSize: '13px',
        color: '#ffffff',
    },
    activityTime: {
        fontSize: '11px',
        color: '#6b7280',
        marginTop: '3px',
    },
    noActivity: {
        textAlign: 'center',
        color: '#6b7280',
        padding: '20px',
    },
    tipsSection: {
        background: '#030303',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    },
    tipsList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    tipItem: {
        fontSize: '13px',
        color: '#1a1a1a',
        padding: '8px 12px',
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        margin: '2px 0',
    },
    loadingContainer: {
        textAlign: 'center',
        padding: '60px',
        background: '#ffffff',
        minHeight: '100vh',
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '3px solid #e5e7eb',
        borderTop: '3px solid #d6336c',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 15px',
    },
    wishlistContainer: {
        background: '#ffffff',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #e5e7eb',
        color: '#1a1a1a',
    },
    wishlistHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        color: '#1a1a1a',
    },
    wishlistFullscreen: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#ffffff',
        zIndex: 20000,
        overflow: 'auto',
        padding: '20px',
        color: '#1a1a1a',
    },
    ordersSection: {
        background: '#ffffff',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #e5e7eb',
        color: '#1a1a1a',
    },
    ordersHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        color: '#1a1a1a',
    },
    ordersList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        marginTop: '15px',
    },
    orderCard: {
        background: '#f9fafb',
        borderRadius: '10px',
        padding: '15px',
        border: '1px solid #e5e7eb',
        color: '#1a1a1a',
    },
    orderHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '10px',
        paddingBottom: '10px',
        borderBottom: '1px solid #e5e7eb',
    },
    orderId: {
        fontWeight: 'bold',
        color: '#d6336c',
    },
    orderDate: {
        fontSize: '12px',
        color: '#6b7280',
    },
    orderDetails: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
    },
    orderProduct: {
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
    },
    orderTotal: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#d6336c',
    },
    orderStatus: {
        textAlign: 'right',
        fontSize: '12px',
    },
    searchesSection: {
        background: '#ffffff',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #e5e7eb',
        color: '#1a1a1a',
    },
    searchesHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        color: '#1a1a1a',
    },
    searchesList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        marginTop: '15px',
    },
    searchCard: {
        background: '#f9fafb',
        borderRadius: '10px',
        padding: '15px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '15px',
        border: '1px solid #e5e7eb',
        color: '#1a1a1a',
    },
    searchInfo: {
        flex: 1,
    },
    searchTerm: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '8px',
    },
    searchFilters: {
        display: 'flex',
        gap: '15px',
        fontSize: '12px',
        color: '#6b7280',
        marginBottom: '5px',
    },
    searchMeta: {
        fontSize: '11px',
        color: '#6b7280',
    },
    searchActions: {
        display: 'flex',
        gap: '10px',
    },
    runSearchBtn: {
        background: '#7c3aed',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
    },
    deleteSearchBtn: {
        background: '#ef4444',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
    },
    dealsSection: {
        background: '#ffffff',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #e5e7eb',
        color: '#1a1a1a',
    },
    dealsHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        color: '#1a1a1a',
    },
    referralsSection: {
        background: '#ffffff',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #e5e7eb',
        color: '#1a1a1a',
    },
    referralsHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        color: '#1a1a1a',
    },
    alertsSection: {
        background: '#ffffff',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #e5e7eb',
        color: '#1a1a1a',
    },
    alertsHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        color: '#1a1a1a',
    },
    emptyState: {
        textAlign: 'center',
        padding: '60px 20px',
        color: '#6b7280',
    },
    emptyStateButton: {
        marginTop: '20px',
        padding: '10px 24px',
        background: 'linear-gradient(135deg, #d6336c, #7c3aed)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
    },
    topNavBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        paddingBottom: '10px',
        borderBottom: '1px solid #e5e7eb',
        position: 'relative',
        background: 'transparent',
    },
    backNavButton: {
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        color: '#1a1a1a',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
        fontWeight: '500',
    },
    navSpacer: {
        flex: 1,
    },
    claimedDealsSection: {
        background: '#ffffff',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #e5e7eb',
        minHeight: '300px',
        color: '#1a1a1a',
    },
    claimedDealsHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        color: '#1a1a1a',
    },
    claimedDealsList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        marginTop: '15px',
    },
    claimedDealCard: {
        display: 'flex',
        gap: '16px',
        background: '#f9fafb',
        borderRadius: '10px',
        padding: '15px',
        border: '1px solid #e5e7eb',
        transition: 'all 0.2s',
        alignItems: 'center',
        color: '#1a1a1a',
    },
    claimedDealImage: {
        width: '80px',
        height: '80px',
        borderRadius: '8px',
        overflow: 'hidden',
        flexShrink: 0,
    },
    claimedDealInfo: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    claimedDealName: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        color: '#1a1a1a',
    },
    claimedDealDetails: {
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap',
        fontSize: '13px',
        color: '#6b7280',
    },
    claimedDealActions: {
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        marginTop: '5px',
    },
};

export default UserDashboard;
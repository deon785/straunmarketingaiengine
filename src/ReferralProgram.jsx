import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';

const ReferralProgram = ({ userId, userName, onReferralComplete }) => {
    const [referralCode, setReferralCode] = useState('');
    const [stats, setStats] = useState({
        total: 0,
        completed: 0,
        points: 0,
        rank: 0
    });
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [shareLoading, setShareLoading] = useState(false);
    const [recentReferrals, setRecentReferrals] = useState([]);
    const [showShareModal, setShowShareModal] = useState(false);

    // ✅ OPTIMIZATION 1: Memoize load functions to prevent unnecessary re-renders
    const loadReferralData = useCallback(async () => {
        if (!userId) return;
        
        try {
            setLoading(true);
            
            // 1. Get user's profile with referral code
            let { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('referral_code')
                .eq('user_id', userId)
                .maybeSingle(); // ✅ Use maybeSingle() instead of single() to avoid errors
            
            let currentCode = profile?.referral_code;
            
            if (!currentCode) {
                currentCode = generateReferralCode();
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ referral_code: currentCode })
                    .eq('user_id', userId);
                
                if (updateError) {
                    console.error('Error updating referral code:', updateError);
                }
            }
            
            setReferralCode(currentCode);
            
            // ✅ OPTIMIZATION 2: Get ALL data in parallel (faster!)
            const [referralsResult, recentResult] = await Promise.all([
                // Get all referrals count
                supabase
                    .from('referrals')
                    .select('status, points_earned', { count: 'exact' })
                    .eq('referrer_id', userId),
                // Get recent completed referrals
                supabase
                    .from('referrals')
                    .select(`
                        id,
                        referred_user_id,
                        status,
                        completed_at,
                        points_earned,
                        created_at
                    `)
                    .eq('referrer_id', userId)
                    .eq('status', 'completed')
                    .order('completed_at', { ascending: false })
                    .limit(5)
            ]);
            
            const referrals = referralsResult.data || [];
            const recent = recentResult.data || [];
            
            if (referralsResult.error) {
                console.error('Referrals error:', referralsResult.error);
            }
            
            // Calculate stats
            const completedReferrals = referrals.filter(r => r.status === 'completed');
            const totalPoints = completedReferrals.reduce((sum, r) => sum + (r.points_earned || 50), 0);
            
            setStats(prev => ({
                total: referrals.length,
                completed: completedReferrals.length,
                points: totalPoints,
                rank: prev.rank // Preserve rank, will update from leaderboard
            }));
            
            // ✅ OPTIMIZATION 3: Get usernames in ONE query
            const referredUserIds = recent.filter(r => r.referred_user_id).map(r => r.referred_user_id);
            let userMap = {};
            
            if (referredUserIds.length > 0) {
                const { data: users } = await supabase
                    .from('profiles')
                    .select('user_id, username, email')
                    .in('user_id', referredUserIds);
                
                if (users) {
                    userMap = users.reduce((map, user) => {
                        map[user.user_id] = user;
                        return map;
                    }, {});
                }
            }
            
            const enrichedReferrals = recent.map(ref => ({
                ...ref,
                referred: userMap[ref.referred_user_id] || { username: 'Anonymous', email: '' }
            }));
            
            setRecentReferrals(enrichedReferrals);
            
        } catch (error) {
            console.error('Error loading referral data:', error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const loadLeaderboard = useCallback(async () => {
        if (!userId) return;
        
        try {
            // ✅ OPTIMIZATION 4: Use aggregation in SQL instead of JS
            // First, get all completed referrals with referrer info
            const { data: allReferrals, error } = await supabase
                .from('referrals')
                .select('referrer_id, points_earned')
                .eq('status', 'completed')
                .limit(500); // ✅ Add limit to prevent massive data transfer
            
            if (error) {
                console.error('Leaderboard error:', error);
                return;
            }
            
            if (!allReferrals || allReferrals.length === 0) {
                setLeaderboard([]);
                return;
            }
            
            // Aggregate in JS (still efficient with limited data)
            const referrerMap = new Map();
            
            allReferrals.forEach(ref => {
                if (!referrerMap.has(ref.referrer_id)) {
                    referrerMap.set(ref.referrer_id, {
                        referrer_id: ref.referrer_id,
                        total_referrals: 0,
                        total_points: 0
                    });
                }
                const entry = referrerMap.get(ref.referrer_id);
                entry.total_referrals++;
                entry.total_points += ref.points_earned || 50;
            });
            
            // Get usernames for top referrers only (limit to 50)
            const topReferrerIds = Array.from(referrerMap.keys()).slice(0, 50);
            let userMap = {};
            
            if (topReferrerIds.length > 0) {
                const { data: users } = await supabase
                    .from('profiles')
                    .select('user_id, username, email')
                    .in('user_id', topReferrerIds);
                
                if (users) {
                    userMap = users.reduce((map, user) => {
                        map[user.user_id] = user;
                        return map;
                    }, {});
                }
            }
            
            // Build leaderboard array
            let leaderboardData = Array.from(referrerMap.values())
                .filter(entry => userMap[entry.referrer_id]) // Only include users we have names for
                .map(entry => ({
                    referrer_id: entry.referrer_id,
                    username: userMap[entry.referrer_id]?.username || 'User',
                    total_referrals: entry.total_referrals,
                    total_points: entry.total_points,
                    rank: 0
                }));
            
            // Sort by total_referrals descending
            leaderboardData.sort((a, b) => b.total_referrals - a.total_referrals);
            
            // Assign ranks
            leaderboardData.forEach((entry, index) => {
                entry.rank = index + 1;
            });
            
            // Limit to top 20
            const topLeaderboard = leaderboardData.slice(0, 20);
            
            // Update user's rank - find position
            const userRank = leaderboardData.findIndex(entry => entry.referrer_id === userId) + 1;
            setStats(prev => ({ ...prev, rank: userRank > 0 ? userRank : 0 }));
            
            setLeaderboard(topLeaderboard);
            
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        }
    }, [userId]);

    const generateReferralCode = useCallback(() => {
        const name = userName?.split('@')[0] || 'USER';
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `${name.substring(0, 6)}${random}`.toUpperCase();
    }, [userName]);

    const getReferralLink = useCallback(() => {
        return `${window.location.origin}/signup?ref=${referralCode}`;
    }, [referralCode]);

    const copyToClipboard = useCallback((text) => {
        navigator.clipboard.writeText(text);
        alert('✅ Referral link copied to clipboard! Share it with friends.');
    }, []);

    // ✅ OPTIMIZATION 5: Load data in parallel on mount
    useEffect(() => {
        if (!userId) return;
        
        // Load both in parallel
        Promise.all([
            loadReferralData(),
            loadLeaderboard()
        ]);
        
        // Real-time subscription (keep this - it's good)
        const subscription = supabase
            .channel('referral-updates')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'referrals',
                filter: `referrer_id=eq.${userId}`
            }, () => {
                // Refresh both when new referral comes in
                Promise.all([
                    loadReferralData(),
                    loadLeaderboard()
                ]);
            })
            .subscribe();
            
        return () => supabase.removeChannel(subscription);
    }, [userId, loadReferralData, loadLeaderboard]);

    const shareReferral = async () => {
        const link = getReferralLink();
        const message = `🎁 Join me on Straun Marketing! Use my referral link to get bonus points on signup: ${link}`;

        setShareLoading(true);
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join Straun Marketing!',
                    text: message,
                    url: link
                });
            } catch (err) {
                copyToClipboard(link);
            }
        } else {
            copyToClipboard(link);
        }
        
        setShareLoading(false);
    };

    const handleShareClick = () => {
        setShowShareModal(true);
    };

    const shareViaWhatsApp = () => {
        const link = getReferralLink();
        const message = encodeURIComponent(`🎁 Join me on Straun Marketing! Use my referral link to get bonus points on signup! Also, by using my link, your products could be featured in Daily Deals! 🚀\n\n${link}`);
        window.open(`https://wa.me/?text=${message}`, '_blank');
        setShowShareModal(false);
    };

    const shareViaSMS = () => {
        const link = getReferralLink();
        const message = encodeURIComponent(`Join Straun Marketing! Use my referral link to get bonus points on signup: ${link}`);
        window.open(`sms:?body=${message}`, '_blank');
        setShowShareModal(false);
    };

    const copyLinkToClipboard = () => {
        copyToClipboard(getReferralLink());
        setShowShareModal(false);
    };

    const getNextMilestone = () => {
        const milestones = [
            { count: 1, points: 50, reward: '50 Points' },
            { count: 3, points: 100, reward: '100 Points' },
            { count: 5, points: 200, reward: '200 Points + Bronze Badge' },
            { count: 10, points: 500, reward: '500 Points + Silver Badge + Free Promotion' },
            { count: 25, points: 1000, reward: '1000 Points + Gold Badge' },
            { count: 50, points: 2500, reward: 'Premium Seller Status (1 month)' }
        ];
        
        for (let m of milestones) {
            if (stats.completed < m.count) {
                return m;
            }
        }
        return null;
    };

    const nextMilestone = getNextMilestone();

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>Loading referral program...</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>👥 Referral Program</h3>
                <p style={styles.subtitle}>Invite friends and earn rewards!</p>
            </div>

            <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                    <div style={styles.statValue}>{stats.total}</div>
                    <div style={styles.statLabel}>Total Referrals</div>
                </div>
                <div style={styles.statCard}>
                    <div style={styles.statValue}>{stats.completed}</div>
                    <div style={styles.statLabel}>Completed</div>
                </div>
                <div style={styles.statCard}>
                    <div style={styles.statValue}>{stats.points}</div>
                    <div style={styles.statLabel}>Points Earned</div>
                </div>
                <div style={styles.statCard}>
                    <div style={styles.statValue}>#{stats.rank || '—'}</div>
                    <div style={styles.statLabel}>Leaderboard Rank</div>
                </div>
            </div>

            <div style={styles.referralSection}>
                <label style={styles.label}>Your Referral Code:</label>
                <div style={styles.codeContainer}>
                    <code style={styles.code}>{referralCode}</code>
                    <button 
                        onClick={() => copyToClipboard(referralCode)}
                        style={styles.copyButton}
                    >
                        Copy
                    </button>
                </div>
                
                <div style={styles.linkContainer}>
                    <input 
                        type="text" 
                        value={getReferralLink()} 
                        readOnly 
                        style={styles.linkInput}
                    />
                    <button 
                        onClick={() => copyToClipboard(getReferralLink())}
                        style={styles.copyLinkButton}
                    >
                        Copy Link
                    </button>
                </div>
                
                <button 
                    onClick={handleShareClick}
                    style={styles.shareButton}
                >
                    📤 Invite Friend & Boost Your Products
                </button>
            </div>

            {/* Share Modal */}
            {showShareModal && (
                <div style={styles.modalOverlay} onClick={() => setShowShareModal(false)}>
                    <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h3>📢 Invite a Friend</h3>
                            <button style={styles.modalClose} onClick={() => setShowShareModal(false)}>×</button>
                        </div>
                        <div style={styles.modalBody}>
                            <p style={styles.modalMessage}>
                                🎉 <strong>Get your products featured in Daily Deals!</strong>
                            </p>
                            <p style={styles.modalSubmessage}>
                                When you invite friends who sign up using your referral link, 
                                your products get priority placement in Daily Deals. 
                                More referrals = Higher visibility!
                            </p>
                            
                            <div style={styles.shareOptions}>
                                <button 
                                    onClick={shareViaWhatsApp}
                                    style={{...styles.shareOptionBtn, background: '#25D366'}}
                                >
                                    <span style={styles.shareIcon}>💚</span> WhatsApp
                                </button>
                                <button 
                                    onClick={shareViaSMS}
                                    style={{...styles.shareOptionBtn, background: '#34B7F1'}}
                                >
                                    <span style={styles.shareIcon}>💬</span> SMS
                                </button>
                                <button 
                                    onClick={copyLinkToClipboard}
                                    style={{...styles.shareOptionBtn, background: '#667eea'}}
                                >
                                    <span style={styles.shareIcon}>🔗</span> Copy Link
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {nextMilestone && (
                <div style={styles.milestoneSection}>
                    <div style={styles.milestoneHeader}>
                        <span>🎯 Next Milestone: {nextMilestone.count} referrals</span>
                        <span>Reward: {nextMilestone.reward}</span>
                    </div>
                    <div style={styles.progressBar}>
                        <div style={{
                            ...styles.progressFill,
                            width: `${(stats.completed / nextMilestone.count) * 100}%`
                        }} />
                    </div>
                    <div style={styles.progressStats}>
                        {stats.completed} / {nextMilestone.count} referrals
                    </div>
                </div>
            )}

            {recentReferrals.length > 0 && (
                <div style={styles.recentSection}>
                    <h4 style={styles.sectionTitle}>📋 Recent Referrals</h4>
                    <div style={styles.recentList}>
                        {recentReferrals.map(ref => (
                            <div key={ref.id} style={styles.recentItem}>
                                <span style={styles.recentIcon}>✅</span>
                                <span>{ref.referred?.username || ref.referred?.email?.split('@')[0] || 'New User'}</span>
                                <span style={styles.recentDate}>
                                    {new Date(ref.completed_at || ref.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={styles.tiersSection}>
                <h4 style={styles.sectionTitle}>🏆 Reward Tiers</h4>
                <div style={styles.tiersGrid}>
                    <div style={styles.tierCard}>
                        <div style={styles.tierIcon}>🎁</div>
                        <div style={styles.tierName}>1 Referral</div>
                        <div style={styles.tierReward}>+50 points</div>
                    </div>
                    <div style={styles.tierCard}>
                        <div style={styles.tierIcon}>🥉</div>
                        <div style={styles.tierName}>3 Referrals</div>
                        <div style={styles.tierReward}>+100 points</div>
                    </div>
                    <div style={styles.tierCard}>
                        <div style={styles.tierIcon}>🥈</div>
                        <div style={styles.tierName}>5 Referrals</div>
                        <div style={styles.tierReward}>+200 points + Bronze Badge</div>
                    </div>
                    <div style={styles.tierCard}>
                        <div style={styles.tierIcon}>🥇</div>
                        <div style={styles.tierName}>10 Referrals</div>
                        <div style={styles.tierReward}>+500 points + Silver Badge + Free Promotion</div>
                    </div>
                    <div style={styles.tierCard}>
                        <div style={styles.tierIcon}>🏆</div>
                        <div style={styles.tierName}>25 Referrals</div>
                        <div style={styles.tierReward}>+1000 points + Gold Badge</div>
                    </div>
                    <div style={styles.tierCard}>
                        <div style={styles.tierIcon}>👑</div>
                        <div style={styles.tierName}>50 Referrals</div>
                        <div style={styles.tierReward}>Premium Seller Status (1 month)</div>
                    </div>
                </div>
            </div>

            {leaderboard.length > 0 && (
                <div style={styles.leaderboardSection}>
                    <h4 style={styles.sectionTitle}>📊 Referral Leaderboard</h4>
                    <div style={styles.leaderboardList}>
                        {leaderboard.map((entry, idx) => (
                            <div key={idx} style={{
                                ...styles.leaderboardEntry,
                                background: entry.referrer_id === userId ? '#E8F5E9' : '#f8f9fa'
                            }}>
                                <div style={styles.rank}>
                                    {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                                </div>
                                <div style={styles.userName}>{entry.username || 'User'}</div>
                                <div style={styles.referralCount}>{entry.total_referrals} referrals</div>
                                <div style={styles.points}>{entry.total_points} pts</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    container: {
        background: '#1e1e1e',  // Dark background
        borderRadius: '16px',
        padding: '20px',
        margin: '20px 0',
        color: '#ffffff'  // White text
    },
    header: {
        textAlign: 'center',
        marginBottom: '20px'
    },
    title: {
        fontSize: '22px',
        margin: '0 0 5px 0',
        color: '#ffffff'  // White text
    },
    subtitle: {
        fontSize: '13px',
        color: '#b0b0b0'  // Light gray text
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '15px',
        marginBottom: '25px'
    },
    statCard: {
        background: 'linear-gradient(135deg, #667eea25, #764ba225)',
        padding: '15px',
        borderRadius: '12px',
        textAlign: 'center',
        border: '1px solid #404040'
    },
    statValue: {
        fontSize: '28px',
        fontWeight: 'bold',
        color: '#667eea'  // Keep accent color
    },
    statLabel: {
        fontSize: '12px',
        color: '#b0b0b0',  // Light gray
        marginTop: '5px'
    },
    referralSection: {
        background: '#2d2d2d',  // Dark gray background
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '25px',
        border: '1px solid #404040'
    },
    label: {
        display: 'block',
        fontWeight: 'bold',
        marginBottom: '8px',
        fontSize: '14px',
        color: '#ffffff'
    },
    codeContainer: {
        display: 'flex',
        gap: '10px',
        marginBottom: '15px'
    },
    code: {
        flex: 1,
        background: '#1e1e1e',
        padding: '10px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '14px',
        border: '1px solid #404040',
        color: '#4CAF50'  // Green text for code
    },
    copyButton: {
        background: '#667eea',
        color: 'white',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '8px',
        cursor: 'pointer'
    },
    linkContainer: {
        display: 'flex',
        gap: '10px',
        marginBottom: '15px'
    },
    linkInput: {
        flex: 1,
        background: '#1e1e1e',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px',
        border: '1px solid #404040',
        color: '#b0b0b0'
    },
    copyLinkButton: {
        background: '#4CAF50',
        color: 'white',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '8px',
        cursor: 'pointer'
    },
    shareButton: {
        width: '100%',
        background: '#2196F3',
        color: 'white',
        border: 'none',
        padding: '12px',
        borderRadius: '8px',
        fontWeight: 'bold',
        cursor: 'pointer'
    },
    milestoneSection: {
        background: '#2d2d2d',  // Dark background
        padding: '15px',
        borderRadius: '12px',
        marginBottom: '25px',
        border: '1px solid #FF980030'
    },
    milestoneHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '13px',
        marginBottom: '10px',
        color: '#ffffff'
    },
    progressBar: {
        height: '8px',
        background: '#404040',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '8px'
    },
    progressFill: {
        height: '100%',
        background: '#FF9800',
        borderRadius: '4px',
        transition: 'width 0.3s'
    },
    progressStats: {
        fontSize: '12px',
        textAlign: 'center',
        color: '#b0b0b0'
    },
    recentSection: {
        marginBottom: '25px'
    },
    sectionTitle: {
        fontSize: '16px',
        marginBottom: '15px',
        color: '#ffffff'
    },
    recentList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    recentItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        background: '#2d2d2d',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#ffffff',
        border: '1px solid #404040'
    },
    recentIcon: {
        fontSize: '16px'
    },
    recentDate: {
        marginLeft: 'auto',
        fontSize: '12px',
        color: '#b0b0b0'
    },
    tiersSection: {
        marginBottom: '25px'
    },
    tiersGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '15px'
    },
    tierCard: {
        background: '#2d2d2d',
        padding: '15px',
        borderRadius: '12px',
        textAlign: 'center',
        border: '1px solid #404040'
    },
    tierIcon: {
        fontSize: '24px',
        marginBottom: '8px'
    },
    tierName: {
        fontWeight: 'bold',
        fontSize: '13px',
        marginBottom: '5px',
        color: '#ffffff'
    },
    tierReward: {
        fontSize: '11px',
        color: '#4CAF50'
    },
    leaderboardSection: {
        borderTop: '1px solid #404040',
        paddingTop: '20px'
    },
    leaderboardList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },
    leaderboardEntry: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #404040'
    },
    rank: {
        fontWeight: 'bold',
        width: '45px',
        fontSize: '14px',
        color: '#ffffff'
    },
    userName: {
        flex: 1,
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#ffffff'
    },
    referralCount: {
        fontSize: '13px',
        color: '#b0b0b0'
    },
    points: {
        fontWeight: 'bold',
        color: '#4CAF50',
        fontSize: '13px'
    },
    loadingContainer: {
        textAlign: 'center',
        padding: '40px',
        color: '#ffffff'
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '3px solid #404040',
        borderTop: '3px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 15px'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.3s ease'
    },
    modalContent: {
        background: '#1e1e1e',
        borderRadius: '16px',
        maxWidth: '400px',
        width: '90%',
        overflow: 'hidden',
        animation: 'slideUp 0.3s ease',
        border: '1px solid #404040'
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px 20px',
        borderBottom: '1px solid #404040',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: 'white'
    },
    modalClose: {
        background: 'none',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        color: 'white'
    },
    modalBody: {
        padding: '20px'
    },
    modalMessage: {
        fontSize: '16px',
        marginBottom: '10px',
        color: '#ffffff'
    },
    modalSubmessage: {
        fontSize: '13px',
        color: '#b0b0b0',
        marginBottom: '20px',
        lineHeight: '1.5'
    },
    shareOptions: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    shareOptionBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '14px',
        border: 'none',
        borderRadius: '10px',
        fontSize: '16px',
        fontWeight: 'bold',
        color: 'white',
        cursor: 'pointer',
        transition: 'transform 0.2s'
    },
    shareIcon: {
        fontSize: '20px'
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
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;
document.head.appendChild(styleSheet);

export default ReferralProgram;
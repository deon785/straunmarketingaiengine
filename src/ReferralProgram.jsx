import React, { useState, useEffect } from 'react';
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

    useEffect(() => {
        loadReferralData();
        loadLeaderboard();
        
        const subscription = supabase
            .channel('referral-updates')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'referrals',
                filter: `referrer_id=eq.${userId}`
            }, () => {
                loadReferralData();
            })
            .subscribe();
            
        return () => supabase.removeChannel(subscription);
    }, [userId]);

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

    const loadReferralData = async () => {
        try {
            let { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('referral_code')
                .eq('user_id', userId)
                .single();
            
            if (profileError && profileError.code === 'PGRST116') {
                console.log('Profile not found');
            }
            
            let currentCode = profile?.referral_code;
            
            if (!currentCode) {
                currentCode = generateReferralCode();
                await supabase
                    .from('profiles')
                    .update({ referral_code: currentCode })
                    .eq('user_id', userId);
            }
            
            setReferralCode(currentCode);
            
            const { data: referrals, error: referralsError } = await supabase
                .from('referrals')
                .select('*')
                .eq('referrer_id', userId);
            
            if (referralsError) throw referralsError;
            
            const { data: rewards, error: rewardsError } = await supabase
                .from('referral_rewards')
                .select('points_earned')
                .eq('user_id', userId);
            
            if (rewardsError) throw rewardsError;
            
            const completedReferrals = referrals?.filter(r => r.status === 'completed') || [];
            
            const userRank = leaderboard.findIndex(l => l.referrer_id === userId) + 1;
            
            setStats({
                total: referrals?.length || 0,
                completed: completedReferrals.length,
                points: rewards?.reduce((sum, r) => sum + r.points_earned, 0) || 0,
                rank: userRank || 0
            });
            
            const { data: recent } = await supabase
                .from('referrals')
                .select(`
                    *,
                    referred:profiles!referred_user_id (username, email)
                `)
                .eq('referrer_id', userId)
                .eq('status', 'completed')
                .order('completed_at', { ascending: false })
                .limit(5);
            
            setRecentReferrals(recent || []);
            
        } catch (error) {
            console.error('Error loading referral data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadLeaderboard = async () => {
        const { data } = await supabase
            .from('referral_leaderboard')
            .select('referrer_id, username, total_referrals, total_points, rank')
            .order('rank', { ascending: true })
            .limit(20);
        
        setLeaderboard(data || []);
    };

    const generateReferralCode = () => {
        const name = userName?.split('@')[0] || 'USER';
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `${name.substring(0, 6)}${random}`.toUpperCase();
    };

    const getReferralLink = () => {
        return `${window.location.origin}/?ref=${referralCode}`;
    };

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

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('✅ Referral link copied to clipboard! Share it with friends.');
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
                                    {new Date(ref.completed_at).toLocaleDateString()}
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
        background: 'white',
        borderRadius: '16px',
        padding: '20px',
        margin: '20px 0'
    },
    header: {
        textAlign: 'center',
        marginBottom: '20px'
    },
    title: {
        fontSize: '22px',
        margin: '0 0 5px 0',
        color: '#333'
    },
    subtitle: {
        fontSize: '13px',
        color: '#666'
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '15px',
        marginBottom: '25px'
    },
    statCard: {
        background: 'linear-gradient(135deg, #667eea15, #764ba215)',
        padding: '15px',
        borderRadius: '12px',
        textAlign: 'center'
    },
    statValue: {
        fontSize: '28px',
        fontWeight: 'bold',
        color: '#667eea'
    },
    statLabel: {
        fontSize: '12px',
        color: '#666',
        marginTop: '5px'
    },
    referralSection: {
        background: '#f8f9fa',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '25px'
    },
    label: {
        display: 'block',
        fontWeight: 'bold',
        marginBottom: '8px',
        fontSize: '14px'
    },
    codeContainer: {
        display: 'flex',
        gap: '10px',
        marginBottom: '15px'
    },
    code: {
        flex: 1,
        background: 'white',
        padding: '10px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '14px',
        border: '1px solid #ddd'
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
        background: 'white',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px',
        border: '1px solid #ddd',
        color: '#666'
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
        background: '#FFF3E0',
        padding: '15px',
        borderRadius: '12px',
        marginBottom: '25px'
    },
    milestoneHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '13px',
        marginBottom: '10px'
    },
    progressBar: {
        height: '8px',
        background: '#E0E0E0',
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
        color: '#666'
    },
    recentSection: {
        marginBottom: '25px'
    },
    sectionTitle: {
        fontSize: '16px',
        marginBottom: '15px',
        color: '#333'
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
        background: '#f8f9fa',
        borderRadius: '8px',
        fontSize: '14px'
    },
    recentIcon: {
        fontSize: '16px'
    },
    recentDate: {
        marginLeft: 'auto',
        fontSize: '12px',
        color: '#999'
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
        background: '#f8f9fa',
        padding: '15px',
        borderRadius: '12px',
        textAlign: 'center'
    },
    tierIcon: {
        fontSize: '24px',
        marginBottom: '8px'
    },
    tierName: {
        fontWeight: 'bold',
        fontSize: '13px',
        marginBottom: '5px'
    },
    tierReward: {
        fontSize: '11px',
        color: '#4CAF50'
    },
    leaderboardSection: {
        borderTop: '1px solid #e0e0e0',
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
        borderRadius: '8px'
    },
    rank: {
        fontWeight: 'bold',
        width: '45px',
        fontSize: '14px'
    },
    userName: {
        flex: 1,
        fontWeight: 'bold',
        fontSize: '14px'
    },
    referralCount: {
        fontSize: '13px',
        color: '#666'
    },
    points: {
        fontWeight: 'bold',
        color: '#4CAF50',
        fontSize: '13px'
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
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.3s ease'
    },
    modalContent: {
        background: 'white',
        borderRadius: '16px',
        maxWidth: '400px',
        width: '90%',
        overflow: 'hidden',
        animation: 'slideUp 0.3s ease'
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px 20px',
        borderBottom: '1px solid #eee',
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
        color: '#333'
    },
    modalSubmessage: {
        fontSize: '13px',
        color: '#666',
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
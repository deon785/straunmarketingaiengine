import React from 'react';
import { useNavigate } from 'react-router-dom';
import DailyDeals from './DailyDeals';
import { useAuthState, useAuthActions } from './AuthContext';

const DealsPage = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthState();
    const { setMode } = useAuthActions();

    // ✅ When a GUEST clicks "Claim Deal", send them to login with intent
    const handleClaimRequiresLogin = (deal) => {
        if (isAuthenticated && user) {
            // Logged in -> go to app in buyer mode
            setMode('buyer');
            // ✅ Save the deal they wanted so we can pre-fill interest after signup
            if (deal?.product?.name) {
                localStorage.setItem('straun_pending_interest', deal.product.name);
            }
            setTimeout(() => navigate('/app'), 100);
        } else {
            // Guest -> save what they wanted, then login
            if (deal?.product?.name) {
                localStorage.setItem('straun_pending_interest', deal.product.name);
            }
            navigate('/login?intent=buyer');
        }
    };

    const handleReturnHome = () => navigate('/');

    const handleExplore = () => {
        if (isAuthenticated && user) {
            navigate('/app');
        } else {
            navigate('/login?intent=buyer');
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0f0f13',
            color: 'white',
            paddingBottom: '120px'
        }}>
            {/* HEADER */}
            <header style={{
                background: '#ffffff',
                padding: '16px 40px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src="/Straun-logo.png" alt="Straun"
                        style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                        <span style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>STRAUN</span>
                        <span style={{
                            fontSize: '9px', fontWeight: 600, color: '#7c3aed',
                            letterSpacing: '1.5px', textTransform: 'uppercase'
                        }}>MARKETING AI</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <button onClick={handleReturnHome} style={{
                        background: 'none', border: 'none', color: '#4b5563',
                        fontSize: '14px', fontWeight: 600, cursor: 'pointer'
                    }}>
                        ← Back to Home
                    </button>
                    {!isAuthenticated && (
                        <button onClick={() => navigate('/login?intent=buyer')} style={{
                            background: '#7c3aed', color: 'white', border: 'none',
                            padding: '10px 24px', borderRadius: '6px',
                            fontSize: '14px', fontWeight: 700, cursor: 'pointer'
                        }}>
                            Sign Up Free
                        </button>
                    )}
                </div>
            </header>

            {/* TITLE */}
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px 20px 20px' }}>
                <h1 style={{
                    fontSize: '2.5rem', fontWeight: 900,
                    marginBottom: '8px', letterSpacing: '-1px'
                }}>
                    🔥 Today's Daily Deals
                </h1>
                <p style={{ color: '#9ca3af', fontSize: '1rem' }}>
                    {isAuthenticated
                        ? 'Personalized deals based on your interests'
                        : 'Browse freely — sign in to claim any deal'}
                </p>
            </div>

            {/* DEALS GRID */}
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
                <DailyDeals
                    userId={user?.id || null}
                    userReferralCount={0}
                    onClaimDeal={handleClaimRequiresLogin}
                />
            </div>

            {/* FIXED BOTTOM BUTTONS */}
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'rgba(15, 15, 19, 0.95)',
                backdropFilter: 'blur(10px)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                padding: '16px 20px',
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 999
            }}>
                <button onClick={handleReturnHome} style={{
                    background: 'transparent', color: 'white',
                    border: '2px solid #7c3aed',
                    padding: '14px 32px', borderRadius: '8px',
                    fontWeight: 700, fontSize: '15px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124, 58, 237, 0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    🏠 Return to Home
                </button>

                <button onClick={handleExplore} style={{
                    background: 'linear-gradient(135deg, #7c3aed, #ef4444)',
                    color: 'white', border: 'none',
                    padding: '14px 32px', borderRadius: '8px',
                    fontWeight: 700, fontSize: '15px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 20px rgba(124, 58, 237, 0.4)',
                    transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 25px rgba(124, 58, 237, 0.6)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(124, 58, 237, 0.4)';
                }}>
                    🚀 Explore Straun Social
                </button>
            </div>
        </div>
    );
};

export default DealsPage;
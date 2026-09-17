import React, { useState } from 'react';
import DailyDeals from './DailyDeals';
import { useNavigate } from 'react-router-dom';
import { useAuthState, useAuthActions } from './AuthContext';
import './App.css'
import UserDashboard from './UserDashboard';
import UserAvatarMenu from './UserAvatarMenu';
import { supabase } from './lib/supabase'; // ✅ Import supabase to force sign-out

const Homepage = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthState();
    const { setMode, clearAuthState } = useAuthActions();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

     const goToLogin = async () => {
        if (isAuthenticated) {
            try {
                clearAuthState();
                await supabase.auth.signOut();
                localStorage.removeItem('straun_selectedMode');
                localStorage.removeItem('straun_selectedMode_timestamp');
                localStorage.removeItem('straun_selectedMode_user');
                localStorage.removeItem('straun_profileComplete');
            } catch (e) { console.warn(e); }
        }
        navigate('/login?fresh=true');
    };

    // ✅ FIND PRODUCTS → Buyer flow
    const handleStartBuying = () => {
        if (isAuthenticated && user) {
            // Already logged in → set mode and go straight to buyer decision
            setMode('buyer');
            setTimeout(() => {
                navigate('/buyer-decision');
            }, 100);
        } else {
            // Not logged in → login with intent
            // After login, signup.jsx will send them to /buyer-decision
            navigate('/login?intent=buyer');
        }
    };

    // ✅ START SELLING → Seller flow
    const handleStartSelling = () => {
        if (isAuthenticated && user) {
            setMode('seller');
            setTimeout(() => {
                navigate('/seller-decision');
            }, 100);
        } else {
            navigate('/login?intent=seller');
        }
    };
    
    // ✅ VIEW ALL DEALS → Public deals page
    const handleViewAllDeals = () => {
        navigate('/deals');
    };

     const ViewDashboard = () => {
        navigate('/dashboard');
    };

    return (
        <div className="homepage-wrapper">
            {/* ✅ STYLES BLOCKED HERE TO PREVENT CONFLICTS */}
            <style>{`
                /* RESET FOR HOMEPAGE ONLY */
                .homepage-wrapper * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }
                .homepage-wrapper {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background-color: #0f0f13;
                    color: white;
                    min-height: 100vh;
                    width: 100%;
                }

                /* ============================================ */
                /* --- WHITE NAVBAR --- */
                /* ============================================ */
                .hp-nav {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 40px;
                    z-index: 1000;
                    background: #ffffff;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    gap: 24px;
                }

                /* ✅ LEFT GROUP: Hamburger + Logo + Name */
                .hp-nav-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-shrink: 0;
                }

                .hp-logo-group {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .hp-logo-img {
                    width: 40px;
                    height: 40px;
                    object-fit: contain;
                }

                .hp-logo-text {
                    display: flex;
                    flex-direction: column;
                    line-height: 1.1;
                    white-space: nowrap;
                }

                .hp-brand-name {
                    font-size: 18px;
                    font-weight: 800;
                    color: #111827;
                    letter-spacing: -0.5px;
                }

                .hp-brand-sub {
                    font-size: 9px;
                    font-weight: 600;
                    color: #7c3aed;
                    letter-spacing: 1.5px;
                    text-transform: uppercase;
                }

                /* ✅ CENTER: Desktop nav links */
                .hp-nav-links {
                    display: flex;
                    gap: 32px;
                    align-items: center;
                    margin: 0 auto;
                }

                .hp-nav-links a {
                    color: #4b5563;
                    text-decoration: none;
                    font-size: 15px;
                    font-weight: 600;
                    transition: color 0.2s;
                    white-space: nowrap;
                }

                .hp-nav-links a:hover {
                    color: #7c3aed;
                }

                /* ✅ RIGHT GROUP: Sign Up Free OR Globe */
                .hp-nav-auth {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-shrink: 0;
                }

                .hp-signup-btn {
                    background: #7c3aed;
                    color: white;
                    border: none;
                    padding: 10px 24px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: background 0.2s;
                    white-space: nowrap;
                }

                .hp-signup-btn:hover {
                    background: #6d28d9;
                }

                .hp-login-btn {
                    background: none;
                    border: none;
                    color: #4b5563;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: color 0.2s;
                }

                .hp-login-btn:hover {
                    color: #7c3aed;
                }

                /* ✅ Hamburger — hidden on desktop */
                .hp-hamburger {
                    display: none;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #111827;
                    padding: 6px 10px;
                    border-radius: 8px;
                    transition: background 0.15s;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                }

                .hp-hamburger:hover {
                    background: #f3f4f6;
                }

                /* ============================================ */
                /* --- MOBILE DRAWER (slides from LEFT) --- */
                /* ============================================ */
                .hp-mobile-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 1099;
                    animation: hpFadeIn 0.2s ease;
                }

                .hp-mobile-drawer {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 280px;
                    max-width: 85vw;
                    height: 100vh;
                    background: #ffffff;
                    z-index: 1100;
                    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
                    display: flex;
                    flex-direction: column;
                    animation: hpSlideInLeft 0.25s ease;
                }

                .hp-mobile-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid #e5e7eb;
                }

                .hp-mobile-title {
                    font-size: 16px;
                    font-weight: 700;
                    color: #111827;
                }

                .hp-mobile-close {
                    background: none;
                    border: none;
                    font-size: 22px;
                    cursor: pointer;
                    color: #6b7280;
                    padding: 4px 8px;
                }

                .hp-mobile-nav {
                    display: flex;
                    flex-direction: column;
                    padding: 12px 0;
                    flex: 1;
                }

                .hp-mobile-nav a {
                    padding: 14px 24px;
                    color: #111827;
                    text-decoration: none;
                    font-size: 15px;
                    font-weight: 600;
                    transition: background 0.15s;
                }

                .hp-mobile-nav a:hover {
                    background: #f9fafb;
                    color: #7c3aed;
                }

                .hp-mobile-divider {
                    height: 1px;
                    background: #e5e7eb;
                    margin: 8px 16px;
                }

                .hp-mobile-login {
                    padding: 14px 24px;
                    background: none;
                    border: none;
                    text-align: left;
                    font-size: 15px;
                    font-weight: 600;
                    color: #7c3aed;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .hp-mobile-login:hover {
                    background: #f9fafb;
                }

                @keyframes hpFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes hpSlideInLeft {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(0); }
                }

                /* ============================================ */
                /* --- HERO SECTION --- */
                /* ============================================ */
                .hp-hero {
                    position: relative;
                    padding: 180px 20px 120px 20px;
                    text-align: center;
                    background-color: #0f0f13;
                    background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0l17.32 10v20L20 40 2.68 30V10z' fill='%23ffffff' fill-opacity='0.05'/%3E%3C/svg%3E");
                    border-bottom: 1px solid #2d2d2d;
                    overflow: hidden;
                }
                .hp-hero::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 50%;
                    background: linear-gradient(to bottom, rgba(15, 15, 19, 0) 0%, #0f0f13 100%);
                    pointer-events: none;
                }
                .hp-hero-content {
                    position: relative;
                    z-index: 2;
                    max-width: 900px;
                    margin: 0 auto;
                }
                .hp-hero-title {
                    font-size: 4.5rem;
                    font-weight: 900;
                    line-height: 1.1;
                    margin-bottom: 24px;
                    letter-spacing: -2px;
                    font-family: 'Inter', sans-serif;
                    color: white;
                }
                .hp-gradient-text {
                    background: linear-gradient(135deg, #a855f7, #ef4444);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .hp-hero-subtitle {
                    font-size: 1.2rem;
                    color: #9ca3af;
                    max-width: 700px;
                    margin: 0 auto 40px auto;
                    line-height: 1.6;
                }
                .hp-hero-actions {
                    display: flex;
                    gap: 16px;
                    justify-content: center;
                }
                .hp-btn-primary {
                    background: white;
                    color: #0f0f13;
                    padding: 16px 36px;
                    border-radius: 6px;
                    font-weight: 700;
                    font-size: 16px;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .hp-btn-primary:hover { background: #e5e7eb; }
                .hp-btn-secondary {
                    background: transparent;
                    color: #a855f7;
                    border: 2px solid #7c3aed;
                    padding: 16px 36px;
                    border-radius: 6px;
                    font-weight: 700;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .hp-btn-secondary:hover { background: rgba(124, 58, 237, 0.1); color: white; }

                /* ============================================ */
                /* --- DASHBOARD SECTION --- */
                /* ============================================ */
                .hp-dashboard {
                    background-color: #ffffff;
                    padding: 80px 20px;
                    color: #111827;
                }
                .hp-section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    max-width: 1200px;
                    margin: 0 auto 40px auto;
                }
                .hp-section-title {
                    font-size: 2.2rem;
                    font-weight: 800;
                    color: #111827;
                }
                .hp-section-subtitle {
                    font-size: 1rem;
                    color: #6b7280;
                    margin-top: 6px;
                }
                .hp-view-all {
                    color: #7c3aed;
                    font-weight: 700;
                    text-decoration: none;
                    font-size: 1rem;
                    background: none;
                    border: none;
                    cursor: pointer;
                }
                .hp-view-all:hover { text-decoration: underline; }

                /* ============================================ */
                /* --- FEATURES SECTION --- */
                /* ============================================ */
                .hp-features {
                    background: #0f0f13;
                    padding: 100px 20px;
                }
                .hp-features-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 60px;
                    max-width: 1200px;
                    margin: 0 auto;
                    align-items: center;
                }
                .hp-features-text h2 {
                    font-size: 2.5rem;
                    font-weight: 800;
                    margin-bottom: 20px;
                }
                .hp-features-text p {
                    color: #9ca3af;
                    font-size: 1.1rem;
                    line-height: 1.6;
                    margin-bottom: 40px;
                }
                .hp-feature-list {
                    list-style: none;
                    display: flex;
                    flex-direction: column;
                    gap: 28px;
                }
                .hp-feature-item {
                    display: flex;
                    gap: 16px;
                    align-items: flex-start;
                }
                .hp-feature-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    flex-shrink: 0;
                }
                .hp-icon-purple { background: rgba(124, 58, 237, 0.2); color: #c084fc; }
                .hp-icon-red { background: rgba(239, 68, 68, 0.2); color: #f87171; }
                .hp-icon-blue { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
                .hp-feature-item h4 { font-size: 1.1rem; font-weight: 700; margin-bottom: 4px; }
                .hp-feature-item p { color: #9ca3af; font-size: 0.9rem; margin: 0; }

                /* --- MOCKUP CARD --- */
                .hp-mockup {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    padding: 30px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
                }
                .hp-mockup-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    padding-bottom: 16px;
                    margin-bottom: 24px;
                }
                .hp-mockup-header h3 { font-size: 1.1rem; }
                .hp-live-badge {
                    background: rgba(16, 185, 129, 0.2);
                    color: #34d399;
                    border: 1px solid rgba(16, 185, 129, 0.3);
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .hp-mockup-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                    margin-bottom: 12px;
                }
                .hp-mockup-left { display: flex; align-items: center; gap: 12px; }
                .hp-mockup-icon {
                    width: 40px; height: 40px; border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                }
                .hp-mockup-label { font-size: 0.95rem; font-weight: 600; }
                .hp-mockup-sub { font-size: 0.8rem; color: #6b7280; }
                .hp-mockup-stat { color: #34d399; font-weight: 700; font-size: 0.9rem; }
                .hp-mockup-btn {
                    width: 100%; padding: 16px; background: white; color: #0f0f13;
                    border: none; border-radius: 10px; font-weight: 700; font-size: 1rem;
                    cursor: pointer; margin-top: 16px;
                }
                .hp-mockup-btn:hover { background: #e5e7eb; }

                /* ============================================ */
                /* --- FOOTER --- */
                /* ============================================ */
                .hp-footer {
                    background: #0a0a0c; padding: 30px; text-align: center;
                    color: #6b7280; font-size: 14px; border-top: 1px solid #2d2d2d;
                }

                /* ============================================ */
                /* --- RESPONSIVE: TABLET --- */
                /* ============================================ */
                @media (max-width: 900px) {
                    .hp-features-grid { grid-template-columns: 1fr; gap: 40px; }
                    .hp-hero-title { font-size: 3rem; }
                }

                /* ============================================ */
                /* --- RESPONSIVE: MOBILE --- */
                /* ============================================ */
                @media (max-width: 768px) {
                    .hp-nav {
                        padding: 10px 14px;
                        gap: 8px;
                    }

                    /* ✅ Show hamburger on mobile — on the LEFT */
                    .hp-hamburger {
                        display: flex;
                    }

                    /* ✅ Compact left group */
                    .hp-nav-left {
                        gap: 6px;
                    }
                    .hp-logo-group {
                        gap: 8px;
                    }
                    .hp-logo-img {
                        width: 32px;
                        height: 32px;
                    }
                    .hp-brand-name {
                        font-size: 16px;
                    }
                    .hp-brand-sub {
                        font-size: 8px;
                        letter-spacing: 1px;
                    }

                    /* ✅ Hide desktop nav links */
                    .hp-nav-links {
                        display: none;
                    }

                    /* ✅ Compact right side */
                    .hp-nav-auth {
                        gap: 8px;
                        flex-shrink: 0;
                    }

                    /* ✅ Hide "Log In" text button on mobile — it's in the drawer */
                    .hp-login-btn {
                        display: none;
                    }

                    /* ✅ Compact Sign Up button */
                    .hp-signup-btn {
                        padding: 8px 14px;
                        font-size: 13px;
                    }

                    /* Hero + sections */
                    .hp-hero { padding: 140px 20px 80px 20px; }
                    .hp-hero-title { font-size: 2.5rem; letter-spacing: -1px; }
                    .hp-hero-subtitle { font-size: 1rem; }
                    .hp-hero-actions { flex-direction: column; }
                    .hp-btn-primary, .hp-btn-secondary { width: 100%; }
                    .hp-section-header { flex-direction: column; align-items: flex-start; gap: 10px; }
                    .hp-dashboard, .hp-features { padding: 50px 20px; }
                }

                /* ============================================ */
                /* --- RESPONSIVE: TINY PHONES --- */
                /* ============================================ */
                @media (max-width: 380px) {
                    .hp-brand-sub {
                        display: none;
                    }
                    .hp-signup-btn {
                        padding: 6px 12px;
                        font-size: 12px;
                    }
                    .hp-hamburger {
                        font-size: 22px;
                        padding: 4px 8px;
                    }
                }
            `}</style>

            {/* ===== 1. WHITE NAVBAR ===== */}
            <nav className="hp-nav">
                {/* LEFT SIDE: Hamburger (mobile only) + Logo + Brand */}
                <div className="hp-nav-left">
                    <button 
                        className="hp-hamburger"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Menu"
                    >
                        ☰
                    </button>

                    <div className="hp-logo-group">
                        <img src="/Straun-logo.png" alt="Straun Logo" className="hp-logo-img" />
                        <div className="hp-logo-text">
                            <span className="hp-brand-name">STRAUN</span>
                            <span className="hp-brand-sub">MARKETING AI</span>
                        </div>
                    </div>
                </div>

                {/* CENTER: Desktop nav links */}
                <div className="hp-nav-links">
                    <a href="Homepage">Home</a>
                    <a href="dashboard">Dashboard</a>
                    <a href="buyer-decision">Buy</a>
                    <a href="seller-decision">Sell</a>
                </div>

                {/* RIGHT SIDE: Sign Up Free (logged out) OR Globe (logged in) */}
                <div className="hp-nav-auth">
                    {!isAuthenticated && (
                        <button onClick={goToLogin} className="hp-signup-btn">
                            Sign Up Free
                        </button>
                    )}
                    {isAuthenticated && <UserAvatarMenu />}
                </div>
            </nav>

            {/* ✅ Mobile menu drawer */}
            {mobileMenuOpen && (
                <>
                    {/* Backdrop */}
                    <div 
                        className="hp-mobile-overlay"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                    
                    {/* Drawer */}
                    <div className="hp-mobile-drawer">
                        <div className="hp-mobile-header">
                            <span className="hp-mobile-title">Menu</span>
                            <button 
                                className="hp-mobile-close"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <nav className="hp-mobile-nav">
                            <a href="Homepage" onClick={() => setMobileMenuOpen(false)}>🏠 Home</a>
                            <a href="dashboard" onClick={() => setMobileMenuOpen(false)}>📊 Dashboard</a>
                            <a href="buyer-decision" onClick={() => setMobileMenuOpen(false)}>🛒 Buy</a>
                            <a href="seller-decision" onClick={() => setMobileMenuOpen(false)}>💼 Sell</a>
                            
                            {!isAuthenticated && (
                                <>
                                    <div className="hp-mobile-divider" />
                                    <button 
                                        className="hp-mobile-login" 
                                        onClick={() => { setMobileMenuOpen(false); goToLogin(); }}
                                    >
                                        🔑 Log In
                                    </button>
                                </>
                            )}
                        </nav>
                    </div>
                </>
            )}

            {/* ===== 2. HERO SECTION ===== */}
            <header className="hp-hero">
                <div className="hp-hero-content">
                    <h1 className="hp-hero-title">
                        Reigning Supreme <br />
                        <span className="hp-gradient-text">In The Market</span>
                    </h1>
                    <p className="hp-hero-subtitle">
                        The Straun Marketing AI Engine connects Buyers and Sellers intelligently. 
                        Grow your business, maximize your potential, and get more sales.
                    </p>
                    <div className="hp-hero-actions">
                        <button className="hp-btn-primary" onClick={handleStartBuying}>
                            Find Products
                        </button>
                        <button className="hp-btn-secondary" onClick={handleStartSelling}>
                            Start Selling
                        </button>
                    </div>
                </div>
            </header>

            {/* ===== 3. DASHBOARD SECTION (WHITE) ===== */}
            <section className="hp-dashboard">
                <div className="hp-section-header">
                    <div>
                        <h2 className="hp-section-title">Today's Dashboard</h2>
                        <p className="hp-section-subtitle">Live deals generated by our AI engine.</p>
                    </div>
                    <button onClick={handleViewAllDeals} className="hp-view-all">
                        View All Deals →
                    </button>
                </div>

                <DailyDeals 
                    userId={user?.id || null}
                    userReferralCount={0}
                    onClaimDeal={() => {
                        if (!isAuthenticated) navigate('/login');
                    }}
                />
            </section>

            {/* ===== 4. FEATURES SECTION (DARK) ===== */}
            <section className="hp-features">
                <div className="hp-features-grid">
                    <div className="hp-features-text">
                        <h2>Why Choose Straun AI?</h2>
                        <p>We don't just list products. Our AI engine actively matches buyers with the right sellers.</p>
                        <ul className="hp-feature-list">
                            <li className="hp-feature-item">
                                <div className="hp-feature-icon hp-icon-purple">✓</div>
                                <div>
                                    <h4>Intelligent Matching</h4>
                                    <p>Our algorithms find exactly what your customers are looking for.</p>
                                </div>
                            </li>
                            <li className="hp-feature-item">
                                <div className="hp-feature-icon hp-icon-red">⚡</div>
                                <div>
                                    <h4>Daily Deal Dashboard</h4>
                                    <p>Automated daily deals that keep buyers coming back.</p>
                                </div>
                            </li>
                            <li className="hp-feature-item">
                                <div className="hp-feature-icon hp-icon-blue">📈</div>
                                <div>
                                    <h4>Full-Service Marketing</h4>
                                    <p>Graphics, branding, and advertising built right in.</p>
                                </div>
                            </li>
                        </ul>
                    </div>

                    <div className="hp-mockup">
                        <div className="hp-mockup-header">
                            <h3>Live Market Data</h3>
                            <span className="hp-live-badge">Live</span>
                        </div>
                        <div className="hp-mockup-row">
                            <div className="hp-mockup-left">
                                <div className="hp-mockup-icon hp-icon-purple">📱</div>
                                <div>
                                    <div className="hp-mockup-label">Smartphones</div>
                                    <div className="hp-mockup-sub">124 Active Listings</div>
                                </div>
                            </div>
                            <span className="hp-mockup-stat">+15%</span>
                        </div>
                        <div className="hp-mockup-row">
                            <div className="hp-mockup-left">
                                <div className="hp-mockup-icon hp-icon-red">🚗</div>
                                <div>
                                    <div className="hp-mockup-label">Vehicles</div>
                                    <div className="hp-mockup-sub">89 Active Listings</div>
                                </div>
                            </div>
                            <span className="hp-mockup-stat">+8%</span>
                        </div>
                        <div className="hp-mockup-row">
                            <div className="hp-mockup-left">
                                <div className="hp-mockup-icon hp-icon-blue">🏠</div>
                                <div>
                                    <div className="hp-mockup-label">Real Estate</div>
                                    <div className="hp-mockup-sub">45 Active Listings</div>
                                </div>
                            </div>
                            <span className="hp-mockup-stat">+22%</span>
                        </div>
                        <button className="hp-mockup-btn" onClick={handleStartBuying}>
                            View Full Dashboard
                        </button>
                    </div>
                </div>
            </section>

            {/* ===== 5. FOOTER ===== */}
            <footer className="hp-footer">
                © 2025 Straun Marketing AI Engine. All rights reserved.
            </footer>
        </div>
    );
};

export default Homepage;
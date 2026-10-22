import React, { useState, useEffect } from 'react';
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
    const [tickerItems, setTickerItems] = useState([]);

    useEffect(() => {
        let mounted = true;

        const loadTicker = async () => {
            try {
                const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // last 2 hours

                // 1) Most recent product listings
                const { data: products, error: pErr } = await supabase
                    .from('products')
                    .select('name, location, created_at, seller_id')
                    .gte('created_at', since)
                    .order('created_at', { ascending: false })
                    .limit(8);

                // 2) Most recent searches
                const { data: searches, error: sErr } = await supabase
                    .from('searches')
                    .select('product_name, created_at')
                    .gte('created_at', since)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (pErr) console.warn('[Ticker] products fetch failed:', pErr.message);
                if (sErr) console.warn('[Ticker] searches fetch failed:', sErr.message);

                const items = [];

                // One item per unique seller (avoid same seller spamming the ticker)
                const seenSellers = new Set();
                (products || []).forEach((p) => {
                    if (!p?.name) return;
                    if (p.seller_id && seenSellers.has(p.seller_id)) return;
                    if (p.seller_id) seenSellers.add(p.seller_id);

                    const where = p.location ? ` in ${p.location}` : '';
                    items.push(`🛒 New listing: "${p.name}"${where}`);
                });

                // Searches (deduplicated by product_name)
                const seenSearches = new Set();
                (searches || []).forEach((s) => {
                    if (!s?.product_name) return;
                    const key = s.product_name.toLowerCase();
                    if (seenSearches.has(key)) return;
                    seenSearches.add(key);

                    items.push(`🔍 Someone is searching for "${s.product_name}"`);
                });

                // Fallback so the ticker is never empty
                if (items.length < 3) {
                    items.push('👶 New baby clothes added every day');
                    items.push('🍼 Browse prams, toys, and nursery essentials');
                    items.push('✅ Join thousands of parents buying & selling');
                    items.push('🚀 Powered by Straun Marketing AI');
                }

                if (mounted) {
                    setTickerItems(items.slice(0, 8)); // cap at 8 so it doesn't run too long
                }
            } catch (err) {
                console.warn('[Ticker] load failed:', err);
                if (mounted) {
                    setTickerItems([
                        '🛒 New listings added every day',
                        '📱 Browse phones, cars, furniture, and more',
                        '✅ Join thousands of buyers & sellers',
                        '🚀 Powered by Straun Marketing AI',
                    ]);
                }
            }
        };

        loadTicker();
        const interval = setInterval(loadTicker, 60_000); // refresh every 60s

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

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
            setMode('buyer');
            setTimeout(() => {
                navigate('/buyer-decision');
            }, 100);
        } else {
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
                    background-color: #fffffff9;
                    color: #0f172a;
                    min-height: 100vh;
                    width: 100%;
                }

                /* ============================================ */
                /* --- BLACK NAVBAR (with search + ticker) --- */
                /* ============================================ */
                .hp-nav {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 24px;
                    z-index: 1000;
                    background: #23232a;
                    box-shadow: 0 1px 0 rgba(255,255,255,0.06), 0 4px 20px -8px rgba(0,0,0,0.5);
                    gap: 18px;
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
                    width: 34px;
                    height: 34px;
                    object-fit: contain;
                }

                .hp-logo-text {
                    display: flex;
                    flex-direction: column;
                    line-height: 1.1;
                    white-space: nowrap;
                }

                .hp-brand-name {
                    font-size: 16px;
                    font-weight: 800;
                    color: #ffffff;
                    letter-spacing: -0.3px;
                }

                .hp-brand-sub {
                    font-size: 9px;
                    font-weight: 600;
                    color: #c4b5fd;
                    letter-spacing: 1.4px;
                    text-transform: uppercase;
                }

                /* ✅ NEW: Search bar inside nav */
                .hp-nav-search {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    background: #17171a;
                    border: 1px solid #2a2a30;
                    border-radius: 9px;
                    padding: 0 12px;
                    height: 40px;
                    max-width: 520px;
                    transition: border-color 0.15s ease, background 0.15s ease;
                }
                .hp-nav-search:focus-within {
                    border-color: #7c3aed;
                    background: #1c1c22;
                }
                .hp-nav-search .hp-search-icon {
                    color: #8a8a92;
                    font-size: 15px;
                    margin-right: 8px;
                }
                .hp-nav-search input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    outline: none;
                    color: #f1f1f4;
                    font-size: 14px;
                    font-family: inherit;
                }
                .hp-nav-search input::placeholder { color: #7a7a84; }

                /* ✅ NEW: Location pill */
                .hp-nav-loc {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: #17171a;
                    border: 1px solid #2a2a30;
                    color: #d1d1d8;
                    padding: 0 12px;
                    height: 40px;
                    border-radius: 9px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    flex-shrink: 0;
                    transition: border-color 0.15s ease, background 0.15s ease;
                    font-family: inherit;
                }
                .hp-nav-loc:hover { background: #1c1c22; border-color: #3a3a44; }

                /* ✅ CENTER: Desktop nav links (kept for compatibility, hidden if not used) */
                .hp-nav-links {
                    display: flex;
                    gap: 28px;
                    align-items: center;
                }

                .hp-nav-links a {
                    color: #cbcbd4;
                    text-decoration: none;
                    font-size: 14px;
                    font-weight: 500;
                    transition: color 0.15s;
                    white-space: nowrap;
                }

                .hp-nav-links a:hover {
                    color: #ffffff;
                }

                /* ✅ RIGHT GROUP: Sign Up Free OR Avatar */
                .hp-nav-auth {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-shrink: 0;
                }

                .hp-signup-btn {
                    background: #7c3aed;
                    color: white;
                    border: none;
                    padding: 0 20px;
                    height: 40px;
                    border-radius: 9px;
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: background 0.15s, transform 0.15s;
                    white-space: nowrap;
                    font-family: inherit;
                }

                .hp-signup-btn:hover {
                    background: #6d28d9;
                    transform: translateY(-1px);
                }

                .hp-login-btn {
                    background: none;
                    border: none;
                    color: #cbcbd4;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: color 0.15s;
                    font-family: inherit;
                }

                .hp-login-btn:hover {
                    color: #ffffff;
                }

                /* ✅ Hamburger — hidden on desktop */
                .hp-hamburger {
                    display: none;
                    background: none;
                    border: none;
                    font-size: 22px;
                    cursor: pointer;
                    color: #ffffff;
                    padding: 6px 10px;
                    border-radius: 8px;
                    transition: background 0.15s;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                }

                .hp-hamburger:hover {
                    background: rgba(255,255,255,0.08);
                }

                /* ✅ NEW: Live ticker strip below the nav */
                .hp-ticker {
                    position: fixed;
                    top: 64px;
                    left: 0;
                    right: 0;
                    height: 34px;
                    background: #0a0a0a;
                    border-bottom: 1px solid #1a1a1a;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    padding: 0 24px;
                    font-size: 13px;
                    z-index: 999;
                }
                .hp-ticker-label {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    color: #4ade80;
                    font-weight: 700;
                    font-size: 11px;
                    letter-spacing: 0.8px;
                    padding-right: 14px;
                    border-right: 1px solid #1f1f24;
                    margin-right: 14px;
                    flex-shrink: 0;
                }
                .hp-ticker-label .hp-ticker-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #22c55e;
                }
                .hp-ticker-viewport {
                    flex: 1;
                    overflow: hidden;
                    position: relative;
                    height: 100%;
                }
                .hp-ticker-track {
                    display: flex;
                    gap: 40px;
                    align-items: center;
                    height: 100%;
                    white-space: nowrap;
                    animation: hpTickerScroll var(--ticker-duration, 40s) linear infinite;
                }
                .hp-ticker-item { color: #a8a8b3; }
                .hp-ticker-item strong { color: #ffffff; font-weight: 600; }
                @keyframes hpTickerScroll {
                    from { transform: translateX(0); }
                    to { transform: translateX(-50%); }
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
                /* --- HERO SECTION (NEW DARK OVERLAY) --- */
                /* ============================================ */
                .hp-hero-dark {
                    position: relative;
                    height: 100vh;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    overflow: hidden;
                    padding-top: 98px; /* Account for nav + ticker */
                }

                .hp-hero-dark-bg {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    /* ✅ The baby image from Pexels (free for commercial use) */
                    background-image: url('/baby-hero.avif');
                    background-size: cover;
                    background-position: center;
                    z-index: 1;
                    transform: scale(1.05);
                }

                .hp-hero-dark-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    /* ✅ Dark overlay matching the flyer aesthetic */
                    background: linear-gradient(
                        135deg,
                        rgba(26, 26, 46, 0.95) 0%,
                        rgba(26, 26, 46, 0.7) 50%,
                        rgba(26, 26, 46, 0.4) 100%
                    );
                    z-index: 2;
                }

                .hp-hero-dark-content {
                    position: relative;
                    z-index: 3;
                    max-width: 800px;
                    padding: 2rem;
                    color: white;
                    animation: hpFadeIn 1s ease-out;
                }

                .hp-hero-dark-title {
                    font-size: 4rem;
                    line-height: 1.1;
                    margin-bottom: 1.5rem;
                    font-weight: 800;
                    letter-spacing: -1px;
                }

                .hp-hero-dark-title span {
                    color: #d6336c; /* Magenta from your brand */
                }

                .hp-hero-dark-subtitle {
                    font-size: 1.2rem;
                    color: #e0e0e0;
                    margin-bottom: 2.5rem;
                    line-height: 1.6;
                    max-width: 600px;
                    margin-left: auto;
                    margin-right: auto;
                }

                .hp-hero-dark-actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                }

                /* --- BUTTONS (DARK HERO) --- */
                .hp-btn-dark-primary {
                    background-color: #0f172a;
                    color: white;
                    padding: 1rem 2.5rem;
                    border-radius: 50px;
                    font-weight: 700;
                    font-size: 1rem;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(15, 23, 42, 0.4);
                    font-family: inherit;
                }
                .hp-btn-dark-primary:hover {
                    background-color: #1e293b;
                    transform: translateY(-3px);
                    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.6);
                }

                .hp-btn-dark-secondary {
                    background-color: #d6336c;
                    color: white;
                    padding: 1rem 2.5rem;
                    border-radius: 50px;
                    font-weight: 700;
                    font-size: 1rem;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(214, 51, 108, 0.4);
                    font-family: inherit;
                }
                .hp-btn-dark-secondary:hover {
                    background-color: #b02a56;
                    transform: translateY(-3px);
                    box-shadow: 0 6px 20px rgba(214, 51, 108, 0.6);
                }

                /* ============================================ */
                /* --- DASHBOARD SECTION (soft grey) --- */
                /* ============================================ */
                .hp-dashboard {
                    background-color: #f4f6f8;
                    padding: 80px 20px;
                    color: #0f172a;
                    border-bottom: 1px solid #eaeef2;
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
                    color: #0f172a;
                    letter-spacing: -0.5px;
                }
                .hp-section-subtitle {
                    font-size: 1rem;
                    color: #8291a9;
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
                    font-family: inherit;
                }
                .hp-view-all:hover { text-decoration: underline; }

                /* ============================================ */
                /* --- FEATURES SECTION (white) --- */
                /* ============================================ */
                .hp-features {
                    background: #ffffff;
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
                    color: #0f172a;
                    letter-spacing: -0.5px;
                }
                .hp-features-text p {
                    color: #52607a;
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
                    border: 1px solid;
                }
                .hp-icon-purple { background: #f5f3ff; color: #7c3aed; border-color: #ede9fe; }
                .hp-icon-red    { background: #fdf2f8; color: #db2777; border-color: #fce7f3; }
                .hp-icon-blue   { background: #eff6ff; color: #2563eb; border-color: #dbeafe; }
                .hp-feature-item h4 { font-size: 1.1rem; font-weight: 700; margin-bottom: 4px; color: #0f172a; }
                .hp-feature-item p { color: #52607a; font-size: 0.9rem; margin: 0; }

                /* --- MOCKUP CARD --- */
                .hp-mockup {
                    background: #fbfcfd;
                    border: 1px solid #eaeef2;
                    border-radius: 20px;
                    padding: 30px;
                    box-shadow: 0 1px 2px rgba(15,23,42,0.03), 0 20px 40px -20px rgba(15,23,42,0.12);
                }
                .hp-mockup-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #eaeef2;
                    padding-bottom: 16px;
                    margin-bottom: 24px;
                }
                .hp-mockup-header h3 { font-size: 1.1rem; color: #0f172a; }
                .hp-live-badge {
                    background: #ecfdf5;
                    color: #047857;
                    border: 1px solid #d1fae5;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .hp-mockup-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    background: #ffffff;
                    border: 1px solid #eaeef2;
                    border-radius: 12px;
                    margin-bottom: 12px;
                }
                .hp-mockup-left { display: flex; align-items: center; gap: 12px; }
                .hp-mockup-icon {
                    width: 40px; height: 40px; border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                }
                .hp-mockup-label { font-size: 0.95rem; font-weight: 600; color: #0f172a; }
                .hp-mockup-sub { font-size: 0.8rem; color: #8291a9; }
                .hp-mockup-stat { color: #047857; font-weight: 700; font-size: 0.9rem; }
                .hp-mockup-btn {
                    width: 100%; padding: 16px; background: #0f172a; color: #ffffff;
                    border: none; border-radius: 10px; font-weight: 700; font-size: 1rem;
                    cursor: pointer; margin-top: 16px;
                    font-family: inherit;
                }
                .hp-mockup-btn:hover { background: #1e293b; }

                /* ============================================ */
                /* --- FOOTER --- */
                /* ============================================ */
                .hp-footer {
                    background: #fbfcfd; padding: 30px; text-align: center;
                    color: #8291a9; font-size: 14px; border-top: 1px solid #eaeef2;
                }

                /* ============================================ */
                /* --- RESPONSIVE: TABLET --- */
                /* ============================================ */
                @media (max-width: 900px) {
                    .hp-features-grid { grid-template-columns: 1fr; gap: 40px; }
                    .hp-hero-dark-title { font-size: 3rem; }
                    .hp-nav-search { max-width: 320px; }
                    .hp-nav-loc { display: none; }
                }

                /* ============================================ */
                /* --- RESPONSIVE: MOBILE --- */
                /* ============================================ */
                @media (max-width: 768px) {
                    .hp-nav {
                        padding: 10px 14px;
                        gap: 8px;
                    }

                    .hp-hamburger {
                        display: flex;
                    }

                    .hp-nav-left {
                        gap: 6px;
                    }
                    .hp-logo-group {
                        gap: 8px;
                    }
                    .hp-logo-img {
                        width: 30px;
                        height: 30px;
                    }
                    .hp-brand-name {
                        font-size: 15px;
                    }
                    .hp-brand-sub {
                        font-size: 8px;
                        letter-spacing: 1px;
                    }

                    .hp-nav-search { display: none; }
                    .hp-nav-loc { display: none; }
                    .hp-nav-links { display: none; }
                    .hp-login-btn { display: none; }

                    .hp-signup-btn {
                        padding: 0 14px;
                        height: 34px;
                        font-size: 12px;
                    }

                    .hp-nav { height: 54px; }
                    .hp-ticker { top: 54px; height: 30px; font-size: 12px; }

                    .hp-hero-dark { padding-top: 84px; height: auto; min-height: 100vh; }
                    .hp-hero-dark-title { font-size: 2.4rem; letter-spacing: -1px; }
                    .hp-hero-dark-subtitle { font-size: 1rem; }
                    .hp-hero-dark-actions { flex-direction: column; }
                    .hp-btn-dark-primary, .hp-btn-dark-secondary { width: 100%; }

                    .hp-section-header { flex-direction: column; align-items: flex-start; gap: 10px; }
                    .hp-section-title { font-size: 1.8rem; }
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
                        padding: 0 10px;
                        font-size: 11px;
                    }
                    .hp-hamburger {
                        font-size: 20px;
                        padding: 4px 8px;
                    }
                }
            `}</style>

            {/* ===== 1. BLACK NAVBAR with SEARCH ===== */}
            <nav className="hp-nav">
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

                <div className="hp-nav-links">
                    <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Home</a>
                    <a href="/dashboard" onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}>Dashboard</a>
                    <a href="/buyer-decision" onClick={(e) => { e.preventDefault(); handleStartBuying(); }}>Buy</a>
                    <a href="/seller-decision" onClick={(e) => { e.preventDefault(); handleStartSelling(); }}>Sell</a>
                </div>

                <div className="hp-nav-auth">
                    {!isAuthenticated && (
                        <button onClick={goToLogin} className="hp-signup-btn">
                            Sign Up Free
                        </button>
                    )}
                    {isAuthenticated && <UserAvatarMenu />}
                </div>
            </nav>

            {/* ===== 2. LIVE TICKER STRIP ===== */}
            <div className="hp-ticker">
                <span className="hp-ticker-label">
                    <span className="hp-ticker-dot"></span>LIVE
                </span>
                <div className="hp-ticker-viewport">
                    <div className="hp-ticker-track">
                        {tickerItems.concat(tickerItems).map((item, i) => (
                            <span key={i} className="hp-ticker-item">{item}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* ===== 3. MOBILE MENU DRAWER ===== */}
            {mobileMenuOpen && (
                <>
                    <div 
                        className="hp-mobile-overlay"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                    
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
                            <a 
                                href="/" 
                                onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); navigate('/'); }}
                            >
                                🏠 Home
                            </a>
                            <a 
                                href="/dashboard" 
                                onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); navigate('/dashboard'); }}
                            >
                                📊 Dashboard
                            </a>
                            <a 
                                href="/buyer-decision" 
                                onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); handleStartBuying(); }}
                            >
                                🛒 Buy
                            </a>
                            <a 
                                href="/seller-decision" 
                                onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); handleStartSelling(); }}
                            >
                                💼 Sell
                            </a>
                            
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

            {/* ===== 4. HERO SECTION (DARK OVERLAY - NEW DESIGN) ===== */}
                        {/* ===== 4. HERO SECTION (DARK OVERLAY - NEW DESIGN) ===== */}
            <header className="hp-hero-dark">
                <div className="hp-hero-dark-bg"></div>
                <div className="hp-hero-dark-overlay"></div>
                <div className="hp-hero-dark-content">
                    
                    {/* ✅ Trusted by parents - Forced Italic */}
                    <h3 style={{ fontStyle: 'italic', marginBottom: '10px', fontWeight: '500' }}>
                        🤝 Trusted by parents
                    </h3>
                    
                    {/* ✅ H1 and H2 styling applied correctly inline */}
                    <h1 style={{ fontSize: 'calc(4rem + 4px)', margin: '0 0 20px 0', fontWeight: '800', lineHeight: '1.1' }}>
                        Dress Your Little One<br />
                        <h2 style={{ fontSize: 'inherit', color: '#c4b5fd', fontWeight: 'bold', margin: 0, display: 'inline' }}>
                            In Comfort
                        </h2>
                    </h1>
                    
                    <p 
                        className="hp-hero-dark-subtitle" 
                        style={{ 
                            textShadow: '0 0 10px rgba(196, 181, 253, 0.8), 0 0 20px rgba(196, 181, 253, 0.5)',
                            color: '#ffffff'
                        }}
                    >
                        Your Local MarketPlace For Baby Fashion. Shop Brand-New Clothes, Rompers, And Cozy Sets From Trusted Local Sellers. 
                        Discover Unique Styles And Keep Your Baby Smiling In Ultimate Comfort.
                    </p>
                    <div className="hp-hero-dark-actions">
                        <button className="hp-btn-dark-primary" onClick={handleStartBuying}>
                            Browse Baby Clothes
                        </button>
                        <button className="hp-btn-dark-secondary" onClick={handleStartSelling}>
                            Start Selling
                        </button>
                    </div>
                </div>
            </header>
            
            {/* ===== 5. DASHBOARD SECTION (SOFT GREY) ===== */}
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

            {/* ===== 6. FEATURES SECTION (WHITE) ===== */}
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

            {/* ===== 7. FOOTER ===== */}
            <footer className="hp-footer">
                © 2025 Straun Marketing AI Engine. All rights reserved.
            </footer>
        </div>
    );
};

export default Homepage;
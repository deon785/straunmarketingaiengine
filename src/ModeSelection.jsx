// src/ModeSelection.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState, useAuthActions } from './AuthContext';
import { supabase } from './lib/supabase';
import './App.css';

const ModeSelection = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated, selectedMode } = useAuthState();
    const { setMode, clearAuthState } = useAuthActions();

    // ✅ If mode is already set and valid, skip to /app
    React.useEffect(() => {
        if (selectedMode) {
            const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
            const MODE_EXPIRY_MS = 60 * 60 * 1000;
            
            if (timestamp) {
                const age = Date.now() - parseInt(timestamp);
                if (age < MODE_EXPIRY_MS) {
                    console.log('✅ [ModeSelection] Active mode found, redirecting to /app');
                    navigate('/app', { replace: true });
                    return;
                }
            }
        }
    }, [selectedMode, navigate]);

    // ✅ Safe navigation
    const safeNavigate = (path) => {
        try {
            navigate(path);
        } catch (err) {
            console.warn('[ModeSelection] Navigation failed:', err);
            try {
                window.location.href = path;
            } catch (fallbackErr) {
                console.error('[ModeSelection] Fallback failed:', fallbackErr);
            }
        }
    };

    // ✅ Handle mode selection
    const handleModeSelect = (mode) => {
        console.log(`🚀 [ModeSelection] User selected: ${mode}`);
        
        // Set mode in AuthContext (saves to localStorage)
        setMode(mode);
        
        // Navigate to decision page
        setTimeout(() => {
            if (mode === 'buyer') {
                safeNavigate('/buyer-decision');
            } else if (mode === 'seller') {
                safeNavigate('/seller-decision');
            }
        }, 100);
    };

    // ✅ Handle back to login
    const handleBack = async () => {
        try {
            clearAuthState();
            await supabase.auth.signOut();
            localStorage.removeItem('straun_selectedMode');
            localStorage.removeItem('straun_selectedMode_timestamp');
            localStorage.removeItem('straun_selectedMode_user');
            localStorage.removeItem('straun_profileComplete');
        } catch (e) {
            console.warn('[ModeSelection] Sign out error:', e);
        }
        safeNavigate('/login');
    };

    return (
        <div className="mode-selection-page" style={{ minHeight: '100vh', background: '#1e1e1e' }}>
            <div className="app-container">
                <div className="mode-selection-screen">
                    
                    <div className="mode-selection-header">
                        <h1 className="mode-selection-title">
                            Welcome to Straun Marketing AI Engine
                        </h1>
                        <p className="mode-selection-subtitle">
                            {user?.email 
                                ? `Signed in as ${user.email}` 
                                : 'Choose how you want to use the platform:'}
                        </p>
                        <p className="mode-selection-required">
                            <strong>Important:</strong> You must complete the setup form for your chosen mode before proceeding.
                        </p>
                    </div>
                    
                    <div className="mode-selection-cards">
                        <div className="mode-card seller-mode-card">
                            <div className="mode-card-icon">🛒</div>
                            <h2 className="mode-card-title">I'm a Seller</h2>
                            <p className="mode-card-description">
                                List your products and find customers who are interested in what you're selling.
                            </p>
                            <button 
                                onClick={() => handleModeSelect('seller')}
                                className="mode-card-button"
                            >
                                Choose Seller Mode
                            </button>
                            <div className="mode-requirements">
                                <p><strong>Required for Seller Setup:</strong></p>
                                <ul className="mode-features">
                                    <li>Your location</li>
                                    <li>Phone number</li>
                                    <li>At least one product to sell</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div className="mode-card buyer-mode-card">
                            <div className="mode-card-icon">🔍</div>
                            <h2 className="mode-card-title">I'm a Buyer</h2>
                            <p className="mode-card-description">
                                Find products you're looking for and connect with sellers in your area.
                            </p>
                            <button 
                                onClick={() => handleModeSelect('buyer')}
                                className="mode-card-button"
                            >
                                Choose Buyer Mode
                            </button>
                            <div className="mode-requirements">
                                <p><strong>Required for Buyer Setup:</strong></p>
                                <ul className="mode-features">
                                    <li>Your location</li>
                                    <li>Phone number</li>
                                    <li>Products you're interested in</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mode-selection-footer">
                        <p className="mode-note">
                            <strong>Note:</strong> You will be required to complete a setup form for your chosen mode.
                        </p>
                        <button
                            onClick={handleBack}
                            style={{
                                marginTop: '20px',
                                background: 'none',
                                border: 'none',
                                color: '#666',
                                cursor: 'pointer',
                                fontSize: '14px',
                                textDecoration: 'underline'
                            }}
                        >
                            ← Back to Login
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModeSelection;
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState, useAuthActions } from './AuthContext';
import { supabase } from './lib/supabase';

const UserAvatarMenu = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthState();
    const { clearAuthState } = useAuthActions();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSignOut = async () => {
        try {
            clearAuthState();
            await supabase.auth.signOut();
            localStorage.removeItem('straun_selectedMode');
            localStorage.removeItem('straun_selectedMode_timestamp');
            localStorage.removeItem('straun_selectedMode_user');
            localStorage.removeItem('straun_profileComplete');
            setIsOpen(false);
            navigate('/');
        } catch (err) {
            console.error('Sign out failed:', err);
        }
    };

    // ===== NOT LOGGED IN: Show Globe + Log In =====
    if (!isAuthenticated || !user) {
        return (
            <button
                onClick={() => navigate('/login')}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#4b5563',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: '20px',
                    transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)';
                    e.currentTarget.style.color = '#7c3aed';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#4b5563';
                }}
            >
                <span style={{ fontSize: '20px' }}>🌐</span>
                Log In
            </button>
        );
    }

    // ===== LOGGED IN: Show Globe + Green Dot + Dropdown =====
    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Globe Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: isOpen ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: '20px',
                    transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)';
                }}
                onMouseLeave={(e) => {
                    if (!isOpen) e.currentTarget.style.background = 'transparent';
                }}
            >
                {/* Globe with green active dot */}
                <div style={{ position: 'relative', display: 'flex' }}>
                    <span style={{ fontSize: '22px' }}>🌐</span>
                    {/* Green "active session" dot */}
                    <div style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-4px',
                        width: '10px',
                        height: '10px',
                        background: '#22c55e',
                        borderRadius: '50%',
                        border: '2px solid white',
                        boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)'
                    }} />
                </div>

                {/* Chevron */}
                <span style={{
                    fontSize: '11px',
                    color: '#6b7280',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                }}>
                    ▼
                </span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: '260px',
                    maxWidth: '320px',
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '16px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
                    padding: '8px',
                    zIndex: 1000,
                    animation: 'slideDown 0.2s ease'
                }}>
                    {/* User Info Header */}
                    <div style={{
                        padding: '14px',
                        borderBottom: '1px solid #f3f4f6',
                        marginBottom: '6px'
                    }}>
                        <div style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#9ca3af',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '6px'
                        }}>
                            Signed in as
                        </div>
                        <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#111827',
                            wordBreak: 'break-all',
                            lineHeight: 1.4
                        }}>
                            {user.email}
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: '#22c55e',
                            marginTop: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}>
                            <span style={{
                                width: '6px',
                                height: '6px',
                                background: '#22c55e',
                                borderRadius: '50%',
                                boxShadow: '0 0 4px rgba(34, 197, 94, 0.6)'
                            }} />
                            Active session
                        </div>
                    </div>

                    {/* Menu Items */}
                    <button
                        onClick={() => { setIsOpen(false); navigate('/dashboard'); }}
                        style={menuItemStyle}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        📊 Dashboard
                    </button>

                    <button
                        onClick={() => { setIsOpen(false); navigate('/deals'); }}
                        style={menuItemStyle}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        🔥 Daily Deals
                    </button>

                    <div style={{ height: '1px', background: '#f3f4f6', margin: '6px 0' }} />

                    <button
                        onClick={handleSignOut}
                        style={{
                            ...menuItemStyle,
                            color: '#dc2626'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        🚪 Sign Out
                    </button>
                </div>
            )}

            <style>{`
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

const menuItemStyle = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    textAlign: 'left',
    padding: '10px 14px',
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500',
    cursor: 'pointer',
    borderRadius: '8px',
    transition: 'background 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
};

export default UserAvatarMenu;
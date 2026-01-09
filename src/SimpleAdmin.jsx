// SimpleAdmin.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import AdminDashboard from './AdminDashboard'; // Your existing admin dashboard

const SimpleAdmin = () => {
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [showAccessDenied, setShowAccessDenied] = useState(false);

    useEffect(() => {
        checkAdminAccess();
    }, []);

    const checkAdminAccess = async () => {
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                setShowAccessDenied(true);
                return;
            }
            
            setUserEmail(user.email || '');
            
            // Check if email matches admin email
            const isAdminUser = user.email === 'deonmahachi8@gmail.com';
            
            setIsAdmin(isAdminUser);
            
            if (!isAdminUser) {
                console.log(`Access denied. User email: ${user.email}, Required: deonmahachi8@gmail.com`);
            }
            
        } catch (error) {
            console.error('Error checking admin access:', error);
            setShowAccessDenied(true);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                flexDirection: 'column',
                gap: '20px'
            }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>🔐 Checking Admin Access...</div>
                <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #667eea',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }}></div>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                flexDirection: 'column',
                gap: '20px',
                padding: '20px',
                textAlign: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white'
            }}>
                <div style={{ fontSize: '64px' }}>🚫</div>
                <h1 style={{ fontSize: '32px', margin: 0 }}>Admin Access Denied</h1>
                <p style={{ fontSize: '18px', opacity: 0.9, maxWidth: '600px' }}>
                    This admin dashboard is restricted to <strong>deonmahachi8@gmail.com</strong> only.
                </p>
                
                {userEmail && (
                    <div style={{ 
                        background: 'rgba(255,255,255,0.1)', 
                        padding: '15px', 
                        borderRadius: '10px',
                        marginTop: '20px'
                    }}>
                        <p style={{ margin: 0 }}>You are logged in as: <strong>{userEmail}</strong></p>
                    </div>
                )}
                
                <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                    <button
                        onClick={() => window.location.href = '/app'}
                        style={{
                            padding: '12px 30px',
                            background: 'white',
                            color: '#667eea',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                    >
                        Go to Main App
                    </button>
                    
                    <button
                        onClick={() => supabase.auth.signOut().then(() => window.location.href = '/signup')}
                        style={{
                            padding: '12px 30px',
                            background: 'transparent',
                            color: 'white',
                            border: '2px solid white',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                        Sign Out
                    </button>
                </div>
                
                <div style={{ 
                    marginTop: '40px', 
                    background: 'rgba(0,0,0,0.2)', 
                    padding: '20px', 
                    borderRadius: '10px', 
                    maxWidth: '700px',
                    textAlign: 'left'
                }}>
                    <h3 style={{ marginTop: 0 }}>Access Instructions:</h3>
                    <ol style={{ paddingLeft: '20px' }}>
                        <li>Sign out of your current account</li>
                        <li>Sign in with <strong>deonmahachi8@gmail.com</strong></li>
                        <li>Come back to this page</li>
                    </ol>
                    <p style={{ fontStyle: 'italic', opacity: 0.8 }}>
                        Note: Only the email <strong>deonmahachi8@gmail.com</strong> has admin privileges.
                    </p>
                </div>
            </div>
        );
    }

    // User is admin - show the full admin dashboard
    return <AdminDashboard />;
};

export default SimpleAdmin;
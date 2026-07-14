// SimpleAdmin.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase'; 
import AdminDashboard from './AdminDashboard'; // Your existing admin dashboard

// ✅ Add fetchWithRetry helper
const fetchWithRetry = async (fetchFn, maxRetries = 3) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFn();
    } catch (err) {
      lastError = err;
      console.warn(`Fetch attempt ${i + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  throw lastError;
};

const SimpleAdmin = () => {
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [showAccessDenied, setShowAccessDenied] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        checkAdminAccess();
    }, []);

    const checkAdminAccess = async () => {
        // ✅ Check offline status
        if (!navigator.onLine) {
            setError('You are offline. Please connect to the internet to verify admin access.');
            setShowAccessDenied(true);
            setLoading(false);
            return;
        }

        try {
            setError(null);
            
            // ✅ Use fetchWithRetry
            const userResult = await fetchWithRetry(() => supabase.auth.getUser());
            
            if (userResult.error) {
                console.error('Error getting user:', userResult.error);
                setError('Unable to verify admin status. Please try again.');
                setShowAccessDenied(true);
                return;
            }
            
            const user = userResult.data?.user;
            
            if (!user) {
                setShowAccessDenied(true);
                return;
            }
            
            setUserEmail(user.email || '');
            
            // Check if email matches admin email
            const adminEmail = 'deonmahachi8@gmail.com';
            const isAdminUser = user.email === adminEmail;
            
            setIsAdmin(isAdminUser);
            
            if (!isAdminUser) {
                console.log(`Access denied. User email: ${user.email}, Required: ${adminEmail}`);
            }
            
        } catch (error) {
            console.error('Error checking admin access:', error);
            setError(error.message || 'Failed to verify admin access');
            setShowAccessDenied(true);
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        try {
            // ✅ Clear state
            setIsAdmin(false);
            setUserEmail('');
            setError(null);
            
            await supabase.auth.signOut();
            window.location.href = '/';
        } catch (err) {
            console.error('Error signing out:', err);
            setError('Failed to sign out. Please try again.');
        }
    };

    const handleGoToApp = () => {
        window.location.href = '/app';
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
                
                {/* Error Message with Retry Button */}
                {error && (
                    <div style={{ 
                        background: 'rgba(255,0,0,0.3)', 
                        padding: '10px 20px', 
                        borderRadius: '8px',
                        marginTop: '10px'
                    }}>
                        <p style={{ margin: 0, fontSize: '14px' }}>⚠️ {error}</p>
                        <button
                            onClick={checkAdminAccess}
                            style={{
                                marginTop: '10px',
                                padding: '8px 16px',
                                background: 'white',
                                color: '#667eea',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            🔄 Retry
                        </button>
                    </div>
                )}
                
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
                
                <div style={{ display: 'flex', gap: '15px', marginTop: '30px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                        onClick={handleGoToApp}
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
                        onClick={handleSignOut}
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
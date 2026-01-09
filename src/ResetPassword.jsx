import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import './Signup.css';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [accessToken, setAccessToken] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Extract token from URL hash (Supabase puts it in the hash)
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        const type = params.get('type');
        
        console.log('Reset password URL params:', { token, type, hash });

        if (token && type === 'recovery') {
            setAccessToken(token);
            // Set the session with the recovery token
            supabase.auth.setSession({
                access_token: token,
                refresh_token: ''
            }).then(({ data, error }) => {
                if (error) {
                    console.error('Error setting recovery session:', error);
                    setMessage({ 
                        type: 'error', 
                        text: 'Invalid or expired reset link. Please request a new one.' 
                    });
                } else {
                    console.log('Recovery session set successfully');
                }
            });
        } else {
            setMessage({ 
                type: 'error', 
                text: 'Invalid reset link. Please request a new password reset.' 
            });
        }
    }, []);

    const validatePassword = (password) => {
        // At least 6 characters
        return password.length >= 6;
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        
        if (!validatePassword(password)) {
            setMessage({ 
                type: 'error', 
                text: 'Password must be at least 6 characters' 
            });
            return;
        }
        
        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }
        
        setLoading(true);
        setMessage({ type: '', text: '' });
        
        try {
            // Get current session to ensure we're authenticated
            const { data: sessionData } = await supabase.auth.getSession();
            
            if (!sessionData.session) {
                throw new Error('No valid session. Please request a new reset link.');
            }
            
            // Update the password
            const { error } = await supabase.auth.updateUser({
                password: password
            });
            
            if (error) throw error;
            
            setMessage({ 
                type: 'success', 
                text: '✅ Password reset successfully! Redirecting to login...' 
            });
            
            // Sign out to clear the recovery session
            await supabase.auth.signOut();
            
            // Redirect to login after 2 seconds
            setTimeout(() => {
                navigate('/signup');
            }, 2000);
            
        } catch (error) {
            console.error('Password reset error:', error);
            setMessage({ 
                type: 'error', 
                text: error.message || 'Failed to reset password. The link may have expired.' 
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signup-page">
            <div className="auth-page-wrapper">
                <div className="auth-container">
                    <div className="auth-card">
                        <div className="header" style={{ textAlign: 'center', marginBottom: '35px' }}>
                            <div style={{
                                fontSize: '32px',
                                fontWeight: '700',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                marginBottom: '8px'
                            }}>
                                Reset Password
                            </div>
                            <div style={{ color: '#666', fontSize: '16px', fontWeight: '400' }}>
                                Enter your new password
                            </div>
                        </div>

                        {message.text && (
                            <div style={{
                                padding: '12px',
                                borderRadius: '8px',
                                marginBottom: '20px',
                                backgroundColor: message.type === 'error' ? '#fff5f5' : '#f0fff4',
                                color: message.type === 'error' ? '#c53030' : '#2f855a',
                                border: `1px solid ${message.type === 'error' ? '#feb2b2' : '#9ae6b4'}`
                            }}>
                                {message.text}
                            </div>
                        )}

                        {accessToken ? (
                            <form onSubmit={handleResetPassword}>
                                <div style={{ marginBottom: '24px' }}>
                                    <label htmlFor="password" style={{
                                        display: 'block',
                                        color: '#444',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        marginBottom: '8px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        NEW PASSWORD
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            id="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            disabled={loading}
                                            placeholder="At least 6 characters"
                                            autoComplete="new-password"
                                            style={{
                                                width: '100%',
                                                padding: '16px 20px',
                                                borderRadius: '12px',
                                                fontSize: '16px',
                                                border: '2px solid #e2e8f0',
                                                transition: 'all 0.3s ease',
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginBottom: '24px' }}>
                                    <label htmlFor="confirmPassword" style={{
                                        display: 'block',
                                        color: '#444',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        marginBottom: '8px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        CONFIRM PASSWORD
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            id="confirmPassword"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            disabled={loading}
                                            placeholder="Confirm your new password"
                                            autoComplete="new-password"
                                            style={{
                                                width: '100%',
                                                padding: '16px 20px',
                                                borderRadius: '12px',
                                                fontSize: '16px',
                                                border: '2px solid #e2e8f0',
                                                transition: 'all 0.3s ease',
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ 
                                    marginBottom: '20px',
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '10px'
                                }}>
                                    <input 
                                        type="checkbox" 
                                        id="showPassword"
                                        checked={showPassword}
                                        onChange={() => setShowPassword(!showPassword)}
                                        disabled={loading}
                                        style={{ 
                                            cursor: loading ? 'not-allowed' : 'pointer', 
                                            width: '18px', 
                                            height: '18px',
                                            accentColor: '#667eea'
                                        }}
                                    />
                                    <label htmlFor="showPassword" style={{ 
                                        color: '#4a5568', 
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        fontSize: '14px'
                                    }}>
                                        Show password
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        width: '100%',
                                        padding: '18px',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontSize: '16px',
                                        fontWeight: '600',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.3s ease',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        marginTop: '10px',
                                        opacity: loading ? 0.7 : 1
                                    }}
                                    onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-2px)')}
                                    onMouseLeave={(e) => !loading && (e.target.style.transform = 'translateY(0)')}
                                >
                                    {loading ? 'Resetting...' : 'RESET PASSWORD'}
                                </button>
                            </form>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px' }}>
                                <p style={{ color: '#666', marginBottom: '20px' }}>
                                    {message.text || 'Loading reset link...'}
                                </p>
                                <button
                                    onClick={() => navigate('/signup')}
                                    style={{
                                        padding: '12px 24px',
                                        background: '#667eea',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                    }}
                                >
                                    Go to Login
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
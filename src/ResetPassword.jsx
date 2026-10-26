// ResetPassword.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase'; 
import './Signup.css';

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

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState(1);

    const [isValidToken, setIsValidToken] = useState(false);
    const [isProcessing, setIsProcessing] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    // ✅ Memoize styles
    const styles = useMemo(() => ({
        inputStyle: (hasError) => ({
            width: '100%',
            padding: '16px 20px',
            borderRadius: '12px',
            fontSize: '16px',
            border: `2px solid ${hasError ? '#fc8181' : '#e2e8f0'}`,
            transition: 'all 0.3s ease',
            outline: 'none',
            backgroundColor: '#000000',
            color: '#ffffff'
        }),
        buttonStyle: (disabled) => ({
            width: '100%',
            padding: '18px',
            background: disabled ? '#a0aec0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginTop: '10px',
            opacity: disabled ? 0.7 : 1
        })
    }), []);

    useEffect(() => {
        // We don't need to parse URL hashes anymore.
        setIsProcessing(false);
    }, []);

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            // Verify the OTP the user typed
            const { data, error } = await supabase.auth.verifyOtp({
                email: email,
                token: otp,
                type: 'recovery', // 'recovery' is for password resets
            });

            if (error) throw error;

            // If successful, they now have a temporary session to change their password
            setStep(2); 
            setMessage({ type: 'success', text: '✅ Code verified! Please enter your new password.' });

        } catch (error) {
            console.error('OTP Verification error:', error);
            setMessage({ type: 'error', text: 'Invalid or expired code. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const validatePassword = (password) => {
        return password && password.length >= 6;
    };

    // ✅ Use fetchWithRetry and add offline check
    const handleResetPassword = async (e) => {
        e.preventDefault();
        
        // ✅ Check offline status
        if (!navigator.onLine) {
            setMessage({ 
                type: 'error', 
                text: 'You are offline. Please connect to the internet to reset your password.' 
            });
            return;
        }
        
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
            // ✅ Use fetchWithRetry
            const result = await fetchWithRetry(() =>
                supabase.auth.updateUser({
                    password: password
                })
            );
            
            if (result.error) throw result.error;
            
            setMessage({ 
                type: 'success', 
                text: '✅ Password reset successfully! Redirecting to login...' 
            });
            
            setTimeout(async () => {
                try {
                    await supabase.auth.signOut();
                } catch (signOutError) {
                    console.error('Error signing out:', signOutError);
                }
                
                try {
                    sessionStorage.removeItem('onResetPage');
                    sessionStorage.removeItem('passwordResetMode');
                } catch (err) {
                    console.error('Error clearing session storage:', err);
                }
                
                navigate('/', { replace: true });
            }, 2000);
            
        } catch (error) {
            console.error('Password reset error:', error);
            
            if (error.message?.includes('expired')) {
                setMessage({ 
                    type: 'error', 
                    text: 'The reset link has expired. Please request a new password reset.' 
                });
            } else if (error.message?.includes('session')) {
                setMessage({ 
                    type: 'error', 
                    text: 'Session expired. Please request a new password reset link.' 
                });
                setIsValidToken(false);
            } else {
                setMessage({ 
                    type: 'error', 
                    text: error.message || 'Failed to reset password. Please try again.' 
                });
            }
        } finally {
            setLoading(false);
        }
    };

    if (isProcessing) {
        return (
            <div className="signup-page">
                <div className="auth-page-wrapper">
                    <div className="auth-container">
                        <div className="auth-card">
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    border: '3px solid #f3f3f3',
                                    borderTop: '3px solid #667eea',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    margin: '0 auto 15px auto'
                                }} />
                                <p>Verifying reset link...</p>
                                <style>{`
                                    @keyframes spin {
                                        0% { transform: rotate(0deg); }
                                        100% { transform: rotate(360deg); }
                                    }
                                `}</style>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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
                                {step === 1 ? 'Enter the code sent to your email' : 'Create your new password'}
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

                        {/* STEP 1: ENTER OTP */}
                        {step === 1 && (
                            <form onSubmit={handleVerifyOtp}>
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', color: '#444', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                                        EMAIL ADDRESS
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="Enter your email"
                                        style={styles.inputStyle(false)}
                                    />
                                </div>
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', color: '#444', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                                        6-DIGIT CODE
                                    </label>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        required
                                        placeholder="123456"
                                        maxLength="6"
                                        style={{...styles.inputStyle(false), letterSpacing: '5px', textAlign: 'center', fontSize: '24px'}}
                                    />
                                </div>
                                <button type="submit" disabled={loading} style={styles.buttonStyle(loading)}>
                                    {loading ? 'Verifying...' : 'VERIFY CODE'}
                                </button>
                            </form>
                        )}

                        {/* STEP 2: ENTER NEW PASSWORD */}
                        {step === 2 && (
                            <form onSubmit={handleResetPassword}>
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', color: '#444', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                                        NEW PASSWORD
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        placeholder="At least 6 characters"
                                        style={styles.inputStyle(false)}
                                    />
                                </div>
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', color: '#444', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                                        CONFIRM NEW PASSWORD
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        placeholder="Confirm new password"
                                        style={styles.inputStyle(false)}
                                    />
                                </div>
                                <button type="submit" disabled={loading} style={styles.buttonStyle(loading)}>
                                    {loading ? 'Resetting...' : 'RESET PASSWORD'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(ResetPassword);u7
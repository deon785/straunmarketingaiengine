// signup.jsx - COMPLETE CORRECTED VERSION
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBouncer } from './hooks/useBouncer';
import './Signup.css';
import { Link } from 'react-router-dom'; 
import { useNavigation } from './NavigationContext.jsx';
import { useAuthActions } from './AuthContext.jsx';
import { supabase } from './lib/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPhone, 
  faEnvelope, 
  faLock, 
  faUserPlus, 
  faSignInAlt, 
  faSpinner,
  faEye,
  faEyeSlash,
  faCheck,
  faGift
} from '@fortawesome/free-solid-svg-icons';

// Helper function
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

// ============ MEMOIZED INPUT COMPONENTS ============

// 1. Email Input - NO ERROR PROP (errors handled inside)
const EmailInput = React.memo(({ inputRef, disabled }) => {
  return (
    <div style={{ marginBottom: '24px' }}>
      <label htmlFor="email" style={{
        display: 'block',
        color: '#444',
        fontSize: '14px',
        fontWeight: '500',
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        EMAIL ADDRESS
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="email"
          id="email"
          name="email"
          ref={inputRef}
          disabled={disabled}
          placeholder="your.email@example.com"
          autoComplete="email"
          className="form-input"
          style={{
            width: '100%',
            padding: '16px 20px 16px 45px',
            borderRadius: '12px',
            fontSize: '16px',
            background: '#000000',
            border: '1px solid #000000',
            color: '#ffffff',
            WebkitTextFillColor: '#ffffff',
            transition: 'none'
          }}
        />
        <FontAwesomeIcon 
          icon={faEnvelope} 
          style={{
            position: 'absolute',
            left: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#999999',
            fontSize: '18px'
          }}
        />
      </div>
    </div>
  );
});
EmailInput.displayName = 'EmailInput';

// 2. Password Input - Handles its own showPassword state!
const PasswordInput = React.memo(({ inputRef, disabled, isSignUp }) => {
  const [showPassword, setShowPassword] = useState(false);
  
  const toggleVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);
  
  return (
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
        PASSWORD
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={showPassword ? "text" : "password"}
          id="password"
          name="password"
          ref={inputRef}
          disabled={disabled}
          placeholder="At least 6 characters"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          className="form-input"
          style={{
            width: '100%',
            padding: '16px 50px 16px 45px',
            borderRadius: '12px',
            fontSize: '16px',
            background: '#000000',
            border: '1px solid #000000',
            color: '#ffffff',
            WebkitTextFillColor: '#ffffff',
            transition: 'none'
          }}
        />
        <FontAwesomeIcon 
          icon={faLock} 
          style={{
            position: 'absolute',
            left: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#999999',
            fontSize: '18px'
          }}
        />
        
        <button
          type="button"
          onClick={toggleVisibility}
          disabled={disabled}
          style={{
            position: 'absolute',
            right: '15px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            color: '#999',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: '5px 10px',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            borderRadius: '6px',
            opacity: disabled ? 0.5 : 1
          }}
        >
          <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';

// 3. Phone Input
const PhoneInput = React.memo(({ inputRef, disabled }) => {
  return (
    <div style={{ marginBottom: '24px' }}>
      <label htmlFor="phone" style={{
        display: 'block',
        color: '#444',
        fontSize: '14px',
        fontWeight: '500',
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        PHONE NUMBER 
        <span style={{
          display: 'inline-block',
          background: '#f0f2ff',
          color: '#667eea',
          fontSize: '11px',
          padding: '2px 8px',
          borderRadius: '10px',
          marginLeft: '8px',
          fontWeight: '500'
        }}>
          OPTIONAL
        </span>
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="tel"
          id="phone"
          name="phone"
          ref={inputRef}
          disabled={disabled}
          placeholder="+263 123 456 789"
          autoComplete="off"
          className="form-input"
          style={{
            width: '100%',
            padding: '16px 20px 16px 45px',
            borderRadius: '12px',
            fontSize: '16px',
            background: '#000000',
            border: '1px solid #000000',
            color: '#ffffff',
            WebkitTextFillColor: '#ffffff',
            transition: 'none'
          }}
        />
        <FontAwesomeIcon 
          icon={faPhone} 
          style={{
            position: 'absolute',
            left: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#999999',
            fontSize: '18px'
          }}
        />
      </div>
    </div>
  );
});
PhoneInput.displayName = 'PhoneInput';

// 4. Terms Checkbox
const TermsCheckbox = React.memo(({ inputRef, disabled }) => {
  return (
    <div style={{ 
      marginBottom: '20px',
      fontSize: '14px', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '10px',
      padding: '10px',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      border: '1px solid #edf2f7'
    }}>
      <input 
        type="checkbox" 
        id="terms"
        ref={inputRef}
        disabled={disabled}
        style={{ 
          cursor: disabled ? 'not-allowed' : 'pointer', 
          width: '18px', 
          height: '18px',
          accentColor: '#667eea'
        }}
      />
      <label htmlFor="terms" style={{ 
        color: '#4a5568', 
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
      }}>
        <FontAwesomeIcon 
          icon={faCheck} 
          style={{ 
            color: '#cbd5e0',
            fontSize: '14px'
          }} 
        />
        I agree to the{" "}
        <Link 
          to="/terms" 
          style={{ color: '#667eea', fontWeight: '600' }}
          onClick={(e) => e.stopPropagation()}
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link 
          to="/privacy"
          style={{ color: '#667eea', fontWeight: '600' }}
          onClick={(e) => e.stopPropagation()}
        >
          Privacy Policy
        </Link>
      </label>
    </div>
  );
});
TermsCheckbox.displayName = 'TermsCheckbox';

// 5. Submit Button
const SubmitButton = React.memo(({ loading, isSignUp }) => {
  return (
    <button
      type="submit"
      disabled={loading}
      className="auth-button primary"
      style={{
        width: '100%',
        padding: '18px',
        background: loading 
          ? '#cbd5e0' 
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
    >
      {loading ? (
        <>
          <FontAwesomeIcon icon={faSpinner} spin />
          {' '}
          {isSignUp ? 'Creating Account...' : 'Signing In...'}
        </>
      ) : (
        <>
          <FontAwesomeIcon icon={isSignUp ? faUserPlus : faSignInAlt} />
          {' '}
          {isSignUp ? 'SIGN UP' : 'SIGN IN'}
        </>
      )}
    </button>
  );
});
SubmitButton.displayName = 'SubmitButton';

// 6. Referral Banner
const ReferralBanner = React.memo(({ show, isSignUp }) => {
  if (!show || !isSignUp) return null;
  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'linear-gradient(135deg, #667eea, #764ba2)',
      color: 'white',
      padding: '12px 24px',
      borderRadius: '50px',
      fontSize: '14px',
      fontWeight: '600',
      zIndex: 1000,
      boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      animation: 'slideDown 0.5s ease'
    }}>
      <FontAwesomeIcon icon={faGift} />
      🎁 You were referred! Get 25 bonus points on signup!
    </div>
  );
});
ReferralBanner.displayName = 'ReferralBanner';

// 7. Form Actions
const AuthFormActions = React.memo(({ 
  isSignUp, 
  loading, 
  onSwitchMode, 
  onForgotPassword 
}) => {
  return (
    <div style={{
      textAlign: 'center',
      marginTop: '30px',
      paddingTop: '25px',
      borderTop: '1px solid #eee',
      color: '#666',
      fontSize: '14px'
    }}>
      {isSignUp ? 'Already have an account?' : "Don't have an account?"}
      {' '}
      <button
        type="button"
        onClick={onSwitchMode}
        disabled={loading}
        style={{
          background: 'none',
          border: 'none',
          color: '#667eea',
          fontWeight: '600',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '15px',
          padding: '5px 10px',
          borderRadius: '6px',
          transition: 'all 0.3s ease',
          marginRight: '10px',
          textTransform: 'uppercase',
          opacity: loading ? 0.5 : 1
        }}
      >
        {isSignUp ? 'SIGN IN' : 'SIGN UP'}
      </button>
      
      {!isSignUp && (
        <button
          type="button"
          onClick={onForgotPassword}
          disabled={loading}
          style={{
            background: 'none',
            border: 'none',
            color: '#718096',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            padding: '5px 10px',
            borderRadius: '6px',
            transition: 'all 0.3s ease',
            opacity: loading ? 0.5 : 1
          }}
        >
          Forgot password?
        </button>
      )}
    </div>
  );
});
AuthFormActions.displayName = 'AuthFormActions';

// 8. Footer
const AuthFooter = React.memo(() => {
  return (
    <footer style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      textAlign: 'center',
      padding: '8px 8px',
      background: 'rgba(0, 0, 0, 0.9)',
      color: '#ccc',
      fontSize: '11px',
      zIndex: 1000,
      height: '40px',
      lineHeight: '20px',
    }}>
      <p style={{ margin: 0, padding: 0 }}>&copy; 2025 Straun Marketing AI Engine.</p>
      <div style={{ marginTop: 0 }}>
        <Link to="/privacy" style={{ color: '#48bb78', textDecoration: 'none', margin: '0 8px', fontSize: '11px' }}>Privacy</Link>
        <span style={{ color: '#666' }}>|</span>
        <Link to="/terms" style={{ color: '#48bb78', textDecoration: 'none', margin: '0 8px', fontSize: '11px' }}>Terms</Link>
      </div>
    </footer>
  );
});
AuthFooter.displayName = 'AuthFooter';

// ============ MAIN AUTH COMPONENT ============
const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isSignUp, setIsSignUp] = useState(true);
  const [referralCode, setReferralCode] = useState(null);
  const [showReferralBonus, setShowReferralBonus] = useState(false);
  
  const navigate = useNavigate();
  const { resetNavigation } = useNavigation();
  const retryCountRef = useRef(0);

  // 🚪 BOUNCER
  const bouncer = useBouncer({
    email: '',
    password: '',
    phone: '',
    terms: false,
  });

  // ✅ PRE-REGISTER ALL FIELDS ONCE - Stable refs!
  const emailRegister = useMemo(() => bouncer.register('email'), [bouncer]);
  const passwordRegister = useMemo(() => bouncer.register('password'), [bouncer]);
  const phoneRegister = useMemo(() => bouncer.register('phone'), [bouncer]);
  const termsRegister = useMemo(() => bouncer.register('terms'), [bouncer]);
  
  // ============ STABLE CALLBACKS ============
  
  const storeUserInLocalStorage = useCallback(async (userData) => {
    if (!userData?.user) return;
    
    try {
      const { data: profile, error } = await fetchWithRetry(() =>
        supabase
          .from('profiles')
          .select('role, referral_code')
          .eq('user_id', userData.user.id)
          .maybeSingle()
      );

      const userToStore = {
        id: userData.user.id,
        email: userData.user.email,
        phone: userData.user.phone || null,
        created_at: userData.user.created_at,
        last_login: new Date().toISOString(),
        role: profile?.role || 'user',
        referral_code: profile?.referral_code || null
      };
      localStorage.setItem('user', JSON.stringify(userToStore));
      console.log('✅ User stored:', userToStore.email);
    } catch (err) {
      console.error('[Auth] Failed to store user:', err);
    }
  }, []);

  const isAdminEmail = useCallback((email) => {
    const adminEmails = ['deonmahachi8@gmail.com'];
    return adminEmails.includes(email?.toLowerCase());
  }, []);

  const generateReferralCode = useCallback(async (userId, email) => {
    const base = email.split('@')[0].substring(0, 6).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `${base}${random}`;
    
    const isAdmin = isAdminEmail(email);
    const roleValue = isAdmin ? 'is_admin' : 'user';
    
    try {
      const { error } = await fetchWithRetry(() => supabase
        .from('profiles')
        .update({ 
          referral_code: code,
          role: roleValue
        })
        .eq('user_id', userId));
      
      if (error) {
        console.error('Error setting referral code:', error);
      } else {
        console.log('✅ Referral code generated:', code);
      }
    } catch (err) {
      console.error('[Auth] Failed to generate referral code:', err);
    }
    
    return code;
  }, [isAdminEmail]);

  const processReferral = useCallback(async (userId, referralCodeValue) => {
    try {
      console.log('🎁 Processing referral for user:', userId);
      
      const { data: referrer, error: referrerError } = await fetchWithRetry(() =>
        supabase
          .from('profiles')
          .select('user_id')
          .eq('referral_code', referralCodeValue)
          .maybeSingle()
      );
          
      if (referrerError || !referrer) {
        console.log('No referrer found with code:', referralCodeValue);
        return;
      }
      
      const { error: referralError } = await supabase
        .from('referrals')
        .insert({
          referrer_id: referrer.user_id,
          referred_user_id: userId,
          referral_code: referralCodeValue,
          status: 'completed',
          completed_at: new Date().toISOString(),
          points_earned: 50
        });
      
      if (referralError) {
        console.error('Error creating referral record:', referralError);
        return;
      }
      
      const { error: referrerRewardError } = await supabase
        .from('referral_rewards')
        .insert({
          user_id: referrer.user_id,
          referral_id: null,
          points_earned: 50,
          reward_type: 'referral'
        });
      
      if (!referrerRewardError) {
        await supabase
          .from('notifications')
          .insert({
            user_id: referrer.user_id,
            message: '🎉 Someone signed up using your referral link! You earned 50 points!',
            link_type: 'dashboard'
          });
      }
      
      const { error: newUserRewardError } = await supabase
        .from('referral_rewards')
        .insert({
          user_id: userId,
          referral_id: null,
          points_earned: 25,
          reward_type: 'signup_bonus'
        });
      
      if (!newUserRewardError) {
        console.log('✅ Awarded 25 bonus points to new user');
      }
      
      setMessage({
        text: '🎉 You received 25 bonus points from a referral!',
        type: 'success'
      });
      
    } catch (error) {
      console.error('Error processing referral:', error);
    }
  }, []);

  // ============ VALIDATION (Inside crew - only on submit) ============
  const validateForm = useCallback((values) => {
    const { email, password, phone, terms } = values;
    const errors = {};
    
    if (!email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    if (isSignUp && !terms) {
      errors.terms = 'You must agree to Terms of Service and Privacy Policy';
    }
    
    if (isSignUp && phone) {
      const cleanedPhone = phone.replace(/[\s\-\(\)\.]/g, '');
      if (!/^[\+]?[1-9][\d]{0,15}$/.test(cleanedPhone)) {
        errors.phone = 'Please enter a valid phone number';
      }
    }
    
    return errors;
  }, [isSignUp]);

  // ============ SIGN UP ============
  const handleSignUp = useCallback(async (values) => {
    const { email, password, phone } = values;
    const cleanedPhone = phone ? phone.replace(/[\s\-\(\)\.]/g, '') : null;

    try {
      setLoading(true);
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { phone: cleanedPhone },
          emailRedirectTo: `${window.location.origin}/app`,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create profile
        try {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert([{
              user_id: authData.user.id,
              email: email,
              phone_number: cleanedPhone || null,
              role: isAdminEmail(email) ? 'is_admin' : 'user'
            }]);

          if (insertError) {
            console.error('Profile creation error:', insertError);
          }
        } catch (profileError) {
          console.error('Profile creation failed:', profileError);
        }

        // Generate referral code
        await generateReferralCode(authData.user.id, email);
        
        if (referralCode) {
          await processReferral(authData.user.id, referralCode);
        }

        // ✅ Check if user is confirmed
        if (authData.user.confirmed_at) {
          // User is confirmed - sign them in
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) {
            setMessage({
              text: 'Account created! Please sign in.',
              type: 'info',
            });
            setIsSignUp(false);
            bouncer.reset();
            setLoading(false);
            return;
          }

          // Store user
          storeUserInLocalStorage(signInData);
          
          setMessage({
            text: 'Account created successfully!',
            type: 'success',
          });

          resetNavigation();
          
          // ✅ IMPORTANT: Wait for auth state to update
          setLoading(false);
          
          // Poll for auth state to be ready
          let authReady = false;
          let attempts = 0;
          const maxAttempts = 10;
          
          while (attempts < maxAttempts && !authReady) {
            attempts++;
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                authReady = true;
                console.log('✅ Auth session ready after', attempts, 'attempts');
                break;
              }
            } catch (err) {
              console.log('⏳ Waiting for auth session...', attempts);
            }
            await new Promise(resolve => setTimeout(resolve, 300));
          }

          // ✅ Now navigate with a slight delay to ensure state propagation
          if (authReady) {
            console.log('🚀 Navigating to /app');
            // Small delay to ensure React state updates
            setTimeout(() => {
              navigate('/app', { replace: true });
            }, 300);
          } else {
            console.warn('⚠️ Auth not ready after polling, using fallback');
            // Fallback: try to navigate anyway
            setTimeout(() => {
              // Force check session one more time
              supabase.auth.getSession().then(({ data: { session } }) => {
                if (session) {
                  navigate('/app', { replace: true });
                } else {
                  // Last resort - navigate to seller decision directly
                  navigate('/seller-decision', { replace: true });
                }
              });
            }, 2000);
          }
        } else {
          // Email confirmation required
          setMessage({
            text: '✅ Account created! Please check your email to verify.',
            type: 'success',
          });
          bouncer.reset();
          setLoading(false);
          setTimeout(() => {
            setIsSignUp(false);
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Sign up error:', error);
      setMessage({
        text: error.message || 'Sign up failed. Please try again.',
        type: 'error',
      });
      setLoading(false);
    }
  }, [referralCode, isAdminEmail, generateReferralCode, processReferral, resetNavigation, storeUserInLocalStorage, navigate, bouncer]);

  // ============ SIGN IN ============
  const handleSignIn = useCallback(async (values) => {
    const { email, password } = values;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      await storeUserInLocalStorage(data);
      
      setMessage({
        text: 'Login successful! Redirecting...',
        type: 'success',
      });
      
      bouncer.reset();
      
      setTimeout(() => {
        navigate('/app', { replace: true });
      }, 500);
      
    } catch (error) {
      console.error('Sign in error:', error);
      
      if (error.message === 'Invalid login credentials') {
        setMessage({
          text: 'Invalid email or password',
          type: 'error',
        });
      } else {
        setMessage({
          text: error.message || 'Login failed. Please try again.',
          type: 'error',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [storeUserInLocalStorage, navigate, bouncer]);

  // ============ FORM SUBMIT ============
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    // 🚪 BOUNCER GETS THE VALUES - Only on submit
    const values = bouncer.getValues();
    
    // ✅ Validation happens HERE - Not on every keystroke
    const errors = validateForm(values);
    
    if (Object.keys(errors).length > 0) {
      // Show first error
      const firstError = Object.values(errors)[0];
      setMessage({ text: firstError, type: 'error' });
      return;
    }

    // No errors - proceed
    setLoading(true);
    setMessage({ text: '', type: '' });

    if (!navigator.onLine) {
      setMessage({ text: 'You are offline. Please connect to the internet.', type: 'error' });
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        await handleSignUp(values);
      } else {
        await handleSignIn(values);
      }
    } catch (error) {
      setMessage({ text: error.message || 'Action failed', type: 'error' });
      setLoading(false);
    }
  }, [isSignUp, validateForm, handleSignUp, handleSignIn, bouncer]);

  // ============ FORM SWITCH ============
  const handleFormSwitch = useCallback(() => {
    setIsSignUp(!isSignUp);
    setMessage({ text: '', type: '' });
    setShowReferralBonus(false);
    bouncer.reset();
  }, [isSignUp, bouncer]);

  // ============ FORGOT PASSWORD ============
  const handleForgotPassword = useCallback(async () => {
    const email = bouncer.getValue('email');
    
    if (!email) {
      setMessage({ text: 'Please enter your email to reset password', type: 'error' });
      return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage({ text: 'Please enter a valid email address', type: 'error' });
      return;
    }
    
    try {
      setLoading(true);
      
      const resetUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl,
      });
      
      if (error) throw error;
      
      setMessage({ 
        text: '📧 Password reset email sent! Check your inbox.', 
        type: 'success' 
      });
      
      bouncer.setValue('email', '');
      
    } catch (error) {
      console.error('Forgot password error:', error);
      setMessage({ 
        text: error.message || 'Failed to send reset email.', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  }, [bouncer]);

  // ============ EFFECTS ============
  useEffect(() => {
    if (!window.location.pathname.includes('/reset-password')) {
      sessionStorage.removeItem('passwordResetMode');
    }
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem('passwordResetMode') === 'true') {
      console.log('Password reset mode - ignoring auth changes');
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
      setReferralCode(ref.toUpperCase());
      setShowReferralBonus(true);
      console.log('📢 Referral code detected:', ref);
    }
  }, []);

  // ============ RENDER ============
  return (
    <div className="signup-page">
      <ReferralBanner show={showReferralBonus} isSignUp={isSignUp} />

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
                paddingBottom: '70px',
                marginBottom: '8px'
              }}>
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </div>
              <div style={{ color: '#666', fontSize: '16px', fontWeight: '400' }}>
                {isSignUp ? 'Join our community today' : 'Sign in to your account'}
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

            <form onSubmit={handleSubmit} autoComplete="off">
              <div style={{ display: 'none' }}>
                <input type="text" name="username" autoComplete="username" />
                <input type="password" name="current-password" autoComplete="current-password" />
              </div>

              {isSignUp && (
                <PhoneInput 
                  inputRef={phoneRegister.ref}
                  disabled={loading}
                />
              )}

              <EmailInput 
                inputRef={emailRegister.ref}
                disabled={loading}
              />

              <PasswordInput 
                inputRef={passwordRegister.ref}
                disabled={loading}
                isSignUp={isSignUp}
              />

              {isSignUp && (
                <TermsCheckbox 
                  inputRef={termsRegister.ref}
                  disabled={loading}
                />
              )}

              <SubmitButton 
                loading={loading}
                isSignUp={isSignUp}
              />
            </form>
          
            <AuthFormActions 
              isSignUp={isSignUp}
              loading={loading}
              onSwitchMode={handleFormSwitch}
              onForgotPassword={handleForgotPassword}
            />
          </div>
        </div>
      </div>
      
      <AuthFooter />
    </div>
  );
};

export default Auth;
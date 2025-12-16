import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import './Signup.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPhone, 
  faEnvelope, 
  faLock, 
  faUserPlus, 
  faSignInAlt, 
  faSpinner,
  faEye,
  faEyeSlash 
} from '@fortawesome/free-solid-svg-icons';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isSignUp, setIsSignUp] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Debug log
  useEffect(() => {
    console.log('Current values:', { email, password, phone });
  }, [email, password, phone]);

  // Initialize auth
  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
    };
    initializeAuth();
  }, []);

  // Helper function to store user in localStorage
  const storeUserInLocalStorage = (userData) => {
    if (userData?.user) {
      const userToStore = {
        id: userData.user.id,
        email: userData.user.email,
        phone: userData.user.phone || phone || null,
        created_at: userData.user.created_at,
      };
      localStorage.setItem('user', JSON.stringify(userToStore));
      console.log('✅ User stored in localStorage:', userToStore.email);
    }
  };

  // Input validation
  const validateInputs = () => {
    if (!email || !password) {
      setMessage({ text: 'Email and password are required', type: 'error' });
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage({ text: 'Please enter a valid email address', type: 'error' });
      return false;
    }

    if (password.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters', type: 'error' });
      return false;
    }

    if (isSignUp && phone) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(phone.replace(/[\s\-\(\)\.]/g, ''))) {
        setMessage({ text: 'Please enter a valid phone number', type: 'error' });
        return false;
      }
    }

    return true;
  };

  // Handle Sign Up
  const handleSignUp = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    
    if (!validateInputs()) return;
    
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { phone: phone || null },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: dbError } = await supabase
          .from('profiles')
          .upsert([
            {
              user_id: authData.user.id,
              username: email,
              phone_number: phone || null,
              location: '',                   
              interests: [],                  
              created_at: new Date().toISOString(),
            },
          ], { onConflict: 'user_id' });

        if (dbError) throw dbError;

        // Auto sign in after signup
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        // ✅ STORE USER IN LOCALSTORAGE
        storeUserInLocalStorage(signInData);

        setMessage({
          text: 'Account created successfully!',
          type: 'success',
        });
        
        setEmail('');
        setPassword('');
        setPhone('');
        
        // Redirect to app
        setTimeout(() => {
          navigate('/app');
        }, 1000);
        
      } else if (authData.session) {
        // ✅ STORE USER IN LOCALSTORAGE for direct session
        storeUserInLocalStorage(authData);

        setMessage({
          text: 'Account created successfully!',
          type: 'success',
        });
        
        setEmail('');
        setPassword('');
        setPhone('');
        
        // Redirect to app
        setTimeout(() => {
          navigate('/app');
        }, 1000);
      }
    } catch (error) {
      console.error('Sign up error:', error);
      
      if (error.message && error.message.includes('already registered')) {
        try {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (signInError) throw signInError;
          
          // ✅ STORE USER IN LOCALSTORAGE for existing users
          storeUserInLocalStorage(signInData);
          
          setMessage({
            text: 'Welcome back! Redirecting...',
            type: 'success',
          });
          
          setTimeout(() => {
            navigate('/app');
          }, 1000);
          
        } catch (signInErr) {
          setMessage({
            text: 'Account exists but password is incorrect.',
            type: 'error',
          });
        }
      } else {
        setMessage({
          text: error.message || 'Sign up failed. Please try again.',
          type: 'error',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Sign In
  const handleSignIn = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    
    if (!email || !password) {
      setMessage({ text: 'Email and password are required', type: 'error' });
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage({ text: 'Please enter a valid email address', type: 'error' });
      return;
    }
    
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // ✅ STORE USER IN LOCALSTORAGE on sign in
      storeUserInLocalStorage(data);

      setMessage({
        text: 'Login successful! Redirecting...',
        type: 'success',
      });
      
      setEmail('');
      setPassword('');
      
      setTimeout(() => {
        navigate('/app');
      }, 1000);
      
    } catch (error) {
      console.error('Sign in error:', error);
      setMessage({
        text: error.message === 'Invalid login credentials' 
          ? 'Invalid email or password' 
          : error.message,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage({ text: 'Please enter your email to reset password', type: 'error' });
      return;
    }
    
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      setMessage({ 
        text: 'Password reset email sent! Check your inbox.', 
        type: 'success' 
      });
    } catch (error) {
      setMessage({ 
        text: error.message || 'Failed to send reset email', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSignUp) {
      handleSignUp(e);
    } else {
      handleSignIn(e);
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Helper function to get field background color
  const getFieldBackground = (value) => {
    return value ? '#5f7fa0' : '#000000ff';
  };

  // Helper function to get field border color
  const getFieldBorderColor = (value) => {
    return value ? '#5f7fa0' : '#000000ff';
  };

  return (
    <div className="auth-container">
      <div className="signup-container" style={{
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        width: '100%',
        maxWidth: '450px',
        padding: '40px',
        margin: '20px auto',
        transform: 'translateY(0)',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease'
      }}>
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

        <form onSubmit={handleSubmit}>
          {/* Hidden fields to trick browser autofill */}
          <div style={{ display: 'none' }}>
            <input type="email" name="hidden-email" autoComplete="off" />
            <input type="password" name="hidden-password" autoComplete="new-password" />
          </div>

          {isSignUp && (
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
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  placeholder="+263 123 456 789"
                  autoComplete="off"
                  style={{
                    width: '100%',
                    padding: '16px 20px 16px 45px',
                    border: `2px solid ${getFieldBorderColor(phone)}`,
                    borderRadius: '12px',
                    fontSize: '16px',
                    transition: 'all 0.3s ease',
                    background: getFieldBackground(phone),
                    color: phone ? '#ffffff' : '#cccccc',
                    WebkitBoxShadow: '0 0 0px 1000px #000000ff inset',
                    WebkitTextFillColor: phone ? '#ffffff' : '#cccccc'
                  }}
                />
                <FontAwesomeIcon 
                  icon={faPhone} 
                  style={{
                    position: 'absolute',
                    left: '20px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: phone ? '#ffffff' : '#999999',
                    fontSize: '18px'
                  }}
                />
              </div>
            </div>
          )}

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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="your.email@example.com"
                autoComplete="off"
                onFocus={(e) => {
                  e.target.setAttribute('autocomplete', 'new-email');
                }}
                style={{
                  width: '100%',
                  padding: '16px 20px 16px 45px',
                  border: `2px solid ${getFieldBorderColor(email)}`,
                  borderRadius: '12px',
                  fontSize: '16px',
                  transition: 'all 0.3s ease',
                  background: getFieldBackground(email),
                  color: email ? '#ffffff' : '#cccccc',
                  WebkitBoxShadow: '0 0 0px 1000px #000000ff inset',
                  WebkitTextFillColor: email ? '#ffffff' : '#cccccc'
                }}
              />
              <FontAwesomeIcon 
                icon={faEnvelope} 
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: email ? '#ffffff' : '#999999',
                  fontSize: '18px'
                }}
              />
            </div>
          </div>

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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="At least 6 characters"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                style={{
                  width: '100%',
                  padding: '16px 50px 16px 45px',
                  border: `2px solid ${getFieldBorderColor(password)}`,
                  borderRadius: '12px',
                  fontSize: '16px',
                  transition: 'all 0.3s ease',
                  background: getFieldBackground(password),
                  color: password ? '#ffffff' : '#cccccc',
                  WebkitBoxShadow: '0 0 0px 1000px #000000ff inset',
                  WebkitTextFillColor: password ? '#ffffff' : '#cccccc'
                }}
              />
              <FontAwesomeIcon 
                icon={faLock} 
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: password ? '#ffffff' : '#999999',
                  fontSize: '18px'
                }}
              />
              
              {/* SHOW/HIDE PASSWORD BUTTON */}
              <button
                type="button"
                onClick={togglePasswordVisibility}
                style={{
                  position: 'absolute',
                  right: '15px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: password ? '#ffffff' : '#667eea',
                  cursor: 'pointer',
                  padding: '5px 10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  borderRadius: '6px',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => e.target.style.background = password ? 'rgba(255, 255, 255, 0.1)' : 'rgba(102, 126, 234, 0.1)'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
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
        </form>

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
            onClick={() => setIsSignUp(!isSignUp)}
            style={{
              background: 'none',
              border: 'none',
              color: '#667eea',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '15px',
              padding: '5px 10px',
              borderRadius: '6px',
              transition: 'all 0.3s ease',
              marginRight: '10px',
              textTransform: 'uppercase'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(102, 126, 234, 0.1)'}
            onMouseLeave={(e) => e.target.style.background = 'none'}
          >
            {isSignUp ? 'SIGN IN' : 'SIGN UP'}
          </button>
          
          {!isSignUp && (
            <button
              type="button"
              onClick={handleForgotPassword}
              style={{
                background: 'none',
                border: 'none',
                color: '#718096',
                fontWeight: '500',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '5px 10px',
                borderRadius: '6px',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(113, 128, 150, 0.1)'}
              onMouseLeave={(e) => e.target.style.background = 'none'}
            >
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
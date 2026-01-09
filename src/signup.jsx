import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import './Signup.css';
import { Link } from 'react-router-dom'; 
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
  faCheck 
} from '@fortawesome/free-solid-svg-icons';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isSignUp, setIsSignUp] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const navigate = useNavigate();

  // Helper function to store user in localStorage
  const storeUserInLocalStorage = (userData) => {
    if (userData?.user) {
      const userToStore = {
        id: userData.user.id,
        email: userData.user.email,
        phone: userData.user.phone || phone || null,
        created_at: userData.user.created_at,
        last_login: new Date().toISOString(),
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

    // Check terms agreement for sign up
    if (isSignUp && !agreedToTerms) {
      setMessage({ text: 'You must agree to Terms of Service and Privacy Policy', type: 'error' });
      return false;
    }

    if (isSignUp && phone) {
      // Clean phone number
      const cleanedPhone = phone.replace(/[\s\-\(\)\.]/g, '');
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      
      if (!phoneRegex.test(cleanedPhone)) {
        setMessage({ text: 'Please enter a valid phone number', type: 'error' });
        return false;
      }
    }

    return true;
  };
  
  const handleFormSwitch = () => {
    setIsSignUp(!isSignUp);
    setMessage({ text: '', type: '' });
    setPhone('');
    setAgreedToTerms(false);
  };
  
  // Handle Sign Up
  const handleSignUp = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    
    if (!validateInputs()) return;
    
    setLoading(true);

    try {
      // Clean phone number if provided
      const cleanedPhone = phone ? phone.replace(/[\s\-\(\)\.]/g, '') : null;
      
      console.log('Attempting signup with:', { email, phone: cleanedPhone });
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { phone: cleanedPhone },
          emailRedirectTo: `${window.location.origin}/app`,
        },
      });

      if (authError) {
        console.error('Supabase signup error:', authError);
        throw authError;
      }

      console.log("[SignUp] Signup successful, user ID:", authData.user?.id);

      if (authData.user) {
        // Try to create profile if user was created
        try {
          // First check if profile already exists
          const { data: existingProfile, error: checkError } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('user_id', authData.user.id)
            .single();

          // If no profile exists, create one
          if (checkError && checkError.code === 'PGRST116') {
            const { error: insertError } = await supabase
              .from('profiles')
              .insert([
                {
                  user_id: authData.user.id,
                  email: email,
                  phone_number: cleanedPhone || null,
                },
              ]);

            if (insertError) {
              console.error('Profile creation error:', insertError);
              // Don't throw - profile creation is secondary
            } else {
              console.log('✅ Profile created successfully');
            }
          } else if (existingProfile) {
            console.log('✅ Profile already exists, updating...');
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                email: email,
                phone_number: cleanedPhone || null,
              })
              .eq('user_id', authData.user.id);

            if (updateError) {
              console.error('Profile update error:', updateError);
            }
          }
        } catch (profileError) {
          console.error('Profile creation/update failed:', profileError);
          // Continue anyway - profile can be updated later
        }

        // Check if email confirmation is required
        if (authData.user.identities && authData.user.identities.length === 0) {
          setMessage({
            text: 'User already exists with this email. Please sign in instead.',
            type: 'info',
          });
          setIsSignUp(false);
          setAgreedToTerms(false);
          return;
        }

        // Check if email needs confirmation
        if (authData.user.confirmed_at === null) {
          setMessage({
            text: 'Please check your email to confirm your account!',
            type: 'success',
          });
          
          // Clear form
          setEmail('');
          setPassword('');
          setPhone('');
          setAgreedToTerms(false);
          
          // Optionally switch to sign in mode
          setTimeout(() => {
            setIsSignUp(false);
          }, 3000);
        } else {
          // User is confirmed, try to sign in immediately
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (signInError) {
            console.error('Auto-signin error:', signInError);
            setMessage({
              text: 'Account created! Please sign in.',
              type: 'info',
            });
            setIsSignUp(false);
            setAgreedToTerms(false);
          } else {
            storeUserInLocalStorage(signInData);
            setMessage({
              text: 'Account created successfully! Redirecting...',
              type: 'success',
            });
            
            setTimeout(() => {
              navigate('/app', { replace: true });
            }, 1000);
          }
        }
      } else {
        setMessage({
          text: 'Signup failed. Please try again.',
          type: 'error',
        });
      }
      
    } catch (error) {
      console.error('Sign up error:', error);
      
      // Handle specific error cases
      if (error.message && error.message.includes('already registered')) {
        setMessage({
          text: 'Email already registered. Please sign in instead.',
          type: 'error',
        });
        setIsSignUp(false);
        setAgreedToTerms(false);
      } else if (error.message && error.message.includes('User already registered')) {
        setMessage({
          text: 'User already exists. Please sign in.',
          type: 'error',
        });
        setIsSignUp(false);
        setAgreedToTerms(false);
      } else if (error.message && error.message.includes('Password should be at least')) {
        setMessage({
          text: 'Password must be at least 6 characters long.',
          type: 'error',
        });
      } else if (error.message && error.message.includes('Invalid email')) {
        setMessage({
          text: 'Please enter a valid email address.',
          type: 'error',
        });
      } else if (error.message && error.message.includes('profiles')) {
        setMessage({
          text: 'Account created! There was an issue setting up your profile.',
          type: 'info',
        });
        // Still try to sign in if account was created
        setTimeout(async () => {
          try {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            
            if (!signInError && signInData) {
              storeUserInLocalStorage(signInData);
              navigate('/app', { replace: true });
            } else {
              setIsSignUp(false);
            }
          } catch (signInErr) {
            setIsSignUp(false);
          }
        }, 1000);
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
      console.log('Attempting signin with:', { email });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Supabase signin error:', error);
        throw error;
      }

      console.log('Sign in successful:', data);

      // ✅ STORE USER IN LOCALSTORAGE
      storeUserInLocalStorage(data);

      setMessage({
        text: 'Login successful! Redirecting...',
        type: 'success',
      });
      
      // Clear form
      setEmail('');
      setPassword('');
      setAgreedToTerms(false);
      
      // Redirect
      setTimeout(() => {
        navigate('/app', { replace: true });
      }, 500);
      
    } catch (error) {
      console.error('Sign in error:', error);
      
      // Handle specific error cases
      if (error.message === 'Invalid login credentials') {
        setMessage({
          text: 'Invalid email or password',
          type: 'error',
        });
      } else if (error.message && error.message.includes('Email not confirmed')) {
        setMessage({
          text: 'Please confirm your email address first.',
          type: 'error',
        });
      } else if (error.message && error.message.includes('User not found')) {
        setMessage({
          text: 'No account found with this email.',
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
  };

  const handleForgotPassword = async () => {
    if (!email) {
        setMessage({ text: 'Please enter your email to reset password', type: 'error' });
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        setMessage({ text: 'Please enter a valid email address', type: 'error' });
        return;
    }
    
    try {
        setLoading(true);
        setMessage({ text: '', type: '' });
        
        console.log('Sending password reset to:', email);
        
        // IMPORTANT: Use the exact URL of your deployed app
        const resetUrl = `${window.location.origin}/reset-password`;
        console.log('Reset URL:', resetUrl);
        
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: resetUrl,
        });
        
        if (error) {
            console.error('Password reset error:', error);
            throw error;
        }
        
        console.log('Password reset email sent:', data);
        
        setMessage({ 
            text: '📧 Password reset email sent! Check your inbox (and spam folder).', 
            type: 'success' 
        });
        
        // Clear email field
        setEmail('');
        
    } catch (error) {
        console.error('Forgot password error:', error);
        setMessage({ 
            text: error.message || 'Failed to send reset email. Please try again.', 
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
    return value ? '#000000ff' : '#000000ff';
  };

  // Helper function to get field border color
  const getFieldBorderColor = (value) => {
    return value ? '#000000ff' : '#000000ff';
  };

  // Handle checkbox change
  const handleCheckboxChange = (e) => {
    setAgreedToTerms(e.target.checked);
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
              {/* Hidden fields to prevent autofill issues */}
              <div style={{ display: 'none' }}>
                <input type="text" name="username" autoComplete="username" />
                <input type="password" name="current-password" autoComplete="current-password" />
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
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '16px 20px 16px 45px',
                        borderRadius: '12px',
                        fontSize: '16px',
                        transition: 'all 0.3s ease',
                      }}
                    />
                    <FontAwesomeIcon 
                      icon={faPhone} 
                      style={{
                        position: 'absolute',
                        left: '20px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: phone ? '#667eea' : '#999999',
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
                    autoComplete="email"
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '16px 20px 16px 45px',
                      borderRadius: '12px',
                      fontSize: '16px',
                      transition: 'all 0.3s ease',
                    }}
                  />
                  <FontAwesomeIcon 
                    icon={faEnvelope} 
                    style={{
                      position: 'absolute',
                      left: '20px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: email ? '#667eea' : '#999999',
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
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '16px 50px 16px 45px',
                      borderRadius: '12px',
                      fontSize: '16px',
                      transition: 'all 0.3s ease',
                    }}
                  />
                  <FontAwesomeIcon 
                    icon={faLock} 
                    style={{
                      position: 'absolute',
                      left: '20px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: password ? '#667eea' : '#999999',
                      fontSize: '18px'
                    }}
                  />
                  
                  {/* SHOW/HIDE PASSWORD BUTTON */}
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    disabled={loading}
                    style={{
                      position: 'absolute',
                      right: '15px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: password ? '#667eea' : '#999',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      padding: '5px 10px',
                      fontSize: '14px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      borderRadius: '6px',
                      transition: 'all 0.3s ease',
                      opacity: loading ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => !loading && (e.target.style.background = password ? 'rgba(102, 126, 234, 0.1)' : 'rgba(153, 153, 153, 0.1)')}
                    onMouseLeave={(e) => !loading && (e.target.style.background = 'transparent')}
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {isSignUp && (
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
                    id="terms"  // Changed from privacy to terms
                    checked={agreedToTerms}
                    onChange={handleCheckboxChange}
                    disabled={loading}
                    style={{ 
                      cursor: loading ? 'not-allowed' : 'pointer', 
                      width: '18px', 
                      height: '18px',
                      accentColor: '#667eea'
                    }}
                  />
                  <label htmlFor="terms" style={{ 
                    color: '#4a5568', 
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <FontAwesomeIcon 
                      icon={faCheck} 
                      style={{ 
                        color: agreedToTerms ? '#48bb78' : '#cbd5e0',
                        fontSize: '14px'
                      }} 
                    />
                    I agree to the{" "}
                    <Link 
                      to="/terms" 
                      style={{ 
                        color: '#667eea', 
                        fontWeight: '600',
                        marginLeft: '4px'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link 
                      to="/privacy"  // Fixed: from /privacy-policy to /privacy
                      style={{ 
                        color: '#667eea', 
                        fontWeight: '600'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </Link>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (isSignUp && !agreedToTerms)}
                className="auth-button primary"
                style={{
                  width: '100%',
                  padding: '18px',
                  background: isSignUp && !agreedToTerms 
                    ? '#cbd5e0' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading || (isSignUp && !agreedToTerms) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginTop: '10px',
                  opacity: loading || (isSignUp && !agreedToTerms) ? 0.7 : 1
                }}
                onMouseEnter={(e) => !loading && agreedToTerms && (e.target.style.transform = 'translateY(-2px)')}
                onMouseLeave={(e) => !loading && agreedToTerms && (e.target.style.transform = 'translateY(0)')}
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
                onClick={handleFormSwitch}
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
                onMouseEnter={(e) => !loading && (e.target.style.background = 'rgba(102, 126, 234, 0.1)')}
                onMouseLeave={(e) => !loading && (e.target.style.background = 'none')}
              >
                {isSignUp ? 'SIGN IN' : 'SIGN UP'}
              </button>
              
              {!isSignUp && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
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
                  onMouseEnter={(e) => !loading && (e.target.style.background = 'rgba(113, 128, 150, 0.1)')}
                  onMouseLeave={(e) => !loading && (e.target.style.background = 'none')}
                >
                  Forgot password?
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <footer className="signup-footer" style={{
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        textAlign: 'center',
        padding: '8px',
        background: 'rgba(0, 0, 0, 0.9)',
        color: '#ccc',
        fontSize: '12px',
        zIndex: '1000'
      }}>
        <p>&copy; 2025 Straun Marketing AI Engine. All rights reserved.</p>
        <div style={{ marginTop: '2px' }}>
          <Link 
            to="/privacy" 
            style={{ 
              color: '#48bb78', 
              textDecoration: 'none',
              margin: '0 8px'
            }}
          >
            Privacy
          </Link>
          <span style={{ color: '#666' }}>|</span>
          <Link 
            to="/terms" 
            style={{ 
              color: '#48bb78', 
              textDecoration: 'none',
              margin: '0 8px'
            }}
          >
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default Auth;
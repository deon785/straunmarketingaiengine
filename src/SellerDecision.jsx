import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthActions, useAuthState } from './AuthContext';
import { supabase } from './lib/supabase';
import './SellerDecision.css';

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

const SellerDecision = () => {
  const [loading, setLoading] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [tempLocation, setTempLocation] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [profileData, setProfileData] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();
  const { setMode } = useAuthActions();
  const { user, loading: authLoading } = useAuthState();

  const safeNavigate = (path) => {
    try {
      navigate(path);
    } catch (err) {
      console.warn('[SellerDecision] Navigation failed:', err);
      try {
        window.location.href = path;
      } catch (fallbackErr) {
        console.error('[SellerDecision] Fallback navigation failed:', fallbackErr);
        setError('Unable to navigate. Please refresh the page.');
      }
    }
  };

  // ✅ Use fetchWithRetry
  const fetchProfile = async (attempt = 0) => {
    // ✅ No need for supabase.auth.getUser() — we already have user from context
    if (!user?.id) {
      setError('User not found. Please log in again.');
      setChecking(false);
      return;
    }

    try {
      const { data: profileResult, error: profileError } = await fetchWithRetry(() =>
        supabase
          .from('profiles')
          .select('location, phone_number, is_seller, seller_setup_completed')
          .eq('user_id', user.id)
          .maybeSingle()
      );

      if (profileError) {
        console.warn('[SellerDecision] Profile fetch error:', profileError);
        if (attempt < 3) {
          setTimeout(() => fetchProfile(attempt + 1), 1000 * (attempt + 1));
          return;
        }
        setError('Failed to load profile. Please refresh the page.');
        setChecking(false);
        return;
      }

      setProfileData({
        location: profileResult?.location || '',
        phone_number: profileResult?.phone_number || '',
        is_seller: profileResult?.is_seller || false,
        seller_setup_completed: profileResult?.seller_setup_completed || false
      });

      setError(null);
      setRetryCount(0);
    } catch (err) {
      console.error('[SellerDecision] Unexpected error:', err);
      if (attempt < 3) {
        setTimeout(() => fetchProfile(attempt + 1), 1000 * (attempt + 1));
        return;
      }
      setError('Failed to load profile. Please refresh the page.');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // ✅ Wait until auth has finished loading
    if (authLoading) {
      console.log('[SellerDecision] Auth still loading, waiting...');
      return;
    }

    // ✅ If no user after loading, show error (don't call supabase.auth.getUser)
    if (!user) {
      console.log('[SellerDecision] No user after auth loaded');
      setError('Please log in to continue');
      setChecking(false);
      return;
    }

    fetchProfile(0);
  }, [authLoading, user?.id]);  // ← Re-run when auth settles

  const handleAddProducts = () => {
    try {
      navigate('/app/seller');
    } catch (err) {
      console.error('[SellerDecision] Navigation error:', err);
      setError('Unable to open seller form. Please try again.');
    }
  };

  // ✅ Add offline check and use fetchWithRetry
  const handleSkipForNow = async () => {
    if (!navigator.onLine) {
      setError('You are offline. Please connect to the internet to continue.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { data: userData, error: userError } = await fetchWithRetry(() =>
        supabase.auth.getUser()
      );
      
      if (userError) {
        setError('Please log in to continue');
        setLoading(false);
        return;
      }
      
      const user = userData?.user;
      
      if (!user) {
        setError('User not found. Please log in again.');
        setLoading(false);
        return;
      }
      
      const hasLocation = profileData?.location && profileData.location.trim() !== '';
      const hasPhone = profileData?.phone_number && profileData.phone_number.trim() !== '';
      
      if (!hasLocation || !hasPhone) {
        setTempLocation(profileData?.location || '');
        setTempPhone(profileData?.phone_number || '');
        setShowLocationModal(true);
        setLoading(false);
        return;
      }
      
      await completeSkip(user.id);
      localStorage.setItem('straun_profileComplete', 'true');
      
    } catch (err) {
      console.error('[SellerDecision] Skip error:', err);
      setError('Failed to skip. Please try again.');
      setLoading(false);
    }
  };

  // ✅ Use fetchWithRetry
  const completeSkip = async (userId) => {
    try {
      const { error: updateError } = await fetchWithRetry(() =>
        supabase
          .from('profiles')
          .update({
            is_seller: true,
            seller_setup_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
      );
      
      if (updateError) {
        console.error('[SellerDecision] Update error:', updateError);
        setError('Failed to update profile. Please try again.');
        setLoading(false);
        return;
      }

      // ✅ Set mode to seller BEFORE navigating to /app
      console.log('🚀 Setting seller mode and navigating to /app');
      setMode('seller');

      // Small delay to let AuthContext save the mode
      setTimeout(() => {
          safeNavigate('/app');
      }, 150);
      
    } catch (err) {
      console.error('[SellerDecision] Complete skip error:', err);
      setError('Failed to skip. Please try again.');
      setLoading(false);
    }
  };

  // ✅ Add offline check and use fetchWithRetry
  const saveLocationAndPhone = async () => {
    if (!navigator.onLine) {
      setError('You are offline. Please connect to the internet to save your information.');
      return;
    }
    
    if (!tempLocation.trim()) {
      setError('Please enter your location');
      return;
    }
    if (!tempPhone.trim()) {
      setError('Please enter your phone number');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { data: userData, error: userError } = await fetchWithRetry(() =>
        supabase.auth.getUser()
      );
      
      if (userError) {
        setError('Please log in to continue');
        setLoading(false);
        return;
      }
      
      const user = userData?.user;
      
      if (!user) {
        setError('User not found. Please log in again.');
        setLoading(false);
        return;
      }
      
      const { error: updateError } = await fetchWithRetry(() =>
        supabase
          .from('profiles')
          .update({
            location: tempLocation.trim(),
            phone_number: tempPhone.trim(),
            is_seller: true,
            seller_setup_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
      );
      
      if (updateError) {
          console.error('[SellerDecision] Save error:', updateError);
          setError('Failed to save information. Please try again.');
          setLoading(false);
          return;
      }

      // ✅ Set mode to seller BEFORE navigating
      console.log('🚀 Setting seller mode and navigating to /app');
      setMode('seller');

      setShowLocationModal(false);
      localStorage.setItem('straun_profileComplete', 'true');

      setTimeout(() => {
          safeNavigate('/app');
      }, 150);
      
    } catch (err) {
      console.error('[SellerDecision] Save error:', err);
      setError('Failed to save information. Please check your connection.');
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setChecking(true);
    setRetryCount(prev => prev + 1);
    fetchProfile(0);
  };

  if (checking) {
    return (
      <div className="seller-decision-page" style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div className="decision-container" style={{
          width: '100%',
          maxWidth: '500px',
          margin: '20px'
        }}>
          <div className="decision-card" style={{
            background: 'white',
            borderRadius: '20px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #f3f3f3',
              borderTop: '3px solid #667eea',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 15px auto'
            }} />
            <p>Loading your profile...</p>
            {retryCount > 0 && (
              <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                Attempting to connect... ({retryCount}/3)
              </p>
            )}
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="seller-decision-page" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div className="decision-container" style={{
        width: '100%',
        maxWidth: '500px',
        margin: '0 auto'
      }}>
        <div className="decision-card" style={{
          background: 'white',
          borderRadius: '20px',
          padding: '32px 28px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
        }}>
          <div className="header" style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              fontSize: '28px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '8px'
            }}>
              Welcome Seller! 🎉
            </div>
            <div style={{ color: '#666', fontSize: '15px', fontWeight: '400' }}>
              Would you like to add your products now?
            </div>
          </div>

          {error && (
            <div style={{
              background: '#fee2e2',
              color: '#dc2626',
              padding: '12px 15px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '1px solid #fecaca'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚠️</span> {error}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={handleRetry}
                  style={{
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Retry
                </button>
                <button 
                  onClick={() => setError(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: 'bold'
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <p style={{ color: '#718096', fontSize: '14px', lineHeight: '1.5' }}>
              You can add your products now to start selling immediately,<br />
              or skip and add them later from your dashboard.
            </p>
            {profileData?.location && profileData?.phone_number && (
              <p style={{ color: '#16a34a', fontSize: '12px', marginTop: '10px' }}>
                ✓ Your profile is complete (Location and Phone saved)
              </p>
            )}
            {(!profileData?.location || !profileData?.phone_number) && (
              <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '10px' }}>
                ⚠️ You'll need to provide your location and phone number to continue
              </p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleAddProducts}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                opacity: loading ? 0.7 : 1
              }}
              onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => !loading && (e.target.style.transform = 'translateY(0)')}
            >
              📦 ADD PRODUCTS NOW
            </button>

            <button
              onClick={handleSkipForNow}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: 'transparent',
                color: '#667eea',
                border: '2px solid #667eea',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                opacity: loading ? 0.7 : 1
              }}
              onMouseEnter={(e) => !loading && (e.target.style.background = 'rgba(102, 126, 234, 0.05)')}
              onMouseLeave={(e) => !loading && (e.target.style.background = 'transparent')}
            >
              {loading ? '⏳ Processing...' : '⏰ SKIP FOR NOW'}
            </button>
          </div>

          <div style={{ 
            marginTop: '24px', 
            padding: '16px',
            backgroundColor: '#f7fafc',
            borderRadius: '10px',
            fontSize: '12px',
            color: '#718096',
            textAlign: 'center'
          }}>
            <p>You can always add products later from your seller dashboard</p>
          </div>

          <button
            onClick={() => {
              // ✅ Safe fallback - since mode selection no longer exists, go home
              console.log('[SellerDecision] Back clicked - returning to homepage');
              safeNavigate('/');
            }}
            style={{
                marginTop: '20px',
                width: '100%',
                background: 'none',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                fontSize: '13px',
                textDecoration: 'underline',
                padding: '8px'
            }}
          >
            ← Back to Home
          </button>
        </div>
      </div>

      {showLocationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            maxWidth: '450px',
            width: '100%',
            padding: '24px',
            position: 'relative'
          }}>
            <h2 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '22px' }}>📝 Complete Your Profile</h2>
            <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>
              To use Seller mode, we need your location and phone number.
            </p>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                📍 Location *
              </label>
              <input
                type="text"
                value={tempLocation}
                onChange={(e) => setTempLocation(e.target.value)}
                placeholder="e.g., Harare, Bulawayo, Mutare"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
                autoFocus
              />
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                📞 Phone Number *
              </label>
              <input
                type="tel"
                value={tempPhone}
                onChange={(e) => setTempPhone(e.target.value)}
                placeholder="e.g., 0771234567 or +263771234567"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </div>
            
            {error && (
              <div style={{
                background: '#fee2e2',
                color: '#dc2626',
                padding: '8px 12px',
                borderRadius: '6px',
                marginBottom: '15px',
                fontSize: '13px'
              }}>
                {error}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowLocationModal(false);
                  setError(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#e5e7eb',
                  color: '#333',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveLocationAndPhone}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: loading ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.3s ease'
                }}
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SellerDecision);
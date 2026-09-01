// src/BuyerDecision.jsx - FIXED VERSION

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';

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

const BuyerDecision = ({ 
  existingData,        // ✅ Pass profile data from parent
  onSkip,              // ✅ Callback for skip
  onAddInterests,      // ✅ Callback for add interests
  onSwitchMode,        // ✅ Callback for switching modes
  loading: parentLoading = false 
}) => {
  const [loading, setLoading] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [tempLocation, setTempLocation] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [profileData, setProfileData] = useState(existingData || null);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false); // ✅ Set to false initially

  const navigate = useNavigate();

  const safeNavigate = (path) => {
    try {
      navigate(path);
    } catch (err) {
      console.warn('[BuyerDecision] Navigation failed:', err);
      try {
        window.location.href = path;
      } catch (fallbackErr) {
        console.error('[BuyerDecision] Fallback navigation failed:', fallbackErr);
        setError('Unable to navigate. Please refresh the page.');
      }
    }
  };

  // ✅ Simply use existingData from parent - NO FETCH NEEDED
  useEffect(() => {
    if (existingData) {
      setProfileData(existingData);
    }
    setChecking(false); // ✅ Always set to false after data is set
  }, [existingData]);

  // ✅ HANDLE ADD INTERESTS
  const handleAddInterests = () => {
    if (onAddInterests) {
      onAddInterests();
    }
  };

  // ✅ HANDLE SKIP - Simplified
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
      
      // ✅ Update database
      const { error: updateError } = await fetchWithRetry(() =>
        supabase
          .from('profiles')
          .update({
            is_buyer: true,
            buyer_setup_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
      );
      
      if (updateError) {
        console.error('[BuyerDecision] Update error:', updateError);
        setError('Failed to update profile. Please try again.');
        setLoading(false);
        return;
      }
      
      // ✅ Call parent callback
      if (onSkip) {
        onSkip();
      } else {
        safeNavigate('/app');
      }
      
    } catch (err) {
      console.error('[BuyerDecision] Skip error:', err);
      setError('Failed to skip. Please try again.');
      setLoading(false);
    }
  };

  // ✅ Save location and phone
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
            is_buyer: true,
            buyer_setup_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
      );
      
      if (updateError) {
        console.error('[BuyerDecision] Save error:', updateError);
        setError('Failed to save information. Please try again.');
        setLoading(false);
        return;
      }
      
      setShowLocationModal(false);
      
      // ✅ Call parent callback
      if (onSkip) {
        onSkip();
      } else {
        safeNavigate('/app');
      }
      
    } catch (err) {
      console.error('[BuyerDecision] Save error:', err);
      setError('Failed to save information. Please check your connection.');
      setLoading(false);
    }
  };

  // ✅ If checking is true, show loading spinner
  if (checking) {
    return (
      <div className="buyer-decision-page" style={{
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

  // ✅ Main Decision UI
  return (
    <div className="buyer-decision-page" style={{
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
              Welcome Buyer! 🛍️
            </div>
            <div style={{ color: '#666', fontSize: '15px', fontWeight: '400' }}>
              Would you like to add your shopping interests now?
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
              Adding interests helps sellers find you with relevant products.<br />
              You can always add or update them later from your dashboard.
            </p>
            {profileData?.location && profileData?.phone_number && (
              <p style={{ color: '#16a34a', fontSize: '12px', marginTop: '10px' }}>
                ✓ Your profile is complete (Location and Phone saved)
              </p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* ✅ ADD INTERESTS */}
            <button
              onClick={handleAddInterests}
              disabled={parentLoading || loading}
              style={{
                width: '100%',
                padding: '14px',
                background: (parentLoading || loading) ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: (parentLoading || loading) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                opacity: (parentLoading || loading) ? 0.7 : 1
              }}
              onMouseEnter={(e) => !(parentLoading || loading) && (e.target.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => !(parentLoading || loading) && (e.target.style.transform = 'translateY(0)')}
            >
              🎯 ADD INTERESTS NOW
            </button>

            {/* ✅ SKIP */}
            <button
              onClick={handleSkipForNow}
              disabled={parentLoading || loading}
              style={{
                width: '100%',
                padding: '14px',
                background: 'transparent',
                color: '#667eea',
                border: '2px solid #667eea',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: (parentLoading || loading) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                opacity: (parentLoading || loading) ? 0.7 : 1
              }}
              onMouseEnter={(e) => !(parentLoading || loading) && (e.target.style.background = 'rgba(102, 126, 234, 0.05)')}
              onMouseLeave={(e) => !(parentLoading || loading) && (e.target.style.background = 'transparent')}
            >
              {(parentLoading || loading) ? '⏳ Processing...' : '⏰ SKIP FOR NOW'}
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
            <p>You can always add interests later from your dashboard</p>
          </div>

          {/* Back button */}
          <button
            onClick={() => {
              navigate('/');
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
            ← Back to mode selection
          </button>
        </div>
      </div>

      {/* ✅ Location/Phone Modal - Only shown if needed */}
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
              To use Buyer mode, we need your location and phone number.
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
                placeholder="e.g., 077 123 4567 or +263 771 234 567"
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
                disabled={parentLoading || loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: (parentLoading || loading) ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (parentLoading || loading) ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.3s ease'
                }}
              >
                {(parentLoading || loading) ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(BuyerDecision);
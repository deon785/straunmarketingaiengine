import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import './SellerDecision.css';

const SellerDecision = () => {
  const [loading, setLoading] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [tempLocation, setTempLocation] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [profileData, setProfileData] = useState(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  // Fetch existing profile on load
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('location, phone_number, is_seller, seller_setup_completed')
            .eq('user_id', user.id)
            .single();
          
          setProfileData(profile);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setChecking(false);
      }
    };
    
    fetchProfile();
  }, []);

  const handleAddProducts = () => {
    navigate('/seller-form');
  };

  const handleSkipForNow = async () => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('Please log in again');
        return;
      }
      
      // Check if profile has required fields
      const hasLocation = profileData?.location && profileData.location.trim() !== '';
      const hasPhone = profileData?.phone_number && profileData.phone_number.trim() !== '';
      
      // If missing location or phone, show modal to collect
      if (!hasLocation || !hasPhone) {
        setTempLocation(profileData?.location || '');
        setTempPhone(profileData?.phone_number || '');
        setShowLocationModal(true);
        setLoading(false);
        return;
      }
      
      // Profile is complete, just update seller flags
      await completeSkip(user.id);
      
    } catch (error) {
      console.error('Error checking profile:', error);
      alert('Failed to skip. Please try again.');
      setLoading(false);
    }
  };

  const completeSkip = async (userId) => {
    try {
      // Only update seller flags, preserve existing location and phone
      const { error } = await supabase
        .from('profiles')
        .update({
          is_seller: true,
          seller_setup_completed: true,
          updated_at: new Date().toISOString()
          // IMPORTANT: Do NOT overwrite location and phone!
        })
        .eq('user_id', userId);
      
      if (error) throw error;
      
      // Navigate to social media page
      navigate('/social-media');
      
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to skip. Please try adding products instead.');
      setLoading(false);
    }
  };

  const saveLocationAndPhone = async () => {
    if (!tempLocation.trim()) {
      alert('Please enter your location');
      return;
    }
    if (!tempPhone.trim()) {
      alert('Please enter your phone number');
      return;
    }
    
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('Please log in again');
        return;
      }
      
      // Update profile with location and phone AND seller flags
      const { error } = await supabase
        .from('profiles')
        .update({
          location: tempLocation.trim(),
          phone_number: tempPhone.trim(),
          is_seller: true,
          seller_setup_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setShowLocationModal(false);
      navigate('/social-media');
      
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="seller-decision-page">
        <div className="decision-container">
          <div className="decision-card" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '24px', marginBottom: '15px' }}>⏳</div>
            <p>Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="seller-decision-page">
        <div className="decision-container">
          <div className="decision-card">
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
                Welcome Seller! 🎉
              </div>
              <div style={{ color: '#666', fontSize: '16px', fontWeight: '400' }}>
                Would you like to add your products now?
              </div>
            </div>

            <div style={{ marginBottom: '30px', textAlign: 'center' }}>
              <p style={{ color: '#718096', fontSize: '14px', lineHeight: '1.6' }}>
                You can add your products now to start selling immediately,<br />
                or skip and add them later from your dashboard.
              </p>
              {profileData?.location && profileData?.phone_number && (
                <p style={{ color: '#4CAF50', fontSize: '12px', marginTop: '10px' }}>
                  ✓ Your profile is complete (Location and Phone saved)
                </p>
              )}
              {(!profileData?.location || !profileData?.phone_number) && (
                <p style={{ color: '#ff9800', fontSize: '12px', marginTop: '10px' }}>
                  ⚠️ You'll need to provide your location and phone number to continue
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <button
                onClick={handleAddProducts}
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
                  padding: '18px',
                  background: 'transparent',
                  color: '#667eea',
                  border: '2px solid #667eea',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  opacity: loading ? 0.7 : 1
                }}
                onMouseEnter={(e) => !loading && (e.target.style.background = 'rgba(102, 126, 234, 0.05)')}
                onMouseLeave={(e) => !loading && (e.target.style.background = 'transparent')}
              >
                {loading ? '⏳ Processing...' : '⏰ SKIP FOR NOW'}
              </button>
            </div>

            <div style={{ 
              marginTop: '30px', 
              padding: '20px',
              backgroundColor: '#f7fafc',
              borderRadius: '10px',
              fontSize: '13px',
              color: '#718096',
              textAlign: 'center'
            }}>
              <p>You can always add products later from your seller dashboard</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal - Only shows if profile is missing location or phone */}
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
        }} onClick={() => setShowLocationModal(false)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            maxWidth: '450px',
            width: '100%',
            padding: '24px',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>📝 Complete Your Profile</h2>
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
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowLocationModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#ccc',
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
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SellerDecision;
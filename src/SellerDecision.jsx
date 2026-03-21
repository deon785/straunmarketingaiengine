import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import './SellerDecision.css';

const SellerDecision = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAddProducts = () => {
    // Just navigate to seller form - don't set flags yet
    navigate('/seller-form');
  };

  const handleSkipForNow = async () => {
    setLoading(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Update profile to mark seller setup as complete (without products)
        const { error } = await supabase
          .from('profiles')
          .update({
            is_seller: true,
            seller_setup_completed: true,
            // Don't require products
          })
          .eq('user_id', user.id);
        
        if (error) throw error;
        
        // Navigate directly to social media page
        // The SocialAIMarketingEngine will check the database
        navigate('/social-media');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to skip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
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
              ⏰ SKIP FOR NOW
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
  );
};

export default SellerDecision;
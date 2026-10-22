import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import SellerProfileSetup from './SellerProfileSetup';
import SellerDashboard from './SellerDashboard';
import TopNavigationBar from './TopNavigationBar'; // Import the TopBar

const fetchWithRetry = async (fetchFn, maxRetries = 3) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try { return await fetchFn(); }
    catch (err) {
      lastError = err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw lastError;
};

const SellerRouter = () => {
  const navigate = useNavigate();
  const [route, setRoute] = useState('loading');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const decide = async () => {
      try {
        const { data: { user: authUser }, error: authErr } = await fetchWithRetry(() =>
          supabase.auth.getUser()
        );
        if (authErr || !authUser) {
          if (!cancelled) { setError('Please sign in to continue.'); setRoute('unauth'); }
          return;
        }
        if (cancelled) return;
        setUser(authUser);

        const { data: prof, error: profErr } = await fetchWithRetry(() =>
          supabase.from('profiles').select('*').eq('user_id', authUser.id).maybeSingle()
        );
        if (profErr) throw profErr;
        if (cancelled) return;
        setProfile(prof);

        const complete =
          prof?.seller_setup_completed === true &&
          prof?.location?.trim() &&
          prof?.phone_number?.trim();

        setRoute(complete ? 'dashboard' : 'profile-setup');
      } catch (err) {
        console.error('SellerRouter error:', err);
        if (!cancelled) { setError(err.message || 'Failed to load seller account.'); setRoute('error'); }
      }
    };

    decide();
    return () => { cancelled = true; };
  }, []);

  // We render the TopNavigationBar for ALL states so the user always has nav
  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      
      {/* 1. TOP NAVIGATION BAR (Sticky) */}
      <TopNavigationBar 
        user={user} 
        selectedMode="seller" 
        // Add any other props your TopNavigationBar requires to show the right icons
      />

      {/* 2. PAGE CONTENT (with padding to clear the sticky header) */}
      <div style={{ paddingTop: '20px', paddingBottom: '60px' }}>
        
        {route === 'loading' && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#52607a' }}>
            Loading your shop…
          </div>
        )}

        {route === 'unauth' && (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ color: '#dc2626', marginBottom: '16px' }}>{error}</p>
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '12px 24px', background: '#4361ee', color: 'white',
                border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Go to Login
            </button>
          </div>
        )}

        {route === 'error' && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {route === 'profile-setup' && (
          <SellerProfileSetup
            user={user}
            existingProfile={profile}
            onComplete={(updatedProfile) => {
              setProfile(updatedProfile);
              setRoute('dashboard');
            }}
          />
        )}

        {route === 'dashboard' && (
          <SellerDashboard user={user} profile={profile} />
        )}
      </div>
    </div>
  );
};

export default SellerRouter;
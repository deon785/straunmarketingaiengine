// AuthContext.jsx - FINAL WORKING VERSION

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { useNavigate } from 'react-router-dom';

const UserContext = createContext(null);
const LoadingContext = createContext(true);
const ErrorContext = createContext(null);
const SelectedModeContext = createContext(null);
const AuthActionsContext = createContext(null);
const IsAuthenticatedContext = createContext(false);

const ADMIN_EMAIL = 'deonmahachi8@gmail.com';
const MODE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // ✅ Load mode with expiry check
  const [selectedMode, setSelectedMode] = useState(() => {
    try {
      const saved = localStorage.getItem('straun_selectedMode');
      const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
      const savedUserEmail = localStorage.getItem('straun_selectedMode_user');
      
      if (saved && (saved === 'seller' || saved === 'buyer')) {
        const isAdmin = savedUserEmail === ADMIN_EMAIL;
        if (isAdmin) {
          console.log('[Auth] 👑 Admin - show mode selection');
          return null;
        }
        
        if (timestamp) {
          const age = Date.now() - parseInt(timestamp);
          if (age < MODE_EXPIRY_MS) {
            console.log('[Auth] ✅ Mode active:', saved);
            return saved;
          } else {
            console.log('[Auth] ⏰ Mode expired');
            localStorage.removeItem('straun_selectedMode');
            localStorage.removeItem('straun_selectedMode_timestamp');
            localStorage.removeItem('straun_selectedMode_user');
            return null;
          }
        }
        return saved;
      }
    } catch (e) {
      console.warn('[Auth] Could not load mode:', e);
    }
    return null;
  });

  // ✅ REPLACE with this - Only check, don't clear (main.jsx already did it)
  useEffect(() => {
    // ✅ Just log the status - clearing already happened in main.jsx
    const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
    const MODE_EXPIRY_MS = 60 * 60 * 1000;
    
    if (timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age >= MODE_EXPIRY_MS) {
        console.log('[Auth] ⏰ Mode expired - session already cleared by main.jsx');
      } else {
        console.log('[Auth] ✅ Mode active (', Math.round(age / 60000), 'min)');
      }
    } else {
      console.log('[Auth] ⏰ No mode found - session already cleared by main.jsx');
    }
    
    // ✅ Set loading to false after check
    setLoading(false);
  }, []);

   // ✅ Add this useEffect to navigate after sign in
    // ✅ ONLY redirect after sign-in if the user is on the login page AND signup.jsx didn't handle it
  // The signup.jsx handles intent-based redirects (buyer-decision/seller-decision)
  // This is just a safety net for direct logins
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    // ✅ NEW: If signup.jsx just handled a redirect (within last 3 seconds), skip
    const signupTs = Number(sessionStorage.getItem('_signup_handled_redirect') || 0);
    const sinceSignup = Date.now() - signupTs;
    if (sinceSignup < 3000) {
      console.log('[REDIRECT:AuthContext] ⏭️ SKIP — signup handled this', (sinceSignup / 1000).toFixed(2), 's ago');
      return;
    }
    
    if (user && isAuthenticated) {
      // 1. Don't redirect if they are on the Admin page
      if (window.location.pathname === '/admin') {
        console.log('[Auth] 👑 On admin page - SKIPPING redirect');
        return;
      }
      
      // 2. Don't redirect if they are on the Homepage
      if (window.location.pathname === '/') {
        console.log('[Auth] 🏠 On homepage - allowing browsing');
        return;
      }

      // 3. Don't redirect if they have an intent - let signup.jsx handle it
      const params = new URLSearchParams(window.location.search);
      if (params.get('intent')) {
        console.log('[Auth] 🎯 Intent detected - letting signup.jsx handle redirect');
        return;
      }

      // 4. Only auto-redirect from /login if the user has an ACTIVE mode
      if (window.location.pathname === '/login') {
          const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
          const savedMode = localStorage.getItem('straun_selectedMode');
          
          if (savedMode && timestamp) {
              const age = Date.now() - parseInt(timestamp);
              if (age < MODE_EXPIRY_MS) {
                  console.log('[Auth] ✅ Active mode found, redirecting to /app');
                  navigate('/app', { replace: true });
              } else {
                  console.log('[Auth] ⏰ Mode expired, going to mode selection');
                  navigate('/mode-selection', { replace: true });
              }
          } else {
              console.log('[Auth] 📋 No mode set, going to mode selection');
              navigate('/mode-selection', { replace: true });
          }
      }
    }
  }, [user, isAuthenticated, navigate]);

  // ✅ Listen for auth changes (sign in, sign out)
  useEffect(() => {
    let settled = false;   // ← guard against double-fire

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] Auth event:', event);
        
        // ✅ Handle INITIAL_SESSION with NO session
        if (event === 'INITIAL_SESSION') {
          if (!session) {
            console.log('[Auth] No session - user needs to sign in');
            setLoading(false);
            return;
          }
          // If session exists, continue
          const newUser = session?.user || null;
          if (newUser?.id !== user?.id) {
            setUser(newUser);
            setIsAuthenticated(!!newUser);
            if (!settled) {
              setLoading(false);   // ✅ always clear loading on initial session
              settled = true;
            }
          
          }
          return;
        }
        
        // ✅ Handle SIGNED_IN
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const newUser = session?.user || null;
          
          if (newUser?.id !== user?.id) {
            console.log('[Auth] User signed in:', newUser?.email || 'null');
            setUser(newUser);
            setIsAuthenticated(!!newUser);
            if (!settled) {
              setLoading(false);
              settled = true;
            }

          }
          
          // ✅ Check mode after sign in
          if (newUser) {
            const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
            const savedMode = localStorage.getItem('straun_selectedMode');
            
            if (timestamp && savedMode) {
              const age = Date.now() - parseInt(timestamp);
              if (age >= MODE_EXPIRY_MS) {
                console.log('[Auth] ⏰ Mode expired');
                localStorage.removeItem('straun_selectedMode');
                localStorage.removeItem('straun_selectedMode_timestamp');
                localStorage.removeItem('straun_selectedMode_user');
                setSelectedMode(null);
              } else {
                setSelectedMode(savedMode);
              }
            }
          }
        }
        
        // ✅ Handle SIGNED_OUT
        if (event === 'SIGNED_OUT') {
          console.log('[Auth] User signed out');
          setUser(null);
          setIsAuthenticated(false);
          setLoading(false);
          setSelectedMode(null);
        }
      }
    );

    // ✅ Safety timeout — if Supabase never fires INITIAL_SESSION,
    //    unblock the app after 3 seconds
    const fallback = setTimeout(() => {
      if (!settled) {
        console.warn('[Auth] Auth listener timed out — forcing loading=false');
        setLoading(false);
        settled = true;
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // ✅ Check profile after user signs in
  useEffect(() => {
    if (!user) return;
    
    const checkProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_seller, is_buyer, seller_setup_completed, buyer_setup_completed')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('[Auth] Profile error:', error);
          return;
        }
        
        // ✅ If NO profile OR setup not complete, clear mode
        if (!data || (!data.is_seller && !data.is_buyer)) {
          console.log('[Auth] 🔴 No profile or setup incomplete - clearing mode');
          localStorage.removeItem('straun_selectedMode');
          localStorage.removeItem('straun_selectedMode_timestamp');
          localStorage.removeItem('straun_selectedMode_user');
          setSelectedMode(null);
          return;
        }
        
        // ✅ Profile complete - check if mode exists
        const savedMode = localStorage.getItem('straun_selectedMode');
        const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
        
        if (savedMode && timestamp) {
          const age = Date.now() - parseInt(timestamp);
          if (age < MODE_EXPIRY_MS) {
            console.log('[Auth] ✅ Mode active:', savedMode);
            setSelectedMode(savedMode);
          } else {
            console.log('[Auth] ⏰ Mode expired');
            localStorage.removeItem('straun_selectedMode');
            localStorage.removeItem('straun_selectedMode_timestamp');
            localStorage.removeItem('straun_selectedMode_user');
            setSelectedMode(null);
          }
        } else {
          setSelectedMode(null);
        }
        
      } catch (err) {
        console.error('[Auth] Profile check error:', err);
      }
    };
    
    checkProfile();
  }, [user]);

  // ✅ Save mode when changed
  useEffect(() => {
    try {
      if (selectedMode) {
        localStorage.setItem('straun_selectedMode', selectedMode);
        localStorage.setItem('straun_selectedMode_timestamp', String(Date.now()));
        localStorage.setItem('straun_selectedMode_user', user?.email || '');
        console.log('[Auth] 💾 Mode saved:', selectedMode);
      }
    } catch (e) {
      console.warn('[Auth] Could not save mode:', e);
    }
  }, [selectedMode, user]);

  const setMode = useCallback((mode) => {
    setSelectedMode(mode);
    if (mode) {
      localStorage.setItem('straun_selectedMode', mode);
      localStorage.setItem('straun_selectedMode_timestamp', String(Date.now()));
      localStorage.setItem('straun_selectedMode_user', user?.email || '');
    } else {
      localStorage.removeItem('straun_selectedMode');
      localStorage.removeItem('straun_selectedMode_timestamp');
      localStorage.removeItem('straun_selectedMode_user');
    }
  }, [user]);

  const clearAuthState = useCallback(() => {
    setSelectedMode(null);
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('straun_selectedMode');
    localStorage.removeItem('straun_selectedMode_timestamp');
    localStorage.removeItem('straun_selectedMode_user');
  }, []);

  const isAdmin = useCallback(() => user?.email === ADMIN_EMAIL, [user]);

  const memoizedUser = useMemo(() => user, [user]);
  const memoizedLoading = useMemo(() => loading, [loading]);
  const memoizedError = useMemo(() => error, [error]);
  const memoizedSelectedMode = useMemo(() => selectedMode, [selectedMode]);
  const memoizedIsAuthenticated = useMemo(() => isAuthenticated, [isAuthenticated]);

  const actionsValue = useMemo(() => ({
    setMode,
    clearAuthState,
    isAdmin: isAdmin(),
  }), [setMode, clearAuthState, isAdmin]);

  return (
    <UserContext.Provider value={memoizedUser}>
      <LoadingContext.Provider value={memoizedLoading}>
        <ErrorContext.Provider value={memoizedError}>
          <SelectedModeContext.Provider value={memoizedSelectedMode}>
            <IsAuthenticatedContext.Provider value={memoizedIsAuthenticated}>
              <AuthActionsContext.Provider value={actionsValue}>
                {children}
              </AuthActionsContext.Provider>
            </IsAuthenticatedContext.Provider>
          </SelectedModeContext.Provider>
        </ErrorContext.Provider>
      </LoadingContext.Provider>
    </UserContext.Provider>
  );
};

// ✅ HOOKS
export const useIsAuthenticated = () => {
  const context = useContext(IsAuthenticatedContext);
  if (context === undefined) throw new Error('useIsAuthenticated must be used within an AuthProvider');
  return context;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) throw new Error('useUser must be used within an AuthProvider');
  return context;
};

export const useAuthLoading = () => {
  const context = useContext(LoadingContext);
  if (context === undefined) throw new Error('useAuthLoading must be used within an AuthProvider');
  return context;
};

export const useAuthError = () => {
  const context = useContext(ErrorContext);
  if (context === undefined) throw new Error('useAuthError must be used within an AuthProvider');
  return context;
};

export const useSelectedMode = () => {
  const context = useContext(SelectedModeContext);
  if (context === undefined) throw new Error('useSelectedMode must be used within an AuthProvider');
  return context;
};

export const useAuthActions = () => {
  const context = useContext(AuthActionsContext);
  if (context === undefined) throw new Error('useAuthActions must be used within an AuthProvider');
  return context;
};

export const useAuthState = () => {
  const user = useUser();
  const loading = useAuthLoading();
  const error = useAuthError();
  const selectedMode = useSelectedMode();
  const isAuthenticated = useIsAuthenticated();
  const actions = useAuthActions();

  return useMemo(() => ({
    user,
    loading,
    error,
    selectedMode,
    isAuthenticated,
    isAdmin: actions?.isAdmin || false,
  }), [user, loading, error, selectedMode, isAuthenticated, actions]);
};

export const useAuth = () => {
  const state = useAuthState();
  const actions = useAuthActions();
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
};
// src/AuthContext.jsx - COMPLETE FIX

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from './lib/supabase';

// ✅ Helper to check if error is session missing (which is expected)
const isSessionMissingError = (error) => {
  if (!error) return false;
  return (
    error.message?.includes('Auth session missing') ||
    error.message?.includes('Session not found') ||
    error.message?.includes('Invalid Refresh Token')
  );
};

const UserContext = createContext(null);
const LoadingContext = createContext(true);
const ErrorContext = createContext(null);
const SelectedModeContext = createContext(null);
const AuthActionsContext = createContext(null);
const IsAuthenticatedContext = createContext(false);

export const AuthProvider = ({ children }) => {
  // ✅ These refs persist across remounts
  const initializedRef = useRef(false);
  const isMountedRef = useRef(true);
  const previousUserRef = useRef(null);
  const authSubscriptionRef = useRef(null);
  const initPromiseRef = useRef(null);
  const lastSignedInTimeRef = useRef(0);
  // ✅ Add these refs for debouncing
  const lastEventKeyRef = useRef('');
  const DEBOUNCE_MS = 2000;
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedMode, setSelectedMode] = useState(null);

  const memoizedUser = useMemo(() => user, [user]);
  const memoizedLoading = useMemo(() => loading, [loading]);
  const memoizedError = useMemo(() => error, [error]);
  const memoizedSelectedMode = useMemo(() => selectedMode, [selectedMode]);
  const memoizedIsAuthenticated = useMemo(() => isAuthenticated, [isAuthenticated]);

  const setAuthState = useCallback((newUser) => {
    if (!isMountedRef.current) {
      console.log('[Auth] Not mounted, skipping state update');
      return;
    }
    
    console.log('[Auth] Setting auth state:', newUser?.email || 'null');
    previousUserRef.current = newUser;
    setUser(newUser);
    setIsAuthenticated(!!newUser);
    setLoading(false);
    setError(null);
  }, []);

  const initializeAuth = useCallback(async () => {
    // ✅ Prevent multiple initializations
    if (initPromiseRef.current) {
      console.log('[Auth] Already initializing, waiting...');
      return initPromiseRef.current;
    }

    console.log('[Auth] Starting initialization...');
    
    initPromiseRef.current = (async () => {
      try {
        // ✅ Get session
        console.log('[Auth] Getting session...');
        
        // ✅ FIX: Try to get session with error handling
        let sessionData;
        let sessionError;
        
        try {
          const result = await supabase.auth.getSession();
          sessionData = result.data;
          sessionError = result.error;
        } catch (err) {
          // ✅ Catch the AuthSessionMissingError specifically
          if (isSessionMissingError(err)) {
            console.log('[Auth] No session found (expected for new users)');
            sessionError = null; // Treat as no session, not an error
            sessionData = { session: null };
          } else {
            throw err; // Re-throw other errors
          }
        }
        
        if (!isMountedRef.current) {
          console.log('[Auth] Not mounted, aborting');
          return;
        }
        
        // ✅ Handle session error (but not AuthSessionMissingError)
        if (sessionError && !sessionError.message?.includes('Auth session missing')) {
          console.error('[Auth] Session error:', sessionError);
          if (isMountedRef.current) {
            setLoading(false);
            setIsAuthenticated(false);
            setUser(null);
            // ✅ Clear stale tokens
            try {
              localStorage.removeItem('supabase.auth.token');
              sessionStorage.removeItem('supabase.auth.token');
            } catch (e) {}
          }
          return;
        }
        
        const newUser = sessionData?.session?.user ?? null;
        console.log('[Auth] Session found:', !!newUser, newUser?.email);
        
        // ✅ If no user, still complete initialization
        if (!newUser) {
          setLoading(false);
          setIsAuthenticated(false);
          setUser(null);
          console.log('[Auth] ✅ Initialization complete - no user');
          return;
        }
        
        setAuthState(newUser);
        console.log('[Auth] ✅ Initialization complete');
        
      } catch (err) {
        console.error('[Auth] Init error:', err);
        if (isMountedRef.current) {
          // ✅ CRITICAL: Always set loading to false, even on error
          setLoading(false);
          setIsAuthenticated(false);
          setUser(null);
        }
      }
    })();

    return initPromiseRef.current;
  }, [setAuthState]);

  const setupAuthSubscription = useCallback(() => {
    if (authSubscriptionRef.current) {
      console.log('[Auth] Subscription already exists');
      return;
    }

    console.log('[Auth] Setting up auth subscription...');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMountedRef.current) {
          console.log('[Auth] Not mounted, skipping event');
          return;
        }
        
        // ✅ DEBOUNCE: Prevent duplicate events
        const now = Date.now();
        const newUser = session?.user ?? null;
        const eventKey = `${event}_${newUser?.id || 'null'}`;
        
        // ✅ Skip if same event fired within DEBOUNCE_MS
        if (eventKey === lastEventKeyRef.current && now - lastSignedInTimeRef.current < DEBOUNCE_MS) {
          console.log('[Auth] ⏭️ Skipping duplicate event:', event);
          return;
        }
        
        // ✅ Update last event tracking
        lastEventKeyRef.current = eventKey;
        lastSignedInTimeRef.current = now;
        
        console.log('[Auth] State change event:', event);
        
        // ✅ Only update if user actually changed
        const currentUserStr = JSON.stringify(previousUserRef.current);
        const newUserStr = JSON.stringify(newUser);
        
        if (currentUserStr !== newUserStr) {
          previousUserRef.current = newUser;
          setUser(newUser);
          setIsAuthenticated(!!newUser);
          setLoading(false);
          setError(null);
        }
        
        // ✅ Handle specific events
        if (event === 'SIGNED_IN') {
          console.log('[Auth] User signed in:', newUser?.email);
          setSelectedMode(null);
          try {
            localStorage.removeItem('straun_selectedMode');
          } catch (e) {}
        }
        
        // ✅ FIX: Handle INITIAL_SESSION event properly
        if (event === 'INITIAL_SESSION') {
          console.log('[Auth] Initial session event');
          // If session exists, user is authenticated
          if (session) {
            setUser(session.user);
            setIsAuthenticated(true);
            setLoading(false);
          } else {
            // No session - this is normal for new users
            console.log('[Auth] No session on initial load (normal)');
            setUser(null);
            setIsAuthenticated(false);
            setLoading(false);
          }
        }
      }
    );
    
    authSubscriptionRef.current = subscription;
    console.log('[Auth] ✅ Subscription setup complete');
  }, [setAuthState]);

  // ✅ MAIN EFFECT - Only runs once
  useEffect(() => {
    // ✅ Prevent re-initialization
    if (initializedRef.current) {
      console.log('[Auth] Already initialized, skipping');
      return;
    }
    
    console.log('[Auth] Initializing... (first time)');
    initializedRef.current = true;
    isMountedRef.current = true;

    // Setup subscription
    setupAuthSubscription();

    // Initialize auth
    initializeAuth();

    // ✅ Safety timeout - force loading to false
    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current && loading) {
        console.warn('[Auth] ⚠️ Loading timeout - forcing loading to false');
        setLoading(false);
        if (!user) {
          setIsAuthenticated(false);
        }
      }
    }, 5000);

    // ✅ FIX: Don't unsubscribe on cleanup - keep subscription alive
    return () => {
      console.log('[Auth] Cleanup called - keeping subscription alive');
      clearTimeout(safetyTimeout);
      // ✅ Keep isMountedRef true to prevent "Not mounted" errors
      // isMountedRef.current = false; // DON'T DO THIS
    };
    
  }, []); // ✅ Empty dependency array

  // ✅ Separate effect for FINAL cleanup (when app actually closes)
  useEffect(() => {
    return () => {
      console.log('[Auth] Final cleanup - app is closing');
      if (authSubscriptionRef.current) {
        authSubscriptionRef.current.unsubscribe();
        authSubscriptionRef.current = null;
      }
      initializedRef.current = false;
      isMountedRef.current = false;
      initPromiseRef.current = null;
    };
  }, []);

  useEffect(() => {
    try {
      if (selectedMode) {
        localStorage.setItem('straun_selectedMode', selectedMode);
      } else {
        localStorage.removeItem('straun_selectedMode');
      }
    } catch (e) {}
  }, [selectedMode]);

  const setMode = useCallback((mode) => {
    setSelectedMode(mode);
    // ✅ Save for session tracking but NOT for auto-restore
    // Only save if you want to track for analytics
    if (mode) {
        try {
            // Optional: save for analytics/debugging
            sessionStorage.setItem('straun_session_mode', mode);
        } catch (e) {}
    }
  }, []);

  const clearAuthState = useCallback(() => {
    setSelectedMode(null);
    setIsAuthenticated(false);
    setUser(null);
    previousUserRef.current = null;
    try {
      localStorage.removeItem('straun_selectedMode');
      localStorage.removeItem('straun_profileComplete');
      localStorage.removeItem('straun_profileData');
    } catch (e) {}
  }, []);

  const actionsValue = useMemo(() => ({
    setMode,
    clearAuthState,
  }), [setMode, clearAuthState]);

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
  
  return useMemo(() => ({
    user,
    loading,
    error,
    selectedMode,
    isAuthenticated,
  }), [user, loading, error, selectedMode, isAuthenticated]);
};

export const useAuth = () => {
  const state = useAuthState();
  const actions = useAuthActions();
  
  return useMemo(() => ({
    ...state,
    ...actions
  }), [state, actions]);
};
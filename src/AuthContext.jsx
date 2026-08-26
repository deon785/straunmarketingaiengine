// AuthContext.jsx - Admin always shows mode, Regular users auto-skip if not expired

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

// ✅ Admin email - Admin NEVER auto-skips
const ADMIN_EMAIL = 'deonmahachi8@gmail.com';

export const AuthProvider = ({ children }) => {
  // ✅ These refs persist across remounts
  const initializedRef = useRef(false);
  const isMountedRef = useRef(true);
  const previousUserRef = useRef(null);
  const authSubscriptionRef = useRef(null);
  const initPromiseRef = useRef(null);
  const lastSignedInTimeRef = useRef(0);
  const lastEventKeyRef = useRef('');
  const DEBOUNCE_MS = 2000;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ✅ MODE EXPIRY - 1 hour for regular users
  const MODE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

  // ✅ LOAD MODE FROM LOCALSTORAGE
  // Admin: Always returns null (never auto-skip)
  // Regular user: Returns mode if not expired
  const [selectedMode, setSelectedMode] = useState(() => {
    try {
      const saved = localStorage.getItem('straun_selectedMode');
      const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
      const savedUserEmail = localStorage.getItem('straun_selectedMode_user');
      
      if (saved && (saved === 'seller' || saved === 'buyer')) {
        // ✅ Check if admin - NEVER auto-skip
        const isAdmin = savedUserEmail === ADMIN_EMAIL;
        
        if (isAdmin) {
          console.log('[Auth] 👑 Admin: Always show mode selection (never auto-skip)');
          // ✅ Admin always returns null - show mode selection
          return null;
        }
        
        // ✅ Regular user: Check expiry
        if (timestamp) {
          const age = Date.now() - parseInt(timestamp);
          if (age < MODE_EXPIRY_MS) {
            console.log('[Auth] ✅ Regular user: Mode not expired, auto-skip allowed:', saved, `(${Math.round(age / 60000)} minutes ago)`);
            return saved;
          } else {
            // Mode expired - clear it
            console.log('[Auth] ⏰ Regular user: Mode expired after 1 hour');
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

  const memoizedUser = useMemo(() => user, [user]);
  const memoizedLoading = useMemo(() => loading, [loading]);
  const memoizedError = useMemo(() => error, [error]);
  const memoizedSelectedMode = useMemo(() => selectedMode, [selectedMode]);
  const memoizedIsAuthenticated = useMemo(() => isAuthenticated, [isAuthenticated]);

  // ✅ CHECK IF CURRENT USER IS ADMIN
  const isAdmin = useCallback(() => {
    return user?.email === ADMIN_EMAIL;
  }, [user]);

  // ✅ MODE EXPIRY CHECK
  // Admin: Always returns true (always show mode selection)
  // Regular user: Returns true if expired, false if not expired
  const isModeExpired = useCallback(() => {
    // ✅ Admin: Always expired (never auto-skip)
    if (isAdmin()) {
      return true;
    }
    
    // ✅ Regular user: Check expiry
    try {
      const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
      if (timestamp) {
        const age = Date.now() - parseInt(timestamp);
        return age >= MODE_EXPIRY_MS;
      }
    } catch (e) {
      console.warn('[Auth] Could not check mode expiry:', e);
    }
    return true;
  }, [isAdmin]);

  const getModeExpiryInfo = useCallback(() => {
    // ✅ Admin never expires
    if (isAdmin()) {
      return {
        isAdmin: true,
        isExpired: false,
        timeRemaining: '∞ (Admin - never expires)',
        timeRemainingMs: Infinity,
        expiresAt: null
      };
    }
    
    try {
      const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
      const mode = localStorage.getItem('straun_selectedMode');
      
      if (!timestamp || !mode) {
        return {
          isAdmin: false,
          isExpired: true,
          timeRemaining: 'No mode selected',
          timeRemainingMs: 0,
          expiresAt: null
        };
      }
      
      const age = Date.now() - parseInt(timestamp);
      const remaining = MODE_EXPIRY_MS - age;
      const isExpired = remaining <= 0;
      
      // Format time remaining
      let timeRemainingStr;
      if (isExpired) {
        timeRemainingStr = 'EXPIRED';
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        timeRemainingStr = `${minutes}m ${seconds}s`;
      }
      
      return {
        isAdmin: false,
        isExpired,
        timeRemaining: timeRemainingStr,
        timeRemainingMs: remaining,
        expiresAt: new Date(parseInt(timestamp) + MODE_EXPIRY_MS).toLocaleTimeString()
      };
      
    } catch (e) {
      console.warn('[Auth] Could not check mode expiry:', e);
      return {
        isAdmin: false,
        isExpired: true,
        timeRemaining: 'Error checking',
        timeRemainingMs: 0,
        expiresAt: null
      };
    }
  }, [isAdmin]);

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
    
    // ✅ On login, check if user is admin
    if (newUser) {
      const isAdminUser = newUser.email === ADMIN_EMAIL;
      if (isAdminUser) {
        // ✅ Admin: Always clear mode - show mode selection
        console.log('[Auth] 👑 Admin logged in - clearing mode to show selection');
        setSelectedMode(null);
        try {
          localStorage.removeItem('straun_selectedMode');
          localStorage.removeItem('straun_selectedMode_timestamp');
          localStorage.removeItem('straun_selectedMode_user');
          localStorage.removeItem('straun_profileComplete');
          localStorage.removeItem('straun_profileData');
          localStorage.removeItem(`straun_userLocation_${newUser.id}`);
        } catch (e) {}
      } else {
        // ✅ Regular user: Try to restore mode from localStorage
        console.log('[Auth] Regular user logged in - checking for saved mode');
        try {
          const saved = localStorage.getItem('straun_selectedMode');
          const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
          
          if (saved && (saved === 'seller' || saved === 'buyer') && timestamp) {
            const age = Date.now() - parseInt(timestamp);
            if (age < MODE_EXPIRY_MS) {
              console.log('[Auth] ✅ Regular user mode restored:', saved);
              setSelectedMode(saved);
            } else {
              console.log('[Auth] ⏰ Regular user mode expired');
              localStorage.removeItem('straun_selectedMode');
              localStorage.removeItem('straun_selectedMode_timestamp');
              localStorage.removeItem('straun_selectedMode_user');
              setSelectedMode(null);
            }
          } else {
            setSelectedMode(null);
          }
        } catch (e) {
          setSelectedMode(null);
        }
      }
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    if (initPromiseRef.current) {
      console.log('[Auth] Already initializing, waiting...');
      return initPromiseRef.current;
    }

    console.log('[Auth] Starting initialization...');

    initPromiseRef.current = (async () => {
      try {
        console.log('[Auth] Getting session...');

        let sessionData;
        let sessionError;

        try {
          const result = await supabase.auth.getSession();
          sessionData = result.data;
          sessionError = result.error;
        } catch (err) {
          if (isSessionMissingError(err)) {
            console.log('[Auth] No session found (expected for new users)');
            sessionError = null;
            sessionData = { session: null };
          } else {
            throw err;
          }
        }

        if (!isMountedRef.current) {
          console.log('[Auth] Not mounted, aborting');
          return;
        }

        if (sessionError && !sessionError.message?.includes('Auth session missing')) {
          console.error('[Auth] Session error:', sessionError);
          if (isMountedRef.current) {
            setLoading(false);
            setIsAuthenticated(false);
            setUser(null);
            try {
              localStorage.removeItem('supabase.auth.token');
              sessionStorage.removeItem('supabase.auth.token');
            } catch (e) {}
          }
          return;
        }

        const newUser = sessionData?.session?.user ?? null;
        console.log('[Auth] Session found:', !!newUser, newUser?.email);

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

        const now = Date.now();
        const newUser = session?.user ?? null;
        const eventKey = `${event}_${newUser?.id || 'null'}`;

        if (eventKey === lastEventKeyRef.current && now - lastSignedInTimeRef.current < DEBOUNCE_MS) {
          console.log('[Auth] ⏭️ Skipping duplicate event:', event);
          return;
        }

        lastEventKeyRef.current = eventKey;
        lastSignedInTimeRef.current = now;

        console.log('[Auth] State change event:', event);

        const currentUserStr = JSON.stringify(previousUserRef.current);
        const newUserStr = JSON.stringify(newUser);

        if (currentUserStr !== newUserStr) {
          previousUserRef.current = newUser;
          setUser(newUser);
          setIsAuthenticated(!!newUser);
          setLoading(false);
          setError(null);
        }

        // ✅ SIGNED_IN: Handle based on user type
        if (event === 'SIGNED_IN') {
          console.log('[Auth] User signed in:', newUser?.email);
          
          if (newUser) {
            const isAdminUser = newUser.email === ADMIN_EMAIL;
            
            if (isAdminUser) {
              // ✅ Admin: Always clear mode - show mode selection
              console.log('[Auth] 👑 Admin signed in - clearing mode');
              setSelectedMode(null);
              try {
                localStorage.removeItem('straun_selectedMode');
                localStorage.removeItem('straun_selectedMode_timestamp');
                localStorage.removeItem('straun_selectedMode_user');
                localStorage.removeItem('straun_profileComplete');
                localStorage.removeItem('straun_profileData');
                if (newUser.id) {
                  localStorage.removeItem(`straun_userLocation_${newUser.id}`);
                }
              } catch (e) {}
            } else {
              // ✅ Regular user: Try to restore mode
              console.log('[Auth] Regular user signed in - checking for saved mode');
              try {
                const saved = localStorage.getItem('straun_selectedMode');
                const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
                
                if (saved && (saved === 'seller' || saved === 'buyer') && timestamp) {
                  const age = Date.now() - parseInt(timestamp);
                  if (age < MODE_EXPIRY_MS) {
                    console.log('[Auth] ✅ Regular user mode restored:', saved);
                    setSelectedMode(saved);
                  } else {
                    console.log('[Auth] ⏰ Regular user mode expired');
                    localStorage.removeItem('straun_selectedMode');
                    localStorage.removeItem('straun_selectedMode_timestamp');
                    localStorage.removeItem('straun_selectedMode_user');
                    setSelectedMode(null);
                  }
                } else {
                  setSelectedMode(null);
                }
              } catch (e) {
                setSelectedMode(null);
              }
            }
          }
        }

        if (event === 'INITIAL_SESSION') {
          console.log('[Auth] Initial session event');
          if (session) {
            setUser(session.user);
            setIsAuthenticated(true);
            setLoading(false);
            
            // ✅ Handle mode based on user type
            const newUser = session.user;
            if (newUser) {
              const isAdminUser = newUser.email === ADMIN_EMAIL;
              
              if (isAdminUser) {
                // ✅ Admin: Always clear mode
                setSelectedMode(null);
              } else {
                // ✅ Regular user: Try to restore mode
                try {
                  const saved = localStorage.getItem('straun_selectedMode');
                  const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
                  
                  if (saved && (saved === 'seller' || saved === 'buyer') && timestamp) {
                    const age = Date.now() - parseInt(timestamp);
                    if (age < MODE_EXPIRY_MS) {
                      setSelectedMode(saved);
                    } else {
                      localStorage.removeItem('straun_selectedMode');
                      localStorage.removeItem('straun_selectedMode_timestamp');
                      localStorage.removeItem('straun_selectedMode_user');
                      setSelectedMode(null);
                    }
                  } else {
                    setSelectedMode(null);
                  }
                } catch (e) {
                  setSelectedMode(null);
                }
              }
            }
          } else {
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
  }, []);

  // ✅ MAIN EFFECT - Only runs once
  useEffect(() => {
    if (initializedRef.current) {
      console.log('[Auth] Already initialized, skipping');
      return;
    }

    console.log('[Auth] Initializing... (first time)');
    initializedRef.current = true;
    isMountedRef.current = true;

    setupAuthSubscription();
    initializeAuth();

    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current && loading) {
        console.warn('[Auth] ⚠️ Loading timeout - forcing loading to false');
        setLoading(false);
        if (!user) {
          setIsAuthenticated(false);
        }
      }
    }, 5000);

    return () => {
      console.log('[Auth] Cleanup called - keeping subscription alive');
      clearTimeout(safetyTimeout);
    };

  }, []);

  // ✅ FINAL CLEANUP
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

  // ✅ SAVE MODE WITH TIMESTAMP
  useEffect(() => {
    try {
      if (selectedMode) {
        localStorage.setItem('straun_selectedMode', selectedMode);
        localStorage.setItem('straun_selectedMode_timestamp', String(Date.now()));
        localStorage.setItem('straun_selectedMode_user', user?.email || '');
        console.log('[Auth] 💾 Mode saved:', selectedMode);
      } else {
        localStorage.removeItem('straun_selectedMode');
        localStorage.removeItem('straun_selectedMode_timestamp');
        localStorage.removeItem('straun_selectedMode_user');
        console.log('[Auth] 🗑️ Mode cleared');
      }
    } catch (e) {
      console.warn('[Auth] Could not save mode:', e);
    }
  }, [selectedMode, user]);

  const setMode = useCallback((mode) => {
    if (mode === selectedMode) {
      return;
    }

    setSelectedMode(mode);

    try {
      if (mode) {
        localStorage.setItem('straun_selectedMode', mode);
        localStorage.setItem('straun_selectedMode_timestamp', String(Date.now()));
        localStorage.setItem('straun_selectedMode_user', user?.email || '');
        console.log('[Auth] 💾 Mode saved:', mode);
      } else {
        localStorage.removeItem('straun_selectedMode');
        localStorage.removeItem('straun_selectedMode_timestamp');
        localStorage.removeItem('straun_selectedMode_user');
        console.log('[Auth] 🗑️ Mode cleared');
      }
    } catch (e) {
      console.warn('[Auth] Could not save mode:', e);
    }
  }, [selectedMode, user]);

  const clearAuthState = useCallback(() => {
    setSelectedMode(null);
    setIsAuthenticated(false);
    setUser(null);
    previousUserRef.current = null;
    try {
      localStorage.removeItem('straun_selectedMode');
      localStorage.removeItem('straun_selectedMode_timestamp');
      localStorage.removeItem('straun_selectedMode_user');
      localStorage.removeItem('straun_profileComplete');
      localStorage.removeItem('straun_profileData');
    } catch (e) {}
  }, []);

  // ✅ EXPOSE isAdmin and isModeExpired through context
  const actionsValue = useMemo(() => ({
    setMode,
    clearAuthState,
    isAdmin: isAdmin(),
    isModeExpired: isModeExpired(),
    getModeExpiryInfo: getModeExpiryInfo(), 
  }), [setMode, clearAuthState, isAdmin, isModeExpired, getModeExpiryInfo]);

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
    isModeExpired: actions?.isModeExpired || false,
    getModeExpiryInfo: actions?.getModeExpiryInfo || null,
  }), [user, loading, error, selectedMode, isAuthenticated, actions]);
};

export const useAuth = () => {
  const state = useAuthState();
  const actions = useAuthActions();
  return useMemo(() => ({
    ...state,
    ...actions
  }), [state, actions]);
};
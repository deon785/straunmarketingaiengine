import React, { useState, useEffect, Suspense, lazy, useRef, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import { supabase } from './lib/supabase';
import { useNavigation } from './NavigationContext.jsx'; 

import * as Sentry from "@sentry/react";
import ReactGA from "react-ga4";
import { toast } from 'react-hot-toast';
import SocialAIMarketingEngine from './SocialAIMarketingEngine.jsx';

// ✅ ONLY import what's needed
import { useAuthState, useAuthActions } from './AuthContext.jsx';
import PullToRefreshWrapper from './PullToRefreshWrapper.jsx';
import RefreshPersistenceWrapper from './RefreshPersistWrapper.jsx';
import { userMonitor } from './userBehaviorMonitor.js';
import GlobalBackHandler from './GlobalBackHandler.jsx';
import { GlobalErrorHandler } from './GlobalErrorHandler.jsx';
import { NavigationProvider } from './NavigationContext.jsx';
import Auth from './signup.jsx';

// --- LAZY LOAD ---
const PrivacyPolicy = lazy(() => import('./PrivacyPolicy.jsx'));
const Terms = lazy(() => import('./Terms.jsx'));
const HelpCenter = lazy(() => import('./HelpCenter.jsx'));
const AdminDashboard = lazy(() => import('./AdminDashboard.jsx'));
const NotificationsList = lazy(() => import('./NotificationsList.jsx'));
const SavedSearchesManager = lazy(() => import('./SavedSearchesManager.jsx'));
const SimpleAdmin = lazy(() => import('./SimpleAdmin.jsx'));
const ResetPassword = lazy(() => import('./ResetPassword.jsx'));
const CookieBanner = lazy(() => import('./CookieBanner.jsx'));
const PushNotificationHandler = lazy(() => import('./PushNotificationHandler.jsx'));
const SellerDecision = lazy(() => import('./SellerDecision.jsx'));

// Helper function
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

// ============ ERROR BOUNDARY ============
class ComponentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ComponentErrorBoundary] Error:', error, errorInfo);
    Sentry.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          background: '#fee2e2',
          borderRadius: '8px',
          margin: '10px'
        }}>
          <h3 style={{ color: '#dc2626' }}>⚠️ Something went wrong</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>
            {this.state.error?.message || 'Please try refreshing the page'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============ SAFE NAVIGATE ============
const SafeNavigate = React.memo(({ to, replace }) => {
  try {
    return <Navigate to={to} replace={replace} />;
  } catch (err) {
    console.error('[SafeNavigate] Navigation error:', err);
    return <Navigate to="/" replace />;
  }
});
SafeNavigate.displayName = 'SafeNavigate';

// ============ LOADING COMPONENTS ============
const PageLoadingSpinner = React.memo(() => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '50vh',
    gap: '16px'
  }}>
    <div className="loading-spinner" style={{
      width: '48px',
      height: '48px',
      border: '4px solid var(--border-color)',
      borderTopColor: 'var(--primary-color)',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p>
  </div>
));
PageLoadingSpinner.displayName = 'PageLoadingSpinner';

const FullPageLoader = React.memo(() => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'var(--light-bg)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    gap: '20px'
  }}>
    <div className="loading-spinner" style={{
      width: '60px',
      height: '60px',
      border: '5px solid var(--border-color)',
      borderTopColor: 'var(--primary-color)',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <h3 style={{ color: 'var(--text-primary)' }}>Loading your experience...</h3>
    <p style={{ color: 'var(--text-secondary)' }}>Please wait while we prepare everything</p>
  </div>
));
FullPageLoader.displayName = 'FullPageLoader';

const ButtonLoadingSpinner = () => (
  <span style={{
    display: 'inline-block',
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginRight: '8px'
  }} />
);

// ============ ANALYTICS TRACKER - STABLE ============
const AnalyticsTracker = React.memo(() => {
  const location = useLocation();

  useEffect(() => {
    try {
      ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
    } catch (err) {
      console.warn('[Analytics] Failed to track:', err);
    }
  }, [location]);

  return null;
});
AnalyticsTracker.displayName = 'AnalyticsTracker';

// ✅ FIXED: NotificationWatcher - Returns null, doesn't cause re-renders
const NotificationWatcher = React.memo(() => {
  const { user } = useAuthState();
  const channelRef = useRef(null);
  const setupDone = useRef(false);

  useEffect(() => {
    if (!user?.id || setupDone.current) return;
    setupDone.current = true;

    const setupChannel = () => {
      const channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications', 
            filter: `user_id=eq.${user.id}` 
          },
          (payload) => {
            toast.success(payload.new?.message || 'New notification', {
              icon: '🔔',
              duration: 5000,
            });
          }
        )
        .subscribe();

      channelRef.current = channel;
    };

    setupChannel();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setupDone.current = false;
    };
  }, [user?.id]);

  return null; // ✅ Returns null - NO DOM elements to re-render
});
NotificationWatcher.displayName = 'NotificationWatcher';

// ============ OFFLINE BANNER - STABLE ============
const OfflineBanner = React.memo(() => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div style={{
      backgroundColor: '#dc2626',
      color: 'white',
      padding: '8px',
      textAlign: 'center',
      position: 'fixed',
      top: '60px',
      left: 0,
      right: 0,
      width: '100%',
      zIndex: 999,
      fontSize: '12px',
      fontWeight: '500'
    }}>
      📡 You are offline. Some features may be unavailable.
    </div>
  );
});
OfflineBanner.displayName = 'OfflineBanner';

// App.jsx - Updated ProtectedRoute with navigation reset
const ProtectedRoute = React.memo(({ children }) => {
  const { user, isAuthenticated, loading } = useAuthState();
  const { resetNavigation } = useNavigation();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const checkAttempts = useRef(0);
  const maxCheckAttempts = 8;
  const checkDone = useRef(false); // ✅ ADD THIS

  useEffect(() => {
    // ✅ Prevent multiple checks
    if (checkDone.current) {
      console.log('[ProtectedRoute] Already checked, skipping');
      return;
    }
    
    let mounted = true;
    let timeoutId = null;
    
    const validateSession = async () => {
      if (checkAttempts.current >= maxCheckAttempts) {
        console.warn('[ProtectedRoute] Max attempts reached');
        if (mounted) {
          setChecking(false);
          setSessionValid(false);
          checkDone.current = true;
        }
        return;
      }
      
      checkAttempts.current++;
      
      try {
        console.log(`[ProtectedRoute] Checking session (attempt ${checkAttempts.current})...`);
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('[ProtectedRoute] Session error:', error);
          setSessionValid(false);
          setChecking(false);
          checkDone.current = true;
          return;
        }
        
        if (session) {
          console.log('[ProtectedRoute] ✅ Valid session found');
          setSessionValid(true);
          setChecking(false);
          resetNavigation();
          checkDone.current = true;
          return;
        }
        
        if (loading) {
          console.log('[ProtectedRoute] Auth loading, waiting...');
          timeoutId = setTimeout(() => {
            if (mounted) {
              validateSession();
            }
          }, 500);
          return;
        }
        
        console.log('[ProtectedRoute] ❌ No valid session');
        setSessionValid(false);
        setChecking(false);
        checkDone.current = true;
        
      } catch (err) {
        console.error('[ProtectedRoute] Session check error:', err);
        if (mounted) {
          setSessionValid(false);
          setChecking(false);
          checkDone.current = true;
        }
      }
    };

    validateSession();

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loading, user, resetNavigation]);

  // Show loader while checking
  if (checking) {
    return <FullPageLoader />;
  }

  const authenticated = isAuthenticated || sessionValid || !!user;
  
  console.log('[ProtectedRoute] Auth check:', {
    isAuthenticated,
    sessionValid,
    hasUser: !!user,
    authenticated,
    path: location.pathname
  });

  if (location.pathname === '/' || location.pathname === '/seller-decision') {
    return children;
  }

  if (!authenticated) {
    console.log('[ProtectedRoute] 🔒 Redirecting to login');
    resetNavigation();
    return <Navigate to="/" replace />;
  }

  return children;
});

// ============ UPDATE NOTIFICATION ============
const UpdateNotification = React.memo(() => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handleUpdate = () => setUpdateAvailable(true);
    
    window.addEventListener('app-update-ready', handleUpdate);
    
    return () => window.removeEventListener('app-update-ready', handleUpdate);
  }, []);

  if (!updateAvailable) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '20px',
      right: '20px',
      background: '#667eea',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '12px',
      textAlign: 'center',
      zIndex: 10000,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      cursor: 'pointer'
    }}
    onClick={() => {
      setUpdateAvailable(false);
      window.location.reload();
    }}>
      🔄 New version available! Click to update
    </div>
  );
});
UpdateNotification.displayName = 'UpdateNotification';

// ============ ADMIN ROUTE ============
const AdminRoute = React.memo(({ children }) => {
  const { user, loading } = useAuthState();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const checkAdmin = async () => {
      if (!user) {
        if (isMounted) setAdminLoading(false);
        return;
      }
      
      try {
        const result = await fetchWithRetry(() => supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle());
        
        if (isMounted) {
          setIsAdmin(result?.data?.role === 'admin');
          setAdminLoading(false);
        }
      } catch (error) {
        console.error("Admin check error:", error);
        if (isMounted) {
          setIsAdmin(false);
          setAdminLoading(false);
        }
      }
    };
    
    checkAdmin();
    
    return () => {
      isMounted = false;
    };
  }, [user]);

  if (loading || adminLoading) return <FullPageLoader />;
  if (!user) return <SafeNavigate to="/" replace />;
  if (!isAdmin) return <SafeNavigate to="/app" replace />;
  
  return children;
});
AdminRoute.displayName = 'AdminRoute';

// ✅ FIXED: FeedbackButton - Only subscribes to user.id
const FeedbackButton = React.memo(() => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const { user } = useAuthState();
  const userId = user?.id || null;

  const handleSendFeedback = async () => {
    if (!navigator.onLine) {
      setFeedbackError('You are offline. Please reconnect to send feedback.');
      return;
    }

    setIsSubmitting(true);
    setFeedbackError(null);
    setFeedbackSuccess(false);
    
    try {
      const { error } = await fetchWithRetry(() => supabase
        .from('feedback')
        .insert({ 
          feedback_text: feedbackText,
          user_id: userId
        })
      );

      if (error) throw error;
      
      setFeedbackSuccess(true);
      setFeedbackText('');
      setTimeout(() => {
        setShowFeedback(false);
        setFeedbackSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setFeedbackError('Sorry, there was an error submitting feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => {
          setShowFeedback(true);
          setFeedbackError(null);
          setFeedbackSuccess(false);
        }}
        className="feedback-button"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '50px',
          padding: '12px 20px',
          cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          zIndex: 1000,
          fontSize: '14px',
          fontWeight: '500'
        }}
      >
        💬 Give Feedback
      </button>
      
      {showFeedback && (
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 1001
            }}
            onClick={() => {
              setShowFeedback(false);
              setFeedbackError(null);
              setFeedbackSuccess(false);
            }}
          />
          
          <div 
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              zIndex: 1002,
              minWidth: '300px',
              maxWidth: '90%'
            }}
          >
            <h3 style={{ margin: '0 0 15px 0' }}>Help us improve!</h3>
            
            {feedbackError && (
              <div style={{
                background: '#fee2e2',
                color: '#dc2626',
                padding: '8px 12px',
                borderRadius: '4px',
                marginBottom: '12px',
                fontSize: '13px'
              }}>
                ⚠️ {feedbackError}
              </div>
            )}
            
            {feedbackSuccess && (
              <div style={{
                background: '#dcfce7',
                color: '#16a34a',
                padding: '8px 12px',
                borderRadius: '4px',
                marginBottom: '12px',
                fontSize: '13px'
              }}>
                ✅ Thank you! Your feedback has been saved!
              </div>
            )}
            
            <textarea 
              placeholder="What's working? What's confusing? What's missing?"
              rows={4}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '15px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                resize: 'vertical'
              }}
              disabled={feedbackSuccess}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handleSendFeedback}
                disabled={isSubmitting || feedbackSuccess || !feedbackText.trim()}
                style={{
                  flex: 1,
                  background: (isSubmitting || feedbackSuccess || !feedbackText.trim()) ? '#94a3b8' : '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: (isSubmitting || feedbackSuccess || !feedbackText.trim()) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isSubmitting && <ButtonLoadingSpinner />}
                {isSubmitting ? 'Sending...' : feedbackSuccess ? '✓ Sent!' : 'Send Feedback'}
              </button>
              <button 
                onClick={() => {
                  setShowFeedback(false);
                  setFeedbackError(null);
                  setFeedbackSuccess(false);
                }}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
});
FeedbackButton.displayName = 'FeedbackButton';

// ✅ FIXED: AppHeader - Only shows when user is authenticated
const AppHeader = React.memo(() => {
  const { user, isAuthenticated } = useAuthState();
  
  // Don't render header on auth page
  if (!isAuthenticated) return null;
  
  return (
    <header className="app-header">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '100%',
        padding: '0 1rem',
        color: 'white',
        background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
            Straun Marketing AI Engine
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user && (
            <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>
              Hi, {user.email?.split('@')[0] || 'User'}
            </span>
          )}
        </div>
      </div>
    </header>
  );
});
AppHeader.displayName = 'AppHeader';

const MemoizedAuth = Auth;
const MemoizedSellerDecision = React.memo(SellerDecision);

// ============ MAIN APP - OPTIMIZED ============
function App() {
  // ✅ Session refresh on focus
  useEffect(() => {
    const refreshSessionOnFocus = async () => {
      try {
        const { data: { session }, error } = await fetchWithRetry(() => supabase.auth.getSession());
        
        if (error || !session) return;
        
        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        
        if (expiresAt - now < 300) {
          console.log('Session expiring soon, refreshing...');
          await fetchWithRetry(() => supabase.auth.refreshSession());
        }
      } catch (err) {
        console.error('Session refresh error:', err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSessionOnFocus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <Sentry.ErrorBoundary
      fallback={<p>Something went wrong. We've been notified!</p>}
      showDialog
    >
      <GlobalErrorHandler>
        {/* ✅ WRAP EVERYTHING WITH AuthProvider */}
        
          <Router>
            <NavigationProvider>
              <RefreshPersistenceWrapper>
                <PullToRefreshWrapper>
                  <GlobalBackHandler />
                  <AnalyticsTracker />
                  <NotificationWatcher />
                  
                  <div className="app">
                    <OfflineBanner />
                    
                    <main>
                      <Suspense fallback={<PageLoadingSpinner />}>
                        <Routes>
                          <Route path="/" element={<Auth />} />
                          <Route path="/seller-decision" element={<MemoizedSellerDecision />} />
                          
                          <Route path="/app" element={
                            <ProtectedRoute>
                              <ComponentErrorBoundary>
                                <SocialAIMarketingEngine />
                              </ComponentErrorBoundary>
                            </ProtectedRoute>
                          } />
                          
                          <Route path="/notifications" element={
                            <ProtectedRoute>
                              <ComponentErrorBoundary>
                                <NotificationsList />
                              </ComponentErrorBoundary>
                            </ProtectedRoute>
                          } />

                          <Route path="/privacy" element={<PrivacyPolicy />} />
                          <Route path="/terms" element={<Terms />} />
                          <Route path="/help" element={<HelpCenter />} />
                          <Route path="/saved-searches" element={<SavedSearchesManager />} />
                          <Route path="/reset-password" element={<ResetPassword />} />
                          <Route path="/admin" element={<SimpleAdmin />} />
                          
                          <Route path="*" element={<SafeNavigate to="/" replace />} />
                        </Routes>
                      </Suspense>
                    </main>
                    
                    <Suspense fallback={null}>
                      <CookieBanner />
                    </Suspense>
                    
                    <FeedbackButton />
                    
                    <Suspense fallback={null}>
                      <PushNotificationHandler />
                    </Suspense>
                  </div>
                </PullToRefreshWrapper>
              </RefreshPersistenceWrapper>
            </NavigationProvider>
          </Router>
        
      </GlobalErrorHandler>
    </Sentry.ErrorBoundary>
  );
}

export default React.memo(App);
export { PageLoadingSpinner, FullPageLoader, ButtonLoadingSpinner };
import React, { useState, useEffect, Suspense, lazy, useRef, useTransition } from 'react'; // Added useTransition
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import { supabase } from './lib/supabase';
import CookieBanner from './CookieBanner.jsx';
import * as Sentry from "@sentry/react";
import ReactGA from "react-ga4";
import { toast, Toaster } from 'react-hot-toast';

// Import AuthContext from separate file
import { AuthProvider, useAuth } from './AuthContext.jsx';
import PullToRefreshWrapper from './PullToRefreshWrapper.jsx';

import RefreshPersistenceWrapper from './RefreshPersistWrapper.jsx';
import { userMonitor } from './userBehaviorMonitor.js';
import GlobalBackHandler from './GlobalBackHandler.jsx';
import { NavigationProvider } from './NavigationContext.jsx';
import SellerDecision from './SellerDecision.jsx'; 

import PushNotificationHandler from './PushNotificationHandler.jsx';

// --- LAZY LOADED COMPONENTS ---
const Auth = lazy(() => import('./signup'));
const SocialAIMarketingEngine = lazy(() => import('./SocialAIMarketingEngine.jsx'));
const PrivacyPolicy = lazy(() => import('./PrivacyPolicy.jsx'));
const Terms = lazy(() => import('./Terms.jsx'));
const HelpCenter = lazy(() => import('./HelpCenter.jsx'));
const AdminDashboard = lazy(() => import('./AdminDashboard.jsx'));
const NotificationsList = lazy(() => import('./NotificationsList'));
const WishlistButton = lazy(() => import('./WishlistButton.jsx'));
const SimpleAdmin = lazy(() => import('./SimpleAdmin'));
const ResetPassword = lazy(() => import('./ResetPassword.jsx'));

// ============ LOADING COMPONENTS ============
const PageLoadingSpinner = () => (
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
);

const FullPageLoader = () => (
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
);

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

// ============ subscribeToPush Function ============
async function subscribeToPush(userId) {
  if (!userId) {
    console.error("No userId provided for push subscription");
    return;
  }
  
  if (!('PushManager' in window)) {
    console.log("Push notifications not supported");
    return;
  }
  
  let registration;
  try {
    registration = await navigator.serviceWorker.ready;
    if (!registration) {
      console.error("Service worker not ready");
      return;
    }
  } catch (err) {
    console.error("Service worker error:", err);
    return;
  }
  
  try {
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error("VAPID key missing");
        return;
      }
      
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey
      });
    }
    
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ 
        user_id: userId,
        subscription_json: subscription,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("Error saving push subscription:", error);
    } else {
      console.log("✅ Push subscription saved");
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log("Push notifications not supported");
    } else {
      console.error("Push subscription error:", error);
    }
  }
}

// AnalyticsTracker component
const AnalyticsTracker = () => {
  const location = useLocation();

  useEffect(() => {
    ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
  }, [location]);

  return null;
};

const NotificationWatcher = () => {
  const { user } = useAuth();
  const [subscriptionAttempted, setSubscriptionAttempted] = useState(false);
  const channelRef = useRef(null);
  const pushAttempted = useRef(false);

  useEffect(() => {
    if (!user || subscriptionAttempted || pushAttempted.current) return;
    
    pushAttempted.current = true;
    
    const initPushSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration) {
          await subscribeToPush(user.id);
          console.log("✅ Push subscription completed");
          setSubscriptionAttempted(true);
        }
      } catch (err) {
        console.error("Push subscription failed:", err);
        setSubscriptionAttempted(true);
      }
    };
    
    initPushSubscription();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let isSubscribed = true;

    const setupNotificationListener = async () => {
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
      }

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
            if (!isSubscribed) return;
            
            const audio = new Audio('https://cdn.pixabay.com/audio/2025/01/24/audio_9e338872f2.mp3');
            audio.play().catch(() => console.log("Audio play failed"));
            
            toast.success(payload.new.message, {
              icon: '🔔',
              duration: 5000,
            });
          }
        )
        .subscribe();

      if (isSubscribed) {
        channelRef.current = channel;
      }
    };

    setupNotificationListener();

    return () => {
      isSubscribed = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);

  return <Toaster position="top-right" />;
};

const OfflineBanner = () => {
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
};

// ============ ProtectedRoute with Loading State ============
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  
  if (!user && location.pathname !== '/') {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

const UpdateNotification = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handleUpdate = () => setUpdateAvailable(true);
    window.addEventListener('app-update-ready', handleUpdate);
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.addEventListener('updatefound', () => {
          console.log('Update found');
          setUpdateAvailable(true);
        });
      });
    }
    
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
      cursor: 'pointer',
      animation: 'slideUp 0.3s ease'
    }}
    onClick={() => {
      setUpdateAvailable(false);
      window.location.reload();
    }}>
      🔄 New version available! Click here to update.
    </div>
  );
};

// ============ AdminRoute ============
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
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
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (isMounted) {
          if (data?.role === 'admin') {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
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
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/app" replace />;
  
  return children;
};

const FeedbackButton = () => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const handleSendFeedback = async () => {
    if (!navigator.onLine) {
      alert("You are offline. Please reconnect to send feedback.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('feedback')
        .insert({ 
          feedback_text: feedbackText,
          user_id: user?.id || null
        });

      if (error) throw error;
      
      alert('Thank you! Your feedback has been saved!');
      setFeedbackText('');
      setShowFeedback(false);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      alert('Sorry, there was an error submitting feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setShowFeedback(true)}
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
            onClick={() => setShowFeedback(false)}
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
              minWidth: '300px'
            }}
          >
            <h3 style={{ marginBottom: '15px' }}>Help us improve!</h3>
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
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handleSendFeedback}
                disabled={isSubmitting}
                style={{
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isSubmitting && <ButtonLoadingSpinner />}
                {isSubmitting ? 'Sending...' : 'Send Feedback'}
              </button>
              <button 
                onClick={() => setShowFeedback(false)}
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
};

// Simple Header Component
const AppHeader = () => {
  const { user } = useAuth();
  
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
            Your App Name
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user ? (
            <>
              <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                Hi, {user.email?.split('@')[0] || 'User'}
              </span>
            </>
          ) : (
            <span>Welcome!</span>
          )}
        </div>
      </div>
    </header>
  );
};

// ============ MAIN APP ============
function App() {
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    // Simulate initial app loading
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 500);
    
    console.log('App initialized');
    
    return () => clearTimeout(timer);
  }, []);

  if (isInitialLoading) {
    return <FullPageLoader />;
  }

  return (
    <Sentry.ErrorBoundary
      fallback={<p>Something went wrong. We've been notified!</p>}
      showDialog
    >
      <AuthProvider>
        <Router>
          <NavigationProvider>
            <RefreshPersistenceWrapper>
              <PullToRefreshWrapper>
                <GlobalBackHandler />
                <AnalyticsTracker />
                <NotificationWatcher />
                
                <AppHeader />
                
                <div className="app">
                  <OfflineBanner />
                  
                  <main>
                    {/* Main Suspense for route-based lazy loading */}
                    <Suspense fallback={<PageLoadingSpinner />}>
                      <Routes>
                        <Route path="/" element={<Auth />} />
                        <Route path="/seller-decision" element={<SellerDecision />} />
                        
                        <Route path="/app" element={
                          <ProtectedRoute>
                            <SocialAIMarketingEngine />
                          </ProtectedRoute>
                        } />
                        
                        <Route path="/notifications" element={
                          <ProtectedRoute>
                            <NotificationsList />
                          </ProtectedRoute>
                        } />

                        <Route path="/privacy" element={<PrivacyPolicy />} />
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/help" element={<HelpCenter />} />
                        <Route path="/wishlist" element={<WishlistButton />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/reset-password#/*" element={<ResetPassword />} />
                        <Route path="/admin" element={<SimpleAdmin />} />
                        
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Suspense>
                  </main>
                  
                  <CookieBanner /> 
                  <FeedbackButton />
                  <PushNotificationHandler />
                  {/* <UpdateNotification /> */}
                </div>
              </PullToRefreshWrapper>
            </RefreshPersistenceWrapper>
          </NavigationProvider>
        </Router>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;

// Export loading components for use in other files
export { PageLoadingSpinner, FullPageLoader, ButtonLoadingSpinner };
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Auth from './signup';
import SocialAIMarketingEngine from './SocialAIMarketingEngine';
import PrivacyPolicy from './PrivacyPolicy';
import Terms from './Terms.jsx';
import './App.css';
import { supabase } from './lib/supabase';
import CookieBanner from './CookieBanner.jsx';
import * as Sentry from "@sentry/react";
import ReactGA from "react-ga4";
import { toast, Toaster } from 'react-hot-toast';
import HelpCenter from './HelpCenter.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import NotificationsList from './NotificationsList';
import WishlistButton from './WishlistButton.jsx';

import React, { useState, useEffect } from 'react';
import SimpleAdmin from './SimpleAdmin';

import ResetPassword from './ResetPassword.jsx';

// Import AuthContext from separate file
import { AuthProvider, useAuth } from './AuthContext.jsx';

import RefreshPersistenceWrapper from './RefreshPersistWrapper.jsx';
import { userMonitor } from './userBehaviorMonitor.js';

const TestAdmin = () => {
  console.log('TestAdmin loaded');
  return (
    <div style={{ padding: '40px' }}>
      <h1>Test Admin - No Auth</h1>
      <p>If you see this, routing works.</p>
      <button onClick={() => window.location.href = '/admin-test'}>
        Try Admin Dashboard
      </button>
    </div>
  );
};

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
  
  useEffect(() => {
    if (!user) return;
    
    // Track notification access
    if (userMonitor) {
      userMonitor.logAction(user.id, 'notifications_view');
    }
    
    const listen = async () => {
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const audio = new Audio('https://cdn.pixabay.com/audio/2025/01/24/audio_9e338872f2.mp3');
            audio.play().catch(() => console.log("Sound will play after next user tap."));
            toast.success(payload.new.message, {
              icon: '🔔',
              style: {
                borderRadius: '8px',
                background: '#333',
                color: '#000000ff',
              },
            });
          }
        )
        .subscribe();

      return () => supabase.removeChannel(channel);
    };
    
    listen();
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
      backgroundColor: '#b91c1c',
      color: 'white',
      padding: '10px',
      textAlign: 'center',
      position: 'fixed',
      top: '4rem', // Start below the fixed header
      width: '100%',
      zIndex: 999,
      fontSize: '14px',
      fontWeight: 'bold'
    }}>
      📡 You are currently offline. Some features like AI generation and saving won't work.
    </div>
  );
};

// ============ ProtectedRoute ============
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  
  return children;
};

// ============ AdminRoute ============
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setAdminLoading(false);
        return;
      }
      
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (data?.role === 'admin') setIsAdmin(true);
      setAdminLoading(false);
    };
    
    checkAdmin();
  }, [user]);

  if (loading || adminLoading) return <div>Checking Permissions...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/app" replace />;
  
  return children;
};

const FeedbackButton = () => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const { user } = useAuth();

  const handleSendFeedback = async () => {
    if (!navigator.onLine) {
      alert("You are offline. Please reconnect to send feedback.");
      return;
    }

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
                style={{
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Send Feedback
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
        color: 'white'
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
  // Initialize Sentry or other services
  useEffect(() => {
    console.log('App initialized');
  }, []);

  return (
    <Sentry.ErrorBoundary
      fallback={<p>Something went wrong. We've been notified!</p>}
      showDialog
    >
      <AuthProvider>
        <Router>
          <RefreshPersistenceWrapper>
            <AnalyticsTracker />
            <NotificationWatcher />
            
            {/* Fixed Header */}
            <AppHeader />
            
            <div className="app">
              <OfflineBanner />
              
              {/* Main Content Area with proper spacing */}
              <main>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Auth />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/help" element={<HelpCenter />} />
                  <Route path="/wishlist" element={<WishlistButton />} />

                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/admin" element={<SimpleAdmin />} />
                  
                  {/* Protected Routes */}
                  <Route path="/app" element={
                    <ProtectedRoute>
                      <SocialAIMarketingEngine />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/admin" element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  } />
                                    
                  <Route path="/notifications" element={
                    <ProtectedRoute>
                      <NotificationsList />
                    </ProtectedRoute>
                  } />
                  
                  {/* Catch-all */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              
              <CookieBanner /> 
              <FeedbackButton />
            </div>
          </RefreshPersistenceWrapper>
        </Router>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;
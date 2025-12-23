import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './signup';

import SocialAIMarketingEngine from './SocialAIMarketingEngine';
import PrivacyPolicy from './PrivacyPolicy';

import './App.css';
import { supabase } from './lib/supabase';
import ErrorBoundary from './ErrorBoundary.jsx';

import CookieBanner from './CookieBanner.jsx';
import * as Sentry from "@sentry/react";

import { useLocation } from "react-router-dom";
import ReactGA from "react-ga4";
import { toast, Toaster } from 'react-hot-toast';
import HelpCenter from './HelpCenter.jsx';
import AdminDashboard from './AdminDashboard.jsx';

import NotificationsList from './NotificationsList';
import WishlistButton from './WishlistButton.jsx';


export const NotificationWatcher = () => {
  useEffect(() => {
    const listen = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
              const audio = new Audio('https://cdn.pixabay.com/audio/2025/01/24/audio_9e338872f2.mp3'); // Path to your sound file
              audio.play().catch(() => console.log("Sound will play after next user tap."));
            toast.success(payload.new.message, {
              icon: '🔔',
              style: {
                  borderRadius: '8px',
                  background: '#333',
                  color: '#000000ff',
              },
            
            });
          setUnreadCount(prev => prev + 1);  
          }
        )
        .subscribe();

      return () => supabase.removeChannel(channel);
    };
    listen();
  }, []);

  return <Toaster position="top-right" />;
};

const AnalyticsTracker = () => {
  const location = useLocation();

  useEffect(() => {
    ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
  }, [location]);

  return null;
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
      backgroundColor: '#b91c1c', // Deep red
      color: 'white',
      padding: '10px',
      textAlign: 'center',
      position: 'fixed',
      top: 0,
      width: '100%',
      zIndex: 9999,
      fontSize: '14px',
      fontWeight: 'bold'
    }}>
      📡 You are currently offline. Some features like AI generation and saving won't work.
    </div>
  );
};

const AdminRoute = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (data?.role === 'admin') setIsAdmin(true);
      }
      setLoading(false);
    };
    checkAdmin();
  }, []);

  if (loading) return <div>Checking Permissions...</div>;
  return isAdmin ? children : <Navigate to="/app" replace />;
};

// FIXED ProtectedRoute with proper state management
const ProtectedRoute = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div>Loading...</div>; // Prevent redirecting while checking auth

  if (!session) {
    return <Navigate to="/" replace />;
  }

  return children;
};
// ============ ADD FEEDBACK BUTTON COMPONENT HERE ============
const FeedbackButton = () => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

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
        });

      if (error) {
        console.error('Error submitting feedback:', error.message);
        alert('Sorry, there was an error submitting feedback.');
        return;
      }

      alert('Thank you! Your feedback has been saved!');
      setFeedbackText('');
      setShowFeedback(false);

    } catch (err) {
      console.error('Unexpected error:', err);
      alert('An unexpected error occurred.');
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
// ============ END FEEDBACK BUTTON COMPONENT ============

const unlockAudio = () => {
    const audio = new Audio('https://cdn.pixabay.com/audio/2025/01/24/audio_9e338872f2.mp3');
    audio.muted = true; // Play it muted once to "wake up" the browser audio engine
    audio.play().then(() => {
        audio.pause();
        audio.muted = false;
        console.log("Audio unlocked for notifications!");
    });
};
// Main App function - CORRECTED
function App() {
  const [unreadCount, setUnreadCount] = useState(0);

  const getUnreadCount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'unread');

      if (!error) setUnreadCount(count || 0);

    useEffect(() => {
        getUnreadCount();
    }, []);
  };
  
  return (
    <Sentry.ErrorBoundary
      fallback={<p>Something went wrong. We've been notified!</p>}
      showDialog // ✅ This adds the "User Feedback" popup on crash
    >
      <Router>
        <AnalyticsTracker />
        
        <div className="app">
          <OfflineBanner />
          <Routes>
            {/* 1. Public Route: Login/Signup */}
            <Route path="/" element={<Auth />} />

            {/* 2. Public Route: Legal (GDPR Requirement) */}
            <Route path="/privacy" element={<PrivacyPolicy />} />

            <Route path="/wishlist" element={<WishlistButton />} />

            {/* 4. Public Route: Help Center */}
            <Route path="/help" element={<HelpCenter />} />

            {/* 3. Protected Route: Main App Engine */}
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
            
            <Route path="/notifications" element={<NotificationsList />} />

            {/* 5. Catch-all: Redirect unknown paths to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <CookieBanner /> 
          <FeedbackButton />
        </div>
      </Router>
    </Sentry.ErrorBoundary>
  );
}

export default App;
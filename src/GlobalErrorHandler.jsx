// src/GlobalErrorHandler.jsx
import React, { useEffect, useState } from 'react';
// ✅ Import errorRecovery as named export (it's now exported both ways)
import { errorRecovery, ErrorSeverity } from './utils/errorRecovery.js';
import * as Sentry from "@sentry/react";
import { toast } from 'react-hot-toast';

export function GlobalErrorHandler({ children }) {
  const [showFallback, setShowFallback] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Prevent reload loops
    if (errorRecovery && errorRecovery.isInReloadLoop && errorRecovery.isInReloadLoop()) {
      console.warn('[Global] Detected reload loop, preventing further reloads');
      setShowFallback(true);
      setErrorMessage('The app is having trouble loading. Please clear your browser cache or try again later.');
      return;
    }

    // Global error handler
    const handleGlobalError = (event) => {
      event.preventDefault();
      
      const error = event.error || event;
      console.error('[Global] Uncaught error:', error);
      
      if (errorRecovery && errorRecovery.handleError) {
        errorRecovery.handleError(error, {
          showToast: (toastOptions) => {
            toast.error(toastOptions.message);
          },
          showFallback: (err) => {
            setShowFallback(true);
            setErrorMessage(err.message || 'Something went wrong');
          },
          saveState: () => {
            try {
              const criticalState = {
                userId: localStorage.getItem('userId'),
                lastRoute: window.location.pathname
              };
              sessionStorage.setItem('preReloadState', JSON.stringify(criticalState));
            } catch (e) {}
          }
        });
      } else {
        setShowFallback(true);
        setErrorMessage(error.message || 'Something went wrong');
      }
    };

    // Unhandled promise rejection handler
    const handleUnhandledRejection = (event) => {
      event.preventDefault();
      
      const error = event.reason;
      console.error('[Global] Unhandled rejection:', error);
      
      if (errorRecovery && errorRecovery.handleError) {
        errorRecovery.handleError(error, {
          showToast: (toastOptions) => {
            toast.error(toastOptions.message);
          }
        });
      } else {
        toast.error(error?.message || 'An unexpected error occurred');
      }
    };

    // Network error handler
    const handleOnline = () => {
      toast.success('Back online!', { duration: 3000 });
      if (errorRecovery && errorRecovery.resetRecoveryAttempts) {
        errorRecovery.resetRecoveryAttempts('NETWORK_ERROR');
      }
    };

    const handleOffline = () => {
      toast.error('You are offline. Some features may be unavailable.', {
        duration: 5000
      });
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show fallback UI if needed
  if (showFallback) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
        <h1>Something went wrong</h1>
        <p style={{ maxWidth: '400px', margin: '10px 0 20px' }}>
          {errorMessage || 'The application encountered an unexpected error.'}
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Refresh Page
          </button>
          <button
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }}
            style={{
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid white',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Clear Cache & Refresh
          </button>
        </div>
        <button
          onClick={() => {
            const errorId = Sentry.captureMessage('User reported crash');
            alert(`Error reported. Reference ID: ${errorId}\n\nPlease contact support with this ID.`);
          }}
          style={{
            marginTop: '30px',
            padding: '8px 16px',
            background: 'transparent',
            color: 'rgba(255,255,255,0.7)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Report this issue
        </button>
      </div>
    );
  }

  return children;
}
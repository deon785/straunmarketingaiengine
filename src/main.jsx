// ============================================================
// ✅ ONLY CLEAR SESSION - Keep mode data intact
// ============================================================
(function clearExpiredSession() {
  try {
    const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
    const MODE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
    
    // ✅ Check if mode EXISTS and is EXPIRED
    if (timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age >= MODE_EXPIRY_MS) {
        console.log('[Main] ⏰ Mode expired - clearing session');
        
        // ✅ ONLY delete session token
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('supabase.auth.token');
        
        // ✅ Keep mode data - don't delete it!
        // straun_selectedMode, straun_selectedMode_timestamp, straun_selectedMode_user are KEPT
        
        console.log('[Main] ✅ Session cleared, mode data kept');
      } else {
        console.log('[Main] ✅ Mode is still active (', Math.round(age / 60000), 'minutes old)');
        // ✅ Mode is active - DO NOT clear anything!
      }
    } else {
      console.log('[Main] ⏰ No mode found - clearing session');
      // No mode exists, clear session
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('supabase.auth.token');
    }
  } catch (e) {
    // Silent fail
  }
})();
// ============================================================


import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from "@sentry/react";
import './index.css';
import App from './App.jsx'; 
import ReactGA from "react-ga4";
import { LoadingProvider } from './LoadingContext';
import { AuthProvider } from './AuthContext';
import { GlobalErrorHandler } from './GlobalErrorHandler';
import { Toaster } from 'react-hot-toast';
import errorRecovery, { executeWithRecovery } from './utils/errorRecovery.js?v=2'; // ✅ SINGLE IMPORT
import { ThemeProvider } from './ThemeContext';

// ========== ANALYTICS ==========
try {
  ReactGA.initialize("G-RWLWLNQM67");
  ReactGA.send({ hitType: "pageview", page: window.location.pathname });
  console.log('[Analytics] Initialized');
} catch (error) {
  console.error('[Analytics] Failed to initialize:', error);
}

// ========== OFFLINE DETECTION ==========
window.addEventListener('online', () => {
  console.log('[App] Online - reconnecting');
  window.dispatchEvent(new CustomEvent('app-online'));
});

window.addEventListener('offline', () => {
  console.warn('[App] Offline - some features may be unavailable');
  window.dispatchEvent(new CustomEvent('app-offline'));
});

// Check initial online status
if (!navigator.onLine) {
  console.warn('[App] Starting offline');
}

// ========== SENTRY ==========
Sentry.init({
  dsn: "https://6d8334654e952f41b119d852a4a08f80@o4510563455729664.ingest.de.sentry.io/4510563458482256",
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  tracesSampleRate: 0.3,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
  
  ignoreErrors: [
    'ServiceWorker registration failed',
    'Failed to register a ServiceWorker',
    'ResizeObserver loop completed with undelivered notifications',
    'NetworkError when attempting to fetch resource',
    'Failed to fetch dynamically imported module',
    'Loading chunk failed',
    'ChunkLoadError',
  ],
  
  denyUrls: [
    /serviceWorker/i,
    /extension/i,
    /chrome-extension/i,
    /moz-extension/i,
  ],
  
  beforeSend(event) {
    if (event.tags?.autoRecovered === true && event.tags?.severity === 'low') {
      console.log('[Sentry] Skipping auto-recovered error');
      return null;
    }
    
    if (event.exception?.values?.[0]?.value?.includes('Failed to fetch') &&
        event.tags?.retryCount > 0) {
      console.log('[Sentry] Skipping network error that will retry');
      return null;
    }
    
    if (sessionStorage.getItem('isReloading') === 'true') {
      console.log('[Sentry] Skipping error during page reload');
      return null;
    }
    
    return event;
  },
  
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'console' && 
        breadcrumb.message?.includes('[Recovery]')) {
      breadcrumb.data = { ...breadcrumb.data, isRecoveryLog: true };
    }
    return breadcrumb;
  }
});

console.log('[Sentry] Initialized');

// ========== GLOBAL ERROR PREVENTION ==========
if (import.meta.env.PROD) {
  const originalError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === 'string' && 
        (args[0].includes('ReactDOM.render') ||
         args[0].includes('download the React DevTools'))) {
      return;
    }
    originalError.apply(console, args);
  };
}

// ========== PREVENT RELOAD LOOPS ==========
const checkReloadLoop = () => {
  const reloadCount = parseInt(sessionStorage.getItem('reloadCount') || '0');
  const lastReloadTime = parseInt(sessionStorage.getItem('lastReloadTime') || '0');
  const now = Date.now();
  
  if (now - lastReloadTime < 5000) {
    const newCount = reloadCount + 1;
    sessionStorage.setItem('reloadCount', newCount.toString());
    
    if (newCount >= 3) {
      console.error('[App] Detected reload loop!');
      sessionStorage.setItem('reloadLoopDetected', 'true');
      
      Sentry.captureMessage('Reload loop detected', {
        severity: 'error',
        tags: { type: 'reloadLoop' }
      });
      
      const rootElement = document.getElementById('root');
      if (rootElement) {
        rootElement.innerHTML = `
          <div style="text-align: center; padding: 50px 20px; font-family: system-ui;">
            <h2>⚠️ The app is having trouble loading</h2>
            <p>Please try one of these options:</p>
            <div style="margin: 30px 0;">
              <button onclick="localStorage.clear(); sessionStorage.clear(); location.reload();" 
                      style="padding: 10px 20px; margin: 5px; cursor: pointer;">
                Clear Cache & Refresh
              </button>
              <button onclick="location.href='/?force=true'" 
                      style="padding: 10px 20px; margin: 5px; cursor: pointer;">
                Hard Refresh
              </button>
            </div>
            <p style="font-size: 12px; color: #666;">Error detected: Multiple automatic reloads</p>
          </div>
        `;
      }
      return false;
    }
  } else {
    sessionStorage.setItem('reloadCount', '0');
  }
  
  sessionStorage.setItem('lastReloadTime', now.toString());
  return true;
};

// ========== STORE CLEANUP FUNCTIONS ==========
let cleanupFunctions = [];

// ========== SAVE CRITICAL STATE BEFORE RELOAD ==========
window.addEventListener('beforeunload', () => {
  try {
    cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    
    const criticalState = {
      userId: localStorage.getItem('supabase.auth.token'),
      lastPath: window.location.pathname,
      timestamp: Date.now()
    };
    sessionStorage.setItem('preReloadState', JSON.stringify(criticalState));
  } catch (error) {
    console.error('[App] Failed to save state:', error);
  }
});

// ========== RESTORE STATE AFTER RELOAD ==========
const restoreState = () => {
  try {
    const savedState = sessionStorage.getItem('preReloadState');
    if (savedState) {
      const state = JSON.parse(savedState);
      const timeSinceSave = Date.now() - state.timestamp;
      
      if (timeSinceSave < 5 * 60 * 1000) {
        console.log('[App] Restoring saved state from', new Date(state.timestamp));
        sessionStorage.removeItem('preReloadState');
      }
    }
  } catch (error) {
    console.error('[App] Failed to restore state:', error);
  }
};

// Check reload loop before proceeding
const canProceed = checkReloadLoop();
if (canProceed) {
  restoreState();
}

// ========== SERVICE WORKER REGISTRATION ==========
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      // ✅ Now executeWithRecovery is properly imported
      executeWithRecovery(
        async () => {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('[SW] Registered successfully:', registration.scope);
          
          registration.addEventListener('updatefound', () => {
            console.log('[SW] Update found, new SW installing');
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                console.log('[SW] New worker state:', newWorker.state);
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[SW] New version available');
                  window.dispatchEvent(new CustomEvent('app-update-ready'));
                }
              });
            }
          });
        },
        'service-worker-registration',
        { fallback: () => console.warn('[SW] Registration skipped due to error') }
      );
    }, 2000);
  });
}

// ========== RENDER APP ==========
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('[App] Root element not found!');
  document.body.innerHTML = `
    <div style="text-align: center; padding: 50px;">
      <h2>Critical Error</h2>
      <p>Application root not found. Please contact support.</p>
    </div>
  `;
} else {
  try {
    const root = createRoot(rootElement);
    
    root.render(
      <React.StrictMode>
        <GlobalErrorHandler>
          <BrowserRouter>                    {/* ✅ Router OUTSIDE everything */}
            <ThemeProvider>
              <AuthProvider>                   {/* ✅ AuthProvider INSIDE Router */}
                <LoadingProvider>
                    <App />
                    <Toaster 
                      position="top-right"
                      toastOptions={{
                        duration: 5000,
                        style: {
                          background: '#333',
                          color: '#fff',
                        },
                        success: {
                          duration: 4000,
                          iconTheme: {
                            primary: '#4CAF50',
                            secondary: '#fff',
                          },
                        },
                        error: {
                          duration: 6000,
                          iconTheme: {
                            primary: '#f44336',
                            secondary: '#fff',
                          },
                        },
                      }}
                    />
                  </LoadingProvider>
                </AuthProvider>
            </ThemeProvider>
          </BrowserRouter>
        </GlobalErrorHandler>
      </React.StrictMode>
    );
    
    console.log('[App] Rendered successfully');
    sessionStorage.removeItem('isReloading');
    
  } catch (error) {
    console.error('[App] Failed to render:', error);
    
    Sentry.captureException(error, {
      tags: { fatal: true, location: 'main-render' }
    });
    
    rootElement.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; font-family: system-ui;">
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <h2>Unable to start application</h2>
        <p style="color: #666; margin-bottom: 20px;">The app couldn't load. Please try refreshing.</p>
        <div style="display: flex; gap: 12px;">
          <button onclick="location.reload()" style="padding: 10px 20px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 5px;">
            Refresh Page
          </button>
          <button onclick="localStorage.clear(); sessionStorage.clear(); location.reload();" style="padding: 10px 20px; cursor: pointer;">
            Clear & Refresh
          </button>
        </div>
        <p style="font-size: 12px; color: #999; margin-top: 30px;">Error: ${error.message || 'Unknown error'}</p>
      </div>
    `;
  }
}

// ========== HEALTH CHECK ==========
if (import.meta.env.PROD) {
  let lastHeartbeat = Date.now();
  const heartbeat = setInterval(() => {
    lastHeartbeat = Date.now();
  }, 10000);
  cleanupFunctions.push(() => clearInterval(heartbeat));
  
  setInterval(() => {
    const timeSinceHeartbeat = Date.now() - lastHeartbeat;
    if (timeSinceHeartbeat > 30000) {
      console.warn('[App] Possible app freeze detected');
      Sentry.captureMessage('App freeze detected', {
        severity: 'warning',
        tags: { type: 'freeze' },
        extra: { frozenFor: timeSinceHeartbeat }
      });
    }
  }, 15000);
}

// ========== EXPORT FOR DEBUGGING ==========
if (import.meta.env.DEV) {
  window.__appDebug = {
    errorRecovery,
    sentry: Sentry,
    reloadStats: {
      count: sessionStorage.getItem('reloadCount'),
      lastReload: sessionStorage.getItem('lastReloadTime'),
      loopDetected: sessionStorage.getItem('reloadLoopDetected')
    }
  };
  console.log('[App] Debug mode enabled. Access window.__appDebug');
}
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App.jsx'; 
import './index.css';
import ReactGA from "react-ga4";

// COMPLETELY DISABLE automatic service worker updates
if (import.meta.env.PROD) {
  if ('serviceWorker' in navigator) {
    // Use a synchronous check and immediate Promise handling
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ SW registered:', registration.scope);
      } catch (err) {
        // This catches the rejection immediately
        console.log('❌ SW registration failed:', err.message);
        // Prevent Sentry from reporting this as an error
        if (err && err.preventDefault) {
          err.preventDefault();
        }
      }
    };
    
    // Register immediately, not waiting for load
    registerSW();
  }
}

// Analytics
ReactGA.initialize("G-RWLWLNQM67");
ReactGA.send({ hitType: "pageview", page: window.location.pathname });

// Sentry
Sentry.init({
  dsn: "https://6d8334654e952f41b119d852a4a08f80@o4510563455729664.ingest.de.sentry.io/4510563458482256",
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  // ADD THIS SECTION to ignore SW errors
  ignoreErrors: [
    'ServiceWorker registration failed',
    'navigator.serviceWorker.register',
    'Failed to register a ServiceWorker',
    'Error: rejected at wrsparams.serviceWorkers.navigator.serviceWorker.register'
  ],
  // Also blacklist URLs if needed
  denyUrls: [
    /registerSW/i,
    /serviceWorker/i
  ]
});

// Render App
const rootElement = document.getElementById('root');
createRoot(rootElement).render(<App />);
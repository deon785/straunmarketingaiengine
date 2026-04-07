import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App.jsx'; 
import './index.css';
import ReactGA from "react-ga4";

// COMPLETELY DISABLE automatic service worker updates
if (import.meta.env.PROD) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('✅ SW registered:', registration.scope);
        })
        .catch(err => {
          console.log('❌ SW registration failed:', err);
        });
    });
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
});

// Render App
const rootElement = document.getElementById('root');
createRoot(rootElement).render(<App />);
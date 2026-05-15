import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App.jsx'; 
import './index.css';
import ReactGA from "react-ga4";
import { LoadingProvider } from './LoadingContext';
import { AuthProvider } from './AuthContext';

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
  ignoreErrors: [
    'ServiceWorker registration failed',
    'Failed to register a ServiceWorker',
  ],
  denyUrls: [
    /serviceWorker/i
  ]
});

// ✅ ONLY render - NO service worker code here
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <AuthProvider>
      <LoadingProvider>
        <App />
      </LoadingProvider>
    </AuthProvider>
  );
}
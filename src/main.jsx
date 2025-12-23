import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App.jsx'; 
import './index.css';
import ReactGA from "react-ga4";

ReactGA.initialize("G-RWLWLNQM67"); 

// Send initial pageview
ReactGA.send({ hitType: "pageview", page: window.location.pathname });
// 1. Initialize Sentry FIRST
Sentry.init({
  dsn: "https://6d8334654e952f41b119d852a4a08f80@o4510563455729664.ingest.de.sentry.io/4510563458482256",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
});

// 2. Define the root element
const rootElement = document.getElementById('root');

// 3. Render the app ONLY ONCE
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
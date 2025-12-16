import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// ----------------------------------------------------
// CRITICAL CORRECTION ON THIS LINE: 
// Ensure you have the .jsx extension here!
import App from './App.jsx'; 
// ----------------------------------------------------

import './index.css';

const rootElement = document.getElementById('root');
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
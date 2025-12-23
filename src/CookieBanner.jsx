// CookieBanner.jsx - Enhanced GDPR Compliant Version
import React, { useState, useEffect } from 'react';
import './CookieBanner.css';

const CookieBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // ✅ ENHANCEMENT 1: Cookie categories state
  const [preferences, setPreferences] = useState({
    necessary: true,    // Always true (can't be disabled)
    analytics: false,
    marketing: false,
    functional: false
  });

  useEffect(() => {
    // ✅ ENHANCEMENT 2: GDPR region detection
    const isGDPRRegion = () => {
      // Simple detection - you can use an API or IP service for production
      const userLanguage = navigator.language || navigator.userLanguage;
      const euLanguages = ['en-GB', 'en-IE', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'nl-NL'];
      
      // Check timezone (Europe is UTC to UTC+3)
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const isEuropeanTimezone = timezone.includes('Europe') || 
                                 timezone.includes('London') || 
                                 timezone.includes('Berlin');
      
      // For safety, assume GDPR applies unless you have proper detection
      return true; // Change this based on your needs
    };
    
    // Only show banner if in GDPR region
    if (isGDPRRegion()) {
      const hasConsented = localStorage.getItem('cookie_consent');
      if (!hasConsented) {
        setShowBanner(true);
      } else {
        // Load saved preferences
        const savedPrefs = localStorage.getItem('cookie_preferences');
        if (savedPrefs) {
          setPreferences(JSON.parse(savedPrefs));
        }
      }
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    localStorage.setItem('cookie_preferences', JSON.stringify({
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true
    }));
    
    setShowBanner(false);
    loadTrackingScripts();
  };

  const rejectCookies = () => {
    localStorage.setItem('cookie_consent', 'rejected');
    localStorage.setItem('cookie_preferences', JSON.stringify({
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false
    }));
    
    setShowBanner(false);
    removeNonEssentialScripts();
  };

  const saveCustomPreferences = () => {
    localStorage.setItem('cookie_consent', 'custom');
    localStorage.setItem('cookie_preferences', JSON.stringify(preferences));
    setShowSettings(false);
    setShowBanner(false);
    
    if (preferences.analytics) loadAnalyticsScripts();
    if (preferences.marketing) loadMarketingScripts();
    if (preferences.functional) loadFunctionalScripts();
  };

  const togglePreference = (category) => {
    if (category === 'necessary') return; // Can't toggle necessary cookies
    
    setPreferences(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const openSettings = () => {
    setShowSettings(true);
  };

  const closeSettings = () => {
    setShowSettings(false);
  };

  // Helper functions for scripts (you need to implement these)
  const loadTrackingScripts = () => {
    console.log('Loading all tracking scripts...');
    // Load Google Analytics, Facebook Pixel, etc.
  };

  const removeNonEssentialScripts = () => {
    console.log('Removing non-essential scripts...');
    // Remove analytics/marketing scripts
  };

  const loadAnalyticsScripts = () => {
    console.log('Loading analytics scripts...');
  };

  const loadMarketingScripts = () => {
    console.log('Loading marketing scripts...');
  };

  const loadFunctionalScripts = () => {
    console.log('Loading functional scripts...');
  };

  if (!showBanner) return null;

  return (
    <div className="cookie-banner">
      <div className="cookie-content">
        <p>
          🍪 We use cookies to improve your experience. 
          By continuing, you agree to our use of cookies as described in our 
          <a href="/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>.
        </p>
        <div className="cookie-buttons">
          <button onClick={acceptCookies} className="accept-btn">
            Accept All
          </button>
          <button onClick={rejectCookies} className="reject-btn">
            Reject Non-Essential
          </button>
          <button onClick={openSettings} className="settings-link">
            Cookie Settings
          </button>
        </div>
      </div>

      {/* ✅ ENHANCEMENT 3: Detailed Settings Modal */}
      {showSettings && (
        <div className="cookie-settings-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Cookie Preferences</h3>
              <button onClick={closeSettings} className="close-btn">×</button>
            </div>
            
            <div className="cookie-categories">
              <div className="cookie-category">
                <div className="category-header">
                  <span className="category-title">Necessary Cookies</span>
                  <input 
                    type="checkbox" 
                    checked={preferences.necessary} 
                    disabled 
                    className="cookie-toggle"
                  />
                </div>
                <p className="category-description">
                  Required for the website to function. Cannot be disabled.
                </p>
              </div>
              
              <div className="cookie-category">
                <div className="category-header">
                  <span className="category-title">Analytics Cookies</span>
                  <input 
                    type="checkbox" 
                    checked={preferences.analytics} 
                    onChange={() => togglePreference('analytics')}
                    className="cookie-toggle"
                  />
                </div>
                <p className="category-description">
                  Help us understand how visitors interact with our website.
                </p>
              </div>
              
              <div className="cookie-category">
                <div className="category-header">
                  <span className="category-title">Marketing Cookies</span>
                  <input 
                    type="checkbox" 
                    checked={preferences.marketing} 
                    onChange={() => togglePreference('marketing')}
                    className="cookie-toggle"
                  />
                </div>
                <p className="category-description">
                  Used to track visitors across websites for advertising.
                </p>
              </div>
              
              <div className="cookie-category">
                <div className="category-header">
                  <span className="category-title">Functional Cookies</span>
                  <input 
                    type="checkbox" 
                    checked={preferences.functional} 
                    onChange={() => togglePreference('functional')}
                    className="cookie-toggle"
                  />
                </div>
                <p className="category-description">
                  Enable enhanced features and personalization.
                </p>
              </div>
            </div>
            
            <div className="modal-buttons">
              <button onClick={saveCustomPreferences} className="save-btn">
                Save Preferences
              </button>
              <button onClick={closeSettings} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CookieBanner;
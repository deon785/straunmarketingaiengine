// PullToRefreshWrapper.jsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PullToRefresh from 'react-simple-pull-to-refresh';

const PullToRefreshWrapper = ({ children }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const location = useLocation();
  
  // Define refresh actions for different pages
  const getRefreshAction = () => {
    const path = location.pathname;
    
    // Auth page
    if (path === '/') {
      return () => {
        window.location.reload();
        return Promise.resolve();
      };
    }
    
    // Main app page (SocialAIMarketingEngine)
    if (path === '/app') {
      return () => {
        // Dispatch a custom event that SocialAIMarketingEngine can listen to
        const refreshEvent = new CustomEvent('pull-to-refresh');
        window.dispatchEvent(refreshEvent);
        return Promise.resolve();
      };
    }
    
    // Notifications page
    if (path === '/notifications') {
      return () => {
        const refreshEvent = new CustomEvent('refresh-notifications');
        window.dispatchEvent(refreshEvent);
        return Promise.resolve();
      };
    }
    
    // Other pages - just reload
    return () => {
      window.location.reload();
      return Promise.resolve();
    };
  };
  
  // Custom styling
  const customStyles = {
    height: '100vh',
    overflow: 'auto',
  };
  
  return (
    <PullToRefresh
      onRefresh={getRefreshAction()}
      pullingContent={
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#666',
          fontSize: '14px',
          background: '#f8f9fa'
        }}>
          <div style={{
            width: '30px',
            height: '30px',
            margin: '0 auto 10px',
            border: '3px solid #e0e0e0',
            borderTop: '3px solid #667eea',
            borderRadius: '50%',
            transform: 'rotate(0deg)',
            transition: 'transform 0.3s'
          }}></div>
          Pull down to refresh...
        </div>
      }
      refreshingContent={
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#667eea',
          fontSize: '14px',
          background: '#f8f9fa'
        }}>
          <div style={{
            width: '30px',
            height: '30px',
            margin: '0 auto 10px',
            border: '3px solid #e0e0e0',
            borderTop: '3px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          Refreshing...
        </div>
      }
      resistance={2}
      backgroundColor="#f8f9fa"
      style={customStyles}
    >
      {children}
    </PullToRefresh>
  );
};

// Add CSS for spinner animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

export default PullToRefreshWrapper;
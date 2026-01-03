import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHeart,
  faChevronDown,
  faChevronUp,
  faBars,
  faTimes
} from '@fortawesome/free-solid-svg-icons';

const TopNavigationBar = ({ 
  user, 
  selectedMode, 
  profileData, 
  loading, 
  onSwitchMode, 
  onSignOut,
  onSettingsClick,
  isCollapsed = false,
  onToggleCollapse,
  isHidden,
  appName = "Straun Marketing AI Engine" // ADD: optional prop for app name
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const navRef = useRef(null);

  // COLLAPSED VIEW (Menu Only)
  if (isCollapsed || !isVisible) {
    return (
      <div 
        className={`collapsed-nav ${isCollapsed ? 'collapsed-nav' : ''}`} 
        ref={navRef}
        style={{
          transform: isCollapsed ? 'translateY(0)' : 'translateY(-100%)',
          opacity: isCollapsed ? 1 : 0,
          pointerEvents: isCollapsed ? 'auto' : 'none'
        }}
      >
        <button 
          onClick={onToggleCollapse}
          className="menu-toggle-button"
          title="Show Full Navigation"
          onMouseEnter={() => setIsVisible(true)}
          style={{
            background: 'rgba(255, 255, 255, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backdropFilter: 'blur(10px)',
            fontWeight: '600'
          }}
        >
          <FontAwesomeIcon icon={faBars} />
          <span className="button-text">
            Menu
          </span>
        </button>
        
        <div className="collapsed-info">
          <span className="user-email-small">
            {user?.email?.split('@')[0] || 'User'}
          </span>
          <span className={`mode-tag-small ${selectedMode}`}>
            {selectedMode === 'seller' ? 'SELLER' : 'BUYER'}
          </span>
          <span className="location-small">
            📍 {profileData?.location?.split(',')[0] || 'No location'}
          </span>
        </div>
      </div>
    );
  }

  // FULL NAVBAR VIEW
  return (
    <header 
      className={`social-header ${isCollapsed ? 'collapsed-nav' : ''}`}
      style={{
        transform: 'translateY(0)',
        opacity: 1
      }}
      ref={navRef}
    >
      <div className="header-content">
        <div className="header-top-row">
          {/* CHANGED: Replace dynamic text with app name */}
          <h1 className="social-title">
            {appName} {/* Now showing just the app name */}
            <span className="user-mode">
              {selectedMode === 'seller' ? 'Seller Mode' : 'Buyer Mode'}
            </span>
          </h1>
          
          <div className="header-actions">
            <Link to="/wishlist" title="My Wishlist" className="wishlist-link">
              <FontAwesomeIcon icon={faHeart} 
                size="lg" 
                color="#ff4d4d" 
                fill="none"
                strokeWidth={2}
              />
              <span className="wishlist-badge"></span>
            </Link>

            <button 
              onClick={() => {
                setIsVisible(false);
                if (onToggleCollapse) onToggleCollapse();
              }}
              className="close-nav-button"
              title="Collapse Navigation"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginLeft: '10px'
              }}
            >
              <FontAwesomeIcon icon={faTimes} />
              <span className="button-text">
                Hide
              </span>
            </button>
          </div>
        </div>
        
        <div className="user-controls">
          <div className="user-info-card">
            <div className="user-basic-info">
              <div className="user-avatar">
                {user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="user-details">
                <div className="user-email">{user?.email || 'Unknown User'}</div>
                <div className="user-location">
                  <span className="location-icon">📍</span>
                  {profileData?.location || 'No location set'}
                </div>
                <div className="user-profile-status">
                  <span className="status-badge complete">
                    ✓ {selectedMode === 'seller' ? 'Seller' : 'Buyer'} Setup Complete
                  </span>
                </div>
              </div>
            </div>
            <div className="user-mode-info">
              <span className={`mode-tag ${selectedMode}`}>
                {selectedMode === 'seller' ? 'SELLER' : 'BUYER'}
              </span>
              <div className="user-actions">
                <button 
                  onClick={onSettingsClick}
                  className="settings-button"
                >
                  ⚙️ Settings
                </button>

                <button 
                  onClick={onSwitchMode}
                  className="switch-mode-button"
                >
                  Switch Mode
                </button>
                <button 
                  onClick={onSignOut}
                  className="signout-button"
                  disabled={loading}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavigationBar;
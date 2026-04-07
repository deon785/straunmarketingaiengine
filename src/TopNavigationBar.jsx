import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHeart,
  faChevronDown,
  faChevronUp,
  faBars,
  faTimes,
  faCrown
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
  isAdmin,
  isHidden = false, 
  appName = "Straun Marketing AI Engine"
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const navRef = useRef(null);
  const navigate = useNavigate();

  if (isHidden) {
    return null; // Don't render anything
  }

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
        
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="admin-button-collapsed"
            title="Admin Dashboard"
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
              justifyContent: 'center',
              gap: '6px',
              marginRight: '10px',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.4)';
              e.target.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.3)';
              e.target.style.transform = 'scale(1)';
            }}
          >
            <FontAwesomeIcon icon={faCrown} size="sm" />
          </button>
        )}
        
        <div className="collapsed-info">
          <span className="user-email-small">
            {user?.email?.split('@')[0] || 'User'}
          </span>
          <span className={`mode-tag-small ${selectedMode}`}>
            {selectedMode === 'seller' ? 'SELLER' : 'BUYER'}
          </span>
          {/* REMOVED: location display */}
          {/* <span className="location-small">
            📍 {profileData?.location?.split(',')[0] || 'No location'}
          </span> */}
        </div>
      </div>
    );
  }

  // FULL NAVBAR VIEW - REMOVED LOCATION
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
          <h1 className="social-title">
            {appName}
            <span className="user-mode">
              {selectedMode === 'seller' ? 'Seller Mode' : 'Buyer Mode'}
            </span>
          </h1>
          
          <div className="header-actions">
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="admin-button"
                title="Admin Dashboard"
                style={{
                  background: 'rgba(255, 255, 255, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                  color: 'white',
                  backdropFilter: 'blur(10px)',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginRight: '10px',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                  transition: 'all 0.3s ease',
                  height: '36px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.4)';
                  e.target.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                <FontAwesomeIcon icon={faCrown} size="sm" />
                <span className="admin-text">Admin</span>
              </button>
            )}
            
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
                {/* REMOVED: location display */}
                {/* <div className="user-location">
                  <span className="location-icon">📍</span>
                  {profileData?.location || 'No location set'}
                </div> */}
                {/* REMOVED: Setup Complete badge */}
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
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHeart,
  faChevronDown,
  faChevronUp,
  faBars
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
  onToggleCollapse 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const navRef = useRef(null);

  // Auto-hide on scroll logic
  useEffect(() => {
      let ticking = false;
      let scrollTimeout;
      
      const handleScroll = () => {
          if (!ticking) {
              window.requestAnimationFrame(() => {
                  const currentScrollY = window.scrollY;
                  
                  // Clear any existing timeout
                  clearTimeout(scrollTimeout);
                  
                  // Always show when at the top
                  if (currentScrollY < 50) {
                      setIsVisible(true);
                      setLastScrollY(currentScrollY);
                      ticking = false;
                      return;
                  }
                  
                  // Show immediately when scrolling up
                  if (currentScrollY < lastScrollY) {
                      setIsVisible(true);
                  }
                  // Hide with delay when scrolling down
                  else if (currentScrollY > lastScrollY) {
                      scrollTimeout = setTimeout(() => {
                          if (currentScrollY > 100) { // Only hide if scrolled enough
                              setIsVisible(false);
                          }
                      }, 100); // 100ms delay
                  }
                  
                  setLastScrollY(currentScrollY);
                  ticking = false;
              });
              ticking = true;
          }
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      
      return () => {
          window.removeEventListener('scroll', handleScroll);
          clearTimeout(scrollTimeout);
      };
  }, [lastScrollY]);

  if (isCollapsed || !isVisible) {
    return (
      <div 
        className={`collapsed-nav ${isCollapsed ? 'collapsed-nav' : ''}`} 
        ref={navRef}
      >
        <button 
          onClick={onToggleCollapse}
          className="expand-nav-button"
          title="Show Full Navigation"
          onMouseEnter={() => setIsVisible(true)} // Show on hover
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
        
        <div className="collapsed-actions">
          <button 
            onClick={onToggleCollapse}
            className="show-full-button"
            title="Show Full Navigation"
          >
            <FontAwesomeIcon icon={faChevronDown} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <header 
      className={`social-header ${isCollapsed ? 'collapsed-nav' : ''}`}
      style={{
        transform: isVisible ? 'translateY(0)' : 'translateY(-100%)'
      }}
      ref={navRef}
      onMouseLeave={() => {
        // Auto-hide after delay when mouse leaves (optional)
        if (window.scrollY > 100) {
          setTimeout(() => setIsVisible(false), 1000);
        }
      }}
    >
      <div className="header-content">
        <div className="header-top-row">
          <h1 className="social-title">
            {selectedMode === 'seller' 
              ? 'Find Customers for Your Products' 
              : 'Find Products to Buy'}
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
              onClick={() => setIsVisible(false)}
              className="hide-nav-button"
              title="Hide Navigation"
            >
              <FontAwesomeIcon icon={faChevronUp} />
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
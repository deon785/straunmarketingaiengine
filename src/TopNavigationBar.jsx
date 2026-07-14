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
  isAdmin = false,
  isHidden = false, 
  appName = "Straun Marketing AI Engine"
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [internalCollapsed, setInternalCollapsed] = useState(isCollapsed);
  const navRef = useRef(null);
  const navigate = useNavigate();

  // Sync with external isCollapsed prop
  useEffect(() => {
    setInternalCollapsed(isCollapsed);
  }, [isCollapsed]);

  // Handle collapse toggle
  const handleToggleCollapse = () => {
    setInternalCollapsed(!internalCollapsed);
    if (onToggleCollapse) {
      onToggleCollapse();
    }
  };

  // Handle hide button click
  const handleHideNav = () => {
    setIsVisible(false);
    if (onToggleCollapse) {
      onToggleCollapse();
    }
  };

  if (isHidden) {
    return null;
  }

  // Collapsed view
  if (internalCollapsed || !isVisible) {
    return (
      <div 
        className="collapsed-nav" 
        ref={navRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          transition: 'all 0.3s ease'
        }}
      >
        <button 
          onClick={handleToggleCollapse}
          className="menu-toggle-button"
          title="Show Full Navigation"
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
          <span className="button-text">Menu</span>
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
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <FontAwesomeIcon icon={faCrown} size="sm" />
          </button>
        )}
        
        <div className="collapsed-info" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span className="user-email-small" style={{
            color: 'white',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            {user?.email?.split('@')[0] || 'User'}
          </span>
          <span className={`mode-tag-small ${selectedMode}`} style={{
            background: selectedMode === 'seller' ? '#f39c12' : '#2ecc71',
            color: 'white',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 'bold'
          }}>
            {selectedMode === 'seller' ? 'SELLER' : 'BUYER'}
          </span>
        </div>
      </div>
    );
  }

  // FULL NAVBAR VIEW
  return (
    <header 
      className="social-header"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '12px 20px',
        color: 'white',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease'
      }}
      ref={navRef}
    >
      <div className="header-content" style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div className="header-top-row" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <h1 className="social-title" style={{
              fontSize: '20px',
              margin: 0,
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              {appName}
              <span className="user-mode" style={{
                fontSize: '12px',
                background: 'rgba(255,255,255,0.2)',
                padding: '4px 10px',
                borderRadius: '20px',
                fontWeight: 'normal'
              }}>
                {selectedMode === 'seller' ? 'Seller Mode' : 'Buyer Mode'}
              </span>
            </h1>
          </div>
          
          <div className="header-actions" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
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
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <FontAwesomeIcon icon={faCrown} size="sm" />
                <span className="admin-text">Admin</span>
              </button>
            )}
            
            <Link 
              to="/wishlist" 
              title="My Wishlist" 
              className="wishlist-link"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '8px 12px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'white',
                textDecoration: 'none'
              }}
            >
              <FontAwesomeIcon icon={faHeart} size="lg" color="#ff4d4d" />
              <span>Wishlist</span>
            </Link>

            <button 
              onClick={handleHideNav}
              className="close-nav-button"
              title="Collapse Navigation"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FontAwesomeIcon icon={faTimes} />
              <span className="button-text">Collapse</span>
            </button>
          </div>
        </div>
        
        <div className="user-controls">
          <div className="user-info-card" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '15px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '12px 20px'
          }}>
            <div className="user-basic-info" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div className="user-avatar" style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '18px'
              }}>
                {user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="user-details">
                <div className="user-email" style={{
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}>
                  {user?.email || 'Unknown User'}
                </div>
              </div>
            </div>
            <div className="user-mode-info">
              <div className="user-actions" style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <button 
                  onClick={onSettingsClick}
                  className="settings-button"
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                >
                  ⚙️ Settings
                </button>

                <button 
                  onClick={onSwitchMode}
                  className="switch-mode-button"
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                >
                  Switch Mode
                </button>
                
                <button 
                  onClick={onSignOut}
                  className="signout-button"
                  disabled={loading}
                  style={{
                    background: 'rgba(220, 53, 69, 0.8)',
                    border: 'none',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.3s ease',
                    opacity: loading ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'rgba(220, 53, 69, 1)')}
                  onMouseLeave={(e) => !loading && (e.currentTarget.style.background = 'rgba(220, 53, 69, 0.8)')}
                >
                  {loading ? 'Signing Out...' : 'Sign Out'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

// Default props for better resilience
TopNavigationBar.defaultProps = {
  user: null,
  selectedMode: 'buyer',
  profileData: null,
  loading: false,
  onSwitchMode: () => {},
  onSignOut: () => {},
  onSettingsClick: () => {},
  isCollapsed: false,
  onToggleCollapse: () => {},
  isAdmin: false,
  isHidden: false,
  appName: 'Straun Marketing AI Engine'
};

export default TopNavigationBar;
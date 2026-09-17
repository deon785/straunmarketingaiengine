import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const TopNavigationBar = ({ 
  user, 
  selectedMode, 
  profileData, 
  loading, 
  onSwitchMode, 
  onSignOut,
  onSettingsClick,
  isAdmin = false,
  isHidden = false,
  unreadNotifications = 3,
  onNotificationsClick,
  appName = "Straun Marketing AI Engine"
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const drawerRef = useRef(null);

  // Close drawer on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [window.location.pathname]);

  // Close drawer on escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && menuOpen) setMenuOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [menuOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  if (isHidden) return null;

  const userInitial = user?.email?.charAt(0)?.toUpperCase() || 'U';
  const userFirstName = user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || 'Unknown User';
  const modeLabel = selectedMode === 'seller' ? 'Seller Mode' : 'Buyer Mode';

  // ============================================
  // HANDLERS
  // ============================================
  const handleMenuToggle = () => setMenuOpen(prev => !prev);
  const handleCloseMenu = () => setMenuOpen(false);

  const handleSettings = () => {
    handleCloseMenu();
    if (onSettingsClick) onSettingsClick();
  };

  const handleSwitchMode = () => {
    handleCloseMenu();
    if (onSwitchMode) onSwitchMode();
  };

  const handleSignOut = () => {
    handleCloseMenu();
    if (onSignOut) onSignOut();
  };

  const handleAdminClick = () => {
    handleCloseMenu();
    navigate('/admin');
  };

  const handleWishlistClick = () => {
    handleCloseMenu();
    navigate('/wishlist');
  };

  const handleNotifications = () => {
    if (onNotificationsClick) {
      onNotificationsClick();
    } else {
      navigate('/notifications');
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <>
      {/* ============ TOP BAR ============ */}
      <header
        className="social-header"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '12px 20px',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}
      >
        {/* LEFT: Hamburger */}
        <button
          onClick={handleMenuToggle}
          aria-label="Menu"
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            fontSize: '20px',
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
        >
          ☰
        </button>

        {/* CENTER: Logo + Brand */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1,
            justifyContent: 'center'
          }}
        >
          {/* Logo Circle */}
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <img
              src="/Straun-logo.png"
              alt="Straun Logo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block'
              }}
              onError={(e) => {
                // Fallback to emoji if image fails
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<span style="font-size: 20px;">🦅</span>';
              }}
            />
          </div>

          {/* Brand Name + AI pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px'
            }}
          >
            <span
              style={{
                fontSize: '20px',
                fontWeight: '700',
                color: 'white',
                letterSpacing: '-0.3px'
              }}
            >
              Straun
            </span>
            <span
              style={{
                fontSize: '13px',
                fontWeight: '500',
                color: 'rgba(255,255,255,0.85)',
                background: 'rgba(255,255,255,0.2)',
                padding: '2px 8px',
                borderRadius: '20px',
                letterSpacing: '0.3px'
              }}
            >
              AI
            </span>

            {/* Admin crown (if admin) */}
            {isAdmin && (
              <button
                onClick={handleAdminClick}
                title="Admin Dashboard"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  marginLeft: '4px',
                  padding: '4px',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                  transition: 'all 0.2s ease',
                  color: '#FFD700',
                  textShadow: '0 0 10px rgba(255,215,0,0.3)'
                }}
              >
                👑
              </button>
            )}
          </div>
        </div>

        {/* RIGHT: Notification bell */}
        <button
          onClick={handleNotifications}
          aria-label="Notifications"
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            fontSize: '18px',
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
        >
          🔔
          {unreadNotifications > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                background: '#ef4444',
                color: 'white',
                fontSize: '10px',
                fontWeight: '700',
                minWidth: '18px',
                height: '18px',
                padding: '0 5px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #667eea'
              }}
            >
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </button>
      </header>

      {/* ============ HAMBURGER DRAWER OVERLAY ============ */}
      {menuOpen && (
        <div
          onClick={handleCloseMenu}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1999,
            animation: 'fadeIn 0.2s ease'
          }}
        />
      )}

      {/* ============ HAMBURGER DRAWER ============ */}
      <div
        ref={drawerRef}
        style={{
          position: 'fixed',
          top: 0,
          left: menuOpen ? 0 : '-300px',
          width: '280px',
          height: '100vh',
          background: '#17171f',
          zIndex: 2000,
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: menuOpen ? '4px 0 24px rgba(0,0,0,0.5)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Drawer header (purple) */}
        <div
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px',
            color: 'white',
            position: 'relative'
          }}
        >
          <button
            onClick={handleCloseMenu}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: 'white',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}
          >
            ✕
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '20px',
                flexShrink: 0
              }}
            >
              {userInitial}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontWeight: '700',
                  fontSize: '15px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {userFirstName}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  opacity: 0.85,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {userEmail}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  marginTop: '4px',
                  letterSpacing: '0.5px',
                  color: '#a5f3fc'
                }}
              >
                {modeLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Drawer menu items */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 0',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <MenuItem
            icon="🏠"
            label="Home"
            onClick={() => { handleCloseMenu(); navigate('/app'); }}
          />
          <MenuItem
            icon="📊"
            label="Dashboard"
            onClick={() => { handleCloseMenu(); navigate('/dashboard'); }}
          />
          <MenuItem
            icon="❤️"
            label="Wishlist"
            onClick={handleWishlistClick}
          />
          <MenuItem
            icon="🔥"
            label="Daily Deals"
            onClick={() => { handleCloseMenu(); navigate('/deals'); }}
          />

          <Divider />

          <MenuItem
            icon="⚙️"
            label="Settings"
            onClick={handleSettings}
          />
          <MenuItem
            icon="🔄"
            label="Switch Mode"
            onClick={handleSwitchMode}
          />

          {isAdmin && (
            <>
              <Divider />
              <MenuItem
                icon="👑"
                label="Admin Dashboard"
                onClick={handleAdminClick}
                accent="#FFD700"
              />
            </>
          )}

          <Divider />

          <MenuItem
            icon="🚪"
            label={loading ? 'Signing Out...' : 'Sign Out'}
            onClick={handleSignOut}
            disabled={loading}
            danger
          />
        </nav>

        {/* Drawer footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #24242e',
            fontSize: '11px',
            color: '#71717a',
            textAlign: 'center'
          }}
        >
          Straun Marketing AI © 2026
        </div>
      </div>

      {/* ============ ANIMATION KEYFRAMES ============ */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
};

// ============================================
// SUB-COMPONENTS
// ============================================

const MenuItem = ({ icon, label, onClick, disabled = false, danger = false, accent = null }) => {
  const [hovered, setHovered] = useState(false);

  const baseColor = danger ? '#ef4444' : accent || '#e4e4e7';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        width: '100%',
        padding: '14px 20px',
        background: hovered ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
        color: disabled ? '#52525b' : baseColor,
        border: 'none',
        textAlign: 'left',
        fontSize: '15px',
        fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        paddingLeft: hovered ? '26px' : '20px'
      }}
    >
      <span style={{ fontSize: '18px', width: '24px', display: 'flex', justifyContent: 'center' }}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
};

const Divider = () => (
  <div
    style={{
      height: '1px',
      background: '#24242e',
      margin: '8px 20px'
    }}
  />
);

// Default props
TopNavigationBar.defaultProps = {
  user: null,
  selectedMode: 'buyer',
  profileData: null,
  loading: false,
  onSwitchMode: () => {},
  onSignOut: () => {},
  onSettingsClick: () => {},
  isAdmin: false,
  isHidden: false,
  unreadNotifications: 0,
  onNotificationsClick: null,
  appName: 'Straun Marketing AI Engine'
};

export default TopNavigationBar;
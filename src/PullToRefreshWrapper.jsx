// PullToRefreshWrapper.jsx - CUSTOM IMPLEMENTATION (No Library)
// ✅ PULL INDICATOR REMOVED - Clean navbar

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const PullToRefreshWrapper = ({ children }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef(null);
  const location = useLocation();
  const isPullingRef = useRef(false);
  const refreshTimeoutRef = useRef(null);

  // ✅ Define refresh actions
  const getRefreshAction = useCallback(() => {
    const path = location.pathname;
    
    if (path === '/app') {
      return () => {
        const refreshEvent = new CustomEvent('pull-to-refresh');
        window.dispatchEvent(refreshEvent);
        return Promise.resolve();
      };
    }
    
    if (path === '/notifications') {
      return () => {
        const refreshEvent = new CustomEvent('refresh-notifications');
        window.dispatchEvent(refreshEvent);
        return Promise.resolve();
      };
    }
    
    return () => {
      window.location.reload();
      return Promise.resolve();
    };
  }, [location.pathname]);

  // ✅ Handle touch start
  const handleTouchStart = useCallback((e) => {
    if (containerRef.current?.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
      isPullingRef.current = true;
    }
  }, []);

  // ✅ Handle touch move
  const handleTouchMove = useCallback((e) => {
    if (!isPullingRef.current) return;
    
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) {
      setPullDistance(Math.min(deltaY, 80));
    }
  }, [startY]);

  // ✅ Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 50 && !isRefreshing) {
      // ✅ Refresh triggered!
      setIsRefreshing(true);
      const refreshAction = getRefreshAction();
      refreshAction().finally(() => {
        // Reset after refresh
        refreshTimeoutRef.current = setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          isPullingRef.current = false;
        }, 800);
      });
    } else {
      setPullDistance(0);
      isPullingRef.current = false;
    }
  }, [pullDistance, isRefreshing, getRefreshAction]);

  // ✅ Cleanup
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // ✅ Skip pages
  const skipPages = ['/', '/reset-password', '/signup'];
  if (skipPages.includes(location.pathname)) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        height: '100%',
        minHeight: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* ✅ Children only - NO pull indicator */}
      {children}
    </div>
  );
};

export default React.memo(PullToRefreshWrapper);
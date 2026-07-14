// NavigationContext.jsx - UPDATED with debugging
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const NavigationContext = createContext();

export const NavigationProvider = ({ children }) => {
  const [navigationStack, setNavigationStack] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const location = useLocation();

  // Track location changes
  useEffect(() => {
    console.log('[Navigation] Location changed:', location.pathname);
    
    // Skip tracking for auth pages
    const skipPaths = ['/', '/reset-password', '/privacy', '/terms', '/help'];
    if (skipPaths.includes(location.pathname)) {
      console.log('[Navigation] Skipping auth page tracking');
      return;
    }
    
    // Don't track if we're in a navigation transition
    if (isNavigating) {
      console.log('[Navigation] In transition, skipping stack update');
      return;
    }
    
    setNavigationStack(prev => {
      // Check if this page is already the last one
      const lastEntry = prev[prev.length - 1];
      if (lastEntry && lastEntry.path === location.pathname) {
        console.log('[Navigation] Same page, not adding duplicate');
        return prev;
      }
      
      // Limit stack size to prevent memory issues
      const newStack = [...prev, {
        path: location.pathname,
        search: location.search,
        hash: location.hash,
        state: location.state,
        timestamp: Date.now()
      }];
      
      // Keep last 20 entries max
      if (newStack.length > 20) {
        newStack.shift();
      }
      
      console.log('[Navigation] Stack updated, length:', newStack.length);
      return newStack;
    });
  }, [location, isNavigating]);

  const goBack = useCallback(() => {
    if (navigationStack.length > 1) {
      setIsNavigating(true);
      const previousPage = navigationStack[navigationStack.length - 2];
      setNavigationStack(prev => prev.slice(0, -1));
      
      setTimeout(() => {
        setIsNavigating(false);
      }, 500);
      
      return previousPage;
    }
    console.log('[Navigation] No previous page in stack');
    return null;
  }, [navigationStack]);

  const getPreviousPage = useCallback(() => {
    if (navigationStack.length > 1) {
      return navigationStack[navigationStack.length - 2];
    }
    return null;
  }, [navigationStack]);

  const clearStack = useCallback(() => {
    console.log('[Navigation] Clearing stack');
    setNavigationStack([]);
  }, []);

  const resetNavigation = useCallback(() => {
    console.log('[Navigation] Resetting navigation state');
    setNavigationStack([]);
    setIsNavigating(false);
  }, []);

  return (
    <NavigationContext.Provider value={{
      navigationStack,
      goBack,
      getPreviousPage,
      clearStack,
      resetNavigation,
      isNavigating,
      setIsNavigating
    }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};
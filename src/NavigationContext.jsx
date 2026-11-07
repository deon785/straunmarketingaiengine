// NavigationContext.jsx - FIXED
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const NavigationContext = createContext();

const SKIP_PATHS = ['/', '/reset-password', '/privacy', '/terms', '/help', '/login'];

export const NavigationProvider = ({ children }) => {
  const [navigationStack, setNavigationStack] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const location = useLocation();
  
  // ✅ Use a ref to track if we're in transition WITHOUT triggering re-runs
  const isNavigatingRef = useRef(false);

  // Track location changes - ✅ REMOVED isNavigating from deps
  useEffect(() => {
    const path = location.pathname;
    console.log('🔵 [NavigationContext] Location changed to:', path);
    
    // Skip tracking for auth/public pages
    if (SKIP_PATHS.includes(path)) {
      console.log('[Navigation] Skipping public page tracking');
      return;
    }
    
    // ✅ Use ref instead of state in dependency check
    if (isNavigatingRef.current) {
      console.log('[Navigation] In transition, skipping stack update');
      return;
    }
    
    setNavigationStack(prev => {
      const lastEntry = prev[prev.length - 1];
      
      // ✅ Compare full path (pathname + search) not just pathname
      const currentFullPath = path + location.search;
      const lastFullPath = lastEntry ? lastEntry.path + lastEntry.search : null;
      
      if (lastFullPath === currentFullPath) {
        return prev; // Same page, no update
      }
      
      const newStack = [...prev, {
        path,
        search: location.search,
        hash: location.hash,
        state: location.state,
        timestamp: Date.now()
      }];
      
      if (newStack.length > 20) newStack.shift();
      
      console.log('[Navigation] Stack updated, length:', newStack.length);
      return newStack;
    });
  }, [location]); // ✅ ONLY location in deps

  const goBack = useCallback(() => {
    if (navigationStack.length > 1) {
      isNavigatingRef.current = true;
      setIsNavigating(true);
      
      const previousPage = navigationStack[navigationStack.length - 2];
      setNavigationStack(prev => prev.slice(0, -1));
      
      setTimeout(() => {
        isNavigatingRef.current = false;
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
    isNavigatingRef.current = false;
    setIsNavigating(false);
  }, []);

  // ✅ CRITICAL: Memoize the context value
  const value = useMemo(() => ({
    navigationStack,
    goBack,
    getPreviousPage,
    clearStack,
    resetNavigation,
    isNavigating,
    setIsNavigating
  }), [navigationStack, goBack, getPreviousPage, clearStack, resetNavigation, isNavigating]);

  return (
    <NavigationContext.Provider value={value}>
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
import React, { createContext, useContext, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const NavigationContext = createContext();

export const NavigationProvider = ({ children }) => {
  const [navigationStack, setNavigationStack] = useState([]);
  const location = useLocation();

  // Automatically add current location to stack when it changes
  useState(() => {
    setNavigationStack(prev => {
      // Don't add duplicates consecutively
      if (prev.length === 0 || prev[prev.length - 1].path !== location.pathname) {
        return [...prev, {
          path: location.pathname,
          search: location.search,
          hash: location.hash,
          state: location.state,
          timestamp: Date.now()
        }];
      }
      return prev;
    });
  }, [location]);

  const goBack = useCallback(() => {
    if (navigationStack.length > 1) {
      // Remove current page from stack
      setNavigationStack(prev => prev.slice(0, -1));
      return navigationStack[navigationStack.length - 2]; // Return previous page
    }
    return null;
  }, [navigationStack]);

  const getPreviousPage = useCallback(() => {
    if (navigationStack.length > 1) {
      return navigationStack[navigationStack.length - 2];
    }
    return null;
  }, [navigationStack]);

  const clearStack = useCallback(() => {
    setNavigationStack([]);
  }, []);

  return (
    <NavigationContext.Provider value={{
      navigationStack,
      goBack,
      getPreviousPage,
      clearStack
    }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};
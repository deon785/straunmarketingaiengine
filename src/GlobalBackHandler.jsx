// src/components/GlobalBackHandler.jsx
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNavigation } from './NavigationContext.jsx';

const GlobalBackHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { goBack, getPreviousPage } = useNavigation();

  useEffect(() => {
    const handleBackButton = (e) => {
      e.preventDefault();
      
      console.log('Back button pressed at:', location.pathname + location.search);
      
      // Get the previous page from our navigation stack
      const previousPage = getPreviousPage();
      
      if (previousPage) {
        // Navigate back to the exact previous state
        navigate({
          pathname: previousPage.path,
          search: previousPage.search,
          hash: previousPage.hash
        }, {
          replace: true,
          state: previousPage.state
        });
        
        // Update navigation stack
        goBack();
      } else {
        // If no history in our stack, use fallback routes
        handleFallbackNavigation();
      }
    };

    const handleFallbackNavigation = () => {
      // Define minimum fallback routes for edge cases
      const fallbackRoutes = {
        '/notifications': '/app',
        '/privacy': '/app',
        '/terms': '/app',
        '/help': '/app',
        '/wishlist': '/app',
        '/admin': '/app',
        '/reset-password': '/',
        // Special case: if on /app with search, go to clean /app
        '/app': '/',
      };

      const targetPath = fallbackRoutes[location.pathname];
      
      if (targetPath) {
        navigate(targetPath, { replace: true });
      } else if (location.pathname !== '/') {
        // Try browser history as last resort
        navigate(-1);
      } else {
        // On home page - ask before exiting
        handleExitConfirmation();
      }
    };

    const handleExitConfirmation = () => {
      if (window.confirm('Do you want to exit the app?')) {
        // For PWA installed on phone
        if (window.navigator.standalone) {
          // Can't close PWA, but we can simulate
          window.dispatchEvent(new Event('appShouldExit'));
        } else {
          // For browser, just go back in history
          if (window.history.length > 1) {
            navigate(-1);
          }
        }
      } else {
        // User cancelled - stay on page
        window.history.pushState(null, '', window.location.href);
      }
    };

    // Listen for hardware back button (mobile)
    const handleHardwareBack = (e) => {
      handleBackButton(e);
    };

    // Listen for browser back/forward buttons
    const handlePopState = (e) => {
      handleBackButton(e);
    };

    // Add event listeners
    window.addEventListener('popstate', handlePopState);
    
    // For mobile hardware back button
    if (document.addEventListener) {
      document.addEventListener('backbutton', handleHardwareBack, false);
    }
    
    // For Capacitor/Cordova
    if (window.Capacitor?.Plugins?.App) {
      window.Capacitor.Plugins.App.addListener('backButton', handleHardwareBack);
    }

    // Prevent default back swipe on iOS
    document.body.style.overscrollBehavior = 'none';

    return () => {
      // Cleanup
      window.removeEventListener('popstate', handlePopState);
      
      if (document.removeEventListener) {
        document.removeEventListener('backbutton', handleHardwareBack, false);
      }
      
      if (window.Capacitor?.Plugins?.App) {
        window.Capacitor.Plugins.App.removeAllListeners();
      }
      
      document.body.style.overscrollBehavior = '';
    };
  }, [navigate, location, goBack, getPreviousPage]);

  return null;
};

export default GlobalBackHandler;
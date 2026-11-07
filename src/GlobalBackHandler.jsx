// src/components/GlobalBackHandler.jsx
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const GlobalBackHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // ✅ Do NOT intercept standard back button behavior. 
    // React Router handles it naturally. 
    // This is ONLY a safety fallback for hardware back buttons in PWAs/Capacitor.

    const handleHardwareBack = (e) => {
      // If the user is on the root page, we might want to confirm exit
      if (location.pathname === '/') {
        // Optional: Only confirm exit if they are at the absolute root
        // e.preventDefault(); 
        // if (window.confirm('Do you want to exit the app?')) {
        //   if (window.navigator.standalone) {
        //      // PWA exit logic
        //   } else {
        //      window.history.back();
        //   }
        // }
        return;
      }

      // ✅ Fallback logic: If the user is stuck on a subpage and presses 
      // the hardware back button, send them to the app root.
      const fallbackRoutes = {
        '/notifications': '/app',
        '/privacy': '/app',
        '/terms': '/app',
        '/help': '/app',
        '/wishlist': '/app',
        '/admin': '/app',
      };

      const targetPath = fallbackRoutes[location.pathname];
      
      if (targetPath) {
        // Only navigate if we are explicitly matching a fallback route
        // This prevents loops on the main /app feed
        navigate(targetPath, { replace: true });
      } else {
        // Let React Router / Browser handle it naturally
        // Do not call e.preventDefault() here
      }
    };

    // For mobile hardware back button (Capacitor/Cordova)
    if (window.Capacitor?.Plugins?.App) {
      window.Capacitor.Plugins.App.addListener('backButton', handleHardwareBack);
    }

    // DO NOT add a window.addEventListener('popstate', ...) here.
    // React Router already listens to popstate. Adding another one causes the loops.

    return () => {
      if (window.Capacitor?.Plugins?.App) {
        window.Capacitor.Plugins.App.removeAllListeners();
      }
    };
  }, [navigate, location.pathname]);

  return null;
};

export default GlobalBackHandler;
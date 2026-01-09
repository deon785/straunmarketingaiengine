// FinalRecommendationWrapper.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const RefreshPersistenceWrapper = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isRestoring, setIsRestoring] = useState(false);
    
    // ✅ Save state whenever location changes
    const saveState = useCallback(() => {
        const state = {
            path: location.pathname + location.search + location.hash,
            scrollY: window.pageYOffset,
            timestamp: Date.now()
        };
        localStorage.setItem('__app_state', JSON.stringify(state));
    }, [location]);
    
    // ✅ Restore state on component mount
    const restoreState = useCallback(() => {
        try {
            const saved = localStorage.getItem('__app_state');
            if (!saved) return false;
            
            const state = JSON.parse(saved);
            const currentPath = location.pathname + location.search + location.hash;
            
            // Only restore if we're not already on the saved path
            if (state.path && state.path !== currentPath) {
                console.log(`🔄 Restoring to: ${state.path}`);
                return state;
            }
        } catch (error) {
            console.error('Failed to restore state:', error);
            localStorage.removeItem('__app_state');
        }
        return null;
    }, [location]);
    
    // ✅ Save on route change
    useEffect(() => {
        saveState();
    }, [saveState]);
    
    // ✅ Restore on mount (page load/refresh)
    useEffect(() => {
        const savedState = restoreState();
        if (savedState) {
            setIsRestoring(true);
            
            // Navigate to saved path
            navigate(savedState.path, { replace: true });
            
            // Restore scroll after navigation completes
            const restoreComplete = () => {
                if (savedState.scrollY) {
                    window.scrollTo(0, savedState.scrollY);
                }
                setIsRestoring(false);
            };
            
            // Try multiple times in case navigation is slow
            const timer1 = setTimeout(restoreComplete, 100);
            const timer2 = setTimeout(restoreComplete, 500);
            const timer3 = setTimeout(restoreComplete, 1000);
            
            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
                clearTimeout(timer3);
            };
        }
    }, [restoreState, navigate]);
    
    if (isRestoring) {
        return (
            <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-green-400 mb-4"></div>
                    <h3 className="text-white text-lg font-medium mb-1">
                        Restoring Your Session
                    </h3>
                    <p className="text-gray-400 text-sm">
                        Taking you back to where you left off...
                    </p>
                </div>
            </div>
        );
    }
    
    return <>{children}</>;
};

export default RefreshPersistenceWrapper;
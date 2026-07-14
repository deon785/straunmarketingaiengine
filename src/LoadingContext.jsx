// src/LoadingContext.jsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const LoadingContext = createContext();

export const useLoading = () => {
    const context = useContext(LoadingContext);
    if (!context) {
        throw new Error('useLoading must be used within LoadingProvider');
    }
    return context;
};

export const LoadingProvider = ({ children }) => {
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [loadingStack, setLoadingStack] = useState([]);
    const [stylesReady, setStylesReady] = useState(false);

    // Add styles on mount (ensures they exist before any spinner renders)
    useEffect(() => {
        // Check if styles already exist to avoid duplicates
        if (!document.getElementById('loading-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'loading-styles';
            styleSheet.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `;
            document.head.appendChild(styleSheet);
        }
        setStylesReady(true);
        
        return () => {
            // Don't remove styles on unmount - other components might need them
            // Optional: remove if no loading provider exists
        };
    }, []);

    const showLoading = useCallback((message = 'Loading...') => {
        setLoadingMessage(message);
        setLoading(true);
        // Add to stack to handle multiple simultaneous requests
        setLoadingStack(prev => [...prev, Date.now()]);
    }, []);

    const hideLoading = useCallback(() => {
        setLoadingStack(prev => {
            const newStack = prev.slice(0, -1);
            if (newStack.length === 0) {
                setLoading(false);
                setLoadingMessage('');
            }
            return newStack;
        });
    }, []);

    // Wrapper for async functions with better error handling
    const withLoading = useCallback(async (asyncFn, message = 'Loading...') => {
        // Don't show loading for input focus or blur events
        if (message === 'Loading input...' || message === 'Focusing...') {
            try {
                return await asyncFn();
            } catch (error) {
                console.error('[Loading] Async function failed:', error);
                throw error;
            }
        }
        
        showLoading(message);
        try {
            const result = await asyncFn();
            return result;
        } catch (error) {
            console.error('[Loading] Operation failed:', error);
            throw error;
        } finally {
            hideLoading();
        }
    }, [showLoading, hideLoading]);

    const value = {
        loading,
        loadingMessage,
        showLoading,
        hideLoading,
        withLoading
    };

    return (
        <LoadingContext.Provider value={value}>
            {children}
            {/* Only show spinner if styles are ready and loading is true */}
            {stylesReady && loading && <GlobalSpinner message={loadingMessage} />}
        </LoadingContext.Provider>
    );
};

// Global Spinner Component - FIXED WITH SAFE RENDERING
const GlobalSpinner = ({ message }) => {
    // Don't show spinner if there's no message
    if (!message) return null;
    
    // Safety check for SSR
    if (typeof document === 'undefined') return null;
    
    return (
        <div 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 999999,
                backdropFilter: 'blur(4px)',
                animation: 'fadeIn 0.2s ease'
            }}
            onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
            }}
        >
            <div
                style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '30px 40px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '15px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                    minWidth: '200px'
                }}
            >
                <div
                    style={{
                        width: '48px',
                        height: '48px',
                        border: '4px solid #f3f3f3',
                        borderTop: '4px solid #667eea',
                        borderRight: '4px solid #764ba2',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                    }}
                />
                <div style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#333',
                    textAlign: 'center'
                }}>
                    {message}
                </div>
                <div style={{
                    fontSize: '12px',
                    color: '#666',
                    textAlign: 'center'
                }}>
                    Please wait...
                </div>
            </div>
        </div>
    );
};
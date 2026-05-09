import React, { createContext, useContext, useState, useCallback } from 'react';

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

    // Wrapper for async functions
    const withLoading = useCallback(async (asyncFn, message = 'Loading...') => {
        showLoading(message);
        try {
            const result = await asyncFn();
            return result;
        } finally {
            hideLoading();
        }
    }, [showLoading, hideLoading]);

    return (
        <LoadingContext.Provider value={{
            loading,
            loadingMessage,
            showLoading,
            hideLoading,
            withLoading
        }}>
            {children}
            {loading && <GlobalSpinner message={loadingMessage} />}
        </LoadingContext.Provider>
    );
};

// Global Spinner Component
const GlobalSpinner = ({ message }) => {
    return (
        <div style={styles.overlay}>
            <div style={styles.container}>
                <div style={styles.spinner}></div>
                <div style={styles.message}>{message}</div>
                <div style={styles.submessage}>Please wait...</div>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
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
    },
    container: {
        background: 'white',
        borderRadius: '16px',
        padding: '30px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '15px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        minWidth: '200px'
    },
    spinner: {
        width: '48px',
        height: '48px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #667eea',
        borderRight: '4px solid #764ba2',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
    },
    message: {
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center'
    },
    submessage: {
        fontSize: '12px',
        color: '#666',
        textAlign: 'center'
    }
};

// Add keyframes to document
const styleSheet = document.createElement('style');
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
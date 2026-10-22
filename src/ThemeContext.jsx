import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Read from localStorage on init
    const [theme, setThemeState] = useState(() => {
        try {
            return localStorage.getItem('theme') || null; // null = not chosen yet
        } catch {
            return null;
        }
    });

    // Apply theme to <html> whenever it changes
    useEffect(() => {
        if (!theme) return;
        {/*
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('theme-dark');
            root.classList.remove('theme-light');
            root.style.colorScheme = 'dark';
        } else {
            root.classList.add('theme-light');
            root.classList.remove('theme-dark');
            root.style.colorScheme = 'light';
        }
        */}
        // Save to localStorage
        
        try {
            localStorage.setItem('theme', theme);
        } catch {}
    }, [theme]);

    const setTheme = (newTheme) => {
        if (newTheme === 'light' || newTheme === 'dark') {
            setThemeState(newTheme);
        }
    };

    const toggleTheme = () => {
        setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const clearTheme = () => {
        setThemeState(null);
        try {
            localStorage.removeItem('theme');
        } catch {}
    };

    return (
        <ThemeContext.Provider value={{
            theme,
            setTheme,
            toggleTheme,
            clearTheme,
            isDark: theme === 'dark',
            isLight: theme === 'light',
            hasChosenTheme: theme !== null,
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme must be used inside <ThemeProvider>');
    }
    return ctx;
};

export default ThemeContext;
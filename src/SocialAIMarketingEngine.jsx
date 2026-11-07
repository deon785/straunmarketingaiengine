import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate , useLocation } from 'react-router-dom';
import { supabase, queryWithRetry, sendPushNotification, callEdgeFunction } from './lib/supabase';
import './App.css';
import { useAuthState, useAuthActions } from './AuthContext.jsx';

// --- Components ---
import SellerSetupForm from './SellerSetupForm'; 
import BuyerSetupForm from './BuyerSetupForm';
import BuyerDecision from './BuyerDecision';
import SafeHTML from './SafeHTML.jsx';
import UserSettings from './UserSettings.jsx';
import DOMPurify from 'dompurify';
import TopNavigationBar from './TopNavigationBar';
import { Link } from 'react-router-dom';

import ReactGA from "react-ga4";
import WishlistManager from './WishlistManager.jsx';
import { SmartRateLimiter } from './smartRateLimiter.js';
import ReportButton from './ReportButton.jsx';

import { UserActivityTracker } from './userActivityTracker.js';
import AdminDashboard from './AdminDashboard.jsx';
import ToolsPanel from './ToolsPanel.jsx';
import { fscrub } from 'fpoint';

import PriceAlertButton from './PriceAlertButton.jsx';
import RecommendationsSection from './RecommendationsSection';
import RecommendationEngine from './RecommendationEngine.js';
import { useLoading } from './LoadingContext';

import DailyDeals from './DailyDeals';
import ReferralProgram from './ReferralProgram';
import UserDashboard from './UserDashboard';
import ChatList from './ChatList';
import ChatSystem from './ChatSystem.jsx';
import PriceAlertDashboard from './PriceAlertDashboard';

// Safe notification check
const isNotificationSupported = () => {
    return typeof Notification !== 'undefined' && 
           typeof Notification.requestPermission === 'function' &&
           typeof window !== 'undefined';
};

// ========== SAFE DATA ACCESS HELPERS ==========
const safeGet = (obj, path, fallback = null) => {
    try {
        const keys = path.split('.');
        let result = obj;
        for (const key of keys) {
        if (result === null || result === undefined) return fallback;
        result = result[key];
        }
        return result === undefined ? fallback : result;
    } catch {
        return fallback;
    }
};

// Safe localStorage access
const safeLocalStorage = {
    get: (key, fallback = null) => {
        try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
        } catch {
        return fallback;
        }
    },
    set: (key, value) => {
        try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
        } catch {
        return false;
        }
    }
};

// ========== CRASH-PROOF HELPERS ==========
const safeArray = (arr) => {
  if (Array.isArray(arr)) return arr;
  if (arr && typeof arr === 'object' && 'length' in arr) {
    return Array.from(arr);
  }
  return [];
};

const safeString = (str) => {
  if (typeof str === 'string') return str;
  if (str === null || str === undefined) return '';
  return String(str);
};

const safeNumber = (num) => {
    if (num === undefined || num === null) return 0;
    if (typeof num === 'number' && !isNaN(num)) return num;
    if (typeof num === 'string' && !isNaN(Number(num))) return Number(num);
    return 0;
};

const safeObject = (obj) => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
    return {};
};

class UserBehaviorAnalyzer {
  constructor() {
    this.actions = new Map();
    this.sessions = new Map();
  }

  recordUserAction(userId, actionType, metadata = {}) {
    console.log(`📊 User Action: ${userId} - ${actionType}`, metadata);
    
    // Store for rate limiting analysis
    const key = `${userId}_${actionType}`;
    const actions = this.actions.get(key) || [];
    actions.push({
      timestamp: Date.now(),
      metadata,
      actionType
    });
    this.actions.set(key, actions);
    
    // Send to analytics (optional)
    if (typeof ReactGA !== 'undefined') {
      ReactGA.event({
        category: 'UserBehavior',
        action: actionType,
        label: userId,
        value: Object.keys(metadata).length
      });
    }
    
    return { isSuspicious: false, score: 0 }; // Basic implementation
  }

  getUserBehavior(userId, actionType) {
    const key = `${userId}_${actionType}`;
    return this.actions.get(key) || [];
  }

  // Simple suspicious behavior detection
  detectSuspiciousBehavior(userId, actionType, threshold = 10) {
    const actions = this.getUserBehavior(userId, actionType);
    const lastMinute = actions.filter(a => 
      Date.now() - a.timestamp < 60000
    );
    
    return {
      isSuspicious: lastMinute.length > threshold,
      score: lastMinute.length,
      reason: lastMinute.length > threshold ? 
        `Too many ${actionType} actions (${lastMinute.length} in last minute)` : 
        null
    };
  }
}

let smartLimiterInstance;
let behaviorAnalyzerInstance;

const initializeRateLimiter = () => {
    if (!behaviorAnalyzerInstance) {
        behaviorAnalyzerInstance = new UserBehaviorAnalyzer();
    }
    if (!smartLimiterInstance) {
        smartLimiterInstance = new SmartRateLimiter(behaviorAnalyzerInstance);
    }
    return { smartLimiterInstance, behaviorAnalyzerInstance };
};

// Style for the big green buttons
const mainButtonStyle = (color) => ({
    width: '100%',
    backgroundColor: color,
    color: 'white',
    border: 'none',
    padding: '12px',
    borderRadius: '12px',
    fontWeight: 'bold',
    fontSize: '15px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
});

// Style for the smaller Blue/Orange buttons
const smallButtonStyle = (color) => ({
    flex: 1,
    backgroundColor: color,
    color: 'white',
    border: 'none',
    padding: '12px',
    borderRadius: '12px',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
});

// === SANITIZATION HELPER FUNCTIONS ===
const sanitizeInput = (input, maxLength = 100) => {
    if (!input) return '';
    return input
        .toString()
        .trim()
        .replace(/[<>"'`&;\\]/g, '')
        .substring(0, maxLength);
};

const sanitizeEmail = (email) => {
    if (!email) return '';
    return email
        .toLowerCase()
        .trim()
        .replace(/[<>"'`&;\\]/g, '')
        .substring(0, 254);
};

const sanitizePhone = (phone) => {
    if (!phone) return '';
    return phone
        .toString()
        .replace(/[^\d+]/g, '')
        .trim()
        .substring(0, 20);
};

const sanitizeLocation = (location) => {
    if (!location) return '';
    return location
        .trim()
        .replace(/[<>"'`&;\\]/g, '')
        .replace(/\s+/g, ' ')
        .substring(0, 100);
};

const sanitizeProductName = (name) => {
    if (!name) return '';
    return name
        .trim()
        .replace(/[<>"'`&;\\]/g, '')
        .replace(/\s+/g, ' ')
        .substring(0, 200);
};

// Helper function for word variations - IMPROVED VERSION
function getWordVariations(word) {
    if (!word || typeof word !== 'string') {
        console.warn('getWordVariations received invalid input:', word, typeof word);
        return [];
    }
    
    const sanitizedWord = sanitizeInput(word.toLowerCase(), 50);
    
    if (!sanitizedWord || sanitizedWord.trim() === '') {
        return [];
    }
    
    const variations = new Set();
    
    // Add the original word
    variations.add(sanitizedWord);
    
    // Common plural/singular variations
    if (sanitizedWord.endsWith('s')) {
        variations.add(sanitizedWord.slice(0, -1)); // Remove 's'
        variations.add(sanitizedWord + 'es');
    } else {
        variations.add(sanitizedWord + 's');
        variations.add(sanitizedWord + 'es');
    }
    
    // Common suffixes
    ['ing', 'ed', 'er', 'est', 'ly', 'able', 'ful', 'less', 'ment'].forEach(ending => {
        if (!sanitizedWord.endsWith(ending)) {
            const variation = sanitizedWord + ending;
            if (variation.length <= 50) {
                variations.add(variation);
            }
        }
    });
    
    // Remove common suffixes to get root words
    ['s', 'es', 'ing', 'ed', 'er'].forEach(ending => {
        if (sanitizedWord.endsWith(ending) && sanitizedWord.length > ending.length) {
            const root = sanitizedWord.slice(0, -ending.length);
            if (root.length >= 2) {
                variations.add(root);
            }
        }
    });
    
    // Common prefixes
    ['re', 'un', 'dis', 'pre', 'mis'].forEach(prefix => {
        if (!sanitizedWord.startsWith(prefix)) {
            variations.add(prefix + sanitizedWord);
        }
    });
    
    return Array.from(variations).filter(v => v && v.length >= 2);
}

// Helper function to convert base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function SocialAIMarketingEngine() {
    const navigate = useNavigate();
    const location = useLocation();
    const { withLoading, showLoading, hideLoading } = useLoading();

    // ========== SAFE NAVIGATION ==========
    const safeNavigate = (path) => {
        try {
            navigate(path);
        } catch (err) {
            console.warn('[Navigation] Failed to navigate to', path, err);
            // Fallback to window.location
            try {
            window.location.href = path;
            } catch (fallbackErr) {
            console.error('[Navigation] Fallback failed:', fallbackErr);
            }
        }
    };

    // Add these with your other useState declarations
    const [globalLoading, setGlobalLoading] = useState(false);
    const [globalLoadingMessage, setGlobalLoadingMessage] = useState('');
    const { user, loading: authLoading, isAuthenticated, selectedMode } = useAuthState();
    const { setMode, clearAuthState } = useAuthActions();

    // ✅ FIRST: Initialize searchParams from URL
    const [searchParams, setSearchParams] = useState(() => {
        const params = new URLSearchParams(location.search);
        return {
        query: params.get('q') || '',
        category: params.get('category') || '',
        sort: params.get('sort') || 'recent',
        page: parseInt(params.get('page')) || 1,
        };
    });

    // ✅ NOW you can use searchParams.query
    const [productSearch, setProductSearch] = useState(searchParams.query);

    useEffect(() => {
        initializeRateLimiter();
    }, []);

    // --- SIMPLIFIED MODE & PROFILE STATE ---
    const [showSellerDecision, setShowSellerDecision] = useState(false);
    const [showBuyerDecision, setShowBuyerDecision] = useState(false);
    const [showBuyerForm, setShowBuyerForm] = useState(false);
    const [isProfileComplete, setIsProfileComplete] = useState(() => {
        // Check if already completed
        return localStorage.getItem('straun_profileComplete') === 'true';
    });
    
    // --- APP STATE ---
    const [prospects, setProspects] = useState([]);
    const [productsFound, setProductsFound] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // --- NEW STATE FOR ALL PRODUCTS ---
    const [allProducts, setAllProducts] = useState([]);
    const searchTimeoutRef = useRef(null);
    const isSearchingRef = useRef(false);
    const profileFetchedRef = useRef(false);
    
    // --- PROFILE DATA ---
    const [profileData, setProfileData] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    
    // Add these to your state declarations
    const [initialDataLoading, setInitialDataLoading] = useState(true);
    const [searchLoading, setSearchLoading] = useState(false);
    const [profileUpdateLoading, setProfileUpdateLoading] = useState(false);
    const [productsFetchLoading, setProductsFetchLoading] = useState(false);

    const [signOutLoading, setSignOutLoading] = useState(false);
    const [previousSearchState, setPreviousSearchState] = useState({
        productSearch: '',
        prospects: [],
        productsFound: [],
        searchLoading: false
    });

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [zoomedImage, setZoomedImage] = useState(null);
    const [contactProduct, setContactProduct] = useState(null);

    const [isNavCollapsed, setIsNavCollapsed] = useState(false);
    const [showWishlist, setShowWishlist] = useState(false);
   
    const [openingWhatsApp, setOpeningWhatsApp] = useState(false); 
    const [calling, setCalling] = useState(false); 
    const [items, setItems] = useState([]);

    const [searchCache, setSearchCache] = useState({});
    const [showSavedSearches, setShowSavedSearches] = useState(false);
    const [userSavedSearches, setUserSavedSearches] = useState([]);

    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const ITEMS_PER_PAGE = 6;

    const [isNavbarHidden, setIsNavbarHidden] = useState(false);
    const [isReportButtonFloating, setIsReportButtonFloating] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
 
    const [showSafetyWarning, setShowSafetyWarning] = useState(false);
    const [similarProducts, setSimilarProducts] = useState([]);
    const [showSimilarProducts, setShowSimilarProducts] = useState(false);
    const [similarProductsLoading, setSimilarProductsLoading] = useState(false);

    const [showToolsPanel, setShowToolsPanel] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [hasBeenPrompted, setHasBeenPrompted] = useState(false);

    const userMode = selectedMode === 'seller' ? 'Seller Mode' : 'Buyer Mode';
    const [showPriceAlerts, setShowPriceAlerts] = useState(false);
    const [lastViewedProduct, setLastViewedProduct] = useState(null);

    // Add these missing state variables
    const [pushLoading, setPushLoading] = useState(false);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [hasAlert, setHasAlert] = useState(false);
    const [alertPrice, setAlertPrice] = useState('');

    const [showChat, setShowChat] = useState(false);
    const [showChatList, setShowChatList] = useState(false);
    const [selectedChat, setSelectedChat] = useState(null);
    const [showDailyDeals, setShowDailyDeals] = useState(false);
    const [userReferralCount, setUserReferralCount] = useState(0);

    const [showReferralProgram, setShowReferralProgram] = useState(false);
    const [currentProduct, setCurrentProduct] = useState(null);
    const [currentPrice, setCurrentPrice] = useState(0);

    const [showLocationModal, setShowLocationModal] = useState(false);
    const [tempLocation, setTempLocation] = useState('');
    const [tempPhone, setTempPhone] = useState('');
    const isFreshLoadRef = useRef(true);

    const [limits, setLimits] = useState({
        CONTACT: { remaining: 50, total: 50 },
        SEARCH: { remaining: 15, total: 15 },
        SAVE_WISHLIST: { remaining: 20, total: 20 },
        PROFILE_SETUP: { remaining: 3, total: 3 },
        NOTIFICATION_SEND: { remaining: 20, total: 20 }
    });

    // Search persistence state - with safe defaults
    const [searchSessionId, setSearchSessionId] = useState(null);
    const [contactedIds, setContactedIds] = useState(() => {
        // Try to load from localStorage safely on init
        try {
            if (!user?.id) return [];
            const key = `straun_last_search_${user.id}`;
            const raw = localStorage.getItem(key);
            if (raw) {
                const data = JSON.parse(raw);
                return data.contactedIds || [];
            }
        } catch (e) {
            // Silent fail - just return empty array
        }
        return [];
    });
    const [restoredSearch, setRestoredSearch] = useState(false);
    const [searchExpired, setSearchExpired] = useState(false);

    // ========== SEARCH PERSISTENCE HELPERS ==========
    const SEARCH_EXPIRY_MS = 20 * 60 * 1000; // 20 minutes

    const getSearchStorageKey = () => {
        if (!user?.id) return null;
        return `straun_last_search_${user.id}`;
    };

    // ✅ Save search results with full state
    const saveSearchResults = (results, searchTerm, mode) => {
        if (!user?.id || !results || results.length === 0) {
            console.log('⚠️ Not saving search - missing user or results');
            return;
        }

        try {
            const key = getSearchStorageKey();
            if (!key) return;

            const searchData = {
                results: results,
                searchTerm: searchTerm || '',
                mode: mode || selectedMode,
                timestamp: Date.now(),
                sessionId: searchSessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                contactedIds: contactedIds || [],
                // ✅ Save current page and scroll position
                page: currentPage,
                hasMore: hasMore,
                // ✅ Save the actual data structure
                data: {
                    prospects: selectedMode === 'seller' ? results : [],
                    productsFound: selectedMode === 'buyer' ? results : []
                }
            };
            
            localStorage.setItem(key, JSON.stringify(searchData));
            console.log('💾 Search results saved successfully with', results.length, 'items');
        } catch (e) {
            console.warn('Could not save search results:', e.message);
        }
    };

    // ✅ Load search results with full state
    const loadSearchResults = () => {
        if (!user?.id) {
            console.log('⚠️ No user to load search for');
            return null;
        }

        try {
            const key = getSearchStorageKey();
            if (!key) return null;
            
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            
            const data = JSON.parse(raw);
            
            if (!data || !data.results || !Array.isArray(data.results)) {
                console.log('⚠️ Invalid search data format');
                localStorage.removeItem(key);
                return null;
            }
            
            const age = Date.now() - data.timestamp;
            
            // ⏰ Check if search is still relevant (20 minutes)
            if (age > SEARCH_EXPIRY_MS) {
                console.log('⏰ Search expired (older than 20 minutes)');
                localStorage.removeItem(key);
                return null;
            }
            
            console.log(`✅ Restored search from ${Math.round(age / 1000)} seconds ago`);
            return data;
        } catch (e) {
            console.warn('Could not load search results:', e.message);
            return null;
        }
    };

    // ✅ Clear search results
    const clearSearchResults = () => {
        try {
            const key = getSearchStorageKey();
            if (key) {
                localStorage.removeItem(key);
                console.log('🗑️ Search results cleared');
            }
        } catch (e) {
            console.warn('Could not clear search results:', e.message);
        }
    };

    // ✅ Update contacted status and save
    const updateContactedStatus = (contactId) => {
        if (!contactId) {
            console.log('⚠️ No contactId provided');
            return false;
        }

        try {
            // Update local state
            setContactedIds(prev => {
                if (prev.includes(contactId)) return prev;
                return [...prev, contactId];
            });
            
            // Update localStorage
            const key = getSearchStorageKey();
            if (!key) return false;
            
            const raw = localStorage.getItem(key);
            if (!raw) return false;
            
            const data = JSON.parse(raw);
            if (!data.contactedIds) {
                data.contactedIds = [];
            }
            
            if (!data.contactedIds.includes(contactId)) {
                data.contactedIds.push(contactId);
                localStorage.setItem(key, JSON.stringify(data));
                console.log(`🔵 Marked ${contactId} as contacted`);
                return true;
            }
            
            return false;
        } catch (e) {
            console.warn('Could not update contacted status:', e.message);
            return false;
        }
    };

    // ✅ Check if already contacted
    const isContacted = (id) => {
        if (!id) return false;
        
        try {
            if (contactedIds.includes(id)) return true;
            
            const key = getSearchStorageKey();
            if (!key) return false;
            
            const raw = localStorage.getItem(key);
            if (!raw) return false;
            
            const data = JSON.parse(raw);
            return data.contactedIds?.includes(id) || false;
        } catch (e) {
            return false;
        }
    };

    const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    location: '',
    sortBy: 'newest', // 'newest', 'price_low', 'price_high'
    category: '' // Optional: if you have categories
    });

    // ✅ STRONG MODE EXPIRY CHECK - Runs on app load
    useEffect(() => {
        // Only run if user exists and has a selected mode
        if (!user || !selectedMode) return;
        
        const isAdminUser = user.email === 'deonmahachi8@gmail.com';
        if (isAdminUser) {
            console.log('👑 Admin mode - NEVER expires');
            return;
        }
        
        const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
        const MODE_EXPIRY_MS = 60 * 60 * 1000;
        
        if (!timestamp) {
            console.log('⏰ No mode timestamp found - clearing mode');
            setMode(null);
            setIsProfileComplete(false);
            localStorage.removeItem('straun_chosen_mode');
            localStorage.removeItem('straun_profileComplete');
            if (user?.id) {
                localStorage.removeItem(`straun_userLocation_${user.id}`);
            }
            return;
        }
        
        const age = Date.now() - parseInt(timestamp);
        const isExpired = age >= MODE_EXPIRY_MS;
        
        if (isExpired) {
            console.log(`⏰ Mode EXPIRED after ${Math.round(age / 60000)} minutes`);
            
            setMode(null);
            setIsProfileComplete(false);
            setShowSellerDecision(false);
            setShowBuyerDecision(false);
            setShowBuyerForm(false);
            
            localStorage.removeItem('straun_chosen_mode');
            localStorage.removeItem('straun_selectedMode_timestamp');
            localStorage.removeItem('straun_profileComplete');
            localStorage.removeItem('straun_profileData');
            
            if (user?.id) {
                localStorage.removeItem(`straun_userLocation_${user.id}`);
                localStorage.removeItem(`straun_last_search_${user.id}`);
            }
            
            setProductsFound([]);
            setProspects([]);
            setProductSearch('');
            setAllProducts([]);
            setRestoredSearch(false);
            
            if (location.pathname !== '/' && location.pathname !== '/app') {
                navigate('/');
            }
            
            // ✅ REPLACE showToastNotification with console.log + simple alert
            console.log('⏰ Your session expired. Please select your mode again.');
            // Simple fallback notification
            try {
                alert('⏰ Your session expired. Please select your mode again.');
            } catch (e) {
                // ignore if alert fails
            }
        } else {
            const remainingMs = MODE_EXPIRY_MS - age;
            const remainingMinutes = Math.floor(remainingMs / 60000);
            console.log(`⏰ Mode expires in ${remainingMinutes} minutes`);
        }
    }, [user, selectedMode, setMode, navigate, location.pathname]);

    // ✅ Save timestamp when mode is SET
    useEffect(() => {
        if (selectedMode && user) {
            const isAdminUser = user.email === 'deonmahachi8@gmail.com';
            if (!isAdminUser) {
                localStorage.setItem('straun_selectedMode_timestamp', String(Date.now()));
                localStorage.setItem('straun_chosen_mode', selectedMode);
                if (user?.id) {
                    localStorage.setItem(`straun_chosen_mode_${user.id}`, selectedMode);
                }
                console.log('⏰ Mode timestamp saved:', new Date().toISOString());
            }
        }
    }, [selectedMode, user]);

    const activeFilterCount = useMemo(() => {
        return Object.values(filters).filter(val => 
            (typeof val === 'string' && val !== '' && val !== 'newest') || 
            (typeof val === 'number' && val !== 0)
        ).length;
    }, [filters]);

    const userInitials = useMemo(() => {
        return user?.email ? user.email.charAt(0).toUpperCase() : '?';
    }, [user]);

    const userName = useMemo(() => {
        return profileData?.username || user?.email?.split('@')[0] || 'User';
    }, [profileData, user]);

    const handleNavigationWithLoading = async (path) => {
        await withLoading(async () => {
            navigate(path);
            // Simulate minimum loading time for smooth transition
            await new Promise(resolve => setTimeout(resolve, 300));
        }, 'Loading page...');
    };

    const styles = {
        modalOverlay: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        },
        modalContent: {
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            borderRadius: '12px',
            overflow: 'hidden'
        }
    };

    // ========== INTEREST CATEGORIES ==========
    const INTEREST_CATEGORIES = {
        
        // Fashion & Clothing
        fashion: ['clothing', 'clothes', 'shirt', 't-shirt', 'pants', 'jeans', 'trousers', 'shorts', 'skirt', 'dress', 'coat', 'sweater', 'hoodie', 'socks', 'underwear', , 'swimwear', 'bikini', 'hat', 'cap', 'sunglasses', 'watch', 'jewelry', 'necklace', 'bracelet', 'ring', 'earring', 'handbag',],
        
    };

    // ========== SMART INTEREST FILTERING ==========
    const getRelevantInterests = (interests, searchTerm) => {
        if (!interests || !Array.isArray(interests) || interests.length === 0) {
            return [];
        }
        
        const searchLower = searchTerm ? searchTerm.toLowerCase().trim() : '';
        if (!searchLower) return interests.slice(0, 5); // Return first 5 if no search term
        
        // Find which category the search term belongs to
        let searchCategory = null;
        for (const [category, keywords] of Object.entries(INTEREST_CATEGORIES)) {
            if (keywords.some(keyword => searchLower.includes(keyword) || keyword.includes(searchLower))) {
                searchCategory = category;
                break;
            }
        }
        
        // If no category found, try to match with any interest
        if (!searchCategory) {
            // Sort interests by relevance to search term
            const sorted = [...interests].sort((a, b) => {
                const aLower = a.toLowerCase();
                const bLower = b.toLowerCase();
                const aScore = aLower.includes(searchLower) ? 10 : (searchLower.includes(aLower) ? 5 : 0);
                const bScore = bLower.includes(searchLower) ? 10 : (searchLower.includes(bLower) ? 5 : 0);
                return bScore - aScore;
            });
            return sorted.slice(0, 5); // Return top 5 most relevant
        }
        
        // Get all interests in the same category
        const categoryKeywords = INTEREST_CATEGORIES[searchCategory] || [];
        const relevantInterests = interests.filter(interest => {
            const interestLower = interest.toLowerCase();
            // Check if interest is in the same category
            return categoryKeywords.some(keyword => 
                interestLower.includes(keyword) || keyword.includes(interestLower)
            );
        });
        
        // If we found relevant interests in the same category, return them
        if (relevantInterests.length > 0) {
            // Sort by relevance (exact matches first)
            const sorted = relevantInterests.sort((a, b) => {
                const aLower = a.toLowerCase();
                const bLower = b.toLowerCase();
                const aExact = aLower === searchLower ? 10 : (aLower.includes(searchLower) ? 5 : 0);
                const bExact = bLower === searchLower ? 10 : (bLower.includes(searchLower) ? 5 : 0);
                return bExact - aExact;
            });
            return sorted.slice(0, 5); // Show top 5 relevant interests
        }
        
        // Fallback: show interests that contain search term or are in same category
        const fallback = interests.filter(interest => {
            const interestLower = interest.toLowerCase();
            return interestLower.includes(searchLower) || searchLower.includes(interestLower);
        });
        
        return fallback.length > 0 ? fallback.slice(0, 5) : interests.slice(0, 5);
    };

    // ========== GROUP INTERESTS BY CATEGORY ==========
    const groupInterestsByCategory = (interests) => {
        if (!interests || !Array.isArray(interests)) return {};
        
        const grouped = {};
        const uncategorized = [];
        
        interests.forEach(interest => {
            const interestLower = interest.toLowerCase();
            let categorized = false;
            
            for (const [category, keywords] of Object.entries(INTEREST_CATEGORIES)) {
                if (keywords.some(keyword => interestLower.includes(keyword) || keyword.includes(interestLower))) {
                    if (!grouped[category]) grouped[category] = [];
                    grouped[category].push(interest);
                    categorized = true;
                    break;
                }
            }
            
            if (!categorized) {
                uncategorized.push(interest);
            }
        });
        
        if (uncategorized.length > 0) {
            grouped['Other'] = uncategorized;
        }
        
        return grouped;
    };

    const [showInterestPopup, setShowInterestPopup] = useState(false);

    const [buyerSearchCount, setBuyerSearchCount] = useState(() => {
        // Get from session storage
        return parseInt(sessionStorage.getItem('buyerSearchCount') || '0');
    });

    const [interestReminderShown, setInterestReminderShown] = useState(() => {
        // Check if reminder was already shown
        return localStorage.getItem(`interest_reminder_${user?.id}`) === 'true';
    });

    // ✅ Save current location - FIXED to avoid saving /app as redirect target
    const saveUserLocation = useCallback(() => {
        if (!user || !user.id) return;
        
        // ✅ DON'T save location if on /app or / (to avoid redirect loops)
        if (location.pathname === '/app' || location.pathname === '/') {
            console.log('💾 Skipping location save for root/app page');
            return;
        }
        
        const locationData = {
            path: location.pathname,
            page: location.pathname === '/app' ? 'social' : 'setup',
            timestamp: Date.now()
        };
        
        const storageKey = `straun_userLocation_${user.id}`;
        localStorage.setItem(storageKey, JSON.stringify(locationData));
        
        console.log('💾 Saved location for user:', user.id, 'path:', location.pathname);
    }, [location.pathname, user]);

    const loadMoreProducts = async () => {
        // ✅ Don't load more if no search term
        if (!productSearch.trim()) {
            console.log('No search term - skipping load more');
            return;
        }
        
        setLoading(true);
        try {
            const from = currentPage * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            // Start with base query
            let query = supabase
                .from('products')
                .select('*', { count: 'exact' })
                .ilike('name', `%${productSearch}%`);
            
            // Apply filters
            query = applyFiltersToQuery(query, filters);
            
            // Add pagination
            query = query.range(from, to);

            const { data, count, error } = await query;

            if (error) throw error;

            if (data && data.length > 0) {
                setProductsFound(prev => [...prev, ...data]);
                setCurrentPage(prev => prev + 1);
                setHasMore(data.length === ITEMS_PER_PAGE);
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error('Error loading more products:', err);
            setError('Failed to load more products');
        } finally {
            setLoading(false);
        }
    };

    const loadReferralCount = async () => {
        if (!user) return;
        
        const { data, error } = await supabase
            .from('referrals')
            .select('id', { count: 'exact' })
            .eq('referrer_id', user.id)
            .eq('status', 'completed');
        
        if (!error) {
            setUserReferralCount(data?.length || 0);
        }
    };

    // Toggle mobile menu
    const toggleMobileMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen);
        // Prevent body scroll when menu is open
        if (!mobileMenuOpen) {
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
        } else {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        }
    };

    // Close menu on navigation
    const handleNavigation = (action) => {
        console.log('Navigate to:', action);
        
        switch(action) {
            case 'home':
                setShowWishlist(false);
                setShowDailyDeals(false);
                setShowReferralProgram(false);
                setShowPriceAlerts(false);
                setShowSavedSearches(false);
                setShowToolsPanel(false);
                setShowChatList(false);
                setShowChat(false);
                setShowSettings(false);
                navigate('/');
                break;
                
            case 'search':
                // Focus the search input
                setTimeout(() => {
                    const searchInput = document.querySelector('.search-input-large');
                    if (searchInput) {
                        searchInput.focus();
                    }
                }, 100);
                break;
                
            // When opening the wishlist, push a hash to the URL
            case 'wishlist':
                setPreviousSearchState({
                    productSearch: productSearch,
                    prospects: prospects,
                    productsFound: productsFound,
                    searchLoading: searchLoading
                });
                // ✅ Push #wishlist to the URL so the back button works
                window.history.pushState({ modal: 'wishlist' }, '', '#wishlist'); 
                setShowWishlist(true);
                break;
                
            case 'dashboard':
                navigate('/dashboard', { state: { selectedMode } });
                break;
                
            case 'deals':
                setShowDailyDeals(true);
                break;
                
            case 'messages':
                setShowChatList(true);
                break;
                
            case 'alerts':
                setShowPriceAlerts(true);
                break;
                
            case 'referrals':
                setShowReferralProgram(true);
                break;
                
            case 'profile':
                showToastNotification('Profile feature coming soon');
                break;
                
            case 'settings':
                setShowSettings(true);
                break;
                
            case 'switchMode':
                handleSwitchMode();
                break;
                
            case 'admin':
                safeNavigate('/admin');
                break;
                
            case 'signout':
                handleSignOut();
                break;
                
            default:
                break;
        }
        
        // Close the menu
        toggleMobileMenu();
    };

    const fetchNotifications = useCallback(async () => {
        if (!user || !user.id) {
            console.log('No user for notifications fetch');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('Error fetching notifications:', error);
                return;
            }

            if (!data) {
                setNotifications([]);
                setUnreadCount(0);
                return;
            }

            setNotifications(data || []);
            
            // ✅ FIXED: Use 'is_read' NOT 'read'
            const unread = (data || []).filter(n => n.is_read === false).length;
            setUnreadCount(unread);

        } catch (error) {
            console.error('Unexpected error fetching notifications:', error);
        }
    }, [user]);

    // Add this helper function before the useEffect
    const getModeExpiryInfo = useCallback(() => {
        if (!user) return null;
        
        const isAdminUser = user.email === 'deonmahachi8@gmail.com';
        const timestamp = localStorage.getItem('straun_selectedMode_timestamp');
        
        if (isAdminUser) {
            return {
                isAdmin: true,
                isExpired: false,
                timeRemaining: 'Never expires',
                timeRemainingMs: Infinity,
                expiresAt: 'Never'
            };
        }
        
        if (!timestamp || !selectedMode) {
            return {
                isAdmin: false,
                isExpired: true,
                timeRemaining: 'No mode selected',
                timeRemainingMs: 0,
                expiresAt: 'N/A'
            };
        }
        
        const age = Date.now() - parseInt(timestamp);
        const MODE_EXPIRY_MS = 60 * 60 * 1000;
        const isExpired = age >= MODE_EXPIRY_MS;
        const remainingMs = Math.max(0, MODE_EXPIRY_MS - age);
        const remainingMinutes = Math.floor(remainingMs / 60000);
        const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
        
        return {
            isAdmin: false,
            isExpired: isExpired,
            timeRemaining: isExpired ? 'Expired' : `${remainingMinutes}m ${remainingSeconds}s`,
            timeRemainingMs: remainingMs,
            expiresAt: new Date(parseInt(timestamp) + MODE_EXPIRY_MS).toLocaleTimeString()
        };
    }, [user, selectedMode]);

    const PushEnableButton = () => {
        // Track permission reactively so button disappears after decision
        const [permission, setPermission] = useState(
            typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
        );

        // Re-check when window regains focus (user may have changed it in browser settings)
        useEffect(() => {
            const onFocus = () => {
            if (typeof Notification !== 'undefined') setPermission(Notification.permission);
            };
            window.addEventListener('focus', onFocus);
            return () => window.removeEventListener('focus', onFocus);
        }, []);

        const handleEnable = async () => {
            if (typeof Notification === 'undefined') {
            alert("Notifications are not supported in this environment.");
            return;
            }

            // 🚫 Never re-ask if already decided
            if (Notification.permission === 'granted' || Notification.permission === 'denied') {
            setPermission(Notification.permission);
            return;
            }

            try {
            // ✅ ONLY place in the whole app that calls requestPermission() — and it's a user gesture
            const result = await Notification.requestPermission();
            setPermission(result);

            if (result === 'granted') {
                await subscribeToPush();
            } else if (result === 'denied') {
                alert("You blocked notifications. You can enable them in your browser settings.");
            }
            // result === 'default' means user dismissed — do nothing, don't nag.
            } catch (err) {
            console.error("Error enabling notifications:", err);
            alert("Could not enable notifications. Please try again.");
            }
        };

        // 🔕 Already granted → show status, no button
        if (permission === 'granted') {
            return <span className="push-status">🔔 Notifications enabled</span>;
        }

        // 🔕 Already denied → show instructions, no button
        if (permission === 'denied') {
            return (
            <span className="push-status">
                🔕 Notifications blocked — enable in browser settings
            </span>
            );
        }

        // 🟢 Only show the button if the user has never decided
        return (
            <button onClick={handleEnable} className="push-btn">
            🔔 Enable Push Notifications
            </button>
        );
    };

    // Enable push notifications even when browser is closed
    const setupPushNotifications = async () => {
        if (!('serviceWorker' in navigator)) {
            console.warn('[Push] Service workers not supported');
            return;
        }

        // ✅ Only proceed if permission already granted. NEVER ask here.
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
            console.log('[Push] Permission not granted — skipping auto-setup.');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register('/sw.js');

            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
                if (!VAPID_PUBLIC_KEY) {
                    console.error('[Push] Missing VAPID public key');
                    return;
                }
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });
            }

            // ✅ FIXED: correct columns, jsonb object, check error
            const { data, error } = await supabase
            .from('push_subscriptions')
            .upsert(
                {
                    user_id: user.id,
                    subscription: subscription.toJSON(),
                    user_agent: navigator.userAgent,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
            )
            .select();

            if (error) {
                console.error('[Push] save failed:', error);
                try { Sentry.captureException(error); } catch (_) {}
                return;
            }

            console.log('[Push] Subscription saved:', data);
        } catch (error) {
            console.error('[Push] Setup failed:', error);
            try {
                Sentry.captureMessage('Push notification setup failed', {
                    level: 'warning',
                    extra: { error: error.message },
                });
            } catch (_) {}
        }
        };

    // Subscribe to push notifications using Supabase Edge Function
    const subscribeToPush = async () => {
        if (!isNotificationSupported()) {
            showToastNotification('⚠️ Notifications not supported in this browser');
            return false;
        }

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            showToastNotification('⚠️ Push notifications not supported');
            return false;
        }

        // ✅ Only works if permission is ALREADY granted. Never ask here.
        if (Notification.permission !== 'granted') {
            showToastNotification('❌ Please allow notifications first');
            return false;
        }

        try {
            setPushLoading(true);

            const registration = await navigator.serviceWorker.ready;

            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
            const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            });
            }

            const result = await callEdgeFunction('send-push-notifications', {
            action: 'subscribe',
            subscription,
            userId: user.id,
            userAgent: navigator.userAgent,
            });

            if (result.success) {
            showToastNotification('✅ Push notifications enabled!');
            setPushEnabled(true);
            return true;
            }
        } catch (error) {
            console.error('Push subscription error:', error);
            showToastNotification('⚠️ Error enabling notifications');
        } finally {
            setPushLoading(false);
        }

        return false;
    };

    // Send test notification using edge function
    const sendTestNotification = async () => {
        try {
            const supabaseUrl = 'https://mmcwfoqajkfnohbonaqa.supabase.co';
            const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notifications`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.id,
                    title: '🎉 Welcome to StraunAI!',
                    body: 'You will now receive real-time notifications about matches, messages, and deals!',
                    icon: '/pwa-192x192.png',
                    url: '/'
                })
            });
            
            if (response.ok) {
                console.log('✅ Test notification sent');
            }
        } catch (error) {
            console.error('Failed to send test notification:', error);
        }
    };
    
    // Test push notification (for debugging)
    const testPushNotification = async () => {
        if (!('serviceWorker' in navigator)) {
            console.log('Service Worker not supported');
            return;
        }
        
        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Send a test notification via service worker
            registration.showNotification('Test Notification', {
                body: '✅ Push notifications are working!',
                icon: '/pwa-192x192.png',
                badge: '/pwa-192x192.png',
                vibrate: [200, 100, 200],
                data: { url: '/' }
            });
            
            console.log('✅ Test notification sent');
            showToastNotification('✅ Test notification sent! Check your notifications.');
        } catch (error) {
            console.error('❌ Test notification failed:', error);
        }
    };
    
    // Price Alert Functions
    const setPriceAlert = async () => {
        if (!alertPrice || alertPrice >= currentPrice) {
            showToastNotification('⚠️ Alert price must be lower than current price');
            return;
        }
        
        const { error } = await supabase
            .from('price_alerts')
            .upsert({
                user_id: user.id,
                product_id: currentProduct?.id,
                target_price: alertPrice,
                current_price: currentPrice,
                is_active: true
            });
        
        if (!error) {
            showToastNotification(`✅ Alert set! We'll notify you when price drops below $${alertPrice}`);
            setHasAlert(true);
        }
    };

    const removeAlert = async () => {
        await supabase
            .from('price_alerts')
            .update({ is_active: false })
            .eq('user_id', user.id)
            .eq('product_id', currentProduct?.id);
        
        showToastNotification('Alert removed');
        setHasAlert(false);
    };

    // Users can set alert when price drops below X
    const priceAlertSystem = {
        setup: async (productId, targetPrice) => {
            await supabase.from('price_alerts').insert([{
            user_id: user.id,
            product_id: productId,
            target_price: targetPrice,
            is_active: true
            }]);
        },
        
        check: async () => {
            // Cron job or trigger on price update
            const { data: alerts } = await supabase
            .from('price_alerts')
            .select('*, products(*)')
            .eq('is_active', true)
            .lt('products.price', supabase.raw('target_price'));
            
            alerts.forEach(alert => {
            sendNotification(alert.user_id, 
                `💰 Price dropped! ${alert.products.name} now $${alert.products.price}`);
            });
        }
    };

    // AI-powered product recommendations
    const recommendationEngine = {
        basedOn: {
            search_history: 'What they searched for',
            viewed_products: 'What they clicked',
            saved_items: 'What they wishlisted',
            similar_users: 'Users with similar interests',
            location: 'Nearby products',
            season: 'Seasonal items'
        },
        
        getRecommendations: async (userId) => {
            if (!userId) {
                console.warn('[RecommendationEngine] No userId provided');
                return [];
            }
            
            try {
                // ✅ Get user's interests
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('interests')
                    .eq('user_id', userId)
                    .maybeSingle();
                
                if (profileError || !profile?.interests) {
                    console.log('[RecommendationEngine] No interests found');
                    return [];
                }
                
                let interests = [];
                if (Array.isArray(profile.interests)) {
                    interests = profile.interests;
                } else if (typeof profile.interests === 'string') {
                    try {
                        interests = JSON.parse(profile.interests);
                    } catch (e) {
                        interests = [profile.interests];
                    }
                }
                
                if (interests.length === 0) {
                    return [];
                }
                
                // ✅ Instead of ONE big OR query, do MULTIPLE individual queries
                // This avoids the complex or() syntax that's causing 400 errors
                let allProducts = [];
                const MAX_INTERESTS = 3; // Limit to first 3 interests to avoid too many queries
                
                for (const interest of interests.slice(0, MAX_INTERESTS)) {
                    if (!interest || !interest.trim()) continue;
                    
                    const { data: products, error } = await supabase
                        .from('products')
                        .select('*')
                        .eq('status', 'active')
                        .ilike('name', `%${interest.trim()}%`)
                        .limit(10);
                    
                    if (!error && products) {
                        allProducts = [...allProducts, ...products];
                    }
                }
                
                // ✅ Remove duplicates
                const uniqueProducts = Array.from(
                    new Map(allProducts.map(p => [p.id, p])).values()
                );
                
                // ✅ Limit results
                return uniqueProducts.slice(0, 20);
                
            } catch (error) {
                console.error('[RecommendationEngine] Error:', error);
                return [];
            }
        }

    };

    const handleProductClick = async (product) => {
        // ✅ Safe product validation
        if (!product) {
            console.warn('❌ No product provided');
            return;
        }

        // ✅ Use safe string for product name
        const productName = product?.name || 'product';
        const productId = product?.id;

        // ✅ Track view in database
        if (productId) {
            try {
                await supabase.rpc('increment_product_views', {
                    p_product_id: productId
                });
                console.log(`✅ View tracked for: ${productName}`);
            } catch (error) {
                console.error('Error tracking view:', error);
                // Don't stop execution if tracking fails
            }
        }
        
        // ✅ Track with recommendation engine (with try-catch)
        try {
            const engine = new RecommendationEngine(user.id);
            await engine.trackBehavior(productId, 'view');
        } catch (error) {
            console.error('Error tracking behavior:', error);
            // Don't stop execution if tracking fails
        }
        
        // ✅ Show notification
        showToastNotification(`Viewing: ${productName}`);

        // ✅ Open WhatsApp with seller (with validation)
        const phoneNumber = product?.phone_number;
        if (phoneNumber) {
            try {
                // Clean the phone number
                const cleanNumber = phoneNumber.toString().replace(/\D/g, '');
                
                // Validate phone number length
                if (cleanNumber.length < 9) {
                    console.warn('⚠️ Invalid phone number:', phoneNumber);
                    showToastNotification('⚠️ Seller phone number is invalid');
                    return;
                }

                // Format for Zimbabwe (263)
                let finalNumber;
                if (cleanNumber.startsWith('263')) {
                    finalNumber = cleanNumber;
                } else if (cleanNumber.startsWith('0')) {
                    finalNumber = `263${cleanNumber.substring(1)}`;
                } else {
                    finalNumber = `263${cleanNumber}`;
                }

                // Encode message
                const message = encodeURIComponent(
                    `Hi! I'm interested in your ${productName}. Is it still available?`
                );
                
                // Open WhatsApp
                const whatsappUrl = `https://wa.me/${finalNumber}?text=${message}`;
                window.open(whatsappUrl, '_blank');
                
            } catch (error) {
                console.error('Error opening WhatsApp:', error);
                showToastNotification('⚠️ Failed to open WhatsApp');
            }
        } else {
            // If no phone number, show a message
            showToastNotification('⚠️ Seller phone number not available');
        }
    };

    // In-app messaging instead of just WhatsApp
    const messagingSystem = {
    features: {
        real_time_chat: true,
        read_receipts: true,
        typing_indicator: true,
        image_sharing: true,
        quick_replies: true,
        voice_notes: true
    },
    
    setup: () => {
        // Create messages table
        // Create conversations table
        // Real-time subscription for new messages
        supabase
        .channel('messages')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
            showInAppChat(payload.new);
            playNotificationSound();
            }
        )
        .subscribe();
    }
    };

    const flashSaleSystem = {
        schedule: {
            morning_deal: '9:00 AM - 11:00 AM',
            lunch_deal: '12:00 PM - 2:00 PM',
            evening_deal: '6:00 PM - 8:00 PM',
            midnight_deal: '11:00 PM - 1:00 AM'
        },
        
        features: {
            countdown_timer: true,
            limited_quantity: true,
            exclusive_for_members: true,
            share_to_unlock: true
        }
    };

    const generateUniqueCode = (userId) => {
        return userId.slice(0, 8) + Math.random().toString(36).substring(2, 8);
    };

    const getUserIdFromCode = (referralCode) => {
        // This should decode the referral code back to user ID
        // For now, return a placeholder or implement proper decoding
        return referralCode?.slice(0, 8) || '';
    };

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
        // Add other theme logic as needed
    };

    // Make sure fetchProducts is defined or add a placeholder
    const fetchProductsForCache = async () => {
        const { data } = await supabase.from('products').select('*').limit(100);
        return data || [];
    };

    const showInAppChat = (message) => {
        console.log('New message:', message);
        showToastNotification(`New message from ${message.sender_id}`);
    };

    const referralSystem = {
        rewards: {
            referrer: {
            '1 referral': '50 points',
            '5 referrals': '100 points + Bronze badge',
            '10 referrals': '500 points + Silver badge + Free promotion',
            '50 referrals': 'Premium seller status for 1 month'
            },
            referee: {
            signup_bonus: '25 points',
            first_search: '10 points',
            first_contact: '50 points'
            }
        },
        
        generateReferralLink: () => {
            const code = generateUniqueCode(user.id);
            return `https://straun.app/ref/${code}`;
        },
        
        trackReferral: async (referralCode) => {
            // Track signups from referral links
            await supabase.from('referrals').insert([{
            referrer_id: getUserIdFromCode(referralCode),
            referred_user_id: user.id,
            status: 'pending',
            created_at: new Date()
            }]);
        }
    };

    const smartReminders = {
    types: {
        abandoned_search: "Still looking for [product]? New listings available!",
        inactive_user: "We miss you! Check out 5 new products in your area",
        review_prompt: "How was your experience with [seller]? Leave a review!",
        price_check: "Price of [product] dropped by 20% since you saved it",
        restock_alert: "Back in stock! [product] is available again"
    },
    
    scheduleReminders: () => {
        // Check user inactivity (7 days no login)
        // Check abandoned searches (searched but no contact)
        // Check wishlist items that got price drops
    }
    };

    const themeCustomization = {
    themes: {
        dark: '🌙 Dark',
        light: '☀️ Light',
        ocean: '🌊 Ocean Blue',
        sunset: '🌅 Sunset Orange',
        forest: '🌲 Forest Green'
    },
    
    accentColors: ['#4361ee', '#f72585', '#4cc9f0', '#f8961e'],
    
    fontSizes: ['Small', 'Medium', 'Large'],
    
    savePreference: (theme) => {
        localStorage.setItem('user_theme', theme);
        applyTheme(theme);
    }
    };

    // Use IndexedDB for offline storage
    const offlineSupport = {
        cacheProducts: async () => {
            const products = await fetchProducts();
            await idb.set('cached_products', products);
        },
        
        syncWhenOnline: () => {
            window.addEventListener('online', async () => {
            // Sync saved items
            const offlineActions = await idb.get('offline_actions');
            for (const action of offlineActions) {
                await syncAction(action);
            }
            });
        },
        
        offlineSearch: (query) => {
            const cached = idb.get('cached_products');
            return filterProducts(cached, query);
        }
    };

    const SocialShare = ({ product }) => {
        const shareOptions = {
            whatsapp: () => {
            const text = `Check out ${product.name} on Straun Marketing! Only $${product.price}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
            },
            
            facebook: () => {
            FB.ui({
                display: 'popup',
                method: 'share',
                href: `https://straun.app/product/${product.id}`
            });
            },
            
            twitter: () => {
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                `Just found ${product.name} on Straun Marketing! Check it out:`
            )}`);
            },
            
            copyLink: () => {
            navigator.clipboard.writeText(`https://straun.app/product/${product.id}`);
            showToast('Link copied! Share with friends');
            }
        };
        
        return (
            <div className="social-share">
            <h4>Share & Earn 50 points!</h4>
            <button onClick={shareOptions.whatsapp}>📱 WhatsApp</button>
            <button onClick={shareOptions.facebook}>📘 Facebook</button>
            <button onClick={shareOptions.twitter}>🐦 Twitter</button>
            <button onClick={shareOptions.copyLink}>🔗 Copy Link</button>
            </div>
        );
    };

    const playNotificationSound = () => {
        const soundUrl = 'https://cdn.pixabay.com/download/audio/2023/11/07/audio_f558d7e0d3.mp3';
        const audio = new Audio(soundUrl);
        audio.volume = 0.3;
             audio.play().catch(e => console.log('Audio play failed:', e));

    // Fallback to browser beep
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = ctx.createOscillator();
            oscillator.connect(ctx.destination);
            oscillator.frequency.value = 800;
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.1);
        } catch (beepErr) {
        console.log('Browser beep also failed');
        }
    };

    const fetchSavedSearches = useCallback(async () => {
        if (!user) return;
        
        try {
            const { data, error } = await supabase
                .from('saved_searches')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            
            if (!error && data) {
                setUserSavedSearches(data);
            }
        } catch (error) {
            console.error('Error fetching saved searches:', error);
        }
    }, [user]);

    const deleteSavedSearchItem = async (searchId) => {
        const { error } = await supabase
            .from('saved_searches')
            .delete()
            .eq('id', searchId);
        
        if (!error) {
            setUserSavedSearches(prev => prev.filter(s => s.id !== searchId));
            showToastNotification('✅ Saved search removed');
        }
    };

    const runSavedSearchItem = (searchTerm) => {
        setShowSavedSearches(false);
        setProductSearch(searchTerm);
        setTimeout(() => handleSearch(), 100);
    };

    const markAsRead = async (notificationId) => {
        // ✅ FIXED: Use 'is_read' NOT 'read'
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);
        
        if (!error) {
            setNotifications(prev => 
                prev.map(n => n.id === notificationId ? {...n, is_read: true} : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    const validatePhoneNumber = (phone) => {
        const clean = phone.replace(/\D/g, '');
        return clean.length >= 9 && clean.length <= 12;
    };
 
    // --- HANDLE WHATSAPP CONTACT WITH NOTIFICATIONS & GA TRACKING ---   
    const handleContact = async (targetUserId, targetPhoneNumber, targetName, type, product) => {
        // ✅ 1. Check login
        if (!user) {
            alert('Please log in to contact');
            return;
        }

        // ✅ 2. Validate phone number
        if (!targetPhoneNumber) {
            alert("This user has no phone number. We cannot connect you.");
            return;
        }

        // Clean and validate phone number
        const cleanPhone = targetPhoneNumber.toString().replace(/\D/g, '');
        if (cleanPhone.length < 9 || cleanPhone.length > 12) {
            alert("This user has an invalid phone number. We cannot connect you.");
            return;
        }

        setGlobalLoading(true);
        setGlobalLoadingMessage('Opening WhatsApp...');
        setOpeningWhatsApp(true);

         // ✅ 1. MARK AS CONTACTED FIRST (BEFORE ANYTHING ELSE)
        try {
            const contactId = targetUserId || product?.id;
            if (contactId) {
                updateContactedStatus(contactId);
            }
        } catch (markError) {
            // ✅ SILENT FAIL - Won't break WhatsApp opening
            console.warn('Failed to mark as contacted:', markError.message);
        }

        // ✅ 3. RATE LIMIT CHECK
        let isBlocked = false;
        let blockReason = '';
        let blockResetTime = 0;
        let remaining = 50;
        let total = 50;

        // ✅ SAVE SEARCH BEFORE OPENING WHATSAPP
        try {
            if (selectedMode === 'seller' && prospects.length > 0) {
                saveSearchResults(prospects, productSearch, 'seller');
            } else if (selectedMode === 'buyer' && productsFound.length > 0) {
                saveSearchResults(productsFound, productSearch, 'buyer');
            }
            console.log('💾 Search saved before opening WhatsApp');
        } catch (saveError) {
            console.warn('Could not save search before WhatsApp:', saveError.message);
        }

        // Make sure rate limiter is initialized
        if (!smartLimiterInstance) {
            initializeRateLimiter();
        }

        if (smartLimiterInstance) {
            try {
                console.log('🔍 Checking rate limit for user:', user.id);
                
                const check = await smartLimiterInstance.checkAndUpdate(user.id, 'CONTACT', {
                    targetId: targetUserId,
                    type: type,
                    product: product?.name,
                    limit: 50,
                    window: 1    
                });
                
                console.log('📊 Rate limit result:', check);
                
                // Check if rate limit is exceeded
                if (check.allowed === false) {
                    isBlocked = true;
                    blockReason = check.reason || 'Rate limit exceeded';
                    blockResetTime = check.reset_in || 60;
                    remaining = check.remaining || 0;
                    total = check.total || 50;
                } else {
                    // Allowed - update remaining count
                    remaining = check.remaining || 50;
                    total = check.total || 50;
                }
                
            } catch (limitError) {
                console.error('⚠️ Rate limiter error:', limitError);
                // Fail open - allow contact if rate limiter fails
                isBlocked = false;
            }
        } else {
            // No rate limiter - allow contact
            console.warn('⚠️ No rate limiter instance - allowing contact');
            isBlocked = false;
        }

        // ✅ 4. If blocked, show alert and STOP
        if (isBlocked === true) {
            console.log('🚫 Contact BLOCKED:', blockReason);
            alert(`⚠️ Contact blocked: ${blockReason}\n\nPlease wait ${blockResetTime} seconds before trying again.`);
            setOpeningWhatsApp(false);
            setGlobalLoading(false);
            setGlobalLoadingMessage('');
            return;
        }

        // ✅ 5. If we get here, contact is allowed - PROCEED
        console.log('✅ Contact ALLOWED - opening WhatsApp');

        // =========================================================================
        // ✅ 6. OPEN WHATSAPP - MAIN LOGIC
        // =========================================================================
        try {
            // Track behavior (isolated - won't break WhatsApp)
            try {
                if (product?.id) {
                    const engine = new RecommendationEngine(user.id);
                    await engine.trackBehavior(product.id, 'contact');
                }
            } catch (e) { 
                console.warn('Tracking failed:', e); 
            }

            // Track user activity (isolated)
            try {
                await supabase.rpc('track_user_activity', {
                    p_user_id: user.id,
                    p_activity_type: 'contact',
                    p_metadata: { targetUserId: targetUserId, type: type },
                    p_message: `User contacted ${type} about ${product?.name || 'product'}`
                });
            } catch (e) { 
                console.warn('Activity tracking failed:', e); 
            }

            // Record behavior (isolated)
            try {
                if (behaviorAnalyzerInstance) {
                    behaviorAnalyzerInstance.recordUserAction(user.id, 'contact_attempt', {
                        targetId: targetUserId,
                        contactType: type,
                        productName: product?.name
                    });
                }
            } catch (e) { 
                console.warn('Behavior record failed:', e); 
            }

            // Get current user info (isolated)
            let currentUser = null;
            let senderPhone = null;
            try {
                const { data: { user: u } } = await supabase.auth.getUser();
                currentUser = u;
                const { data: sp } = await supabase
                    .from('profiles')
                    .select('phone_number')
                    .eq('user_id', currentUser?.id)
                    .single();
                senderPhone = sp?.phone_number || null;
            } catch (e) { 
                console.warn('User profile fetch failed:', e); 
            }

            // Create notification (isolated)
            try {
                await supabase.from('notifications').insert([{
                    user_id: targetUserId,
                    sender_id: currentUser?.id,
                    product_id: product?.id,
                    buyer_phone: senderPhone,
                    product_image: product?.image_url,
                    message: type === 'seller'
                        ? `📢 New buyer interested in ${targetName}!` 
                        : `👋 Seller is reaching out about ${targetName}!`,
                    link_type: type,
                    is_read: false,
                    created_at: new Date().toISOString()
                }]);
                
                await UserActivityTracker.trackContact(
                    user.id,
                    targetUserId,
                    product?.id,
                    'whatsapp',
                    true,
                    null
                );
            } catch (e) { 
                console.warn('Notification creation failed:', e); 
            }

            // ✅ 7. CLEAN AND FORMAT PHONE NUMBER
            let finalNumber;
            if (cleanPhone.startsWith('263')) {
                finalNumber = cleanPhone;
            } else if (cleanPhone.startsWith('0')) {
                finalNumber = `263${cleanPhone.substring(1)}`;
            } else {
                finalNumber = `263${cleanPhone}`;
            }

            // ✅ 8. ENCODE MESSAGE
            const messageText = type === 'seller' 
                ? `Hi! I saw you're interested in ${targetName}. I have this available for sale. Are you interested?` 
                : `Hi! I'm interested in your ${targetName}. Is it still available?`;
            
            const encodedMessage = encodeURIComponent(messageText);

            // ✅ 9. OPEN WHATSAPP
            const whatsappUrl = `https://wa.me/${finalNumber}?text=${encodedMessage}`;
            console.log('📱 Opening WhatsApp:', whatsappUrl);
            window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

            // Track with Google Analytics (isolated)
            try {
                if (typeof ReactGA !== 'undefined') {
                    ReactGA.event({
                        category: 'Conversion',
                        action: 'WhatsApp Contact Clicked',
                        label: type
                    });
                }
            } catch (e) { 
                console.warn('GA tracking failed:', e); 
            }

            // Update limits display
            try {
                setLimits(prev => ({
                    ...prev,
                    CONTACT: { remaining: remaining, total: total }
                }));
            } catch (e) { 
                // Ignore 
            }

            // Success message
            showToastNotification(`✅ WhatsApp opened for ${targetName}`);

        } catch (error) {
            // ✅ GUARANTEED SAFETY NET: Try opening WhatsApp one more time
            console.error('CRITICAL ERROR in handleContact:', error);
            try {
                // Try opening WhatsApp with basic info
                const fallbackUrl = `https://wa.me/${finalNumber}?text=${encodeURIComponent(
                    type === 'seller' 
                        ? `Hi! I saw you're interested in ${targetName}. I have this available for sale. Are you interested?` 
                        : `Hi! I'm interested in your ${targetName}. Is it still available?`
                )}`;
                window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
            } catch (finalError) {
                console.error('Fallback WhatsApp failed:', finalError);
                alert('Failed to open WhatsApp. Please copy the phone number and try again manually.\n\nPhone: ' + finalNumber);
            }
        } finally {
            setOpeningWhatsApp(false);
            setGlobalLoading(false);
            setGlobalLoadingMessage('');
        }
    };

    const handleCall = (phoneNumber) => {
        setCalling(true);
        if (!phoneNumber) {
            alert('Phone number not available');
            setCalling(false);
            return;
        }

        const cleanNumber = phoneNumber.replace(/\D/g, '');
        if (!validatePhoneNumber(cleanNumber)) {
            alert('Invalid phone number format');
            setCalling(false);
            return;
        }
            
        try {
            window.open(`tel:${cleanNumber}`, '_self');
        } catch (error) {
            console.error('Error opening call:', error);
        } finally {
            setTimeout(() => setCalling(false), 1000);
        }
    };

    const handleShareToStatus = (product) => {
        const text = `🔥 *CHECK THIS OUT!* \n\n` +
                    `*Item:* ${product.name}\n` +
                    `*Price:* $${product.price}\n` +
                    `*Details:* ${product.description}\n\n` +
                    `Contact me here or see more on our AI App! 🚀`;

        const encodedText = encodeURIComponent(text);
        const whatsappUrl = `https://wa.me/?text=${encodedText}`;
        
        window.open(whatsappUrl, '_blank');
    };

    // ============================================
    // COMPACT FILTER DROPDOWN - MOBILE FRIENDLY
    // ============================================
    const FilterDropdown = React.memo(({ filters, setFilters, onApply, onClear, activeFilterCount }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [tempFilters, setTempFilters] = useState(filters);
        const dropdownRef = useRef(null);

        // Close dropdown when clicking outside
        useEffect(() => {
            const handleClickOutside = (event) => {
                if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                    setIsOpen(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        // Reset temp filters when opening
        useEffect(() => {
            if (isOpen) {
                setTempFilters(filters);
            }
        }, [isOpen, filters]);

        const handleApply = () => {
            setFilters(tempFilters);
            if (onApply) onApply();
            setIsOpen(false);
        };

        const handleClear = () => {
            const cleared = {
                minPrice: '',
                maxPrice: '',
                location: '',
                sortBy: 'newest'
            };
            setTempFilters(cleared);
            setFilters(cleared);
            if (onClear) onClear();
            setIsOpen(false);
        };

        return (
            <div className="filter-dropdown-wrapper" ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                {/* 🔽 FILTER BUTTON - ICON ONLY, SMALLER */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        background: isOpen ? '#667eea' : '#2d2d2d',
                        color: isOpen ? 'white' : '#e0e0e0',
                        border: isOpen ? '2px solid #667eea' : '2px solid #444',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '18px',  /* ← Increased from 18px to 24px for bigger icon */
                        transition: 'all 0.2s ease',
                        width: '38px',     /* ← Slightly wider */
                        height: '38px',    /* ← Slightly taller */
                        minWidth: '38px',
                        position: 'relative'
                    }}
                    title="Filter Products"
                >
                    <span>🔻</span>  {/* ← DOWN ARROW - bigger and more visible */}
                    {activeFilterCount > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            background: '#ff4444',
                            color: 'white',
                            borderRadius: '50%',
                            padding: '1px 6px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            minWidth: '18px',
                            textAlign: 'center',
                            lineHeight: '18px',
                            boxShadow: '0 2px 6px rgba(255,68,68,0.4)'
                        }}>
                            {activeFilterCount}
                        </span>
                    )}
                </button>

                {/* DROPDOWN CONTAINER */}
                {isOpen && (
                    <>
                        {/* Backdrop for mobile */}
                        <div 
                            onClick={() => setIsOpen(false)}
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.4)',
                                zIndex: 9998,
                                display: 'block'
                            }}
                        />
                        
                        {/* Dropdown Content - Slides from bottom on mobile */}
                        <div style={{
                            position: 'fixed',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: '#1a1a1a',
                            borderRadius: '16px 16px 0 0',
                            padding: '20px 20px 30px',
                            zIndex: 9999,
                            maxHeight: '75vh',
                            overflow: 'auto',
                            animation: 'slideUp 0.3s ease',
                            boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                            borderTop: '2px solid #333'
                        }}>
                            {/* Drag Handle */}
                            <div style={{
                                width: '40px',
                                height: '4px',
                                background: '#555',
                                borderRadius: '2px',
                                margin: '0 auto 16px',
                                cursor: 'pointer'
                            }} />

                            {/* Header */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '16px'
                            }}>
                                <h3 style={{
                                    margin: 0,
                                    color: 'white',
                                    fontSize: '18px',
                                    fontWeight: 'bold'
                                }}>
                                    ⚙️ Filter Products
                                </h3>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#999',
                                        fontSize: '22px',
                                        cursor: 'pointer',
                                        padding: '4px 8px'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Filter Options */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                
                                {/* Price Range */}
                                <div>
                                    <label style={{
                                        color: '#aaa',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        display: 'block',
                                        marginBottom: '5px'
                                    }}>
                                        💰 Price Range
                                    </label>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '8px'
                                    }}>
                                        <input
                                            type="number"
                                            placeholder="Min $"
                                            value={tempFilters.minPrice}
                                            onChange={(e) => setTempFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                                            style={{
                                                padding: '10px 12px',
                                                background: '#2d2d2d',
                                                border: '2px solid #444',
                                                borderRadius: '8px',
                                                color: 'white',
                                                fontSize: '14px',
                                                width: '100%',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                        <input
                                            type="number"
                                            placeholder="Max $"
                                            value={tempFilters.maxPrice}
                                            onChange={(e) => setTempFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                                            style={{
                                                padding: '10px 12px',
                                                background: '#2d2d2d',
                                                border: '2px solid #444',
                                                borderRadius: '8px',
                                                color: 'white',
                                                fontSize: '14px',
                                                width: '100%',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Location */}
                                <div>
                                    <label style={{
                                        color: '#aaa',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        display: 'block',
                                        marginBottom: '5px'
                                    }}>
                                        📍 Location
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="City or area"
                                        value={tempFilters.location}
                                        onChange={(e) => setTempFilters(prev => ({ ...prev, location: e.target.value }))}
                                        style={{
                                            padding: '10px 12px',
                                            background: '#2d2d2d',
                                            border: '2px solid #444',
                                            borderRadius: '8px',
                                            color: 'white',
                                            fontSize: '14px',
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                {/* Sort By */}
                                <div>
                                    <label style={{
                                        color: '#aaa',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        display: 'block',
                                        marginBottom: '5px'
                                    }}>
                                        📊 Sort By
                                    </label>
                                    <select
                                        value={tempFilters.sortBy}
                                        onChange={(e) => setTempFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                                        style={{
                                            padding: '10px 12px',
                                            background: '#2d2d2d',
                                            border: '2px solid #444',
                                            borderRadius: '8px',
                                            color: 'white',
                                            fontSize: '14px',
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            appearance: 'none',
                                            WebkitAppearance: 'none'
                                        }}
                                    >
                                        <option value="newest">🆕 Newest First</option>
                                        <option value="price_low">💰 Price: Low to High</option>
                                        <option value="price_high">💎 Price: High to Low</option>
                                    </select>
                                </div>

                                {/* Action Buttons */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 1fr',
                                    gap: '10px',
                                    marginTop: '6px'
                                }}>
                                    <button
                                        onClick={handleApply}
                                        style={{
                                            padding: '12px',
                                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '10px',
                                            fontSize: '15px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        ✅ Apply
                                    </button>
                                    <button
                                        onClick={handleClear}
                                        style={{
                                            padding: '12px',
                                            background: '#2d2d2d',
                                            color: '#e0e0e0',
                                            border: '2px solid #444',
                                            borderRadius: '10px',
                                            fontSize: '15px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        ✕ Clear
                                    </button>
                                </div>

                                {/* Active filters summary */}
                                {activeFilterCount > 0 && (
                                    <div style={{
                                        padding: '8px 12px',
                                        background: '#2d2d2d',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        color: '#888',
                                        textAlign: 'center'
                                    }}>
                                        {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* Add keyframe animation if not exists */}
                {!document.getElementById('filter-animation') && (
                    <style dangerouslySetInnerHTML={{
                        __html: `
                            @keyframes slideUp {
                                from { transform: translateY(100%); opacity: 0; }
                                to { transform: translateY(0); opacity: 1; }
                            }
                        `
                    }} />
                )}
            </div>
        );
    });

    // Fetch products with seller info     
    const fetchProducts = useCallback(async (searchTerm = '') => {
        await withLoading(async () => { 
            setProductsFetchLoading(true);
            setError(null);
            try {
                let query = supabase.from('products').select('*')

                query = applyFiltersToQuery(query, filters);
                const { data: products, error: productsError } = await query;

                if (productsError) {
                    throw new Error(`Failed to fetch products: ${productsError.message}`);
                }
                
                if (!products || products.length === 0) {
                    setItems([]);
                    setAllProducts([]);
                    return;
                }

                const sellerIds = [...new Set(products.map(p => p.seller_id).filter(id => id))];

                let sellersMap = {};
                if (sellerIds.length > 0) {
                    const { data: sellersData, error: sellersError } = await supabase
                    .from('profiles')
                    .select('user_id, username, location, phone_number, is_seller')
                    .in('user_id', sellerIds);
                    
                    // Use sellersResult.error and sellersResult.data correctly
                    if (!sellersError && sellersData) {
                        sellersMap = sellersData.reduce((map, seller) => {
                            map[seller.user_id] = seller;
                            return map;
                        }, {});
                    }
                }

                const productsWithSellers = products.map(product => ({
                    ...product,
                    seller: sellersMap[product.seller_id] || null
                }));

                setItems(productsWithSellers);
                setAllProducts(productsWithSellers);

                if (selectedMode === 'buyer') {
                    setProductsFound(productsWithSellers);
                }
                
            } catch (err) {
                console.error("❌ Error in fetchProducts:", err);
                setError(err.message || "Failed to load products. Please try again.");
            } finally {
                setProductsFetchLoading(false);
            }
        }, 'Loading products...'); // ← Message string here
    }, [user, selectedMode, filters, withLoading]); 

   // --- SAVE TO WISHLIST FUNCTION ---
    const saveToWishlist = async (item, itemType = 'product') => {
        setGlobalLoading(true);
        setGlobalLoadingMessage(`Saving ${item.name} to wishlist...`);

        const engine = new RecommendationEngine(user.id);
        await engine.trackBehavior(item.id, 'save');

        await supabase.rpc('track_user_activity', {
            p_user_id: user.id,
            p_activity_type: 'save',
            p_metadata: { itemName: item.name, itemType: itemType },
            p_message: `User saved ${item.name} to wishlist` 
        });

        // Behavior check
        if (!user) {
            alert('Please log in to save items to wishlist');
            return;
        }

        if (!smartLimiterInstance) {
            initializeRateLimiter();
        }
        
        // Check rate limit
        let check;
        try {
            check = await smartLimiterInstance.checkAndUpdate(user.id, 'SAVE_WISHLIST', {
            itemType: itemType,
            itemName: item.name
            });
            
            if (!check.allowed) {
            alert(`Save blocked: ${check.reason}`);
            return;
            }
        } catch (error) {
            console.error('Rate limit check error:', error);
            // Continue anyway if rate limiter fails
        }

        try {
            // Check if item is already in wishlist
                const { data: existing } = await supabase
                .from('saved_items')
                .select('*')
                .eq('user_id', user.id)
                .eq('item_type', itemType)
                .eq(itemType === 'product' ? 'product_id' : 'prospect_id', 
                    itemType === 'product' ? item.id : item.id)
                .single();

                if (existing) {
                alert('✅ This item is already in your wishlist!');
                return;
                }

                // Save to wishlist
                const savedData = {
                user_id: user.id,
                item_type: itemType,
                created_at: new Date().toISOString()
                };

                if (itemType === 'product') {
                savedData.product_id = item.id;
                savedData.product_name = item.name;
                savedData.product_price = item.price;
                savedData.product_image = item.image_url;
                savedData.seller_location = item.location;
                savedData.seller_phone = item.phone_number;
                } else {
                savedData.prospect_id = item.id;
                savedData.prospect_email = item.email;
                savedData.prospect_location = item.location;
                savedData.prospect_phone = item.phone_number;
                savedData.interested_in = item.interest;
                }

                // Save to database
                const { error } = await supabase
                .from('saved_items')
                .insert([savedData]);

                if (error) throw error;
                
                if (itemType === 'product') {
                try {
                    const followUpDate = new Date();
                    followUpDate.setDate(followUpDate.getDate() + 2);
                    
                    await supabase.from('follow_ups').insert([{
                    product_id: item.id,
                    user_id: user.id,
                    scheduled_for: followUpDate.toISOString(),
                    step_number: 1,
                    status: 'pending'
                    }]);

                    await UserActivityTracker.trackActivity(user.id, 'save_wishlist', {
                        targetId: item.id,
                        targetType: itemType,
                        itemName: item.name
                    });
                    
                    // CHANGED: Simple message without opening interface
                    alert('✅ Saved to wishlist! Reminder set for 2 days from now.\n\nClick "My Wishlist" button to view all saved items.');
                } catch (followUpError) {
                    console.log('Follow-up scheduling skipped');
                    // CHANGED: Simple message
                    alert('✅ Saved to wishlist!\n\nClick "My Wishlist" button to view all saved items.');
                }
                } else {
                // CHANGED: Simple message for prospects too
                alert('✅ Prospect saved to wishlist!\n\nClick "My Wishlist" button to view all saved items.');
                }
                
                // Track with Google Analytics
                if (typeof ReactGA !== 'undefined') {
                ReactGA.event({
                    category: 'Wishlist',
                    action: 'Item Added',
                    label: itemType
                });
            }
            
            // Track user behavior
            if (behaviorAnalyzerInstance) {
            behaviorAnalyzerInstance.recordUserAction(user.id, 'save_to_wishlist', {
                itemType: itemType,
                itemName: item.name
            });
            }
            
        } catch (error) {
            console.error('Error saving to wishlist:', error);
            alert('Failed to save to wishlist. Please try again.');
        
        } finally {
        setGlobalLoading(false);
        setGlobalLoadingMessage('');
    }
    };
 
    // --- CHECK FOR MATCHES FUNCTION ---
    const checkForMatches = async (userId, searchTerm = '', productData = null) => {
        try {
            const { data: currentUser } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (!currentUser) return;

            if (currentUser.is_buyer && searchTerm) {
                // Buyer searched - notify matching sellers
                const { data: matchingProducts } = await supabase
                    .from('products')
                    .select('seller_id, name')
                    .ilike('name', `%${searchTerm}%`)
                    .neq('seller_id', userId);

                if (matchingProducts && matchingProducts.length > 0) {
                    const uniqueSellers = [...new Set(matchingProducts.map(p => p.seller_id))];
                    
                    uniqueSellers.forEach(async (sellerId) => {
                        await supabase.from('notifications').insert([{
                            user_id: sellerId,
                            sender_id: userId,
                            message: `🔍 Buyer searched for "${searchTerm}" and may be interested in your products!`,
                            link_type: 'search_match',
                            is_read: false,  // ✅ FIXED
                            created_at: new Date().toISOString()
                        }]);
                    });
                }
            }

            if (currentUser.is_seller && productData) {
                // Seller listed product - notify matching buyers
                const { data: allBuyers } = await supabase
                    .from('profiles')
                    .select('user_id, interests')
                    .eq('is_buyer', true)
                    .neq('user_id', userId)
                    .eq('is_active', true);

                if (allBuyers && allBuyers.length > 0) {
                    const productNameLower = productData.name ? productData.name.toLowerCase() : '';
                    
                    allBuyers.forEach(async (buyer) => {
                        try {
                            const buyerInterests = Array.isArray(buyer.interests) 
                                ? buyer.interests 
                                : JSON.parse(buyer.interests || '[]');
                            
                            const hasMatch = buyerInterests.some(interest => 
                                interest && interest.toLowerCase().includes(productNameLower) ||
                                productNameLower.includes(interest ? interest.toLowerCase() : '')
                            );

                            if (hasMatch) {
                                // ✅ ADD THIS: Get the seller's phone number
                                const { data: sellerProfile } = await supabase
                                    .from('profiles')
                                    .select('phone_number')
                                    .eq('user_id', user.id)
                                    .single();

                                const sellerPhone = sellerProfile?.phone_number || null;

                                await supabase.from('notifications').insert([{
                                    user_id: buyer.user_id,
                                    sender_id: user.id,
                                    product_id: savedProduct.id,
                                    product_image: null,
                                    message: `🎯 New match! Seller listed "${sanitizedProduct}" that matches your interests!`,
                                    link_type: 'product_match',
                                    buyer_phone: sellerPhone,  // ✅ Add seller's phone number
                                    is_read: false,
                                    created_at: new Date().toISOString()
                                }]);
                                }
                        } catch (e) {
                            console.log('Error checking match:', e);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error checking matches:', error);
        }
    };

    // --- FIND SIMILAR PRODUCTS (UPDATED to use RecommendationEngine) ---
    const findSimilarProducts = useCallback(async (searchTerm, excludeIds = []) => {
        if (!searchTerm || searchTerm.trim().length < 2) {
            setSimilarProducts([]);
            setShowSimilarProducts(false);
            return;
        }

        setSimilarProductsLoading(true);

        try {
            const sanitizedSearch = sanitizeProductName(searchTerm);
            console.log('🔍 Searching similar products for:', searchTerm);
            
            // 🧠 STEP 2 & 4: SMART FALLBACK
            // Break the search term into words (e.g., "baby vest" -> ["baby", "vest"])
            const searchWords = sanitizedSearch.toLowerCase().split(' ').filter(w => w.length > 2);
            
            // Build an OR query to find ANY of the words in the name OR description
            let orQuery = searchWords.map(word => `name.ilike.%${word}%,description.ilike.%${word}%`).join(',');
            
            // If no valid words, just use the whole string
            if (!orQuery) {
                orQuery = `name.ilike.%${sanitizedSearch}%`;
            }

            let query = supabase
                .from('products')
                .select(`
                    id,
                    name,
                    price,
                    location,
                    description,
                    phone_number,
                    seller_id,
                    created_at,
                    image_url,
                    profiles:seller_id (
                        user_id,
                        username,
                        location,
                        phone_number,
                        is_seller,
                        is_buyer
                    )
                `)
                .or(orQuery) // ✅ Uses fuzzy matching on name OR description
                .neq('seller_id', user.id)
                .limit(20); // Fetch more to shuffle them
            
            // Exclude products
            if (excludeIds && excludeIds.length > 0) {
                query = query.not('id', 'in', `(${excludeIds.join(',')})`);
            }
            
            const { data: products, error } = await query;
            
            if (error) {
                console.error('Error in similar products query:', error);
                setSimilarProducts([]);
                setShowSimilarProducts(false);
                return;
            }
            
            if (!products || products.length === 0) {
                setSimilarProducts([]);
                setShowSimilarProducts(false);
                return;
            }
            
            // Remove duplicates
            let uniqueProducts = Array.from(
                new Map(products.map(p => [p.id, p])).values()
            );
            
            // 🎲 SHUFFLE SIMILAR PRODUCTS TOO
            uniqueProducts = uniqueProducts.sort(() => Math.random() - 0.5);
            
            const limitedProducts = uniqueProducts.slice(0, 6);
            
            console.log(`✅ Found ${limitedProducts.length} similar products for "${searchTerm}"`);
            
            setSimilarProducts(limitedProducts);
            setShowSimilarProducts(limitedProducts.length > 0);
            
        } catch (error) {
            console.error('❌ Error finding similar products:', error);
            setSimilarProducts([]);
            setShowSimilarProducts(false);
        } finally {
            setSimilarProductsLoading(false);
        }
    }, [user]);

    // Fetch user profile
    const fetchProfile = useCallback(async () => {
        if (!user?.id) {
            console.warn('[fetchProfile] No user ID available');
            return null;
        }

        try {
            const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

             if (error) {
                console.warn('[fetchProfile] Error:', error.message);
                return null;
            }

            // ✅ Safe data extraction
            setProfileData({
            location: data?.location || '',
            phone_number: data?.phone_number || '',
            username: data?.username || user?.email?.split('@')[0] || 'User',
            is_seller: data?.is_seller || false,
            is_buyer: data?.is_buyer || false,
            interests: Array.isArray(data?.interests) ? data.interests : [],
            seller_setup_completed: data?.seller_setup_completed || false,
            buyer_setup_completed: data?.buyer_setup_completed || false,
            created_at: data?.created_at || new Date().toISOString(),
            updated_at: data?.updated_at || new Date().toISOString()
            });

            return data;
            
        } catch (err) {
            console.error('[fetchProfile] Unexpected error:', err);
            return null;
        }
        }, [user]); 

    // Add toast notification function
    const showToastNotification = useCallback((message) => {
         if (message.includes('connection to notifications lost') || 
            message.includes('Connection lost')) {
            console.log('Silencing connection error notification');
            return;
        }
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 350px;
            `;
            document.body.appendChild(toastContainer);
        }

        // Create toast element
        const toastId = `toast-${Date.now()}`;
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = 'notification-toast';
        toast.innerHTML = `
            <div class="toast-content" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                gap: 12px;
                animation: slideIn 0.3s ease-out;
            ">
                <span class="toast-icon" style="font-size: 18px;">🔔</span>
                <span class="toast-message" style="flex: 1; font-size: 14px; line-height: 1.4;">
                    ${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </span>
                <button class="toast-close" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                ">×</button>
            </div>
        `;

        // Add CSS animation
        if (!document.querySelector('#toast-animation')) {
            const style = document.createElement('style');
            style.id = 'toast-animation';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        // Add to container
        toastContainer.appendChild(toast);

        // Auto remove after 5 seconds
        const autoRemoveTimer = setTimeout(() => {
            const toastEl = document.getElementById(toastId);
            if (toastEl) {
                toastEl.style.animation = 'fadeOut 0.3s ease-out forwards';
                setTimeout(() => {
                    if (toastEl.parentNode) {
                        toastEl.parentNode.removeChild(toastEl);
                    }
                }, 300);
            }
        }, 5000);

        // Close button functionality
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                clearTimeout(autoRemoveTimer);
                toast.style.animation = 'fadeOut 0.3s ease-out forwards';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            });
        }

        // Remove toast on click (optional)
        toast.addEventListener('click', (e) => {
            if (e.target !== closeBtn) {
                // Navigate to notifications if clicked
                setShowNotifications(true);
                clearTimeout(autoRemoveTimer);
                toast.style.animation = 'fadeOut 0.3s ease-out forwards';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        });

        // Clean up function for component unmount
        return () => {
            clearTimeout(autoRemoveTimer);
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        };
    }, []);

    const StatCard = ({ icon, label, value, unread }) => {
        return (
            <div className="stat-card" style={{
                background: 'white',
                borderRadius: '12px',
                padding: '15px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                flex: 1
            }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>{icon}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>{value}</div>
                <div style={{ fontSize: '14px', color: '#666' }}>{label}</div>
                {unread && (
                    <div style={{
                        background: '#ff4444',
                        color: 'white',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        fontSize: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: '5px'
                    }}>
                        {unread}
                    </div>
                )}
            </div>
        );
    };

    // Add ActivityFeed component
    const ActivityFeed = ({ events }) => {
        return (
            <div className="activity-feed" style={{
                background: 'white',
                borderRadius: '12px',
                padding: '15px',
                marginTop: '15px'
            }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Recent Activity</h4>
                {events.map((event, idx) => (
                    <div key={idx} style={{
                        padding: '8px 0',
                        borderBottom: idx < events.length - 1 ? '1px solid #e0e0e0' : 'none',
                        fontSize: '14px',
                        color: '#333'
                    }}>
                        • {event}
                    </div>
                ))}
            </div>
        );
    };

    // Add QuickActions component
    const QuickActions = ({ actions }) => {
        return (
            <div className="quick-actions" style={{
                display: 'flex',
                gap: '10px',
                marginTop: '15px'
            }}>
                {actions.map((action, idx) => (
                    <button
                        key={idx}
                        onClick={action.action}
                        style={{
                            flex: 1,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        {action.icon} {action.label}
                    </button>
                ))}
            </div>
        );
    };

    // Add Insights component
    const Insights = ({ tips }) => {
        return (
            <div className="insights" style={{
                background: '#e4e4e4',
                borderRadius: '12px',
                padding: '15px',
                marginTop: '15px'
            }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#333'}}>💡 Insights & Tips</h4>
                {tips.map((tip, idx) => (
                    <p key={idx} style={{ fontSize: '13px', color: '#333', margin: '5px 0' }}>
                        • {tip}
                    </p>
                ))}
            </div>
        );
    };

    // Clean up on component unmount
    useEffect(() => {
    return () => {
        document.body.style.overflow = '';
    };
    }, []);

    // Close menu on escape key
    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === 'Escape' && mobileMenuOpen) {
            toggleMobileMenu();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [mobileMenuOpen]);

    // Register service worker on app load - FIXED VERSION
    useEffect(() => {
        const registerServiceWorker = async () => {
            if (!('serviceWorker' in navigator)) {
            console.log('Service Worker not supported');
            return;
            }

            try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ SW registered with scope:', registration.scope);

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker?.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showToastNotification('New version available! Refresh to update.');
                }
                });
            });

            // ✅ NO permission request here. Ever.
            // If permission is already granted, silently subscribe.
            if (user && isProfileComplete && Notification.permission === 'granted') {
                setupPushNotifications(); // safe because it now checks permission itself
            }
            } catch (error) {
            console.error('❌ SW registration failed:', error);
            }
        };

        registerServiceWorker();
    }, [user, isProfileComplete]); // setupPushNotifications is stable enough for this

    // 🔔 Subscribe to push when user grants permission from Settings
    useEffect(() => {
        const handler = async () => {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try {
                    await subscribeToPush();
                } catch (e) {
                    console.warn('[Push] subscribe after settings grant failed:', e);
                }
            }
        };
        window.addEventListener('straun:notification-granted', handler);
        return () => window.removeEventListener('straun:notification-granted', handler);
    }, []);

    // ✅ Initialize search from URL when component mounts
    useEffect(() => {
        // If there's a search term in URL, update productSearch
        if (searchParams.query && searchParams.query !== productSearch) {
            setProductSearch(searchParams.query);
        }
    }, []); // Run only once on mount

    useEffect(() => {
        if (user) {
            loadReferralCount();
        }
    }, [user]);

    // Add a loading timeout guard
    useEffect(() => {
        let timeoutId;
        
        if (initialDataLoading) {
            timeoutId = setTimeout(() => {
                console.warn('⚠️ Loading taking too long, forcing stop');
                setInitialDataLoading(false);
            }, 5000); // 5 second timeout
        }
        
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [initialDataLoading]);

    // ✅ Save location on every page change
    useEffect(() => {
        if (user && selectedMode) {
            saveUserLocation();
        }
    }, [location.pathname, user, selectedMode, saveUserLocation]);

    // ✅ RESTORE LOCATION ON APP LOAD - FIXED TO PREVENT INFINITE LOOPS
    useEffect(() => {
        // ✅ GUARD: Skip for admin page
        if (location.pathname === '/admin') {
            console.log('🟢 [Location Restore] On admin page - SKIPPING');
            return;
        }

        console.log('🔵 [Location Restore] RUNNING for path:', location.pathname);
        
        // ✅ Wait for auth to finish loading
        if (authLoading) {
            console.log('[Location] Auth still loading, waiting...');
            return;
        }
        
        if (!user || !user.id) {
            console.log('[Location] No user, skipping');
            return;
        }
        
        // ✅ If mode is null, show mode selection
        if (!selectedMode) {
            console.log('⏰ Mode is null - showing mode selection');
            setMode(null);
            setIsProfileComplete(false);
            setShowSellerDecision(false);
            setShowBuyerDecision(false);
            
            const storageKey = `straun_userLocation_${user.id}`;
            localStorage.removeItem(storageKey);
            
            if (location.pathname !== '/' && location.pathname !== '/app') {
                console.log('[Location] Navigating to home for mode selection');
                navigate('/');
            }
            return;
        }
        
        // ✅ CRITICAL FIX: If we're already on /app or /, DON'T redirect
        const isAppOrRoot = location.pathname === '/app' || location.pathname === '/';
        
        // ✅ If mode exists, try to restore location
        const storageKey = `straun_userLocation_${user.id}`;
        const saved = localStorage.getItem(storageKey);
        
        if (saved) {
            try {
                const data = JSON.parse(saved);
                console.log('🔵 [Location Restore] Found saved location:', data);
                
                const ONE_HOUR = 60 * 60 * 1000;
                const isAdminUser = user.email === 'deonmahachi8@gmail.com';
                const isExpired = Date.now() - data.timestamp >= ONE_HOUR;
                
                if (isAdminUser || !isExpired) {
                    console.log('🔄 Found valid saved location for user:', user.id, isAdminUser ? '(Admin - no expiry)' : '');
                    
                    // ✅ FIX: Only redirect if:
                    // 1. Saved path exists
                    // 2. Saved path is NOT the current path
                    // 3. Saved path is NOT '/' or '/app' (to avoid loop)
                    // 4. Saved path is NOT '/admin' (admin handled separately)
                    const savedPath = data.path;
                    const currentPath = location.pathname;
                    
                    if (savedPath && 
                        savedPath !== currentPath && 
                        savedPath !== '/app' && 
                        savedPath !== '/' && 
                        savedPath !== '/admin') {
                        
                        console.log('🔴 [Location Restore] WILL REDIRECT to:', savedPath);
                        setTimeout(() => {
                            navigate(savedPath);
                        }, 100);
                    } else {
                        // ✅ If we're already on /app or /, just stay
                        console.log('🟢 [Location Restore] Already on correct page - NO REDIRECT');
                    }
                } else {
                    localStorage.removeItem(storageKey);
                    console.log('⏰ Location expired for regular user');
                }
            } catch (e) {
                console.error('Error restoring location:', e);
                localStorage.removeItem(storageKey);
            }
        } else {
            console.log('🔵 [Location Restore] No saved location found');
        }
    }, [user, selectedMode, setMode, navigate, location.pathname, authLoading]);

    // ⏰ MODE EXPIRY TIMER - Console logging for debugging
    useEffect(() => {
        if (!user) return;
        
        // Log expiry info immediately
        const logExpiryInfo = () => {
            if (authLoading) return;
            
            const expiryInfo = getModeExpiryInfo ? getModeExpiryInfo() : null;
            
            if (!expiryInfo) {
            console.log('⏰ [Expiry] No expiry info available');
            return;
            }
            
            if (expiryInfo.isAdmin) {
            console.log('👑 [Expiry] Admin mode - NEVER expires');
            return;
            }
            
            if (!selectedMode) {
            console.log('⏰ [Expiry] No mode selected - showing mode selection');
            return;
            }
            
            const status = expiryInfo.isExpired ? '❌ EXPIRED' : '✅ Active';
            const timeLeft = expiryInfo.timeRemaining;
            const expiresAt = expiryInfo.expiresAt;
            
            console.log(`⏰ [Expiry] Mode: ${selectedMode.toUpperCase()} | Status: ${status} | Time remaining: ${timeLeft} | Expires at: ${expiresAt}`);
            
            // ⚠️ Warning if less than 5 minutes left
            if (!expiryInfo.isExpired && expiryInfo.timeRemainingMs < 300000) {
            console.warn(`⚠️ [Expiry] LESS THAN 5 MINUTES LEFT! ${timeLeft} remaining`);
            }
        };
        
        // Log immediately
        logExpiryInfo();
        
        // Log every 30 seconds
        const intervalId = setInterval(() => {
            logExpiryInfo();
        }, 30000); // 30 seconds
        
        // Log every minute with a different message
        const minuteInterval = setInterval(() => {
            if (selectedMode) {
            const expiryInfo = getModeExpiryInfo ? getModeExpiryInfo() : null;
            if (expiryInfo && !expiryInfo.isExpired) {
                console.log(`⏰ [Expiry] Still active - ${expiryInfo.timeRemaining} remaining`);
            }
            }
        }, 60000); // 1 minute
        
        return () => {
            clearInterval(intervalId);
            clearInterval(minuteInterval);
        };
    }, [user, selectedMode, getModeExpiryInfo, authLoading]);

    // ✅ Update search when URL changes (back/forward navigation)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const urlQuery = params.get('q') || '';
        const urlPage = parseInt(params.get('page')) || 1;
        const urlCategory = params.get('category') || '';
        const urlSort = params.get('sort') || 'recent';
        
        if (urlQuery !== productSearch || 
            urlCategory !== searchParams.category ||
            urlSort !== searchParams.sort ||
            urlPage !== searchParams.page) {
            
            setProductSearch(urlQuery);
            setSearchParams({
                query: urlQuery,
                category: urlCategory,
                sort: urlSort,
                page: urlPage
            });
        }
    }, [location.search]); 

    useEffect(() => {
    // Apply to scrollable containers
    const scrollableElements = document.querySelectorAll('.scrollable-container, .products-grid, .prospects-grid');
    
        scrollableElements.forEach(element => {
            const release = fscrub(element, {
            onMove() {
                // Let the browser handle scrolling naturally
                // This just ensures touch events are captured properly
            },
            onStart() {
                // Optional: track touch start
            },
            onEnd() {
                // Optional: track touch end
            }
            }, {
            mouse: false,
            touch: true,
            hover: false
            });
            
            // Store release functions for cleanup
            return () => release();
        });
    }, []);

    useEffect(() => {
        const loadLimits = async () => {
            if (!user) return;
            
            try {
                // ✅ Use .maybeSingle() with proper error handling
                const { data: contactRecord, error } = await supabase
                    .from('rate_limits')
                    .select('attempts')
                    .eq('user_id', user.id)
                    .eq('action', 'CONTACT')
                    .maybeSingle();
                
                // ✅ Handle the error gracefully
                if (error) {
                    // If it's a 400 or 404, just log and continue (no record exists)
                    if (error.code === 'PGRST116' || error.message?.includes('JSON object requested')) {
                        console.log('No rate limit record found for CONTACT action');
                        // ✅ Set default limits
                        setLimits(prev => ({
                            ...prev,
                            CONTACT: { remaining: 50, total: 50 }
                        }));
                        return;
                    }
                    console.warn('Error loading rate limits:', error.message);
                    return;
                }
                
                if (contactRecord) {
                    const limit = 50;
                    const attempts = contactRecord.attempts || 0;
                    setLimits(prev => ({
                        ...prev,
                        CONTACT: {
                            remaining: Math.max(0, limit - attempts),
                            total: limit
                        }
                    }));
                } else {
                    // ✅ No record exists, set default
                    setLimits(prev => ({
                        ...prev,
                        CONTACT: { remaining: 50, total: 50 }
                    }));
                }
            } catch (error) {
                console.warn('Rate limits not available:', error.message);
                // ✅ Don't show error to user - set defaults
                setLimits(prev => ({
                    ...prev,
                    CONTACT: { remaining: 50, total: 50 }
                }));
            }
        };
        
        loadLimits();
    }, [user]);

   // ✅ Update URL when search changes
    useEffect(() => {
        if (!isProfileComplete) return;
        
        const params = new URLSearchParams();
        const hasSearch = productSearch.trim() !== '';
        
        if (hasSearch) params.set('q', productSearch);
        if (searchParams.category) params.set('category', searchParams.category);
        if (searchParams.sort !== 'recent') params.set('sort', searchParams.sort);
        if (searchParams.page > 1) params.set('page', searchParams.page.toString());
        
        const currentParams = new URLSearchParams(location.search);
        const currentQuery = currentParams.get('q') || '';
        
        // Only update if something actually changed
        if (currentQuery !== productSearch || 
            currentParams.get('category') !== searchParams.category ||
            currentParams.get('sort') !== searchParams.sort ||
            currentParams.get('page') !== (searchParams.page > 1 ? searchParams.page.toString() : null)) {
            
            // Use replaceState to avoid adding to history
            window.history.replaceState({}, '', `${location.pathname}${hasSearch ? '?' + params.toString() : ''}`);
        }
    }, [productSearch, searchParams, location.pathname, location.search, isProfileComplete]);

    // 🔥 REPLACE BOTH OF YOUR USEEFFECTS WITH THIS SINGLE ONE:
        // ✅ Handle browser back/forward buttons for Wishlist
    useEffect(() => {
        const handlePopState = (event) => {
            // If the URL hash is no longer #wishlist, close the modal
            if (window.location.hash !== '#wishlist' && showWishlist) {
                setShowWishlist(false);
                
                // Restore previous search state if it exists
                if (previousSearchState.productSearch !== undefined) {
                    setProductSearch(previousSearchState.productSearch);
                    setProspects(previousSearchState.prospects);
                    setProductsFound(previousSearchState.productsFound);
                    setSearchLoading(previousSearchState.searchLoading);
                }
            }
        };
        
        window.addEventListener('popstate', handlePopState);
        
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [showWishlist, previousSearchState]);

    // Combined useEffect for initial data load
    useEffect(() => {
        // Only fetch if we haven't fetched before AND user exists AND no profile data
        if (user && !profileData && !profileFetchedRef.current) {
            profileFetchedRef.current = true; // ✅ Prevent duplicate fetches
            setInitialDataLoading(true);
            fetchProfile().finally(() => {
                setInitialDataLoading(false);
            });
        }
    }, [user, profileData]); // ✅ Only runs when user or profileData changes

    // ✅ Handle returning from notification detail page
    useEffect(() => {
        // Check if we're returning from a notification
        if (location.state?.returnFromNotification) {
            console.log('🔄 Returning from notification detail');
            
            // ✅ Clear the state so it doesn't trigger again
            window.history.replaceState({}, document.title);
            
            // ✅ Refresh notifications if needed
            fetchNotifications();
            
            // ✅ Show a toast notification
            showToastNotification('🔔 Back to Social page');
        }
    }, [location.state, fetchNotifications, showToastNotification]);

    useEffect(() => {
        if (user) {
            fetchNotifications();
        }
    }, [user, fetchNotifications]);

    useEffect(() => {
        setIsNavCollapsed(prospects.length > 0 || productsFound.length > 0);
    }, [prospects, productsFound]);

    const toggleNavCollapse = () => {
        setIsNavCollapsed(!isNavCollapsed);
    };

    useEffect(() => {
        // Track initial page view
        if (user && isProfileComplete) {
            UserActivityTracker.trackActivity(user.id, 'page_view', {
            page: selectedMode === 'seller' ? 'seller_dashboard' : 'buyer_marketplace'
            });
        }
    }, [user, isProfileComplete, selectedMode]);

    // Auto-hide safety warning after 5 seconds
    useEffect(() => {
        if (showSafetyWarning) {
            const timer = setTimeout(() => {
                setShowSafetyWarning(false);
            }, 5000); // 5 seconds
            
            return () => clearTimeout(timer);
        }
    }, [showSafetyWarning]);

    // Add this useEffect to check admin status
    useEffect(() => {
        const checkAdminStatus = async () => {
            if (!user) {
                setIsAdmin(false);
                return;
            }
            
            try {
                // ✅ Check multiple ways to determine admin
                const email = user.email?.toLowerCase();
                const isAdminUser = email === 'deonmahachi8@gmail.com';
                
                // Also check user metadata
                const isAdminFromMetadata = user.user_metadata?.is_admin === true || 
                                        user.app_metadata?.is_admin === true;
                
                const adminStatus = isAdminUser || isAdminFromMetadata;
                
                console.log('👑 Admin check - Email:', email);
                console.log('👑 Admin check - Result:', adminStatus);
                console.log('👑 Admin check - User object:', user);
                
                setIsAdmin(adminStatus);
                
                if (adminStatus) {
                    console.log('✅ Admin user confirmed:', user.email);
                }
            } catch (error) {
                console.error('Error checking admin status:', error);
                setIsAdmin(false);
            }
        };
        
        if (user) {
            checkAdminStatus();
        } else {
            setIsAdmin(false);
        }
    }, [user]);

    // Detect if running on Vercel (serverless environment)
    const isVercel = import.meta.env.PROD && typeof window !== 'undefined';

    const handleSkipForNow = async () => {
        if (!navigator.onLine) {
            setError('You are offline. Please connect to the internet to continue.');
            return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
            const { data: userData, error: userError } = await fetchWithRetry(() =>
                supabase.auth.getUser()
            );
            
            if (userError) {
                setError('Please log in to continue');
                setLoading(false);
                return;
            }
            
            const user = userData?.user;
            
            if (!user) {
                setError('User not found. Please log in again.');
                setLoading(false);
                return;
            }
            
            const hasLocation = profileData?.location && profileData.location.trim() !== '';
            const hasPhone = profileData?.phone_number && profileData.phone_number.trim() !== '';
            
            if (!hasLocation || !hasPhone) {
                setTempLocation(profileData?.location || '');
                setTempPhone(profileData?.phone_number || '');
                setShowLocationModal(true);
                setLoading(false);
                return;
            }
            
            const { error: updateError } = await fetchWithRetry(() =>
                supabase
                    .from('profiles')
                    .update({
                        is_buyer: true,
                        buyer_setup_completed: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', user.id)
            );
            
            if (updateError) {
                setError('Failed to update profile. Please try again.');
                setLoading(false);
                return;
            }
            
            setLoading(false);
            navigate('/app');
            
        } catch (err) {
            console.error('[BuyerDecision] Skip error:', err);
            setError('Failed to skip. Please try again.');
            setLoading(false);
        }
    };

    const saveLocationAndPhone = async () => {
        if (!navigator.onLine) {
            setError('You are offline. Please connect to the internet to save your information.');
            return;
        }
        
        if (!tempLocation.trim()) {
            setError('Please enter your location');
            return;
        }
        if (!tempPhone.trim()) {
            setError('Please enter your phone number');
            return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
            const { data: userData, error: userError } = await fetchWithRetry(() =>
                supabase.auth.getUser()
            );
            
            if (userError) {
                setError('Please log in to continue');
                setLoading(false);
                return;
            }
            
            const user = userData?.user;
            
            if (!user) {
                setError('User not found. Please log in again.');
                setLoading(false);
                return;
            }
            
            const { error: updateError } = await fetchWithRetry(() =>
                supabase
                    .from('profiles')
                    .update({
                        location: tempLocation.trim(),
                        phone_number: tempPhone.trim(),
                        is_buyer: true,
                        buyer_setup_completed: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', user.id)
            );
            
            if (updateError) {
                console.error('[BuyerDecision] Save error:', updateError);
                setError('Failed to save information. Please try again.');
                setLoading(false);
                return;
            }
            
            setShowLocationModal(false);
            navigate('/app');
            
        } catch (err) {
            console.error('[BuyerDecision] Save error:', err);
            setError('Failed to save information. Please check your connection.');
            setLoading(false);
        }
    };

    useEffect(() => {
        // After 1.5 seconds, mark as no longer fresh
        // This gives time for the "restore from visibility change" to not trigger
        const timer = setTimeout(() => {
            isFreshLoadRef.current = false;
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    // 🔄 RESTORE SEARCH ON PAGE LOAD - IMPROVED VERSION (ERROR-PROOF)
    useEffect(() => {
        // ✅ GUARD: Must have user, profile complete, and not already restored
        if (!user || !isProfileComplete || restoredSearch) {
            return;
        }

        // ✅ Wait for auth to load
        if (authLoading) {
            console.log('[Search Restore] Auth still loading...');
            return;
        }

        // ✅ Only restore when page is visible (returning from WhatsApp)
        if (document.visibilityState !== 'visible') {
            console.log('[Search Restore] Page not visible, waiting...');
            return;
        }

        if (isFreshLoadRef.current) {
            console.log('[Search Restore] Fresh load detected — skipping restore, clearing old search');
            
            // ✅ Also clear productSearch + results so refresh is truly fresh
            setProductSearch('');
            setProductsFound([]);
            setProspects([]);
            
            // ✅ Clear localStorage for this user's last search
            try {
                const key = getSearchStorageKey();
                if (key) localStorage.removeItem(key);
            } catch (e) {}
            
            return;
        }

        try {
            const savedData = loadSearchResults();
            if (!savedData) {
                console.log('[Search Restore] No saved data found');
                return;
            }

            // ✅ GUARD: Mode must match
            if (savedData.mode !== selectedMode) {
                console.log('🔄 Mode mismatch, not restoring');
                return;
            }

            // ✅ GUARD: Results must be valid array
            if (!savedData.results || !Array.isArray(savedData.results) || savedData.results.length === 0) {
                console.log('⚠️ No results to restore');
                return;
            }

            console.log('🔄 Restoring search results...', savedData.results.length, 'items');
            
            // ✅ Restore data based on mode
            if (selectedMode === 'seller') {
                setProspects(savedData.results);
            } else {
                setProductsFound(savedData.results);
            }
            
            // ✅ Restore search term
            if (savedData.searchTerm) {
                setProductSearch(savedData.searchTerm);
            }
            
            // ✅ Restore contacted IDs
            if (savedData.contactedIds && Array.isArray(savedData.contactedIds)) {
                setContactedIds(savedData.contactedIds);
            }
            
            // ✅ Restore page and scroll state
            if (savedData.page !== undefined) {
                setCurrentPage(savedData.page || 0);
            }
            if (savedData.hasMore !== undefined) {
                setHasMore(savedData.hasMore);
            }
            
            // ✅ Restore session ID
            if (savedData.sessionId) {
                setSearchSessionId(savedData.sessionId);
            }
            
            setRestoredSearch(true);
            
            // ✅ Show subtle notification
            const count = savedData.results.length;
            const elapsed = Math.round((Date.now() - savedData.timestamp) / 1000);
            const timeStr = elapsed < 60 ? `${elapsed} seconds` : `${Math.round(elapsed / 60)} minutes`;
            showToastNotification(`🔄 Restored ${count} results from ${timeStr} ago`);

            // ✅ Scroll to results section
            setTimeout(() => {
                const resultsSection = document.querySelector('.results-section');
                if (resultsSection) {
                    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 300);

        } catch (restoreError) {
            console.warn('Search restore failed:', restoreError.message);
            // Clear corrupted data
            try {
                const key = getSearchStorageKey();
                if (key) localStorage.removeItem(key);
            } catch (e) {}
        }
    }, [user, isProfileComplete, selectedMode, restoredSearch, authLoading]);

    // ⏰ STRONG SEARCH EXPIRY CHECK - Clears old data immediately
    useEffect(() => {
        if (!user?.id || !restoredSearch) return;

        const checkExpiry = () => {
            try {
            const key = getSearchStorageKey();
            if (!key) return;
            
            const raw = localStorage.getItem(key);
            if (!raw) {
                setRestoredSearch(false);
                return;
            }
            
            const data = JSON.parse(raw);
            
            // ✅ Check if data is valid
            if (!data || !data.results || !Array.isArray(data.results)) {
                console.log('⚠️ Invalid search data, clearing');
                localStorage.removeItem(key);
                setRestoredSearch(false);
                return;
            }
            
            const age = Date.now() - data.timestamp;
            
            // ✅ Expire after 20 minutes
            if (age > SEARCH_EXPIRY_MS) {
                console.log(`⏰ Search EXPIRED after ${Math.round(age / 60000)} minutes`);
                localStorage.removeItem(key);
                setSearchExpired(true);
                setRestoredSearch(false);
                
                // Clear results
                if (selectedMode === 'seller') {
                setProspects([]);
                } else {
                setProductsFound([]);
                }
                
                showToastNotification('⏰ Search results expired after 20 minutes');
            } else {
                // ✅ Log remaining time
                const remainingMs = SEARCH_EXPIRY_MS - age;
                const remainingMinutes = Math.round(remainingMs / 60000);
                console.log(`⏰ Search expires in ${remainingMinutes} minutes`);
            }
            } catch (e) {
            console.warn('Expiry check failed:', e.message);
            }
        };

        // Check immediately
        checkExpiry();

        // Check every 15 seconds (more frequent)
        const interval = setInterval(checkExpiry, 15000);

        return () => clearInterval(interval);
    }, [user, restoredSearch, selectedMode, showToastNotification]);

    // 💾 SAVE SEARCH WHEN USER LEAVES THE PAGE
    useEffect(() => {
        if (!user || !isProfileComplete) return;

        const handleVisibilityChange = () => {
            // When user leaves the page (goes to WhatsApp, switches tabs, etc.)
            if (document.visibilityState === 'hidden') {
                // Save current search results if any
                if (selectedMode === 'seller' && prospects.length > 0) {
                    saveSearchResults(prospects, productSearch, 'seller');
                } else if (selectedMode === 'buyer' && productsFound.length > 0) {
                    saveSearchResults(productsFound, productSearch, 'buyer');
                }
                console.log('💾 Search saved on page hide');
            }
            
            // When user comes back to the page
            if (document.visibilityState === 'visible') {
                if (!restoredSearch) {
                    // Try to restore search results
                    const savedData = loadSearchResults();
                    if (savedData && savedData.results && savedData.results.length > 0) {
                        console.log('🔄 Restoring search on visibility change');
                        if (selectedMode === 'seller') {
                            setProspects(savedData.results);
                        } else {
                            setProductsFound(savedData.results);
                        }
                        if (savedData.searchTerm) {
                            setProductSearch(savedData.searchTerm);
                        }
                        setRestoredSearch(true);
                        showToastNotification(`🔄 Restored ${savedData.results.length} results`);
                    }
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, isProfileComplete, selectedMode, prospects, productsFound, productSearch, restoredSearch]);

    // COMPLETE FIXED NOTIFICATION useEffect
    useEffect(() => {
        // ✅ CHECK: Wait for auth to be ready
        if (authLoading) {
            console.log('[Notifications] Auth still loading, waiting...');
            return;
        }

        // ✅ CHECK: Must have user with ID
        if (!user || !user.id) {
            console.log('[Notifications] No user found for notification subscription');
            return;
        }

        // ✅ CHECK: Must be authenticated
        if (!isAuthenticated) {
            console.log('[Notifications] User not authenticated, skipping subscription');
            return;
        }

        console.log('[Notifications] ✅ Setting up for user:', user.id);

        let notificationSubscription = null;
        let pollingInterval = null;
        let reconnectTimeout = null;
        let retryCount = 0;
        let lastCheckedTime = new Date().toISOString();
        let isPolling = false;
        let mounted = true;
        const MAX_RETRIES = 3;
        const BASE_RETRY_DELAY = 1000;

        // ========== POLLING FUNCTION (Fallback) ==========
        const checkForNewNotifications = async () => {
            if (isPolling || !mounted) return;
            isPolling = true;
            
            try {
                const { data: newNotifications, error } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_id', user.id)
                    .gt('created_at', lastCheckedTime)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('[Notifications] Polling error:', error);
                    return;
                }

                if (newNotifications && newNotifications.length > 0) {
                    lastCheckedTime = new Date().toISOString();
                    
                    newNotifications.forEach(notification => {
                        if (notification.message) {
                            playNotificationSound();
                            showToastNotification(notification.message);
                        }
                    });
                    
                    fetchNotifications();
                }
            } catch (error) {
                console.error('[Notifications] Error polling:', error);
            } finally {
                isPolling = false;
            }
        };

        // ========== REALTIME WEBSOCKET FUNCTION ==========
        const connectToNotifications = async () => {
            if (!mounted) return;
            
            try {
                if (notificationSubscription) {
                    await supabase.removeChannel(notificationSubscription);
                    notificationSubscription = null;
                }

                // ✅ FIX 1: Add a random string to the channel name to make it unique every time
                const uniqueChannelName = `notifications-${user.id}-${Math.random().toString(36).substring(7)}`;

                notificationSubscription = supabase
                    .channel(uniqueChannelName) 
                    .on(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'notifications',
                            filter: `user_id=eq.${user.id}`
                        },
                        async (payload) => {
                            if (!mounted) return;
                            if (!payload.new || !payload.new.message) return;
                            
                            console.log('[Notifications] New notification:', payload.new.message);
                            playNotificationSound();
                            showToastNotification(payload.new.message);
                            await fetchNotifications();
                        }
                    )
                    .on('system', { event: 'disconnect' }, () => {
                        if (!mounted) return;
                        console.log('[Notifications] ⚠️ WebSocket disconnected, switching to polling');
                        startPolling();
                    })
                    .subscribe((status, error) => {
                        if (!mounted) return;
                        
                        if (status === 'SUBSCRIBED') {
                            console.log('[Notifications] ✅ Realtime WebSocket connected');
                            retryCount = 0;
                            // Stop polling if WebSocket works
                            if (pollingInterval) {
                                clearInterval(pollingInterval);
                                pollingInterval = null;
                            }
                        }
                        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                            console.log('[Notifications] ⚠️ WebSocket failed, using polling mode');
                            startPolling();
                        }
                    });

            } catch (error) {
                console.error('[Notifications] WebSocket connection error:', error);
                if (mounted) {
                    startPolling();
                }
            }
        };

        // ========== START POLLING ==========
        const startPolling = () => {
            if (pollingInterval || !mounted) return;
            console.log('[Notifications] 📡 Using polling mode (checks every 10 seconds)');
            
            // Check immediately
            checkForNewNotifications();
            
            // Set up interval
            pollingInterval = setInterval(() => {
                if (document.visibilityState === 'visible') checkForNewNotifications();
            }, 15000);
        };

        // ========== STOP POLLING ==========
        const stopPolling = () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
        };

        // ========== START REALTIME (with fallback) ==========
        const startRealtime = () => {
            if (!mounted) return;
            
            // Always try WebSocket first
            connectToNotifications();
            
            // Set a timeout - if WebSocket doesn't connect in 5 seconds, use polling
            const timeoutId = setTimeout(() => {
                if (mounted && (!notificationSubscription || notificationSubscription.state !== 'joined')) {
                    console.log('[Notifications] WebSocket connection timeout, using polling');
                    startPolling();
                }
            }, 5000);
            
            return () => {
                if (timeoutId) clearTimeout(timeoutId);
            };
        };

        // ========== INITIALIZE ==========
        const cleanupTimeout = startRealtime();

        // ========== CLEANUP ==========
        return () => {
            mounted = false;
            if (cleanupTimeout) cleanupTimeout();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            if (notificationSubscription) {
                supabase.removeChannel(notificationSubscription);
                notificationSubscription = null;
            }
            stopPolling();
        };
        
    }, [user, isAuthenticated, authLoading, fetchNotifications, showToastNotification]);

    useEffect(() => {
        if (showSettings) {
            document.body.classList.add('modal-open');
            // Prevent scrolling
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
        } else {
            document.body.classList.remove('modal-open');
            // Re-enable scrolling
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        }
        
        return () => {
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        };
    }, [showSettings]);

    // 🔔 Interest Reminder for Buyers - Shows POPUP after 3 searches
    useEffect(() => {
        // Only for buyers who have completed setup
        if (selectedMode !== 'buyer' || !isProfileComplete || !user || !profileData) return;
        
        // Check if user has interests
        const hasInterests = profileData.interests && profileData.interests.length > 0;
        
        // If they already have interests, no reminder needed
        if (hasInterests) return;
        
        // Check if popup was already shown or action was taken
        const actionKey = `interest_popup_action_${user.id}`;
        const actionTaken = localStorage.getItem(actionKey);
        
        if (actionTaken) {
            console.log('⏰ Interest popup already shown to this user');
            return;
        }
        
        // Check search count
        const searchCount = parseInt(sessionStorage.getItem('buyerSearchCount') || '0');
        
        // Show popup after 3 searches
        if (searchCount >= 3) {
            console.log('🔔 Showing interest popup after 3 searches');
            setShowInterestPopup(true);
            // Don't save yet - wait for user action
        }
    }, [selectedMode, isProfileComplete, profileData, user, showToastNotification]);

    // --- CHECK EXISTING PROFILE DATA ---
    useEffect(() => {
        const checkExistingProfile = async () => {
            if (!user) {
                setProfileData(null);
                return;
            }
            
            try {
                const { data, error: fetchError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (data) {
                    setProfileData(data);
                } else {
                    setProfileData(null);
                }
            } catch (err) {
                console.error('Profile check error:', err);
                setProfileData(null);
            } 
        };

        if (user) {
            checkExistingProfile();
        }
    }, [user]);

    useEffect(() => {
        const cacheKeys = Object.keys(searchCache);
        if (cacheKeys.length > 10) { // Keep only last 20 searches
            const oldestKey = cacheKeys[0];
            setSearchCache(prev => {
                const newCache = { ...prev };
                delete newCache[oldestKey];
                return newCache;
            });
        }
    }, [searchCache]);

    // PWA Install Prompt Logic
    useEffect(() => {
        // Listen for the beforeinstallprompt event
        const handleBeforeInstallPrompt = (e) => {
            // Prevent Chrome's automatic prompt
            e.preventDefault();
            // Store the event for later use
            setDeferredPrompt(e);
        };

        // Check if already installed
        const checkIfAlreadyInstalled = () => {
            if (window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone === true) {
            console.log('App already installed');
            return true;
            }
            return false;
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Clean up
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    // 🔔 REAL-TIME SEARCH ALERT MONITORING
    useEffect(() => {
        if (!user || !isProfileComplete || selectedMode !== 'buyer') return;

        const alertChannel = supabase
            .channel('search-alert-monitoring')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'products',
                    filter: `seller_id=neq.${user.id}`
                },
                async (payload) => {
                    try {
                        const newProduct = payload.new;
                        
                        // ✅ CHANGE: Get user's active search alerts with supabase
                        const result = await supabase
                            .from('search_alerts')
                            .select('*')
                            .eq('user_id', user.id)
                            .eq('is_active', true);

                        // Check for error
                        if (result.error) {
                            console.error('Failed to fetch alerts:', result.error);
                            return;
                        }

                        const userAlerts = result.data;
                        if (!userAlerts || userAlerts.length === 0) return;

                        const productNameLower = newProduct.name ? newProduct.name.toLowerCase() : '';
                        const productLocation = newProduct.location || '';
                        
                        // Check each alert
                        for (const alert of userAlerts) {
                            const alertTermLower = alert.search_term ? alert.search_term.toLowerCase() : '';
                            
                            // Check if product matches search term
                            const termMatch = productNameLower.includes(alertTermLower) || 
                                            alertTermLower.includes(productNameLower);
                            
                            if (!termMatch) continue;
                            
                            // Check price range if specified
                            if (alert.min_price !== null && newProduct.price < alert.min_price) continue;
                            if (alert.max_price !== null && newProduct.price > alert.max_price) continue;
                            
                            // Check location if specified
                            if (alert.location && productLocation) {
                                const alertLocationLower = alert.location.toLowerCase();
                                const productLocationLower = productLocation.toLowerCase();
                                
                                if (!productLocationLower.includes(alertLocationLower) && 
                                    !alertLocationLower.includes(productLocationLower)) {
                                    continue;
                                }
                            }
                            
                            const notifResult = await supabase.from('notifications').insert([{
                                user_id: user.id,
                                sender_id: newProduct.seller_id,
                                product_id: newProduct.id,
                                product_image: newProduct.image_url,
                                message: `🚨 ALERT MATCH! New "${newProduct.name}" ($${newProduct.price}) matches your saved search "${alert.search_term}"!`,
                                link_type: 'search_alert_match',
                                is_read: false,  // ✅ FIXED
                                created_at: new Date().toISOString()
                            }]);
                            
                            if (notifResult.error) {
                                console.error('Failed to send notification:', notifResult.error);
                            }
                            
                            // ✅ CHANGE: Update last notified time
                            const updateResult = await supabase
                                .from('search_alerts')
                                .update({ last_notified_at: new Date().toISOString() })
                                .eq('id', alert.id);
                            
                            if (updateResult.error) {
                                console.error('Failed to update alert:', updateResult.error);
                            }
                            
                            console.log(`✅ Alert notification sent for: ${alert.search_term}`);
                        }
                        
                    } catch (error) {
                        console.error('Error in search alert monitoring:', error);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(alertChannel);
        };
    }, [user, isProfileComplete, selectedMode]);

    // 🔔 REAL-TIME MATCH DETECTION: Listen for new products and notify matching buyers
    useEffect(() => {
        if (!user || !isProfileComplete || selectedMode !== 'buyer') return;

        const productMatchChannel = supabase
            .channel('real-time-product-matches')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'products',
                    filter: `seller_id=neq.${user.id}`
                },
                async (payload) => {
                    try {
                        const newProduct = payload.new;
                        if (!newProduct || !newProduct.name) {
                            console.warn('Invalid product data:', newProduct);
                            return;
                        }
                        
                        // ✅ CHANGE: Get current user's interests with supabase
                        const { data: currentProfile, error: profileError } = await supabase
                            .from('profiles')
                            .select('interests')
                            .eq('user_id', user.id)
                            .maybeSingle();
                        
                        if (profileError) {
                            console.error('Failed to fetch profile:', profileError);
                            return;
                        }

                        if (!currentProfile?.interests) return;
                        
                        let userInterests = [];
                        if (Array.isArray(currentProfile.interests)) {
                            userInterests = currentProfile.interests;
                        } else if (typeof currentProfile.interests === 'string') {
                            try {
                                userInterests = JSON.parse(currentProfile.interests);
                            } catch (e) {
                                userInterests = [currentProfile.interests];
                            }
                        }
                        
                        const productNameLower = newProduct.name ? newProduct.name.toLowerCase() : '';
                        
                        // Check for match
                        const hasMatch = userInterests.some(interest => {
                            if (!interest) return false;
                            const interestLower = interest.toLowerCase();
                            return interestLower.includes(productNameLower) || 
                                productNameLower.includes(interestLower) ||
                                getWordVariations(productNameLower || '').some(variation =>
                                    interestLower.includes(variation)
                                );
                        });
                        
                        if (hasMatch) {
                            // ✅ CHANGE: Send notification with supabase
                            const notifResult = await supabase.from('notifications').insert([{
                                user_id: user.id,
                                sender_id: newProduct.seller_id,
                                product_id: newProduct.id,
                                product_image: newProduct.image_url,
                                message: `🚀 NEW MATCH! "${newProduct.name}" was just listed ($${newProduct.price || '0'})!`,
                                link_type: 'real_time_product_match',
                                is_read: false,  // ✅ FIXED
                                created_at: new Date().toISOString()
                            }]);
                            
                            if (notifResult.error) {
                                console.error('Failed to send match notification:', notifResult.error);
                            }
                            
                            // Optional: Show popup alert
                            if (showNotifications) {
                                alert(`🚀 New Product Match!\n\n"${newProduct.name}" ($${newProduct.price || '0'})\n\nThis product matches your interests!`);
                            }
                            
                            // Refresh notifications
                            fetchNotifications();
                        }
                    } catch (error) {
                        console.error('Error in real-time match detection:', error);
                    }
                }
            )
            .subscribe();

        // 🔔 REAL-TIME: Also listen for new buyers (for sellers)
        const buyerMatchChannel = supabase
            .channel('real-time-buyer-matches')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'profiles',
                    filter: `is_buyer=eq.true AND user_id=neq.${user.id}`
                },
                async (payload) => {
                    if (selectedMode !== 'seller') return;
                    
                    try {
                        const newBuyer = payload.new;
                        
                        const productsResult = await supabase
                            .from('products')
                            .select('name')
                            .eq('seller_id', user.id);
                        
                        if (productsResult.error) {
                            console.error('Failed to fetch products:', productsResult.error);
                            return;
                        }

                        const sellerProducts = productsResult.data;
                        if (!sellerProducts || sellerProducts.length === 0) return;
                        
                        // Check if buyer has interests
                        if (!newBuyer.interests) return;
                        
                        let buyerInterests = [];
                        if (Array.isArray(newBuyer.interests)) {
                            buyerInterests = newBuyer.interests;
                        } else if (typeof newBuyer.interests === 'string') {
                            try {
                                buyerInterests = JSON.parse(newBuyer.interests);
                            } catch (e) {
                                buyerInterests = [newBuyer.interests];
                            }
                        }
                        
                        // Check for any product matches
                        let matchFound = false;
                        let matchedProduct = '';
                        
                        for (const product of sellerProducts) {
                            if (!product || !product.name) {
                                console.warn('Invalid product data in match detection:', product);
                                continue;
                            }

                            const productNameLower = product.name ? product.name.toLowerCase() : '';
                            
                            const hasMatch = buyerInterests.some(interest => {
                                if (!interest) return false;
                                const interestLower = interest.toLowerCase();
                                return interestLower.includes(productNameLower) || 
                                    productNameLower.includes(interestLower) ||
                                    getWordVariations(productNameLower || '').some(variation =>
                                        interestLower.includes(variation)
                                    );
                            });
                            
                            if (hasMatch) {
                                matchFound = true;
                                matchedProduct = product.name;
                                break;
                            }
                        }
                        
                        if (matchFound) {
                            const notifResult = await supabase.from('notifications').insert([{
                                user_id: user.id,
                                sender_id: newBuyer.user_id,
                                message: `🎯 New potential customer! "${newBuyer.username}" is interested in products like "${matchedProduct}"`,
                                link_type: 'real_time_buyer_match',
                                is_read: false,  // ✅ FIXED
                                created_at: new Date().toISOString()
                            }]);
                            
                            if (notifResult.error) {
                                console.error('Failed to send buyer match notification:', notifResult.error);
                            }
                            
                            // Refresh notifications
                            fetchNotifications();
                        }
                    } catch (error) {
                        console.error('Error in buyer match detection:', error);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(productMatchChannel);
            supabase.removeChannel(buyerMatchChannel);
        };
    }, [user, isProfileComplete, selectedMode, fetchNotifications, showNotifications]);

    // ✅ RESTORE MODE ON PAGE LOAD - BUT ONLY IF MODE IS NOT EXPIRED
    useEffect(() => {
        // ✅ If user is logged in and mode is NOT null, navigate to app
        if (user && selectedMode && location.pathname === '/') {
            console.log('🔄 Mode loaded from AuthContext, navigating to app');
            navigate('/app');
            return;
        }
        
        // ✅ CRITICAL FIX: If mode is null and we're on /app
        // Admin: Allow staying on /app to see mode selection
        // Regular user: Should also see mode selection on /app
        if (user && !selectedMode && location.pathname === '/app') {
            console.log('⏰ Mode is null - showing mode selection on /app');
            // ✅ DON'T navigate away - just show mode selection
            // The mode selection UI is already rendered when selectedMode is null
            // So we just stay on /app and let the UI handle it
            return;
        }
        
        // ✅ If mode is null and we're on any other page except / and /app, go to /
        if (user && !selectedMode && location.pathname !== '/' && location.pathname !== '/app') {
            console.log('⏰ Mode is null - redirecting to mode selection');
            navigate('/');
        }
    }, [user, selectedMode, location.pathname, navigate, isAdmin]);

    // Save filters to localStorage
    useEffect(() => {
        if (selectedMode === 'buyer') {
            localStorage.setItem('buyerFilters', JSON.stringify(filters));
        }
    }, [filters, selectedMode]);
 
    // Load filters from localStorage
    useEffect(() => {
        if (selectedMode === 'buyer') {
            const savedFilters = localStorage.getItem('buyerFilters');
            if (savedFilters) {
                setFilters(JSON.parse(savedFilters));
            }
        }
    }, [selectedMode]);

    // --- ENSURE BASIC PROFILE EXISTS ---
    useEffect(() => {
        const ensureBasicProfile = async () => {
            if (!user || profileData) return;
            
            try {
                const { data: existingProfile } = await supabase
                    .from('profiles')
                    .select('user_id')
                    .eq('user_id', user.id)
                    .maybeSingle();
                
                if (!existingProfile) {
                    const basicProfile = {
                        user_id: user.id,
                        username: user.email,
                        location: '',
                        phone_number: '',
                        interests: [],
                        is_seller: false,
                        is_buyer: false,
                        seller_setup_completed: false,
                        buyer_setup_completed: false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    
                    const { error: createError } = await supabase
                        .from('profiles')
                        .insert([basicProfile]);
                    
                    if (!createError) {
                        console.log("✅ Basic profile created");
                    }
                }
            } catch (err) {
                console.error("Error ensuring profile exists:", err);
            }
        };
        
        if (user && !profileData) {
            ensureBasicProfile();
        }
    }, [user, profileData]);

    useEffect(() => {
        let reconnectAttempts = 0;
        const MAX_RECONNECT_ATTEMPTS = 10;
        let reconnectTimeout;
        let isConnected = false;

        const connectRealtime = async () => {
            try {
                // Check if we already have an active connection
                if (isConnected) return;
                
                console.log('📡 Establishing real-time connection...');
                
                // Create a health check channel
                const healthChannel = supabase.channel('health-check');
                
                healthChannel
                    .on('system', { event: 'disconnect' }, () => {
                        console.log('⚠️ Real-time connection lost');
                        isConnected = false;
                        
                        // Show subtle notification (optional - only once)
                        if (reconnectAttempts === 0) {
                            showToastNotification('Reconnecting to server...');
                        }
                    })
                    .on('system', { event: 'reconnect' }, () => {
                        console.log('✅ Real-time connection restored');
                        isConnected = true;
                        reconnectAttempts = 0;
                        //showToastNotification('Connected to server');
                    })
                    .subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                            console.log('✅ Real-time health check active');
                            isConnected = true;
                            reconnectAttempts = 0;
                        }
                    });
                
                // Clean up old channel after a delay
                setTimeout(() => {
                    supabase.removeChannel(healthChannel);
                }, 30000);
                
            } catch (error) {
                console.error('❌ Real-time connection error:', error);
                
                // Exponential backoff reconnection
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
                    
                    reconnectTimeout = setTimeout(() => {
                        reconnectAttempts++;
                        connectRealtime();
                    }, delay);
                } else {
                    console.log('📡 Max reconnection attempts reached. Will retry on next page refresh.');
                }
            }
        };
        
        // Start connection only if user is logged in and profile is complete
        if (user && isProfileComplete) {
            connectRealtime();
        }
        
        // Cleanup
        return () => {
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            isConnected = false;
        };
    }, [user, isProfileComplete, showToastNotification]);

    // Save profile completion status
    useEffect(() => {
        if (isProfileComplete) {
            localStorage.setItem('straun_profileComplete', 'true');
        } else {
            localStorage.setItem('straun_profileComplete', 'false');
        }
    }, [isProfileComplete]);

    // Save profile data (non-sensitive)
    useEffect(() => {
        if (profileData) {
            // Only save non-sensitive data
            const safeProfileData = {
            location: profileData.location,
            phone_number: profileData.phone_number,
            username: profileData.username,
            is_seller: profileData.is_seller,
            is_buyer: profileData.is_buyer
            };
            localStorage.setItem('straun_profileData', JSON.stringify(safeProfileData));
        }
    }, [profileData]);

    // --- HANDLE MODE SELECTION ---
    const handleModeSelect = async (mode) => {
        console.log('🔄 handleModeSelect called with:', mode);
        
        setGlobalLoading(true);
        setGlobalLoadingMessage(`Preparing ${mode} mode...`);
        
        try {
            // ✅ Clear ALL state first
            setProductsFound([]);
            setProspects([]);
            setProductSearch('');
            setAllProducts([]);
            setIsNavCollapsed(false);
            setCurrentPage(0);
            setHasMore(true);
            setSearchCache({});
            setSimilarProducts([]);
            setShowSimilarProducts(false);
            setError(null);
            
            // ✅ Set mode in AuthContext
            setMode(mode);
            
            // ✅ Set profile completion based on mode
            if (mode === 'buyer') {
                setIsProfileComplete(false);
                setShowBuyerDecision(true);   // ← SHOW BUYER DECISION
                setShowSellerDecision(false);
            } else if (mode === 'seller') {
                setIsProfileComplete(false);
                setShowSellerDecision(true);
                setShowBuyerDecision(false);
            }
            
            // ✅ Save location
            const locationData = {
                mode: mode,
                path: '/app',
                page: 'social',
                timestamp: Date.now()
            };
            if (user?.id) {
                localStorage.setItem(`straun_userLocation_${user.id}`, JSON.stringify(locationData));
            }
            
            console.log(`✅ Mode set to: ${mode}`);
            showToastNotification(`Switched to ${mode} mode`);
            
        } catch (error) {
            console.error('❌ Error switching mode:', error);
            setError('Failed to switch mode. Please try again.');
        } finally {
            setGlobalLoading(false);
            setGlobalLoadingMessage('');
        }
    };

    const handleSellerClick = () => {
        // Instead of going directly to seller form
        // navigate('/seller-form');
        
        // Now go to decision page first
        navigate('/seller-decision');
    };

    // Clear state when changing modes
    const clearAndSetMode = (mode) => {
        console.log('🔄 clearAndSetMode called with:', mode);
        console.log('🔄 Current selectedMode before change:', selectedMode);
        
        // ✅ Force mode change in AuthContext
        setMode(mode);
        
        // ✅ Clear ALL state
        setProductsFound([]);
        setProspects([]);
        setProductSearch('');
        setAllProducts([]);
        setIsNavCollapsed(false);
        setCurrentPage(0);
        setHasMore(true);
        setSearchCache({});
        setSimilarProducts([]);
        setShowSimilarProducts(false);
        setError(null);
        
        // ✅ CRITICAL: Set profile completion based on mode
        if (mode === 'buyer') {
            setIsProfileComplete(false);
            setShowBuyerDecision(true);
            setShowSellerDecision(false);
            // ✅ Save their choice for reference (not auto-restore)
            localStorage.setItem(`straun_chosen_mode_${user.id}`, 'buyer');
        } else if (mode === 'seller') {
            setIsProfileComplete(false);
            setShowSellerDecision(true);
            setShowBuyerDecision(false);
            // ✅ Save their choice for reference (not auto-restore)
            localStorage.setItem(`straun_chosen_mode_${user.id}`, 'seller');
        }
        
        console.log(`✅ Mode set to: ${mode}`);
        console.log(`✅ showSellerDecision: ${mode === 'seller'}`);
        console.log(`✅ showBuyerDecision: ${mode === 'buyer'}`);
        console.log(`✅ isProfileComplete: ${false}`);
        showToastNotification(`Switched to ${mode} mode`);
    };

    const clearAndSwitchMode = () => {
        handleSwitchMode();
    };

    // --- HANDLE PROFILE COMPLETION ---
    const handleProfileComplete = async (details) => {
        await withLoading(async () => {
            if (!user) return;
            
            setProfileUpdateLoading(true);

            try {
                // Rate limit check for profile setup
                if (selectedMode === 'seller') {
                    let check;
                    try {
                        check = await smartLimiterInstance.checkAndUpdate(user.id, 'PROFILE_SETUP', {
                            mode: 'seller',
                            product: details.product_listed
                        });
                        
                        if (!check.allowed) {
                            setError(`⚠️ ${check.reason}`);
                            setProfileUpdateLoading(false);
                            return;
                        }
                    } catch (error) {
                        console.error('Rate limit check error:', error);
                        // Continue anyway
                    }
                }
    
                if (!user) {
                    throw new Error('No user authenticated');
                }
                
                setProfileUpdateLoading(true);
                setError(null);

                const sanitizedLocation = sanitizeLocation(details.location);
                const sanitizedPhoneNumber = sanitizePhone(details.phone_number);
                const sanitizedProduct = sanitizeProductName(details.product_listed);

                if (!sanitizedLocation) {
                    throw new Error('Location is required and cannot be empty.');
                }
                if (!sanitizedPhoneNumber) {
                    throw new Error('Phone number is required and cannot be empty.');
                }

                if (selectedMode === 'buyer') {
                    let interestsToCheck = details.interests;
                    
                    if (typeof interestsToCheck === 'string') {
                        interestsToCheck = interestsToCheck.split(',').filter(i => i.trim());
                    }
                    
                    if (!interestsToCheck || interestsToCheck.length === 0) {
                        throw new Error('Please enter at least one interest for buyer setup');
                    }
                    
                    let sanitizedInterests = [];
                    if (Array.isArray(interestsToCheck)) {
                        sanitizedInterests = interestsToCheck
                            .map(interest => sanitizeInput(interest, 50))
                            .filter(interest => interest.length > 0);
                    } else {
                        sanitizedInterests = [sanitizeInput(interestsToCheck.toString(), 50)]
                            .filter(interest => interest.length > 0);
                    }
                    
                    if (sanitizedInterests.length === 0) {
                        throw new Error('Please enter at least one valid interest for buyer setup');
                    }
                }

                if (selectedMode === 'seller' && !sanitizedProduct) {
                    throw new Error('Please enter at least one product to sell for seller setup');
                }

                const isSellerMode = selectedMode === 'seller';
                const isBuyerMode = selectedMode === 'buyer';
                const now = new Date().toISOString();
                
                let sanitizedInterestsArray = [];
                if (isBuyerMode && details.interests) {
                    let interestsArray = details.interests;
                    
                    if (typeof interestsArray === 'string') {
                        interestsArray = interestsArray.split(',');
                    }
                    
                    sanitizedInterestsArray = interestsArray
                        .filter(i => i != null && i !== '')
                        .map(i => sanitizeInput(i.toString().trim().toLowerCase(), 50))
                        .filter(i => i.length > 0);
                }
                        
                const profileUpdate = {
                    user_id: user.id,
                    username: sanitizeEmail(user.email || user.user_metadata?.email || 'unknown'),
                    location: sanitizedLocation,
                    phone_number: sanitizedPhoneNumber,
                    updated_at: now,
                    created_at: now,
                    is_seller: isSellerMode,
                    is_buyer: isBuyerMode,
                    seller_setup_completed: isSellerMode,
                    buyer_setup_completed: isBuyerMode,
                    interests: sanitizedInterestsArray
                };

                const { data: existingProfile, error: fetchError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (fetchError) throw fetchError;

                const profileUpdateData = {
                    ...profileUpdate,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                    created_at: existingProfile?.created_at || new Date().toISOString()
                };

                let savedProfileData;
                if (existingProfile) {
                    const { data: updated, error: updateError } = await supabase
                        .from('profiles')
                        .update(profileUpdateData)
                        .eq('user_id', user.id)
                        .select()
                        .single();
                    
                    if (updateError) throw updateError;
                    savedProfileData = updated;
                } else {
                    const { data: inserted, error: insertError } = await supabase
                        .from('profiles')
                        .insert([profileUpdateData])
                        .select()
                        .single();
                    
                    if (insertError) throw insertError;
                    savedProfileData = inserted;
                }

                if (isSellerMode && sanitizedProduct) {
                    const sanitizedDescription = DOMPurify.sanitize(details.description || '', {
                        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a', 'img'],
                        ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'style'],
                        ALLOWED_URI_REGEXP: /^(?:(?:https?):\/\/|\/)/i,
                        FORBID_ATTR: ['onclick', 'onload', 'onerror'],
                        KEEP_CONTENT: true
                    })
                    .trim()
                    .substring(0, 1000);

                    const productInsert = {
                        seller_id: user.id,
                        name: sanitizedProduct,
                        location: sanitizedLocation,
                        phone_number: sanitizedPhoneNumber,
                        price: typeof details.price === 'number' ? 
                        Math.max(0, Math.min(details.price, 999999.99)) : 0,
                        description: sanitizedDescription, 
                        image_url: details.image_url || null, 
                        created_at: new Date().toISOString()
                    };

                    const { data: savedProduct, error: productError } = await supabase
                        .from('products')
                        .insert([productInsert])
                        .select()
                        .single();

                    // ✅ SILENT SKIP: If duplicate, just continue like nothing happened
                    const isDuplicate = productError && (
                        productError.code === '23505' ||
                        productError.message?.includes('duplicate key') ||
                        productError.message?.includes('products_unique_seller_product')
                    );

                    if (isDuplicate) {
                        console.log('ℹ️ Duplicate product skipped silently (already listed)');
                        // Don't throw — silently continue as if it saved
                    } else if (productError) {
                        console.error("❌ Error saving product:", productError);
                        throw new Error(productError.message || 'Failed to save product');
                    } else {
                        console.log("✅ Product saved, checking for buyer matches...");

                        
                        // 🔔 REAL-TIME MATCH NOTIFICATION: Notify matching buyers
                        try {
                            const { data: allBuyers } = await supabase
                                .from('profiles')
                                .select('user_id, interests, username')
                                .eq('is_buyer', true)
                                .neq('user_id', user.id)
                                .eq('is_active', true);

                            if (allBuyers && allBuyers.length > 0) {
                                const productNameLower = sanitizedProduct ? sanitizedProduct.toLowerCase() : '';
                                let matchCount = 0;
                                
                                for (const buyer of allBuyers) {
                                    try {
                                        let buyerInterests = [];
                                        if (buyer.interests) {
                                            if (Array.isArray(buyer.interests)) {
                                                buyerInterests = buyer.interests;
                                            } else if (typeof buyer.interests === 'string') {
                                                try {
                                                    buyerInterests = JSON.parse(buyer.interests);
                                                } catch (e) {
                                                    buyerInterests = [buyer.interests];
                                                }
                                            }
                                        }

                                        const hasMatch = buyerInterests.some(interest => {
                                            if (!interest) return false;
                                            const interestLower = interest.toLowerCase();
                                            return interestLower.includes(productNameLower) || 
                                                productNameLower.includes(interestLower) ||
                                                getWordVariations(productNameLower || '').some(variation =>
                                                    interestLower.includes(variation)
                                                );
                                        });

                                        if (hasMatch) {
                                            matchCount++;
                                            await supabase.from('notifications').insert([{
                                                user_id: buyer.user_id,
                                                sender_id: user.id,
                                                product_id: savedProduct.id,
                                                product_image: null,
                                                message: `🎯 New match! Seller listed "${sanitizedProduct}" that matches your interests!`,
                                                link_type: 'product_match',
                                                is_read: false,  // ✅ FIXED
                                                created_at: new Date().toISOString()
                                            }]);
                                        }
                                    } catch (e) {
                                        console.log('Error checking match for buyer:', e);
                                    }
                                }
                                
                                if (matchCount > 0) {
                                    console.log(`✅ Notified ${matchCount} buyers about new product match`);
                                }
                            }
                        } catch (matchError) {
                            console.error('Error in match notification:', matchError);
                        }
                    }
                }

                setProfileData(savedProfileData);
                setIsProfileComplete(true);
                // ✅ CRITICAL: Persist to localStorage so a page refresh doesn't lose this
                localStorage.setItem('straun_profileComplete', 'true');
                console.log('✅ handleProfileComplete: set straun_profileComplete in localStorage');
                setShowSellerDecision(false);
                setShowBuyerDecision(false);
                setShowBuyerForm(false); // ✅ Close buyer form

                // ✅ NAVIGATE TO APP
                navigate('/app');

                // Track user behavior
                if (behaviorAnalyzerInstance) {
                    behaviorAnalyzerInstance.recordUserAction(user.id, 'profile_complete', {
                        mode: selectedMode,
                        productListed: details.product_listed
                    });
                }

            } catch (error) {
                console.error('❌ Error in handleProfileComplete:', error);
                setError(error.message || 'Failed to save profile. Please try again.');
                setIsProfileComplete(false);
            } finally {
                setProfileUpdateLoading(false);
            }
        }, `Setting up your ${selectedMode === 'seller' ? 'seller' : 'buyer'} profile...`);
    };

    // --- SIMPLIFIED SEARCH FUNCTION (LIKE PREVIOUS VERSION) ---
    const handleSearch = async () => {
        // ✅ Prevent multiple concurrent searches
        if (isSearchingRef.current) {
            console.log('[Search] Already searching, skipping');
            return;
        }

        // ✅ Clear any pending search
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
            searchTimeoutRef.current = null;
        }

        // Clear previous results COMPLETELY
        setProductsFound([]);
        setProspects([]);
        setSimilarProducts([]);
        setShowSimilarProducts(false);
        setCurrentPage(0);
        setHasMore(true);
        setSearchCache({}); // ✅ Clear cache so old results don't show

         // ✅ Track search count for buyers (for interest reminder)
        if (selectedMode === 'buyer') {
            const currentCount = parseInt(sessionStorage.getItem('buyerSearchCount') || '0');
            const newCount = currentCount + 1;
            sessionStorage.setItem('buyerSearchCount', String(newCount));
            setBuyerSearchCount(newCount);
            console.log(`🔍 Buyer search count: ${newCount}`);
        }

        // ✅ Debounce search
        searchTimeoutRef.current = setTimeout(async () => { isSearchingRef.current = true;

        // Show global loading spinner
        setGlobalLoading(true);
        setGlobalLoadingMessage(`Searching for "${productSearch}"...`);
        
        const sanitizedSearch = sanitizeProductName(productSearch);
        const engine = new RecommendationEngine(user.id);
        
        try {
            await engine.trackBehavior(null, 'search', sanitizedSearch);

            await supabase.rpc('track_user_activity', {
                p_user_id: user.id,
                p_activity_type: 'search',
                p_metadata: { searchTerm: sanitizedSearch },
                p_message: `User searched for "${sanitizedSearch}"`
            });

            setSearchLoading(true);
            setError(null);
            setShowSafetyWarning(false);
            
            if (!sanitizedSearch || sanitizedSearch.trim().length === 0) {
                setError('Please enter a product name to search.');
                return;
            }
            
            if (!isProfileComplete) {
                setError('Please complete your profile before searching.');
                return;
            }

            // Update URL with search term
            const params = new URLSearchParams(location.search);
            params.set('q', sanitizedSearch);
            params.delete('page');
            
            navigate(`${location.pathname}?${params.toString()}`, { replace: true });
            
            setSearchParams(prev => ({
                ...prev,
                query: sanitizedSearch,
                page: 1
            }));
            
            if (user && isProfileComplete) {
                await UserActivityTracker.trackActivity(user.id, 'search', {
                    searchTerm: sanitizedSearch,
                    mode: selectedMode,
                    resultsCount: selectedMode === 'seller' ? prospects.length : productsFound.length
                });
            }
            
            // Clear previous results
            if (selectedMode === 'seller') {
                setProductsFound([]);
                await findProspects(sanitizedSearch);
            } else {
                setProspects([]);
                await findProducts(sanitizedSearch);
            }

            // Show PWA install prompt after successful search results
            if ((selectedMode === 'seller' && prospects.length > 0) || 
                (selectedMode === 'buyer' && productsFound.length > 0)) {
                
                const hasPromptedThisSession = sessionStorage.getItem('pwaPrompted');
                
                if (!hasPromptedThisSession && deferredPrompt && !hasBeenPrompted) {
                    setTimeout(() => {
                        setShowInstallPrompt(true);
                        setHasBeenPrompted(true);
                        sessionStorage.setItem('pwaPrompted', 'true');
                    }, 2000);
                }
            }

            // ✅ SAVE RESULTS AFTER SUCCESSFUL SEARCH (with error protection)
            try {
                if (selectedMode === 'seller' && prospects.length > 0) {
                    saveSearchResults(prospects, productSearch, 'seller');
                } else if (selectedMode === 'buyer' && productsFound.length > 0) {
                    saveSearchResults(productsFound, productSearch, 'buyer');
                }
            } catch (saveError) {
                // ✅ SILENT FAIL - Won't break the search
                console.warn('Search save failed:', saveError.message);
            }

        } catch (error) {
            setError(error.message || 'Search failed');
        } finally {
            setSearchLoading(false);
            setGlobalLoading(false); // Hide global loading
            setGlobalLoadingMessage('');
        }
         isSearchingRef.current = false;
        searchTimeoutRef.current = null;
    }, 300);
    };

    // --- REUSABLE FILTER FUNCTION ---
    const applyFiltersToQuery = (query, filtersObj) => {
        let filteredQuery = query;
        
        // Price Filter
        if (filtersObj.minPrice && !isNaN(filtersObj.minPrice)) {
            filteredQuery = filteredQuery.gte('price', Number(filtersObj.minPrice));
        }
        if (filtersObj.maxPrice && !isNaN(filtersObj.maxPrice)) {
            filteredQuery = filteredQuery.lte('price', Number(filtersObj.maxPrice));
        }
        
        // Location Filter (case-insensitive partial match)
        if (filtersObj.location && filtersObj.location.trim()) {
            filteredQuery = filteredQuery.ilike('location', `%${filtersObj.location.trim()}%`);
        }
        
        // Date/Sort Filter
        switch (filtersObj.sortBy) {
            case 'newest':
            filteredQuery = filteredQuery.order('created_at', { ascending: false });
            break;
            case 'price_low':
            filteredQuery = filteredQuery.order('price', { ascending: true });
            break;
            case 'price_high':
            filteredQuery = filteredQuery.order('price', { ascending: false });
            break;
            default:
            filteredQuery = filteredQuery.order('created_at', { ascending: false });
        }
        
        return filteredQuery;
    };

    // --- FIND PRODUCTS (BUYER MODE) - 100% CORRECT ---
    const findProducts = useCallback(async (searchTerm, useFilters = false) => {
        if (!user?.id) return; 

        console.log('🔍 Starting findProducts with search:', searchTerm);
        
        if (!user) {
            setError('Please log in to search');
            return;
        }

        setProductsFound([]);
        setSimilarProducts([]);
        setShowSimilarProducts(false);
        setShowSafetyWarning(false);
        setCurrentPage(0);
        setHasMore(true);

        const cacheKey = searchTerm.toLowerCase().trim();
        const cachedItem = searchCache[cacheKey];

        // ✅ Check if cache exists AND is less than 15 minutes old
        if (cachedItem && cachedItem.timestamp && (Date.now() - cachedItem.timestamp < 15 * 60 * 1000) && !useFilters) {
            console.log('Cache hit for:', cacheKey);
            
            // 🎲 Re-shuffle the cached data so it feels fresh every time they return
            const reshuffledProducts = [...cachedItem.data].sort(() => Math.random() - 0.5);
            setProductsFound(reshuffledProducts);
            return;
        }

        setSearchLoading(true);
        setError(null);
        
        try {
            const sanitizedSearch = sanitizeProductName(searchTerm);
            
            if (!sanitizedSearch || sanitizedSearch.length < 2) {
                setError('Please enter a product name with at least two characters.');
                setSearchLoading(false);
                return;
            }

            console.log('📋 Fetching products from database...');
            
            // ✅ USING ACTUAL COLUMNS FROM YOUR SCHEMA
            // products: id, name, price, location, description, phone_number, seller_id, created_at, image_url
            // profiles: user_id, username, location, phone_number, is_seller, is_buyer
            
            let query = supabase
                .from('products')
                .select(`
                    id,
                    name,
                    price,
                    location,
                    description,
                    phone_number,
                    seller_id,
                    created_at,
                    image_url,
                    status,
                    views,
                    sold,
                    profiles:seller_id (
                        user_id,
                        username,
                        location,
                        phone_number,
                        is_seller,
                        is_buyer
                    )
                `)
                .ilike('name', `%${sanitizedSearch}%`)
                .neq('seller_id', user.id);
            
            // Apply filters if requested
            if (useFilters) {
                if (filters.minPrice && !isNaN(filters.minPrice)) {
                    query = query.gte('price', Number(filters.minPrice));
                }
                if (filters.maxPrice && !isNaN(filters.maxPrice)) {
                    query = query.lte('price', Number(filters.maxPrice));
                }
                if (filters.location && filters.location.trim()) {
                    query = query.ilike('location', `%${filters.location.trim()}%`);
                }
                
                switch (filters.sortBy) {
                    case 'newest':
                        query = query.order('last_shown_at', { ascending: true, nullsFirst: true });
                        break;
                    case 'price_low':
                        query = query.order('price', { ascending: true });
                        break;
                    case 'price_high':
                        query = query.order('price', { ascending: false });
                        break;
                    default:
                        query = query.order('created_at', { ascending: false });
                }
            } else {
                query = query.order('last_shown_at', { ascending: true, nullsFirst: true });
            }

            query = query.limit(50);

            const { data: products, error: fetchError } = await query;

            if (fetchError) {
                console.error('❌ Error fetching products:', fetchError);
                setError(`Failed to fetch products: ${fetchError.message}`);
                setSearchLoading(false);
                return;
            }

            let productsData = products || [];
            console.log(`✅ Found ${productsData.length} products for: "${sanitizedSearch}"`);
            
            // 🎲 STEP 1: FAIR EXPOSURE SHUFFLE
            // If we have more than 1 product, shuffle them so everyone gets a chance
            if (productsData.length > 1) {
                productsData = productsData.sort(() => Math.random() - 0.5);
                console.log('🎲 Shuffled products for fair exposure');
            }
            
            // ✅ SIMILAR PRODUCTS - using actual UUID
            if (productsData.length === 0) {
                console.log('⚠️ No products found in database');
                await findSimilarProducts(sanitizedSearch);
            } else if (productsData.length > 0 && productsData.length < 3) {
                try {
                    // ✅ Safely find the first product that has a valid UUID (since it's shuffled)
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    const firstValidProduct = productsData.find(p => p.id && uuidRegex.test(p.id));
                    
                    if (firstValidProduct) {
                        const firstProductId = firstValidProduct.id;
                        const { data: similarData, error: similarError } = await supabase
                            .from('product_similarity')
                            .select(`
                                product_id_2,
                                similarity_score,
                                products:product_id_2 (
                                    id,
                                    name,
                                    price,
                                    location,
                                    description,
                                    phone_number,
                                    seller_id,
                                    created_at,
                                    image_url,
                                    profiles:seller_id (
                                        user_id,
                                        username,
                                        location,
                                        phone_number,
                                        is_seller,
                                        is_buyer
                                    )
                                )
                            `)
                            .eq('product_id_1', firstProductId)
                            .order('similarity_score', { ascending: false })
                            .limit(6);

                        if (!similarError && similarData) {
                            const similarProductsList = similarData
                                .filter(item => item.products)
                                .map(item => item.products);
                            setSimilarProducts(similarProductsList);
                            setShowSimilarProducts(similarProductsList.length > 0);
                        }
                    }
                } catch (similarErr) {
                    console.error('Error finding similar products:', similarErr);
                }
            }

            if (productsData.length > 0) {
                setShowSafetyWarning(true);
            }
            
            // When saving to cache later in the function, save it WITH a timestamp:
            if (!useFilters) {
                setSearchCache(prev => ({
                    ...prev,
                    [cacheKey]: {
                        data: productsData,
                        timestamp: Date.now() // ✅ Save the time it was cached
                    }
                }));
            }

            setProductsFound(productsData);

             // ✅ STEP 3: UPDATE LAST SHOWN TIMESTAMP
            if (productsData.length > 0) {
                const shownIds = productsData.map(p => p.id);
                supabase
                    .from('products')
                    .update({ last_shown_at: new Date().toISOString() })
                    .in('id', shownIds)
                    .then(({ error }) => {
                        if (error) console.warn('Failed to update last_shown_at:', error);
                    });
            }

            // ✅ NOTIFICATIONS - USING ACTUAL COLUMNS FROM YOUR SCHEMA
            // notifications: user_id, message, link_type, is_read, created_at, buyer_phone, product_image
            // NOTE: 'is_read' NOT 'read'
            // ✅ FIX: Prevent notification spam (only notify for searches >= 4 chars)
            if (productsData && productsData.length > 0 && selectedMode === 'buyer' && sanitizedSearch.length >= 4) {
                try {
                    // ✅ Get the buyer's phone number
                    const { data: buyerProfile } = await supabase
                        .from('profiles')
                        .select('phone_number')
                        .eq('user_id', user.id)
                        .single();

                    const buyerPhone = buyerProfile?.phone_number || null;

                    const uniqueSellerIds = [...new Set(productsData
                        .filter(p => p.seller_id && p.seller_id !== user.id)
                        .map(p => p.seller_id)
                    )];
                    
                    if (uniqueSellerIds.length > 0) {
                        for (const sellerId of uniqueSellerIds) {
                             // ✅ CHECK: Did we already notify this seller for this exact search in the last 30 mins?
                            const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: existingNotif } = await supabase
                                .from('notifications')
                                .select('id')
                                .eq('user_id', sellerId)
                                .eq('sender_id', user.id)
                                .ilike('message', `%searched for "${sanitizedSearch}"%`)
                                .gte('created_at', thirtyMinsAgo)
                                .limit(1);

                            // If no recent notification exists, send it
                            if (!existingNotif || existingNotif.length === 0) {
                                const { error: notifError } = await supabase
                                    .from('notifications')
                                    .insert({
                                        user_id: sellerId,
                                        sender_id: user.id,
                                        message: `🔍 A buyer searched for "${sanitizedSearch}" and found your products!`,
                                        link_type: 'search_match',
                                        buyer_phone: buyerPhone, 
                                        is_read: false,
                                        created_at: new Date().toISOString()
                                    });
                                
                                if (notifError) {
                                    console.error('Error notifying seller:', notifError);
                                }
                            } else {
                                console.log(`ℹ️ Skipped notification for seller ${sellerId} (already notified recently)`);
                            }
                        }
                    }
                } catch (notificationError) {
                    console.error('Error notifying sellers:', notificationError);
                }
            }

        } catch (err) {
            console.error('❌ Find products error:', err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setSearchLoading(false);
        }
    }, [user, searchCache, selectedMode, filters]);

    // --- FIND PROSPECTS (SELLER MODE) ---
    const findProspects = useCallback(async (searchTerm) => {
        console.log('🔍 Starting findProspects with search:', searchTerm);

        setShowSafetyWarning(false)
        
        const cacheKey = `prospect_${searchTerm ? searchTerm.toLowerCase().trim() : 'empty'}`;
        
        // Check cache first
        if (searchCache[cacheKey]) {
            console.log('Cache hit for prospects:', cacheKey);
            setProspects(searchCache[cacheKey]);
            return;
        }

        setSearchLoading(true);
        setError(null);
        setProspects([]);
        
        try {
            const sanitizedSearch = sanitizeProductName(searchTerm);
            
            if (!sanitizedSearch || sanitizedSearch.length < 2) {
                setError('Please enter a product name with at least two characters.');
                return;
            }

            const sellerLocation = sanitizeLocation(profileData?.location);
            
            if (!sellerLocation) {
                setError('Could not find seller profile location. Please update your profile.');
                return;
            }

            console.log('📋 Fetching buyers from database...');
            
            // ✅ Get buyers from profiles table - username already contains email
            const { data: allBuyers, error: prospectsError } = await supabase
                .from('profiles')
                .select('user_id, username, location, interests, phone_number')
                .not('interests', 'is', null)
                .neq('user_id', user?.id || '')
                .eq('is_active', true);

            if (prospectsError) {
                console.error("❌ Error fetching buyers:", prospectsError);
                throw prospectsError;
            }

            console.log(`📊 Found ${allBuyers?.length || 0} total buyers`);

            if (!allBuyers || allBuyers.length === 0) {
                setProspects([]);
                return;
            }

            const searchTermLower = sanitizedSearch ? sanitizedSearch.toLowerCase() : ''; 
            const searchWords = searchTermLower
                .split(/[\s,]+/)
                .filter(w => w && w.length >= 2)
                .map(word => word.replace(/[^a-z0-9]/g, ''))
                .filter(Boolean);
            
            console.log('🔎 Search words:', searchWords);
            
            const matchingProspects = allBuyers.filter(buyer => {
                if (!buyer.interests) return false;

                let interestsArray = [];
                try {
                    if (typeof buyer.interests === 'string') {
                        try {
                            interestsArray = JSON.parse(buyer.interests);
                        } catch (e) {
                            interestsArray = [buyer.interests];
                        }
                    } else if (Array.isArray(buyer.interests)) {
                        interestsArray = buyer.interests;
                    }

                    interestsArray = interestsArray
                        .filter(i => i != null)
                        .map(i => sanitizeInput(i.toString().trim(), 50))
                        .filter(i => i && i.length > 0);
                } catch (e) {
                    return false;
                }

                if (interestsArray.length === 0) return false;

                const hasMatch = interestsArray.some(interest => {
                    if (!interest) return false;
                    
                    const interestLower = interest.toLowerCase();
                    
                    const wordMatch = searchWords.some(word => {
                        if (!word) return false;
                        return interestLower.includes(word);
                    });

                    const fullTermMatch = interestLower.includes(searchTermLower);

                    return wordMatch || fullTermMatch;
                });

                return hasMatch;
            });

            console.log(`✅ Found ${matchingProspects.length} matching prospects`);

            const sortedProspects = [...matchingProspects].sort((a, b) => {
                const sellerLocLower = sellerLocation.toLowerCase();
                const aLocation = a.location ? a.location.toLowerCase() : '';
                const bLocation = b.location ? b.location.toLowerCase() : '';
                
                if (aLocation === sellerLocLower && bLocation !== sellerLocLower) return -1;
                if (aLocation !== sellerLocLower && bLocation === sellerLocLower) return 1;
                
                return aLocation.localeCompare(bLocation);
            });

            // ✅ Format prospects - username already contains email
            const formattedProspects = sortedProspects.map(prospect => {
                let interests = [];
                try {
                    if (typeof prospect.interests === 'string') {
                        try {
                            interests = JSON.parse(prospect.interests);
                        } catch (e) {
                            interests = [prospect.interests];
                        }
                    } else if (Array.isArray(prospect.interests)) {
                        interests = prospect.interests;
                    }
                } catch (e) {
                    interests = [];
                }

                // ✅ username is the email (as you confirmed)
                const email = prospect.username || 'No email provided';
                
                // ✅ FILTER INTERESTS - ONLY show relevant ones
                const relevantInterests = getRelevantInterests(interests, searchTerm);
                
                // ✅ GROUP interests by category
                const groupedInterests = groupInterestsByCategory(relevantInterests);
                
                // ✅ Format for display
                let interestsDisplay = '';
                if (relevantInterests.length === 0) {
                    interestsDisplay = 'No relevant interests';
                } else {
                    const parts = [];
                    for (const [category, items] of Object.entries(groupedInterests)) {
                        if (items.length > 0) {
                            const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
                            parts.push(`${categoryLabel}: ${items.join(', ')}`);
                        }
                    }
                    interestsDisplay = parts.join(' | ');
                }

                return {
                    id: prospect.user_id,
                    email: email,  // ✅ This is the username/email
                    username: prospect.username,
                    location: sanitizeLocation(prospect.location || 'Location not specified'),
                    interest: searchTerm,
                    interests: interests,
                    relevantInterests: relevantInterests,
                    groupedInterests: groupedInterests,
                    interestsDisplay: interestsDisplay,
                    phone_number: sanitizePhone(prospect.phone_number),
                    isSameLocation: prospect.location && 
                                prospect.location.toLowerCase() === sellerLocation.toLowerCase()
                };
            });
            
            if (matchingProspects.length > 0) {
                setShowSafetyWarning(true);
            }

            setSearchCache(prev => ({
                ...prev,
                [cacheKey]: formattedProspects
            }));
            
            setProspects(formattedProspects);

            if (formattedProspects.length > 0) {
                try {
                    await supabase
                        .from('searches')
                        .insert([{
                            buyer_id: null,
                            seller_id: user?.id,
                            product_name: searchTerm,
                            search_type: 'prospect',
                            prospects_found: formattedProspects.length,
                            created_at: new Date().toISOString()
                        }]);
                } catch (logError) {
                    console.error('Error logging search:', logError);
                }
            }

        } catch (err) {
            console.error('❌ Find prospects error:', err);
            setError(err.message || 'An error occurred while searching for prospects. Please try again.');
        } finally {
            setSearchLoading(false);
        }
    }, [user, profileData, searchCache]);

    useEffect(() => {
        const handlePullToRefresh = () => {
            console.log('🔄 Pull-to-refresh triggered');
            
            // ✅ ONLY refresh if there's a search term
            if (productSearch && productSearch.trim().length >= 2) {
            if (selectedMode === 'seller') {
                findProspects(productSearch);
            } else if (selectedMode === 'buyer') {
                findProducts(productSearch);
            }
            } else {
            // ✅ If no search term, show message - DON'T load all products
            showToastNotification('🔍 Enter a search term first');
            }
        };
        
        window.addEventListener('pull-to-refresh', handlePullToRefresh);
        return () => window.removeEventListener('pull-to-refresh', handlePullToRefresh);
    }, [selectedMode, productSearch, findProspects, findProducts, showToastNotification]);

    // ✅ Handle browser back/forward buttons
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const urlQuery = params.get('q') || '';
            const urlPage = parseInt(params.get('page')) || 1;
            
            if (urlQuery !== productSearch) {
            setProductSearch(urlQuery);
            setSearchParams(prev => ({
                ...prev,
                query: urlQuery,
                page: urlPage
            }));
            
            // If there's a query and profile is complete, perform search
            if (urlQuery.trim() && isProfileComplete) {
                // Check cache first
                const cacheKey = selectedMode === 'seller' 
                ? `prospect_${urlQuery.toLowerCase().trim()}`
                : urlQuery.toLowerCase().trim();
                
                if (searchCache[cacheKey]) {
                if (selectedMode === 'seller') {
                    setProspects(searchCache[cacheKey]);
                } else {
                    setProductsFound(searchCache[cacheKey]);
                }
                } else if (urlQuery.trim()) {
                // Perform fresh search
                if (selectedMode === 'seller') {
                    findProspects(urlQuery);
                } else {
                    findProducts(urlQuery);
                }
                }
            }
            }
        };
        
        window.addEventListener('popstate', handlePopState);
        
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [productSearch, isProfileComplete, selectedMode, searchCache, findProspects, findProducts]);

    // --- HANDLE SIGN OUT ---
    const handleSignOut = async () => {
        try {
            setSignOutLoading(true);

             if (user && user.id) {
                // ✅ Clear ALL user-specific localStorage
                localStorage.removeItem(`straun_userLocation_${user.id}`);
                localStorage.removeItem(`straun_profileData_${user.id}`);
                localStorage.removeItem(`straun_searchCache_${user.id}`);
                localStorage.removeItem(`straun_chosen_mode_${user.id}`);
                localStorage.removeItem('straun_profileComplete');
                localStorage.removeItem('straun_profileData');

                // ✅ CLEAR SEARCH PERSISTENCE
                clearSearchResults();
            }
            

            clearAuthState();  
            
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
 
            setIsProfileComplete(false);
            setProfileData(null);
            setProspects([]);
            setProductsFound([]);
            setProductSearch('');
            setAllProducts([]);
            setCurrentPage(0);
            setHasMore(true);
            setSearchCache({});
            setContactedIds([]);
            setRestoredSearch(false);
            setSearchExpired(false);
            
            safeNavigate('/');
        } catch (error) {
            console.error('Sign out error:', error);
            setError('Error signing out. Please try again.');
        } finally {
            setSignOutLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch(); // CHANGED from handleManualSearch to handleSearch
        }
    };

    // Auth loading - show spinner only for authentication
    if (authLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading authentication...</p>
            </div>
        );
    }

    if (!authLoading && !user) {
        return (
            <div className="loading-container">
                <p>Please sign in to access this page😮‍💨</p>
            </div>
        );
    }

    const ChatSystem = ({ currentUserId, otherUserId, otherUserName, productId, productName, onClose }) => {
        return (
            <div style={{ padding: '20px' }}>
                <h3>Chat with {otherUserName}</h3>
                <p>Product: {productName}</p>
                <div style={{
                    height: '300px',
                    background: '#f5f5f5',
                    borderRadius: '8px',
                    padding: '10px',
                    margin: '10px 0',
                    overflowY: 'auto'
                }}>
                    <p style={{ color: '#666', textAlign: 'center' }}>
                        💬 Chat feature coming soon. Use WhatsApp to contact {otherUserName} directly.
                    </p>
                </div>
                <button 
                    onClick={onClose}
                    style={{
                        width: '100%',
                        padding: '10px',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    Close
                </button>
            </div>
        );
    };

    // --- SHOW MODE SELECTION IF NO MODE SELECTED ---  
    if (!selectedMode) {
        console.log('⏰ [Social] No mode selected - redirecting to /mode-selection');
        
        // Use window.location for reliability
        if (typeof window !== 'undefined') {
            setTimeout(() => {
                navigate('/mode-selection');
            }, 100);
        }
        
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Redirecting to mode selection...</p>
            </div>
        );
    }

    if (selectedMode === 'seller' && showSellerDecision) {
        return (
            <div className="seller-decision-page">
                <div className="decision-container">
                    <div className="decision-card">
                        <div className="header" style={{ textAlign: 'center', marginBottom: '35px' }}>
                            <div style={{
                                fontSize: '32px',
                                fontWeight: '700',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                marginBottom: '8px'
                            }}>
                                Welcome Seller! 🎉
                            </div>
                            <div style={{ color: '#666', fontSize: '16px', fontWeight: '400' }}>
                                Would you like to add your products now?
                            </div>
                        </div>

                        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
                            <p style={{ color: '#718096', fontSize: '14px', lineHeight: '1.6' }}>
                                You can add your products now to start selling immediately,<br />
                                or skip and add them later from your dashboard.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <button
                                onClick={() => {
                                    // User wants to add products - go to setup form
                                    setShowSellerDecision(false);
                                    setIsProfileComplete(false); // This will show the setup form
                                }}
                                style={{
                                    width: '100%',
                                    padding: '18px',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px'
                                }}
                                onMouseEnter={(e) => (e.target.style.transform = 'translateY(-2px)')}
                                onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
                            >
                                📦 ADD PRODUCTS NOW
                            </button>

                            <button
                                onClick={async () => {
                                    // User wants to skip - update profile and go to main interface
                                    try {
                                        // Update profile to mark seller setup as complete (without products)
                                        const { error } = await supabase
                                            .from('profiles')
                                            .update({
                                                is_seller: true,
                                                seller_setup_completed: true,
                                            })
                                            .eq('user_id', user.id);
                                        
                                        if (error) throw error;
                                        
                                        // Hide decision page and set profile complete
                                        setShowSellerDecision(false);
                                        setIsProfileComplete(true); // This will show main interface
                                        
                                        // Fetch updated profile
                                        fetchProfile();
                                        
                                    } catch (error) {
                                        console.error('Error updating profile:', error);
                                        setError('Failed to skip. Please try again.');
                                    }
                                }}
                                style={{
                                    width: '100%',
                                    padding: '18px',
                                    background: 'transparent',
                                    color: '#667eea',
                                    border: '2px solid #667eea',
                                    borderRadius: '12px',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px'
                                }}
                                onMouseEnter={(e) => (e.target.style.background = 'rgba(102, 126, 234, 0.05)')}
                                onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                            >
                                ⏰ SKIP FOR NOW
                            </button>
                        </div>

                        <div style={{ 
                            marginTop: '30px', 
                            padding: '20px',
                            backgroundColor: '#f7fafc',
                            borderRadius: '10px',
                            fontSize: '13px',
                            color: '#718096',
                            textAlign: 'center'
                        }}>
                            <p>You can always add products later from your seller dashboard</p>
                        </div>
                        
                        {/* Back button */}
                        <button
                            onClick={() => {
                                setShowSellerDecision(false);
                                setMode(null); // Go back to mode selection
                                navigate('/');
                            }}
                            style={{
                                marginTop: '20px',
                                background: 'none',
                                border: 'none',
                                color: '#666',
                                cursor: 'pointer',
                                fontSize: '14px',
                                textDecoration: 'underline'
                            }}
                        >
                            ← Back to mode selection
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (selectedMode === 'buyer' && showBuyerDecision) {
        return (
            <BuyerDecision 
                existingData={profileData}
                onSkip={() => {
                    setShowBuyerDecision(false);
                    setIsProfileComplete(true);
                    navigate('/app');
                }}
                onAddInterests={() => {
                    setShowBuyerDecision(false);
                    setShowBuyerForm(true);
                }}
                onSwitchMode={clearAndSwitchMode}  // ✅ PASS THIS
                loading={loading}
            />
        );
    }

    if (selectedMode === 'buyer' && showBuyerForm) {
        return (
            <div className="app-container">
                <div className="profile-setup-screen">
                    <div className="setup-header">
                        <h1 className="app-title">Complete Your Buyer Setup</h1>
                        <p className="setup-subtitle">
                            <strong>Required:</strong> You must complete this form to proceed to the buyer marketplace.
                        </p>
                        
                        {/* ✅ ADD THE CHANGE MODE BUTTON HERE */}
                        <div className="mode-indicator">
                            <span className="mode-badge">Buyer Setup</span>
                            
                            <button 
                                onClick={() => {
                                    setShowBuyerForm(false);
                                    setShowBuyerDecision(true);
                                }}
                                className="change-mode-button"
                            >
                                ← Back
                            </button>
                            
                            <button 
                                onClick={clearAndSwitchMode}
                                className="change-mode-button danger"
                            >
                                Switch to Seller
                            </button>
                        </div>
                        
                        {profileData && (profileData.location || profileData.phone_number) && (
                            <div className="existing-profile-info">
                                <p className="existing-info-note">
                                    <strong>Note:</strong> Some fields are pre-filled from your existing profile data.
                                    You must still complete and submit all required fields.
                                </p>
                            </div>
                        )}
                    </div>
                    
                    <div className="setup-form-container">
                        <BuyerSetupForm 
                            onProfileComplete={handleProfileComplete}
                            existingData={profileData}
                            isBuyerFlow={true}
                            loading={profileUpdateLoading}
                        />
                    </div>
                </div>
            </div>
        );
    }
    
    if (selectedMode === 'buyer' && (showBuyerForm || !isProfileComplete)) {
        navigate('/buyer-form', { replace: true });
        return <div className="loading-container"><p>Redirecting to buyer setup…</p></div>;
    }
    
    // ✅ NEW: Contact Modal
    const ContactModal = ({ product, onClose }) => {
        if (!product) return null;

        const handleWhatsApp = () => {
            const cleanPhone = product.phone_number?.replace(/\D/g, '');
            const finalNumber = cleanPhone?.startsWith('263') ? cleanPhone : `263${cleanPhone?.replace(/^0/, '')}`;
            const message = encodeURIComponent(`Hi, I'm interested in "${product.name}" on Straun!`);
            window.open(`https://wa.me/${finalNumber}?text=${message}`, '_blank');
            onClose();
        };

        const handleCall = () => {
            window.open(`tel:${product.phone_number}`, '_self');
            onClose();
        };

        const handleSMS = () => {
            const message = encodeURIComponent(`Hi, I'm interested in "${product.name}" on Straun!`);
            window.open(`sms:${product.phone_number}?body=${message}`, '_self');
            onClose();
        };

        return (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.6)', zIndex: 99999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px'
            }}>
                <div style={{
                    background: 'white', borderRadius: '16px', padding: '24px',
                    maxWidth: '400px', width: '100%', textAlign: 'center',
                    animation: 'slideUp 0.3s ease'
                }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#0f172a' }}>
                        Contact Seller
                    </h3>
                    <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '14px' }}>
                        How would you like to reach out about "{product.name}"?
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button onClick={handleWhatsApp} style={{ padding: '14px', background: '#25D366', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            💬 WhatsApp
                        </button>
                        <button onClick={handleCall} style={{ padding: '14px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            📞 Call
                        </button>
                        <button onClick={handleSMS} style={{ padding: '14px', background: '#f8961e', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            💬 SMS
                        </button>
                    </div>

                    <button onClick={onClose} style={{ marginTop: '20px', background: 'none', border: 'none', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                        Cancel
                    </button>
                </div>
            </div>
        );
    };

    // PWA Install Prompt Component
    const PWAInstallPrompt = () => {
        if (!showInstallPrompt) return null;

        const handleInstall = async () => {
            if (!deferredPrompt) return;
            
            // Show the native install prompt
            deferredPrompt.prompt();
            
            // Wait for user response
            const { outcome } = await deferredPrompt.userChoice;
            
            // Track the result
            if (typeof ReactGA !== 'undefined') {
            ReactGA.event({
                category: 'PWA',
                action: 'Install Prompt',
                label: outcome
            });
            }
            
            // Reset the deferred prompt
            setDeferredPrompt(null);
            setShowInstallPrompt(false);
        };

        const handleDismiss = () => {
            setShowInstallPrompt(false);
            // Don't show again for this session
            sessionStorage.setItem('pwaPrompted', 'true');
        };

        // Detect iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

        return (
            <div className="pwa-install-prompt-overlay">
            <div className="pwa-install-prompt">
                <button 
                className="pwa-install-close" 
                onClick={handleDismiss}
                >
                ×
                </button>
                
                <div className="pwa-install-content">
                <div className="pwa-install-icon">📱</div>
                <h3>Install Our App!</h3>
                <p>Get faster access, work offline, and receive notifications like WhatsApp</p>
                
                <div className="pwa-install-features">
                    <div className="pwa-feature">
                    <span>⚡</span>
                    <span>Faster loading</span>
                    </div>
                    <div className="pwa-feature">
                    <span>📶</span>
                    <span>Works offline</span>
                    </div>
                    <div className="pwa-feature">
                    <span>🔔</span>
                    <span>Push notifications</span>
                    </div>
                    <div className="pwa-feature">
                    <span>🏠</span>
                    <span>Home screen icon</span>
                    </div>
                </div>
                
                {/* Show different button for iOS vs Android */}
                {isIOS && !isInStandaloneMode ? (
                    <>
                    <div className="ios-install-instructions">
                        <h4>📱 How to Install on iPhone/iPad:</h4>
                        <ol>
                        <li>Tap the <strong>Share</strong> button (📤) at the bottom</li>
                        <li>Scroll down and select <strong>"Add to Home Screen"</strong></li>
                        <li>Tap <strong>"Add"</strong> in the top right</li>
                        <li>The app will appear on your home screen!</li>
                        </ol>
                        <p style={{ fontSize: '12px', marginTop: '10px' }}>
                        ⚠️ Must use Safari browser. Chrome on iOS doesn't support PWA install.
                        </p>
                    </div>
                    <button 
                        className="pwa-dismiss-button"
                        onClick={handleDismiss}
                        style={{ marginTop: '15px' }}
                    >
                        Got it, I'll install manually
                    </button>
                    </>
                ) : (
                    <>
                    <button 
                        className="pwa-install-button"
                        onClick={handleInstall}
                    >
                        📲 Install Now
                    </button>
                    
                    <button 
                        className="pwa-dismiss-button"
                        onClick={handleDismiss}
                    >
                        Not Now
                    </button>
                    </>
                )}
                
                <p className="pwa-install-note">
                    Free to install • No app store needed
                </p>
                </div>
            </div>
            </div>
        );
    };

    // 🔔 Interest Popup Component
    const InterestPopup = () => {
        if (!showInterestPopup) return null;

        const handleAddInterests = () => {
            // Close popup and show buyer setup
            setShowInterestPopup(false);
            setIsProfileComplete(false);
            setShowBuyerDecision(true);
            // Save that user chose to add interests
            localStorage.setItem(`interest_popup_action_${user?.id}`, 'add');
        };

        const handleSkip = () => {
            setShowInterestPopup(false);
            // Save that user chose to skip
            localStorage.setItem(`interest_popup_action_${user?.id}`, 'skip');
            // Show a gentle notification
            showToastNotification('You can always add interests later from your settings.');
        };

        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(5px)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                animation: 'fadeIn 0.3s ease'
            }}>
                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    maxWidth: '450px',
                    width: '100%',
                    padding: '32px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    animation: 'slideUp 0.3s ease',
                    textAlign: 'center'
                }}>
                    {/* Icon */}
                    <div style={{
                        fontSize: '64px',
                        marginBottom: '16px'
                    }}>
                        🎯
                    </div>
                    
                    {/* Title */}
                    <h2 style={{
                        margin: '0 0 8px 0',
                        color: '#333',
                        fontSize: '24px',
                        fontWeight: 'bold'
                    }}>
                        Add Your Interests!
                    </h2>
                    
                    {/* Subtitle */}
                    <p style={{
                        margin: '0 0 12px 0',
                        color: '#666',
                        fontSize: '16px',
                        lineHeight: '1.5'
                    }}>
                        We noticed you've been searching for products.
                    </p>
                    
                    {/* Description */}
                    <div style={{
                        background: '#f8f9fa',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '24px',
                        textAlign: 'left'
                    }}>
                        <p style={{
                            margin: '0 0 8px 0',
                            color: '#555',
                            fontSize: '14px',
                            lineHeight: '1.6'
                        }}>
                            <strong>Why add interests?</strong>
                        </p>
                        <ul style={{
                            margin: '0',
                            paddingLeft: '20px',
                            color: '#666',
                            fontSize: '13px',
                            lineHeight: '1.8'
                        }}>
                            <li>🔍 Sellers can find you with relevant products</li>
                            <li>📦 Get personalized recommendations</li>
                            <li>⚡ Save time finding what you love</li>
                        </ul>
                    </div>
                    
                    {/* Buttons */}
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        flexDirection: 'column'
                    }}>
                        <button
                            onClick={handleAddInterests}
                            style={{
                                width: '100%',
                                padding: '14px',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'transform 0.2s ease',
                                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                            }}
                            onMouseEnter={(e) => (e.target.style.transform = 'translateY(-2px)')}
                            onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
                        >
                            🎯 Add Interests Now
                        </button>
                        
                        <button
                            onClick={handleSkip}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'transparent',
                                color: '#666',
                                border: '2px solid #e0e0e0',
                                borderRadius: '12px',
                                fontSize: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = '#f5f5f5';
                                e.target.style.borderColor = '#ccc';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = 'transparent';
                                e.target.style.borderColor = '#e0e0e0';
                            }}
                        >
                            Maybe later
                        </button>
                    </div>
                    
                    {/* Footer note */}
                    <p style={{
                        margin: '16px 0 0 0',
                        fontSize: '12px',
                        color: '#999'
                    }}>
                        You can always add interests later from your settings
                    </p>
                </div>
            </div>
        );
    };

    // Quick Action Card Component
    const QuickActionCard = ({ icon, title, description, onClick, color }) => {
        return (
            <div
                onClick={onClick}
                style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
            >
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>{icon}</div>
                <h4 style={{ margin: '0 0 5px 0', color: '#333' }}>{title}</h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>{description}</p>
            </div>
        );
    };

    // --- MAIN INTERFACE ---
    return (
        <div className="social-media-page theme-pattern-bg"> 

            {/* Mobile Sidebar Navigation */}
            <div className={`mobile-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
                <div className="mobile-sidebar-header">
                    <button className="close-menu" onClick={toggleMobileMenu}>✕</button>
                    {/* App name removed from here - only user info */}
                    <div className="mobile-user-info">
                        <div className="mobile-avatar">{userInitials}</div>
                        <div className="mobile-user-details">
                            <span className="mobile-user-name">{userName}</span>
                            <span className="mobile-user-mode">{userMode}</span>
                        </div>
                    </div>
                </div>
                
                <nav className="mobile-nav-items">
                    <button onClick={() => { 
                        toggleMobileMenu();
                        navigate('/'); 
                    }}>
                        🏠 Home
                    </button>

                    <button onClick={() => { 
                        toggleMobileMenu();
                        navigate('/dashboard', { state: { selectedMode } }); 
                    }}>
                        📊 Dashboard
                    </button>
                    
                    <button onClick={() => { handleNavigation('wishlist'); toggleMobileMenu(); }}>
                        ❤️ Wishlist
                    </button>
                                        
                    <button onClick={() => { handleNavigation('deals'); toggleMobileMenu(); }}>
                        🔥 Daily Deals
                    </button>
                                        
                    <div className="mobile-nav-divider"></div>
                    
                    <button onClick={() => { handleNavigation('settings'); toggleMobileMenu(); }}>
                        ⚙️ Settings
                    </button>
                    
                    <div className="mobile-nav-divider"></div>
                             
                    <button onClick={() => { handleNavigation('signout'); toggleMobileMenu(); }} className="signout-btn">
                        🚪 Sign Out
                    </button>
                </nav>
            </div>
            
            {/* Overlay */}
        {mobileMenuOpen && <div className="mobile-overlay" onClick={toggleMobileMenu}></div>}

        {showSettings && (
            <div className="settings-modal-overlay">
                <div className="settings-modal">
                    <button 
                        className="settings-modal-close"
                        onClick={() => setShowSettings(false)}
                    >
                        ×
                    </button>
                    <UserSettings user={user} />
                </div>
            </div>
        )}  

       <div className="page-wrapper">
        {location.pathname === '/app' && (
            <header className="social-header" style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '12px 20px',
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
                {/* Menu Button */}
                <button 
                    onClick={toggleMobileMenu}
                    aria-label="Menu"
                    style={{
                        background: 'rgba(255,255,255,0.15)',
                        border: 'none',
                        color: 'white',
                        fontSize: '20px',
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease'
                    }}
                >
                    ☰
                </button>

                {/* ✅ LOGO + TITLE - Center aligned */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flex: 1,
                    justifyContent: 'center'
                }}>
                    {/* Logo Image - Circle masked */}
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '2px solid rgba(255,255,255,0.25)',
                        background: 'rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <img 
                            src="/Straun-logo.png" 
                            alt="Straun Logo" 
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                display: 'block'
                            }}
                        />
                    </div>
                    
                    {/* Clean App Name - Straun AI WITH CLICKABLE CROWN FOR ADMIN */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '6px'
                    }}>
                        <span style={{
                            fontSize: '20px',
                            fontWeight: '700',
                            color: 'white',
                            letterSpacing: '-0.3px'
                        }}>
                            Straun
                        </span>
                        <span style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: 'rgba(255,255,255,0.85)',
                            background: 'rgba(255,255,255,0.2)',
                            padding: '2px 8px',
                            borderRadius: '20px',
                            letterSpacing: '0.3px'
                        }}>
                            AI
                        </span>
                        
                        {/* 👑 CLICKABLE CROWN ICON FOR ADMIN - FIXED */}
                        {isAdmin === true && (
                            <button
                                onClick={() => {
                                    console.log('👑 Admin crown clicked - navigating to admin dashboard');
                                    navigate('/admin'); //replaced this , window.location.href = '/admin';
                                }}
                                title="Admin Dashboard"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                    marginLeft: '4px',
                                    padding: '4px 4px',
                                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                                    transition: 'all 0.2s ease',
                                    animation: 'crownGlow 2s ease-in-out infinite',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#FFD700', // Gold color
                                    textShadow: '0 0 10px rgba(255,215,0,0.3)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                    e.currentTarget.style.textShadow = '0 0 20px rgba(255,215,0,0.6)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.textShadow = '0 0 10px rgba(255,215,0,0.3)';
                                }}
                            >
                                👑
                            </button>
                        )}
                    </div>
                </div>
                
                {/* ✅ RIGHT: Notification Bell */}
                <div style={{ position: 'relative' }}>
                    <button 
                        onClick={() => {
                            setUnreadCount(0); // Drop count to 0
                            navigate('/notifications', { state: { referrer: '/app' } });
                        }}
                        style={{
                            background: 'rgba(255,255,255,0.15)',
                            border: 'none',
                            color: 'white',
                            fontSize: '18px',
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        🔔
                        {/* 🔴 RED BADGE */}
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '-2px',
                                right: '-2px',
                                background: '#ef4444',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: '700',
                                minWidth: '18px',
                                height: '18px',
                                padding: '0 5px',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid #667eea'
                            }}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>
                </div>
            </header>
            
        )}
             
        <div className={`main-content-wrapper ${isNavCollapsed ? 'nav-collapsed' : ''} ${isNavbarHidden ? 'has-hidden-nav' : ''}`}>
            <div className="app-container">

                {/* Tools Panel Modal Overlay */}
                {showToolsPanel && (
                    <div 
                        className="tools-modal-overlay"
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            zIndex: 9999,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px',
                            animation: 'fadeIn 0.3s ease'
                        }}
                    >
                        <div 
                            className="tools-modal-content"
                            style={{
                                background: 'white',
                                borderRadius: '15px',
                                width: '100%',
                                maxWidth: '500px',
                                maxHeight: '85vh',
                                overflow: 'auto',
                                position: 'relative',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                            }}
                        >
                            {/* Close button */}
                            <button 
                                onClick={() => setShowToolsPanel(false)}
                                style={{
                                    position: 'absolute',
                                    top: '15px',
                                    right: '15px',
                                    background: '#ff4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    cursor: 'pointer',
                                    fontSize: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 10001
                                }}
                            >
                                ×
                            </button>
                            
                            {/* ToolsPanel Component */}
                            <ToolsPanel 
                                user={user}
                                selectedMode={selectedMode}
                                onBack={() => setShowToolsPanel(false)}
                                showToastNotification={showToastNotification}
                            />
                        </div>
                    </div>
                )}
                
                

                {/* ===== FLOATING BUTTONS - PROPER ORDER ===== */}
                
                {/* 1. DASHBOARD BUTTON - Top (Highest) */}
                {!showWishlist && !showToolsPanel && (
                    <button
                        onClick={() => navigate('/dashboard', { state: { selectedMode } })}
                        style={{
                            position: 'fixed',
                            bottom: '135px',
                            right: '20px',
                            backgroundColor: '#FF9800',
                            color: 'white',
                            border: 'none',
                            padding: '14px 20px',
                            borderRadius: '50px',
                            fontWeight: 'bold',
                            fontSize: '15px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                            zIndex: 1000,
                            transition: 'all 0.3s ease',
                        }}
                        title="Open Dashboard - Access all features"
                    >
                        <span style={{ fontSize: '20px' }}>📊</span>
                        Dashboard
                    </button>
                )}

                 {/* 2. REPORT BUTTON - Below Dashboard with equal spacing */}
                <div style={{
                    position: 'fixed',
                    bottom: '75px', 
                    right: '20px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '5px'
                }}>
                    <ReportButton 
                        targetUserId={user?.id}
                        floating={true}
                        style={{
                            backgroundColor: '#ff3b30',
                            color: 'white',
                            border: 'none',
                            padding: '14px 20px',
                            borderRadius: '50px',
                            fontWeight: 'bold',
                            fontSize: '15px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                        }}
                    />
                </div>
  
                <main className="social-main-content">
                    <div className="search-section-card">
                        <div className="search-header">
                            <h2>
                                {selectedMode === 'seller' 
                                ? '🔍 Find Customers for Your Products' 
                                : '🔍 Find Products to Buy'}
                            </h2>
                            <p className="search-instruction">
                                {selectedMode === 'seller'
                                ? 'Enter a product name to find customers interested in buying it'
                                : 'Enter a product name to find sellers offering it'}
                            </p>
                        </div>
                        
                        <div className="search-input-group">
                            <div className="search-input-wrapper">
                                <input 
                                    type="text" 
                                    placeholder={
                                        selectedMode === 'seller' 
                                        ? "E.g., Vests, Rhombas , Trousers.." 
                                        : "E.g., Vests, Hat, baby Feeders..."
                                    }
                                    value={productSearch}
                                    onChange={(e) => {
                                        const value = e.target.value
                                        .replace(/[<>"'`&;\\]/g, '')
                                        .substring(0, 100);
                                        setProductSearch(value);
                                        setError(null);
                                    }}
                                    onKeyPress={handleKeyPress}
                                    className="search-input-large"
                                    disabled={searchLoading}
                                />
                            </div>

                            {/* ✅ FILTER DROPDOWN */}
                             <FilterDropdown 
                                filters={filters}
                                setFilters={setFilters}
                                onApply={() => {
                                    if (productSearch.trim()) {
                                        findProducts(productSearch, true);
                                    } else {
                                        fetchProducts();
                                    }
                                }}
                                onClear={() => {
                                    setFilters({
                                        minPrice: '',
                                        maxPrice: '',
                                        location: '',
                                        sortBy: 'newest'
                                    });
                                    if (productSearch.trim()) {
                                        findProducts(productSearch);
                                    } else {
                                        fetchProducts();
                                    }
                                }}
                                activeFilterCount={activeFilterCount}
                            />

                            <button 
                                onClick={handleSearch} 
                                disabled={searchLoading || !productSearch.trim()}
                                className="search-button-large"
                            >
                                {searchLoading ? (
                                <>
                                    <span className="search-spinner"></span>
                                    Searching...🔍
                                </>
                                ) : (
                                <>
                                    <span className="search-icon">
                                    {selectedMode === 'seller' ? '👥' : '🔎'}
                                    </span>
                                    {selectedMode === 'seller' ? 'Find Customers' : 'Find Products'}
                                </>
                                )}
                            </button>

                            <div className="search-results-count">
                                <strong>
                                    {selectedMode === 'seller' ? 'Prospects Found:' : 'Products Found:'} 
                                </strong> 
                                {selectedMode === 'seller' ? prospects.length : productsFound.length}
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="error-alert">
                            <span className="error-icon">⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}
                    
                    {/* 🔴 SAFETY WARNING MESSAGE */}
                    {showSafetyWarning && (
                        <div 
                            className="safety-warning-message"
                            style={{
                                backgroundColor: '#fff3cd',
                                border: '2px solid #ffc107',
                                borderRadius: '8px',
                                padding: '15px',
                                margin: '15px 0',
                                position: 'relative',
                                animation: 'fadeIn 0.3s ease-in'
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px'
                            }}>
                                <span style={{
                                    fontSize: '24px',
                                    color: '#ff9800'
                                }}>⚠️</span>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{
                                        margin: '0 0 8px 0',
                                        color: '#856404',
                                        fontSize: '16px',
                                        fontWeight: 'bold'
                                    }}>
                                        Important Safety Reminder
                                    </h4>
                                    <p style={{
                                        margin: '0',
                                        color: '#856404',
                                        fontSize: '14px',
                                        lineHeight: '1.5'
                                    }}>
                                        <strong>No Pre-payments:</strong> Do not "deposit" or "reserve" items with money before. 
                                        Always inspect the product before paying. 
                                        <strong> [Straun Marketing App]</strong> is not responsible for private transactions.
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setShowSafetyWarning(false)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '20px',
                                        color: '#666',
                                        cursor: 'pointer',
                                        padding: '0',
                                        lineHeight: '1'
                                    }}
                                    title="Close warning"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {selectedMode === 'buyer' && productsFetchLoading && allProducts.length === 0 && (
                        <div className="loading-indicator">
                            <p>Loading your marketing data...</p>
                        </div>
                    )}
                    
                    <div className="separator"></div>

                    {/* ============================================================ */}
                    {/* ========== MODALS (Price Alerts, Saved Searches, etc.) ========== */}
                    {/* ============================================================ */}

                    {showPriceAlerts ? (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: '#121212',
                            zIndex: 20000,
                            overflow: 'auto',
                            animation: 'fadeIn 0.3s ease'
                        }}>
                            <div style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                padding: '20px',
                                position: 'sticky',
                                top: 0,
                                zIndex: 100
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    maxWidth: '1200px',
                                    margin: '0 auto'
                                }}>
                                    <h1 style={{ margin: 0, fontSize: '24px' }}>🔔 Price Alerts</h1>
                                    <button
                                        onClick={() => setShowPriceAlerts(false)}
                                        style={{
                                            background: 'rgba(255,255,255,0.2)',
                                            border: 'none',
                                            color: 'white',
                                            fontSize: '24px',
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
                                <PriceAlertDashboard userId={user?.id} />
                            </div>
                        </div>
                    ) : showSavedSearches ? (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: '#121212',
                            zIndex: 20000,
                            overflow: 'auto',
                            animation: 'fadeIn 0.3s ease'
                        }}>
                            <div style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                padding: '20px',
                                position: 'sticky',
                                top: 0,
                                zIndex: 100
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    maxWidth: '1200px',
                                    margin: '0 auto'
                                }}>
                                    <h1 style={{ margin: 0, fontSize: '24px' }}>🔍 Saved Searches</h1>
                                    <button
                                        onClick={() => {
                                            setShowSavedSearches(false);
                                            fetchSavedSearches();
                                        }}
                                        style={{
                                            background: 'rgba(255,255,255,0.2)',
                                            border: 'none',
                                            color: 'white',
                                            fontSize: '24px',
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                            
                            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
                                <div style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    marginBottom: '20px'
                                }}>
                                    <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>
                                        Your Saved Searches ({userSavedSearches.length})
                                    </h3>
                                    <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
                                        You'll receive notifications when new products match these searches
                                    </p>
                                    
                                    {userSavedSearches.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px' }}>
                                            <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔍</div>
                                            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>No saved searches yet</h4>
                                            <p style={{ color: '#666', marginBottom: '20px' }}>
                                                Save searches when you search for products to get notified of new matches
                                            </p>
                                            <button
                                                onClick={() => setShowSavedSearches(false)}
                                                style={{
                                                    padding: '10px 20px',
                                                    background: '#667eea',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Start Searching
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            {userSavedSearches.map((search) => (
                                                <div key={search.id} style={{
                                                    background: '#f8f9fa',
                                                    borderRadius: '10px',
                                                    padding: '15px',
                                                    border: '1px solid #e0e0e0',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
                                                    gap: '15px'
                                                }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                            <span style={{ fontSize: '20px' }}>🔍</span>
                                                            <strong style={{ fontSize: '16px', color: '#333' }}>
                                                                "{search.search_term}"
                                                            </strong>
                                                        </div>
                                                        
                                                        {(search.min_price || search.max_price || search.location) && (
                                                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                                                {search.min_price && (
                                                                    <span style={{ fontSize: '12px', background: '#e3f2fd', padding: '2px 8px', borderRadius: '4px' }}>
                                                                        Min: ${search.min_price}
                                                                    </span>
                                                                )}
                                                                {search.max_price && (
                                                                    <span style={{ fontSize: '12px', background: '#e3f2fd', padding: '2px 8px', borderRadius: '4px' }}>
                                                                        Max: ${search.max_price}
                                                                    </span>
                                                                )}
                                                                {search.location && (
                                                                    <span style={{ fontSize: '12px', background: '#e3f2fd', padding: '2px 8px', borderRadius: '4px' }}>
                                                                        📍 {search.location}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        
                                                        <div style={{ fontSize: '11px', color: '#999' }}>
                                                            Saved on {new Date(search.created_at).toLocaleDateString()}
                                                            {search.last_notified_at && (
                                                                <span> · Last notified: {new Date(search.last_notified_at).toLocaleDateString()}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <button
                                                            onClick={() => runSavedSearchItem(search.search_term)}
                                                            style={{
                                                                padding: '8px 16px',
                                                                background: '#4CAF50',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '13px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '5px'
                                                            }}
                                                        >
                                                            🔍 Run Search
                                                        </button>
                                                        <button
                                                            onClick={() => deleteSavedSearchItem(search.id)}
                                                            style={{
                                                                padding: '8px 16px',
                                                                background: '#ff4444',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '13px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '5px'
                                                            }}
                                                        >
                                                            🗑️ Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : showDailyDeals ? (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: '#121212',
                            zIndex: 20000,
                            overflow: 'auto',
                            animation: 'fadeIn 0.3s ease'
                        }}>
                            <div style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                padding: '20px',
                                position: 'sticky',
                                top: 0,
                                zIndex: 100
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    maxWidth: '1200px',
                                    margin: '0 auto'
                                }}>
                                    <h1 style={{ margin: 0, fontSize: '24px' }}>🔥 Daily Deals</h1>
                                    <button
                                        onClick={() => setShowDailyDeals(false)}
                                        style={{
                                            background: 'rgba(255,255,255,0.2)',
                                            border: 'none',
                                            color: 'white',
                                            fontSize: '24px',
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
                                <DailyDeals 
                                    userId={user?.id}
                                    userReferralCount={userReferralCount}
                                    onClaimDeal={(deal) => {
                                        showToastNotification(`🎉 Claimed: ${deal.title || 'Deal'}`);
                                        loadReferralCount();
                                    }}
                                />
                            </div>
                        </div>
                    ) : showReferralProgram ? (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: '#121212',
                            zIndex: 20000,
                            overflow: 'auto',
                            animation: 'fadeIn 0.3s ease'
                        }}>
                            <div style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                padding: '20px',
                                position: 'sticky',
                                top: 0,
                                zIndex: 100
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    maxWidth: '1200px',
                                    margin: '0 auto'
                                }}>
                                    <h1 style={{ margin: 0, fontSize: '24px' }}>🎁 Referral Program</h1>
                                    <button
                                        onClick={() => setShowReferralProgram(false)}
                                        style={{
                                            background: 'rgba(255,255,255,0.2)',
                                            border: 'none',
                                            color: 'white',
                                            fontSize: '24px',
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
                                <ReferralProgram 
                                    userId={user?.id}
                                    userName={userName}
                                    onReferralComplete={() => {
                                        showToastNotification('🎉 Referral completed!');
                                        loadReferralCount();
                                    }}
                                />
                            </div>
                        </div>
                    ) : showToolsPanel ? (
                        <div className="tools-panel-container" style={{ width: '100%', padding: '1rem' }}>
                            <button 
                                onClick={() => setShowToolsPanel(false)}
                                style={{
                                    background: 'var(--primary-color)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 16px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '20px'
                                }}
                            >
                                ← Back to Search
                            </button>
                            <ToolsPanel 
                                user={user}
                                selectedMode={selectedMode}
                                onBack={() => setShowToolsPanel(false)}
                                showToastNotification={showToastNotification}
                            />
                        </div>
                    ) : showWishlist ? (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: '#121212',
                            zIndex: 20000,
                            overflow: 'auto',
                            animation: 'fadeIn 0.3s ease'
                        }}>
                            <div style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                padding: '20px',
                                position: 'sticky',
                                top: 0,
                                zIndex: 100
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    maxWidth: '1200px',
                                    margin: '0 auto'
                                }}>
                                    <h1 style={{ margin: 0, fontSize: '24px' }}>❤️ My Wishlist</h1>
                                    <button
                                        onClick={() => {
                                            window.history.back();
                                            setShowWishlist(false);
                                            setTimeout(() => {
                                                if (previousSearchState.productSearch !== undefined) {
                                                    setProductSearch(previousSearchState.productSearch);
                                                }
                                                if (previousSearchState.prospects !== undefined) {
                                                    setProspects(previousSearchState.prospects);
                                                }
                                                if (previousSearchState.productsFound !== undefined) {
                                                    setProductsFound(previousSearchState.productsFound);
                                                }
                                                if (previousSearchState.searchLoading !== undefined) {
                                                    setSearchLoading(previousSearchState.searchLoading);
                                                }
                                            }, 100);
                                        }}
                                        style={{
                                            background: 'rgba(255,255,255,0.2)',
                                            border: 'none',
                                            color: 'white',
                                            fontSize: '24px',
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
                                <WishlistManager onBack={() => {
                                    window.history.back();
                                    setShowWishlist(false);
                                }} />
                            </div>
                        </div>
                    ) : (
                        /* ============================================================ */
                        /* ========== RESULTS SECTION - FIXED RECOMMENDATIONS ========== */
                        /* ============================================================ */
                        
                        <div className="results-section">
    
                            {/* ✅ CASE 1: SELLER MODE - Show prospects */}
                            {selectedMode === 'seller' ? (
                                <>
                                    {/* Existing seller results */}
                                    <div className="seller-results-card">
                                        <div className="results-header">
                                            <h3>📈 Marketing Prospects</h3>
                                            <div className="results-stats">
                                                <span className="stat-item">
                                                    <strong>Your Location:</strong> {profileData?.location}
                                                </span>
                                                <span className="stat-item">
                                                    {prospects.length > 0 && (
                                                        <span className="same-location-count">
                                                            ({prospects.filter(p => p.isSameLocation).length} in your area)
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {prospects.length === 0 ? (
                                            <div className="empty-results">
                                                <div className="empty-icon">🔍</div>
                                                <h4>
                                                    {productSearch.trim() && !loading 
                                                        ? `No prospects found for "${productSearch}"`
                                                        : 'No prospects yet'}
                                                </h4>
                                                
                                                {productSearch.trim() && !loading ? (
                                                    <>
                                                        <p>No customers have "{productSearch}" in their interests yet.</p>
                                                        <div className="empty-tips">
                                                            <p><strong>Try searching for:</strong></p>
                                                            <ul>
                                                                <li>"Vests" - Found in existing interests</li>
                                                                <li>"trousers" - Found in existing interests</li>
                                                                <li>Other common products</li>
                                                            </ul>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <p>Enter a product above to find customers interested in buying it.</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="prospects-grid">
                                                {prospects.map((p, index) => (
                                                    <div key={p.id || index} className={`prospect-card ${p.isSameLocation ? 'same-location' : ''}`} style={{ position: 'relative' }}>
                                                        <div className="prospect-card-header">
                                                            <div className="prospect-avatar">
                                                                {p.email ? p.email.charAt(0).toUpperCase() : '?'}
                                                            </div>

                                                            {/* ✅ CIRCLE INDICATOR - BLUE or GREEN */}
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '10px',
                                                                right: '10px',
                                                                width: '14px',
                                                                height: '14px',
                                                                borderRadius: '50%',
                                                                background: contactedIds.includes(p.id) ? '#3B82F6' : '#22C55E',
                                                                boxShadow: '0 0 8px rgba(0,0,0,0.3)',
                                                                border: '2px solid white',
                                                                zIndex: 5,
                                                                transition: 'all 0.3s ease'
                                                            }} />
                                                            
                                                            <div className="prospect-identity">
                                                                <h4>Potential Customer</h4>
                                                                <p className="prospect-email">{p.email || 'No email'}</p>
                                                                {p.isSameLocation && (
                                                                    <div className="location-match-badge">
                                                                        <span className="match-icon">📍</span>
                                                                        <span className="match-text">Same Location</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="prospect-details">
                                                            <div className="detail-item">
                                                                <span className="detail-label">📍 Location:</span>
                                                                <span className={`detail-value ${p.isSameLocation ? 'highlight-location' : ''}`}>
                                                                    {p.location || 'Not specified'}
                                                                    {p.isSameLocation && " (Your Area)"}
                                                                </span>
                                                            </div>
                                                            <div className="detail-item phone-detail">
                                                                <span className="detail-label">📞 Phone:</span>
                                                                <span className="detail-value">{p.phone_number || 'N/A'}</span>
                                                            </div>

                                                            {/* ✅ SMART INTERESTS DISPLAY - Grouped by category */}
                                                            <div className="detail-item">
                                                                <span className="detail-label">🎯 Relevant Interests:</span>
                                                                <div className="detail-value" style={{ 
                                                                    display: 'block', 
                                                                    marginTop: '6px'
                                                                }}>
                                                                    {p.relevantInterests && p.relevantInterests.length > 0 ? (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                            {Object.entries(p.groupedInterests || {}).map(([category, items]) => (
                                                                                items.length > 0 && (
                                                                                    <div key={category} style={{
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '6px',
                                                                                        padding: '4px 8px',
                                                                                        backgroundColor: category === 'Other' ? '#f5f5f5' : '#f0f4ff',
                                                                                        borderRadius: '6px',
                                                                                        border: `1px solid ${category === 'Other' ? '#e0e0e0' : '#dce4f0'}`
                                                                                    }}>
                                                                                        <span style={{ 
                                                                                            fontWeight: '600', 
                                                                                            fontSize: '11px',
                                                                                            color: category === 'Other' ? '#666' : '#667eea',
                                                                                            minWidth: '60px'
                                                                                        }}>
                                                                                            {category === 'Other' ? '📌' : '📂'} {category}:
                                                                                        </span>
                                                                                        <span style={{ fontSize: '13px', color: '#333' }}>
                                                                                            {items.join(', ')}
                                                                                        </span>
                                                                                    </div>
                                                                                )
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <span style={{ color: '#999', fontSize: '13px' }}>No relevant interests found</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="detail-item">
                                                                <span className="detail-label">🎯 Interested in:</span>
                                                                <span className="detail-value highlight">{p.interest || 'Not specified'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="prospect-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                                                            <button 
                                                                onClick={() => saveToWishlist(p, 'prospect')}
                                                                style={{
                                                                    width: '100%',
                                                                    backgroundColor: '#9c27b0',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    padding: '10px',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 'bold',
                                                                    fontSize: '14px',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '8px',
                                                                    marginBottom: '5px'
                                                                }}
                                                            >
                                                                💾 Save Prospect
                                                            </button>
                                                            <button 
                                                                onClick={() => handleContact(p.id, p.phone_number, p.interest, 'seller', {
                                                                    id: p.id,   
                                                                    name: p.interest,
                                                                    image_url: null
                                                                })}
                                                                disabled={limits?.CONTACT?.remaining === 0}
                                                                style={{
                                                                    width: '100%',
                                                                    backgroundColor: '#25D366',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    padding: '12px',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 'bold',
                                                                    fontSize: '14px',
                                                                    cursor: limits?.CONTACT?.remaining === 0 ? 'not-allowed' : 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '8px',
                                                                    marginBottom: '10px',
                                                                    boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)'
                                                                }}
                                                            >
                                                                <span style={{ fontSize: '16px' }}>💬</span>
                                                                WhatsApp Customer
                                                                {limits?.CONTACT && limits.CONTACT.remaining < 3 && (
                                                                    <span style={{
                                                                        fontSize: '11px',
                                                                        marginLeft: '5px',
                                                                        padding: '2px 6px',
                                                                        backgroundColor: limits.CONTACT.remaining === 0 ? '#ff4444' : '#ffaa00',
                                                                        borderRadius: '10px',
                                                                        fontWeight: 'bold'
                                                                    }}>
                                                                        ({limits.CONTACT.remaining} left)
                                                                    </span>
                                                                )}
                                                            </button>
                                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                                <button 
                                                                    onClick={() => window.open(`tel:${p.phone_number}`, '_self')}
                                                                    style={smallButtonStyle('#3182ce')}
                                                                >
                                                                    📞 Call
                                                                </button>
                                                                <button 
                                                                    onClick={() => {
                                                                        const smsMessage = `Hi, I saw you're interested in ${p.interest}. I have this available for sale. Are you interested?`;
                                                                        window.open(`sms:${p.phone_number}?body=${encodeURIComponent(smsMessage)}`, '_self');
                                                                    }}
                                                                    style={smallButtonStyle('#f6ad55')}
                                                                >
                                                                    ✉️ SMS
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* ✅ NEW: Show alternative prospects when no prospects found */}
                                    {prospects.length === 0 && productSearch.trim() !== '' && user && (
                                        <div className="recommendations-container">
                                            <div className="no-results-message" style={{ 
                                                textAlign: 'center', 
                                                padding: '30px',
                                                marginBottom: '15px'
                                            }}>
                                                <div style={{ fontSize: '48px', marginBottom: '10px' }}>👥</div>
                                                <h4>No direct matches for "{productSearch}"</h4>
                                                <p style={{ color: '#666', marginBottom: '15px' }}>
                                                    Try these alternative buyers who might be interested:
                                                </p>
                                            </div>
                                            
                                            {/* Show alternative prospects */}
                                            <RecommendationsSection 
                                                userId={user.id}
                                                currentProductId={null}
                                                onProductClick={handleProductClick}
                                                isAlternativeProspects={true}
                                                searchTerm={productSearch}
                                            />
                                            
                                            {/* Button to Daily Deals */}
                                            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                                <button
                                                    onClick={() => setShowDailyDeals(true)}
                                                    style={{
                                                        padding: '12px 24px',
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '12px',
                                                        cursor: 'pointer',
                                                        fontWeight: 'bold',
                                                        fontSize: '14px',
                                                        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                                >
                                                    🔥 View Daily Deals
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* ✅ CASE 2: BUYER MODE - Show products + recommendations */
                                <>
                                    {/* ✅ 2a: Show search results if any */}
                                    {productsFound.length > 0 && (
                                        <div className="buyer-results-card">
                                            <div className="results-header">
                                                <h3>🛒 Available Products</h3>
                                                <div className="results-stats">
                                                    <span className="stat-item">
                                                        <strong>Your Location:</strong> {profileData?.location}
                                                    </span>
                                                    <span className="stat-item">
                                                        <strong>Products Found:</strong> {productsFound.length}
                                                    </span>
                                                    <span className="stat-item">
                                                        <button 
                                                            onClick={() => {
                                                                setProductSearch('');
                                                                fetchProducts();
                                                            }} 
                                                            className="refresh-data-button"
                                                            disabled={productsFetchLoading}
                                                            style={{
                                                                padding: '0.5rem 1rem',
                                                                background: 'var(--primary-color)',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: 'var(--border-radius-sm)',
                                                                cursor: productsFetchLoading ? 'not-allowed' : 'pointer',
                                                                fontSize: '0.9rem'
                                                            }}
                                                        >
                                                            {productsFetchLoading ? 'Refreshing...' : '🔄 Refresh All Products'}
                                                        </button>
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="products-grid">
                                                {safeArray(productsFound).map((p, index) => (
                                                    <div 
                                                        key={p?.id || `product-${index}`} 
                                                        className={`product-card ${index === 0 ? 'best-deal' : ''}`}
                                                        onClick={() => {
                                                            handleProductClick(p);
                                                        }}
                                                        style={{ cursor: 'pointer' , position: 'relative' }}
                                                    >
                                                        {index === 0 && <div className="best-deal-badge">🔥 Best Deal</div>}
                                                            
                                                        <div className="product-card-header">
                                                            <h4 className="product-name">{safeString(p?.name) || 'Unnamed Product'}</h4>
                                                            <div className="product-price">${safeNumber(p?.price)}</div>
                                                        </div>
                                                        
                                                        <div className="product-card-body">
                                                            {p?.description && (
                                                                <div className="product-description">
                                                                    <SafeHTML 
                                                                        htmlContent={safeString(p?.description)} 
                                                                        className="product-description-text"
                                                                        allowLinks={true}      
                                                                        allowImages={true}
                                                                    />
                                                                </div>
                                                            )}

                                                            {/* ✅ CIRCLE INDICATOR - BLUE or GREEN */}
                                                            {(() => {
                                                                const id = p?.seller_id || p?.id;
                                                                const isContacted = contactedIds.includes(id);
                                                                return (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        top: '10px',
                                                                        right: '10px',
                                                                        width: '14px',
                                                                        height: '14px',
                                                                        borderRadius: '50%',
                                                                        background: isContacted ? '#3B82F6' : '#22C55E', // Blue or Green
                                                                        boxShadow: '0 0 8px rgba(0,0,0,0.3)',
                                                                        border: '2px solid white',
                                                                        zIndex: 5,
                                                                        transition: 'all 0.3s ease',
                                                                        animation: isContacted ? 'none' : 'pulse 2s infinite'
                                                                    }} />
                                                                );
                                                            })()}
                                                            
                                                            {/* ✅ If not contacted, add subtle pulse animation */}
                                                            {!contactedIds.includes(p?.seller_id || p?.id) && (
                                                                <style>{`
                                                                    @keyframes pulse {
                                                                        0%, 100% { opacity: 1; transform: scale(1); }
                                                                        50% { opacity: 0.7; transform: scale(1.1); }
                                                                    }
                                                                `}</style>
                                                            )}
                                                            
                                                            {p?.image_url ? (
                                                                <img 
                                                                    src={safeString(p?.image_url)} 
                                                                    alt={safeString(p?.name) || 'Product'}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation(); // ✅ Prevent card click from firing
                                                                        setZoomedImage(safeString(p?.image_url));
                                                                    }}
                                                                    style={{ 
                                                                        width: '70px', 
                                                                        height: '70px', 
                                                                        borderRadius: '10px', 
                                                                        objectFit: 'cover', 
                                                                        cursor: 'zoom-in',
                                                                        marginTop: '10px',
                                                                        border: '2px solid #333'
                                                                    }} 
                                                                />
                                                            ) : (
                                                                <div style={{
                                                                    width: '70px',
                                                                    height: '70px',
                                                                    borderRadius: '10px',
                                                                    backgroundColor: '#333',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    marginTop: '10px',
                                                                }}>
                                                                    <span style={{ fontSize: '11px', color: '#888' }}>No Image</span>
                                                                </div>
                                                            )}
                                                            
                                                            <div className="product-location">
                                                                <span className="location-icon">📍</span>
                                                                {safeString(p?.location) || 'Location not specified'}
                                                            </div>
                                                            <div className="product-phone">
                                                                <span className="phone-icon">📞</span>
                                                                <strong>Seller Phone:</strong> {safeString(p?.phone_number) || 'N/A'}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="product-card-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px', padding: '10px' }}>
                                                            {/* 1. Save to Wishlist */}
                                                            <button 
                                                                onClick={() => saveToWishlist(p, 'product')}
                                                                style={{
                                                                    width: '100%',
                                                                    backgroundColor: '#9c27b0',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    padding: '10px',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 'bold',
                                                                    fontSize: '14px',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '8px'
                                                                }}
                                                            >
                                                                💖 Save to Wishlist
                                                            </button>

                                                            {/* 2. Contact Seller (Opens Modal) */}
                                                            <button 
                                                                onClick={() => setContactProduct(p)}
                                                                style={{
                                                                    width: '100%',
                                                                    backgroundColor: '#25D366',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    padding: '12px',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 'bold',
                                                                    fontSize: '14px',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '8px',
                                                                    boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)'
                                                                }}
                                                            >
                                                                💬 Contact Seller
                                                            </button>

                                                            {/* 3. View Seller Shop */}
                                                            <button 
                                                                onClick={() => navigate(`/buyer/shop/${p?.seller_id}`, { 
                                                                    state: { 
                                                                        sellerId: p?.seller_id, 
                                                                        claimedProductId: p?.id, 
                                                                        sellerName: 'Seller Shop' 
                                                                    } 
                                                                })} 
                                                                style={{
                                                                    width: '100%',
                                                                    backgroundColor: '#f1f5f9',
                                                                    color: '#0f172a',
                                                                    border: '1px solid #cbd5e1',
                                                                    padding: '12px',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 'bold',
                                                                    fontSize: '14px',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '8px'
                                                                }}
                                                            >
                                                                🏪 View Seller Shop
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                
                                                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                                                    {hasMore && safeArray(productsFound).length >= ITEMS_PER_PAGE && (
                                                        <button 
                                                            className="load-more-button"
                                                            onClick={loadMoreProducts}
                                                            disabled={loading}
                                                            style={{
                                                                padding: '10px 20px',
                                                                backgroundColor: '#667eea',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: loading ? 'not-allowed' : 'pointer'
                                                            }}
                                                        >
                                                            {loading ? 'Loading...' : 'Load More Products'}
                                                        </button>
                                                    )}
                                                    {!hasMore && safeArray(productsFound).length > 0 && (
                                                        <p className="end-message">You've seen all current products!</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* ✅ 2b: Show SIMILAR products when search HAS results */}
                                    {productsFound.length > 0 && user && (
                                        <div style={{ marginTop: '30px' }}>
                                            <RecommendationsSection 
                                                userId={user.id}
                                                currentProductId={null}
                                                onProductClick={handleProductClick}
                                                isSimilar={true}
                                                searchTerm={productSearch}
                                            />
                                        </div>
                                    )}
                                    
                                    {/* ✅ 2c: Show ALTERNATIVE products when search HAS NO results */}
                                    {productsFound.length === 0 && productSearch.trim() !== '' && user && (
                                        <div className="recommendations-container">
                                            <div className="no-results-message" style={{ 
                                                textAlign: 'center', 
                                                padding: '30px',
                                                marginBottom: '15px'
                                            }}>
                                                <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔍</div>
                                                <h4>No products found for "{productSearch}"</h4>
                                                <p style={{ color: '#666', marginBottom: '15px' }}>
                                                    Try adjusting your search or check out these alternatives:
                                                </p>
                                            </div>
                                            
                                            <RecommendationsSection 
                                                userId={user.id}
                                                currentProductId={null}
                                                onProductClick={handleProductClick}
                                                isAlternative={true}
                                                searchTerm={productSearch}
                                            />
                                            
                                            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                                <button
                                                    onClick={() => setShowDailyDeals(true)}
                                                    style={{
                                                        padding: '12px 24px',
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '12px',
                                                        cursor: 'pointer',
                                                        fontWeight: 'bold',
                                                        fontSize: '14px',
                                                        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                                >
                                                    🔥 View Daily Deals
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* ✅ 2d: No search performed yet - Show helpful message */}
                                    {productsFound.length === 0 && productSearch.trim() === '' && user && (
                                        <div style={{ 
                                            textAlign: 'center', 
                                            padding: '40px',
                                            color: '#666'
                                        }}>
                                            <p>Search for products to see results</p>
                                            <p style={{ fontSize: '13px', marginTop: '5px' }}>
                                                🔥 Try searching for popular items like "iPhone", "Headphones", or "Laptop"
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                            
                            {/* Global Loading Spinner */}
                            {globalLoading && (
                                <div style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                    zIndex: 999999,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backdropFilter: 'blur(4px)',
                                    animation: 'fadeIn 0.2s ease'
                                }}>
                                    <div style={{
                                        background: 'white',
                                        borderRadius: '20px',
                                        padding: '30px 40px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '20px',
                                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                                        minWidth: '280px',
                                        textAlign: 'center'
                                    }}>
                                        <div className="global-spinner" style={{
                                            width: '60px',
                                            height: '60px',
                                            border: '4px solid #f3f3f3',
                                            borderTop: '4px solid #667eea',
                                            borderRight: '4px solid #764ba2',
                                            borderRadius: '50%',
                                            animation: 'spin 0.8s linear infinite'
                                        }} />
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                                            {globalLoadingMessage}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#666' }}>
                                            Please wait...
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* SIMILAR PRODUCTS SUGGESTIONS (from findSimilarProducts) */}
                            {showSimilarProducts && similarProducts.length > 0 && (
                                <div className="similar-products-section">
                                    <div className="section-header" style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: '20px',
                                        padding: '15px',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        borderRadius: '10px',
                                        color: 'white'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '24px' }}>💡</span>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '18px' }}>You might also like</h3>
                                                <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                                                    Similar products to "{productSearch}"
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setShowSimilarProducts(false)}
                                            style={{
                                                background: 'rgba(255,255,255,0.2)',
                                                border: 'none',
                                                color: 'white',
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '14px'
                                            }}
                                        >
                                            Hide suggestions
                                        </button>
                                    </div>
                                    
                                    <div className="similar-products-grid" style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                        gap: '20px',
                                        marginTop: '10px'
                                    }}>
                                        {similarProducts.map((product, index) => (
                                            <div key={`similar-${product.id || index}`} className="similar-product-card" style={{
                                                background: '#f8f9fa',
                                                borderRadius: '10px',
                                                padding: '15px',
                                                border: '1px solid #e0e0e0',
                                                transition: 'all 0.3s ease'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                    <h4 style={{ margin: 0, fontSize: '16px', color: '#333' }}>
                                                        {product.name || 'Unnamed Product'}
                                                    </h4>
                                                    <span style={{
                                                        background: '#4CAF50',
                                                        color: 'white',
                                                        padding: '3px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '12px',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        ${product.price || '0'}
                                                    </span>
                                                </div>
                                                
                                                <div style={{ marginBottom: '10px' }}>
                                                    <span style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        📍 {product.location || 'Location not specified'}
                                                    </span>
                                                </div>
                                                
                                                <button 
                                                    onClick={() => {
                                                        setProductSearch(product.name);
                                                        setTimeout(() => handleSearch(), 100);
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '10px',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold',
                                                        marginTop: '10px',
                                                        transition: 'transform 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                                >
                                                    🔍 View this product
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>

                
            <footer className="app-footer">
                <div className="footer-content">
                    {/* CORRECT: Use Link from react-router-dom properly */}
                    <Link to="/terms" className="footer-link">
                    Terms of Service
                    </Link>
                    <Link to="/privacy" className="footer-link">  {/* ADD THIS */}
                    Privacy Policy
                    </Link>
                    <Link to="/help" className="footer-link">
                    Need Help?
                    </Link>
                    <span className="footer-text">© 2025 Straun Marketing</span>
                </div>
            </footer>

            {zoomedImage && (
                <div 
                    onClick={() => setZoomedImage(null)} 
                    style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.95)',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer'
                    }}
                >
                    <img 
                    src={zoomedImage} 
                    alt="Zoomed product"
                    style={{ 
                        maxWidth: '90%', 
                        maxHeight: '70%', 
                        borderRadius: '15px',
                        objectFit: 'contain',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                    }} 
                    onClick={(e) => e.stopPropagation()}
                    />
                    <p style={{ 
                    position: 'absolute',
                    bottom: '40px',
                    color: 'white',
                    fontSize: '14px',
                    background: 'rgba(0,0,0,0.7)',
                    padding: '8px 16px',
                    borderRadius: '20px'
                    }}>
                    Click anywhere to close
                    </p>
                </div>
                )}
            </div>
        </div>
    </div>

    <PWAInstallPrompt />
    
    <div className="mobile-nav-container">
    {/* Hamburger Menu Button - Only visible on mobile */}
    <button 
        className="mobile-menu-button" 
        onClick={toggleMobileMenu}
        aria-label="Menu"
    >
        <span className="menu-icon">☰</span>
    </button>

    </div>

    {/* Chat List Modal */}
    {showChatList && (
        <div style={styles.modalOverlay} onClick={() => setShowChatList(false)}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                <ChatList
                    userId={user?.id}
                    onSelectChat={(chat) => {
                        setSelectedChat({
                            otherUserId: chat.otherUserId,
                            otherUserName: chat.otherUser?.username,
                            productId: chat.product_id,
                            productName: chat.product?.name
                        });
                        setShowChatList(false);
                        setShowChat(true);
                    }}
                    onClose={() => setShowChatList(false)}
                />
            </div>
        </div>
    )}

    {/* Chat Modal */}
    {showChat && selectedChat && (
        <div style={styles.modalOverlay} onClick={() => setShowChat(false)}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                <ChatSystem
                    currentUserId={user?.id}
                    otherUserId={selectedChat.otherUserId}
                    otherUserName={selectedChat.otherUserName}
                    productId={selectedChat.productId}
                    productName={selectedChat.productName}
                    onClose={() => setShowChat(false)}
                />
            </div>
        </div>
    )}

    {/* ✅ NEW: Contact Modal */}
    {contactProduct && (
        <ContactModal 
            product={contactProduct} 
            onClose={() => setContactProduct(null)} 
        />
    )}
    
    <InterestPopup />
    </div>
     
    );
    
};

export default SocialAIMarketingEngine;
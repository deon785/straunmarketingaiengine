import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate , useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import './App.css';

// --- Components ---
import SellerSetupForm from './SellerSetupForm'; 
import BuyerSetupForm from './BuyerSetupForm'; 
import SafeHTML from './SafeHTML.jsx';
import UserSettings from './UserSettings.jsx';
import DOMPurify from 'dompurify';
import TopNavigationBar from './TopNavigationBar';
import { Link } from 'react-router-dom';

import ReactGA from "react-ga4";
import WishlistManager from './WishlistManager.jsx';
import { useAuth } from './AuthContext.jsx';
import { SmartRateLimiter } from './smartRateLimiter.js';
import ReportButton from './ReportButton.jsx';

import { UserActivityTracker } from './userActivityTracker.js';
import SimpleAdmin from './SimpleAdmin.jsx';
import ToolsPanel from './ToolsPanel.jsx';
import { fscrub } from 'fpoint';

import PriceAlertButton from './PriceAlertButton.jsx';
import RecommendationsSection from './RecommendationsSection';
import RecommendationEngine from './recommendationEngine';

import DailyDeals from './DailyDeals';
import ReferralProgram from './ReferralProgram';
import UserDashboard from './UserDashboard';
import ChatList from './ChatList';
import ChatSystem from './ChatSystem.jsx';
import PriceAlertDashboard from './PriceAlertDashboard';

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
    const { user, loading: authLoading } = useAuth();

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
    const [selectedMode, setSelectedMode] = useState(null);
    const [showSellerDecision, setShowSellerDecision] = useState(false);
    const [isProfileComplete, setIsProfileComplete] = useState(false);
    
    // --- APP STATE ---
    const [prospects, setProspects] = useState([]);
    const [productsFound, setProductsFound] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // --- NEW STATE FOR ALL PRODUCTS ---
    const [allProducts, setAllProducts] = useState([]);
    
    // --- PROFILE DATA ---
    const [profileData, setProfileData] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false); 
    const [showSettings, setShowSettings] = useState(false);
    
    // Add these to your state declarations
    const [initialDataLoading, setInitialDataLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [profileUpdateLoading, setProfileUpdateLoading] = useState(false);
    const [productsFetchLoading, setProductsFetchLoading] = useState(false);

    const [signOutLoading, setSignOutLoading] = useState(false);

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [zoomedImage, setZoomedImage] = useState(null);

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
 
    const [limits, setLimits] = useState({});
    const [showSafetyWarning, setShowSafetyWarning] = useState(false);
    const [similarProducts, setSimilarProducts] = useState([]);
    const [showSimilarProducts, setShowSimilarProducts] = useState(false);
    const [similarProductsLoading, setSimilarProductsLoading] = useState(false);

    const [isFilterCollapsed, setIsFilterCollapsed] = useState(true);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showToolsPanel, setShowToolsPanel] = useState(false);

    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [hasBeenPrompted, setHasBeenPrompted] = useState(false);

    const userInitials = user?.email ? user.email.charAt(0).toUpperCase() : '?';
    const userName = profileData?.username || user?.email?.split('@')[0] || 'User';
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
    const [showDashboard, setShowDashboard] = useState(false);
    const [showDailyDeals, setShowDailyDeals] = useState(false);
    const [userReferralCount, setUserReferralCount] = useState(0);

    const [showReferralProgram, setShowReferralProgram] = useState(false);
    const [currentProduct, setCurrentProduct] = useState(null);
    const [currentPrice, setCurrentPrice] = useState(0);

    const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    location: '',
    sortBy: 'newest', // 'newest', 'price_low', 'price_high'
    category: '' // Optional: if you have categories
    });

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

    // Calculate active filter count
    const activeFilterCount = Object.values(filters).filter(val => 
        (typeof val === 'string' && val !== '' && val !== 'newest') || 
        (typeof val === 'number' && val !== 0)
    ).length;

    const loadMoreProducts = async () => {
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
                // Close all modals and return to main view
                setShowWishlist(false);
                setShowDashboard(false);
                setShowDailyDeals(false);
                setShowReferralProgram(false);
                setShowPriceAlerts(false);
                setShowSavedSearches(false);
                setShowToolsPanel(false);
                setShowChatList(false);
                setShowChat(false);
                setShowSettings(false);
                setProductSearch('');  // Clear search
                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
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
                
            case 'wishlist':
                setPreviousSearchState({
                    productSearch: productSearch,
                    prospects: prospects,
                    productsFound: productsFound,
                    searchLoading: searchLoading
                });
                window.history.pushState({ showWishlist: true }, '', '#wishlist');
                setShowWishlist(true);
                break;
                
            case 'dashboard':
                setShowDashboard(true);
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
                navigate('/admin');
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
                .limit(50); // Limit to prevent large data loads

            if (error) {
                console.error('Error fetching notifications:', error);
                return;
            }

            if (!data) {
                setNotifications([]);
                setUnreadCount(0);
                return;
            }

            // Update state
            setNotifications(data || []);
            
            // Calculate unread count
            const unread = (data || []).filter(n => !n.read).length;
            setUnreadCount(unread);

        } catch (error) {
            console.error('Unexpected error fetching notifications:', error);
            // Don't crash the app - just log the error
        }
    }, [user]);

    const PushEnableButton = () => {
        const handleEnable = async () => {
            // 1. Ask browser for permission
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
            // 2. Run the subscription function we wrote earlier
            await subscribeToPush(); 
            alert("Notifications enabled! You'll receive updates like WhatsApp.");
            } else {
            alert("You denied notifications. Please enable them in browser settings to get updates.");
            }
        };

        return (
            <button onClick={handleEnable} className="push-btn">
            🔔 Enable Push Notifications
            </button>
        );
    };

    // Enable push notifications even when browser is closed
    const setupPushNotifications = async () => {
    // Register service worker
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.register('/sw.js');
            
            // Request permission
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY'
            });
            
            // Save to Supabase
            await supabase.from('push_subscriptions').insert([{
                user_id: user.id,
                subscription: subscription,
                device_info: navigator.userAgent
            }]);
            }
        }
    // Send push for:
    // - New matches (instant)
    // - Price drops on saved items
    // - Daily digest of new products
    // - When someone views your product
    };

    // Subscribe to push notifications using Supabase Edge Function
    const subscribeToPush = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            showToastNotification('⚠️ Push notifications not supported');
            return false;
        }

        try {
            setPushLoading(true);
            
            const registration = await navigator.serviceWorker.ready;
            const permission = await Notification.requestPermission();
            
            if (permission !== 'granted') {
                showToastNotification('❌ Please allow notifications');
                return false;
            }

            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
                // Use VAPID public key from environment
                const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
                
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
                });
            }
            
            // Call your edge function
            const response = await fetch('https://mmcwfoqajkfnohbonaqa.supabase.co/functions/v1/send-push-notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'subscribe',
                    subscription: subscription,
                    userId: user.id,
                    userAgent: navigator.userAgent
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
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
        // Get user's interests
        const { data: profile } = await supabase
        .from('profiles')
        .select('interests, search_history, viewed_products')
        .eq('user_id', userId)
        .single();
        
        // Find products based on interests + behavior
        const recommendations = await supabase
        .from('products')
        .select('*')
        .or(`name.ilike.%${profile.interests.join('%')}%`)
        .limit(20);
        
        return recommendations;
    }
    };

    const handleProductClick = (product) => {
        setLastViewedProduct(product);
        // Track the view
        const engine = new RecommendationEngine(user.id);
        engine.trackBehavior(product.id, 'view');
        // You can also navigate to product detail or show modal
        showToastNotification(`Viewing: ${product.name}`);
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
        await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId);
        
        setNotifications(prev => 
            prev.map(n => n.id === notificationId ? {...n, read: true} : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const validatePhoneNumber = (phone) => {
        const clean = phone.replace(/\D/g, '');
        return clean.length >= 9 && clean.length <= 12;
    };

    // --- HANDLE WHATSAPP CONTACT WITH NOTIFICATIONS & GA TRACKING ---  
    const handleContact = async (targetUserId, targetPhoneNumber, targetName, type, product) => {
        const engine = new RecommendationEngine(user.id);
        await engine.trackBehavior(product?.id, 'contact');

        await supabase.rpc('track_user_activity', {
            p_user_id: user.id,
            p_activity_type: 'contact',
            p_metadata: { targetUserId: targetUserId, type: type }
        });
     
        if (!smartLimiterInstance) {
            // Only initialize if not already done
            initializeRateLimiter();
        }
        
        // Behavior check
        if (!user) {
            alert('Please log in to contact');
            return;
        }
        
        // Check rate limit using the smart rate limiter instance
        let check;
        try {
            check = await smartLimiterInstance.checkAndUpdate(user.id, 'CONTACT', {
                targetId: targetUserId,
                type: type,
                product: product?.name
            });
            
            if (!check.allowed) {
                alert(`Contact blocked: ${check.reason}`);
                return;
            }
        } catch (error) {
            console.error('Rate limit check error:', error);
            // Continue anyway if rate limiter fails
        }
        setOpeningWhatsApp(true);

        if (!validatePhoneNumber(targetPhoneNumber)) {
            alert("This user has an invalid phone number. We cannot connect you.");
            setOpeningWhatsApp(false);
            return;
        }

        try {
            if (behaviorAnalyzerInstance) {
                behaviorAnalyzerInstance.recordUserAction(user.id, 'contact_attempt', {
                    targetId: targetUserId,
                    contactType: type,
                    productName: product?.name
                });
            }

            // ===== ORIGINAL CONTACT LOGIC =====
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
            .from('profiles')
            .select('phone_number')
            .eq('id', currentUser?.id)
            .single();

            await supabase.from('notifications').insert([
            { 
                user_id: targetUserId,
                sender_id: currentUser?.id,
                product_id: product?.id,
                buyer_phone: profile?.phone_number || 'No phone provided',
                product_image: product?.image_url,
                message: type === 'seller'
                ? `📢 New buyer interested in ${targetName}!` 
                : `👋 Seller is reaching out about ${targetName}!`,
                link_type: type,    
                status: 'unread'
            }
            ]);

            await UserActivityTracker.trackContact(
                user.id,
                targetUserId,
                product?.id,
                'whatsapp',
                true,
                null
            );

            if (!targetPhoneNumber) {
            alert('Phone number not available');
            setOpeningWhatsApp(false);
            return;
            }
            
            const cleanNumber = targetPhoneNumber.replace(/\D/g, '');
            const finalNumber = cleanNumber.startsWith('263') 
            ? cleanNumber 
            : `263${cleanNumber.replace(/^0/, '')}`;
            
            const message = encodeURIComponent(
            type === 'seller' 
                ? `Hi! I saw you're interested in ${targetName}. I have this available for sale. Are you interested?` 
                : `Hi! I'm interested in your ${targetName}. Is it still available?`
            );
            
            const whatsappUrl = `https://wa.me/${finalNumber}?text=${message}`;
            window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
                
            if (typeof ReactGA !== 'undefined') {
            ReactGA.event({
                category: 'Conversion',
                action: 'WhatsApp Contact Clicked',
                label: type
            });
            }
            
            setLimits(prev => ({
                ...prev,
                CONTACT: check || { remaining: 4, total: 5 } // Default if check not available
            }));

        } catch (error) {
            console.error('Error in handleContact:', error);
            alert('Failed to initiate WhatsApp contact. Please try again.');
        } finally {
            setOpeningWhatsApp(false);
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

    // Fetch products with seller info
    const fetchProducts = useCallback(async (searchTerm = '') => {
        setProductsFetchLoading(true);
        setError(null);
        try {
            // Start with base query
            let query = supabase
                .from('products')
                .select('*')
                .ilike('name', `%${searchTerm}%`);

            // Apply filters when fetching all products
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
                const { data: sellers, error: sellersError } = await supabase
                    .from('profiles')
                    .select('user_id, username, location, phone_number, is_seller')
                    .in('user_id', sellerIds);

                if (!sellersError && sellers) {
                    sellersMap = sellers.reduce((map, seller) => {
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
    }, [user , selectedMode , filters]);

   // --- SAVE TO WISHLIST FUNCTION ---
    const saveToWishlist = async (item, itemType = 'product') => {
        const engine = new RecommendationEngine(user.id);
        await engine.trackBehavior(item.id, 'save');

        await supabase.rpc('track_user_activity', {
            p_user_id: user.id,
            p_activity_type: 'save',
            p_metadata: { itemName: item.name, itemType: itemType }
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
        }
    };
 
    // --- CHECK FOR MATCHES FUNCTION ---
    const checkForMatches = async (userId, searchTerm = '', productData = null) => {
        try {
            const { data: currentUser } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

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
                            status: 'unread'
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
                                await supabase.from('notifications').insert([{
                                    user_id: buyer.user_id,
                                    sender_id: userId,
                                    product_id: productData.id,
                                    message: `🎯 New match! Seller listed "${productData.name}" that matches your interests!`,
                                    link_type: 'product_match',
                                    status: 'unread'
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

    // --- FIND SIMILAR PRODUCTS FUNCTION ---
    const findSimilarProducts = useCallback(async (searchTerm, excludeIds = []) => {
        if (!searchTerm || searchTerm.trim().length < 2) {
            setSimilarProducts([]);
            setShowSimilarProducts(false);
            return;
        }

        setSimilarProductsLoading(true);

        try {
            const sanitizedSearch = sanitizeProductName(searchTerm);
            const searchTermLower = sanitizedSearch.toLowerCase();
            
            // Get word variations for better matching
            const variations = getWordVariations(searchTermLower);
            const searchWords = [...new Set([searchTermLower, ...variations])];
            
            console.log('🔍 Searching similar products for:', searchTerm, 'variations:', searchWords);
            
            // Query for products with similar names
            let allSimilarProducts = [];
            
            // Try each variation
            for (const word of searchWords) {
                if (word.length < 2) continue;
                
                // FIXED: Correct Supabase query syntax
                let query = supabase
                    .from('products')
                    .select('name, price, location, description, seller_id, created_at, phone_number, image_url, id')
                    .ilike('name', `%${word}%`)
                    .limit(10);
                
                // Only add .not() if we have IDs to exclude
                if (excludeIds.length > 0) {
                    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
                }
                
                const { data: products, error } = await query;
                
                if (!error && products) {
                    allSimilarProducts = [...allSimilarProducts, ...products];
                }
            }
            
            // Remove duplicates by product id
            const uniqueProducts = Array.from(
                new Map(allSimilarProducts.map(p => [p.id, p])).values()
            );
            
            // Sort by relevance (exact matches first, then partial matches)
            const sortedProducts = uniqueProducts.sort((a, b) => {
                const aName = a.name ? a.name.toLowerCase() : '';
                const bName = b.name ? b.name.toLowerCase() : '';
                
                // Exact match gets highest priority
                if (aName === searchTermLower && bName !== searchTermLower) return -1;
                if (aName !== searchTermLower && bName === searchTermLower) return 1;
                
                // Starts with search term gets next priority
                if (aName.startsWith(searchTermLower) && !bName.startsWith(searchTermLower)) return -1;
                if (!aName.startsWith(searchTermLower) && bName.startsWith(searchTermLower)) return 1;
                
                // Contains search term
                if (aName.includes(searchTermLower) && !bName.includes(searchTermLower)) return -1;
                if (!aName.includes(searchTermLower) && bName.includes(searchTermLower)) return 1;
                
                // Sort by price (cheaper first)
                return (a.price || 0) - (b.price || 0);
            });
            
            // Limit to 6 similar products max
            const limitedProducts = sortedProducts.slice(0, 6);
            
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
    }, []);

    // Fetch user profile
    const fetchProfile = useCallback(async () => {  
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();
            
            if (error) {
                console.error("❌ Profile fetch error:", error);
                return;
            }
            
            setProfileData(data);
            return data;  // ✅ Just return profile
        } catch (err) {
            console.error("❌ Error in fetchProfile:", err);    
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
                <h4 style={{ margin: '0 0 10px 0' }}>Recent Activity</h4>
                {events.map((event, idx) => (
                    <div key={idx} style={{
                        padding: '8px 0',
                        borderBottom: idx < events.length - 1 ? '1px solid #eee' : 'none',
                        fontSize: '14px',
                        color: '#555'
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
                background: '#f0f7ff',
                borderRadius: '12px',
                padding: '15px',
                marginTop: '15px'
            }}>
                <h4 style={{ margin: '0 0 10px 0' }}>💡 Insights & Tips</h4>
                {tips.map((tip, idx) => (
                    <p key={idx} style={{ fontSize: '13px', color: '#555', margin: '5px 0' }}>
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
                // Register the service worker
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker registered with scope:', registration.scope);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('🔄 New service worker found:', newWorker);
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('✨ New version available');
                            showToastNotification('New version available! Refresh to update.');
                        }
                    });
                });
                
                // Handle controller change
                let refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (refreshing) return;
                    refreshing = true;
                    console.log('🔄 Service worker changed, refreshing...');
                    window.location.reload();
                });
                
                // Check if we should auto-subscribe to push
                const hasPromptedForPush = localStorage.getItem('push_prompted');
                if (!hasPromptedForPush && user && isProfileComplete) {
                    // Wait a bit before asking for push permission
                    setTimeout(async () => {
                        const permission = await Notification.requestPermission();
                        if (permission === 'granted') {
                            localStorage.setItem('push_prompted', 'true');
                            // Don't auto-subscribe, let user choose via button
                        }
                    }, 5000);
                }
                
            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
            }
        };
        
        registerServiceWorker();
    }, [user, isProfileComplete]);

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
    useEffect(() => {
        const handleHashChange = () => {
            if (window.location.hash !== '#wishlist' && showWishlist) {
                // Hash changed from #wishlist to something else (user clicked back)
                setShowWishlist(false);
            }
            if (window.location.hash === '#wishlist' && !showWishlist) {
                // Hash changed to #wishlist (user clicked forward or typed URL)
                setShowWishlist(true);
            }
        };
        
        const handlePopState = (event) => {
            // Handle browser back/forward buttons
            handleHashChange();
            
            // Restore previous state if needed (optional)
            if (event.state && event.state.previousState) {
                const { previousState } = event.state;
                setProductSearch(previousState.productSearch);
                setProspects(previousState.prospects);
                setProductsFound(previousState.productsFound);
                setSearchLoading(previousState.searchLoading);
            }
        };
        
        window.addEventListener('hashchange', handleHashChange);
        window.addEventListener('popstate', handlePopState);
        
        return () => {
            window.removeEventListener('hashchange', handleHashChange);
            window.removeEventListener('popstate', handlePopState);
        };
    }, [showWishlist]);

    // Combined useEffect for initial data load
    useEffect(() => {
        if (user && !profileData) { 
            setInitialDataLoading(true);
            fetchProfile().finally(() => {
                setInitialDataLoading(false);
            });
        }
    }, [user, fetchProfile]);  

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
            if (!user) return;
            
            try {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                
                // Check if email matches admin email
                const isAdminUser = authUser?.email === 'deonmahachi8@gmail.com';
                setIsAdmin(isAdminUser);
                
                if (isAdminUser) {
                    console.log('✅ Admin user detected:', authUser.email);
                }
            } catch (error) {
                console.error('Error checking admin status:', error);
            }
        };
        
        if (user) {
            checkAdminStatus();
        }
    }, [user]);

    // Listen for real-time notifications
    useEffect(() => {
        if (!user || !user.id) {
            console.log('No user found for notification subscription');
            return;
        }

        let notificationSubscription;
        let reconnectTimeout;
        let retryCount = 0;
        const MAX_RETRIES = 5;
        const BASE_RETRY_DELAY = 1000;

        const connectToNotifications = async () => {
            try {
                // Clean up any existing subscription
                if (notificationSubscription) {
                    await supabase.removeChannel(notificationSubscription);
                }

                notificationSubscription = supabase
                    .channel(`notifications-${user.id}`)
                    .on(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'notifications',
                            filter: `user_id=eq.${user.id}`
                        },
                        async (payload) => {
                            try {
                                // Validate payload
                                if (!payload.new || !payload.new.message) {
                                    console.warn('Received invalid notification payload:', payload);
                                    return;
                                }

                                // Play sound
                                playNotificationSound();

                                // Show toast notification (silently, without error messages)
                                showToastNotification(payload.new.message);

                                // Fetch updated notifications
                                await fetchNotifications();

                            } catch (error) {
                                console.error('Error processing notification:', error);
                            }
                        }
                    )
                    .on('system', { event: 'disconnect' }, () => {
                        console.log('Notification channel disconnected, attempting reconnect...');
                        // SILENT RECONNECT - Don't show error to user
                        scheduleReconnect();
                    })
                    .on('system', { event: 'reconnect' }, () => {
                        console.log('Notification channel reconnected');
                        retryCount = 0;
                    })
                    .subscribe((status, error) => {
                        if (status === 'SUBSCRIBED') {
                            console.log('✅ Successfully subscribed to notifications channel');
                            retryCount = 0;
                        }
                        
                        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                            console.log('Notification channel connection issue, will retry:', error?.message || error);
                            scheduleReconnect();
                        }
                    });

            } catch (error) {
                console.log('Error setting up notification subscription, will retry:', error);
                scheduleReconnect();
            }
        };

        const scheduleReconnect = () => {
            if (retryCount >= MAX_RETRIES) {
                console.log('Max retry attempts reached for notification subscription. Will resume when page is active.');
                
                // SILENT FAILURE - Don't show error to user
                // Only try to reconnect when user becomes active again
                const handleVisibilityChange = () => {
                    if (!document.hidden) {
                        console.log('Page became visible, attempting to reconnect notifications...');
                        retryCount = 0;
                        connectToNotifications();
                        document.removeEventListener('visibilitychange', handleVisibilityChange);
                    }
                };
                
                document.addEventListener('visibilitychange', handleVisibilityChange);
                return;
            }

            // Exponential backoff
            const delay = BASE_RETRY_DELAY * Math.pow(2, retryCount);
            retryCount++;

            console.log(`Scheduling reconnection attempt ${retryCount} in ${delay}ms`);

            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }

            reconnectTimeout = setTimeout(() => {
                console.log(`Attempting reconnect ${retryCount}/${MAX_RETRIES}...`);
                connectToNotifications();
            }, delay);
        };

        // Initial connection
        connectToNotifications();

        // Add visibility change listener for background reconnection
        const handleVisibilityChange = () => {
            if (!document.hidden && retryCount >= MAX_RETRIES) {
                console.log('Page became visible, attempting to reconnect notifications...');
                retryCount = 0;
                connectToNotifications();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup function
        return () => {
            console.log('Cleaning up notification subscription');
            
            // Remove visibility change listener
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            
            // Clear any pending reconnect timeout
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            
            // Remove channel subscription
            if (notificationSubscription) {
                supabase.removeChannel(notificationSubscription).catch(error => {
                    console.log('Error removing notification channel:', error);
                });
            }
        };
    }, [user, fetchNotifications, showToastNotification]);

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

    // --- CHECK EXISTING PROFILE DATA ---
    useEffect(() => {
        const checkExistingProfile = async () => {
            if (!user) {
                setProfileData(null);
                setProfileLoading(false);
                return;
            }
            
            setProfileLoading(true);
            
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
            } finally {
                setProfileLoading(false);
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
                        
                        // Get user's active search alerts
                        const { data: userAlerts } = await supabase
                            .from('search_alerts')
                            .select('*')
                            .eq('user_id', user.id)
                            .eq('is_active', true);

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
                            
                            // All checks passed - send notification
                            await supabase.from('notifications').insert([{
                                user_id: user.id,
                                sender_id: newProduct.seller_id,
                                product_id: newProduct.id,
                                product_image: newProduct.image_url,
                                message: `🚨 ALERT MATCH! New "${newProduct.name}" ($${newProduct.price}) matches your saved search "${alert.search_term}"!`,
                                link_type: 'search_alert_match',
                                status: 'unread',
                                created_at: new Date().toISOString()
                            }]);
                            
                            // Update last notified time
                            await supabase
                                .from('search_alerts')
                                .update({ last_notified_at: new Date().toISOString() })
                                .eq('id', alert.id);
                            
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
                    filter: `seller_id=neq.${user.id}` // Not user's own products
                },
                async (payload) => {
                    try {
                        const newProduct = payload.new;
                        if (!newProduct || !newProduct.name) {
                            console.warn('Invalid product data:', newProduct);
                            return;
                        }
                        
                        // Get current user's interests
                        const { data: currentProfile } = await supabase
                            .from('profiles')
                            .select('interests')
                            .eq('user_id', user.id)
                            .single();
                        
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
                            // Send notification
                            await supabase.from('notifications').insert([{
                                user_id: user.id,
                                sender_id: newProduct.seller_id,
                                product_id: newProduct.id,
                                product_image: newProduct.image_url,
                                message: `🚀 NEW MATCH! "${newProduct.name}" was just listed ($${newProduct.price || '0'})!`,
                                link_type: 'real_time_product_match',
                                status: 'unread',
                                created_at: new Date().toISOString()
                            }]);
                            
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
                        
                        // Get seller's products
                        const { data: sellerProducts } = await supabase
                            .from('products')
                            .select('name')
                            .eq('seller_id', user.id);
                        
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
                            await supabase.from('notifications').insert([{
                                user_id: user.id,
                                sender_id: newBuyer.user_id,
                                message: `🎯 New potential customer! "${newBuyer.username}" is interested in products like "${matchedProduct}"`,
                                link_type: 'real_time_buyer_match',
                                status: 'unread',
                                created_at: new Date().toISOString()
                            }]);
                            
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

    
    const [previousSearchState, setPreviousSearchState] = useState({
        productSearch: '',
        prospects: [],
        productsFound: [],
        searchLoading: false
    });

    // --- HANDLE MODE SELECTION ---
    const handleModeSelect = (mode) => {
        setSelectedMode(mode);
        setIsProfileComplete(false);
        setError(null);

        // Instead of going directly to setup form, show decision page for sellers
        if (mode === 'seller') {
            setShowSellerDecision(true); // Show decision page
        } else {
            // Buyers go directly to setup form
            setIsProfileComplete(false); // This will show the setup form
        }
        
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
    };

    const handleSellerClick = () => {
        // Instead of going directly to seller form
        // navigate('/seller-form');
        
        // Now go to decision page first
        navigate('/seller-decision');
    };

    // Clear state when changing modes
    const clearAndSetMode = (mode) => {
        handleModeSelect(mode);
    };

    const clearAndSwitchMode = () => {
        handleSwitchMode();
    };

    // --- HANDLE SWITCH MODE ---
    const handleSwitchMode = () => {
        setSelectedMode(null);
        setIsProfileComplete(false);
        setProfileData(null);
        setProductsFound([]);
        setProspects([]);
        setProductSearch('');
        setError(null);
        setAllProducts([]);
        setCurrentPage(0);
        setHasMore(true);
        setSearchCache({});
    };

    // --- HANDLE PROFILE COMPLETION ---
    const handleProfileComplete = async (details) => {
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
                    created_at: new Date().toISOString()
                };

                const { data: savedProduct, error: productError } = await supabase
                    .from('products')
                    .insert([productInsert])
                    .select()
                    .single();

                if (productError) {
                    console.error("❌ Error saving product:", productError);
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
                                            status: 'unread',
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
            setShowSellerDecision(false);

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
    };

    // --- SIMPLIFIED SEARCH FUNCTION (LIKE PREVIOUS VERSION) ---
    const handleSearch = async () => {
        const sanitizedSearch = sanitizeProductName(productSearch);
        const engine = new RecommendationEngine(user.id);
        await engine.trackBehavior(null, 'search', sanitizedSearch);

        await supabase.rpc('track_user_activity', {
                p_user_id: user.id,
                p_activity_type: 'search',
                p_metadata: { searchTerm: sanitizedSearch }
        });

        setSearchLoading(true);
        setError(null);
        setShowSafetyWarning(false)
        try {
            const sanitizedSearch = sanitizeProductName(productSearch);
            
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
            params.delete('page'); // Reset to page 1 on new search
            
            // Use pushState to add to history stack (for back button)
            window.history.pushState({}, '', `${location.pathname}?${params.toString()}`);
            
            // Update search params state
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

            // ✅ ADD THIS: Show PWA install prompt after successful search results
            if ((selectedMode === 'seller' && prospects.length > 0) || 
                (selectedMode === 'buyer' && productsFound.length > 0)) {
                
                // Check if we haven't prompted this session yet
                const hasPromptedThisSession = sessionStorage.getItem('pwaPrompted');
                
                if (!hasPromptedThisSession && deferredPrompt && !hasBeenPrompted) {
                    // Wait 2 seconds so user can see results first
                    setTimeout(() => {
                        setShowInstallPrompt(true);
                        setHasBeenPrompted(true);
                        sessionStorage.setItem('pwaPrompted', 'true');
                    }, 2000);
                }
            }

        } catch (error) {
            setError(error.message || 'Search failed');
        } finally {
            setSearchLoading(false);
        }
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

    // --- FIND PRODUCTS (BUYER MODE) ---
    const findProducts = useCallback(async (searchTerm, useFilters = false) => {
        console.log('🔍 Starting findProducts with search:', searchTerm);
        
        if (!user) {
            setError('Please log in to search');
            return;
        }

        setShowSafetyWarning(false);
        setShowSimilarProducts(false);

        const cacheKey = searchTerm.toLowerCase().trim();
        if (searchCache[cacheKey] && !useFilters) {
            console.log('Cache hit for:', cacheKey);
            setProductsFound(searchCache[cacheKey]);
            return;
        }

        setSearchLoading(true);
        setError(null);
        
        try {
            const sanitizedSearch = sanitizeProductName(searchTerm);
            
            if (!sanitizedSearch || sanitizedSearch.length < 2) {
            setError('Please enter a product name with at least two characters.');
            return;
            }

            console.log('📋 Fetching products from database...');
            
            // Start with base query
            let query = supabase
            .from('products')
            .select('name, price, location, description, seller_id, created_at, phone_number, image_url, id')
            .ilike('name', `%${sanitizedSearch}%`);
            
            // Apply filters if requested
            if (useFilters) {
            query = applyFiltersToQuery(query, filters);
            } else {
            // Default sorting by price ascending when no filters
            query = query.order('price', { ascending: true });
            }

            const { data: products, error: fetchError } = await query;

            if (fetchError) {
            console.error('❌ Error fetching products:', fetchError);
            setError(`Failed to fetch products: ${fetchError.message}`);
            return;
            }

            const productsData = products || [];
            console.log(`✅ Found ${productsData.length} products for: "${sanitizedSearch}"`);
            
            if (productsData.length === 0) {
            console.log('⚠️ No products found in database');
            await findSimilarProducts(sanitizedSearch);
            } else {
            if (productsData.length < 3) {
                const excludeIds = productsData.map(p => p.id);
                await findSimilarProducts(sanitizedSearch, excludeIds);
            }
            }

            if (productsData.length > 0) {
            setShowSafetyWarning(true);
            }
            
            // Save to cache only if not using filters
            if (!useFilters) {
            setSearchCache(prev => ({
                ...prev,
                [cacheKey]: productsData
            }));
            }

            // Update products found state
            setProductsFound(productsData);

            // 🔔 REAL-TIME MATCH NOTIFICATION
            if (productsData && productsData.length > 0 && selectedMode === 'buyer') {
            try {
                const uniqueSellerIds = [...new Set(productsData
                .filter(p => p.seller_id && p.seller_id !== user.id)
                .map(p => p.seller_id)
                )];
                
                if (uniqueSellerIds.length > 0) {
                for (const sellerId of uniqueSellerIds) {
                    await supabase.from('notifications').insert([{
                    user_id: sellerId,
                    sender_id: user.id,
                    message: `🔍 A buyer searched for "${sanitizedSearch}" and found your products!`,
                    link_type: 'search_match',
                    status: 'unread',
                    created_at: new Date().toISOString()
                    }]);
                }
                }
            } catch (notificationError) {
                console.error('Error notifying sellers:', notificationError);
            }
            }

            // Log the search
            try {
            await supabase.from('searches').insert([
                { 
                buyer_id: user.id, 
                seller_id: null,
                product_name: sanitizedSearch,
                search_type: 'product',
                prospects_found: productsData.length,
                created_at: new Date().toISOString()
                }
            ]);
            } catch (logError) {
            console.error('Error logging search:', logError);
            }
        } catch (err) {
            console.error('❌ Find products error:', err);
            setError('An unexpected error occurred. Please try again.');
    } finally {
        setSearchLoading(false);
    }
    }, [user, searchCache, selectedMode, findSimilarProducts, filters , applyFiltersToQuery]); 

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
            
            // SIMPLIFIED LIKE PREVIOUS VERSION
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

                // If no interests after sanitization, return false
                if (interestsArray.length === 0) return false;

                const hasMatch = interestsArray.some(interest => {
                    if (!interest) return false;
                    
                    const interestLower = interest.toLowerCase();
                    
                    // Check for word matches
                    const wordMatch = searchWords.some(word => {
                        if (!word) return false;
                        return interestLower.includes(word);
                    });

                    // Check for full term match
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

            const formattedProspects = sortedProspects.map(prospect => {
                let interests = [];
                try {
                    interests = typeof prospect.interests === 'string' 
                        ? JSON.parse(prospect.interests) 
                        : (Array.isArray(prospect.interests) ? prospect.interests : []);
                } catch (e) {
                    interests = [];
                }

                return {
                    id: prospect.user_id,
                    email: sanitizeEmail(prospect.username),
                    location: sanitizeLocation(prospect.location || 'Location not specified'),
                    interest: searchTerm,
                    interests: interests,
                    phone_number: sanitizePhone(prospect.phone_number),
                    isSameLocation: prospect.location && 
                                prospect.location.toLowerCase() === sellerLocation.toLowerCase()
                };
            });
            
            if (matchingProspects.length > 0) {
                setShowSafetyWarning(true);
            }

            // Save to cache
            setSearchCache(prev => ({
                ...prev,
                [cacheKey]: formattedProspects
            }));
            
            setProspects(formattedProspects);

            // Log the search
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
        // Listen for pull-to-refresh event
        const handlePullToRefresh = () => {
            console.log('🔄 Pull-to-refresh triggered in SocialAIMarketingEngine');
            
            if (selectedMode === 'seller' && productSearch.trim()) {
            // Refresh prospects
            findProspects(productSearch);
            } else if (selectedMode === 'buyer' && productSearch.trim()) {
            // Refresh products
            findProducts(productSearch);
            } else if (selectedMode === 'buyer') {
            // Refresh all products
            fetchProducts();
            }
        };
        
        window.addEventListener('pull-to-refresh', handlePullToRefresh);
        
        return () => {
            window.removeEventListener('pull-to-refresh', handlePullToRefresh);
        };
    }, [selectedMode, productSearch, findProspects, findProducts, fetchProducts]);

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

            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            setSelectedMode(null);
            setIsProfileComplete(false);
            setProfileData(null);
            setProspects([]);
            setProductsFound([]);
            setProductSearch('');
            setAllProducts([]);
            setCurrentPage(0);
            setHasMore(true);
            setSearchCache({});
            
            navigate('/');
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

    // --- CONDITIONAL RENDERING ---
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

    const isAdminRoute = window.location.pathname === '/admin';
    if (isAdminRoute) {
        return <SimpleAdmin />;
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
        const hasProfileData = profileData?.location && profileData?.phone_number;
        const existingMode = profileData?.is_seller ? 'seller' : 
                            profileData?.is_buyer ? 'buyer' : null;
        
        return (
          <div className="mode-selection-page">
            <div className="app-container">
                <div className="mode-selection-screen">
                    
                    <div className="mode-selection-header">

                        <h1 className="mode-selection-title">Welcome to Straun Marketing AI Engine</h1>
                        <p className="mode-selection-subtitle">
                            {existingMode 
                                ? `You were previously using ${existingMode === 'seller' ? 'Seller' : 'Buyer'} mode. Choose how you want to continue:`
                                : 'First, tell us how you want to use the platform:'}
                        </p>
                        <p className="mode-selection-required">
                            <strong>Important:</strong> You must complete the setup form for your chosen mode before proceeding.
                        </p>
                    </div>
                    
                    <div className="mode-selection-cards">
                        <div className="mode-card seller-mode-card">
                            <div className="mode-card-icon">🛒</div>
                            <h2 className="mode-card-title">I'm a Seller</h2>
                            <p className="mode-card-description">
                                List your products and find customers who are interested in what you're selling.
                            </p>
                            <button 
                                onClick={() => clearAndSetMode('seller')}
                                className="mode-card-button"
                            >
                                {existingMode === 'seller' ? 'Continue as Seller' : 'Choose Seller Mode'}
                            </button>
                            <div className="mode-requirements">
                                <p><strong>Required for Seller Setup:</strong></p>
                                <ul className="mode-features">
                                    <li>Your location</li>
                                    <li>Phone number</li>
                                    <li>At least one product to sell</li>
                                </ul>
                            </div>
                            {hasProfileData && (
                                <div className="profile-status">
                                    <p className="profile-complete-note">
                                        ✓ Your profile information will be pre-filled
                                    </p>
                                </div>
                            )}
                        </div>
                        
                        <div className="mode-card buyer-mode-card">
                            <div className="mode-card-icon">🔍</div>
                            <h2 className="mode-card-title">I'm a Buyer</h2>
                            <p className="mode-card-description">
                                Find products you're looking for and connect with sellers in your area.
                            </p>
                            <button 
                                onClick={() => clearAndSetMode('buyer')}
                                className="mode-card-button"
                            >
                                {existingMode === 'buyer' ? 'Continue as Buyer' : 'Choose Buyer Mode'}
                            </button>
                            <div className="mode-requirements">
                                <p><strong>Required for Buyer Setup:</strong></p>
                                <ul className="mode-features">
                                    <li>Your location</li>
                                    <li>Phone number</li>
                                    <li>Products you're interested in</li>
                                </ul>
                            </div>
                            {hasProfileData && (
                                <div className="profile-status">
                                    <p className="profile-complete-note">
                                        ✓ Your profile information will be pre-filled
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="mode-selection-footer">
                        <p className="mode-note">
                            <strong>Note:</strong> You will be required to complete a setup form for your chosen mode.
                            Existing profile data will be pre-filled where available.
                        </p>
                    </div>
                </div>
            </div>
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
                                setSelectedMode(null); // Go back to mode selection
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

    // --- SHOW SETUP FORM IF MODE SELECTED BUT PROFILE NOT COMPLETE ---
    if (selectedMode && !isProfileComplete) {
        return (
            <div className="app-container">
                <div className="profile-setup-screen">
                    <div className="setup-header">
                        <h1 className="app-title">
                            Complete Your {selectedMode === 'seller' ? 'Seller' : 'Buyer'} Setup
                        </h1>
                        <p className="setup-subtitle">
                            <strong>Required:</strong> You must complete this form to proceed to the {selectedMode === 'seller' ? 'seller dashboard' : 'buyer marketplace'}.
                        </p>
                        
                        {error && (
                            <div className="error-alert">
                                <span className="error-icon">⚠️</span>
                                <span>{error}</span>
                            </div>
                        )}
                        
                        <div className="mode-indicator">
                            <span className="mode-badge">
                                {selectedMode === 'seller' ? 'Seller Setup' : 'Buyer Setup'}
                            </span>
                            
                            <button 
                                onClick={clearAndSwitchMode}
                                className="change-mode-button"
                                disabled={profileUpdateLoading} 
                            >
                                Change Mode
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
                        {selectedMode === 'seller' ? (
                            <SellerSetupForm 
                                onProfileComplete={handleProfileComplete}
                                existingData={profileData}
                                isSellerFlow={true}
                                loading={profileUpdateLoading} 
                            />
                        ) : (
                            <BuyerSetupForm 
                                onProfileComplete={handleProfileComplete}
                                existingData={profileData}
                                isBuyerFlow={true}
                                loading={profileUpdateLoading}
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    }

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

    // ============================================
    // ENHANCED FULL-SCREEN DASHBOARD COMPONENT
    // ============================================

    const UserDashboard = ({ userId, userName, userEmail, selectedMode, onClose, pushEnabled, onEnablePush, pushLoading }) => {
        const [activeTab, setActiveTab] = useState('overview');
        const [notificationSettings, setNotificationSettings] = useState({
            pushEnabled: pushEnabled || false,
            emailNotifications: true,
            matchAlerts: true,
            priceDropAlerts: true,
            messageAlerts: true
        });

        const handleTogglePush = async () => {
            if (onEnablePush) {
                const result = await onEnablePush();
                if (result) {
                    setNotificationSettings(prev => ({ ...prev, pushEnabled: true }));
                }
            } else {
                setNotificationSettings(prev => ({ ...prev, pushEnabled: !prev.pushEnabled }));
            }
        };

        const testPushNotification = async () => {
            if (!('serviceWorker' in navigator)) {
                alert('Push notifications not supported');
                return;
            }
            
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification('Test Notification', {
                    body: '✅ Push notifications are working!',
                    icon: '/pwa-192x192.png',
                    badge: '/pwa-192x192.png',
                    vibrate: [200, 100, 200],
                    data: { url: '/' }
                });
                alert('Test notification sent! Check your notifications.');
            } catch (error) {
                console.error('Test notification failed:', error);
                alert('Failed to send test notification. Make sure notifications are enabled.');
            }
        };

        return (
            <div className="fullscreen-dashboard" style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#1e1e1e',  // Match social page background
                zIndex: 20000,
                overflow: 'auto',
                animation: 'fadeIn 0.3s ease'
            }}>
                {/* Dashboard Header - Match social page gradient */}
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
                        <div>
                            <h1 style={{ margin: 0, fontSize: '24px' }}>📊 Dashboard</h1>
                            <p style={{ margin: '5px 0 0', opacity: 0.9, fontSize: '14px' }}>
                                Welcome back, {userName}!
                            </p>
                        </div>
                        <button
                            onClick={onClose}
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

                {/* Dashboard Content */}
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
                    {/* Tab Navigation */}
                    <div style={{
                        display: 'flex',
                        gap: '10px',
                        marginBottom: '20px',
                        borderBottom: '2px solid #e0e0e0',
                        paddingBottom: '10px',
                        flexWrap: 'wrap'
                    }}>
                        {[
                            { id: 'overview', icon: '📊', label: 'Overview' },
                            { id: 'features', icon: '🎯', label: 'Features & Tools' },
                            { id: 'settings', icon: '⚙️', label: 'Settings' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '10px 20px',
                                    background: activeTab === tab.id ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                                    color: activeTab === tab.id ? 'white' : '#666',
                                    border: 'none',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '14px',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '15px',
                                marginBottom: '25px'
                            }}>
                                <StatCard icon="👀" label="Profile Views" value={156} />
                                <StatCard icon="❤️" label="Product Saves" value={23} />
                                <StatCard icon="💬" label="Messages" value={12} unread={3} />
                                <StatCard icon="⭐" label="Rating" value="4.8" />
                            </div>

                            <ActivityFeed events={[
                                "Someone viewed your iPhone listing",
                                "Price dropped on saved item",
                                "New match for 'Headphones'"
                            ]} />

                            <Insights tips={[
                                "Listings with photos get 3x more views",
                                "Respond within 5 minutes for best results",
                                "Add detailed descriptions to build trust"
                            ]} />
                        </div>
                    )}

                    {/* Features & Tools Tab - When clicked, closes dashboard and opens feature */}
                    {activeTab === 'features' && (
                        <div>
                            <h3 style={{ marginBottom: '20px', color: '#333' }}>🎯 Quick Actions</h3>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                gap: '15px',
                                marginBottom: '30px'
                            }}>
                                
                                <QuickActionCard 
                                    icon="🔍" 
                                    title="Saved Searches" 
                                    description="View your saved searches"
                                    onClick={() => {
                                        onClose();
                                        fetchSavedSearches();  // Load saved searches
                                        setShowSavedSearches(true);
                                    }}
                                />
                                <QuickActionCard 
                                    icon="💬" 
                                    title="Messages" 
                                    description="Chat with buyers/sellers"
                                    onClick={() => {
                                        onClose();
                                        setShowChatList(true);
                                    }}
                                />
                                <QuickActionCard 
                                    icon="🔥" 
                                    title="Daily Deals" 
                                    description="Check today's hot deals"
                                    onClick={() => {
                                        onClose();
                                        setShowDailyDeals(true);
                                    }}
                                />
                                <QuickActionCard 
                                    icon="💰" 
                                    title="Price Alerts" 
                                    description="Manage your price alerts"
                                    onClick={() => {
                                        onClose();
                                        setShowPriceAlerts(true);
                                    }}
                                />
                                <QuickActionCard 
                                    icon="🎁" 
                                    title="Referral Program" 
                                    description="Invite friends & earn rewards"
                                    onClick={() => {
                                        onClose();  // Close dashboard
                                        setShowReferralProgram(true);  // Show referral component
                                    }}
                                />
                                <QuickActionCard 
                                    icon="❤️" 
                                    title="Wishlist" 
                                    description="View your saved items"
                                    onClick={() => {
                                        // Store current state before showing wishlist
                                        setPreviousSearchState({
                                            productSearch: productSearch,
                                            prospects: prospects,
                                            productsFound: productsFound,
                                            searchLoading: searchLoading
                                        });
                                        
                                        // Close the dashboard
                                        onClose();
                                        
                                        // Use setTimeout to ensure dashboard closes before showing wishlist
                                        setTimeout(() => {
                                            window.history.pushState({ showWishlist: true }, '', '#wishlist');
                                            setShowWishlist(true);
                                        }, 50);
                                    }}
                                />
                                <QuickActionCard 
                                    icon="🎯" 
                                    title="More Features" 
                                    description="Access advanced tools"
                                    onClick={() => {
                                        onClose();
                                        setShowToolsPanel(true);
                                    }}
                                />
                            </div>

                            <div style={{
                                background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                                borderRadius: '12px',
                                padding: '20px',
                                marginTop: '20px'
                            }}>
                                <h4 style={{ margin: '0 0 10px 0', color: '#667eea' }}>
                                    📌 Current Mode: {selectedMode === 'seller' ? 'Seller Mode' : 'Buyer Mode'}
                                </h4>
                                <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                                    {selectedMode === 'seller' 
                                        ? "You're in Seller Mode. List products and find customers interested in what you're selling."
                                        : "You're in Buyer Mode. Search for products and connect with sellers in your area."}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Settings Tab */}
                    {activeTab === 'settings' && (
                        <div>
                            <h3 style={{ marginBottom: '20px', color: '#333' }}>⚙️ Notification Settings</h3>
                            
                            <div style={{
                                background: 'white',
                                borderRadius: '12px',
                                padding: '20px',
                                marginBottom: '20px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '28px' }}>🔔</span>
                                            <div>
                                                <h4 style={{ margin: 0 }}>Push Notifications</h4>
                                                <p style={{ margin: '5px 0 0', fontSize: '13px', color: '#666' }}>
                                                    Receive alerts like WhatsApp even when you're not using the app
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <button
                                            onClick={handleTogglePush}
                                            disabled={pushLoading}
                                            style={{
                                                padding: '12px 24px',
                                                background: notificationSettings.pushEnabled 
                                                    ? 'linear-gradient(135deg, #4CAF50, #45a049)' 
                                                    : 'linear-gradient(135deg, #667eea, #764ba2)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '25px',
                                                cursor: pushLoading ? 'not-allowed' : 'pointer',
                                                fontWeight: 'bold',
                                                fontSize: '14px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                        >
                                            {pushLoading ? (
                                                <span>⏳ Enabling...</span>
                                            ) : notificationSettings.pushEnabled ? (
                                                <span>✅ Enabled</span>
                                            ) : (
                                                <span>🔔 Enable Notifications</span>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {notificationSettings.pushEnabled && (
                                    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                                        <h5 style={{ margin: '0 0 10px 0' }}>Test Notifications</h5>
                                        <button
                                            onClick={testPushNotification}
                                            style={{
                                                padding: '10px 20px',
                                                background: '#2196F3',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '14px'
                                            }}
                                        >
                                            📱 Send Test Notification
                                        </button>
                                        <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                                            You'll receive notifications for: New matches, Price drops, Messages, Daily deals
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div style={{
                                background: 'white',
                                borderRadius: '12px',
                                padding: '20px',
                                marginBottom: '20px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}>
                                <h4 style={{ margin: '0 0 15px 0' }}>Notification Preferences</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={notificationSettings.matchAlerts} 
                                            onChange={(e) => setNotificationSettings(prev => ({...prev, matchAlerts: e.target.checked}))} />
                                        <span>🔍 New Match Alerts</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={notificationSettings.priceDropAlerts} 
                                            onChange={(e) => setNotificationSettings(prev => ({...prev, priceDropAlerts: e.target.checked}))} />
                                        <span>💰 Price Drop Alerts</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={notificationSettings.messageAlerts} 
                                            onChange={(e) => setNotificationSettings(prev => ({...prev, messageAlerts: e.target.checked}))} />
                                        <span>💬 Message Alerts</span>
                                    </label>
                                </div>
                            </div>

                            <div style={{
                                background: 'white',
                                borderRadius: '12px',
                                padding: '20px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}>
                                <h4 style={{ margin: '0 0 15px 0' }}>Account Information</h4>
                                <p><strong>Email:</strong> {userEmail}</p>
                                <p><strong>Mode:</strong> {selectedMode === 'seller' ? 'Seller' : 'Buyer'}</p>
                                <button
                                    onClick={() => {
                                        onClose();
                                        setShowSettings(true);
                                    }}
                                    style={{
                                        marginTop: '10px',
                                        padding: '10px 20px',
                                        background: '#667eea',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Edit Profile Settings
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                `}</style>
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
        <div className="social-media-page"> 

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
                    <button onClick={() => { handleNavigation('home'); toggleMobileMenu(); }}>
                        🏠 Home
                    </button>

                    <button onClick={() => { handleNavigation('dashboard'); toggleMobileMenu(); }}>
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
                    
                    <button onClick={() => { handleNavigation('switchMode'); toggleMobileMenu(); }}>
                        🔄 Switch Mode
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
                    
                    {/* 👑 CLICKABLE CROWN ICON FOR ADMIN - ADD THIS */}
                    {isAdmin && (
                        <button
                            onClick={() => {
                                console.log('👑 Admin crown clicked - navigating to admin dashboard');
                                navigate('/admin');
                            }}
                            title="Admin Dashboard"
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '18px',
                                marginLeft: '8px',
                                padding: '4px 8px',
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                                transition: 'all 0.2s ease',
                                animation: 'crownGlow 2s ease-in-out infinite',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            👑
                        </button>
                    )}
                </div>
                
                {/* Empty spacer for balance */}
                <div style={{ width: '38px' }}></div>
            </header>

        <div className="navbar-spacer"></div>
             
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
                
                {/* Notifications */}
                <div className="notification-container">
                    <button 
                        className="notification-button"
                        onClick={() => setShowNotifications(!showNotifications)}
                    >
                        🔔
                        {unreadCount > 0 && (
                            <div className="notification-badge">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </div>
                        )}
                    </button>
                
                    {showNotifications && (
                        <div className="notification-dropdown">
                            <div className="notification-header">
                                <h3>Notifications ({unreadCount})</h3>
                                <button onClick={() => setShowNotifications(false)}>×</button>
                            </div>
                            
                            {notifications.length === 0 ? (
                                <div className="notification-empty">No notifications yet</div>
                            ) : (
                                <div className="notification-list">
                                    {notifications.map(notification => (
                                        <div 
                                            key={notification.id} 
                                            className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                                            onClick={() => markAsRead(notification.id)}
                                        >
                                            <div className="notification-message">
                                                {notification.message}
                                            </div>
                                            <div className="notification-time">
                                                {new Date(notification.created_at).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ===== FLOATING BUTTONS - PROPER ORDER ===== */}
                
                {/* 1. DASHBOARD BUTTON - Top (Highest) */}
                {!showWishlist && !showToolsPanel && !showDashboard && (
                    <button
                        onClick={() => setShowDashboard(true)}
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

                {/* 4. FILTER BUTTON - Left side */}
                <button 
                    className={`filter-icon-mobile ${activeFilterCount > 0 ? 'active' : ''}`}
                    onClick={() => setShowFilterModal(true)}
                    title="Filter Results"
                    style={{
                        position: 'fixed',
                        bottom: '140px',
                        left: '20px',
                        background: activeFilterCount > 0 ? '#4CAF50' : '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '55px',
                        height: '55px',
                        fontSize: '24px',
                        cursor: 'pointer',
                        zIndex: 1000,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    🔍
                    {activeFilterCount > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: '-5px',
                            right: '-5px',
                            background: '#ff3b30',
                            color: 'white',
                            borderRadius: '50%',
                            width: '22px',
                            height: '22px',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            border: '2px solid white'
                        }}>
                            {activeFilterCount}
                        </span>
                    )}
                </button>

                {showDashboard && (
                    <UserDashboard 
                        userId={user?.id}
                        userName={userName}
                        userEmail={user?.email}
                        selectedMode={selectedMode}
                        onClose={() => setShowDashboard(false)}
                        pushEnabled={pushEnabled}
                        onEnablePush={subscribeToPush}
                        pushLoading={pushLoading}
                    />
                )}
  
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
                                        ? "E.g., Blankets, iPhone 13, Headphones.." 
                                        : "E.g., Headphones, Laptop, Furniture..."
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

                    <div className="filter-container">
                        <button 
                            onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
                            className={`filter-toggle-button ${isFilterCollapsed ? 'collapsed' : ''}`}
                        >
                            <span className="filter-icon">🔻</span>
                            {isFilterCollapsed ? 'Show Filters' : 'Hide Filters'}
                            {activeFilterCount > 0 && (
                                <span className="active-filter-indicator">
                                    {activeFilterCount} Active
                                </span>
                            )}
                        </button>
                        
                        <div className={`collapsible-filter-section ${isFilterCollapsed ? 'collapsed' : ''}`}>
                            <div className="filter-section-content">
                                <div className="filter-header">
                                    <h4>
                                        <span style={{ marginRight: '8px' }}>🔍</span>
                                        Filter Results
                                    </h4>
                                    <button 
                                        onClick={() => {
                                            setFilters({
                                                minPrice: '',
                                                maxPrice: '',
                                                location: '',
                                                sortBy: 'newest',
                                                category: ''
                                            });
                                            if (productSearch.trim()) {
                                                findProducts(productSearch);
                                            } else {
                                                fetchProducts();
                                            }
                                        }}
                                        className="clear-filters-btn"
                                        disabled={!Object.values(filters).some(val => 
                                            (typeof val === 'string' && val !== '' && val !== 'newest') || 
                                            (typeof val === 'number' && val !== 0)
                                        )}
                                    >
                                        Clear Filters
                                    </button>
                                </div>
                                
                                <div className="filter-grid">
                                    {/* Price Range */}
                                    <div className="filter-group">
                                        <label>Price Range</label>
                                        <div className="price-inputs">
                                            <input
                                                type="number"
                                                placeholder="Min $"
                                                value={filters.minPrice}
                                                onChange={(e) => setFilters(prev => ({...prev, minPrice: e.target.value}))}
                                                min="0"
                                            />
                                            <span style={{ color: 'var(--text-secondary)' }}>to</span>
                                            <input
                                                type="number"
                                                placeholder="Max $"
                                                value={filters.maxPrice}
                                                onChange={(e) => setFilters(prev => ({...prev, maxPrice: e.target.value}))}
                                                min="0"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Location */}
                                    <div className="filter-group">
                                        <label>Location</label>
                                        <input
                                            type="text"
                                            placeholder="City or area"
                                            value={filters.location}
                                            onChange={(e) => setFilters(prev => ({...prev, location: e.target.value}))}
                                        />
                                    </div>
                                    
                                    {/* Sort By */}
                                    <div className="filter-group">
                                        <label>Sort By</label>
                                        <select
                                            value={filters.sortBy}
                                            onChange={(e) => setFilters(prev => ({...prev, sortBy: e.target.value}))}
                                        >
                                            <option value="newest">Newest First</option>
                                            <option value="price_low">Price: Low to High</option>
                                            <option value="price_high">Price: High to Low</option>
                                        </select>
                                    </div>
                                    
                                    {/* Apply Filters Button */}
                                    <div className="filter-group">
                                        <label>&nbsp;</label>
                                        <button
                                            onClick={() => {
                                                if (productSearch.trim()) {
                                                    findProducts(productSearch, true);
                                                } else {
                                                    fetchProducts();
                                                }
                                            }}
                                            className="apply-filters-btn"
                                            disabled={searchLoading}
                                        >
                                            {searchLoading ? 'Applying...' : 'Apply Filters'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                    {error && (
                        <div className="error-alert">
                            <span className="error-icon">⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}
                    
                    {/* 🔴 SAFETY WARNING MESSAGE - Add this component */}
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
                    ):showSavedSearches ? (
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
                                            fetchSavedSearches(); // Refresh when closing
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
                    
                    <div className="results-section">
                        {selectedMode === 'seller' ? (
                            <div className="seller-results-card">
                                <div className="results-header">
                                    <h3>
                                        {selectedMode === 'seller' ? '📈 Marketing Prospects' : '🛒 Available Products'}
                                        {selectedMode === 'buyer' && (
                                            <button 
                                                onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
                                                className="filter-toggle-button"
                                                style={{
                                                    marginLeft: '15px',
                                                    fontSize: '13px',
                                                    padding: '6px 12px'
                                                }}
                                            >
                                                <span className="filter-icon">🔻</span>
                                                {isFilterCollapsed ? 'Show Filters' : 'Hide Filters'}
                                            </button>
                                        )}
                                    </h3>
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
                                                        <li>"laptop" - Found in existing interests</li>
                                                        <li>"fruits" - Found in existing interests</li>
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
                                            <div key={p.id || index} className={`prospect-card ${p.isSameLocation ? 'same-location' : ''}`}>
                                                <div className="prospect-card-header">
                                                    <div className="prospect-avatar">
                                                        {p.email ? p.email.charAt(0).toUpperCase() : '?'}
                                                    </div>
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
                                                    <div className="detail-item">
                                                        <span className="detail-label">🎯 Interested in:</span>
                                                        <span className="detail-value highlight">{p.interest || 'Not specified'}</span>
                                                    </div>
                                                </div>
                                                <div className="prospect-actions" style={{ 
                                                    display: 'flex', 
                                                    flexDirection: 'column', 
                                                    gap: '10px', // Add gap between buttons
                                                    marginTop: '15px'
                                                }}>    
                                                    {p.isSameLocation ? (
                                                        <button className="connect-button priority">
                                                            <span className="priority-icon">🔥</span>
                                                            Priority Connection
                                                        </button>
                                                    ) : (
                                                        <div>
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
                                                                title="Save this product to your wishlist"
                                                            >
                                                                💾 Save Prospect
                                                            </button>

                                                            <button 
                                                                onClick={() => handleContact(p.id, p.phone_number, p.interest, 'seller', {
                                                                    id: null,   
                                                                    name: p.interest,
                                                                    image_url: null
                                                                })}
                                                                disabled={limits?.CONTACT?.remaining === 0}
                                                                title={limits?.CONTACT?.remaining === 0 ? 
                                                                    `Contact limit reached. ${limits.CONTACT.reset_in ? `Resets in ${limits.CONTACT.reset_in} seconds` : 'Try again later'}` : 
                                                                    ''}
                                                                style={{
                                                                    width: '100%',
                                                                    backgroundColor: '#25D366', // WhatsApp green
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
                                                                    boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    if (limits?.CONTACT?.remaining !== 0) {
                                                                        e.currentTarget.style.backgroundColor = '#128C7E';
                                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                                    }
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    if (limits?.CONTACT?.remaining !== 0) {
                                                                        e.currentTarget.style.backgroundColor = '#25D366';
                                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                                    }
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

                                                            <button 
                                                                onClick={() => handleShareToStatus(p)}
                                                                style={mainButtonStyle('#128C7E')}
                                                            >
                                                                📢 Post to Status
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
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
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
                                                        setProductSearch('');  // Clear search
                                                        fetchProducts();       // Fetch all products
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
                                    
                                    {productsFound.length === 0 ? (
                                        <div className="empty-results">
                                            <div className="empty-icon">🛒</div>
                                            <h4>No products found for "{productSearch}"</h4>
                                            <p>We couldn't find any products matching your search.</p>
                                            
                                            {showSimilarProducts && similarProducts.length > 0 ? (
                                                <div style={{ marginTop: '20px' }}>
                                                    <p><strong>Try these similar products instead:</strong></p>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px' }}>
                                                        {similarProducts.slice(0, 3).map((product, index) => (
                                                            <button
                                                                key={`empty-similar-${index}`}
                                                                onClick={() => {
                                                                    setProductSearch(product.name);
                                                                    setTimeout(() => handleSearch(), 100);
                                                                }}
                                                                style={{
                                                                    background: '#667eea',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    padding: '8px 12px',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '13px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '5px'
                                                                }}
                                                            >
                                                                <span>🔍</span>
                                                                {product.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="empty-tips">
                                                    <p><strong>Tips for better results:</strong></p>
                                                    <ul>
                                                        <li>Try broader product categories</li>
                                                        <li>Check spelling of product names</li>
                                                        <li>Consider related products</li>
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="products-grid">
                                            {productsFound.map((p, index) => (
                                                <div key={p.id || index} className={`product-card ${index === 0 ? 'best-deal' : ''}`}>
                                                    {index === 0 && (
                                                        <div className="best-deal-badge">🔥 Best Deal</div>
                                                    )}
                                                   
                                                    <div className="product-card-header">
                                                        <h4 className="product-name">{p.name || 'Unnamed Product'}</h4>
                                                        <div className="product-price">
                                                            ${p.price || '0'}
                                                        </div>
                                                    </div>
                                                    <div className="product-card-body">
                                                        {p.description && (
                                                            <div className="product-description">
                                                                <SafeHTML 
                                                                    htmlContent={p.description} 
                                                                    className="product-description-text"
                                                                    allowLinks={true}      
                                                                    allowImages={true}
                                                                />
                                                            </div>
                                                        )}
                                                        
                                                        {p.image_url ? (
                                                            <img 
                                                                src={p.image_url} 
                                                                alt={p.name}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setZoomedImage(p.image_url);
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
                                                            {p.location || 'Location not specified'}
                                                        </div>
                                                        <div className="product-phone">
                                                            <span className="phone-icon">📞</span>
                                                            <strong>Seller Phone:</strong> {p.phone_number || 'N/A'}
                                                        </div>
                                                    </div>
                                                    <div className="product-card-footer" style={{ 
                                                        display: 'flex', 
                                                        flexDirection: 'column', 
                                                        gap: '10px', 
                                                        marginTop: '15px',
                                                        padding: '10px'
                                                    }}>
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
                                                                gap: '8px',
                                                                marginBottom: '5px'
                                                            }}
                                                            title="Save this product to your wishlist"
                                                        >
                                                            💖 Save to Wishlist
                                                        </button>

                                                        <button 
                                                            onClick={() => handleContact(p.seller_id, p.phone_number, p.name, 'buyer', p)}
                                                            disabled={limits?.CONTACT?.remaining === 0}
                                                            title={limits?.CONTACT?.remaining === 0 ? 
                                                                `Contact limit reached. ${limits.CONTACT.reset_in ? `Resets in ${limits.CONTACT.reset_in} seconds` : 'Try again later'}` : 
                                                                ''}
                                                            style={{
                                                                width: '100%',
                                                                backgroundColor: '#25D366', // WhatsApp green
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
                                                                boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (limits?.CONTACT?.remaining !== 0) {
                                                                    e.currentTarget.style.backgroundColor = '#128C7E';
                                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (limits?.CONTACT?.remaining !== 0) {
                                                                    e.currentTarget.style.backgroundColor = '#25D366';
                                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                                }
                                                            }}
                                                        >
                                                            <span style={{ fontSize: '16px' }}>💬</span>
                                                            WhatsApp Seller
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

                                                        <button 
                                                            onClick={() => handleShareToStatus(p)}
                                                            style={mainButtonStyle('#128C7E')}
                                                        >
                                                            📢 Post to Status
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
                                                                    const smsMessage = `Hi, I saw your ${p.name}. Is it available?`;
                                                                    window.open(`sms:${p.phone_number}?body=${encodeURIComponent(smsMessage)}`, '_self');
                                                                }}
                                                                style={smallButtonStyle('#f6ad55')}
                                                            >
                                                                ✉️ SMS
                                                            </button>
                                                              
                                                        </div>

                                                        <PriceAlertButton 
                                                            product={p}
                                                            userId={user?.id}
                                                            onAlertSet={(set) => {
                                                                if (set) {
                                                                    showToastNotification(`✅ Price alert set for ${p.name}`);
                                                                }
                                                            }}
                                                        />

                                                        {/* Chat Button */}
                                                        <button
                                                            onClick={() => {
                                                                setSelectedChat({
                                                                    otherUserId: p.seller_id,
                                                                    otherUserName: p.seller?.username || 'Seller',
                                                                    productId: p.id,
                                                                    productName: p.name
                                                                });
                                                                setShowChat(true);
                                                            }}
                                                            style={{
                                                                width: '100%',
                                                                backgroundColor: '#667eea',
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
                                                            <span>💬</span>
                                                            Message Seller
                                                        </button>

                                                    </div>
                                                </div>
                                            ))}
                                            <div style={{ 
                                                gridColumn: '1 / -1', 
                                                display: 'flex', 
                                                justifyContent: 'center', 
                                                marginTop: '20px' 
                                            }}>
                                                {hasMore && productsFound.length >= ITEMS_PER_PAGE && (
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

                                                {!hasMore && productsFound.length > 0 && (
                                                    <p className="end-message">You've seen all current products!</p>
                                                )}
                                            </div>
                                        </div>

                                        )}
                                        
                                        {/* SIMILAR PRODUCTS SUGGESTIONS */}
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
                        </div>
                        
                    )}

                    {/* Recommendations Section - Show when there are results */}
                    {(productsFound.length > 0 || prospects.length > 0) && user && (
                        <RecommendationsSection 
                            userId={user.id}
                            currentProductId={lastViewedProduct?.id}
                            onProductClick={handleProductClick}
                        />
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

        {/* Mobile Filter Modal */}
        {showFilterModal && (
            <div 
                className="filter-modal-overlay" 
                onClick={() => setShowFilterModal(false)}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.5)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center'
                }}
            >
                <div 
                    className="filter-modal-content" 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        background: 'white',
                        width: '100%',
                        maxHeight: '80vh',
                        borderTopLeftRadius: '20px',
                        borderTopRightRadius: '20px',
                        padding: '20px',
                        overflow: 'auto'
                    }}
                >
                    <div className="filter-modal-header" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '20px',
                        paddingBottom: '15px',
                        borderBottom: '1px solid #e0e0e0'
                    }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span>🔍</span>
                            Filter Results
                            {activeFilterCount > 0 && (
                                <span style={{
                                    marginLeft: '10px',
                                    background: '#4CAF50',
                                    color: 'white',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '12px'
                                }}>
                                    {activeFilterCount} active
                                </span>
                            )}
                        </h3>
                        <button 
                            className="filter-modal-close"
                            onClick={() => setShowFilterModal(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '28px',
                                cursor: 'pointer',
                                color: '#666'
                            }}
                        >
                            ×
                        </button>
                    </div>
                    
                    <div className="filter-modal-body">
                        <div className="mobile-filter-section">
                            <div className="filter-grid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Price Range */}
                                <div className="filter-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>💰 Price Range</label>
                                    <div className="price-inputs" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ flex: 1 }}>
                                            <input
                                                type="number"
                                                placeholder="Min $"
                                                value={filters.minPrice}
                                                onChange={(e) => setFilters(prev => ({...prev, minPrice: e.target.value}))}
                                                min="0"
                                                style={{
                                                    width: '100%',
                                                    padding: '12px',
                                                    border: '2px solid #ddd',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                        </div>
                                        <span style={{ color: '#666', margin: '0 5px' }}>to</span>
                                        <div style={{ flex: 1 }}>
                                            <input
                                                type="number"
                                                placeholder="Max $"
                                                value={filters.maxPrice}
                                                onChange={(e) => setFilters(prev => ({...prev, maxPrice: e.target.value}))}
                                                min="0"
                                                style={{
                                                    width: '100%',
                                                    padding: '12px',
                                                    border: '2px solid #ddd',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Location */}
                                <div className="filter-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>📍 Location</label>
                                    <input
                                        type="text"
                                        placeholder="City or area"
                                        value={filters.location}
                                        onChange={(e) => setFilters(prev => ({...prev, location: e.target.value}))}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '2px solid #ddd',
                                            borderRadius: '8px',
                                            fontSize: '16px'
                                        }}
                                    />
                                </div>
                                
                                {/* Sort By */}
                                <div className="filter-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>📊 Sort By</label>
                                    <select
                                        value={filters.sortBy}
                                        onChange={(e) => setFilters(prev => ({...prev, sortBy: e.target.value}))}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '2px solid #ddd',
                                            borderRadius: '8px',
                                            fontSize: '16px',
                                            background: 'white'
                                        }}
                                    >
                                        <option value="newest">🆕 Newest First</option>
                                        <option value="price_low">💰 Price: Low to High</option>
                                        <option value="price_high">💎 Price: High to Low</option>
                                    </select>
                                </div>
                                
                                {/* Action Buttons */}
                                <div style={{ 
                                    display: 'flex', 
                                    gap: '10px', 
                                    marginTop: '20px',
                                    position: 'sticky',
                                    bottom: '0',
                                    background: 'white',
                                    padding: '15px 0',
                                    borderTop: '1px solid #e0e0e0'
                                }}>
                                    <button
                                        onClick={() => {
                                            setFilters({
                                                minPrice: '',
                                                maxPrice: '',
                                                location: '',
                                                sortBy: 'newest',
                                                category: ''
                                            });
                                        }}
                                        className="clear-filters-btn"
                                        disabled={activeFilterCount === 0}
                                        style={{ 
                                            flex: 1,
                                            padding: '14px',
                                            background: activeFilterCount === 0 ? '#ccc' : '#ff4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: 'bold',
                                            fontSize: '16px',
                                            cursor: activeFilterCount === 0 ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        ❌ Clear All
                                    </button>
                                    
                                    <button
                                        onClick={() => {
                                            if (productSearch.trim()) {
                                                findProducts(productSearch, true);
                                            } else {
                                                fetchProducts();
                                            }
                                            setShowFilterModal(false);
                                        }}
                                        className="apply-filters-btn"
                                        disabled={searchLoading}
                                        style={{ 
                                            flex: 1,
                                            padding: '14px',
                                            background: searchLoading ? '#ccc' : '#4CAF50',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: 'bold',
                                            fontSize: '16px',
                                            cursor: searchLoading ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        {searchLoading ? '⏳ Applying...' : '✅ Apply Filters'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
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

    </div>
     
    );
    
};

export default SocialAIMarketingEngine;
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
function SocialAIMarketingEngine() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    useEffect(() => {
        initializeRateLimiter();
    }, []);

    // --- SIMPLIFIED MODE & PROFILE STATE ---
    const [selectedMode, setSelectedMode] = useState(null);
    const [isProfileComplete, setIsProfileComplete] = useState(false);
    
    // --- APP STATE ---
    const [productSearch, setProductSearch] = useState('');
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

    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const ITEMS_PER_PAGE = 6;

    const [isNavbarHidden, setIsNavbarHidden] = useState(false);
    const [isReportButtonFloating, setIsReportButtonFloating] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
 
    const [limits, setLimits] = useState({});
    const [showSafetyWarning, setShowSafetyWarning] = useState(false);
    const [similarProducts, setSimilarProducts] = useState([]);
    const [showSimilarProducts, setShowSimilarProducts] = useState(false);
    const [similarProductsLoading, setSimilarProductsLoading] = useState(false);

    const [isFilterCollapsed, setIsFilterCollapsed] = useState(true);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showToolsPanel, setShowToolsPanel] = useState(false);

    const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    location: '',
    sortBy: 'newest', // 'newest', 'price_low', 'price_high'
    category: '' // Optional: if you have categories
    });

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

    // --- MAIN INTERFACE ---
    return (
      <div className="social-media-page"> 

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
        <header className={`social-header ${isNavCollapsed ? 'collapsed-nav' : ''} ${isNavbarHidden ? 'hidden' : ''}`}>
        {/* Top Navigation */}
        <TopNavigationBar 
            user={user}
            selectedMode={selectedMode}
            profileData={profileData}
            signOutLoading={signOutLoading}
            onSwitchMode={handleSwitchMode}
            onSignOut={handleSignOut}
            onSettingsClick={() => setShowSettings(true)}
            onToggleCollapse={toggleNavCollapse}
            isCollapsed={isNavCollapsed}
            isHidden={isNavbarHidden}
            isAdmin={isAdmin}
            appName="Straun Marketing Engine" 
        />
        </header>
        <div className="navbar-spacer"></div>
             
        <div className={`main-content-wrapper ${isNavCollapsed ? 'nav-collapsed' : ''} ${isNavbarHidden ? 'has-hidden-nav' : ''}`}>
            <div className="app-container">
                {/* 🎯 More Features Button - ABOVE Wishlist Button */}
                {!showWishlist && !showToolsPanel && (
                    <button
                        onClick={() => setShowToolsPanel(true)}
                        style={{
                            position: 'fixed',
                            bottom: '150px',
                            right: '20px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            padding: '12px 16px',
                            borderRadius: '50px',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            zIndex: 1001, // Higher than wishlist button
                            transition: 'all 0.3s ease',
                        }}
                        title="Open advanced features and tools"
                    >
                        <span style={{ fontSize: '18px' }}>🎯</span>
                        More Features
                    </button>
                )}

                {/* Floating "Saved Searches" Button - Only shown when NOT in wishlist view */}
                {!showWishlist && !showToolsPanel && (
                    <button
                        onClick={() => {
                            setPreviousSearchState({
                                productSearch: productSearch,
                                prospects: prospects,
                                productsFound: productsFound,
                                searchLoading: searchLoading
                            });
                            setShowWishlist(true);
                        }}
                        style={{
                            position: 'fixed',
                            bottom: '80px',
                            right: '20px',
                            backgroundColor: '#7209b7',
                            color: 'white',
                            border: 'none',
                            padding: '12px 16px',
                            borderRadius: '50px',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            zIndex: 1000,
                            transition: 'all 0.3s ease',
                        }}
                        title="View your saved items"
                    >
                        <span style={{ fontSize: '18px' }}>📋</span>
                        View My Wishlist  🧾
                    </button>
                )}

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
                            <div style={{
                                position: 'absolute',
                                top: '-5px',
                                right: '-10px',
                                backgroundColor: '#ff3b30',
                                color: 'white',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                border: '2px solid #000'
                            }}>
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

                    {/* Mobile Filter Icon Button */}
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
                            width: '60px',
                            height: '60px',
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
                                width: '24px',
                                height: '24px',
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
            
                    {/* Tools Panel or Wishlist or Main Interface */}
                    {showToolsPanel ? (
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
                        <div style={{ width: '100%', padding: '1rem' }}>
                            {/* Simple "Back" button in Wishlist view */}
                            <button 
                                onClick={() => {
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
                            <WishlistManager onBack={() => setShowWishlist(false)} />
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
                </main>

                {/* Floating Actions Container */}
                <div
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px'
                }}
                >
                
                {/* Report Button */}
                <ReportButton 
                    targetUserId={user?.id}
                    floating={isReportButtonFloating}
                    style={{
                    backgroundColor: '#ff3b30',
                    color: 'white',
                    border: 'none',
                    padding: '12px 16px',
                    borderRadius: '50px',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    transition: 'all 0.3s ease',
                    }}
                />
                
                {/* Label for Report Button */}
                <span style={{ 
                    fontSize: '12px', 
                    color: '#666', 
                    background: 'rgba(255,255,255,0.9)', 
                    padding: '4px 8px', 
                    borderRadius: '4px' 
                }}>
                    Report Issue
                </span>
                </div>
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
     </div>
     
    );
    
};

export default SocialAIMarketingEngine;
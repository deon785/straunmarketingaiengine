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

// Helper function for word variations - FIXED
function getWordVariations(word) {
    // ADD MORE COMPREHENSIVE CHECKS
    if (!word || typeof word !== 'string') {
        console.warn('getWordVariations received invalid input:', word, typeof word);
        return [];
    }
    
    const sanitizedWord = sanitizeInput(word.toLowerCase(), 50);
    
    if (!sanitizedWord || sanitizedWord.trim() === '') {
        return [];
    }
    
    const variations = new Set();
    
    if (sanitizedWord.endsWith('s')) {
        variations.add(sanitizedWord.slice(0, -1));
        variations.add(sanitizedWord + 'es');
    } else {
        variations.add(sanitizedWord + 's');
        variations.add(sanitizedWord + 'es');
    }
    
    ['ing', 'ed', 'er', 'est', 'ly'].forEach(ending => {
        if (!sanitizedWord.endsWith(ending)) {
            const variation = sanitizedWord + ending;
            if (variation.length <= 50) {
                variations.add(variation);
            }
        }
    });
    
    return Array.from(variations);
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
    const [isVisible, setIsVisible] = useState(false);
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
 
    const [limits, setLimits] = useState({});

    useEffect(() => {
        initializeRateLimiter();
    }, []);

    const loadMoreProducts = async () => {
        setLoading(true);
        try {
            const from = currentPage * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            const { data, count, error } = await supabase
                .from('products')
                .select('*', { count: 'exact' })
                .ilike('name', `%${productSearch}%`)
                .range(from, to)
                .order('created_at', { ascending: false });

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
            const { data: products, error: productsError } = await supabase
                .from('products')
                .select('*')
                .ilike('name', `%${searchTerm}%`)
                .order('created_at', { ascending: false });

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
            
        } catch (err) {
            console.error("❌ Error in fetchProducts:", err);
            setError(err.message || "Failed to load products. Please try again.");
        } finally {
            setProductsFetchLoading(false);
        }
    }, [user]);

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

        // REMOVE the part that shows WishlistManager interface
        // Just show a simple message instead
        
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
        const BASE_RETRY_DELAY = 1000; // 1 second

        const connectToNotifications = async () => {
            try {
                // Clean up any existing subscription
                if (notificationSubscription) {
                    supabase.removeChannel(notificationSubscription);
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

                                // Show toast notification
                                showToastNotification(payload.new.message);

                                // Fetch updated notifications
                                await fetchNotifications();

                                // Log successful notification
                                console.log('New notification received:', {
                                    id: payload.new.id,
                                    type: payload.new.link_type,
                                    message: payload.new.message.substring(0, 100) // Truncate for logs
                                });

                            } catch (error) {
                                console.error('Error processing notification:', error);
                                // Don't crash the app - just log the error
                            }
                        }
                    )
                    .on('system', { event: 'disconnect' }, () => {
                        console.log('Notification channel disconnected, attempting reconnect...');
                        scheduleReconnect();
                    })
                    .on('system', { event: 'reconnect' }, () => {
                        console.log('Notification channel reconnected');
                        retryCount = 0; // Reset retry count on successful reconnect
                    })
                    .subscribe((status, error) => {
                        if (status === 'SUBSCRIBED') {
                            console.log('✅ Successfully subscribed to notifications channel');
                            retryCount = 0; // Reset retry count
                        }
                        
                        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                            console.error('❌ Notification channel error:', error);
                            scheduleReconnect();
                        }
                    });

            } catch (error) {
                console.error('Error setting up notification subscription:', error);
                scheduleReconnect();
            }
        };

        const scheduleReconnect = () => {
            if (retryCount >= MAX_RETRIES) {
                console.error('Max retry attempts reached for notification subscription');
                
                // Show user-friendly error
                showToastNotification('🔕 Connection to notifications lost. Please refresh the page.');
                return;
            }

            // Exponential backoff: 1s, 2s, 4s, 8s, 16s
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

        // Cleanup function
        return () => {
            console.log('Cleaning up notification subscription');
            
            // Clear any pending reconnect timeout
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            
            // Remove channel subscription
            if (notificationSubscription) {
                supabase.removeChannel(notificationSubscription).catch(error => {
                    console.warn('Error removing notification channel:', error);
                });
            }
        };
    }, [user, fetchNotifications]);

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

    // --- FIND PRODUCTS (BUYER MODE) ---
    const findProducts = useCallback(async (searchTerm) => {
        console.log('🔍 Starting findProducts with search:', searchTerm);
        
        if (!user) {
            setError('Please log in to search');
            return;
        }

        const cacheKey = searchTerm.toLowerCase().trim();
        if (searchCache[cacheKey]) {
            console.log('Cache hit for:', cacheKey);
            setProductsFound(searchCache[cacheKey]);
            return;
        }

        // Continue with search if allowed
        setSearchLoading(true);
        setError(null);
        
        try {
            const sanitizedSearch = sanitizeProductName(searchTerm);
            
            if (!sanitizedSearch || sanitizedSearch.length < 2) {
                setError('Please enter a product name with at least two characters.');
                return;
            }

            console.log('📋 Fetching products from database...');
            
            // FIXED: Use proper Supabase query syntax - SIMPLIFIED LIKE PREVIOUS VERSION
            const { data: products, error: fetchError } = await supabase
                .from('products')
                .select('name, price, location, description, seller_id, created_at, phone_number, image_url, id')
                .ilike('name', `%${sanitizedSearch}%`)
                .order('price', { ascending: true });

            if (fetchError) {
                console.error('❌ Error fetching products:', fetchError);
                setError(`Failed to fetch products: ${fetchError.message}`);
                return;
            }

            const productsData = products || [];
            console.log(`✅ Found ${productsData.length} products for: "${sanitizedSearch}"`);
            
            if (productsData.length === 0) {
                console.log('⚠️ No products found in database');
            } else {
                console.log('📊 Sample product:', productsData[0]);
            }
            
            // Save to cache
            setSearchCache(prev => ({
                ...prev,
                [cacheKey]: productsData
            }));

            // Update products found state
            setProductsFound(productsData);

            // 🔔 REAL-TIME MATCH NOTIFICATION: Notify sellers about the search
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
    }, [user, searchCache, selectedMode]);  

        // --- FIND PROSPECTS (SELLER MODE) ---
    const findProspects = useCallback(async (searchTerm) => {
        console.log('🔍 Starting findProspects with search:', searchTerm);
        
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
                                onClick={() => handleModeSelect('seller')}
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
                                onClick={() => handleModeSelect('buyer')}
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
                                onClick={handleSwitchMode}
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
            appName="Straun Marketing Engine" 
        />
        </header>
        <div className="navbar-spacer"></div>
             
        <div className={`main-content-wrapper ${isNavCollapsed ? 'nav-collapsed' : ''} ${isNavbarHidden ? 'has-hidden-nav' : ''}`}>
            <div className="app-container">
                {/* Floating "Saved Searches" Button - Only shown when NOT in wishlist view */}
                {!showWishlist && (
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

                    {error && (
                        <div className="error-alert">
                            <span className="error-icon">⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}
                    
                    {selectedMode === 'buyer' && productsFetchLoading && allProducts.length === 0 && (
                        <div className="loading-indicator">
                            <p>Loading your marketing data...</p>
                        </div>
                    )}
                    
                    <div className="separator"></div>

                        {/* Wishlist View or Main Interface */}
                    {showWishlist ? (
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
                                                    onClick={() => fetchProducts()} 
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
                                            <h4>No products found</h4>
                                            <p>
                                                {productSearch.trim() && !loading
                                                    ? `No sellers found for "${productSearch}". Try a different product name.`
                                                    : 'Enter a product above to find sellers offering it.'}
                                            </p>
                                            <div className="empty-tips">
                                                <p><strong>Tips for better results:</strong></p>
                                                <ul>
                                                    <li>Try broader product categories</li>
                                                    <li>Check spelling of product names</li>
                                                    <li>Consider related products</li>
                                                </ul>
                                            </div>
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
                                </div>
                            )}
                        </div>
                    )}
                </main>
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

                {showSettings && (
                    <div className="settings-modal-overlay">
                        <div className="settings-modal">
                            <UserSettings user={user} />
                            <button onClick={() => setShowSettings(false)}>Close</button>
                        </div>
                    </div>
                )}

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
     </div>
     
    );
    
};

export default SocialAIMarketingEngine;
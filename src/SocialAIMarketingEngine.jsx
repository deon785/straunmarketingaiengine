import React, { useState, useEffect, useCallback } from 'react';
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
import WishlistButton from './WishlistButton.jsx';
import WishlistManager from './WishlistManager.jsx';

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

// Helper function for word variations
function getWordVariations(word) {
    const sanitizedWord = sanitizeInput(word.toLowerCase(), 50);
    if (!sanitizedWord) return [];
    
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
    
    // --- AUTH STATE ---
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    
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
    const [items, setItems] = useState([]);

    const [showSettings, setShowSettings] = useState(false);
    
    // Add these to your state declarations
    const [initialDataLoading, setInitialDataLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [profileUpdateLoading, setProfileUpdateLoading] = useState(false);
    const [productsFetchLoading, setProductsFetchLoading] = useState(false);

    const [signOutLoading, setSignOutLoading] = useState(false);
    const [openingWhatsApp, setOpeningWhatsApp] = useState(false);
    const [calling, setCalling] = useState(false);

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [zoomedImage, setZoomedImage] = useState(null);

    const [isNavCollapsed, setIsNavCollapsed] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [showWishlist, setShowWishlist] = useState(false);
   
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const ITEMS_PER_PAGE = 6;

    // FIXED: Added missing closing brace and fixed variable reference
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

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (!error && data) {
            setNotifications(data);
            const unread = data.filter(n => !n.read).length;
            setUnreadCount(unread);
        }
    }, [user]);

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
        setOpeningWhatsApp(true);

        if (!validatePhoneNumber(targetPhoneNumber)) {
            alert("This user has an invalid phone number. We cannot connect you.");
            setOpeningWhatsApp(false);
            return;
        }

        try {
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
    const fetchProducts = useCallback(async () => {
        setProductsFetchLoading(true);
        setError(null);
        try {
            const { data: products, error: productsError } = await supabase
                .from('products')
                .select('*')
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
        } catch (err) {
            console.error("❌ Error in fetchProfile:", err);
        }
    }, [user]);

    // Combined useEffect for initial data load
    useEffect(() => {
        if (user) {
            setInitialDataLoading(true);
            Promise.all([fetchProducts(), fetchProfile()])
                .finally(() => setInitialDataLoading(false));
        }
    }, [user, fetchProducts, fetchProfile]);

    useEffect(() => {
        const toggleVisibility = () => {
            setIsVisible(window.pageYOffset > 300);
        };

        window.addEventListener('scroll', toggleVisibility);
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

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
        if (!user) return;

        const notificationSubscription = supabase
            .channel('notifications-channel')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    alert(`📢 ${payload.new.message}`);
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(notificationSubscription);
        };
    }, [user, fetchNotifications]);

    // Fetch products when buyer mode is activated
    useEffect(() => {
        if (user && isProfileComplete && selectedMode === 'buyer') {
            fetchProducts();
        }
    }, [user, isProfileComplete, selectedMode, fetchProducts]);

    // --- AUTHENTICATION EFFECT ---
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error) {
                    console.error('Auth session error:', error);
                    navigate('/');
                    return;
                }
                
                if (!session) {
                    navigate('/');
                    return;
                }
                
                setUser(session?.user || null);
                
                const { data: { subscription } } = supabase.auth.onAuthStateChange(
                    async (event, session) => {
                        setUser(session?.user || null);
                        if (event === 'SIGNED_OUT') {
                            navigate('/');
                        }
                    }
                );
                
                return () => {
                    if (subscription?.unsubscribe) {
                        subscription.unsubscribe();
                    }
                };
            } catch (err) {
                console.error('Auth check error:', err);
                navigate('/');
            } finally {
                setAuthLoading(false);
            }
        };
        
        checkAuth();
    }, [navigate]);

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
    };

    // --- HANDLE PROFILE COMPLETION ---
    const handleProfileComplete = async (details) => {
        try {
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
                
                const { error: productError } = await supabase
                    .from('products')
                    .insert([productInsert]);

                if (productError) {
                    console.error("❌ Error saving product:", productError);
                }
            }

            setProfileData(savedProfileData);
            setIsProfileComplete(true);
            
            if (isBuyerMode) {
                fetchProducts();
            }

        } catch (error) {
            console.error('❌ Error in handleProfileComplete:', error);
            setError(error.message || 'Failed to save profile. Please try again.');
            setIsProfileComplete(false);
            throw error;
        } finally {
            setProfileUpdateLoading(false);
        }
    };

    // --- HANDLE SEARCH ---
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
            
            if (selectedMode === 'seller') {
                await findProspects();
            } else {
                await findProducts();
            }
        } catch (error) {
            setError(error.message || 'Search failed');
        } finally {
            setSearchLoading(false);
        }
    };

    // --- FIND PRODUCTS (BUYER MODE) ---
    const findProducts = async () => {
        setSearchLoading(true);
        setError(null);
        
        try {
            const sanitizedSearch = sanitizeProductName(productSearch);
            
            if (!sanitizedSearch || sanitizedSearch.length < 2) {
                setError('Please enter a product name with at least two characters.');
                return;
            }

            const { data: products, error: fetchError } = await supabase
                .from('products')
                .select('name, price, location, description, seller_id, created_at, phone_number, image_url, id')
                .ilike('name', `%${sanitizedSearch}%`)
                .order('price', { ascending: true });

            if (fetchError) {
                console.error('Error fetching products:', fetchError);
                setError('Failed to fetch products. Please try again.');
                return;
            }

            setProductsFound(products || []);

            await supabase.from('searches').insert([
                { 
                    buyer_id: user.id, 
                    seller_id: null,
                    product_name: sanitizedSearch,
                    search_type: 'product',
                    prospects_found: 0,
                    created_at: new Date().toISOString()
                }
            ]);
        } catch (err) {
            console.error('Find products error:', err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setSearchLoading(false);
        }
    };

    // --- FIND PROSPECTS (SELLER MODE) ---
    const findProspects = async () => {
        setSearchLoading(true);
        setError(null);
        setProspects([]);
        
        try {
            const searchTerm = sanitizeProductName(productSearch);
            
            if (!searchTerm || searchTerm.length < 2) {
                setError('Please enter a product name with at least two characters.');
                return;
            }

            const sellerLocation = sanitizeLocation(profileData?.location);
            
            if (!sellerLocation) {
                setError('Could not find seller profile location. Please update your profile.');
                return;
            }

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

            if (!allBuyers || allBuyers.length === 0) {
                setProspects([]);
                return;
            }

            const searchTermLower = searchTerm.toLowerCase();
            const searchWords = searchTermLower
                .split(/[\s,]+/)
                .filter(w => w.length >= 2)
                .map(word => word.replace(/[^a-z0-9]/g, ''))
                .filter(Boolean);
            
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
                        .filter(i => i.length > 0);
                } catch (e) {
                    return false;
                }

                const hasMatch = interestsArray.some(interest => {
                    const wordMatch = searchWords.some(word => {
                        if (interest.includes(word)) return true;
                        
                        if (word.endsWith('s') && interest.includes(word.slice(0, -1))) return true;
                        if (!word.endsWith('s') && interest.includes(word + 's')) return true;
                        
                        const variations = getWordVariations(word);
                        return variations.some(variation => interest.includes(variation));
                    });

                    const fullTermMatch = 
                        interest.includes(searchTermLower) ||
                        (searchTermLower.endsWith('s') && interest.includes(searchTermLower.slice(0, -1))) ||
                        (!searchTermLower.endsWith('s') && interest.includes(searchTermLower + 's'));

                    return wordMatch || fullTermMatch;
                });

                return hasMatch;
            });

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
    };

    const handleSignOut = async () => {
        try {
            setSignOutLoading(true);
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            setUser(null);
            setSelectedMode(null);
            setIsProfileComplete(false);
            setProfileData(null);
            setProspects([]);
            setProductsFound([]);
            setProductSearch('');
            setAllProducts([]);
            setCurrentPage(0);
            setHasMore(true);
            
            navigate('/');
        } catch (error) {
            console.error('Sign out error:', error);
            setError('Error signing out. Please try again.');
        } finally {
            setSignOutLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && productSearch.trim()) {
            handleSearch();
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

    if (initialDataLoading && !isProfileComplete && selectedMode) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading your data...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="loading-container">
                <p>Redirecting to login...</p>
            </div>
        );
    }

    // --- SHOW MODE SELECTION IF NO MODE SELECTED ---
    if (!selectedMode) {
        const hasProfileData = profileData?.location && profileData?.phone_number;
        const existingMode = profileData?.is_seller ? 'seller' : 
                            profileData?.is_buyer ? 'buyer' : null;
        
        return (
            <div className="app-container">
                <div className="mode-selection-screen">
                    <div className="mode-selection-header">
                        <h1 className="mode-selection-title">Welcome to Straun Marketing AI Engine</h1>
                        <p className="user-welcome">Welcome, <strong>{user.email}</strong>!</p>
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
        <div className={`main-content-wrapper ${isNavCollapsed ? 'nav-collapsed' : 'nav-expanded'}`}>
            <div className="app-container">
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
                />
                
                {/* Floating "Saved Searches" Button - Only shown when NOT in wishlist view */}
                {!showWishlist && (
                    <button
                        onClick={() => setShowWishlist(true)}
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
                        title="View Saved Searches"
                    >
                        <span style={{ fontSize: '18px' }}>📋</span>
                        Saved Searches
                    </button>
                )}
                
                {/* Scroll to Top Button */}
                <button
                    onClick={scrollToTop}
                    style={{
                        position: 'fixed',
                        bottom: '20px',
                        right: '20px',
                        backgroundColor: '#667eea',
                        color: 'white',
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '20px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        zIndex: 1000,
                        opacity: isVisible ? 1 : 0,
                        visibility: isVisible ? 'visible' : 'hidden',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title="Scroll to top"
                >
                    ↑
                </button>

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

                {/* Wishlist View or Main Interface */}
                {showWishlist ? (
                    <div style={{ width: '100%', padding: '1rem' }}>
                        {/* Simple "Back" button in Wishlist view */}
                        <button 
                            onClick={() => setShowWishlist(false)}
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
                            ← Back to Main
                        </button>
                        <WishlistManager onBack={() => setShowWishlist(false)} />
                    </div>
                ) : (
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
                                            ? "E.g., Weighted Blanket, iPhone 13, Gaming Chair..." 
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
                                    <div className="search-examples">
                                        <span>Examples: </span>
                                        {selectedMode === 'seller' 
                                            ? 'Weighted Blanket, Headphones, Laptop'
                                            : 'Shoes, Phone, Furniture'}
                                    </div>
                                </div>
                            
                                <button 
                                    onClick={handleSearch} 
                                    disabled={searchLoading || !productSearch.trim()}
                                    className="search-button-large"
                                >
                                    {searchLoading ? (
                                    <>
                                        <span className="search-spinner"></span>
                                        Searching...
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
                                                <strong>Prospects Found:</strong> {prospects.length}
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
                                                            {p.email.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="prospect-identity">
                                                            <h4>Potential Customer</h4>
                                                            <p className="prospect-email">{p.email}</p>
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
                                                                {p.location}
                                                                {p.isSameLocation && " (Your Area)"}
                                                            </span>
                                                        </div>
                                                        <div className="detail-item phone-detail">
                                                            <span className="detail-label">📞 Phone:</span>
                                                            <span className="detail-value">{p.phone_number || 'N/A'}</span>
                                                        </div>
                                                        <div className="detail-item">
                                                            <span className="detail-label">🎯 Interested in:</span>
                                                            <span className="detail-value highlight">{p.interest}</span>
                                                        </div>
                                                    </div>
                                                    <div className="prospect-actions">
                                                        {p.isSameLocation ? (
                                                            <button className="connect-button priority">
                                                                <span className="priority-icon">🔥</span>
                                                                Priority Connection
                                                            </button>
                                                        ) : (
                                                            <div>
                                                                <button 
                                                                    onClick={() => handleContact(p.id, p.phone_number, p.interest, 'seller', {
                                                                        id: null,   
                                                                        name: p.interest,
                                                                        image_url: null
                                                                    })}
                                                                    style={mainButtonStyle('#25D366')}
                                                                >
                                                                    💬 WhatsApp Customer
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
                                                        <h4 className="product-name">{p.name}</h4>
                                                        <div className="product-price">
                                                            ${p.price}
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
                                                            {p.location}
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
                                                            onClick={() => handleContact(p.seller_id, p.phone_number, p.name, 'buyer', p)}
                                                            style={mainButtonStyle('#25D366')}
                                                        >
                                                            💬 WhatsApp Seller
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
                    </main>
                )}
                
                <footer className="app-footer">
                    <div className="footer-content">
                        <Link to="/help" className="help-link">Need Help?</Link>
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
    );
}

export default SocialAIMarketingEngine;
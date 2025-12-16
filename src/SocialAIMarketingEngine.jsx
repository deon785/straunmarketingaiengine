import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import './App.css';

// --- Components ---
import SellerSetupForm from './SellerSetupForm'; 
import BuyerSetupForm from './BuyerSetupForm'; 

// Helper function for word variations
function getWordVariations(word) {
    const variations = new Set();
    
    // Add common variations
    if (word.endsWith('s')) {
        variations.add(word.slice(0, -1)); // laptop
        variations.add(word + 'es');      // laptops (if word ends with 's')
    } else {
        variations.add(word + 's');       // laptops
        variations.add(word + 'es');      // boxes
    }
    
    // Add common word endings
    ['ing', 'ed', 'er', 'est', 'ly'].forEach(ending => {
        if (!word.endsWith(ending)) {
            variations.add(word + ending);
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
    
    // --- PROFILE DATA ---
    const [profileData, setProfileData] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);

    // Debug log for state changes
    useEffect(() => {
        console.log("🔄 STATE UPDATE:", {
            selectedMode,
            isProfileComplete,
            userEmail: user?.email,
            hasProfileData: !!profileData
        });
    }, [selectedMode, isProfileComplete, user, profileData]);

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

    // --- CHECK EXISTING PROFILE DATA (FOR PRE-FILLING ONLY) ---
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

                console.log("📊 Existing profile data found:", data);

                if (data) {
                    setProfileData(data);
                    // DO NOT set isProfileComplete to true here
                    // Let the user choose a mode and complete the form
                } else {
                    console.log("📊 No existing profile data");
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
            console.log("👤 User detected, checking for existing profile data...");
            checkExistingProfile();
        }
    }, [user]);

    // --- ENSURE BASIC PROFILE EXISTS ---
    useEffect(() => {
        const ensureBasicProfile = async () => {
            if (!user || profileData) return;
            
            try {
                // Check if profile exists
                const { data: existingProfile } = await supabase
                    .from('profiles')
                    .select('user_id')
                    .eq('user_id', user.id)
                    .maybeSingle();
                
                // Create basic profile if doesn't exist
                if (!existingProfile) {
                    console.log("🆕 Creating basic profile for new user");
                    
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
        console.log("🎯 Mode selected:", mode);
        console.log("🔄 Setting selectedMode to:", mode);
        console.log("🔄 Setting isProfileComplete to FALSE (showing form)");
        
        setSelectedMode(mode);
        setIsProfileComplete(false); // Force showing form
        setError(null);
        
        // Clear any existing search results
        setProductsFound([]);
        setProspects([]);
        setProductSearch('');
    };

    // --- HANDLE SWITCH MODE ---
    const handleSwitchMode = () => {
        console.log("🔄 Switching mode - resetting to mode selection");
        setSelectedMode(null);
        setIsProfileComplete(false);
        setProfileData(null);
        setProductsFound([]);
        setProspects([]);
        setProductSearch('');
        setError(null);
    };

    // --- HANDLE PROFILE COMPLETION (CORRECTED VERSION) ---
    const handleProfileComplete = async (details) => {
        try {
            console.log("🟡 ============ START handleProfileComplete ============");
            console.log("🟡 Details received from form:", JSON.stringify(details, null, 2));
            console.log("🟡 Selected mode:", selectedMode);
            console.log("🟡 User ID:", user?.id);
            
            if (!user) {
                throw new Error('No user authenticated');
            }
            
            setLoading(true);
            setError(null);

            // 1. Input validation
            const trimmedLocation = details.location?.trim();
            const trimmedPhoneNumber = details.phone_number?.trim();

            if (!trimmedLocation) {
                throw new Error('Location is required and cannot be empty.');
            }
            if (!trimmedPhoneNumber) {
                throw new Error('Phone number is required and cannot be empty.');
            }

            // 2. Mode-specific validation
            if (selectedMode === 'buyer' && (!details.interests || details.interests.length === 0)) {
                throw new Error('Please enter at least one interest for buyer setup');
            }

            if (selectedMode === 'seller' && !details.product_listed?.trim()) {
                throw new Error('Please enter at least one product to sell for seller setup');
            }

            // 3. Prepare profile update
            const isSellerMode = selectedMode === 'seller';
            const isBuyerMode = selectedMode === 'buyer';
            const now = new Date().toISOString();
            
            const profileUpdate = {
                user_id: user.id,
                username: user.email || user.user_metadata?.email || 'unknown',
                location: trimmedLocation, 
                phone_number: trimmedPhoneNumber, 
                updated_at: now,
                created_at: now, // Always set new created_at for new record
                is_seller: isSellerMode,
                is_buyer: isBuyerMode,
                seller_setup_completed: isSellerMode,
                buyer_setup_completed: isBuyerMode,
                interests: isBuyerMode && details.interests 
                    ? (Array.isArray(details.interests) ? details.interests : [details.interests])
                        .filter(i => i?.trim())
                        .map(i => i.trim().toLowerCase())
                    : []
            };

            console.log("📤 Saving profile to Supabase:", JSON.stringify(profileUpdate, null, 2));

                // 4. Start transaction
                // 1. First, check if a profile already exists for this user
            const { data: existingProfile, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (fetchError) throw fetchError;

            // 2. Prepare the update/insert data
            const profileData = {
                ...profileUpdate,
                is_active: true,
                updated_at: new Date().toISOString(),
                created_at: existingProfile?.created_at || new Date().toISOString()
            };

            // 3. If profile exists, update it; otherwise, insert a new one
            let savedProfileData;
            if (existingProfile) {
                const { data: updated, error: updateError } = await supabase
                    .from('profiles')
                    .update(profileData)
                    .eq('user_id', user.id)
                    .select()
                    .single();
                
                if (updateError) throw updateError;
                savedProfileData = updated;
            } else {
                const { data: inserted, error: insertError } = await supabase
                    .from('profiles')
                    .insert([profileData])
                    .select()
                    .single();
                
                if (insertError) throw insertError;
                savedProfileData = inserted;
            }

            // 4. Handle seller products if in seller mode
            if (isSellerMode && details.product_listed?.trim()) {
                const productInsert = {
                    seller_id: user.id,
                    name: details.product_listed.trim(),
                    location: trimmedLocation,
                    phone_number: trimmedPhoneNumber,
                    price: details.price || 0,
                    description: details.description || '',
                    created_at: new Date().toISOString()
                };
                
                const { error: productError } = await supabase
                    .from('products')
                    .insert([productInsert]);

                if (productError) {
                    console.error("❌ Error saving product:", productError);
                    // Don't fail the whole operation if product save fails
                }
            }

            // 5. Update local state
            setProfileData(savedProfileData);
            setIsProfileComplete(true);
            console.log("✅ Profile update completed successfully");

        } catch (error) {
            console.error('❌ Error in handleProfileComplete:', error);
            setError(error.message || 'Failed to save profile. Please try again.');
            setIsProfileComplete(false);
            throw error;
        } finally {
            setLoading(false);
            console.log("🟡 ============ END handleProfileComplete ============");
        }
    };
    // --- HANDLE SEARCH ---
    const handleSearch = async () => {
        if (!productSearch.trim()) {
            setError('Please enter a product name to search.');
            return;
        }
        
        if (loading) return;
        
        if (!isProfileComplete) {
            setError('Please complete your profile before searching.');
            return;
        }
        
        if (selectedMode === 'seller') {
            await findProspects();
        } else {
            await findProducts();
        }
    };

    // --- FIND PRODUCTS (BUYER MODE) ---
    const findProducts = async () => {
        setLoading(true); 
        setError(null);
        
        try {
            // UPDATED: Select 'phone_number' from products table
            const { data: products, error: fetchError } = await supabase
                .from('products')
                .select('name, price, location, description, seller_id, created_at, phone_number')
                .ilike('name', `%${productSearch.trim()}%`)
                .order('price', { ascending: true });

            if (fetchError) {
                console.error('Error fetching products:', fetchError);
                setError('Failed to fetch products. Please try again.');
                return;
            }

            setProductsFound(products || []);

            // Insert search record
            await supabase.from('searches').insert([
                { 
                    buyer_id: user.id, 
                    seller_id: null,
                    product_name: productSearch.trim(),
                    search_type: 'product',
                    prospects_found: 0,
                    created_at: new Date().toISOString()
                },
            ]);
        } catch (err) {
            console.error('Find products error:', err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // --- FIND PROSPECTS (SELLER MODE) - HYBRID BEST VERSION ---
    const findProspects = async () => {
        setLoading(true);
        setError(null);
        setProspects([]);
        
        try {
            // Validate search term first
            const searchTerm = productSearch?.trim();
            if (!searchTerm || searchTerm.length < 2) {
                setError('Please enter a product name with at least two characters.');
                return;
            }

            const sellerLocation = profileData?.location?.trim();
            
            console.log("🔍 Starting prospects search:", {
                searchTerm,
                sellerLocation,
                user_id: user?.id
            });

            if (!sellerLocation) {
                setError('Could not find seller profile location. Please update your profile.');
                return;
            }

            // 1. Fetch all potential buyers with non-null interests
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
                console.log("ℹ️ No buyers found in database");
                setProspects([]);
                return;
            }

            // 2. Normalize search term and prepare for matching
            const searchTermLower = searchTerm.toLowerCase();
            const searchWords = searchTermLower
                .split(/[\s,]+/)  // Split by spaces or commas
                .filter(w => w.length >= 2)
                .map(word => word.replace(/[^a-z0-9]/g, ''))  // Remove non-alphanumeric chars
                .filter(Boolean);  // Remove empty strings
            
            // 3. Filter buyers based on interests
            const matchingProspects = allBuyers.filter(buyer => {
                if (!buyer.interests) {
                    console.log(`Buyer ${buyer.user_id} has no interests`);
                    return false;
                }

                let interestsArray = [];
                try {
                    // Parse interests (same as before)
                    if (typeof buyer.interests === 'string') {
                        try {
                            interestsArray = JSON.parse(buyer.interests);
                        } catch (e) {
                            interestsArray = [buyer.interests];
                        }
                    } else if (Array.isArray(buyer.interests)) {
                        interestsArray = buyer.interests;
                    }

                    // Normalize interests
                    interestsArray = interestsArray
                        .filter(i => i != null)
                        .map(i => i.toString().trim().toLowerCase())
                        .filter(i => i.length > 0);

                    console.log(`Buyer ${buyer.user_id} interests:`, interestsArray);
                } catch (e) {
                    console.error(`Error processing interests:`, e);
                    return false;
                }

                // Check for matches with improved word comparison
                const hasMatch = interestsArray.some(interest => {
                    // Check if any search word is included in the interest
                    const wordMatch = searchWords.some(word => {
                        // Check direct inclusion
                        if (interest.includes(word)) return true;
                        
                        // Check for singular/plural forms
                        if (word.endsWith('s') && interest.includes(word.slice(0, -1))) return true;
                        if (!word.endsWith('s') && interest.includes(word + 's')) return true;
                        
                        // Check for common word variations
                        const variations = getWordVariations(word);
                        return variations.some(variation => interest.includes(variation));
                    });

                    // Check if the full search term is included in the interest
                    const fullTermMatch = 
                        interest.includes(searchTermLower) ||
                        (searchTermLower.endsWith('s') && interest.includes(searchTermLower.slice(0, -1))) ||
                        (!searchTermLower.endsWith('s') && interest.includes(searchTermLower + 's'));

                    console.log(`Interest "${interest}": wordMatch=${wordMatch}, fullTermMatch=${fullTermMatch}`);
                    return wordMatch || fullTermMatch;
                });

                console.log(`Buyer ${buyer.user_id} match result:`, hasMatch);
                return hasMatch;
            });

            // 4. Sort by location (local first)
            const sortedProspects = [...matchingProspects].sort((a, b) => {
                const sellerLocLower = sellerLocation.toLowerCase();
                const aLocation = a.location ? a.location.toLowerCase() : '';
                const bLocation = b.location ? b.location.toLowerCase() : '';
                
                // Priority 1: Local buyers first
                if (aLocation === sellerLocLower && bLocation !== sellerLocLower) return -1;
                if (aLocation !== sellerLocLower && bLocation === sellerLocLower) return 1;
                
                // Priority 2: Alphabetical by location
                return aLocation.localeCompare(bLocation);
            });

           // 5. Format results
            const formattedProspects = sortedProspects.map(prospect => {
                // Parse interests if it's a string
                let interests = [];
                try {
                    interests = typeof prospect.interests === 'string' 
                        ? JSON.parse(prospect.interests) 
                        : (Array.isArray(prospect.interests) ? prospect.interests : []);
                } catch (e) {
                    console.error('Error parsing interests:', e);
                    interests = [];
                }

                return {
                    id: prospect.user_id,
                    email: prospect.username,
                    location: prospect.location || 'Location not specified',
                    interest: searchTerm,
                    interests: interests,
                    phone_number: prospect.phone_number,
                    isSameLocation: prospect.location && 
                                prospect.location.toLowerCase() === sellerLocation.toLowerCase()
                };
            });
            
            setProspects(formattedProspects);

            // 6. Log the search if we found results
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
                    // Don't fail the search if logging fails
                }
            }

        } catch (err) {
            console.error('❌ Find prospects error:', err);
            setError(err.message || 'An error occurred while searching for prospects. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        try {
            setLoading(true);
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            setUser(null);
            setSelectedMode(null);
            setIsProfileComplete(false);
            setProfileData(null);
            setProspects([]);
            setProductsFound([]);
            setProductSearch('');
            
            navigate('/');
        } catch (error) {
            console.error('Sign out error:', error);
            setError('Error signing out. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && productSearch.trim()) {
            handleSearch();
        }
    };

    // --- CONDITIONAL RENDERING ---
    console.log("🔍 ============ CONDITIONAL RENDERING CHECK ============");
    console.log("🔍 selectedMode:", selectedMode);
    console.log("🔍 isProfileComplete:", isProfileComplete);
    console.log("🔍 user exists:", !!user);
    console.log("🔍 profileData:", profileData);

    if (authLoading) {
        console.log("⏳ Rendering auth loading");
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading authentication...</p>
            </div>
        );
    }

    if (!user) {
        console.log("🚫 No user, redirecting");
        return (
            <div className="loading-container">
                <p>Redirecting to login...</p>
            </div>
        );
    }

    // --- SHOW MODE SELECTION IF NO MODE SELECTED ---
    if (!selectedMode) {
        console.log("🎯 Rendering mode selection screen");
        
        // Get existing profile status for display only
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
        console.log("📝 RENDERING SETUP FORM (isProfileComplete = false)");
        console.log("Selected mode:", selectedMode);
        console.log("Existing profile data for pre-filling:", profileData);
        
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
                                disabled={loading}
                            >
                                Change Mode
                            </button>
                        </div>
                        
                        {/* Show existing data info if available */}
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
                                loading={loading}
                            />
                        ) : (
                            <BuyerSetupForm 
                                onProfileComplete={handleProfileComplete}
                                existingData={profileData}
                                isBuyerFlow={true}
                                loading={loading}
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // --- MAIN SOCIAL MARKETING INTERFACE (ONLY after form is completed) ---
    console.log("🚀 ============ RENDERING MAIN INTERFACE ============");
    console.log("🚀 isProfileComplete is TRUE! User completed the setup form.");
    console.log("🚀 Current mode in main interface:", selectedMode);
    
    return (
        <div className="app-container">
            <div className="main-social-interface">
                <header className="social-header">
                    <div className="header-content">
                        <h1 className="social-title">
                            {selectedMode === 'seller' 
                                ? 'Find Customers for Your Products' 
                                : 'Find Products to Buy'}
                            <span className="user-mode">
                                {selectedMode === 'seller' ? 'Seller Mode' : 'Buyer Mode'}
                            </span>
                        </h1>
                        
                        <div className="user-controls">
                            <div className="user-info-card">
                                {/* User info stays the same */}
                                <div className="user-basic-info">
                                    <div className="user-avatar">
                                        {user.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="user-details">
                                        <div className="user-email">{user.email}</div>
                                        <div className="user-location">
                                            <span className="location-icon">📍</span>
                                            {profileData?.location || 'No location set'}
                                        </div>
                                        <div className="user-profile-status">
                                            <span className="status-badge complete">
                                                ✓ {selectedMode === 'seller' ? 'Seller' : 'Buyer'} Setup Complete
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="user-mode-info">
                                    <span className={`mode-tag ${selectedMode}`}>
                                        {selectedMode === 'seller' ? 'SELLER' : 'BUYER'}
                                    </span>
                                    <div className="user-actions">
                                        <button 
                                            onClick={handleSwitchMode}
                                            className="switch-mode-button"
                                        >
                                            Switch Mode
                                        </button>
                                        <button 
                                            onClick={handleSignOut}
                                            className="signout-button"
                                            disabled={loading}
                                        >
                                            Sign Out
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

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
                                        setProductSearch(e.target.value);
                                        setError(null);
                                    }}
                                    onKeyPress={handleKeyPress}
                                    className="search-input-large"
                                    disabled={loading}
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
                                disabled={loading || !productSearch.trim()}
                                className="search-button-large"
                            >
                                {loading ? (
                                    <>
                                        <span className="search-spinner"></span>
                                        Searching...
                                    </>
                                ) : (
                                    <>
                                        <span className="search-icon">
                                            {selectedMode === 'seller' ? '👥' : '🔎'}
                                        </span>
                                        {selectedMode === 'seller' ? 'Find Prospects' : 'Find Products'}
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
                                                    
                                                    <p className="debug-info">
                                                        <small>
                                                            💡 <strong>Note:</strong> The system is working correctly. 
                                                            You need customers who have added "{productSearch}" to their interests.
                                                        </small>
                                                    </p>
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
                                                        <button className="connect-button">
                                                            Connect with Customer
                                                        </button>
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
                                                        <p className="product-description">{p.description}</p>
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
                                                <div className="product-card-footer">
                                                    <button className="contact-seller-button">
                                                        Contact Seller
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
</div>
    );
}

export default SocialAIMarketingEngine;

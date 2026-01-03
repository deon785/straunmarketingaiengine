import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import DOMPurify from 'dompurify';

const BuyerSetupForm = ({ onProfileComplete, existingData, isLoading = false }) => {
    const [profileDetails, setProfileDetails] = useState({
        username: '',
        interests: '',
        location: '',
        phone_number: '',
    });
    
    const [user, setUser] = useState(null);
    const [userLoading, setUserLoading] = useState(true); // ✅ Add user loading state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    
    // ✅ FIXED: Correct variable names for buyer profiles
    const [buyerProfiles, setBuyerProfiles] = useState([]);
    const [loadingProfiles, setLoadingProfiles] = useState(false);
    const [profilesError, setProfilesError] = useState(null);   
    // ✅ CORRECTED: Fetch products from the correct table

    const fetchBuyerProfiles = async () => {
        setLoadingProfiles(true); 
        setProfilesError(null); 
        try {
            const { data, error: supabaseError } = await supabase
                .from('profiles') // Changed from 'profiles' to 'products'
                .select('*')
                .eq('is_buyer', true)
                .order('created_at', { ascending: false });
                
            if (supabaseError) {
                throw supabaseError;
            }
            
            if (data) {
                setBuyerProfiles(data); 
            }
        } catch (err) {
            setProfilesError("Failed to load profiles. Please check your connection.");
            console.error("Profiles fetch error:", err.message);
        } finally {
            setLoadingProfiles(false); 
        }
    };

    // ✅ Fetch profiles when component loads
    useEffect(() => {
        fetchBuyerProfiles();   }, []);

    // Get current user session with SMART pre-fill
    useEffect(() => {
        const getUser = async () => {
            setUserLoading(true);
            try {
                const storedUser = localStorage.getItem('user');
                
                if (storedUser) {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                } else {
                    const { data: { user }, error: userError } = await supabase.auth.getUser();
                    if (userError) {
                        console.error('Error getting user:', userError);
                        setError('Please sign in to continue.');
                        return;
                    }
                    if (user) {
                        localStorage.setItem('user', JSON.stringify(user));
                        setUser(user);
                    }
                }
                
                if (existingData) {
                    setProfileDetails(prev => ({
                        ...prev,
                        username: existingData.username || '',
                        location: existingData.location || '',
                        phone_number: existingData.phone_number || '',
                    }));
                }
            } catch (error) {
                console.error('Error in getUser:', error);
                setError('Failed to load user session.');
            } finally {
            setUserLoading(false); 
         }
        };
        getUser();
    }, [existingData]);

    // ✅ SANITIZATION FUNCTION
    const sanitizeInput = (name, value) => {
        switch(name) {
            case 'username':
                return value.replace(/[<>"'`&;\\]/g, '').substring(0, 50);
                
            case 'interests':
                return DOMPurify.sanitize(value, {
                    ALLOWED_TAGS: [],
                    ALLOWED_ATTR: [],
                    KEEP_CONTENT: true
                }).substring(0, 500);
                
            case 'location':
                return value.replace(/[<>"'`&;\\]/g, '').substring(0, 100);
                
            case 'phone_number':
                return value.replace(/[^\d\s\+\-\(\)]/g, '');
                
            default:
                return value;
        }
    };

    // ✅ REAL-TIME VALIDATION
    const validateField = (name, value) => {
        const errors = { ...fieldErrors };
        
        switch(name) {
            case 'username':
                if (value && value.length < 2) {
                    errors[name] = 'Username must be at least 2 characters';
                } else if (value.length > 50) {
                    errors[name] = 'Username cannot exceed 50 characters';
                } else {
                    delete errors[name];
                }
                break;
                
            case 'interests':
                if (!value.trim()) {
                    errors[name] = 'Interests are required';
                } else if (value.length < 3) {
                    errors[name] = 'Please enter at least one interest';
                } else {
                    const interestsArray = value.split(/[,;\s]+/)
                        .map(interest => interest.trim())
                        .filter(interest => interest !== '');
                    
                    if (interestsArray.length === 0) {
                        errors[name] = 'Please enter valid interests';
                    } else if (interestsArray.some(interest => interest.length > 50)) {
                        errors[name] = 'Each interest should be less than 50 characters';
                    } else {
                        delete errors[name];
                    }
                }
                break;
                
            case 'location':
                if (!value.trim()) {
                    errors[name] = 'Location is required';
                } else if (value.length < 2) {
                    errors[name] = 'Location must be at least 2 characters';
                } else {
                    delete errors[name];
                }
                break;
                
            case 'phone_number':
                const phoneRegex = /^[\+]?[1-9][\d\s\-\(\)\.]{8,}$/;
                const cleanPhone = value.replace(/\s+/g, '');
                
                if (!value.trim()) {
                    errors[name] = 'Phone number is required';
                } else if (!phoneRegex.test(cleanPhone)) {
                    errors[name] = 'Please enter a valid phone number';
                } else {
                    delete errors[name];
                }
                break;
        }
        
        setFieldErrors(errors);
        return !errors[name];
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        const sanitizedValue = sanitizeInput(name, value);
        
        setProfileDetails(prev => ({ 
            ...prev, 
            [name]: sanitizedValue 
        }));
        
        validateField(name, sanitizedValue);
    };

    // ✅ FORM VALIDATION BEFORE SUBMIT
    const validateForm = () => {
        const errors = {};
        
        if (!profileDetails.location.trim()) {
            errors.location = 'Location is required';
        }
        
        if (!profileDetails.phone_number.trim()) {
            errors.phone = 'Phone number is required';
        } else {
            const cleanPhone = profileDetails.phone_number.replace(/\s+/g, '');
            const phoneRegex = /^[\+]?[1-9][\d\s\-\(\)\.]{8,}$/;
            if (!phoneRegex.test(cleanPhone)) {
                errors.phone = 'Please enter a valid phone number';
            }
        }
        
        if (!profileDetails.interests.trim()) {
            errors.interests = 'Interests are required';
        } else {
            const interestsArray = profileDetails.interests.split(/[,;\s]+/)
                .map(interest => interest.trim())
                .filter(interest => interest !== '');
            
            if (interestsArray.length === 0) {
                errors.interests = 'Please enter at least one valid interest';
            }
        }
        
        return errors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!user) {
            console.error('User not found in state');
            setError('Please sign in to continue.');
            return;
        }
        
        if (isLoading || isSubmitting) return;

        const formErrors = validateForm();
        if (Object.keys(formErrors).length > 0) {
            setFieldErrors(formErrors);
            setError('Please fix the errors in the form');
            return;
        }

        setError(null);
        setIsSubmitting(true);

        try {
            console.log("📤 BuyerSetupForm submitting...");

            const finalSanitizedData = {
                username: profileDetails.username.trim().substring(0, 50),
                location: profileDetails.location.trim().substring(0, 100),
                phone_number: profileDetails.phone_number.trim().replace(/[^\d+]/g, '').substring(0, 20),
                interests: DOMPurify.sanitize(profileDetails.interests.trim(), {
                    ALLOWED_TAGS: [],
                    ALLOWED_ATTR: [],
                    KEEP_CONTENT: true
                }).substring(0, 500)
            };

            const newInterests = finalSanitizedData.interests
                .split(/[,;\s]+/)
                .map(interest => interest.trim().toLowerCase())
                .filter(interest => 
                    interest !== '' && 
                    interest.length > 1 && 
                    interest.length < 50
                );

            if (newInterests.length === 0) {
                throw new Error('Please enter at least one valid interest (e.g., electronics, books)');
            }

            const finalNewInterests = [...new Set(newInterests)];

            const basePayload = {
                user_id: user.id,
                username: finalSanitizedData.username || user.email,
                location: finalSanitizedData.location,
                phone_number: finalSanitizedData.phone_number,
                updated_at: new Date().toISOString(),
                is_buyer: true,
                buyer_setup_completed: true,
                is_active: true
            };

            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('interests')
                .eq('user_id', user.id)
                .single();

            let combinedInterests;
            if (existingProfile && existingProfile.interests) {
                const sanitizedExisting = (existingProfile.interests || [])
                    .map(interest => interest.toLowerCase().trim())
                    .filter(interest => interest.length > 0 && interest.length < 50);
                
                combinedInterests = [...new Set([
                    ...sanitizedExisting,
                    ...finalNewInterests
                ])];
            } else {
                combinedInterests = finalNewInterests;
            }

            const payload = {
                ...basePayload,
                interests: combinedInterests
            };

            let data, error;
            if (existingProfile) {
                const { data: updateData, error: updateError } = await supabase
                    .from('profiles')
                    .update(payload)
                    .eq('user_id', user.id)
                    .select();
                
                data = updateData;
                error = updateError;
            } else {
                const { data: insertData, error: insertError } = await supabase
                    .from('profiles')
                    .insert([payload])
                    .select();
                
                data = insertData;
                error = insertError;
            }

            if (error) {
                console.error('📛 FULL Supabase Error Details:', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                    user_id: user?.id,
                    payload: payload
                });
                
                if (error.code === '42501' || error.message.includes('403')) {
                    throw new Error(`Permission denied. Check RLS policies.`);
                }
                
                throw error;
            }

            if (!data || data.length === 0) {
                throw new Error('Profile saved but no data returned.');
            }

            console.log("✅ Profile Saved:", data[0]);
            
            const updatedUser = {
                ...user,
                location: finalSanitizedData.location,
                phone_number: finalSanitizedData.phone_number,
                username: finalSanitizedData.username || user.email
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            onProfileComplete({
                location: finalSanitizedData.location,
                phone_number: finalSanitizedData.phone_number,
                username: finalSanitizedData.username || user.email,
                interests: combinedInterests
            });

        } catch (err) {
            console.error('❌ Profile Submission Error:', err);
            setError(err.message || 'Error setting up profile. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = () => {
        setProfileDetails({
            username: '',
            interests: '',
            location: existingData?.location || '',
            phone_number: existingData?.phone_number || '',
        });
        setFieldErrors({});
        setError(null);
    };

    if (userLoading) {
        return (
            <div className="p-5 bg-gray-900 rounded-xl shadow-2xl text-white max-w-xl mx-auto my-8">
                <p className="text-center py-10">Loading user session...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-5 bg-gray-900 rounded-xl shadow-2xl text-white max-w-xl mx-auto my-8">
                <p className="text-center py-10">Loading user session...</p>
                {error && (
                    <div className="mt-4 p-4 bg-red-900 border border-red-700 rounded-lg">
                        <p className="text-center text-red-200">{error}</p>
                        <button 
                            onClick={() => window.location.href = '/signup'}
                            className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                        >
                            Go to Signup
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="p-5 bg-gray-900 rounded-xl shadow-2xl text-white max-w-4xl mx-auto my-8 font-sans">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Form */}
                <div className="lg:col-span-2">
                    <style>{`
                        .buyer-form input, 
                        .buyer-form textarea {
                            width: 100%;
                            padding: 12px;
                            margin-top: 5px;
                            margin-bottom: 5px;
                            border-radius: 8px;
                            border: 2px solid ${fieldErrors.location || fieldErrors.phone_number || fieldErrors.interests ? '#f87171' : '#4a5568'};
                            background-color: #000000 !important;
                            color: #ffffff !important;
                            box-sizing: border-box;
                            font-size: 16px;
                            transition: border-color 0.3s;
                        }
                        
                        .buyer-form input:focus, 
                        .buyer-form textarea:focus {
                            outline: none;
                            border-color: ${fieldErrors.location || fieldErrors.phone_number || fieldErrors.interests ? '#f87171' : '#48bb78'};
                            box-shadow: 0 0 0 3px rgba(72, 187, 120, 0.2);
                            background-color: #000000 !important;
                            color: #ffffff !important;
                        }
                        
                        .buyer-form input::placeholder, 
                        .buyer-form textarea::placeholder {
                            color: #a0aec0 !important;
                        }
                        
                        .buyer-form label {
                            display: block;
                            font-weight: 600;
                            color: #e2e8f0;
                            margin-bottom: 8px;
                            font-size: 14px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        
                        .buyer-form .error-message {
                            background-color: #7f1d1d;
                            border: 2px solid #dc2626;
                            color: #fecaca;
                            padding: 12px;
                            border-radius: 8px;
                            margin-bottom: 20px;
                            font-size: 14px;
                        }
                        
                        .field-error {
                            color: #f87171;
                            font-size: 12px;
                            margin-top: -5px;
                            margin-bottom: 10px;
                        }
                        
                        .char-counter {
                            text-align: right;
                            font-size: 12px;
                            color: #a0aec0;
                            margin-top: -10px;
                            margin-bottom: 10px;
                        }
                        
                        .char-counter.warning {
                            color: #fbbf24;
                        }
                        
                        .char-counter.error {
                            color: #f87171;
                        }
                        
                        .buyer-form input:-webkit-autofill,
                        .buyer-form input:-webkit-autofill:hover,
                        .buyer-form input:-webkit-autofill:focus,
                        .buyer-form input:-webkit-autofill:active,
                        .buyer-form textarea:-webkit-autofill,
                        .buyer-form textarea:-webkit-autofill:hover,
                        .buyer-form textarea:-webkit-autofill:focus,
                        .buyer-form textarea:-webkit-autofill:active {
                            -webkit-box-shadow: 0 0 0 1000px #000000 inset !important;
                            -webkit-text-fill-color: #ffffff !important;
                            transition: background-color 5000s ease-in-out 0s;
                        }
                    `}</style>

                    <form onSubmit={handleSubmit} className="buyer-form">
                        <h3 className="text-3xl font-bold mb-4 text-green-400">Complete Buyer Profile Setup</h3>
                        
                        <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
                            <p className="text-gray-300 mb-2">
                                <strong>User:</strong> {user.email}
                            </p>
                            <p className="text-gray-300">
                                Just a few details to get your account ready for shopping!
                            </p>
                            {existingData && (existingData.location || existingData.phone_number) && (
                                <div className="mt-2 p-2 bg-gray-700 rounded">
                                    <p className="text-green-300 text-sm">
                                        <strong>Note:</strong> You have existing profile data.
                                    </p>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="error-message">
                                <strong>Error:</strong> {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="location">Location *</label>
                            <input
                                type="text"
                                id="location"
                                name="location"
                                value={profileDetails.location}
                                onChange={handleChange}
                                required
                                disabled={isLoading || isSubmitting || userLoading}
                                placeholder="e.g., Harare, Zimbabwe"
                                minLength="2"
                                maxLength="100"
                            />
                            {fieldErrors.location && (
                                <div className="field-error">{fieldErrors.location}</div>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="phone_number">Phone Number *</label>
                            <input
                                type="tel"
                                id="phone_number"
                                name="phone_number"
                                value={profileDetails.phone_number}
                                onChange={handleChange}
                                required
                                disabled={isLoading || isSubmitting || userLoading}
                                placeholder="+263 712 345 678"
                                pattern="^[\+]?[1-9][\d\s\-\(\)\.]{8,}$"
                                title="Enter a valid phone number (digits, +, spaces, dashes, parentheses only)"
                            />
                            {fieldErrors.phone && (
                                <div className="field-error">{fieldErrors.phone}</div>
                            )}
                            <small className="text-gray-400 text-sm">
                                Format: +country code followed by number
                            </small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="interests">Shopping Interests *</label>
                            <textarea
                                id="interests"
                                name="interests"
                                value={profileDetails.interests}
                                onChange={handleChange}
                                required
                                disabled={isLoading || isSubmitting || userLoading}
                                rows="4"
                                placeholder="Enter your shopping interests separated by commas (e.g., electronics, books, clothing, home decor)"
                                minLength="3"
                                maxLength="500"
                            ></textarea>
                            <div className={`char-counter ${
                                profileDetails.interests.length > 450 ? 'warning' : 
                                profileDetails.interests.length > 500 ? 'error' : ''
                            }`}>
                                {profileDetails.interests.length}/500
                            </div>
                            {fieldErrors.interests && (
                                <div className="field-error">{fieldErrors.interests}</div>
                            )}
                            <small className="text-gray-400 text-sm">
                                Separate interests with commas. This helps sellers find you.
                            </small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="username">Username (Optional)</label>
                            <input
                                type="text"
                                id="username"
                                name="username"
                                value={profileDetails.username}
                                onChange={handleChange}
                                disabled={isLoading || isSubmitting || userLoading}
                                placeholder="Choose a display name (defaults to email)"
                                minLength="2"
                                maxLength="50"
                            />
                            {fieldErrors.username && (
                                <div className="field-error">{fieldErrors.username}</div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || isSubmitting || userLoading}
                            className="w-full py-4 mt-6 rounded-lg text-white font-bold text-lg transition-all duration-300"
                            style={{
                                width: '100%',
                                padding: '16px',
                                background: isLoading || isSubmitting || userLoading 
                                    ? '#374151'
                                    : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                cursor: isLoading || isSubmitting  || userLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading || isSubmitting  || userLoading ? 0.7 : 1,
                                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
                                letterSpacing: '0.5px'
                            }}
                        >
                            {isLoading || isSubmitting ? (
                                <div className="flex items-center justify-center">
                                    <svg 
                                        className="animate-spin mr-3"
                                        style={{ height: '24px', width: '24px' }}
                                        xmlns="http://www.w3.org/2000/svg" 
                                        fill="none" 
                                        viewBox="0 0 24 24"
                                    >
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                </div>
                            ) : (
                                'Complete Setup'
                            )}
                        </button>

                    </form>

                    <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700 text-sm text-gray-300">
                        <h4 className="font-semibold text-gray-200 mb-2">Note:</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>All HTML tags will be removed from interests for security</li>
                            <li>Your interests will help sellers find potential customers</li>
                            <li>Your location is used to find local products</li>
                            <li>Your profile will be visible to sellers searching for prospects</li>
                            <li>You can update your information anytime</li>
                        </ul>
                    </div>

                {/* Reset Form Button - Below Complete Setup */}
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={isLoading || isSubmitting || userLoading}
                        className="w-full py-4 mt-4 rounded-lg text-white font-bold text-lg transition-all duration-300"
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: isLoading || isSubmitting || userLoading 
                                ? '#374151'
                                : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            cursor: isLoading || isSubmitting || userLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading || isSubmitting || userLoading ? 0.7 : 1,
                            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
                            letterSpacing: '0.5px'
                        }}
                    >
                        Reset Form
                    </button>
                </div>

            </div>
        </div>
    );
};

export default BuyerSetupForm;
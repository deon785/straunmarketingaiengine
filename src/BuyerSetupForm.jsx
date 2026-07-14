import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from './lib/supabase';
import DOMPurify from 'dompurify';

// ✅ fetchWithRetry helper
const fetchWithRetry = async (fetchFn, maxRetries = 3) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFn();
    } catch (err) {
      lastError = err;
      console.warn(`Fetch attempt ${i + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  throw lastError;
};

const BuyerSetupForm = ({ onProfileComplete, existingData, isLoading = false }) => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [userLoading, setUserLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [buyerProfiles, setBuyerProfiles] = useState([]);
    const [loadingProfiles, setLoadingProfiles] = useState(false);
    const [profilesError, setProfilesError] = useState(null);
    
    const isFirstRender = useRef(true);
    const userFetchedRef = useRef(false);

    // ============ REACT HOOK FORM ============
    const {
        register,
        handleSubmit,
        formState: { errors, isDirty },
        reset,
        setValue,
        watch,
        getValues
    } = useForm({
        mode: 'onSubmit',
        defaultValues: {
            username: existingData?.username || '',
            location: existingData?.location || '',
            phone_number: existingData?.phone_number || '',
            interests: '',  // ✅ Always empty - user types new interests
        }
    });

    // Watch values for character counter (no re-renders of whole form)
    const interestsValue = watch('interests', '');
    const locationValue = watch('location', '');
    const phoneValue = watch('phone_number', '');
    const usernameValue = watch('username', '');

    // ============ FETCH USER ============
    useEffect(() => {
        const getUser = async () => {
            if (userFetchedRef.current) return;
            userFetchedRef.current = true;
            
            setUserLoading(true);
            try {
                const storedUser = localStorage.getItem('user');
                
                if (storedUser) {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                    
                    // Pre-fill form with existing data if available
                    if (existingData && isFirstRender.current) {
                        const updates = {
                            username: existingData.username || '',
                            location: existingData.location || '',
                            phone_number: existingData.phone_number || '',
                            interests: '',  // ✅ Always empty
                        };
                        reset(updates);
                        isFirstRender.current = false;
                    }
                } else {
                    const { data: { user: supabaseUser }, error: userError } = await fetchWithRetry(() =>
                        supabase.auth.getUser()
                    );
                    if (userError) {
                        console.error('Error getting user:', userError);
                        setError('Please sign in to continue.');
                        return;
                    }
                    if (supabaseUser) {
                        localStorage.setItem('user', JSON.stringify(supabaseUser));
                        setUser(supabaseUser);
                    }
                }
            } catch (error) {
                console.error('Error in getUser:', error);
                setError('Failed to load user session.');
            } finally {
                setUserLoading(false);
            }
        };
        getUser();
    }, [existingData, reset]);

    // ============ FETCH BUYER PROFILES ============
    const fetchBuyerProfiles = useCallback(async () => {
        setLoadingProfiles(true);
        setProfilesError(null);
        try {
            const { data, error } = await fetchWithRetry(() =>
                supabase
                    .from('profiles')
                    .select('*')
                    .eq('is_buyer', true)
                    .order('created_at', { ascending: false })
            );
                
            if (error) throw error;
            if (data) setBuyerProfiles(data);
        } catch (err) {
            setProfilesError("Failed to load profiles. Please check your connection.");
            console.error("Profiles fetch error:", err.message);
        } finally {
            setLoadingProfiles(false);
        }
    }, []);

    useEffect(() => {
        fetchBuyerProfiles();
    }, [fetchBuyerProfiles]);

    // ============ FORM SUBMISSION ============
    const onSubmit = useCallback(async (data) => {
        // Check offline status
        if (!navigator.onLine) {
            setError('You are offline. Please connect to the internet to complete setup.');
            return;
        }
        
        if (!user) {
            console.error('User not found in state');
            setError('Please sign in to continue.');
            return;
        }
        
        if (isLoading || isSubmitting) return;

        setError(null);
        setIsSubmitting(true);

        try {
            console.log("📤 BuyerSetupForm submitting...");

            // Sanitize data
            const finalSanitizedData = {
                username: data.username?.trim().substring(0, 50) || user.email,
                location: data.location.trim().substring(0, 100),
                phone_number: data.phone_number.trim().replace(/[^\d+]/g, '').substring(0, 20),
                interests: DOMPurify.sanitize(data.interests.trim(), {
                    ALLOWED_TAGS: [],
                    ALLOWED_ATTR: [],
                    KEEP_CONTENT: true
                }).substring(0, 500)
            };

            // Process interests
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
                username: finalSanitizedData.username,
                location: finalSanitizedData.location,
                phone_number: finalSanitizedData.phone_number,
                updated_at: new Date().toISOString(),
                is_buyer: true,
                buyer_setup_completed: true,
                is_active: true
            };

            // Check existing profile
            const { data: existingProfile, error: existingError } = await fetchWithRetry(() =>
                supabase
                    .from('profiles')
                    .select('interests')
                    .eq('user_id', user.id)
                    .maybeSingle()
            );

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

            let result;
            if (existingProfile) {
                result = await fetchWithRetry(() =>
                    supabase
                        .from('profiles')
                        .update(payload)
                        .eq('user_id', user.id)
                        .select()
                );
            } else {
                result = await fetchWithRetry(() =>
                    supabase
                        .from('profiles')
                        .insert([payload])
                        .select()
                );
            }

            const { data: resultData, error: resultError } = result;

            if (resultError) {
                console.error('📛 Supabase Error Details:', resultError);
                if (resultError.code === '42501' || resultError.message.includes('403')) {
                    throw new Error(`Permission denied. Check RLS policies.`);
                }
                throw resultError;
            }

            if (!resultData || resultData.length === 0) {
                throw new Error('Profile saved but no data returned.');
            }

            console.log("✅ Profile Saved:", resultData[0]);
            
            // Update local storage
            const updatedUser = {
                ...user,
                location: finalSanitizedData.location,
                phone_number: finalSanitizedData.phone_number,
                username: finalSanitizedData.username
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            // Reset form with new data
            reset({
                username: finalSanitizedData.username,
                location: finalSanitizedData.location,
                phone_number: finalSanitizedData.phone_number,
                interests: finalSanitizedData.interests
            });
            
            onProfileComplete({
                location: finalSanitizedData.location,
                phone_number: finalSanitizedData.phone_number,
                username: finalSanitizedData.username,
                interests: combinedInterests
            });

        } catch (err) {
            console.error('❌ Profile Submission Error:', err);
            setError(err.message || 'Error setting up profile. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [user, isLoading, isSubmitting, onProfileComplete, reset]);

    const handleReset = useCallback(() => {
        reset({
            username: existingData?.username || '',
            location: existingData?.location || '',
            phone_number: existingData?.phone_number || '',
            interests: '',  // ✅ Always empty
        });
        setError(null);
    }, [reset, existingData]);

    // ============ RENDER ============
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
                <p className="text-center py-10">Please sign in to continue.</p>
                {error && (
                    <div className="mt-4 p-4 bg-red-900 border border-red-700 rounded-lg">
                        <p className="text-center text-red-200">{error}</p>
                        <button 
                            onClick={() => navigate('/')}
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
                <div className="lg:col-span-2">
                    <style>{`
                        .buyer-form input, 
                        .buyer-form textarea {
                            width: 100%;
                            padding: 12px;
                            margin-top: 5px;
                            margin-bottom: 5px;
                            border-radius: 8px;
                            border: 2px solid #4a5568;
                            background-color: #000000 !important;
                            color: #ffffff !important;
                            box-sizing: border-box;
                            font-size: 16px;
                            transition: border-color 0.3s;
                        }
                        
                        .buyer-form input:focus, 
                        .buyer-form textarea:focus {
                            outline: none;
                            border-color: #48bb78;
                            box-shadow: 0 0 0 3px rgba(72, 187, 120, 0.2);
                            background-color: #000000 !important;
                            color: #ffffff !important;
                        }
                        
                        .buyer-form input.error,
                        .buyer-form textarea.error {
                            border-color: #f87171;
                        }
                        
                        .buyer-form input.error:focus,
                        .buyer-form textarea.error:focus {
                            border-color: #f87171;
                            box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.2);
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
                        
                        .submit-button {
                            width: 100%;
                            padding: 16px;
                            margin-top: 24px;
                            border-radius: 8px;
                            border: none;
                            color: white;
                            font-weight: bold;
                            font-size: 18px;
                            transition: all 0.3s ease;
                            cursor: pointer;
                        }
                        
                        .submit-button:disabled {
                            opacity: 0.7;
                            cursor: not-allowed;
                            background: #374151;
                        }
                        
                        .submit-button:not(:disabled) {
                            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
                        }
                        
                        .submit-button:not(:disabled):hover {
                            transform: translateY(-2px);
                            box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
                        }
                        
                        .reset-button {
                            width: 100%;
                            padding: 16px;
                            margin-top: 16px;
                            border-radius: 8px;
                            border: none;
                            color: white;
                            font-weight: bold;
                            font-size: 18px;
                            transition: all 0.3s ease;
                            cursor: pointer;
                            background: #4a5568;
                        }
                        
                        .reset-button:disabled {
                            opacity: 0.7;
                            cursor: not-allowed;
                        }
                        
                        .reset-button:not(:disabled):hover {
                            background: #5a6578;
                        }
                    `}</style>

                    <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="buyer-form">
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

                        {/* Location */}
                        <div className="form-group">
                            <label htmlFor="location">Location *</label>
                            <input
                                type="text"
                                id="location"
                                className={errors.location ? 'error' : ''}
                                {...register('location', {
                                    required: 'Location is required',
                                    minLength: {
                                        value: 2,
                                        message: 'Location must be at least 2 characters'
                                    },
                                    maxLength: {
                                        value: 100,
                                        message: 'Location cannot exceed 100 characters'
                                    }
                                })}
                                disabled={isLoading || isSubmitting || userLoading}
                                placeholder="e.g., Harare, Zimbabwe"
                            />
                            {errors.location && (
                                <div className="field-error">{errors.location.message}</div>
                            )}
                        </div>

                        {/* Phone Number */}
                        <div className="form-group">
                            <label htmlFor="phone_number">Phone Number *</label>
                            <input
                                type="tel"
                                id="phone_number"
                                className={errors.phone_number ? 'error' : ''}
                                {...register('phone_number', {
                                    required: 'Phone number is required',
                                    pattern: {
                                        value: /^[\+]?[1-9][\d\s\-\(\)\.]{8,}$/,
                                        message: 'Please enter a valid phone number'
                                    }
                                })}
                                disabled={isLoading || isSubmitting || userLoading}
                                placeholder="+263 712 345 678"
                            />
                            {errors.phone_number && (
                                <div className="field-error">{errors.phone_number.message}</div>
                            )}
                            <small className="text-gray-400 text-sm">
                                Format: +country code followed by number
                            </small>
                        </div>

                        {/* Interests */}
                        <div className="form-group">
                            <label htmlFor="interests">Shopping Interests *</label>
                            <textarea
                                id="interests"
                                className={errors.interests ? 'error' : ''}
                                {...register('interests', {
                                    required: 'Interests are required',
                                    minLength: {
                                        value: 3,
                                        message: 'Please enter at least one interest'
                                    },
                                    maxLength: {
                                        value: 500,
                                        message: 'Interests cannot exceed 500 characters'
                                    },
                                    validate: {
                                        hasValidInterests: (value) => {
                                            // ✅ Handle both string and array
                                            let interestsString = value;
                                            if (Array.isArray(value)) {
                                                interestsString = value.join(',');
                                            }
                                            if (typeof value !== 'string') {
                                                interestsString = String(value);
                                            }
                                            
                                            const interestsArray = interestsString.split(/[,;\s]+/)
                                                .map(interest => interest.trim())
                                                .filter(interest => interest !== '');
                                            
                                            if (interestsArray.length === 0) {
                                                return 'Please enter at least one valid interest';
                                            }
                                            
                                            const hasInvalid = interestsArray.some(interest => interest.length > 50);
                                            if (hasInvalid) {
                                                return 'Each interest should be less than 50 characters';
                                            }
                                            
                                            return true;
                                        }
                                    }
                                })}
                                disabled={isLoading || isSubmitting || userLoading}
                                rows="4"
                                placeholder="Enter your shopping interests separated by commas (e.g., electronics, books, clothing, home decor)"
                            />
                            <div className={`char-counter ${
                                interestsValue.length > 450 ? 'warning' : 
                                interestsValue.length > 500 ? 'error' : ''
                            }`}>
                                {interestsValue.length}/500
                            </div>
                            {errors.interests && (
                                <div className="field-error">{errors.interests.message}</div>
                            )}
                            <small className="text-gray-400 text-sm">
                                Separate interests with commas. This helps sellers find you.
                            </small>
                        </div>

                        {/* Username */}
                        <div className="form-group">
                            <label htmlFor="username">Username (Optional)</label>
                            <input
                                type="text"
                                id="username"
                                className={errors.username ? 'error' : ''}
                                {...register('username', {
                                    minLength: {
                                        value: 2,
                                        message: 'Username must be at least 2 characters'
                                    },
                                    maxLength: {
                                        value: 50,
                                        message: 'Username cannot exceed 50 characters'
                                    }
                                })}
                                disabled={isLoading || isSubmitting || userLoading}
                                placeholder="Choose a display name (defaults to email)"
                            />
                            {errors.username && (
                                <div className="field-error">{errors.username.message}</div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || isSubmitting || userLoading}
                            className="submit-button"
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

                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={isLoading || isSubmitting || userLoading}
                        className="reset-button"
                    >
                        Reset Form
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(BuyerSetupForm, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.existingData?.location === nextProps.existingData?.location &&
    prevProps.existingData?.phone_number === nextProps.existingData?.phone_number &&
    prevProps.existingData?.interests === nextProps.existingData?.interests &&
    prevProps.existingData?.username === nextProps.existingData?.username
  );
});

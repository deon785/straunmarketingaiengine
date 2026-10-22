import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from './lib/supabase';
import { useAuthActions } from './AuthContext';
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

// ============================================
// ✅ LIGHT MODE TOKENS (matches Seller + UserDashboard)
// ============================================
const T = {
  pageBg: '#ffffff',
  cardBg: '#ffffff',
  cardBorder: '#e5e7eb',
  softBg: '#f7f8fa',
  softBorder: '#eaeef2',
  text: '#0f172a',
  textMuted: '#52607a',
  textLight: '#8291a9',
  inputBg: '#000000',        // ✅ black inputs (as you requested)
  inputBorder: '#404040',
  inputText: '#ffffff',
  inputPlaceholder: '#888888',
  errorText: '#dc2626',
  errorBorder: '#f87171',
  primary: '#3b82f6',
  primaryDark: '#1d4ed8',
  success: '#10b981',
  radius: '12px',
};

const BuyerSetupForm = ({ onProfileComplete, existingData, isLoading = false }) => {
    const navigate = useNavigate();
    const { setMode } = useAuthActions();
    const [user, setUser] = useState(null);
    const [userLoading, setUserLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [buyerProfiles, setBuyerProfiles] = useState([]);
    const [loadingProfiles, setLoadingProfiles] = useState(false);
    const [profilesError, setProfilesError] = useState(null);
    
    const isFirstRender = useRef(true);
    const userFetchedRef = useRef(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
        setValue,
        watch,
    } = useForm({
        mode: 'onSubmit',
        defaultValues: {
            username: existingData?.username || '',
            location: existingData?.location || '',
            phone_number: existingData?.phone_number || '',
            interests: '',
        }
    });

    const interestsValue = watch('interests', '');
    const locationValue = watch('location', '');
    const usernameValue = watch('username', '');

    const validatePhoneNumber = useCallback((phone) => {
        if (!phone) return 'Phone number is required';
        let cleanedPhone = phone.replace(/[\s\-\(\)\.]/g, '');
        let rawDigits = cleanedPhone.replace(/^\+/, '');
        const digitsOnly = rawDigits.replace(/\D/g, '');
        const isLocalFormat = rawDigits.startsWith('0');
        if (isLocalFormat) {
            if (digitsOnly.length !== 10) return 'Please enter a valid phone number (e.g., 0712345678)';
        } else {
            if (digitsOnly.length !== 12) return 'Please enter a valid phone number (e.g., 263712345678)';
        }
        return true;
    }, []);

    useEffect(() => {
        const pendingInterest = localStorage.getItem('straun_pending_interest');
        if (pendingInterest) {
            console.log('🎯 Pre-filling interest from deal:', pendingInterest);
            setValue('interests', pendingInterest);
            localStorage.removeItem('straun_pending_interest');
        }
    }, [setValue]);

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
                    if (existingData && isFirstRender.current) {
                        reset({
                            username: existingData.username || '',
                            location: existingData.location || '',
                            phone_number: existingData.phone_number || '',
                            interests: '',
                        });
                        isFirstRender.current = false;
                    }
                } else {
                    const { data: { user: supabaseUser }, error: userError } = await fetchWithRetry(() =>
                        supabase.auth.getUser()
                    );
                    if (userError) { setError('Please sign in to continue.'); return; }
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

    useEffect(() => { fetchBuyerProfiles(); }, [fetchBuyerProfiles]);

    const onSubmit = useCallback(async (data) => {
        if (!navigator.onLine) { setError('You are offline. Please connect to the internet to complete setup.'); return; }
        if (!user) { setError('Please sign in to continue.'); return; }
        if (isLoading || isSubmitting) return;
        setError(null);
        setIsSubmitting(true);

        try {
            console.log("📤 BuyerSetupForm submitting...");
            const finalSanitizedData = {
                username: data.username?.trim().substring(0, 50) || user.email,
                location: data.location.trim().substring(0, 100),
                phone_number: data.phone_number.trim().replace(/[^\d+]/g, '').substring(0, 20),
                interests: DOMPurify.sanitize(data.interests.trim(), {
                    ALLOWED_TAGS: [], ALLOWED_ATTR: [], KEEP_CONTENT: true
                }).substring(0, 500)
            };

            const newInterests = finalSanitizedData.interests
                .split(/[,;\s]+/)
                .map(i => i.trim().toLowerCase())
                .filter(i => i !== '' && i.length > 1 && i.length < 50);

            if (newInterests.length === 0) throw new Error('Please enter at least one valid interest (e.g., electronics, books)');
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

            const { data: existingProfile } = await fetchWithRetry(() =>
                supabase.from('profiles').select('interests').eq('user_id', user.id).maybeSingle()
            );

            let combinedInterests;
            if (existingProfile && existingProfile.interests) {
                const sanitizedExisting = (existingProfile.interests || [])
                    .map(i => i.toLowerCase().trim())
                    .filter(i => i.length > 0 && i.length < 50);
                combinedInterests = [...new Set([...sanitizedExisting, ...finalNewInterests])];
            } else {
                combinedInterests = finalNewInterests;
            }

            const payload = { ...basePayload, interests: combinedInterests };

            let result;
            if (existingProfile) {
                result = await fetchWithRetry(() =>
                    supabase.from('profiles').update(payload).eq('user_id', user.id).select()
                );
            } else {
                result = await fetchWithRetry(() =>
                    supabase.from('profiles').insert([payload]).select()
                );
            }

            const { data: resultData, error: resultError } = result;
            if (resultError) {
                if (resultError.code === '42501' || resultError.message.includes('403')) {
                    throw new Error(`Permission denied. Check RLS policies.`);
                }
                throw resultError;
            }
            if (!resultData || resultData.length === 0) throw new Error('Profile saved but no data returned.');

            const updatedUser = {
                ...user,
                location: finalSanitizedData.location,
                phone_number: finalSanitizedData.phone_number,
                username: finalSanitizedData.username
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));

            reset({
                username: finalSanitizedData.username,
                location: finalSanitizedData.location,
                phone_number: finalSanitizedData.phone_number,
                interests: finalSanitizedData.interests
            });

            if (typeof onProfileComplete === 'function') {
                onProfileComplete({
                    location: finalSanitizedData.location,
                    phone_number: finalSanitizedData.phone_number,
                    username: finalSanitizedData.username,
                    interests: combinedInterests
                });
            } else {
                setTimeout(() => navigate('/app'), 500);
            }

            setMode('buyer');
            localStorage.setItem('straun_profileComplete', 'true');
        } catch (err) {
            console.error('❌ Profile Submission Error:', err);
            setError(err.message || 'Error setting up profile. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [user, isLoading, isSubmitting, onProfileComplete, reset, setMode, navigate]);

    const handleReset = useCallback(() => {
        reset({
            username: existingData?.username || '',
            location: existingData?.location || '',
            phone_number: existingData?.phone_number || '',
            interests: '',
        });
        setError(null);
    }, [reset, existingData]);

    // ============================================
    // ✅ FULL PAGE + INLINE STYLES
    // ============================================
    const pageWrapperStyle = {
        background: T.pageBg,
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '40px 20px',
        boxSizing: 'border-box',
        color: T.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    };

    const innerContentStyle = {
        width: '100%',
        maxWidth: '720px',
        color: T.text,
    };

    const inputStyle = {
        width: '100%',
        padding: '16px 20px',
        border: `2px solid ${T.inputBorder}`,
        borderRadius: T.radius,
        fontSize: '17px',
        backgroundColor: T.inputBg,       // black
        color: T.inputText,               // white text
        boxSizing: 'border-box',
        marginTop: '8px',
        marginBottom: '5px',
        height: '56px',
        outline: 'none',
        fontFamily: 'inherit',
    };
    const inputErrorStyle = { ...inputStyle, borderColor: T.errorBorder };
    const textareaStyle = { ...inputStyle, height: 'auto', minHeight: '140px', resize: 'vertical', lineHeight: 1.5, paddingTop: '16px' };
    const textareaErrorStyle = { ...textareaStyle, borderColor: T.errorBorder };

    const labelStyle = {
        display: 'block',
        fontSize: '15px',
        fontWeight: '600',
        color: T.text,                   // ✅ black label on white page
        marginTop: '18px',
        marginBottom: '4px',
    };

    const helperTextStyle = {
        display: 'block',
        fontSize: '13px',
        color: T.textMuted,              // grey helper
        marginTop: '6px',
    };
    const errorTextStyle = { color: T.errorText, fontSize: '13px', marginTop: '6px', fontWeight: '500' };

    // ✅ Force page background white
    const pageBgOverride = (
        <style>{`
            html, body, #root { background: #ffffff !important; }
            .buyer-form-input::placeholder { color: #888888 !important; opacity: 1 !important; }
        `}</style>
    );

    // ============ RENDER ============
    if (userLoading) {
        return (
            <>
                {pageBgOverride}
                <div style={pageWrapperStyle}>
                    <div style={innerContentStyle}>
                        <p style={{ textAlign: 'center', padding: '40px 0', color: T.textMuted }}>
                            Loading user session...
                        </p>
                    </div>
                </div>
            </>
        );
    }

    if (!user) {
        return (
            <>
                {pageBgOverride}
                <div style={pageWrapperStyle}>
                    <div style={innerContentStyle}>
                        <p style={{ textAlign: 'center', padding: '40px 0', color: T.textMuted }}>
                            Please sign in to continue.
                        </p>
                        {error && (
                            <div style={{
                                marginTop: '16px',
                                padding: '16px',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '10px',
                            }}>
                                <p style={{ color: T.errorText, marginBottom: '12px' }}>{error}</p>
                                <button
                                    onClick={() => navigate('/')}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: T.primary,
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    Go to Signup
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            {pageBgOverride}

            <div style={pageWrapperStyle}>
                <div style={innerContentStyle}>

                    {/* Heading */}
                    <h3 style={{
                        fontSize: '32px',
                        fontWeight: '800',
                        marginBottom: '10px',
                        color: T.text,
                        letterSpacing: '-0.5px',
                    }}>
                        Complete Buyer Setup
                    </h3>
                    <p style={{ fontSize: '15px', color: T.textMuted, marginBottom: '28px', lineHeight: 1.5 }}>
                        Set up your buyer profile and interests. Sellers will use this to find you.
                    </p>

                    {/* Info box */}
                    <div style={{
                        background: T.softBg,
                        border: `1px solid ${T.softBorder}`,
                        borderRadius: '12px',
                        padding: '16px 18px',
                        marginBottom: '24px',
                    }}>
                        <p style={{ fontSize: '14px', color: T.text, marginBottom: '6px' }}>
                            <strong>User:</strong> {user.email}
                        </p>
                        <p style={{ fontSize: '14px', color: T.textMuted, lineHeight: 1.5 }}>
                            You're creating your buyer profile. This helps sellers find you with relevant products.
                        </p>
                        {existingData && (existingData.location || existingData.phone_number) && (
                            <div style={{
                                marginTop: '12px',
                                padding: '10px 12px',
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                borderRadius: '8px',
                            }}>
                                <p style={{ color: '#047857', fontSize: '13px', margin: 0 }}>
                                    <strong>Note:</strong> You have existing profile data. Location and phone will be updated.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            padding: '14px 16px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderLeft: '4px solid #dc2626',
                            borderRadius: '10px',
                            marginBottom: '20px',
                        }}>
                            <strong style={{ color: T.errorText, fontSize: '14px' }}>Error:</strong>
                            <p style={{ color: T.errorText, fontSize: '14px', marginTop: '4px' }}>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="buyer-form">

                        {/* Location */}
                        <div>
                            <label htmlFor="location" style={labelStyle}>Location *</label>
                            <input
                                type="text"
                                id="location"
                                className="buyer-form-input"
                                style={errors.location ? inputErrorStyle : inputStyle}
                                {...register('location', {
                                    required: 'Location is required',
                                    minLength: { value: 2, message: 'Location must be at least 2 characters' },
                                    maxLength: { value: 100, message: 'Location cannot exceed 100 characters' }
                                })}
                                disabled={isLoading || isSubmitting || userLoading}
                                placeholder="e.g., Chegutu or Harare"
                            />
                            {errors.location && <p style={errorTextStyle}>{errors.location.message}</p>}
                            <small style={helperTextStyle}>{locationValue.length}/100 characters</small>
                        </div>

                        {/* Phone */}
                        <div>
                            <label htmlFor="phone_number" style={labelStyle}>Phone Number *</label>
                            <input
                                type="tel"
                                id="phone_number"
                                className="buyer-form-input"
                                style={errors.phone_number ? inputErrorStyle : inputStyle}
                                {...register('phone_number', {
                                    required: 'Phone number is required',
                                    validate: validatePhoneNumber
                                })}
                                disabled={isLoading || isSubmitting || userLoading}
                                placeholder="0712345678 "
                            />
                            {errors.phone_number && <p style={errorTextStyle}>{errors.phone_number.message}</p>}
                            <small style={helperTextStyle}>
                                Format: 0712345678 (10 digits) or 263712345678 (12 digits)
                            </small>
                        </div>

                        {/* Interests */}
                        <div>
                            <label htmlFor="interests" style={labelStyle}>Shopping Interests *</label>
                            <textarea
                                id="interests"
                                rows="4"
                                className="buyer-form-input"
                                style={errors.interests ? textareaErrorStyle : textareaStyle}
                                {...register('interests', {
                                    required: 'Interests are required',
                                    minLength: { value: 3, message: 'Please enter at least one interest' },
                                    maxLength: { value: 500, message: 'Interests cannot exceed 500 characters' },
                                    validate: {
                                        hasValidInterests: (value) => {
                                            let interestsString = value;
                                            if (Array.isArray(value)) interestsString = value.join(',');
                                            if (typeof value !== 'string') interestsString = String(value);
                                            const interestsArray = interestsString.split(/[,;\s]+/)
                                                .map(i => i.trim()).filter(i => i !== '');
                                            if (interestsArray.length === 0) return 'Please enter at least one valid interest';
                                            if (interestsArray.some(i => i.length > 50)) return 'Each interest should be less than 50 characters';
                                            return true;
                                        }
                                    }
                                })}
                                disabled={isLoading || isSubmitting || userLoading}
                                placeholder="e.g., baby hats, rhombas, clothing"
                            />
                            {errors.interests && <p style={errorTextStyle}>{errors.interests.message}</p>}
                            <small style={helperTextStyle}>
                                {interestsValue.length}/500 characters. Separate with commas.
                            </small>
                        </div>

                        {/* Username */}
                        <div>
                            <label htmlFor="username" style={labelStyle}>Username (Optional)</label>
                            <input
                                type="text"
                                id="username"
                                className="buyer-form-input"
                                style={errors.username ? inputErrorStyle : inputStyle}
                                {...register('username', {
                                    minLength: { value: 2, message: 'Username must be at least 2 characters' },
                                    maxLength: { value: 50, message: 'Username cannot exceed 50 characters' }
                                })}
                                disabled={isLoading || isSubmitting || userLoading}
                                placeholder="Choose a display name (defaults to email)"
                            />
                            {errors.username && <p style={errorTextStyle}>{errors.username.message}</p>}
                            <small style={helperTextStyle}>{usernameValue.length}/50 characters</small>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading || isSubmitting || userLoading}
                            style={{
                                width: '100%',
                                padding: '16px',
                                marginTop: '24px',
                                background: (isLoading || isSubmitting || userLoading)
                                    ? '#cbd5e1'
                                    : `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryDark} 100%)`,
                                color: (isLoading || isSubmitting || userLoading) ? '#64748b' : 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '17px',
                                fontWeight: '700',
                                cursor: (isLoading || isSubmitting || userLoading) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                boxShadow: (isLoading || isSubmitting || userLoading)
                                    ? 'none'
                                    : '0 4px 15px rgba(59, 130, 246, 0.3)',
                                letterSpacing: '0.5px',
                                fontFamily: 'inherit',
                            }}
                        >
                            {isLoading || isSubmitting ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg
                                        style={{ animation: 'spin 1s linear infinite', height: '22px', width: '22px', marginRight: '10px' }}
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                </div>
                            ) : ('Complete Setup')}
                        </button>
                    </form>

                    {/* Note box */}
                    <div style={{
                        marginTop: '24px',
                        padding: '16px 18px',
                        background: T.softBg,
                        border: `1px solid ${T.softBorder}`,
                        borderRadius: '12px',
                    }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '700', color: T.text, marginBottom: '10px' }}>
                            Note:
                        </h4>
                        <ul style={{ listStyle: 'disc', paddingLeft: '20px', fontSize: '13px', color: T.textMuted, lineHeight: 1.6, margin: 0 }}>
                            <li>All HTML tags will be removed from interests for security</li>
                            <li>Your interests will help sellers find potential customers</li>
                            <li>Your location is used to find local products</li>
                            <li>Your profile will be visible to sellers searching for prospects</li>
                            <li>You can update your information anytime</li>
                        </ul>
                    </div>

                    {/* Reset */}
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={isLoading || isSubmitting || userLoading}
                        style={{
                            width: '100%',
                            padding: '16px',
                            marginTop: '16px',
                            background: (isLoading || isSubmitting || userLoading) ? '#cbd5e1' : '#4a5568',
                            color: (isLoading || isSubmitting || userLoading) ? '#64748b' : 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: '700',
                            cursor: (isLoading || isSubmitting || userLoading) ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            letterSpacing: '0.5px',
                            fontFamily: 'inherit',
                        }}
                    >
                        Reset Form
                    </button>

                </div>
            </div>
        </>
    );
};

export default React.memo(BuyerSetupForm, (prevProps, nextProps) => {
    return (
        prevProps.isLoading === nextProps.isLoading &&
        prevProps.existingData?.location === nextProps.existingData?.location &&
        prevProps.existingData?.phone_number === nextProps.existingData?.phone_number &&
        prevProps.existingData?.interests === nextProps.existingData?.interests &&
        prevProps.existingData?.username === nextProps.existingData?.username
    );
});
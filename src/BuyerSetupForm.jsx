import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

const BuyerSetupForm = ({ onProfileComplete, existingData, isLoading = false }) => {
    const [profileDetails, setProfileDetails] = useState({
        username: '',
        interests: '',      // Should NOT pre-fill - user needs to enter NEW interests
        location: '',
        phone_number: '',
    });
    
    const [user, setUser] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Get current user session with SMART pre-fill
    useEffect(() => {
        const getUser = async () => {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error('Error getting user:', userError);
                return;
            }
            setUser(user);
            
            // SMART PRE-FILL: Only pre-fill location & phone, NOT interests
            if (existingData) {
                setProfileDetails(prev => ({
                    ...prev,
                    username: existingData.username || '',
                    location: existingData.location || '',
                    phone_number: existingData.phone_number || '',
                    // ❌ DON'T pre-fill interests - user needs to enter NEW ones
                    // interests: existingData.interests?.join(', ') || ''
                }));
            }
        };
        getUser();
    }, [existingData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfileDetails(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
    e.preventDefault();
    
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

        // Convert new interests string to clean array
        const newInterests = profileDetails.interests
            .split(/[,;\s]+/)
            .map(interest => interest.trim().toLowerCase())
            .filter(interest => 
                interest !== '' && 
                interest.length > 1 && 
                interest.length < 50
            );

        if (newInterests.length === 0) {
            throw new Error('Please enter at least one interest (e.g., electronics, books)');
        }

        const finalNewInterests = [...new Set(newInterests)]; // Remove duplicates from new interests

        // Prepare the base payload
        const basePayload = {
            username: profileDetails.username.trim() || user.email,
            location: profileDetails.location.trim(),
            phone_number: String(profileDetails.phone_number).trim(),
            updated_at: new Date().toISOString(),
            is_buyer: true,
            buyer_setup_completed: true,
            is_active: true
        };

        // Check if profile exists
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('interests')
            .eq('user_id', user.id)
            .single();

        let combinedInterests;
        if (existingProfile && existingProfile.interests) {
            // Combine existing interests with new ones, remove duplicates
            combinedInterests = [...new Set([
                ...(existingProfile.interests || []),
                ...finalNewInterests
            ])];
        } else {
            combinedInterests = finalNewInterests;
        }

        // Update or insert the profile
        const payload = {
            ...basePayload,
            interests: combinedInterests
        };

        let data, error;
        if (existingProfile) {
            // Update existing profile
            const { data: updateData, error: updateError } = await supabase
                .from('profiles')
                .update(payload)
                .eq('user_id', user.id)
                .select();
            
            data = updateData;
            error = updateError;
        } else {
            // Insert new profile
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
                throw new Error(`Permission denied. User: ${user?.id}, Check RLS or auth state.`);
            }
            
            throw error;
        }

        if (!data || data.length === 0) {
            throw new Error('Profile saved but no data returned.');
        }

        console.log("✅ Profile Saved:", data[0]);
        
        // Pass ALL required data to parent
        onProfileComplete({
            location: profileDetails.location.trim(),
            phone_number: profileDetails.phone_number.trim(),
            username: profileDetails.username.trim() || user.email,
            interests: combinedInterests
        });

    } catch (err) {
        console.error('❌ Profile Submission Error:', err);
        setError(err.message || 'Error setting up profile. Please try again.');
    } finally {
        setIsSubmitting(false);
    }
};

    // If no user, show loading
    if (!user) {
        return (
            <div className="p-5 bg-gray-900 rounded-xl shadow-2xl text-white max-w-xl mx-auto my-8">
                <p className="text-center py-10">Loading user session...</p>
            </div>
        );
    }

    return (
        <div className="p-5 bg-gray-900 rounded-xl shadow-2xl text-white max-w-xl mx-auto my-8 font-sans">
            <style>{`
                .buyer-form input, 
                .buyer-form textarea {
                    width: 100%;
                    padding: 12px;
                    margin-top: 5px;
                    margin-bottom: 15px;
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
                
                /* For Webkit browsers */
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
                {/* ✅ Optional: Add existing data note like in Seller form */}
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
                    <p className="mt-2 text-sm">
                        Please ensure all fields are filled correctly.
                    </p>
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
                        disabled={isLoading || isSubmitting}
                        placeholder="e.g., Harare, Zimbabwe"
                        minLength="2"
                        maxLength="100"
                        style={{ backgroundColor: '#000000', color: '#ffffff' }}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="phone_number">Phone Number *</label>
                    <input
                        type="tel"
                        id="phone_number"
                        name="phone_number"
                        value={profileDetails.phone_number}
                        onChange={(e) => {
                            // Allow only numbers, +, spaces, dashes, parentheses
                            const value = e.target.value.replace(/[^\d\s\+\-\(\)]/g, '');
                            setProfileDetails(prev => ({ ...prev, phone_number: value }));
                        }}
                        required
                        disabled={isLoading || isSubmitting}
                        placeholder="+263 712 345 678"
                        style={{ backgroundColor: '#000000', color: '#ffffff' }}
                    />
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
                        disabled={isLoading || isSubmitting}
                        rows="4"
                        placeholder="Enter your shopping interests separated by commas (e.g., electronics, books, clothing, home decor)"
                        minLength="3"
                        maxLength="500"
                        style={{ backgroundColor: '#000000', color: '#ffffff' }}
                    ></textarea>
                    <small className="text-gray-400 text-sm">
                        Separate interests with commas. This helps sellers find you.
                    </small>
                </div>

                <button
                    type="submit"
                    disabled={isLoading || isSubmitting}
                    className={`
                        w-full py-3 px-4 mt-4 font-bold rounded-lg transition-all duration-300 shadow-lg
                        flex items-center justify-center gap-2 text-lg
                        ${isLoading || isSubmitting 
                            ? 'bg-gray-700 cursor-not-allowed opacity-70 text-gray-300' 
                            : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white'
                        }
                    `}
                >
                    {isLoading || isSubmitting ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                        </>
                    ) : (
                        'Complete Setup'
                    )}
                </button>
            </form>

                <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700 text-sm text-gray-300">
                    <h4 className="font-semibold text-gray-200 mb-2">Note:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Your interests will help sellers find potential customers</li>
                        <li>Your location is used to find local products</li>
                        <li>Your profile will be visible to sellers searching for prospects</li>
                        <li>You can update your information anytime</li>
                    </ul>
                </div>
            </div>
    
    );
};

export default BuyerSetupForm;

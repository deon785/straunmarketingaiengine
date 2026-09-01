import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from './lib/supabase';
import DOMPurify from 'dompurify';
import ReactGA from "react-ga4";
import ImageUploader from './ImageUploader';

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

const SellerSetupForm = ({ onProfileComplete, existingData }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingProducts, setFetchingProducts] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [items, setItems] = useState([]);
  
  const isFirstRender = useRef(true);
  const userFetchedRef = useRef(false);

  // ============ REACT HOOK FORM ============
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
    getValues
  } = useForm({
    mode: 'onSubmit', // Only validate on submit
    defaultValues: {
      name: '',
      location: existingData?.location || '',
      price: '',
      description: '',
      phone_number: existingData?.phone_number || '',
    }
  });

  // Watch values for character counters (no re-renders of whole form)
  const nameValue = watch('name', '');
  const priceValue = watch('price', '');
  const locationValue = watch('location', '');
  const phoneValue = watch('phone_number', '');
  const descriptionValue = watch('description', '');

  // ============ VALIDATION FUNCTIONS ============
  const isValidImageUrl = useCallback((url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }, []);

  // ============ VALIDATION FUNCTIONS ============

  // ✅ ADD THIS PHONE VALIDATION FUNCTION
  const validatePhoneNumber = useCallback((phone) => {
    if (!phone) return 'Phone number is required';
    
    // Remove spaces, dashes, parentheses, dots
    let cleanedPhone = phone.replace(/[\s\-\(\)\.]/g, '');
    // Remove leading + if present
    let rawDigits = cleanedPhone.replace(/^\+/, '');
    // Get only digits
    const digitsOnly = rawDigits.replace(/\D/g, '');
    
    // Check if it's a local format (starts with 0)
    const isLocalFormat = rawDigits.startsWith('0');
    
    if (isLocalFormat) {
      // Local format (07...): MUST be exactly 10 digits (0 + 9 digits)
      if (digitsOnly.length !== 10) {
        return 'Please enter a valid phone number (e.g., 0712345678)';
      }
    } else {
      // International format (263...): MUST be exactly 12 digits (263 + 9 digits)
      if (digitsOnly.length !== 12) {
        return 'Please enter a valid phone number (e.g., 263712345678)';
      }
    }
    
    return true;
  }, []);

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
          
          if (existingData && isFirstRender.current) {
            const updates = {
              location: existingData.location || '',
              phone_number: existingData.phone_number || '',
            };
            reset(updates);
            isFirstRender.current = false;
          }
        } else {
          const { data: { user: supabaseUser }, error: userError } = await fetchWithRetry(() =>
            supabase.auth.getUser()
          );
          
          if (userError) {
            console.error('Error getting user from Supabase:', userError);
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

  // ============ FETCH PRODUCTS ============
  const fetchProducts = useCallback(async () => {
    setFetchingProducts(true);
    setError(null);
    try {
      const { data, error } = await fetchWithRetry(() =>
        supabase
          .from('products')
          .select('*')
      );

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      setError("Failed to load products. Please check your connection.");
      console.error("Technical details:", err.message);
    } finally {
      setFetchingProducts(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ============ IMAGE HANDLERS ============
  const handleDeletePhoto = useCallback(async () => {
    if (!imageUrl) return;
    
    if (imageUrl.includes('supabase.co/storage')) {
      const fileName = imageUrl.split('/').pop();

      const { error } = await supabase.storage
        .from('product-images')
        .remove([fileName]);

      if (error) {
        console.error('Error removing file from storage:', error);
        setError('Failed to remove image from storage. Please try again.');
        return;
      }
    }
    
    setImageUrl('');
    setError(null);
  }, [imageUrl]);

  // ============ FORM SUBMISSION ============
  const onSubmit = useCallback(async (data) => {
    // Check offline status
    if (!navigator.onLine) {
      setError('You are offline. Please connect to the internet to list your product.');
      return;
    }
    
    // Check image
    if (!imageUrl) {
      setError('Product image is required. Please upload an image.');
      document.querySelector('.image-upload-section')?.scrollIntoView({ 
        behavior: 'smooth' 
      });
      return;
    }

    if (!user) {
      console.error('User not found in state');
      setError('Please sign in to continue.');
      return;
    }
    
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      ReactGA.event({
        category: "Seller",
        action: "Created_Listing",
        label: "AI_Marketing_Engine",
      });

      console.log("📤 SellerSetupForm submitting...");

      const finalSanitizedData = {
        name: data.name.trim().substring(0, 200),
        location: data.location.trim().substring(0, 100),
        price: data.price ? parseFloat(data.price) : null,
        description: DOMPurify.sanitize(data.description.trim(), {
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: [],
          KEEP_CONTENT: true
        }).substring(0, 1000),
        phone_number: data.phone_number.trim().replace(/[^\d+]/g, '').substring(0, 20)
      };

      // Update profile
      const profileResult = await fetchWithRetry(() =>
        supabase
          .from('profiles')
          .upsert([
            {
              user_id: user.id,
              username: user.email,
              location: finalSanitizedData.location,
              phone_number: finalSanitizedData.phone_number,
              updated_at: new Date().toISOString(),
              is_seller: true,
              seller_setup_completed: true
            },
          ], { onConflict: 'user_id' })
      );

      if (profileResult.error) {
        console.error('Profile upsert error:', profileResult.error);
        throw profileResult.error;
      }

      const productData = {
        name: finalSanitizedData.name,
        location: finalSanitizedData.location,
        price: finalSanitizedData.price,
        description: finalSanitizedData.description,
        seller_id: user.id,
        phone_number: finalSanitizedData.phone_number,
        created_at: new Date().toISOString(),
        status: 'active',
        image_url: imageUrl
      };

      const productResult = await fetchWithRetry(() =>
        supabase
          .from('products')
          .insert([productData])
          .select()
      );

      if (productResult.error) {
        console.error('📛 Supabase Product Insert Error:', productResult.error);
        
        if (productResult.error.code === '42501') {
          throw new Error('Permission denied. Check RLS policies for products table.');
        } else if (productResult.error.code === '23502') {
          throw new Error('Missing required fields. Check products table schema.');
        } else if (productResult.error.code === '22P02') {
          throw new Error('Invalid data type. Check price format (should be number).');
        }
        throw productResult.error;
      }

      const insertedData = productResult.data;
      if (!insertedData || insertedData.length === 0) {
        throw new Error('Product saved but no data returned.');
      }

      console.log('✅ Product saved successfully:', insertedData);
      
      const updatedUser = {
        ...user,
        location: finalSanitizedData.location,
        phone_number: finalSanitizedData.phone_number
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Reset form after successful submission
      reset({
        name: '',
        location: finalSanitizedData.location,
        price: '',
        description: '',
        phone_number: finalSanitizedData.phone_number,
      });
      setImageUrl('');
      
      onProfileComplete({
        location: finalSanitizedData.location,
        phone_number: finalSanitizedData.phone_number,
        product_listed: finalSanitizedData.name,
        price: finalSanitizedData.price,
        description: finalSanitizedData.description,
        image_url: imageUrl
      });

      setTimeout(() => {
        navigate('/app');
      }, 1000);

    } catch (err) {
      console.error('❌ Full Error Details:', err);
      setError(err.message || 'Failed to save product. Please try again.');
      ReactGA.event({
        category: "Error",
        action: "Listing_Failed",
        label: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  }, [user, imageUrl, submitting, navigate, onProfileComplete, reset]);

  const handleReset = useCallback(() => {
    reset({
      name: '',
      location: existingData?.location || '',
      price: '',
      description: '',
      phone_number: existingData?.phone_number || '',
    });
    setImageUrl('');
    setError(null);
  }, [reset, existingData]);

  // ============ STYLES ============
  const inputStyle = {
    width: '100%',
    padding: '16px 20px',
    border: '2px solid #4a5568',
    borderRadius: '12px',
    fontSize: '18px',
    backgroundColor: '#000000',
    color: '#ffffff',
    boxSizing: 'border-box',
    marginTop: '8px',
    marginBottom: '5px',
    height: '56px'
  };

  const inputErrorStyle = {
    ...inputStyle,
    borderColor: '#f87171',
  };

  const textareaStyle = {
    ...inputStyle,
    height: 'auto',
    minHeight: '150px',
    resize: 'vertical'
  };

  const textareaErrorStyle = {
    ...textareaStyle,
    borderColor: '#f87171',
  };

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
        <p className="text-center py-10">Loading user session...</p>
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
    <div className="p-5 bg-gray-900 rounded-xl shadow-2xl text-white max-w-2xl mx-auto my-8 font-sans safe-top no-cut">
      <h3 className="text-3xl font-bold mb-4 text-purple-400">
        Complete Seller Setup (List Product)
      </h3>
      
      <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <p className="text-gray-300 mb-2">
          <strong>User:</strong> {user.email}
        </p>
        <p className="text-gray-300">
          You're creating your first product listing. This will also update your profile location.
        </p>
        {existingData && (existingData.location || existingData.phone_number) && (
          <div className="mt-2 p-2 bg-gray-700 rounded">
            <p className="text-green-300 text-sm">
              <strong>Note:</strong> You have existing profile data. Location and phone will be updated.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message p-4 bg-red-900 border border-red-700 rounded-lg mb-4">
          <strong>Error:</strong> {error}
          <p className="mt-2 text-sm">
            Please ensure all fields are filled correctly and try again.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
        {/* Product Name */}
        <div className="form-group">
          <label htmlFor="name">Product Name *</label>
          <input
            type="text"
            id="name"
            style={errors.name ? inputErrorStyle : inputStyle}
            {...register('name', {
              required: 'Product name is required',
              minLength: {
                value: 3,
                message: 'Product name must be at least 3 characters'
              },
              maxLength: {
                value: 100,
                message: 'Product name cannot exceed 100 characters'
              }
            })}
            disabled={submitting || userLoading}
            placeholder="e.g., Weighted Blanket"
          />
          {errors.name && (
            <p className="text-red-400 text-sm mt-1">{errors.name.message}</p>
          )}
          <small className="text-gray-400 text-sm">
            {nameValue.length}/100 characters
          </small>
        </div>

        {/* Price */}
        <div className="form-group">
          <label htmlFor="price">Price ($) *</label>
          <input
            type="text"
            id="price"
            style={errors.price ? inputErrorStyle : inputStyle}
            {...register('price', {
              required: 'Price is required',
              validate: {
                isValidNumber: (value) => {
                  const num = parseFloat(value);
                  if (isNaN(num)) return 'Please enter a valid number';
                  if (num <= 0) return 'Price must be greater than 0';
                  if (num > 999999.99) return 'Price is too high';
                  return true;
                }
              }
            })}
            disabled={submitting || userLoading}
            placeholder="e.g., 49.99"
          />
          {errors.price && (
            <p className="text-red-400 text-sm mt-1">{errors.price.message}</p>
          )}
          <small className="text-gray-400 text-sm">
            Enter price in USD (e.g., 49.99). Max 999999.99
          </small>
        </div>

        {/* Location */}
        <div className="form-group">
          <label htmlFor="location">Location *</label>
          <input
            type="text"
            id="location"
            style={errors.location ? inputErrorStyle : inputStyle}
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
            disabled={submitting || userLoading}
            placeholder="e.g., New York, NY or Johannesburg"
          />
          {errors.location && (
            <p className="text-red-400 text-sm mt-1">{errors.location.message}</p>
          )}
          <small className="text-gray-400 text-sm">
            {locationValue.length}/100 characters
          </small>
        </div>

        {/* Phone Number */}
        <div className="form-group">
          <label htmlFor="phone_number">Phone Number *</label>
          <input
            type="tel"
            id="phone_number"
            style={errors.phone_number ? inputErrorStyle : inputStyle}
            {...register('phone_number', {
              required: 'Phone number is required',
              validate: validatePhoneNumber
            })}
            disabled={submitting || userLoading}
            placeholder="0712345678 or 263712345678"
          />
          {errors.phone_number && (
            <p className="text-red-400 text-sm mt-1">{errors.phone_number.message}</p>
          )}
          <small className="text-gray-400 text-sm">
            Format: +country code followed by number (digits, +, and spaces only)
          </small>
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="description">Product Description *</label>
          <textarea
            id="description"
            rows="6"
            style={errors.description ? textareaErrorStyle : textareaStyle}
            {...register('description', {
              required: 'Product description is required',
              minLength: {
                value: 10,
                message: 'Description must be at least 10 characters'
              },
              maxLength: {
                value: 1000,
                message: 'Description cannot exceed 1000 characters'
              }
            })}
            disabled={submitting || userLoading}
            placeholder="Describe your product in detail. Include features, condition, brand, and any other relevant information."
          />
          {errors.description && (
            <p className="text-red-400 text-sm mt-1">{errors.description.message}</p>
          )}
          <small className="text-gray-400 text-sm">
            {descriptionValue.length}/1000 characters. Min 10 characters. HTML tags will be removed.
          </small>
        </div>

        {/* Image Upload Section */}
        <div className="my-8 border-t border-gray-700 pt-6 image-upload-section">
          <h4 className="text-xl font-bold mb-4 text-blue-400 text-center">
            📷 UPLOAD PRODUCT IMAGE (REQUIRED)
          </h4>
          
          {!imageUrl && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
              <p className="text-red-300 text-sm">
                ⚠️ <strong>Required:</strong> You must upload a product image to continue.
              </p>
            </div>
          )}
          
          <div className="bg-blue-900/20 border-2 border-dashed border-blue-500 rounded-xl p-4 text-center">
            <ImageUploader onUploadSuccess={(url) => setImageUrl(url)} />
            
            {imageUrl && (
              <div className="mt-4">
                <div className="relative inline-block">
                  <img 
                    src={imageUrl} 
                    alt="Product preview" 
                    className="w-32 h-32 rounded-xl object-cover mx-auto"
                  />
                  <button 
                    onClick={handleDeletePhoto}
                    className="absolute top-[-10px] right-[-10px] bg-red-600 text-white border-none rounded-full w-8 h-8 cursor-pointer font-bold flex items-center justify-center"
                    type="button"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-green-400 text-sm mt-2">
                  ✓ Image uploaded successfully
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Click ✕ to remove and upload a different image
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || userLoading || !imageUrl}
          style={{
            width: '100%',
            padding: '16px',
            background: (submitting || userLoading || !imageUrl)  
              ? '#374151'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: (submitting || userLoading || !imageUrl) ? '#9CA3AF' : 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: '700',
            cursor: (submitting || userLoading || !imageUrl) ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            opacity: submitting || userLoading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginTop: '20px',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
            letterSpacing: '0.5px'
          }}
        >
          {submitting ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg 
                style={{ 
                  animation: 'spin 1s linear infinite',
                  height: '22px',
                  width: '22px',
                  marginRight: '10px'
                }} 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
              >
                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </div>
          ) : !imageUrl ? (
            'Upload Image to Continue'
          ) : (
            'Complete Setup & List Product'
          )}
        </button>
      </form>

      <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700 text-sm text-gray-300">
        <h4 className="font-semibold text-gray-200 mb-2">Important:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>All HTML tags will be removed from descriptions for security</li>
          <li>Your product will be visible to buyers searching for similar items</li>
          <li>Your location and phone number will be saved to your profile</li>
          <li>You can update your listings anytime</li>
          <li>Ensure all information is accurate before submitting</li>
          <li><strong>Product image is required</strong> and will be auto-compressed</li>
        </ul>
      </div>
      
      <button
        type="button"
        onClick={handleReset}
        disabled={submitting || userLoading}
        className="w-full py-4 mt-4 rounded-lg text-white font-bold text-lg transition-all duration-300"
        style={{
          width: '100%',
          padding: '16px',
          background: submitting || userLoading 
              ? '#374151'
              : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          cursor: submitting || userLoading ? 'not-allowed' : 'pointer',
          opacity: submitting || userLoading ? 0.7 : 1,
          boxShadow: '0 4px 15px rgba(43, 235, 117, 0.3)',
          letterSpacing: '0.5px'
        }}
      >
        Reset Form
      </button>
    </div>
  );
};

export default React.memo(SellerSetupForm, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.existingData?.location === nextProps.existingData?.location &&
    prevProps.existingData?.phone_number === nextProps.existingData?.phone_number
  );
});
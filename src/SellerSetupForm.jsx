import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from './lib/supabase';
import DOMPurify from 'dompurify';
import ReactGA from "react-ga4";
import { useAuthActions } from './AuthContext';
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

// ============================================
// ✅ LIGHT MODE TOKENS (matches UserDashboard)
// ============================================
const T = {
  pageBg: '#ffffff',        // white page
  cardBg: '#ffffff',        // white card
  cardBorder: '#e5e7eb',    // soft grey border
  softBg: '#f7f8fa',        // very light grey (helper boxes)
  softBorder: '#eaeef2',
  text: '#0f172a',          // near-black
  textMuted: '#52607a',     // medium grey
  textLight: '#8291a9',     // light grey
  inputBg: '#ffffff',
  inputBorder: '#d1d5db',
  inputText: '#0f172a',
  inputPlaceholder: '#9ca3af',
  errorText: '#dc2626',
  errorBorder: '#f87171',
  accent: '#7c3aed',
  primary: '#4361ee',
  primaryDark: '#3a56d4',
  success: '#10b981',
  radius: '12px',
};

const SellerSetupForm = ({ onProfileComplete, existingData }) => {
  const navigate = useNavigate();
  const { setMode } = useAuthActions();
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
  } = useForm({
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      location: existingData?.location || '',
      price: '',
      description: '',
      phone_number: existingData?.phone_number || '',
    }
  });

  const nameValue = watch('name', '');
  const priceValue = watch('price', '');
  const locationValue = watch('location', '');
  const phoneValue = watch('phone_number', '');
  const descriptionValue = watch('description', '');

  // ============ VALIDATION ============
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
            reset({
              location: existingData.location || '',
              phone_number: existingData.phone_number || '',
            });
            isFirstRender.current = false;
          }
        } else {
          const { data: { user: supabaseUser }, error: userError } = await fetchWithRetry(() =>
            supabase.auth.getUser()
          );
          if (userError) {
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
        supabase.from('products').select('*')
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
    if (!navigator.onLine) {
      setError('You are offline. Please connect to the internet to list your product.');
      return;
    }
    
    if (!imageUrl) {
      setError('Product image is required. Please upload an image.');
      document.querySelector('.image-upload-section')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (!user) {
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
        supabase.from('products').insert([productData]).select()
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
      
      reset({
        name: '',
        location: finalSanitizedData.location,
        price: '',
        description: '',
        phone_number: finalSanitizedData.phone_number,
      });
      setImageUrl('');
      
      if (typeof onProfileComplete === 'function') {
        onProfileComplete({
          location: finalSanitizedData.location,
          phone_number: finalSanitizedData.phone_number,
          product_listed: finalSanitizedData.name,
          price: finalSanitizedData.price,
          description: finalSanitizedData.description,
          image_url: imageUrl
        });
      } else {
        console.log('🚀 SellerSetupForm: navigating to /app (standalone)');
        setTimeout(() => navigate('/app'), 1000);
      }

      console.log('🚀 SellerSetupForm: setting seller mode + profileComplete');
      setMode('seller');
      localStorage.setItem('straun_profileComplete', 'true');

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
  }, [user, imageUrl, submitting, navigate, onProfileComplete, reset, setMode]);

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
    console.log('🔄 Form reset - cleared all fields and errors');
  }, [reset, existingData]);

  // ============================================
  // ✅ LIGHT MODE STYLES
  // ============================================
  const inputStyle = {
    width: '100%',
    padding: '16px 20px',
    border: '2px solid #404040',
    borderRadius: T.radius,
    fontSize: '17px',
    backgroundColor: '#000000',
    color: '#ffffff', 
    boxSizing: 'border-box',
    marginTop: '8px',
    marginBottom: '5px',
    height: '56px',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    fontFamily: 'inherit',
  };

  const inputErrorStyle = {
    ...inputStyle,
    borderColor: T.errorBorder,
  };

  const textareaStyle = {
    ...inputStyle,
    height: 'auto',
    minHeight: '150px',
    resize: 'vertical',
    lineHeight: 1.5,
  };

  const textareaErrorStyle = {
    ...textareaStyle,
    borderColor: T.errorBorder,
  };

  const labelStyle = {
    display: 'block',
    fontSize: '15px',
    fontWeight: '600',
    color: T.text,
    marginTop: '18px',
    marginBottom: '4px',
  };

  const helperTextStyle = {
    display: 'block',
    fontSize: '13px',
    color: T.textMuted,
    marginTop: '6px',
  };

  const errorTextStyle = {
    color: T.errorText,
    fontSize: '13px',
    marginTop: '6px',
    fontWeight: '500',
  };

  // ============ RENDER ============
  if (userLoading) {
    return (
      <div style={{
        background: T.cardBg,
        border: `1px solid ${T.cardBorder}`,
        borderRadius: '16px',
        padding: '40px 24px',
        textAlign: 'center',
        maxWidth: '640px',
        margin: '32px auto',
        color: T.text,
        boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 12px 30px -20px rgba(15,23,42,0.10)',
      }}>
        <p style={{ fontSize: '15px', color: T.textMuted }}>Loading user session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        background: T.cardBg,
        border: `1px solid ${T.cardBorder}`,
        borderRadius: '16px',
        padding: '40px 24px',
        textAlign: 'center',
        minHeight: '100vh',
        margin: '32px auto',
        color: T.text,
        boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 12px 30px -20px rgba(15,23,42,0.10)',
      }}>
        <p style={{ fontSize: '15px', color: T.textMuted }}>Loading user session...</p>
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
    );
  }

  return (
    <div style={{
      background: T.cardBg,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: '16px',
      padding: '32px',
      minHeight: '100vh',
      margin: '32px auto',
      color: T.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 12px 30px -20px rgba(15,23,42,0.10)',
      position: 'relative',
      zIndex: 1,
    }}>

      <h3 style={{
        fontSize: '26px',
        fontWeight: '800',
        marginBottom: '16px',
        color: T.text,
        letterSpacing: '-0.5px',
      }}>
        Complete Seller Setup
      </h3>
      <p style={{
        fontSize: '15px',
        color: T.textMuted,
        marginBottom: '24px',
        lineHeight: 1.5,
      }}>
        List your first product and update your seller profile.
      </p>

      {/* Info box */}
      <div style={{
        background: T.softBg,
        border: `1px solid ${T.softBorder}`,
        borderRadius: '12px',
        padding: '16px 18px',
        marginBottom: '20px',
      }}>
        <p style={{ fontSize: '14px', color: T.text, marginBottom: '6px' }}>
          <strong>User:</strong> {user.email}
        </p>
        <p style={{ fontSize: '14px', color: T.textMuted, lineHeight: 1.5 }}>
          You're creating your first product listing. This will also update your profile location.
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
          <p style={{ color: T.errorText, fontSize: '12px', marginTop: '6px', opacity: 0.8 }}>
            Please ensure all fields are filled correctly and try again.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">

        {/* Product Name */}
        <div>
          <label htmlFor="name" style={labelStyle}>Product Name *</label>
          <input
            type="text"
            id="name"
            style={errors.name ? inputErrorStyle : inputStyle}
            {...register('name', {
              required: 'Product name is required',
              minLength: { value: 3, message: 'Product name must be at least 3 characters' },
              maxLength: { value: 100, message: 'Product name cannot exceed 100 characters' }
            })}
            disabled={submitting || userLoading}
            placeholder="e.g., Baby feaders, Baby clothes"
          />
          {errors.name && <p style={errorTextStyle}>{errors.name.message}</p>}
          <small style={helperTextStyle}>{nameValue.length}/100 characters</small>
        </div>

        {/* Price */}
        <div>
          <label htmlFor="price" style={labelStyle}>Price ($) *</label>
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
          {errors.price && <p style={errorTextStyle}>{errors.price.message}</p>}
          <small style={helperTextStyle}>
            Enter price in USD (e.g., 49.99). Max 999999.99
          </small>
        </div>

        {/* Location */}
        <div>
          <label htmlFor="location" style={labelStyle}>Location *</label>
          <input
            type="text"
            id="location"
            style={errors.location ? inputErrorStyle : inputStyle}
            {...register('location', {
              required: 'Location is required',
              minLength: { value: 2, message: 'Location must be at least 2 characters' },
              maxLength: { value: 100, message: 'Location cannot exceed 100 characters' }
            })}
            disabled={submitting || userLoading}
            placeholder="e.g., Cheguttu or Harare"
          />
          {errors.location && <p style={errorTextStyle}>{errors.location.message}</p>}
          <small style={helperTextStyle}>{locationValue.length}/100 characters</small>
        </div>

        {/* Phone Number */}
        <div>
          <label htmlFor="phone_number" style={labelStyle}>Phone Number *</label>
          <input
            type="tel"
            id="phone_number"
            style={errors.phone_number ? inputErrorStyle : inputStyle}
            {...register('phone_number', {
              required: 'Phone number is required',
              validate: validatePhoneNumber
            })}
            disabled={submitting || userLoading}
            
          />
          {errors.phone_number && <p style={errorTextStyle}>{errors.phone_number.message}</p>}
          <small style={helperTextStyle}>
            Format: +country code followed by number (digits, +, and spaces only)
          </small>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" style={labelStyle}>Product Description *</label>
          <textarea
            id="description"
            rows="6"
            style={errors.description ? textareaErrorStyle : textareaStyle}
            {...register('description', {
              required: 'Product description is required',
              minLength: { value: 10, message: 'Description must be at least 10 characters' },
              maxLength: { value: 1000, message: 'Description cannot exceed 1000 characters' }
            })}
            disabled={submitting || userLoading}
            placeholder="Describe your product in detail. Include features, condition, brand, and any other relevant information."
          />
          {errors.description && <p style={errorTextStyle}>{errors.description.message}</p>}
          <small style={helperTextStyle}>
            {descriptionValue.length}/1000 characters. Min 10 characters. HTML tags will be removed.
          </small>
        </div>

        {/* Image Upload */}
        <div className="image-upload-section" style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: `1px solid ${T.cardBorder}`,
        }}>
          <h4 style={{
            fontSize: '18px',
            fontWeight: '700',
            marginBottom: '16px',
            color: T.text,
            textAlign: 'center',
          }}>
            📷 Upload Product Image (Required)
          </h4>

          {!imageUrl && (
            <div style={{
              marginBottom: '16px',
              padding: '12px 16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
            }}>
              <p style={{ color: T.errorText, fontSize: '13px', margin: 0 }}>
                ⚠️ <strong>Required:</strong> You must upload a product image to continue.
              </p>
            </div>
          )}

          <div style={{
            background: '#fafbfc',
            border: '2px dashed #cbd5e1',
            borderRadius: '14px',
            padding: '20px',
            textAlign: 'center',
          }}>
            <ImageUploader
              key={imageUrl || 'empty'}
              onUploadSuccess={(url) => setImageUrl(url)}
              onUploadError={(err) => setError(err)}
            />

            {imageUrl && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src={imageUrl}
                    alt="Product preview"
                    style={{
                      width: '128px',
                      height: '128px',
                      borderRadius: '12px',
                      objectFit: 'cover',
                      display: 'block',
                      border: `2px solid ${T.cardBorder}`,
                    }}
                  />
                  <button
                    onClick={handleDeletePhoto}
                    type="button"
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '-10px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
                    }}
                  >
                    ✕
                  </button>
                </div>
                <p style={{ color: '#047857', fontSize: '13px', marginTop: '10px' }}>
                  ✓ Image uploaded successfully
                </p>
                <p style={{ color: T.textMuted, fontSize: '12px', marginTop: '4px' }}>
                  Click ✕ to remove and upload a different image
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || userLoading || !imageUrl}
          style={{
            width: '100%',
            padding: '16px',
            background: (submitting || userLoading || !imageUrl)
              ? '#cbd5e1'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: (submitting || userLoading || !imageUrl) ? '#64748b' : 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '17px',
            fontWeight: '700',
            cursor: (submitting || userLoading || !imageUrl) ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginTop: '24px',
            boxShadow: (submitting || userLoading || !imageUrl)
              ? 'none'
              : '0 4px 15px rgba(16, 185, 129, 0.3)',
            letterSpacing: '0.5px',
            fontFamily: 'inherit',
          }}
        >
          {submitting ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg
                style={{
                  animation: 'spin 1s linear infinite',
                  height: '22px',
                  width: '22px',
                  marginRight: '10px',
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

      {/* Tips box */}
      <div style={{
        marginTop: '24px',
        padding: '16px 18px',
        background: T.softBg,
        border: `1px solid ${T.softBorder}`,
        borderRadius: '12px',
      }}>
        <h4 style={{
          fontSize: '14px',
          fontWeight: '700',
          color: T.text,
          marginBottom: '10px',
        }}>
          Important:
        </h4>
        <ul style={{
          listStyle: 'disc',
          paddingLeft: '20px',
          fontSize: '13px',
          color: T.textMuted,
          lineHeight: 1.6,
          margin: 0,
        }}>
          <li>All HTML tags will be removed from descriptions for security</li>
          <li>Your product will be visible to buyers searching for similar items</li>
          <li>Your location and phone number will be saved to your profile</li>
          <li>You can update your listings anytime</li>
          <li>Ensure all information is accurate before submitting</li>
          <li><strong>Product image is required</strong> and will be auto-compressed</li>
        </ul>
      </div>

      {/* Reset button */}
      <button
        type="button"
        onClick={handleReset}
        disabled={submitting || userLoading}
        style={{
          width: '100%',
          padding: '16px',
          marginTop: '16px',
          background: (submitting || userLoading)
            ? '#cbd5e1'
            : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          color: (submitting || userLoading) ? '#64748b' : 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: '700',
          cursor: (submitting || userLoading) ? 'not-allowed' : 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: (submitting || userLoading)
            ? 'none'
            : '0 4px 15px rgba(59, 130, 246, 0.3)',
          letterSpacing: '0.5px',
          fontFamily: 'inherit',
        }}
      >
        Reset Form
      </button>
    </div>
  );
};

export default React.memo(SellerSetupForm, (prevProps, nextProps) => {
  return (
    prevProps.existingData?.location === nextProps.existingData?.location &&
    prevProps.existingData?.phone_number === nextProps.existingData?.phone_number
  );
});
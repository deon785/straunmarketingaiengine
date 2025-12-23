import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import DOMPurify from 'dompurify';
import ReactGA from "react-ga4";
import ImageUploader from './ImageUploader';

const SellerSetupForm = ({ onProfileComplete, existingData }) => {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingProducts, setFetchingProducts] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [productDetails, setProductDetails] = useState({
    name: '',
    location: '',
    price: '',
    description: '',
    phone_number: '',
  });

  const [items, setItems] = useState([]);
  
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('products')
      .insert([
        { 
          name: productDetails.name, // FIXED: Changed from 'name' to 'productDetails.name'
          price: productDetails.price, // FIXED: Changed from 'price' to 'productDetails.price'
          image_url: imageUrl,
          seller_id: user.id 
        }
      ]);

      if (!error) {
      alert("Product listed successfully!");
      // Reset form
      setProductDetails({
        name: '',
        location: '',
        price: '',
        description: '',
        phone_number: '',
      });
      setImageUrl('');
    } else {
      alert("Error saving product: " + error.message);
    }
    setSubmitting(false);
  };
  
  const handleDeletePhoto = async () => {
    // 1. Extract the file name from the URL
    // URL looks like: .../product-images/0.12345.jpg
    const fileName = imageUrl.split('/').pop();

    // 2. Remove from Supabase Storage (Cleanup)
    const { error } = await supabase.storage
      .from('product-images')
      .remove([fileName]);

    if (!error) {
      setImageUrl(''); // Clear the state so the uploader shows again
    } else {
      alert("Error removing file from storage");
    }
  };


  const fetchProducts = async () => {
    setFetchingProducts(true);
    setError(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from('products')
        .select('*');

      if (supabaseError) throw supabaseError;
      setItems(data || []);
    } catch (err) {
      setError("Failed to load products. Please check your connection.");
      console.error("Technical details:", err.message);
    } finally {
      setFetchingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const getInputStyle = () => ({
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
  });

  const getTextareaStyle = () => ({
    ...getInputStyle(),
    height: 'auto',
    minHeight: '150px',
    resize: 'vertical'
  });

  useEffect(() => {
    const getUser = async () => {
      setUserLoading(true);
      try {
        const storedUser = localStorage.getItem('user');
        
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } else {
          const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser();
          
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
    
        if (existingData) {
          setProductDetails(prev => ({
            ...prev,
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    let sanitizedValue = value;
    
    switch(name) {
      case 'description':
        sanitizedValue = DOMPurify.sanitize(value, {
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: [],
          KEEP_CONTENT: true
        });
        break;
        
      case 'location':
      case 'name':
        sanitizedValue = value.replace(/[<>"'`&;\\]/g, '');
        break;
        
      case 'price':
        sanitizedValue = value.replace(/[^\d.]/g, '');
        const parts = sanitizedValue.split('.');
        if (parts.length > 2) {
          sanitizedValue = parts[0] + '.' + parts.slice(1).join('');
        }
        break;
        
      case 'phone_number':
        sanitizedValue = value.replace(/[^\d+ ]/g, '');
        break;
        
      default:
        sanitizedValue = value;
    }
    
    setProductDetails(prev => ({ 
      ...prev, 
      [name]: sanitizedValue 
    }));
  };

  const validateForm = () => {
    if (!productDetails.name.trim()) return 'Product name is required';
    if (!productDetails.price.trim()) return 'Price is required';
    if (parseFloat(productDetails.price) <= 0) return 'Price must be greater than 0';
    if (!productDetails.location.trim()) return 'Location is required';
    if (!productDetails.phone_number.trim()) return 'Phone number is required';
    if (!productDetails.description.trim()) return 'Product description is required';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
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
        name: productDetails.name.trim().substring(0, 200),
        location: productDetails.location.trim().substring(0, 100),
        price: productDetails.price ? parseFloat(productDetails.price) : null,
        description: DOMPurify.sanitize(productDetails.description.trim(), {
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: [],
          KEEP_CONTENT: true
        }).substring(0, 1000),
        phone_number: productDetails.phone_number.trim().replace(/[^\d+]/g, '').substring(0, 20)
      };

      const { error: profileError } = await supabase
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
        ], { onConflict: 'user_id' });

      if (profileError) {
        console.error('Profile upsert error:', profileError);
        throw profileError;
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
        // ADDED: Include image_url in the product data
        image_url: imageUrl
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('products')
        .insert([productData])
        .select();

      if (insertError) {
        console.error('📛 FULL Supabase Product Insert Error:', insertError);
        
        if (insertError.code === '42501') {
          throw new Error('Permission denied. Check RLS policies for products table.');
        } else if (insertError.code === '23502') {
          throw new Error('Missing required fields. Check products table schema.');
        } else if (insertError.code === '22P02') {
          throw new Error('Invalid data type. Check price format (should be number).');
        }
        throw insertError;
      }

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
      
      onProfileComplete({
        location: finalSanitizedData.location,
        phone_number: finalSanitizedData.phone_number,
        product_listed: finalSanitizedData.name,
        price: finalSanitizedData.price,
        description: finalSanitizedData.description,
        // ADDED: Pass image_url to notification
        image_url: imageUrl
      });

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
  };

  const handleReset = () => {
    setProductDetails({
      name: '',
      location: '',
      price: '',
      description: '',
      phone_number: '',
    });
    setImageUrl('');
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
    <div className="p-5 bg-gray-900 rounded-xl shadow-2xl text-white max-w-2xl mx-auto my-8 font-sans">
      <style>{`
        input:invalid, textarea:invalid {
          border-color: #f87171;
        }
        
        input:valid, textarea:valid {
          border-color: #4ade80;
        }
      `}</style>

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

      <form onSubmit={handleSubmit}>
        <ImageUploader onUploadSuccess={(url) => setImageUrl(url)} />

        {imageUrl && (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '15px' }}>
            <img 
              src={imageUrl} 
              alt="Product preview" 
              style={{ 
                width: '120px', 
                height: '120px', 
                borderRadius: '12px', 
                objectFit: 'cover',
                marginBottom: '5px'
              }} 
            />
            <button 
              onClick={handleDeletePhoto}
              style={{
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                background: '#ff4d4d',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ✕
            </button>
            <p style={{ color: '#888', fontSize: '12px', textAlign: 'center' }}>Tap ✕ to change</p>
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="name">Product Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={productDetails.name}
            onChange={handleChange}
            required
            disabled={submitting || userLoading}
            placeholder="e.g., Weighted Blanket"
            minLength="3"
            maxLength="100"
            style={getInputStyle()}
          />
          <small className="text-gray-400 text-sm">
            Min 3 characters, max 100 characters
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="price">Price ($) *</label>
          <input
            type="text"
            id="price"
            name="price"
            value={productDetails.price}
            onChange={handleChange}
            required
            disabled={submitting || userLoading}
            placeholder="e.g., 49.99"
            pattern="^\d+(\.\d{1,2})?$"
            title="Enter a valid price (e.g., 49.99)"
            style={getInputStyle()}
          />
          <small className="text-gray-400 text-sm">
            Enter price in USD (e.g., 49.99). Max 999999.99
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="location">Location *</label>
          <input
            type="text"
            id="location"
            name="location"
            value={productDetails.location}
            onChange={handleChange}
            required
            disabled={submitting || userLoading}
            placeholder="e.g., New York, NY or Johannesburg"
            minLength="2"
            maxLength="100"
            style={getInputStyle()}
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone_number">Phone Number *</label>
          <input
            type="tel"
            id="phone_number"
            name="phone_number"
            value={productDetails.phone_number}
            onChange={handleChange}
            required
            disabled={submitting || userLoading}
            placeholder="+263 712 345 678"
            pattern="^[\d+][\d\s]+$"
            title="Enter a valid phone number (digits, +, and spaces only)"
            style={getInputStyle()}
          />
          <small className="text-gray-400 text-sm">
            Format: +country code followed by number (digits, +, and spaces only)
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="description">Product Description *</label>
          <textarea
            id="description"
            name="description"
            value={productDetails.description}
            onChange={handleChange}
            required
            disabled={submitting || userLoading}
            rows="6"
            placeholder="Describe your product in detail. Include features, condition, brand, and any other relevant information."
            minLength="10"
            maxLength="1000"
            style={getTextareaStyle()}
          ></textarea>
          <small className="text-gray-400 text-sm">
            Min 10 characters, max 1000 characters. HTML tags will be removed.
          </small>
        </div>

        <button
          type="submit"
          disabled={submitting || userLoading}
          style={{
            width: '100%',
            padding: '16px',
            background: (submitting || userLoading)  
              ? '#374151'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white', 
            border: 'none',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: '700',
            cursor: (submitting || userLoading)? 'not-allowed' : 'pointer',
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
          {submitting ?  (
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
        </ul>
      </div>
        <button
              type="button"
              onClick={handleReset}
              disabled={submitting || userLoading}
              className="w-full py-3 mt-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              style={{
                  cursor: submitting || userLoading ? 'not-allowed' : 'pointer',
                  opacity: submitting || userLoading ? 0.7 : 1,
              }}
      >
              Reset Form
        </button>
    </div>
  );
};

export default SellerSetupForm;
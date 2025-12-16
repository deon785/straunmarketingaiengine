import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

const SellerSetupForm = ({ onProfileComplete, existingData }) => {
  // ✅ ADDED: User state
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [productDetails, setProductDetails] = useState({
    name: '',
    location: '',
    price: '',
    description: '',
    phone_number: '',
  });

  // ✅ FIXED: Get user from localStorage or Supabase session
  useEffect(() => {
    const getUser = async () => {
      try {
        // First try to get from localStorage (from signup.jsx)
        const storedUser = localStorage.getItem('user');
        
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } else {
          // Fallback to Supabase auth
          const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser();
          
          if (userError) {
            console.error('Error getting user from Supabase:', userError);
            setError('Please sign in to continue.');
            return;
          }
          
          if (supabaseUser) {
            // Store for future use
            localStorage.setItem('user', JSON.stringify(supabaseUser));
            setUser(supabaseUser);
          }
        }
        
        // SMART PRE-FILL: Only pre-fill location & phone
        if (existingData) {
          setProductDetails(prev => ({
            ...prev,
            location: existingData.location || '',
            phone_number: existingData.phone_number || '',
            // ❌ DON'T pre-fill product-specific fields
          }));
        }
      } catch (error) {
        console.error('Error in getUser:', error);
        setError('Failed to load user session.');
      }
    };
    
    getUser();
  }, [existingData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProductDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // ✅ FIXED: Use user from state, check if exists
    if (!user) {
      console.error('User not found in state');
      setError('Please sign in to continue.');
      return;
    }
    
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      console.log("📤 SellerSetupForm submitting...");
      console.log('✅ User from state:', user.id, user.email);

      // 1. First, ensure user profile exists
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([
          {
            user_id: user.id,
            username: user.email,
            location: productDetails.location.trim(),
            phone_number: productDetails.phone_number.trim(),
            updated_at: new Date().toISOString(),
          },
        ], {
          onConflict: 'user_id',
        });

      if (profileError) {
        console.error('Profile upsert error:', profileError);
        throw profileError;
      }

      // 2. Prepare product data with seller_id
      const productData = {
        name: productDetails.name.trim(),
        location: productDetails.location.trim(),
        price: productDetails.price ? parseFloat(productDetails.price) : null,
        description: productDetails.description.trim(),
        seller_id: user.id,
        phone_number: productDetails.phone_number.trim(),
        created_at: new Date().toISOString(),
        status: 'active',
      };

      console.log("📤 Attempting to save product:", productData);

      // 3. Insert product with better error handling
      const { data: insertedData, error: insertError } = await supabase
        .from('products')
        .insert([productData])
        .select();

      if (insertError) {
        console.error('📛 FULL Supabase Product Insert Error:', {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
          user_id: user.id,
          productData: productData
        });
        
        // Specific error handling
        if (insertError.code === '42501') {
          throw new Error('Permission denied. Check RLS policies for products table.');
        } else if (insertError.code === '23502') {
          throw new Error('Missing required fields. Check products table schema.');
        } else if (insertError.code === '22P02') {
          throw new Error('Invalid data type. Check price format (should be number).');
        } else if (insertError.code === '23505') {
          throw new Error('Product with this ID already exists.');
        } else if (insertError.code === '23503') {
          throw new Error('Foreign key violation. Check seller_id reference.');
        }
        throw insertError;
      }

      if (!insertedData || insertedData.length === 0) {
        throw new Error('Product saved but no data returned.');
      }

      console.log('✅ Product saved successfully:', insertedData);
      
      // 4. Update localStorage with new location/phone if changed
      const updatedUser = {
        ...user,
        location: productDetails.location.trim(),
        phone_number: productDetails.phone_number.trim()
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // 5. Call the parent completion handler
      console.log("📤 Calling onProfileComplete with:", {
        location: productDetails.location.trim(),
        phone_number: productDetails.phone_number.trim(),
        product_listed: true,
      });
      
      onProfileComplete({
        location: productDetails.location.trim(),
        phone_number: productDetails.phone_number.trim(),
        product_listed: productDetails.name.trim(),
        name: productDetails.name.trim(),
        price: productDetails.price ? parseFloat(productDetails.price) : null
      });

    } catch (err) {
      console.error('❌ Full Error Details:', err);
      setError(err.message || 'Failed to save product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED: Improved loading and error states
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
    <div className="p-5 bg-gray-900 rounded-xl shadow-2xl text-white max-w-xl mx-auto my-8 font-sans">
      <style>{`
        input, textarea, select {
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
        
        input:focus, textarea:focus, select:focus {
          outline: none;
          border-color: #9f7aea;
          box-shadow: 0 0 0 3px rgba(159, 122, 234, 0.2);
          background-color: #000000 !important;
          color: #ffffff !important;
        }
        
        input::placeholder, textarea::placeholder {
          color: #a0aec0 !important;
        }
        
        label {
          display: block;
          font-weight: 600;
          color: #e2e8f0;
          margin-bottom: 8px;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .error-message {
          background-color: #7f1d1d;
          border: 2px solid #dc2626;
          color: #fecaca;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
        }
        
        .success-message {
          background-color: #22543d;
          border: 2px solid #38a169;
          color: #c6f6d5;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
        }
        
        /* For Webkit browsers */
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active,
        textarea:-webkit-autofill,
        textarea:-webkit-autofill:hover,
        textarea:-webkit-autofill:focus,
        textarea:-webkit-autofill:active,
        select:-webkit-autofill,
        select:-webkit-autofill:hover,
        select:-webkit-autofill:focus,
        select:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #000000 inset !important;
          -webkit-text-fill-color: #ffffff !important;
          transition: background-color 5000s ease-in-out 0s;
          border: 2px solid #4a5568 !important;
        }
        
        /* Override browser default styles */
        input:-internal-autofill-selected {
          background-color: #000000 !important;
          color: #ffffff !important;
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
        <div className="error-message">
          <strong>Error:</strong> {error}
          <p className="mt-2 text-sm">
            Please ensure all fields are filled correctly and try again.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Product Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={productDetails.name}
            onChange={handleChange}
            required
            disabled={loading}
            placeholder="e.g., Weighted Blanket"
            minLength="3"
            maxLength="100"
            style={{ backgroundColor: '#000000', color: '#ffffff' }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="price">Price ($) *</label>
          <input
            type="number"
            id="price"
            name="price"
            value={productDetails.price}
            onChange={handleChange}
            required
            disabled={loading}
            placeholder="e.g., 49.99"
            step="0.01"
            min="0"
            max="999999.99"
            style={{ backgroundColor: '#000000', color: '#ffffff' }}
          />
          <small className="text-gray-400 text-sm">
            Enter price in USD. Use decimal points (e.g., 49.99)
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
            disabled={loading}
            placeholder="e.g., New York, NY or Johannesburg"
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
            value={productDetails.phone_number}
            onChange={handleChange}
            required
            disabled={loading}
            placeholder="+263 712 345 678"
            style={{ backgroundColor: '#000000', color: '#ffffff' }}
          />
          <small className="text-gray-400 text-sm">
            Format: +country code followed by number
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
            disabled={loading}
            rows="5"
            placeholder="Describe your product in detail. Include features, condition, brand, and any other relevant information."
            minLength="10"
            maxLength="1000"
            style={{ backgroundColor: '#000000', color: '#ffffff' }}
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`
            w-full py-3 px-4 mt-4 font-bold rounded-lg transition-all duration-300 shadow-lg
            flex items-center justify-center gap-2 text-lg
            ${loading 
              ? 'bg-gray-700 cursor-not-allowed opacity-70 text-gray-300' 
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
            }
          `}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            'Complete Setup & List Product'
          )}
        </button>
      </form>

      <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700 text-sm text-gray-300">
        <h4 className="font-semibold text-gray-200 mb-2">Note:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your product will be visible to buyers searching for similar items</li>
          <li>Your location and phone number will be saved to your profile</li>
          <li>You can update your listings anytime</li>
          <li>Ensure all information is accurate before submitting</li>
        </ul>
      </div>
    </div>
  );
};

export default SellerSetupForm;

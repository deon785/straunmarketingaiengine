// WishlistManager.jsx
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase'; 

// Helper function at the top
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

export default function WishlistManager({ onBack }) {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('products');

  // Fetch user's saved items - ✅ CORRECTED
  const fetchWishlistItems = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // ✅ Use fetchWithRetry here, not at the top level
      const userResult = await fetchWithRetry(() => supabase.auth.getUser());
      
      if (userResult.error) {
        console.error('Error getting user:', userResult.error);
        setError('Please sign in to view your wishlist');
        setLoading(false);
        return;
      }
      
      const user = userResult.data?.user;
      
      if (!user) {
        setError('User not found');
        setWishlistItems([]);
        setLoading(false);
        return;
      }
      
      const result = await supabase
        .from('saved_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!result.error) {
        setWishlistItems(result.data || []);
      } else {
        console.error('Error fetching wishlist:', result.error);
        setError('Failed to load wishlist items');
        setWishlistItems([]);
      }
    } catch (err) {
      console.error('Unexpected error fetching wishlist:', err);
      setError('Unable to load wishlist. Please try again.');
      setWishlistItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Delete an item from wishlist
  const deleteWishlistItem = async (id) => {
    if (!id) {
      setError('Invalid item ID');
      return;
    }
    
    setDeletingId(id);
    setError(null);
    
    try {
      const result = await supabase
        .from('saved_items')
        .delete()
        .eq('id', id);

      if (!result.error) {
        setWishlistItems(prevItems => prevItems.filter((item) => item.id !== id));
      } else {
        console.error('Error deleting item:', result.error);
        setError('Failed to delete item');
      }
    } catch (err) {
      console.error('Unexpected error deleting item:', err);
      setError('Unable to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  // Handle WhatsApp contact safely
  const handleWhatsAppContact = (phoneNumber) => {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      setError('Phone number not available');
      return;
    }
    
    try {
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      
      if (cleanNumber.length < 9 || cleanNumber.length > 15) {
        setError('Invalid phone number format');
        return;
      }
      
      const finalNumber = cleanNumber.startsWith('263') 
        ? cleanNumber 
        : `263${cleanNumber.replace(/^0/, '')}`;
      
      window.open(`https://wa.me/${finalNumber}`, '_blank');
    } catch (err) {
      console.error('Error opening WhatsApp:', err);
      setError('Unable to open WhatsApp');
    }
  };

  // Filter items by type
  const filteredItems = wishlistItems.filter(item => 
    activeTab === 'products' ? item.item_type === 'product' : item.item_type === 'prospect'
  );

  useEffect(() => {
    fetchWishlistItems();

    let channel = null;
    
    try {
      if (!supabase) {
        console.warn('Supabase client not available');
        return;
      }
      
      channel = supabase
        .channel('saved_items_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'saved_items',
          },
          (payload) => {
            supabase.auth.getUser()
              .then((userResult) => {
                if (!userResult.error && userResult.data?.user && payload.new?.user_id === userResult.data.user.id) {
                  fetchWishlistItems();
                }
              })
              .catch(err => console.error('Error checking user on change:', err));
          }
        )
        .subscribe();
    } catch (err) {
      console.error('Error setting up real-time subscription:', err);
    }

    const handlePullToRefresh = () => {
      console.log('🔄 Pull-to-refresh detected in WishlistManager');
      fetchWishlistItems();
    };
    
    window.addEventListener('pull-to-refresh', handlePullToRefresh);
    
    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (err) {
          console.error('Error removing channel:', err);
        }
      }
      window.removeEventListener('pull-to-refresh', handlePullToRefresh);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'white' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid #f3f3f3', 
          borderTop: '3px solid #667eea', 
          borderRadius: '50%', 
          animation: 'spin 1s linear infinite',
          margin: '0 auto 15px auto'
        }} />
        <p>Loading your wishlist...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      background: '#121212', 
      borderRadius: '12px',
      minHeight: '500px'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        
        <h3 style={{ color: 'white', margin: 0 }}>My Wishlist ({wishlistItems.length} items)</h3>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          background: '#ff4444',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {error}</span>
          <button 
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '18px'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        borderBottom: '1px solid #333',
        paddingBottom: '10px'
      }}>
        <button
          onClick={() => setActiveTab('products')}
          style={{
            background: activeTab === 'products' ? '#4361ee' : '#333',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          📦 Saved Products ({wishlistItems.filter(i => i.item_type === 'product').length})
        </button>
        <button
          onClick={() => setActiveTab('prospects')}
          style={{
            background: activeTab === 'prospects' ? '#4361ee' : '#333',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          👥 Saved Prospects ({wishlistItems.filter(i => i.item_type === 'prospect').length})
        </button>
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: '#888'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>
            {activeTab === 'products' ? '📦' : '👥'}
          </div>
          <h4 style={{ color: '#ccc', marginBottom: '10px' }}>
            No {activeTab === 'products' ? 'saved products' : 'saved prospects'} yet
          </h4>
          <p>
            {activeTab === 'products' 
              ? 'Save products you like by clicking the "💖 Save to Wishlist" button'
              : 'Save prospects by clicking the "💾 Save Prospect" button'
            }
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {filteredItems.map((item) => (
            <div key={item.id} style={{
              background: '#1e1e1e',
              borderRadius: '10px',
              padding: '15px',
              border: '1px solid #333',
              position: 'relative',
              opacity: deletingId === item.id ? 0.5 : 1
            }}>
              {/* Item Header */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '15px'
              }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ 
                    color: '#25D366', 
                    margin: '0 0 5px 0',
                    fontSize: '16px'
                  }}>
                    {item.item_type === 'product' ? item.product_name : `Prospect: ${item.interested_in}`}
                  </h4>
                  
                  {item.item_type === 'product' ? (
                    <>
                      <div style={{ color: '#ccc', marginBottom: '5px' }}>
                        <strong>Price:</strong> ${item.product_price || '0'}
                      </div>
                      <div style={{ color: '#ccc', fontSize: '14px' }}>
                        <strong>Location:</strong> {item.seller_location || 'Not specified'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ color: '#ccc', marginBottom: '5px' }}>
                        <strong>Email:</strong> {item.prospect_email || 'Not specified'}
                      </div>
                      <div style={{ color: '#ccc', fontSize: '14px' }}>
                        <strong>Location:</strong> {item.prospect_location || 'Not specified'}
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {item.item_type === 'product' && item.seller_phone && (
                    <button
                      onClick={() => handleWhatsAppContact(item.seller_phone)}
                      style={{
                        background: '#25D366',
                        color: 'white',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      💬 Contact
                    </button>
                  )}
                  
                  <button 
                    onClick={() => deleteWishlistItem(item.id)}
                    disabled={deletingId === item.id}
                    style={{
                      background: '#ff4d4d',
                      color: 'white',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      cursor: deletingId === item.id ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      opacity: deletingId === item.id ? 0.6 : 1
                    }}
                    title="Remove from wishlist"
                  >
                    {deletingId === item.id ? '⌛' : '🗑️'}
                  </button>
                </div>
              </div>

              {/* Product Image */}
              {item.item_type === 'product' && item.product_image && (
                <div style={{ marginBottom: '10px' }}>
                  <img 
                    src={item.product_image} 
                    alt={item.product_name || 'Product'}
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                      border: '2px solid #333'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Footer */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid #333',
                fontSize: '12px',
                color: '#888'
              }}>
                <span>
                  Saved on {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Unknown date'}
                </span>
                <span style={{
                  background: item.item_type === 'product' ? '#4361ee' : '#9c27b0',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px'
                }}>
                  {item.item_type === 'product' ? 'Product' : 'Prospect'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
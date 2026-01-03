// WishlistManager.jsx
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

export default function WishlistManager({ onBack }) {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('products'); // 'products' or 'prospects'

  // Fetch user's saved items
  const fetchWishlistItems = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data, error } = await supabase
        .from('saved_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error) {
        setWishlistItems(data || []);
      } else {
        console.error('Error fetching wishlist:', error);
      }
    }
    setLoading(false);
  };

  // Delete an item from wishlist
  const deleteWishlistItem = async (id) => {
    const { error } = await supabase
      .from('saved_items')
      .delete()
      .eq('id', id);

    if (!error) {
      setWishlistItems(wishlistItems.filter((item) => item.id !== id));
    }
  };

  // Filter items by type
  const filteredItems = wishlistItems.filter(item => 
    activeTab === 'products' ? item.item_type === 'product' : item.item_type === 'prospect'
  );

  useEffect(() => {
    fetchWishlistItems();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'white' }}>
        <p>Loading your wishlist...</p>
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
        <button 
          onClick={onBack} 
          style={{
            background: '#4361ee',
            color: 'white',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0
          }}
        >
          ← Back to Search
        </button>
        <h3 style={{ color: 'white', margin: 0 }}>My Wishlist ({wishlistItems.length} items)</h3>
      </div>

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
              position: 'relative'
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
                        <strong>Price:</strong> ${item.product_price}
                      </div>
                      <div style={{ color: '#ccc', fontSize: '14px' }}>
                        <strong>Location:</strong> {item.seller_location}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ color: '#ccc', marginBottom: '5px' }}>
                        <strong>Email:</strong> {item.prospect_email}
                      </div>
                      <div style={{ color: '#ccc', fontSize: '14px' }}>
                        <strong>Location:</strong> {item.prospect_location}
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {item.item_type === 'product' && item.seller_phone && (
                    <button
                      onClick={() => window.open(`https://wa.me/${item.seller_phone.replace(/\D/g, '')}`, '_blank')}
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
                    style={{
                      background: '#ff4d4d',
                      color: 'white',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    title="Remove from wishlist"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Product Image (if exists) */}
              {item.item_type === 'product' && item.product_image && (
                <div style={{ marginBottom: '10px' }}>
                  <img 
                    src={item.product_image} 
                    alt={item.product_name}
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                      border: '2px solid #333'
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
                  Saved on {new Date(item.created_at).toLocaleDateString()}
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
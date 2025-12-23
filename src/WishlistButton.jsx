import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

export default function WishlistManager({ onBack }) { // Add onBack prop
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch the user's saved searches
  const fetchWishes = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data, error } = await supabase
        .from('wishlist')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error) setWishes(data);
    }
    setLoading(false);
  };

  // 2. Delete a wish
  const deleteWish = async (id) => {
    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('id', id);

    if (!error) {
      setWishes(wishes.filter((wish) => wish.id !== id));
    }
  };

  useEffect(() => {
    fetchWishes();
  }, []);

  if (loading) return <p style={{ color: 'white' }}>Loading your wishes...</p>;

  return (
    <div style={{ padding: '20px', background: '#121212', borderRadius: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          onClick={onBack} 
          style={backButtonStyle}
        >
          ← Back to Main
        </button>
        <h3 style={{ color: 'white' }}>My Saved Searches</h3>
      </div>

      {wishes.length === 0 ? (
        <p style={{ color: '#888' }}>You haven't saved any searches yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {wishes.map((wish) => (
            <div key={wish.id} style={cardStyle}>
              <div>
                <strong style={{ color: '#25D366' }}>{wish.item_name}</strong>
                <p style={{ margin: '5px 0', color: '#ccc', fontSize: '14px' }}>
                  Max Price: ${wish.max_price || 'Any'}
                </p>
              </div>
              <button onClick={() => deleteWish(wish.id)} style={deleteBtnStyle}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// Add back button style
const backButtonStyle = {
  background: '#4361ee',
  color: 'white',
  border: 'none',
  padding: '10px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
};
// Simple Styles
const cardStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '15px',
  background: '#1e1e1e',
  borderRadius: '8px',
  border: '1px solid #333'
};

const deleteBtnStyle = {
  background: '#ff4d4d',
  color: 'white',
  border: 'none',
  padding: '8px 12px',
  borderRadius: '6px',
  cursor: 'pointer'
};
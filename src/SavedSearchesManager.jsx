// SavedSearchesManager.jsx - Saved Searches & Interests Manager
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

// ✅ Add retry helper
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

export default function SavedSearchesManager({ onBack, userId, onInterestUpdate }) {
  const [wishes, setWishes] = useState([]);
  const [interests, setInterests] = useState([]);
  const [newInterest, setNewInterest] = useState('');
  const [activeTab, setActiveTab] = useState('searches');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [addingInterest, setAddingInterest] = useState(false);

  // Fetch the user's saved searches AND interests
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const userResult = await fetchWithRetry(() => supabase.auth.getUser());
      
      if (userResult.error) {
        console.error('Error getting user:', userResult.error);
        setError('Please sign in to view saved searches');
        setWishes([]);
        setInterests([]);
        setLoading(false);
        return;
      }
      
      const user = userResult.data?.user;
      
      if (!user) {
        setError('User not found');
        setWishes([]);
        setInterests([]);
        setLoading(false);
        return;
      }
      
      // ✅ Fetch saved searches
      let result = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (result.error || !result.data || result.data.length === 0) {
        const wishlistResult = await supabase
          .from('wishlist')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (!wishlistResult.error && wishlistResult.data && wishlistResult.data.length > 0) {
          result = wishlistResult;
        }
      }

      if (!result.error) {
        setWishes(result.data || []);
      } else {
        console.error('Error fetching saved searches:', result.error);
        setError('Failed to load saved searches');
        setWishes([]);
      }

      // ✅ Fetch interests from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('interests')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profileError && profile) {
        setInterests(profile.interests || []);
      } else {
        setInterests([]);
      }

    } catch (err) {
      console.error('Unexpected error fetching data:', err);
      setError('Unable to load data. Please try again.');
      setWishes([]);
      setInterests([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Add interest
  const addInterest = async () => {
    if (!newInterest.trim()) {
      setError('Please enter an interest');
      return;
    }

    // Check if interest already exists
    if (interests.some(i => i.toLowerCase() === newInterest.trim().toLowerCase())) {
      setError('This interest is already added');
      return;
    }

    setAddingInterest(true);
    setError(null);

    try {
      const userResult = await fetchWithRetry(() => supabase.auth.getUser());
      const user = userResult.data?.user;
      
      if (!user) {
        setError('User not found');
        setAddingInterest(false);
        return;
      }

      const updatedInterests = [...interests, newInterest.trim()];
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ interests: updatedInterests })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error adding interest:', updateError);
        setError('Failed to add interest');
        setAddingInterest(false);
        return;
      }

      setInterests(updatedInterests);
      setNewInterest('');
      
      // ✅ Notify parent component
      if (onInterestUpdate) {
        onInterestUpdate(updatedInterests);
      }

    } catch (err) {
      console.error('Error adding interest:', err);
      setError('Unable to add interest');
    } finally {
      setAddingInterest(false);
    }
  };

  // ✅ Remove interest
  const removeInterest = async (index) => {
    try {
      const userResult = await fetchWithRetry(() => supabase.auth.getUser());
      const user = userResult.data?.user;
      
      if (!user) {
        setError('User not found');
        return;
      }

      const updatedInterests = interests.filter((_, i) => i !== index);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ interests: updatedInterests })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error removing interest:', updateError);
        setError('Failed to remove interest');
        return;
      }

      setInterests(updatedInterests);
      
      // ✅ Notify parent component
      if (onInterestUpdate) {
        onInterestUpdate(updatedInterests);
      }

    } catch (err) {
      console.error('Error removing interest:', err);
      setError('Unable to remove interest');
    }
  };

  // Delete a saved search
  const deleteWish = async (id) => {
    if (!id) {
      setError('Invalid item ID');
      return;
    }
    
    setDeletingId(id);
    setError(null);
    
    try {
      let result = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', id);

      if (result.error) {
        result = await supabase
          .from('wishlist')
          .delete()
          .eq('id', id);
      }

      if (!result.error) {
        setWishes(prevWishes => prevWishes.filter((wish) => wish.id !== id));
      } else {
        console.error('Error deleting item:', result.error);
        setError('Failed to delete saved search');
      }
    } catch (err) {
      console.error('Unexpected error deleting item:', err);
      setError('Unable to delete saved search');
    } finally {
      setDeletingId(null);
    }
  };

  // Run a saved search
  const runSavedSearch = (searchTerm) => {
    if (!searchTerm || typeof searchTerm !== 'string') {
      setError('Invalid search term');
      return;
    }
    
    try {
      sessionStorage.setItem('savedSearchTerm', searchTerm);
      
      if (onBack && typeof onBack === 'function') {
        onBack();
      } else {
        window.history.back();
      }
      
      window.dispatchEvent(new CustomEvent('runSavedSearch', { detail: { searchTerm } }));
    } catch (err) {
      console.error('Error running saved search:', err);
      setError('Unable to run saved search');
    }
  };

  useEffect(() => {
    fetchData();
    
    const handlePullToRefresh = () => {
      console.log('🔄 Pull-to-refresh detected in SavedSearchesManager');
      fetchData();
    };
    
    window.addEventListener('pull-to-refresh', handlePullToRefresh);
    
    return () => {
      window.removeEventListener('pull-to-refresh', handlePullToRefresh);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', background: '#121212', borderRadius: '12px' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid #f3f3f3', 
          borderTop: '3px solid #667eea', 
          borderRadius: '50%', 
          animation: 'spin 1s linear infinite',
          margin: '0 auto 15px auto'
        }} />
        <p style={{ color: 'white' }}>Loading your preferences...</p>
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
    <div style={{ padding: '20px', background: '#121212', borderRadius: '12px', minHeight: '400px' }}>
      {/* Header with Back Button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px', 
        flexWrap: 'wrap', 
        gap: '10px' 
      }}>
        <button 
          onClick={() => {
            try {
              if (onBack && typeof onBack === 'function') {
                onBack();
              } else {
                window.history.back();
              }
            } catch (err) {
              console.error('Error navigating back:', err);
              window.history.back();
            }
          }}
          style={backButtonStyle}
        >
          ← Back to Main
        </button>
        <h3 style={{ color: 'white', margin: 0 }}>📋 My Preferences</h3>
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
        borderBottom: '2px solid #333',
        paddingBottom: '10px'
      }}>
        <button
          onClick={() => setActiveTab('searches')}
          style={{
            padding: '8px 20px',
            background: activeTab === 'searches' ? '#667eea' : 'transparent',
            color: activeTab === 'searches' ? 'white' : '#888',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: activeTab === 'searches' ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          🔍 Saved Searches ({wishes.length})
        </button>
        <button
          onClick={() => setActiveTab('interests')}
          style={{
            padding: '8px 20px',
            background: activeTab === 'interests' ? '#667eea' : 'transparent',
            color: activeTab === 'interests' ? 'white' : '#888',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: activeTab === 'interests' ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          🎯 Interests ({interests.length})
        </button>
      </div>

      {/* Saved Searches Tab */}
      {activeTab === 'searches' && (
        <>
          {wishes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔍</div>
              <p style={{ color: '#888' }}>You haven't saved any searches yet.</p>
              <p style={{ color: '#666', fontSize: '12px', marginTop: '10px' }}>
                Click the 💾 button on search results to save searches.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {wishes.map((wish) => (
                <div key={wish.id} style={cardStyle}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#25D366' }}>
                      {wish.search_term || wish.item_name || 'Unnamed search'}
                    </strong>
                    <div style={{ margin: '5px 0', color: '#ccc', fontSize: '14px' }}>
                      {wish.max_price && (
                        <span>Max Price: ${wish.max_price}</span>
                      )}
                      {wish.min_price && (
                        <span style={{ marginLeft: '10px' }}>Min Price: ${wish.min_price}</span>
                      )}
                      {wish.location && (
                        <span style={{ marginLeft: '10px' }}>📍 {wish.location}</span>
                      )}
                      {!wish.max_price && !wish.min_price && !wish.location && (
                        <span>All items</span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
                      Saved on {wish.created_at ? new Date(wish.created_at).toLocaleDateString() : 'Unknown date'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => runSavedSearch(wish.search_term || wish.item_name)}
                      style={{
                        background: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      title="Run this search"
                    >
                      🔍 Run
                    </button>
                    <button 
                      onClick={() => deleteWish(wish.id)}
                      disabled={deletingId === wish.id}
                      style={{
                        background: '#ff4d4d',
                        color: 'white',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: deletingId === wish.id ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        opacity: deletingId === wish.id ? 0.6 : 1
                      }}
                      title="Delete saved search"
                    >
                      {deletingId === wish.id ? '⌛' : '🗑️'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Interests Tab */}
      {activeTab === 'interests' && (
        <div>
          {/* Info Message */}
          <div style={{
            background: '#1e3a5f',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            borderLeft: '3px solid #667eea'
          }}>
            <p style={{ margin: '0', fontSize: '13px', color: '#b0c4de' }}>
              💡 Add your interests so sellers can find you with relevant products!
            </p>
          </div>

          {/* Add Interest Input */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '16px'
          }}>
            <input
              type="text"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              placeholder="e.g., electronics, books, clothing, phones..."
              style={{
                flex: 1,
                padding: '10px 14px',
                background: '#1e1e1e',
                border: '2px solid #333',
                borderRadius: '8px',
                fontSize: '14px',
                color: 'white',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#333';
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addInterest();
                }
              }}
              disabled={addingInterest}
            />
            <button
              onClick={addInterest}
              disabled={addingInterest}
              style={{
                padding: '10px 24px',
                background: addingInterest ? '#555' : 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: addingInterest ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                opacity: addingInterest ? 0.7 : 1,
                transition: 'all 0.2s'
              }}
            >
              {addingInterest ? 'Adding...' : '➕ Add'}
            </button>
          </div>

          {/* Interest Tags */}
          {interests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🎯</div>
              <p>No interests added yet</p>
              <p style={{ fontSize: '12px', marginTop: '5px' }}>
                Add interests above to help sellers find you
              </p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              {interests.map((interest, index) => (
                <div key={index} style={{
                  background: 'linear-gradient(135deg, #667eea30, #764ba230)',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid #667eea50'
                }}>
                  <span style={{ fontSize: '14px', color: '#e0e0e0' }}>{interest}</span>
                  <button
                    onClick={() => removeInterest(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#888',
                      fontSize: '16px',
                      padding: '0 4px',
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => (e.target.style.color = '#ff4444')}
                    onMouseLeave={(e) => (e.target.style.color = '#888')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer Note */}
          <div style={{
            marginTop: '20px',
            padding: '12px',
            background: '#1a1a1a',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#666'
          }}>
            <p style={{ margin: 0 }}>
              📌 Your interests are shared with sellers to help them find you with relevant products.
              <br />
              <span style={{ fontSize: '11px', color: '#555' }}>
                You can add up to 20 interests. Be specific for better matches!
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
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

const cardStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '15px',
  background: '#1e1e1e',
  borderRadius: '8px',
  border: '1px solid #333',
  flexWrap: 'wrap',
  gap: '10px'
};
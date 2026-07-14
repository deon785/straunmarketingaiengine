// SavedSearchesManager.jsx - Saved Searches Manager
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

export default function SavedSearchesManager({ onBack }) {
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  // Fetch the user's saved searches
  const fetchWishes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // ✅ Use fetchWithRetry
      const userResult = await fetchWithRetry(() => supabase.auth.getUser());
      
      if (userResult.error) {
        console.error('Error getting user:', userResult.error);
        setError('Please sign in to view saved searches');
        setWishes([]);
        setLoading(false);
        return;
      }
      
      const user = userResult.data?.user;
      
      if (!user) {
        setError('User not found');
        setWishes([]);
        setLoading(false);
        return;
      }
      
      // Try to fetch from saved_searches table first
      let result = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // If saved_searches table doesn't exist or is empty, try wishlist table
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
    } catch (err) {
      console.error('Unexpected error fetching saved searches:', err);
      setError('Unable to load saved searches. Please try again.');
      setWishes([]);
    } finally {
      setLoading(false);
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
      // Try to delete from saved_searches first
      let result = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', id);

      // If that fails, try wishlist table
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
      // Store the search term in sessionStorage
      sessionStorage.setItem('savedSearchTerm', searchTerm);
      
      // Navigate back to main page
      if (onBack && typeof onBack === 'function') {
        onBack();
      } else {
        console.warn('onBack function not provided');
        window.history.back();
      }
      
      // Trigger a custom event that the main page can listen for
      window.dispatchEvent(new CustomEvent('runSavedSearch', { detail: { searchTerm } }));
    } catch (err) {
      console.error('Error running saved search:', err);
      setError('Unable to run saved search');
    }
  };

  useEffect(() => {
    fetchWishes();
    
    // ✅ Add pull-to-refresh support
    const handlePullToRefresh = () => {
      console.log('🔄 Pull-to-refresh detected in SavedSearchesManager');
      fetchWishes();
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
        <p style={{ color: 'white' }}>Loading your saved searches...</p>
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
                console.warn('onBack function not provided');
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
        <h3 style={{ color: 'white', margin: 0 }}>My Saved Searches ({wishes.length})</h3>
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

      {/* Empty State */}
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
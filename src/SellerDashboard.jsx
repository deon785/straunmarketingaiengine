import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import ReactGA from 'react-ga4';
import ProductForm from './ProductForm';
import SellerCatalog from './SellerCatalog';

const T = {
  text: '#0f172a', textMuted: '#64748b', textLight: '#94a3b8',
  bg: '#f1f5f9', card: '#ffffff',
  border: '#e2e8f0', primary: '#4361ee', secondary: '#7209b7',
  errorText: '#dc2626',
};

const fetchWithRetry = async (fn, n = 3) => {
  let last;
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) { last = e; await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000)); }
  }
  throw last;
};

const SellerDashboard = ({ user, profile: initialProfile, onBackToSocial }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(initialProfile);
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('catalog');
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Hover states
  const [hoverAdd, setHoverAdd] = useState(false);
  const [hoverShop, setHoverShop] = useState(false);
  const [hoverLoc, setHoverLoc] = useState(false);
  const [hoverName, setHoverName] = useState(false);

  // Location Editing State
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState(profile?.location || '');
  const [savingLocation, setSavingLocation] = useState(false);
  const [newShopBio, setNewShopBio] = useState(profile?.shop_bio || '');

  // Shop Name Editing State
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(profile?.shop_name || '');
  const [savingName, setSavingName] = useState(false);

  const fetchMyProducts = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await fetchWithRetry(() =>
        supabase
          .from('products')
          .select('*')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false })
      );
      if (fetchErr) throw fetchErr;
      setProducts(data || []);
    } catch (err) {
      console.error('Fetch products failed:', err);
      setError(err.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchMyProducts(); }, [fetchMyProducts]);

    const handleSaveLocation = async () => {
    if (!newLocation.trim()) {
      alert("City/Location is required.");
      return;
    }

    if (newLocation.trim() === profile.location && newShopBio.trim() === profile.shop_bio) {
      setIsEditingLocation(false);
      return;
    }

    setSavingLocation(true);
    try {
      // ✅ UPDATE BOTH FIELDS IN SUPABASE
      const { data: updatedProfile, error: updateErr } = await supabase
        .from('profiles')
        .update({ 
          location: newLocation.trim(), 
          shop_bio: newShopBio.trim() 
        })
        .eq('user_id', user.id)
        .select()
        .single();
        
      if (updateErr) throw updateErr;
      
      setProfile(updatedProfile);
      setIsEditingLocation(false);
    } catch (err) {
      console.error('Failed to update location:', err);
      alert('Failed to save location. Please try again.');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim() || newName.trim() === profile.shop_name) {
      setIsEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const { data: updatedProfile, error: updateErr } = await supabase
        .from('profiles')
        .update({ shop_name: newName.trim() })
        .eq('user_id', user.id)
        .select()
        .single();
        
      if (updateErr) throw updateErr;
      
      setProfile(updatedProfile);
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update shop name:', err);
      alert('Failed to save shop name. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaved = useCallback(() => {
    setView('catalog');
    setEditingProduct(null);
    fetchMyProducts();
  }, [fetchMyProducts]);

  const handleEdit = useCallback((product) => {
    setEditingProduct(product);
    setView('edit');
  }, []);

  const handleDeleted = useCallback((id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  if (view === 'add' || view === 'edit') {
    return (
      <ProductForm
        user={user}
        profile={profile}
        product={view === 'edit' ? editingProduct : null}
        onSaved={handleSaved}
        onCancel={() => { setView('catalog'); setEditingProduct(null); }}
      />
    );
  }

  return (
    <div style={{
      maxWidth: '900px', margin: '0 auto', padding: '32px 24px',
      color: T.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Left Side: Shop Name & Subtitle */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px', margin: 0 }}>
              {profile?.shop_name || 'My Shop'}
            </h1>
            <button
              onClick={() => {
                setNewName(profile?.shop_name || '');
                setIsEditingName(!isEditingName);
                setIsEditingLocation(false); // Close location if open
              }}
              onMouseEnter={() => setHoverName(true)}
              onMouseLeave={() => setHoverName(false)}
              style={{
                background: 'none', border: 'none', color: T.primary,
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                padding: '4px 8px', textDecoration: hoverName ? 'underline' : 'none',
                transition: 'all 0.2s'
              }}
            >
              {isEditingName ? 'Cancel' : 'Edit Name'}
            </button>
          </div>
          <p style={{ color: T.textMuted, fontSize: '15px', margin: 0 }}>
            Manage your babywear listings
          </p>
        </div>
        
        {/* Right Side: Back to Search Button */}
        <button
          onClick={() => {
              if (onBackToSocial) { onBackToSocial(); }
              else { navigate('/app'); }
          }}
          style={{
              background: 'linear-gradient(135deg, #d6336c, #7c3aed)',
              border: 'none',
              color: '#ffffff',
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'inherit',
              boxShadow: '0 4px 14px -6px rgba(214,51,108,0.5)',
              transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px -6px rgba(214,51,108,0.7)';
          }}
          onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px -6px rgba(214,51,108,0.5)';
          }}
        >
          🔍 Search Customers
        </button>
      </div>

      {/* Shop Name Editor */}
      {isEditingName && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '12px', padding: '16px', marginBottom: '16px', animation: 'fadeIn 0.2s ease' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Update Shop Name</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Tendai's Babywear"
              style={{
                flex: 1, padding: '12px', borderRadius: '8px',
                border: `1px solid ${T.border}`, fontSize: '14px', fontFamily: 'inherit',
                outline: 'none', transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = T.primary}
              onBlur={(e) => e.target.style.borderColor = T.border}
            />
            <button
              onClick={handleSaveName}
              disabled={savingName || !newName.trim()}
              style={{
                padding: '0 20px', background: T.primary, color: 'white',
                border: 'none', borderRadius: '8px', fontWeight: 600,
                cursor: savingName ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                opacity: (savingName || !newName.trim()) ? 0.7 : 1
              }}
            >
              {savingName ? '...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Location Row (Moved below Shop Name) */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <div 
          onMouseEnter={() => setHoverLoc(true)}
          onMouseLeave={() => setHoverLoc(false)}
          onClick={() => {
            setNewLocation(profile?.location || '');
            setNewShopBio(profile?.shop_bio || '');
            setIsEditingLocation(!isEditingLocation);
            setIsEditingName(false); // Close name if open
          }}
          style={{
            background: hoverLoc ? '#f8fafc' : T.card, 
            padding: '8px 16px', borderRadius: '30px',
            display: 'inline-flex', alignItems: 'center', gap: '12px', 
            border: `1px solid ${hoverLoc ? T.primary : T.border}`,
            fontSize: '14px', fontWeight: 600, cursor: 'pointer', 
            boxShadow: hoverLoc ? '0 4px 12px rgba(67, 97, 238, 0.1)' : '0 2px 8px rgba(0,0,0,0.02)',
            transition: 'all 0.2s ease'
          }}
        >
          <span>📍 {profile?.location || 'Set Location'} {profile?.shop_bio ? `· ${profile.shop_bio}` : ''}</span>
          <span style={{ color: T.primary, fontSize: '12px', textDecoration: hoverLoc ? 'underline' : 'none' }}>
            {isEditingLocation ? 'Cancel' : 'Edit'}
          </span>
        </div>
      </div>

      {/* Location Editor */}
      {isEditingLocation && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '12px', padding: '16px', marginBottom: '24px', animation: 'fadeIn 0.2s ease' }}>
          
          {/* City Input */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>City / Main Location *</label>
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="e.g., Harare"
              style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                border: `1px solid ${T.border}`, fontSize: '14px', fontFamily: 'inherit',
                outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = T.primary}
              onBlur={(e) => e.target.style.borderColor = T.border}
            />
          </div>

          {/* Exact Address Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Exact Address / Shop Bio (Optional)</label>
            <input
              type="text"
              value={newShopBio}
              onChange={(e) => setNewShopBio(e.target.value)}
              placeholder="e.g., 3rd Street, near Eastgate"
              style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                border: `1px solid ${T.border}`, fontSize: '14px', fontFamily: 'inherit',
                outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = T.primary}
              onBlur={(e) => e.target.style.borderColor = T.border}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setIsEditingLocation(false)}
              style={{
                flex: 1, padding: '12px', background: 'white',
                border: `1px solid ${T.border}`, borderRadius: '8px',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveLocation}
              disabled={savingLocation || !newLocation.trim()}
              style={{
                flex: 1, padding: '12px', background: T.primary, color: 'white',
                border: 'none', borderRadius: '8px', fontWeight: 600,
                cursor: savingLocation || !newLocation.trim() ? 'not-allowed' : 'pointer', 
                fontFamily: 'inherit',
                opacity: (savingLocation || !newLocation.trim()) ? 0.7 : 1
              }}
            >
              {savingLocation ? 'Saving...' : 'Save Info'}
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        
        {/* PRIMARY BUTTON: View Shop */}
        <button
          onClick={() => setView('catalog')}
          onMouseEnter={() => setHoverShop(true)}
          onMouseLeave={() => setHoverShop(false)}
          style={{
            flex: '1 1 200px', padding: '16px', borderRadius: '12px', 
            border: `2px solid ${hoverAdd ? T.secondary : 'transparent'}`,
            background: `linear-gradient(135deg, ${T.primary} 0%, ${T.secondary} 100%)`,
            color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer',
            boxShadow: hoverAdd ? '0 6px 20px rgba(67, 97, 238, 0.4)' : '0 4px 15px rgba(67, 97, 238, 0.3)', 
            fontFamily: 'inherit',
            transform: hoverAdd ? 'translateY(-2px)' : 'translateY(0)',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
        >
          🛍 View Shop ({products.length})
        </button>

        {/* SECONDARY BUTTON: Add New Product */}
        <button
          onClick={() => { ReactGA.event({ category: 'Seller', action: 'Opened_Add_Item' }); setView('add'); }}
          onMouseEnter={() => setHoverAdd(true)}
          onMouseLeave={() => setHoverAdd(false)}
          style={{
            flex: '0 1 auto', padding: '16px 24px', borderRadius: '12px',
            background: hoverShop ? '#f8fafc' : T.card, 
            color: T.text, 
            border: `2px solid ${hoverShop ? T.primary : T.border}`,
            fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: hoverShop ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
        >
          ＋ Add New Product
        </button>
      </div>

      {/* Catalog */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: T.textMuted }}>Loading products…</div>
      ) : error ? (
        <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px' }}>
          <p style={{ color: T.errorText, marginBottom: '12px' }}>{error}</p>
          <button onClick={fetchMyProducts} style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      ) : (
        <SellerCatalog
          products={products}
          onEdit={handleEdit}
          onDeleted={handleDeleted}
          onAddFirst={() => setView('add')}
        />
      )}
    </div>
  );
};

export default SellerDashboard;
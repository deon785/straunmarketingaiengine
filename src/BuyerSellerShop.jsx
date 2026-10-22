import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from './lib/supabase';

const T = {
  text: '#0f172a', textMuted: '#64748b',
  card: '#ffffff', bg: '#f8fafc', border: '#e2e8f0',
  primary: '#4361ee', secondary: '#7209b7',
  green: '#10b981', // WhatsApp Green
};

const BuyerSellerShop = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sellerId: urlSellerId } = useParams();
  
  // Get state passed from the previous page
  const stateData = location.state || {};
  const sellerId = stateData.sellerId || urlSellerId;
  const claimedProductId = stateData.claimedProductId || null;
  
  // State for UI
  const [products, setProducts] = useState([]);
  const [sellerInfo, setSellerInfo] = useState({
    shop_name: stateData.sellerName || 'Seller Shop',
    shop_bio: '',
    location: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sellerId) {
      setError('No seller selected.');
      setLoading(false);
      return;
    }

    const fetchSellerData = async () => {
      try {
        // 1. Fetch Seller Profile (for Shop Name, Bio, and City)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('shop_name, shop_bio, location, username')
          .eq('user_id', sellerId)
          .maybeSingle();

        if (profileError) throw profileError;

        if (profile) {
          // ✅ FIXED: If no shop_name, it falls back to "Seller Shop", NOT the username/email
          const displayName = profile.shop_name && profile.shop_name.trim() !== '' 
            ? profile.shop_name 
            : 'Seller Shop';

          setSellerInfo({
            shop_name: displayName,
            shop_bio: profile.shop_bio || '',
            location: profile.location || ''
          });
        }

        // 2. Fetch Seller Products
        const { data: productsData, error: fetchErr } = await supabase
          .from('products')
          .select('*')
          .eq('seller_id', sellerId)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (fetchErr) throw fetchErr;

        // Sort logic: Put the claimed product at the very top
        const sortedData = (productsData || []).sort((a, b) => {
          if (a.id === claimedProductId) return -1;
          if (b.id === claimedProductId) return 1;
          return 0;
        });

        setProducts(sortedData);
      } catch (err) {
        console.error('Error fetching shop data:', err);
        setError('Failed to load seller shop.');
      } finally {
        setLoading(false);
      }
    };

    fetchSellerData();
  }, [sellerId, claimedProductId]);

  const handleContactSeller = (phoneNumber, productName) => {
    if (!phoneNumber) {
      alert("This seller hasn't provided a phone number.");
      return;
    }
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const message = encodeURIComponent(`Hi, I saw your item "${productName}" on Straun and I'm interested!`);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading seller shop...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>{error}</div>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px', fontFamily: 'sans-serif' }}>
      
      {/* Top Bar */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', color: T.primary,
            fontSize: '15px', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          ← Back to Deals
        </button>
      </div>

      {/* Seller Info Header */}
      <div style={{ marginBottom: '32px', background: T.card, padding: '24px', borderRadius: '16px', border: `1px solid ${T.border}` }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px 0', color: T.text }}>
          {sellerInfo.shop_name}
        </h1>
        
        {sellerInfo.shop_bio && (
          <p style={{ fontSize: '15px', color: T.textMuted, margin: '0 0 16px 0', lineHeight: 1.5 }}>
            {sellerInfo.shop_bio}
          </p>
        )}
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {sellerInfo.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: T.textMuted, background: T.bg, padding: '6px 12px', borderRadius: '20px' }}>
              <span>📍</span> {sellerInfo.location}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: T.textMuted }}>
            🛍️ {products.length} {products.length === 1 ? 'Product' : 'Products'}
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px'
      }}>
        {products.map((p) => {
          const isClaimed = p.id === claimedProductId;
          
          return (
            <div
              key={p.id}
              style={{
                background: T.card,
                border: isClaimed ? `2px solid ${T.green}` : `1px solid ${T.border}`,
                borderRadius: '16px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: isClaimed ? '0 8px 24px rgba(16, 185, 129, 0.15)' : '0 2px 8px rgba(0,0,0,0.02)',
                position: 'relative'
              }}
            >
              {/* Claimed Badge */}
              {isClaimed && (
                <div style={{
                  position: 'absolute', top: '12px', left: '12px',
                  background: T.green, color: 'white',
                  padding: '4px 12px', borderRadius: '20px',
                  fontSize: '12px', fontWeight: 700, zIndex: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}>
                  ✓ Your Claimed Deal
                </div>
              )}

              {/* Image */}
              <div style={{ position: 'relative', paddingTop: '65%', background: T.bg }}>
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>🍼</div>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{p.name}</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: T.primary, marginBottom: '16px' }}>
                  ${Number(p.price).toFixed(2)}
                </div>
                
                <div style={{ marginTop: 'auto' }}>
                  <button
                    onClick={() => handleContactSeller(p.phone_number, p.name)}
                    style={{
                      width: '100%', padding: '12px',
                      background: T.green, color: 'white',
                      border: 'none', borderRadius: '8px',
                      fontSize: '14px', fontWeight: 700,
                      cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    💬 Contact Seller
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BuyerSellerShop;
// ============================================
// src/NotificationDetail.jsx - FINAL WORKING
// ============================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthState } from './AuthContext';
import { toast } from 'react-hot-toast';

const NotificationDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { notificationId } = useParams();
  const { user } = useAuthState();
  
  const [notification, setNotification] = useState(null);
  const [sender, setSender] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ✅ Fetch notification
  useEffect(() => {
    const fetchNotification = async () => {
      if (!notificationId || !user?.id) return;

      try {
        setLoading(true);

        const { data: notifData, error: notifError } = await supabase
          .from('notifications')
          .select('id, user_id, sender_id, message, link_type, is_read, created_at, buyer_phone, product_image')
          .eq('id', notificationId)
          .eq('user_id', user.id)
          .single();

        if (notifError) {
          console.error('Notification fetch error:', notifError);
          toast.error('Failed to load notification');
          setTimeout(() => navigate(-1), 1500);
          return;
        }
        
        if (!notifData) {
          toast.error('Notification not found');
          setTimeout(() => navigate(-1), 1500);
          return;
        }

        setNotification(notifData);

        // ✅ Fetch sender details
        if (notifData.sender_id) {
          const { data: senderData, error: senderError } = await supabase
            .from('profiles')
            .select('user_id, username, location, phone_number, is_seller, is_buyer, rating')
            .eq('user_id', notifData.sender_id)
            .maybeSingle();

          if (!senderError && senderData) {
            setSender(senderData);
          }
        }

        // ✅ Mark as read
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId)
          .eq('user_id', user.id);

      } catch (error) {
        console.error('Error fetching notification:', error);
        toast.error('Failed to load notification details');
      } finally {
        setLoading(false);
      }
    };

    fetchNotification();
  }, [notificationId, user?.id, navigate]);

  // ✅ Save to wishlist - FINAL WORKING VERSION
  const saveToWishlist = async () => {
    if (!notification) return;
    setIsSaving(true);

    try {
      // Check if already saved
      const { data: existing } = await supabase
        .from('saved_items')
        .select('id')
        .eq('user_id', user.id)
        .eq('item_type', 'notification')
        .eq('notes', `Notification: ${notification.id}`)
        .maybeSingle();

      if (existing) {
        toast.info('Already saved!', { icon: '⭐' });
        setIsSaving(false);
        return;
      }

      // ✅ Get phone number from sender
      const phoneNumber = sender?.phone_number || notification.buyer_phone || null;

      // ✅ Build saved item - notification type (after constraint fix)
      const savedItem = {
        user_id: user.id,
        item_type: 'notification',
        product_id: null,
        prospect_id: null,
        product_name: notification.message?.substring(0, 40) || 'Saved Notification',
        product_price: 0,
        product_image: notification.product_image || null,
        seller_location: sender?.location || null,
        seller_phone: phoneNumber,
        prospect_email: null,
        prospect_location: null,
        prospect_phone: null,
        interested_in: null,
        notes: `Notification: ${notification.id}`,
        created_at: new Date().toISOString()
      };

      console.log('📝 Saving:', savedItem);

      const { error } = await supabase
        .from('saved_items')
        .insert([savedItem]);

      if (error) {
        console.error('❌ Save error:', error);
        toast.error('Failed to save');
        setIsSaving(false);
        return;
      }

      toast.success('⭐ Saved to Wishlist!');

    } catch (error) {
      console.error('❌ Error:', error);
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ Handle contact
  const handleContact = (method, phoneNumber, message = '') => {
    if (!phoneNumber) {
      toast.error('No phone number available');
      return;
    }

    const cleanPhone = phoneNumber.replace(/\s/g, '').replace(/^0+/, '');
    
    let url = '';
    switch (method) {
      case 'call':
        url = `tel:+${cleanPhone}`;
        break;
      case 'sms':
        url = `sms:+${cleanPhone}?body=${encodeURIComponent(message)}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        break;
      default:
        return;
    }

    window.open(url, '_blank');
  };

  const handleGoBack = () => {
    const referrer = location.state?.referrer || '/app';
    navigate(referrer);
  };

  // Loading
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!notification) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <div style={{ fontSize: '48px' }}>📭</div>
        <h3>Not found</h3>
        <button onClick={handleGoBack}>← Go Back</button>
      </div>
    );
  }

  const displayPhone = sender?.phone_number || notification.buyer_phone || null;

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto', padding: '16px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '12px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <button onClick={handleGoBack} style={{
          background: 'none',
          border: 'none',
          color: '#007bff',
          fontSize: '16px',
          cursor: 'pointer'
        }}>
          ← Back
        </button>
        <button
          onClick={saveToWishlist}
          disabled={isSaving}
          style={{
            padding: '8px 16px',
            background: isSaving ? '#ccc' : '#ffc107',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: isSaving ? 'not-allowed' : 'pointer'
          }}
        >
          {isSaving ? 'Saving...' : '⭐ Save to Wishlist'}
        </button>
      </div>

      {/* Message */}
      <div style={{
        background: 'black',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>
          {notification.link_type === 'product_search' ? '🔍' :
           notification.link_type === 'new_message' ? '💬' :
           notification.link_type === 'new_order' ? '📦' : '📢'}
        </div>
        <p style={{ fontSize: '16px', margin: 0 , color: '#ffffff' }}>{notification.message}</p>
        <div style={{ fontSize: '12px', color: '#fbfcfd', marginTop: '8px' }}>
          {new Date(notification.created_at).toLocaleString()}
        </div>
      </div>

      {/* ✅ PHONE CONTACT - Shows when phone exists */}
      {displayPhone && (
        <div style={{
          background: '#000000',
          border: '1px solid #bbf7d0',
          borderLeft: '4px solid #25D366',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '16px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '24px' }}>📱</span>
            <div>
              <div style={{ fontWeight: 'bold', color: '#fcfcfc' }}>Contact</div>
              <div style={{ color: '#f1f1f1', fontSize: '14px' }}>{displayPhone}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => handleContact('call', displayPhone)} style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#dcfce7',
              color: '#166534',
              flex: 1,
              justifyContent: 'center',
              minWidth: '80px'
            }}>
              📞 Call
            </button>
            <button onClick={() => handleContact('sms', displayPhone)} style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#dbeafe',
              color: '#1e40af',
              flex: 1,
              justifyContent: 'center',
              minWidth: '80px'
            }}>
              ✉️ SMS
            </button>
            <button onClick={() => handleContact('whatsapp', displayPhone)} style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#dcfce7',
              color: '#075e54',
              flex: 1,
              justifyContent: 'center',
              minWidth: '80px'
            }}>
              💬 WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* Sender */}
      {sender && (
        <div style={{
          background: 'black',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: '#667eea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '24px',
              fontWeight: 'bold'
            }}>
              {sender.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h3 style={{ margin: 0 }}>{sender.username || 'Unknown'}</h3>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                {sender.is_seller && <span style={{ fontSize: '12px', background: '#38495f', padding: '2px 8px', borderRadius: '12px' }}>🏪 Seller</span>}
                {sender.is_buyer && <span style={{ fontSize: '12px', background: '#4c7e5e', padding: '2px 8px', borderRadius: '12px' }}>🛒 Buyer</span>}
              </div>
              {sender.location && (
                <div style={{ fontSize: '14px', color: '#efefef', marginTop: '4px' }}>
                  📍 {sender.location}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Image */}
      {notification.product_image && (
        <div style={{
          background: 'black',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          marginTop: '16px'
        }}>
          <h4 style={{ margin: '0 0 12px 0' }}>📸 Product Image</h4>
          <img 
            src={notification.product_image} 
            alt="Product" 
            style={{
              width: '100%',
              maxWidth: '300px',
              borderRadius: '8px',
              marginTop: '10px'
            }}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Tip */}
      <div style={{
        marginTop: '16px',
        padding: '16px',
        background: '#f0fdf4',
        borderRadius: '10px',
        borderLeft: '4px solid #16a34a'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '20px' }}>💡</span>
          <div style={{ fontSize: '14px', color: '#495057' }}>
            <strong>Tip:</strong> Saved items can be found in your Dashboard under <strong>"Saved Items"</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationDetail;
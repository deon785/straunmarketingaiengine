import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

const NotificationsList = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setNotifications(data);
    setLoading(false);
  };

  const markAsRead = async (id) => {
    await supabase.from('notifications').update({ status: 'read' }).eq('id', id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, status: 'read' } : n));
  };

  if (loading) return <p style={{ color: 'white', textAlign: 'center' }}>Loading...</p>;

  return (
    <div style={{ padding: '20px', color: 'white', maxWidth: '500px', margin: '0 auto' }}>
      <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '10px' }}>📥 Buyer Requests</h3>
      
      {notifications.length === 0 ? (
        <p style={{ color: '#888' }}>No requests yet.</p>
      ) : (
        notifications.map((n) => (
          <div 
            key={n.id} 
            onClick={() => markAsRead(n.id)}
            style={{ 
              background: '#222', 
              padding: '15px', 
              borderRadius: '12px', 
              marginBottom: '15px',
              borderLeft: n.status === 'unread' ? '5px solid #25D366' : '5px solid #444',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            {/* 1. Header: Message & Unread Dot */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ margin: 0, fontWeight: n.status === 'unread' ? 'bold' : 'normal', flex: 1 }}>
                {n.message}
              </p>
              {n.status === 'unread' && (
                <span style={{ backgroundColor: '#25D366', width: '10px', height: '10px', borderRadius: '50%', marginLeft: '10px' }}></span>
              )}
            </div>

            {/* 2. Middle: Product Image & Phone */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
              {n.product_image && (
                <img src={n.product_image} alt="product" style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
              )}
              <div>
                <small style={{ color: '#aaa', display: 'block' }}>Buyer Contact:</small>
                <span style={{ color: '#25D366', fontWeight: 'bold' }}>{n.buyer_phone}</span>
              </div>
            </div>

            {/* 3. Actions: Call & WhatsApp Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); window.open(`tel:${n.buyer_phone}`); }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#3182ce', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                📞 Call
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${n.buyer_phone.replace(/\D/g, '')}`); }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#25D366', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                💬 WhatsApp
              </button>
            </div>

            {/* 4. Footer: Timestamp */}
            <div style={{ marginTop: '10px', textAlign: 'right' }}>
              <small style={{ color: '#666', fontSize: '10px' }}>
                {new Date(n.created_at).toLocaleDateString()} at {new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </small>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default NotificationsList;
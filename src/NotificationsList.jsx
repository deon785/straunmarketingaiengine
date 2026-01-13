import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

const NotificationsList = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel('notifications_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user && payload.new.user_id === user.id) {
              setNotifications(prev => [payload.new, ...prev]);
              setLoading(false);
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
        }
      )
      .subscribe();

    const handlePullToRefresh = () => {
      console.log('🔄 Pull-to-refresh detected in NotificationsList');
      fetchNotifications();
    };
    
    window.addEventListener('pull-to-refresh', handlePullToRefresh);
    
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('pull-to-refresh', handlePullToRefresh);
    };
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

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ status: 'read' })
      .eq('user_id', user.id)
      .eq('status', 'unread');

    setNotifications(notifications.map(n => ({ ...n, status: 'read' })));
  };

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  if (loading) return <p style={{ color: 'white', textAlign: 'center' }}>Loading...</p>;

  return (
    <div style={{ padding: '20px', color: 'white', maxWidth: '500px', margin: '0 auto' }}>
      {/* UPDATED HEADER WITH UNREAD COUNT AND BUTTONS */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid #444', 
        paddingBottom: '10px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h3 style={{ margin: 0 }}>
          📥 Buyer Requests 
          {unreadCount > 0 && (
            <span style={{
              backgroundColor: '#ff4757',
              color: 'white',
              borderRadius: '50%',
              padding: '2px 8px',
              fontSize: '12px',
              marginLeft: '8px',
              fontWeight: 'bold'
            }}>
              {unreadCount} new
            </span>
          )}
        </h3>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead}
              style={{
                background: '#4361ee',
                color: 'white',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>✓</span> Mark All Read
            </button>
          )}
          <button 
            onClick={fetchNotifications}
            style={{
              background: '#333',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🔄</span> Refresh
          </button>
        </div>
      </div>
      
      {notifications.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: '#888'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>
            📭
          </div>
          <h4 style={{ color: '#ccc', marginBottom: '10px' }}>
            No buyer requests yet
          </h4>
          <p>When buyers show interest in your products, you'll see notifications here.</p>
        </div>
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
              position: 'relative',
              transition: 'all 0.2s ease',
              ':hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }
            }}
          >
            {/* 1. Header: Message & Unread Dot */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ 
                margin: 0, 
                fontWeight: n.status === 'unread' ? 'bold' : 'normal', 
                flex: 1,
                color: n.status === 'unread' ? '#fff' : '#ccc'
              }}>
                {n.message}
              </p>
              {n.status === 'unread' && (
                <span style={{ 
                  backgroundColor: '#25D366', 
                  width: '10px', 
                  height: '10px', 
                  borderRadius: '50%', 
                  marginLeft: '10px',
                  flexShrink: 0
                }}></span>
              )}
            </div>

            {/* 2. Middle: Product Image & Phone */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
              {n.product_image && (
                <img 
                  src={n.product_image} 
                  alt="product" 
                  style={{ 
                    width: '60px', 
                    height: '60px', 
                    borderRadius: '8px', 
                    objectFit: 'cover',
                    border: '2px solid #333'
                  }} 
                />
              )}
              <div>
                <small style={{ color: '#aaa', display: 'block' }}>Buyer Contact:</small>
                <span style={{ color: '#25D366', fontWeight: 'bold', fontSize: '16px' }}>
                  {n.buyer_phone}
                </span>
              </div>
            </div>

            {/* 3. Actions: Call & WhatsApp Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  window.open(`tel:${n.buyer_phone}`);
                }}
                style={{ 
                  flex: 1, 
                  padding: '10px', 
                  borderRadius: '8px', 
                  backgroundColor: '#3182ce', 
                  color: 'white', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                📞 Call
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  window.open(`https://wa.me/${n.buyer_phone.replace(/\D/g, '')}`);
                }}
                style={{ 
                  flex: 1, 
                  padding: '10px', 
                  borderRadius: '8px', 
                  backgroundColor: '#25D366', 
                  color: 'white', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                💬 WhatsApp
              </button>
            </div>

            {/* 4. Footer: Timestamp & Status */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '15px', 
              paddingTop: '10px',
              borderTop: '1px solid #333'
            }}>
              <small style={{ color: '#666', fontSize: '11px' }}>
                {new Date(n.created_at).toLocaleDateString()} • {new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </small>
              <span style={{
                background: n.status === 'unread' ? '#25D366' : '#666',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: 'bold'
              }}>
                {n.status === 'unread' ? 'NEW' : 'READ'}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default NotificationsList;
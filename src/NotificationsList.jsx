import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

const NotificationsList = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null); // For expanded view on mobile

  // Function to send push notification
  const sendPushNotification = async (notification) => {
    try {
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', notification.user_id);
      
      if (error || !subscriptions || subscriptions.length === 0) {
        console.log('No push subscriptions found for user');
        return;
      }
      
      for (const sub of subscriptions) {
        await fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: sub.subscription,
            title: 'New Buyer Request!',
            body: notification.message,
            url: window.location.origin,
            icon: '/pwa-192x192.png'
          })
        });
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  };

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
        async (payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && payload.new.user_id === user.id) {
            setNotifications(prev => [payload.new, ...prev]);
            setLoading(false);
            
            if (payload.new.status === 'unread') {
              sendPushNotification(payload.new);
            }
          }
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

  if (loading) return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '400px',
      color: '#666'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
        <p>Loading notifications...</p>
      </div>
    </div>
  );

  return (
    <div style={{
      padding: '30px 20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh'
    }}>
      {/* MAIN CONTAINER - MUCH LARGER AND RESPONSIVE */}
      <div style={{
        maxWidth: '1200px',  // CHANGED: from 500px to 1200px (more than double!)
        margin: '0 auto',
        background: '#1a1a2e',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        
        {/* HEADER SECTION - ENLARGED */}
        <div style={{
          background: 'linear-gradient(135deg, #16213e 0%, #0f3460 100%)',
          padding: '25px 30px',
          borderBottom: '2px solid #e94560'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px'
          }}>
            <div>
              <h2 style={{
                margin: 0,
                color: 'white',
                fontSize: '28px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '32px' }}>🔔</span>
                Buyer Requests
                {unreadCount > 0 && (
                  <span style={{
                    background: '#e94560',
                    color: 'white',
                    borderRadius: '30px',
                    padding: '5px 15px',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}>
                    {unreadCount} New
                  </span>
                )}
              </h2>
              <p style={{ margin: '8px 0 0 0', color: '#a0a0a0', fontSize: '14px' }}>
                Customer inquiries and purchase requests
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  style={{
                    background: '#e94560',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <span>✓</span> Mark All Read
                </button>
              )}
              <button 
                onClick={fetchNotifications}
                style={{
                  background: '#2a2a4a',
                  color: 'white',
                  border: '1px solid #4a4a6a',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <span>🔄</span> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* NOTIFICATIONS LIST - ENLARGED CARDS */}
        <div style={{ padding: '30px' }}>
          {notifications.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '80px 40px',
              background: '#16213e',
              borderRadius: '16px'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>
                📭
              </div>
              <h3 style={{ color: '#fff', marginBottom: '10px', fontSize: '24px' }}>
                No buyer requests yet
              </h3>
              <p style={{ color: '#888', fontSize: '16px', maxWidth: '400px', margin: '0 auto' }}>
                When buyers show interest in your products, you'll see notifications here with their contact details.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  style={{
                    background: '#16213e',
                    borderRadius: '16px',
                    borderLeft: n.status === 'unread' ? `6px solid #25D366` : `6px solid #4a4a6a`,
                    transition: 'all 0.3s ease',
                    overflow: 'hidden'
                  }}
                >
                  <div 
                    onClick={() => {
                      if (n.status === 'unread') markAsRead(n.id);
                      setExpandedId(expandedId === n.id ? null : n.id);
                    }}
                    style={{
                      padding: '25px',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#1a1a3e'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#16213e'}
                  >
                    {/* Header Row */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '15px',
                      marginBottom: '15px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          flexWrap: 'wrap',
                          marginBottom: '8px'
                        }}>
                          <span style={{
                            background: n.status === 'unread' ? '#25D366' : '#4a4a6a',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: 'white'
                          }}>
                            {n.status === 'unread' ? '🟢 NEW REQUEST' : '📖 READ'}
                          </span>
                          <span style={{ color: '#888', fontSize: '13px' }}>
                            {new Date(n.created_at).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })} at {new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <p style={{
                          margin: 0,
                          color: '#fff',
                          fontSize: '18px',
                          lineHeight: '1.5',
                          fontWeight: n.status === 'unread' ? '600' : '400'
                        }}>
                          {n.message}
                        </p>
                      </div>
                      <div style={{ color: '#888', fontSize: '20px' }}>
                        {expandedId === n.id ? '▲' : '▼'}
                      </div>
                    </div>

                    {/* Quick Info Row (always visible) */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '20px',
                      marginTop: '15px',
                      paddingTop: '15px',
                      borderTop: '1px solid #2a2a4a'
                    }}>
                      {n.product_image && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img 
                            src={n.product_image} 
                            alt="product" 
                            style={{
                              width: '50px',
                              height: '50px',
                              borderRadius: '8px',
                              objectFit: 'cover',
                              border: '2px solid #4a4a6a'
                            }} 
                          />
                          <span style={{ color: '#ccc', fontSize: '13px' }}>Product Image</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '20px' }}>📞</span>
                        <div>
                          <div style={{ color: '#888', fontSize: '11px' }}>Buyer Phone</div>
                          <div style={{ color: '#25D366', fontWeight: 'bold', fontSize: '16px' }}>
                            {n.buyer_phone}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* EXPANDED ACTION BUTTONS SECTION */}
                  {expandedId === n.id && (
                    <div style={{
                      padding: '25px',
                      background: '#0f0f2a',
                      borderTop: '1px solid #2a2a4a'
                    }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '15px',
                        marginBottom: '20px'
                      }}>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            window.open(`tel:${n.buyer_phone}`);
                          }}
                          style={{
                            padding: '14px',
                            borderRadius: '10px',
                            background: '#3182ce',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            transition: 'transform 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          📞 Call Now
                        </button>
                        
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            window.open(`https://wa.me/${n.buyer_phone.replace(/\D/g, '')}`);
                          }}
                          style={{
                            padding: '14px',
                            borderRadius: '10px',
                            background: '#25D366',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            transition: 'transform 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          💬 WhatsApp Message
                        </button>

                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            navigator.clipboard.writeText(n.buyer_phone);
                            alert('Phone number copied!');
                          }}
                          style={{
                            padding: '14px',
                            borderRadius: '10px',
                            background: '#4a4a6a',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            transition: 'transform 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          📋 Copy Number
                        </button>
                      </div>
                      
                      <div style={{
                        background: '#1a1a3e',
                        padding: '15px',
                        borderRadius: '10px',
                        marginTop: '10px'
                      }}>
                        <p style={{ margin: 0, color: '#ccc', fontSize: '14px', lineHeight: '1.6' }}>
                          💡 <strong>Pro tip:</strong> Click the WhatsApp button to instantly message this buyer. 
                          Introduce yourself and share product details to close the sale faster!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER STATS */}
        {notifications.length > 0 && (
          <div style={{
            background: '#0f0f2a',
            padding: '20px 30px',
            borderTop: '1px solid #2a2a4a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <div style={{ color: '#888', fontSize: '14px' }}>
              📊 Total requests: <strong style={{ color: '#fff' }}>{notifications.length}</strong>
            </div>
            <div style={{ color: '#888', fontSize: '14px' }}>
              ✅ {notifications.filter(n => n.status === 'read').length} processed
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsList;
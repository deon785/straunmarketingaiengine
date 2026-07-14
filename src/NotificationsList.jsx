import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabase'; 

// ✅ Add fetchWithRetry helper
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

const NotificationsList = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState(null);

  // ✅ Function to send push notification with fetchWithRetry
  const sendPushNotification = useCallback(async (notification) => {
    if (!notification?.user_id) return;
    
    try {
      // ✅ Use fetchWithRetry
      const result = await fetchWithRetry(() => supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', notification.user_id)
      );
      
      if (result.error) {
        console.error('Error fetching push subscriptions:', result.error);
        return;
      }
      
      const subscriptions = result.data || [];
      if (subscriptions.length === 0) {
        console.log('No push subscriptions found for user');
        return;
      }
      
      // ✅ Dynamic title based on notification type
      const title = notification.link_type === 'buyer' 
        ? 'New Buyer Request!' 
        : notification.link_type === 'seller'
        ? 'New Seller Message!'
        : 'New Notification!';
      
      for (const sub of subscriptions) {
        try {
          await fetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: sub.subscription,
              title: title,
              body: notification.message || 'New notification',
              url: window.location.origin,
              icon: '/pwa-192x192.png'
            })
          });
        } catch (fetchErr) {
          console.error('Error sending individual push:', fetchErr);
        }
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }, []);

  // ✅ Use fetchWithRetry with offline check
  const fetchNotifications = useCallback(async () => {
    // ✅ Check offline status
    if (!navigator.onLine) {
      setError('You are offline. Please connect to the internet to view notifications.');
      setLoading(false);
      return;
    }
    
    setError(null);
    
    try {
      // ✅ Use fetchWithRetry
      const userResult = await fetchWithRetry(() => supabase.auth.getUser());
      const user = userResult.data?.user;
      
      if (!user) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      // ✅ Use fetchWithRetry
      const result = await fetchWithRetry(() => supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      );

      if (result.error) {
        console.error('Error fetching notifications:', result.error);
        setError('Failed to load notifications');
        setNotifications([]);
      } else {
        setNotifications(result.data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching notifications:', err);
      setError('Unable to load notifications');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    let channel = null;
    
    try {
      channel = supabase
        .channel('notifications_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
          },
          async (payload) => {
            try {
              const userResult = await supabase.auth.getUser();
              const user = userResult.data?.user;
              
              if (user && payload.new && payload.new.user_id === user.id) {
                setNotifications(prev => [payload.new, ...prev]);
                setLoading(false);
                
                if (payload.new.status === 'unread') {
                  sendPushNotification(payload.new);
                }
              }
            } catch (err) {
              console.error('Error handling new notification:', err);
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
            if (payload.old) {
              setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Notification channel error:', err);
          }
        });
    } catch (err) {
      console.error('Failed to create notification channel:', err);
    }

    const handlePullToRefresh = () => {
      console.log('🔄 Pull-to-refresh detected in NotificationsList');
      fetchNotifications();
    };
    
    window.addEventListener('pull-to-refresh', handlePullToRefresh);
    
    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (err) {
          console.error('Error removing channel:', err);
        }
      }
      window.removeEventListener('pull-to-refresh', handlePullToRefresh);
    };
  }, [fetchNotifications, sendPushNotification]);

  // ✅ Use fetchWithRetry
  const markAsRead = useCallback(async (id) => {
    if (!id) return;
    
    try {
      // ✅ Use fetchWithRetry
      const result = await fetchWithRetry(() => supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('id', id)
      );

      if (result.error) {
        console.error('Error marking as read:', result.error);
      } else {
        setNotifications(prev => prev.map(n => 
          n.id === id ? { ...n, status: 'read' } : n
        ));
      }
    } catch (err) {
      console.error('Error in markAsRead:', err);
    }
  }, []);

  // ✅ Use fetchWithRetry
  const markAllAsRead = useCallback(async () => {
    try {
      // ✅ Use fetchWithRetry
      const userResult = await fetchWithRetry(() => supabase.auth.getUser());
      const user = userResult.data?.user;
      
      if (!user) return;

      // ✅ Use fetchWithRetry
      const result = await fetchWithRetry(() => supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('user_id', user.id)
        .eq('status', 'unread')
      );

      if (result.error) {
        console.error('Error marking all as read:', result.error);
      } else {
        setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
      }
    } catch (err) {
      console.error('Error in markAllAsRead:', err);
    }
  }, []);

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        color: '#666'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 15px auto'
          }} />
          <p>Loading notifications...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '30px 20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh'
    }}>
      {/* MAIN CONTAINER */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: '#1a1a2e',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        
        {/* ✅ Enhanced Error Message with Retry Button */}
        {error && (
          <div style={{
            background: '#ff4444',
            color: 'white',
            padding: '12px 20px',
            margin: '20px',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <span>⚠️ {error}</span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => {
                  setError(null);
                  fetchNotifications();
                }}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid white',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                🔄 Retry
              </button>
              <button 
                onClick={() => setError(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 'bold'
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}
        
        {/* HEADER SECTION */}
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

        {/* NOTIFICATIONS LIST */}
        <div style={{ padding: '30px' }}>
          {notifications.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '80px 40px',
              background: '#16213e',
              borderRadius: '16px'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>📭</div>
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
                            {n.created_at ? new Date(n.created_at).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }) : 'Unknown date'} at {n.created_at ? new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown time'}
                          </span>
                        </div>
                        <p style={{
                          margin: 0,
                          color: '#fff',
                          fontSize: '18px',
                          lineHeight: '1.5',
                          fontWeight: n.status === 'unread' ? '600' : '400'
                        }}>
                          {n.message || 'No message content'}
                        </p>
                      </div>
                      <div style={{ color: '#888', fontSize: '20px' }}>
                        {expandedId === n.id ? '▲' : '▼'}
                      </div>
                    </div>

                    {/* Quick Info Row */}
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
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <span style={{ color: '#ccc', fontSize: '13px' }}>Product Image</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '20px' }}>📞</span>
                        <div>
                          <div style={{ color: '#888', fontSize: '11px' }}>Buyer Phone</div>
                          <div style={{ color: '#25D366', fontWeight: 'bold', fontSize: '16px' }}>
                            {n.buyer_phone || 'No phone number'}
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
                            if (n.buyer_phone) {
                              window.open(`tel:${n.buyer_phone}`);
                            } else {
                              alert('No phone number available');
                            }
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
                            if (n.buyer_phone) {
                              const cleanNumber = n.buyer_phone.replace(/\D/g, '');
                              window.open(`https://wa.me/${cleanNumber}`);
                            } else {
                              alert('No phone number available');
                            }
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
                            if (n.buyer_phone) {
                              navigator.clipboard.writeText(n.buyer_phone);
                              alert('Phone number copied!');
                            } else {
                              alert('No phone number to copy');
                            }
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

export default React.memo(NotificationsList);
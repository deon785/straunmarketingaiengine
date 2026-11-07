import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthState } from './AuthContext';
import { toast } from 'react-hot-toast';

const NotificationsList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthState();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const processedIds = useRef(new Set());

  const referrer = location.state?.referrer || '/app';

  // ✅ Fetch ALL notifications
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('id, user_id, sender_id, message, link_type, is_read, created_at, buyer_phone, product_image')
        .eq('user_id', user.id)
        // ❌ REMOVED .eq('is_read', false) so we get old ones too
        .order('created_at', { ascending: false }); // Newest first

      if (fetchError) throw fetchError;
      
      // ✅ SORT: Unread first, then Read
      const sortedData = (data || []).sort((a, b) => {
        if (a.is_read === b.is_read) return 0;
        return a.is_read ? 1 : -1; // Unread (false) comes before Read (true)
      });
      
      setNotifications(sortedData);

    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // ✅ Handle notification click
  const handleNotificationClick = async (notification) => {
    if (processedIds.current.has(notification.id)) return;
    processedIds.current.add(notification.id);

    // 1. Mark THIS specific notification as read in the database
    if (!notification.is_read) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notification.id)
          .eq('user_id', user.id);

        // 2. Update the UI state (move it to the read section)
        setNotifications(prev => {
            const updated = prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n);
            // Re-sort so the newly read item moves down
            return updated.sort((a, b) => {
                if (a.is_read === b.is_read) return 0;
                return a.is_read ? 1 : -1;
            });
        });
    }

    // 3. Navigate to the details page
    navigate(`/notification/${notification.id}`, {
      state: { 
        referrer: '/notifications',
        notification: notification 
      }
    });
  };

  // ✅ Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ✅ Real-time subscription (FIXED for React Strict Mode)
  useEffect(() => {
    if (!user?.id) return;

    // 1. Generate a unique channel name using timestamp to prevent Strict Mode collisions
    const channelId = `notifications-${user.id}-${Date.now()}`;
    
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (!payload.new.is_read) {
            setNotifications(prev => [payload.new, ...prev]);
            toast.success('New notification!', { icon: '🔔' });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime connected for channel: ${channelId}`);
        }
      });

    return () => {
      // 2. Ensure we fully remove the channel on unmount to prevent leaks
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  // ✅ Go back
  const handleGoBack = () => {
    navigate(referrer);
  };

  // ✅ Loading state
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div className="loading-spinner" />
        <p style={{ color: '#6c757d', marginTop: '16px' }}>Loading notifications...</p>
      </div>
    );
  }

  // ✅ Empty state
  if (notifications.length === 0) {
    return (
      <div style={{ maxWidth: '650px', margin: '0 auto', padding: '16px' }}>
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={handleGoBack}
            style={{
              background: 'none', border: 'none', color: '#007bff',
              fontSize: '16px', cursor: 'pointer', padding: '8px 12px',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            ← Back
          </button>
        </div>
        
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📭</div>
          <h3 style={{ margin: 0, color: '#333' }}>All caught up!</h3>
          <p style={{ color: '#6c757d', marginTop: '8px' }}>
            You have no unread notifications
          </p>
          <button
            onClick={fetchNotifications}
            style={{
              marginTop: '16px', padding: '8px 16px',
              backgroundColor: '#007bff', color: 'white',
              border: 'none', borderRadius: '6px', cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    );
  }

  // ✅ Render notifications
  return (
    <div style={{ maxWidth: '650px', margin: '0 auto', padding: '16px' }}>
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={handleGoBack}
          style={{
            background: 'none', border: 'none', color: '#007bff',
            fontSize: '16px', cursor: 'pointer', padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          ← Back
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>📬 Notifications ({notifications.length})</h2>
        <button
          onClick={fetchNotifications}
          style={{
            padding: '6px 12px', backgroundColor: 'transparent',
            border: '1px solid #6c757d', borderRadius: '6px',
            cursor: 'pointer', fontSize: '12px'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
          ⚠️ {error}
        </div>
      )}

      {notifications.map((notification) => (
        <div
          key={notification.id}
          onClick={() => handleNotificationClick(notification)}
          style={{
            padding: '16px', marginBottom: '10px', borderRadius: '10px',
            // ✅ Unread is white/blueish, Read is grey
            backgroundColor: notification.is_read ? '#f8f9fa' : '#e0e7ff',
            cursor: 'pointer', border: '1px solid #e9ecef',
            transition: 'all 0.2s', position: 'relative',
            opacity: notification.is_read ? 0.7 : 1 // ✅ Slight fade for read items
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateX(4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateX(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ fontSize: '28px', flexShrink: 0 }}>
              {notification.link_type === 'product_search' ? '🔍' :
               notification.link_type === 'new_message' ? '💬' :
               notification.link_type === 'new_order' ? '📦' :
               notification.link_type === 'product_interest' ? '👀' : '📢'}
            </div>
            
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontWeight: notification.is_read ? '400' : '700', // Bold if unread
                marginBottom: '4px', fontSize: '15px', color: '#333' 
              }}>
                {notification.message || 'New notification'}
              </div>
              <div style={{ fontSize: '12px', color: '#adb5bd' }}>
                {new Date(notification.created_at).toLocaleString()}
              </div>
              {notification.buyer_phone && (
                <div style={{ fontSize: '12px', color: '#000000', marginTop: '4px' }}>
                  📱 Phone: {notification.buyer_phone}
                </div>
              )}
            </div>
            
            {/* ✅ Only show the blue dot if it is UNREAD */}
            {!notification.is_read && (
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                backgroundColor: '#007bff', flexShrink: 0, marginTop: '6px',
                animation: 'pulse 2s infinite'
              }} />
            )}
          </div>
        </div>
      ))}

      <style>{`
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        .loading-spinner {
          width: 40px; height: 40px; border: 4px solid #e9ecef;
          border-top: 4px solid #007bff; border-radius: 50%;
          animation: spin 1s linear infinite; margin: 0 auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default React.memo(NotificationsList);
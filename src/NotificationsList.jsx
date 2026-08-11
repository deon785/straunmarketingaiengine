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

  // ✅ Fetch notifications - Using ONLY existing columns
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
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setNotifications(data || []);

    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // ✅ Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ✅ Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  // ✅ Handle notification click
  const handleNotificationClick = useCallback((notification) => {
    if (processedIds.current.has(notification.id)) return;
    processedIds.current.add(notification.id);

    navigate(`/notification/${notification.id}`, {
      state: { 
        referrer: '/notifications',
        notification: notification 
      }
    });
  }, [navigate]);

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
              background: 'none',
              border: 'none',
              color: '#007bff',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
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
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
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
            background: 'none',
            border: 'none',
            color: '#007bff',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ← Back
        </button>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h2 style={{ margin: 0 }}>📬 Notifications ({notifications.length})</h2>
        <button
          onClick={fetchNotifications}
          style={{
            padding: '6px 12px',
            backgroundColor: 'transparent',
            border: '1px solid #6c757d',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div style={{
          background: '#fee2e2',
          color: '#dc2626',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {notifications.map((notification) => (
        <div
          key={notification.id}
          onClick={() => handleNotificationClick(notification)}
          style={{
            padding: '16px',
            marginBottom: '10px',
            borderRadius: '10px',
            backgroundColor: '#f8f9fa',
            cursor: 'pointer',
            border: '1px solid #e9ecef',
            transition: 'all 0.2s',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e9ecef';
            e.currentTarget.style.transform = 'translateX(4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
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
                fontWeight: '500', 
                marginBottom: '4px', 
                fontSize: '15px',
                color: '#333'
              }}>
                {notification.message || 'New notification'}
              </div>
              <div style={{ fontSize: '12px', color: '#adb5bd' }}>
                {new Date(notification.created_at).toLocaleString()}
              </div>
              {notification.buyer_phone && (
                <div style={{ fontSize: '12px', color: '#25D366', marginTop: '4px' }}>
                  📱 Phone: {notification.buyer_phone}
                </div>
              )}
            </div>
            
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#007bff',
              flexShrink: 0,
              marginTop: '6px',
              animation: 'pulse 2s infinite'
            }} />
          </div>
        </div>
      ))}

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
        
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e9ecef;
          border-top: 4px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default React.memo(NotificationsList);
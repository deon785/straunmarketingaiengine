import { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { userMonitor } from './userBehaviorMonitor';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export function SuspiciousActivityMonitor() {
    const [suspiciousUsers, setSuspiciousUsers] = useState([]);
    const [refresh, setRefresh] = useState(0);
    
    useEffect(() => {
        const interval = setInterval(() => {
            const users = userMonitor.getSuspiciousUsers(10); // Last 10 minutes
            setSuspiciousUsers(users);
        }, 10000); // Update every 10 seconds
        
        return () => clearInterval(interval);
    }, [refresh]);
    
    const handleBlockUser = (userId, minutes = 30) => {
        userMonitor.temporaryBlock(userId, minutes);
        setRefresh(prev => prev + 1);
    };
    
    return (
        <div style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            background: '#1a1a1a',
            color: 'white',
            padding: '10px',
            borderRadius: '8px',
            maxWidth: '300px',
            fontSize: '12px',
            zIndex: 9999
        }}>
            <h4>Activity Monitor</h4>
            {suspiciousUsers.length === 0 ? (
                <p>✅ No suspicious activity</p>
            ) : (
                <div>
                    <p>⚠️ {suspiciousUsers.length} suspicious user(s)</p>
                    {suspiciousUsers.map(user => (
                        <div key={user.userId} style={{
                            margin: '5px 0',
                            padding: '5px',
                            background: '#333',
                            borderRadius: '4px'
                        }}>
                            <p>User: {user.userId.substring(0, 8)}...</p>
                            <p>Score: {user.score}</p>
                            <button onClick={() => handleBlockUser(user.userId)}>
                                Block 30min
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const AdminDashboard = () => {
  const [stats, setStats] = useState({ 
    users: 0, 
    feedback: [], 
    products: [],
    recentUsers: [],
    userActivity: [],
    bannedUsers: [],
    dailyStats: [],
    topProducts: []
  });
  
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [realtimeData, setRealtimeData] = useState({
    onlineUsers: 0,
    recentActivities: []
  });

  // Real-time subscription
  useEffect(() => {
    // Subscribe to new activities
    const activitiesChannel = supabase
      .channel('admin-activities')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activities'
        },
        (payload) => {
          setRealtimeData(prev => ({
            ...prev,
            recentActivities: [payload.new, ...prev.recentActivities.slice(0, 9)]
          }));
        }
      )
      .subscribe();

    // Subscribe to new users
    const usersChannel = supabase
      .channel('admin-users')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    // Subscribe to new reports
    const reportsChannel = supabase
      .channel('admin-reports')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reports'
        },
        () => {
          fetchReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activitiesChannel);
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(reportsChannel);
    };
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch all data in parallel
      const [
        { count: userCount },
        { data: recentUsers },
        { data: userActivity },
        { data: feedbackData },
        { data: productsData },
        { data: bannedUsers },
        { data: dailyStats },
        { data: topProducts }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase
          .from('profiles')
          .select('user_id, username, email, location, created_at, last_sign_in_at, last_activity_at, total_searches, total_contacts')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('user_activities')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('feedback').select('*').order('created_at', { ascending: false }),
        supabase
          .from('products')
          .select('id, name, price, views, created_at, seller_id, profiles(username)')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('user_id, username, email, banned_at, banned_reason')
          .eq('banned', true)
          .order('banned_at', { ascending: false }),
        supabase
          .from('daily_stats')
          .select('*')
          .order('date', { ascending: false })
          .limit(30),
        supabase
          .from('products')
          .select('id, name, price, views, created_at, seller_id, profiles(username)')
          .order('views', { ascending: false })
          .limit(10)
      ]);

      // Calculate online users (active in last 15 minutes)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: activeUsers } = await supabase
        .from('profiles')
        .select('user_id')
        .gte('last_activity_at', fifteenMinutesAgo);

      setStats({
        users: userCount || 0,
        feedback: feedbackData || [],
        products: productsData || [],
        recentUsers: recentUsers || [],
        userActivity: userActivity || [],
        bannedUsers: bannedUsers || [],
        dailyStats: dailyStats || [],
        topProducts: topProducts || []
      });

      setRealtimeData(prev => ({
        ...prev,
        onlineUsers: activeUsers?.length || 0,
        recentActivities: userActivity?.slice(0, 10) || []
      }));

    } catch (error) {
      console.error("Error loading admin data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    const { data } = await supabase
      .from('reports')
      .select(`
        *,
        reporter:reporter_id (email),
        reported_user:reported_user_id (email)
      `)
      .order('created_at', { ascending: false });
    
    setReports(data || []);
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchReports();
  }, [fetchDashboardData, fetchReports]);

  // Chart Data Functions
  const getUserGrowthData = () => {
    const last7Days = stats.dailyStats.slice(0, 7).reverse();
    
    return {
      labels: last7Days.map(day => {
        const date = new Date(day.date);
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      }),
      datasets: [
        {
          label: 'Active Users',
          data: last7Days.map(day => day.active_users || 0),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Total Activities',
          data: last7Days.map(day => day.total_activities || 0),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    };
  };

  const getActivityDistributionData = () => {
    const activities = stats.userActivity || [];
    const activityCounts = {
      search: activities.filter(a => a.action_type === 'search').length,
      contact: activities.filter(a => a.action_type === 'contact').length,
      view_product: activities.filter(a => a.action_type === 'view_product').length,
      save_wishlist: activities.filter(a => a.action_type === 'save_wishlist').length,
      other: activities.filter(a => !['search', 'contact', 'view_product', 'save_wishlist'].includes(a.action_type)).length
    };

    return {
      labels: ['Searches', 'Contacts', 'Product Views', 'Wishlist Saves', 'Other'],
      datasets: [
        {
          data: Object.values(activityCounts),
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(107, 114, 128, 0.8)'
          ],
          borderColor: [
            'rgb(59, 130, 246)',
            'rgb(16, 185, 129)',
            'rgb(245, 158, 11)',
            'rgb(139, 92, 246)',
            'rgb(107, 114, 128)'
          ],
          borderWidth: 2
        }
      ]
    };
  };

  const getTopProductsData = () => {
    const top5 = stats.topProducts.slice(0, 5);
    
    return {
      labels: top5.map(p => p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name),
      datasets: [
        {
          label: 'Views',
          data: top5.map(p => p.views || 0),
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1
        }
      ]
    };
  };

  const handleBanUser = async (userId, reason) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          banned: true,
          banned_at: new Date().toISOString(),
          banned_reason: reason
        })
        .eq('user_id', userId);
      
      if (error) throw error;
      
      // Refresh data
      const { data: bannedUsers } = await supabase
        .from('profiles')
        .select('user_id, username, email, banned_at, banned_reason')
        .eq('banned', true)
        .order('banned_at', { ascending: false });
      
      setStats(prev => ({ ...prev, bannedUsers: bannedUsers || [] }));
      alert('User banned successfully');
      
    } catch (error) {
      console.error('Error banning user:', error);
      alert('Error banning user');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      
      if (error) throw error;
      
      // Refresh products
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      setStats(prev => ({ ...prev, products: productsData || [] }));
      alert('Product deleted successfully');
      
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error deleting product');
    }
  };

  const handleResolveReport = async (reportId, action, reportedUserId) => {
    try {
      if (action === 'ban' && reportedUserId) {
        const { error: banError } = await supabase
          .from('profiles')
          .update({ banned: true })
          .eq('user_id', reportedUserId);
        
        if (banError) throw banError;
      }
      
      const { error: updateError } = await supabase
        .from('reports')
        .update({ status: 'resolved' })
        .eq('id', reportId);
      
      if (updateError) throw updateError;
      
      fetchReports();
      alert('Report resolved successfully.');
      
    } catch (error) {
      console.error('Error in handleResolveReport:', error);
      alert('An unexpected error occurred.');
    }
  };

  const handleDismissReport = async (reportId) => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: 'dismissed' })
        .eq('id', reportId);
      
      if (error) throw error;
      
      fetchReports();
      alert('Report dismissed.');
      
    } catch (error) {
      console.error('Error dismissing report:', error);
      alert('Error dismissing report.');
    }
  };

  if (loading) return <div style={{ padding: '40px', color: '#000', textAlign: 'center' }}>Loading Dashboard Data...</div>;

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1400px', 
      margin: '0 auto', 
      fontFamily: 'sans-serif',
      color: '#000',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>
      
      {/* Header with Real-time Stats */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '2px solid #e9ecef'
      }}>
        <div>
          <h1 style={{ color: '#000', margin: 0 }}>Admin Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                background: '#10b981',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }}></div>
              <span style={{ fontSize: '14px', color: '#6c757d' }}>
                🟢 {realtimeData.onlineUsers} Users Online
              </span>
            </div>
            <span style={{ fontSize: '14px', color: '#6c757d' }}>
              📊 {stats.userActivity.length} Activities Today
            </span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setActiveTab('overview')}
            style={{ 
              padding: '8px 16px',
              background: activeTab === 'overview' ? '#0d6efd' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            style={{ 
              padding: '8px 16px',
              background: activeTab === 'users' ? '#0d6efd' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Users
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            style={{ 
              padding: '8px 16px',
              background: activeTab === 'reports' ? '#0d6efd' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Reports ({reports.filter(r => r.status === 'pending').length})
          </button>
          <button 
            onClick={() => setActiveTab('products')}
            style={{ 
              padding: '8px 16px',
              background: activeTab === 'products' ? '#0d6efd' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Products
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            style={{ 
              padding: '8px 16px',
              background: activeTab === 'analytics' ? '#0d6efd' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              borderLeft: '4px solid #0d6efd'
            }}>
              <h3 style={{ color: '#6c757d', margin: '0 0 10px 0', fontSize: '14px' }}>Total Users</h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#000' }}>{stats.users}</p>
              <p style={{ fontSize: '12px', color: '#28a745', marginTop: '5px' }}>
                {stats.recentUsers.length} new in last 24h
              </p>
            </div>

            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              borderLeft: '4px solid #28a745'
            }}>
              <h3 style={{ color: '#6c757d', margin: '0 0 10px 0', fontSize: '14px' }}>Active Products</h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#000' }}>{stats.products.length}</p>
              <p style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Listed by {new Set(stats.products.map(p => p.seller_id)).size} sellers
              </p>
            </div>

            <div style={{ 
              background: reports.filter(r => r.status === 'pending').length > 0 ? '#fff3cd' : 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              borderLeft: reports.filter(r => r.status === 'pending').length > 0 ? '4px solid #ffc107' : '4px solid #dc3545'
            }}>
              <h3 style={{ color: '#6c757d', margin: '0 0 10px 0', fontSize: '14px' }}>Pending Reports</h3>
              <p style={{ 
                fontSize: '32px', 
                fontWeight: 'bold', 
                margin: 0, 
                color: reports.filter(r => r.status === 'pending').length > 0 ? '#dc3545' : '#000' 
              }}>
                {reports.filter(r => r.status === 'pending').length}
              </p>
              {reports.filter(r => r.status === 'pending').length > 0 && (
                <p style={{ fontSize: '12px', color: '#dc3545', marginTop: '5px' }}>
                  ⚠️ Needs immediate attention
                </p>
              )}
            </div>

            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              borderLeft: '4px solid #6f42c1'
            }}>
              <h3 style={{ color: '#6c757d', margin: '0 0 10px 0', fontSize: '14px' }}>Banned Users</h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#000' }}>{stats.bannedUsers.length}</p>
              <p style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Last ban: {stats.bannedUsers[0] ? new Date(stats.bannedUsers[0].banned_at).toLocaleDateString() : 'None'}
              </p>
            </div>
          </div>

          {/* Charts Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '30px' }}>
            {/* User Growth Chart */}
            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#000', margin: '0 0 15px 0' }}>📈 User Activity (Last 7 Days)</h3>
              <div style={{ height: '300px' }}>
                <Line 
                  data={getUserGrowthData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                        labels: {
                          color: '#000'
                        }
                      }
                    },
                    scales: {
                      x: {
                        grid: {
                          color: 'rgba(0,0,0,0.05)'
                        }
                      },
                      y: {
                        grid: {
                          color: 'rgba(0,0,0,0.05)'
                        },
                        beginAtZero: true
                      }
                    }
                  }}
                />
              </div>
            </div>
            
            {/* Activity Distribution Chart */}
            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#000', margin: '0 0 15px 0' }}>📊 Activity Distribution</h3>
              <div style={{ height: '300px' }}>
                <Doughnut 
                  data={getActivityDistributionData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          color: '#000',
                          padding: 20
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Recent Activity Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            {/* Recent Signups */}
            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#000', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                👤 Recent Signups ({stats.recentUsers.length})
              </h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {stats.recentUsers.map(user => (
                  <div key={user.user_id} style={{ 
                    padding: '10px',
                    borderBottom: '1px solid #e9ecef',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background-color 0.2s'
                  }}>
                    <div>
                      <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#000' }}>
                        {user.username || user.user_id.substring(0, 8)}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6c757d' }}>
                        {user.location || 'No location'} • {new Date(user.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleBanUser(user.user_id, 'Admin decision')}
                      style={{ 
                        padding: '4px 12px',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
                    >
                      Ban
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Products */}
            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#000', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                🏆 Top Products
              </h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {stats.topProducts.slice(0, 10).map(product => (
                  <div key={product.id} style={{ 
                    padding: '10px',
                    borderBottom: '1px solid #e9ecef',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background-color 0.2s'
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#000' }}>
                        {product.name}
                      </p>
                      <div style={{ display: 'flex', gap: '15px', fontSize: '12px', color: '#6c757d' }}>
                        <span>${product.price}</span>
                        <span>Views: {product.views || 0}</span>
                        <span>{product.profiles?.username || 'Unknown seller'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button 
                        onClick={() => window.open(`/product/${product.id}`, '_blank')}
                        style={{ 
                          padding: '4px 12px',
                          background: '#0d6efd',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0d6efd'}
                      >
                        View
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        style={{ 
                          padding: '4px 12px',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div style={{ 
          background: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#000', margin: '0 0 20px 0' }}>👥 User Management</h2>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', color: '#000' }}>User</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', color: '#000' }}>Role</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', color: '#000' }}>Location</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', color: '#000' }}>Joined</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', color: '#000' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', color: '#000' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentUsers.map(user => (
                  <tr key={user.user_id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px', color: '#000' }}>
                      <div>
                        <strong>{user.username || 'N/A'}</strong>
                        <div style={{ fontSize: '12px', color: '#6c757d' }}>{user.user_id.substring(0, 12)}...</div>
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: '#000' }}>User</td>
                    <td style={{ padding: '12px', color: '#000' }}>{user.location || 'N/A'}</td>
                    <td style={{ padding: '12px', color: '#000' }}>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        background: '#28a745',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        Active
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button 
                          onClick={() => window.open(`/profile/${user.user_id}`, '_blank')}
                          style={{ 
                            padding: '4px 12px',
                            background: '#0d6efd',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          View
                        </button>
                        <button 
                          onClick={() => handleBanUser(user.user_id, 'Admin decision')}
                          style={{ 
                            padding: '4px 12px',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Ban
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORTS TAB - ADD THIS */}
      {activeTab === 'reports' && (
        <div style={{ 
          background: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#000', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            📢 User Reports ({reports.filter(r => r.status === 'pending').length} pending)
            {reports.filter(r => r.status === 'pending').length > 0 && (
              <span style={{ 
                fontSize: '12px', 
                background: '#dc3545', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '10px' 
              }}>
                ACTION NEEDED
              </span>
            )}
          </h2>
          
          {reports.length === 0 ? (
            <p style={{ color: '#6c757d', textAlign: 'center', padding: '40px' }}>
              No reports yet. Users can report suspicious listings/users.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '15px' }}>
              {reports.map(report => (
                <div key={report.id} style={{
                  border: '1px solid #ddd',
                  padding: '20px',
                  borderRadius: '8px',
                  background: report.status === 'pending' ? '#fff8e1' : '#f9f9f9',
                  borderLeft: report.status === 'pending' ? '4px solid #f59e0b' : '4px solid #10b981'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <p style={{ color: '#000', marginBottom: '5px' }}><strong>Reason:</strong> <span style={{ 
                        background: '#e5e7eb', 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#000'
                      }}>{report.reason}</span></p>
                      <p style={{ color: '#000', marginBottom: '5px' }}><strong>Reported by:</strong> {report.reporter?.email || 'Unknown'}</p>
                      <p style={{ color: '#000', marginBottom: '5px' }}><strong>Against user:</strong> {report.reported_user?.email || 'Unknown'}</p>
                      <p style={{ color: '#000', marginBottom: '5px' }}><strong>Date:</strong> {new Date(report.created_at).toLocaleString()}</p>
                      {report.description && (
                        <p style={{ color: '#000', marginBottom: '0' }}><strong>Details:</strong> {report.description}</p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        display: 'inline-block',
                        padding: '4px 12px', 
                        background: report.status === 'pending' ? '#f59e0b' : '#10b981',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        marginBottom: '10px'
                      }}>
                        {report.status.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  
                  {report.status === 'pending' && (
                    <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => handleResolveReport(report.id, 'ban', report.reported_user_id)}
                        style={{ 
                          padding: '8px 20px', 
                          background: '#dc3545', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
                      >
                        🚫 Ban User & Resolve
                      </button>
                      <button 
                        onClick={() => handleResolveReport(report.id, 'resolve', report.reported_user_id)}
                        style={{ 
                          padding: '8px 20px', 
                          background: '#10b981', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0da271'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                      >
                        ✅ Mark as Resolved
                      </button>
                      <button 
                        onClick={() => handleDismissReport(report.id)}
                        style={{ 
                          padding: '8px 20px', 
                          background: '#6b7280', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#565d6d'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6b7280'}
                      >
                        ❌ Dismiss Report
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PRODUCTS TAB - ADD THIS */}
      {activeTab === 'products' && (
        <div style={{ 
          background: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#000', margin: '0 0 20px 0' }}>🛒 Product Management ({stats.products.length})</h2>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', color: '#000' }}>Product</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', color: '#000' }}>Seller</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', color: '#000' }}>Price</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', color: '#000' }}>Views</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', color: '#000' }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', color: '#000' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.products.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
                      No products found
                    </td>
                  </tr>
                ) : (
                  stats.products.map(product => (
                    <tr key={product.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '12px', color: '#000' }}>
                        <div>
                          <strong>{product.name}</strong>
                          <div style={{ fontSize: '12px', color: '#6c757d', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {product.description?.substring(0, 50)}...
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: '#000' }}>
                        {product.profiles?.username || 'Unknown'}
                      </td>
                      <td style={{ padding: '12px', color: '#000', fontWeight: 'bold' }}>${product.price}</td>
                      <td style={{ padding: '12px', color: '#000' }}>{product.views || 0}</td>
                      <td style={{ padding: '12px', color: '#000' }}>{new Date(product.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button 
                            onClick={() => window.open(`/product/${product.id}`, '_blank')}
                            style={{ 
                              padding: '4px 12px',
                              background: '#0d6efd',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            View
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(product.id)}
                            style={{ 
                              padding: '4px 12px',
                              background: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div style={{ 
          background: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#000', margin: '0 0 20px 0' }}>📈 Advanced Analytics</h2>
          
          {/* Top Products Chart */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#000', marginBottom: '15px' }}>🔥 Top Products by Views</h3>
            <div style={{ height: '400px' }}>
              <Bar 
                data={getTopProductsData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: 'y',
                  plugins: {
                    legend: {
                      display: false
                    }
                  },
                  scales: {
                    x: {
                      grid: {
                        color: 'rgba(0,0,0,0.05)'
                      },
                      beginAtZero: true
                    },
                    y: {
                      grid: {
                        color: 'rgba(0,0,0,0.05)'
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Engagement Metrics */}
          <div>
            <h3 style={{ color: '#000', marginBottom: '15px' }}>⚡ Engagement Metrics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div style={{ textAlign: 'center', padding: '15px', background: '#e7f5ff', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0d6efd' }}>
                  {stats.dailyStats.reduce((sum, day) => sum + (day.searches || 0), 0)}
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>Total Searches</div>
              </div>
              <div style={{ textAlign: 'center', padding: '15px', background: '#e6fcf5', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#12b886' }}>
                  {stats.dailyStats.reduce((sum, day) => sum + (day.contacts || 0), 0)}
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>Total Contacts</div>
              </div>
              <div style={{ textAlign: 'center', padding: '15px', background: '#fff4e6', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fd7e14' }}>
                  {stats.products.filter(p => p.views > 0).length}
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>Products Viewed</div>
              </div>
              <div style={{ textAlign: 'center', padding: '15px', background: '#f3e8ff', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9c36b5' }}>
                  {stats.recentUsers.length}
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>New Users (24h)</div>
              </div>
            </div>
          </div>

          {/* Real-time Activity Feed */}
          <div style={{ marginTop: '30px' }}>
            <h3 style={{ color: '#000', marginBottom: '15px' }}>⚡ Real-time Activity Feed</h3>
            <div style={{ 
              maxHeight: '300px',
              overflowY: 'auto',
              background: '#f8f9fa',
              borderRadius: '8px',
              padding: '10px'
            }}>
              {realtimeData.recentActivities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
                  No recent activities
                </div>
              ) : (
                realtimeData.recentActivities.map((activity, index) => (
                  <div key={index} style={{
                    padding: '10px',
                    borderBottom: '1px solid #dee2e6',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: index === 0 ? '#f8fff9' : 'transparent'
                  }}>
                    <span style={{
                      padding: '2px 8px',
                      background: getActivityColor(activity.action_type),
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      {activity.action_type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span style={{ flex: 1, fontSize: '12px', color: '#000' }}>
                      User {activity.user_id?.substring(0, 8)}...
                    </span>
                    <span style={{ fontSize: '11px', color: '#6c757d' }}>
                      {new Date(activity.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add CSS animation */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// Helper function for activity colors
const getActivityColor = (actionType) => {
  const colors = {
    'search': '#3b82f6',
    'contact': '#10b981',
    'view_product': '#f59e0b',
    'save_wishlist': '#8b5cf6',
    'login': '#ef4444',
    'page_view': '#6b7280'
  };
  return colors[actionType] || '#6b7280';
};

export default AdminDashboard;
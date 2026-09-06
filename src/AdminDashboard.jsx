import { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { userMonitor } from './userBehaviorMonitor';
import { useAuthState } from './AuthContext.jsx';
import AdminErrorAnalytics from './AdminErrorAnalytics';
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
  ArcElement,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

export function SuspiciousActivityMonitor() {
    const [suspiciousUsers, setSuspiciousUsers] = useState([]);
    const [refresh, setRefresh] = useState(0);
    
    useEffect(() => {
        const interval = setInterval(() => {
            const users = userMonitor.getSuspiciousUsers(10);
            setSuspiciousUsers(users);
        }, 10000);
        
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
  const { user } = useAuthState();

  console.log('👑👑👑 ADMIN DASHBOARD IS RENDERING 👑👑👑');

  useEffect(() => {
    console.log('👑 AdminDashboard - Current user:', user);
    console.log('👑 AdminDashboard - User email:', user?.email);
    console.log('👑 AdminDashboard - Is admin?', user?.email === 'deonmahachi8@gmail.com');
    
    if (user?.email === 'deonmahachi8@gmail.com') {
        console.log('👑 Force staying on admin page');
    }
  }, [user]);

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
  const [userFilter, setUserFilter] = useState('all');
  const [incompleteUsers, setIncompleteUsers] = useState([]);
  const [authStats, setAuthStats] = useState({ auth_users: 0, profiles: 0, missing_profiles: 0 });
  const [productsWithNoImages, setProductsWithNoImages] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [realtimeData, setRealtimeData] = useState({
    onlineUsers: 0,
    recentActivities: []
  });

  // Real-time subscription
  useEffect(() => {
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
          fetchIncompleteUsers();
        }
      )
      .subscribe();

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

  const callAdminUsersFunction = useCallback(async (action, data = null) => {
    try {
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      let options = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      };
      
      let url = functionUrl;
      
      if (action === 'list' || action === 'count') {
        url = `${functionUrl}?action=${action}`;
      } else if (action === 'delete') {
        options = {
          ...options,
          method: 'POST',
          body: JSON.stringify({ userId: data })
        };
      }
      
      console.log('📡 Calling Edge Function:', url);
      
      const response = await fetch(url, options);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Function call failed');
      }
      
      return result;
    } catch (error) {
      console.error('Error calling admin-users function:', error);
      throw error;
    }
  }, []);

  // In your AdminDashboard.jsx
  const fetchAuthStatsSQL = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_user_stats');
      
      if (error) throw error;
      
      setAuthStats({
        auth_users: data.auth_users || 0,
        profiles: data.profiles || 0,
        missing_profiles: data.missing_profiles || 0
      });
    } catch (error) {
      console.error('Error fetching auth stats:', error);
    }
  }, []);

   // Add function to fetch auth stats
  const fetchAuthStats = useCallback(async () => {
    try {
      const result = await callAdminUsersFunction('count');
      setAuthStats(result);
      console.log('📊 Auth Stats from Edge Function:', result);
    } catch (error) {
      console.error('Error fetching auth stats:', error);
      // ✅ Fallback to SQL if Edge Function fails
      try {
        const { data, error: sqlError } = await supabase.rpc('get_user_stats');
        if (!sqlError && data) {
          setAuthStats({
            auth_users: data.auth_users || 0,
            profiles: data.profiles || 0,
            missing_profiles: data.missing_profiles || 0
          });
          console.log('📊 Auth Stats from SQL (fallback):', data);
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
  }, [callAdminUsersFunction]);

  // Update fetchIncompleteUsers to use the Edge Function
  const fetchIncompleteUsers = useCallback(async () => {
    try {
      setLoading(true);
      
      console.log('🔄 Fetching incomplete users...');
      
      const result = await callAdminUsersFunction('list');
      
      console.log('📊 Raw result:', result);
      
      if (!result.success || !result.users) {
        console.error('Failed to fetch users:', result);
        setIncompleteUsers([]);
        return;
      }
      
      console.log(`📊 Total users: ${result.total}`);
      console.log(`📊 With profiles: ${result.with_profiles}`);
      console.log(`📊 Without profiles: ${result.without_profiles}`);
      
      // Filter incomplete users
      const incomplete = result.users.filter(user => {
        // Users without profile are incomplete
        if (!user.has_profile) return true;
        
        // Users with incomplete setup
        const profile = user.profile;
        if (!profile) return true;
        
        return !profile.is_seller && 
              !profile.is_buyer && 
              !profile.seller_setup_completed && 
              !profile.buyer_setup_completed;
      });
      
      console.log(`📊 Found ${incomplete.length} incomplete users`);
      
      // Format for display
      const formattedUsers = incomplete.map(user => ({
        user_id: user.id,
        username: user.username || user.email || 'Unknown',
        email: user.email || 'No email',
        location: user.location || 'No profile',
        phone_number: user.phone_number || 'No profile',
        created_at: user.created_at || new Date().toISOString(),
        has_profile: user.has_profile,
        is_seller: user.is_seller || false,
        is_buyer: user.is_buyer || false,
        seller_setup_completed: user.seller_setup_completed || false,
        buyer_setup_completed: user.buyer_setup_completed || false
      }));
      
      // ✅ Force state update with new array
      setIncompleteUsers([...formattedUsers]);
      
      console.log('✅ Incomplete users updated:', formattedUsers.length);
      
    } catch (error) {
      console.error('Error fetching incomplete users:', error);
      setIncompleteUsers([]);
    } finally {
      setLoading(false);
    }
  }, [callAdminUsersFunction]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { data: recentUsers } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: userActivity } = await supabase
        .from('user_activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      const { data: feedbackData } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: bannedUsers } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', false)
        .order('updated_at', { ascending: false });

      const { data: dailyStats } = await supabase
        .from('daily_stats')
        .select('*')
        .order('date', { ascending: false })
        .limit(30);

      const { data: topProducts } = await supabase
        .from('products')
        .select('*')
        .order('views', { ascending: false })
        .limit(10);

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
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.warn('Error fetching reports:', error.message);
        setReports([]);
        return;
      }
      
      setReports(data || []);
    } catch (error) {
      console.warn('Error fetching reports:', error.message);
      setReports([]);
    }
  }, []);

  const fetchProductsWithNoImages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .is('image_url', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products with no images:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching products with no images:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await fetchDashboardData();
      await fetchReports();
      await fetchIncompleteUsers();
      await fetchAuthStats();
      const products = await fetchProductsWithNoImages();
      setProductsWithNoImages(products);
    };
    loadData();
  }, []);

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
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Total Activities',
          data: last7Days.map(day => day.total_activities || 0),
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.1)',
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
            'rgba(37, 99, 235, 0.8)',
            'rgba(22, 163, 74, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(124, 58, 237, 0.8)',
            'rgba(107, 114, 128, 0.8)'
          ],
          borderColor: [
            '#2563eb',
            '#16a34a',
            '#f59e0b',
            '#7c3aed',
            '#6b7280'
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
          backgroundColor: 'rgba(37, 99, 235, 0.6)',
          borderColor: '#2563eb',
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
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const { data: bannedUsers } = await supabase
        .from('profiles')
        .select('user_id, username, email, role, updated_at')
        .eq('is_active', false)
        .order('updated_at', { ascending: false });
        
      setStats(prev => ({ ...prev, bannedUsers: bannedUsers || [] }));
      alert('User deactivated successfully');
      
    } catch (error) {
      console.error('Error deactivating user:', error);
      alert('Error deactivating user');
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

  // ✅ IMPROVED: Delete user and all related data
  const deleteUserCompletely = async (userId) => {
    if (!window.confirm('⚠️ WARNING: This will permanently delete the user and ALL their data. Are you sure?')) {
      return;
    }

    if (!window.confirm('⚠️ FINAL WARNING: This action CANNOT be undone! Delete user?')) {
      return;
    }

    try {
      setLoading(true);
      
      const user = incompleteUsers.find(u => u.user_id === userId);
      const userName = user?.username || userId;
      
      console.log(`🗑️ Deleting user: ${userName} (${userId})`);
      
      // ✅ Call Edge Function to delete
      const result = await callAdminUsersFunction('delete', userId);
      
      if (result.success) {
        alert(`✅ User "${userName}" and all related data deleted successfully!`);
      } else if (result.partial) {
        alert(`⚠️ Partially deleted: ${result.message || 'Some data may remain.'}`);
      } else {
        throw new Error(result.error || 'Deletion failed');
      }
      
      // ✅ Wait for backend to process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // ✅ Get fresh data from Edge Function
      console.log('🔄 Fetching fresh data...');
      
      // 1. Get fresh auth stats
      const freshStats = await callAdminUsersFunction('count');
      console.log('📊 Fresh Stats:', freshStats);
      
      // 2. Get fresh user list
      const freshUsers = await callAdminUsersFunction('list');
      console.log('📊 Fresh Users:', freshUsers);
      
      // 3. Update state with fresh data
      if (freshStats) {
        setAuthStats({
          auth_users: freshStats.auth_users || 0,
          profiles: freshStats.profiles || 0,
          missing_profiles: freshStats.missing_profiles || 0
        });
      }
      
      if (freshUsers.success && freshUsers.users) {
        // Filter incomplete users
        const incomplete = freshUsers.users.filter(user => {
          if (!user.has_profile) return true;
          const profile = user.profile;
          if (!profile) return true;
          return !profile.is_seller && 
                !profile.is_buyer && 
                !profile.seller_setup_completed && 
                !profile.buyer_setup_completed;
        });
        
        const formattedUsers = incomplete.map(user => ({
          user_id: user.id,
          username: user.username || user.email || 'Unknown',
          email: user.email || 'No email',
          location: user.location || 'No profile',
          phone_number: user.phone_number || 'No profile',
          created_at: user.created_at || new Date().toISOString(),
          has_profile: user.has_profile,
          is_seller: user.is_seller || false,
          is_buyer: user.is_buyer || false,
          seller_setup_completed: user.seller_setup_completed || false,
          buyer_setup_completed: user.buyer_setup_completed || false
        }));
        
        console.log(`📊 New incomplete users count: ${formattedUsers.length}`);
        setIncompleteUsers(formattedUsers);
      }
      
      // ✅ Also refresh dashboard data
      await fetchDashboardData();
      
      console.log('✅ All data refreshed!');
      
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };


  const handleResolveReport = async (reportId, action, reportedUserId) => {
    try {
      if (action === 'ban' && reportedUserId) {
        const { error: banError } = await supabase
          .from('profiles')
          .update({ is_active: false })
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

  const deleteProductWithNoImage = async (productId) => {
    if (!window.confirm('Delete this product (no image)?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      const updatedProducts = await fetchProductsWithNoImages();
      setProductsWithNoImages(updatedProducts);
      await fetchDashboardData();

      alert('✅ Product deleted successfully!');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('❌ Error deleting product');
    }
  };

  const deleteAllProductsWithNoImages = async () => {
    if (!window.confirm('⚠️ Delete ALL products that have no images?')) return;
    if (!window.confirm('⚠️ FINAL WARNING: This will delete ALL products without images. Are you sure?')) return;

    try {
      const products = await fetchProductsWithNoImages();
      if (products.length === 0) {
        alert('No products without images found.');
        return;
      }

      let deleted = 0;
      for (const product of products) {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', product.id);

        if (!error) deleted++;
      }

      const updatedProducts = await fetchProductsWithNoImages();
      setProductsWithNoImages(updatedProducts);
      await fetchDashboardData();

      alert(`✅ Deleted ${deleted} products without images.`);
    } catch (error) {
      console.error('Error deleting products:', error);
      alert('❌ Error deleting products');
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

  const getStatusBadge = (status) => {
    const styles = {
      active: { bg: '#dcfce7', text: '#16a34a', label: 'ACTIVE' },
      inactive: { bg: '#fee2e2', text: '#dc2626', label: 'INACTIVE' },
      pending: { bg: '#fef3c7', text: '#d97706', label: 'PENDING' },
      resolved: { bg: '#dbeafe', text: '#2563eb', label: 'RESOLVED' },
      error: { bg: '#fee2e2', text: '#dc2626', label: 'ERROR' }
    };
    const style = styles[status] || styles.inactive;
    return {
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '600',
      background: style.bg,
      color: style.text,
      display: 'inline-block'
    };
  };

  if (loading) return (
    <div style={{ 
      padding: '40px', 
      color: '#111827', 
      textAlign: 'center',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh'
    }}>
      <div>
        <div className="loading-spinner" style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e5e7eb',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px auto'
        }} />
        <p>Loading Dashboard Data...</p>
      </div>
    </div>
  );

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1400px', 
      margin: '0 auto', 
      fontFamily: 'sans-serif',
      color: '#111827',
      backgroundColor: '#f3f4f6',
      minHeight: '100vh'
    }}>
      
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '2px solid #e5e7eb',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div>
          <h1 style={{ color: '#111827', margin: 0, fontSize: '28px' }}>
            🎯 Admin Dashboard
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                background: '#22c55e',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }}></div>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>
                🟢 {realtimeData.onlineUsers} Users Online
              </span>
            </div>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>
              📊 {stats.userActivity.length} Activities Today
            </span>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>
              👤 Auth Users: {authStats.auth_users}
            </span>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>
              📊 Profiles: {authStats.profiles}
            </span>
            <span style={{ fontSize: '14px', color: '#f59e0b' }}>
              ⚠️ Missing Profiles: {authStats.missing_profiles}
            </span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveTab('overview')}
            style={{ 
              padding: '8px 16px',
              background: activeTab === 'overview' ? '#2563eb' : 'transparent',
              color: activeTab === 'overview' ? 'white' : '#6b7280',
              border: activeTab === 'overview' ? 'none' : '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'overview') {
                e.currentTarget.style.background = '#f3f4f6';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'overview') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            style={{ 
              padding: '8px 16px',
              background: activeTab === 'users' ? '#2563eb' : 'transparent',
              color: activeTab === 'users' ? 'white' : '#6b7280',
              border: activeTab === 'users' ? 'none' : '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'users') {
                e.currentTarget.style.background = '#f3f4f6';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'users') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            👥 Users
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            style={{ 
              padding: '8px 16px',
              background: activeTab === 'reports' ? '#f59e0b' : 'transparent',
              color: activeTab === 'reports' ? 'white' : '#6b7280',
              border: activeTab === 'reports' ? 'none' : '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'reports') {
                e.currentTarget.style.background = '#f3f4f6';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'reports') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            📢 Reports ({reports.filter(r => r.status === 'pending').length})
          </button>
          <button 
            onClick={() => setActiveTab('products')}
            style={{ 
              padding: '8px 16px',
              background: activeTab === 'products' ? '#2563eb' : 'transparent',
              color: activeTab === 'products' ? 'white' : '#6b7280',
              border: activeTab === 'products' ? 'none' : '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'products') {
                e.currentTarget.style.background = '#f3f4f6';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'products') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            🛒 Products
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            style={{ 
              padding: '8px 16px',
              background: activeTab === 'analytics' ? '#7c3aed' : 'transparent',
              color: activeTab === 'analytics' ? 'white' : '#6b7280',
              border: activeTab === 'analytics' ? 'none' : '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'analytics') {
                e.currentTarget.style.background = '#f3f4f6';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'analytics') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            📈 Analytics
          </button>
          <button 
            onClick={() => setActiveTab('errors')}
            style={{ 
              padding: '8px 16px',
              background: activeTab === 'errors' ? '#dc2626' : 'transparent',
              color: activeTab === 'errors' ? 'white' : '#6b7280',
              border: activeTab === 'errors' ? 'none' : '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'errors') {
                e.currentTarget.style.background = '#f3f4f6';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'errors') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            ❌ Errors
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              borderLeft: '4px solid #2563eb',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}>
              <h3 style={{ color: '#6b7280', margin: '0 0 8px 0', fontSize: '13px', fontWeight: '500' }}>Total Users</h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#111827' }}>{stats.users}</p>
              <p style={{ fontSize: '12px', color: '#16a34a', marginTop: '5px' }}>
                ↑ {stats.recentUsers.length} new in last 24h
              </p>
            </div>

            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              borderLeft: '4px solid #16a34a',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}>
              <h3 style={{ color: '#6b7280', margin: '0 0 8px 0', fontSize: '13px', fontWeight: '500' }}>Active Products</h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#111827' }}>{stats.products.length}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                Listed by {new Set(stats.products.map(p => p.seller_id)).size} sellers
              </p>
            </div>

            <div style={{ 
              background: reports.filter(r => r.status === 'pending').length > 0 ? '#fef3c7' : 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              borderLeft: reports.filter(r => r.status === 'pending').length > 0 ? '4px solid #f59e0b' : '4px solid #6b7280',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}>
              <h3 style={{ color: '#6b7280', margin: '0 0 8px 0', fontSize: '13px', fontWeight: '500' }}>Pending Reports</h3>
              <p style={{ 
                fontSize: '32px', 
                fontWeight: 'bold', 
                margin: 0, 
                color: reports.filter(r => r.status === 'pending').length > 0 ? '#dc2626' : '#111827' 
              }}>
                {reports.filter(r => r.status === 'pending').length}
              </p>
              {reports.filter(r => r.status === 'pending').length > 0 && (
                <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '5px' }}>
                  ⚠️ Needs immediate attention
                </p>
              )}
            </div>

            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              borderLeft: '4px solid #7c3aed',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}>
              <h3 style={{ color: '#6b7280', margin: '0 0 8px 0', fontSize: '13px', fontWeight: '500' }}>Inactive Users</h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#111827' }}>{stats.bannedUsers.length}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                Last: {stats.bannedUsers[0] ? new Date(stats.bannedUsers[0].updated_at).toLocaleDateString() : 'None'}
              </p>
            </div>
          </div>

          {/* Charts Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#111827', margin: '0 0 15px 0', fontSize: '16px' }}>📈 User Activity (Last 7 Days)</h3>
              <div style={{ height: '280px' }}>
                <Line 
                  data={getUserGrowthData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                        labels: {
                          color: '#111827',
                          usePointStyle: true,
                          pointStyle: 'circle'
                        }
                      }
                    },
                    scales: {
                      x: {
                        grid: {
                          color: 'rgba(0,0,0,0.05)'
                        },
                        ticks: {
                          color: '#6b7280'
                        }
                      },
                      y: {
                        grid: {
                          color: 'rgba(0,0,0,0.05)'
                        },
                        ticks: {
                          color: '#6b7280'
                        },
                        beginAtZero: true
                      }
                    }
                  }}
                />
              </div>
            </div>
            
            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#111827', margin: '0 0 15px 0', fontSize: '16px' }}>📊 Activity Distribution</h3>
              <div style={{ height: '280px' }}>
                <Doughnut 
                  data={getActivityDistributionData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          color: '#111827',
                          padding: 12,
                          usePointStyle: true,
                          pointStyle: 'circle'
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Recent Activity Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {/* Recent Signups */}
            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#111827', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px' }}>
                👤 Recent Signups ({stats.recentUsers.length})
              </h3>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {stats.recentUsers.slice(0, 10).map(user => (
                  <div key={user.user_id} style={{ 
                    padding: '10px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#111827' }}>
                        {user.username || user.user_id.substring(0, 8)}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                        📍 {user.location || 'No location'} • {new Date(user.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {user.is_seller && (
                        <span style={{
                          padding: '2px 8px',
                          background: '#dbeafe',
                          color: '#2563eb',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: '600'
                        }}>
                          Seller
                        </span>
                      )}
                      {user.is_buyer && (
                        <span style={{
                          padding: '2px 8px',
                          background: '#dcfce7',
                          color: '#16a34a',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: '600'
                        }}>
                          Buyer
                        </span>
                      )}
                      <button 
                        onClick={() => handleBanUser(user.user_id, 'Deactivated by admin')}
                        style={{ 
                          padding: '4px 12px',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
                      >
                        Deactivate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Products */}
            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#111827', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px' }}>
                🏆 Top Products
              </h3>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {stats.topProducts.slice(0, 10).map(product => (
                  <div key={product.id} style={{ 
                    padding: '10px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#111827' }}>
                        {product.name}
                      </p>
                      <div style={{ display: 'flex', gap: '15px', fontSize: '12px', color: '#6b7280' }}>
                        <span>💰 ${product.price}</span>
                        <span>👁️ {product.views || 0}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button 
                        onClick={() => window.open(`/product/${product.id}`, '_blank')}
                        style={{ 
                          padding: '4px 12px',
                          background: '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
                      >
                        View
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        style={{ 
                          padding: '4px 12px',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
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
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#111827', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
            <span>👥 User Management ({stats.recentUsers.length})</span>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search users..."
                style={{
                  padding: '8px 14px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#111827',
                  background: 'white',
                  width: '200px',
                  transition: 'border-color 0.2s ease'
                }}
                onChange={(e) => setUserSearch(e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <select
                style={{
                  padding: '8px 14px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#111827',
                  background: 'white',
                  transition: 'border-color 0.2s ease'
                }}
                onChange={(e) => setUserFilter(e.target.value)}
                value={userFilter}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <option value="all">All Users</option>
                <option value="active">Active (Recent)</option>
                <option value="inactive">Inactive</option>
                <option value="seller">Sellers</option>
                <option value="buyer">Buyers</option>
                <option value="setup_complete">Setup Complete</option>
                <option value="setup_incomplete">Setup Incomplete</option>
              </select>
            </div>
          </h2>
          
          {stats.recentUsers.length === 0 ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>
              No users found
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Info</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Setup Status</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activity</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Active</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentUsers
                    .filter(user => {
                      const searchMatch = !userSearch || 
                        (user.username && user.username.toLowerCase().includes(userSearch.toLowerCase())) ||
                        (user.location && user.location.toLowerCase().includes(userSearch.toLowerCase()));
                      
                      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
                      const isActiveRecently = user.last_activity_at && 
                        new Date(user.last_activity_at) > fifteenMinutesAgo;
                      
                      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                      const isInactive = !user.last_activity_at || 
                        new Date(user.last_activity_at) < sevenDaysAgo;
                      
                      const isSetupComplete = (user.is_seller && user.seller_setup_completed) || 
                        (user.is_buyer && user.buyer_setup_completed);
                      
                      switch(userFilter) {
                        case 'active': return isActiveRecently;
                        case 'inactive': return isInactive;
                        case 'seller': return user.is_seller;
                        case 'buyer': return user.is_buyer;
                        case 'setup_complete': return isSetupComplete;
                        case 'setup_incomplete': return !isSetupComplete;
                        default: return true;
                      }
                    })
                    .map((user, index) => {
                      const userType = user.is_seller && user.is_buyer ? 'Both' :
                                      user.is_seller ? 'Seller' :
                                      user.is_buyer ? 'Buyer' : 'Not Set';
                      
                      const isSetupComplete = (user.is_seller && user.seller_setup_completed) || 
                        (user.is_buyer && user.buyer_setup_completed);
                      
                      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
                      const isActive = user.last_activity_at && 
                        new Date(user.last_activity_at) > fifteenMinutesAgo;
                      
                      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                      const isInactive = !user.last_activity_at || 
                        new Date(user.last_activity_at) < sevenDaysAgo;
                      
                      return (
                        <tr key={user.user_id} style={{ 
                          borderBottom: '1px solid #e5e7eb',
                          background: index % 2 === 0 ? 'white' : '#f8fafc',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#eff6ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#f8fafc';
                        }}>
                          <td style={{ padding: '12px', color: '#111827' }}>
                            <div>
                              <strong style={{ display: 'block', marginBottom: '4px' }}>
                                {user.username || 'Anonymous User'}
                              </strong>
                              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>
                                ID: {user.user_id.substring(0, 8)}...
                              </div>
                              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>
                                📍 {user.location || 'No location'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                                📞 {user.phone_number || 'No phone'}
                              </div>
                              {user.role && user.role !== 'user' && (
                                <div style={{ 
                                  display: 'inline-block',
                                  marginTop: '4px',
                                  padding: '2px 8px',
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  borderRadius: '12px',
                                  fontSize: '10px',
                                  fontWeight: 'bold'
                                }}>
                                  {user.role.toUpperCase()}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px', color: '#111827' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{
                                padding: '4px 8px',
                                background: userType === 'Seller' ? '#dbeafe' :
                                          userType === 'Buyer' ? '#dcfce7' :
                                          userType === 'Both' ? '#fef3c7' : '#f3f4f6',
                                color: userType === 'Seller' ? '#1d4ed8' :
                                      userType === 'Buyer' ? '#16a34a' :
                                      userType === 'Both' ? '#92400e' : '#6b7280',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '600',
                                textAlign: 'center'
                              }}>
                                {userType}
                              </span>
                              
                              <div style={{ fontSize: '11px', textAlign: 'center' }}>
                                {isSetupComplete ? (
                                  <span style={{ color: '#16a34a' }}>✓ Setup Complete</span>
                                ) : (
                                  <span style={{ color: '#f59e0b' }}>⚠ Setup Incomplete</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px', color: '#111827' }}>
                            <div style={{ fontSize: '12px' }}>
                              <div style={{ marginBottom: '4px' }}>
                                <span style={{ fontWeight: '500' }}>Searches:</span> {user.total_searches || 0}
                              </div>
                              <div>
                                <span style={{ fontWeight: '500' }}>Contacts:</span> {user.total_contacts || 0}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px', color: '#111827' }}>
                            <div style={{ fontSize: '12px' }}>
                              <div style={{ marginBottom: '4px' }}>
                                <strong>Joined:</strong> {new Date(user.created_at).toLocaleDateString()}
                              </div>
                              <div style={{ marginBottom: '4px' }}>
                                <strong>Last Active:</strong> {user.last_activity_at ? 
                                  new Date(user.last_activity_at).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : 
                                  'Never'}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontSize: '11px',
                                fontWeight: '600',
                                background: isActive ? '#dcfce7' : 
                                          isInactive ? '#fee2e2' : '#fef3c7',
                                color: isActive ? '#16a34a' : 
                                      isInactive ? '#dc2626' : '#d97706',
                                textAlign: 'center'
                              }}>
                                {isActive ? '🟢 ACTIVE' : 
                                isInactive ? '🔴 INACTIVE' : '🟡 IDLE'}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <button 
                                onClick={() => {
                                  alert(`User Details:
      ID: ${user.user_id}
      Username: ${user.username || 'N/A'}
      Location: ${user.location || 'N/A'}
      Phone: ${user.phone_number || 'N/A'}
      Role: ${user.role || 'user'}
      Type: ${userType}
      Searches: ${user.total_searches || 0}
      Contacts: ${user.total_contacts || 0}
      Active: ${user.is_active ? 'Yes' : 'No'}
      Setup Complete: ${isSetupComplete ? 'Yes' : 'No'}
      Interests: ${user.interests ? user.interests.join(', ') : 'None'}`);
                                }}
                                style={{ 
                                  padding: '6px 12px',
                                  background: '#2563eb',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s',
                                  width: '100%'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
                              >
                                👁️ View
                              </button>
                              
                              <button 
                                onClick={() => {
                                  const newStatus = user.is_active;
                                  if (window.confirm(`${newStatus ? 'Deactivate' : 'Activate'} this user?`)) {
                                    supabase
                                      .from('profiles')
                                      .update({ 
                                        is_active: !newStatus,
                                        updated_at: new Date().toISOString()
                                      })
                                      .eq('user_id', user.user_id)
                                      .then(() => {
                                        fetchDashboardData();
                                        alert(`User ${!newStatus ? 'activated' : 'deactivated'} successfully`);
                                      })
                                      .catch(error => {
                                        console.error('Error updating user:', error);
                                        alert('Error updating user');
                                      });
                                  }
                                }}
                                style={{ 
                                  padding: '6px 12px',
                                  background: user.is_active ? '#dc2626' : '#16a34a',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s',
                                  width: '100%'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = user.is_active ? '#b91c1c' : '#15803d';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = user.is_active ? '#dc2626' : '#16a34a';
                                }}
                              >
                                {user.is_active ? '🚫 Deactivate' : '✅ Activate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', gap: '10px' }}>
            <button 
              style={{ 
                padding: '8px 16px',
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#6b7280'
              }}
              disabled
            >
              ← Previous
            </button>
            <span style={{ padding: '8px 16px', color: '#111827' }}>Page 1</span>
            <button 
              style={{ 
                padding: '8px 16px',
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#6b7280',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div style={{ 
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#111827', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            📢 User Reports ({reports.filter(r => r.status === 'pending').length} pending)
            {reports.filter(r => r.status === 'pending').length > 0 && (
              <span style={{ 
                fontSize: '11px', 
                background: '#dc2626', 
                color: 'white', 
                padding: '2px 10px', 
                borderRadius: '20px',
                fontWeight: '600'
              }}>
                ACTION NEEDED
              </span>
            )}
          </h2>
          
          {reports.length === 0 ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>
              No reports yet. Users can report suspicious listings/users.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '15px' }}>
              {reports.map(report => (
                <div key={report.id} style={{
                  border: '1px solid #e5e7eb',
                  padding: '20px',
                  borderRadius: '10px',
                  background: report.status === 'pending' ? '#fef3c7' : 'white',
                  borderLeft: report.status === 'pending' ? '4px solid #f59e0b' : '4px solid #16a34a',
                  transition: 'box-shadow 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <p style={{ color: '#111827', marginBottom: '5px' }}>
                        <strong>Reason:</strong> 
                        <span style={{ 
                          background: '#f3f4f6', 
                          padding: '2px 10px', 
                          borderRadius: '4px',
                          fontSize: '13px',
                          color: '#111827',
                          marginLeft: '5px'
                        }}>
                          {report.reason}
                        </span>
                      </p>
                      <p style={{ color: '#6b7280', marginBottom: '4px', fontSize: '13px' }}>
                        <strong>Reported by:</strong> {report.reporter?.email || 'Unknown'}
                      </p>
                      <p style={{ color: '#6b7280', marginBottom: '4px', fontSize: '13px' }}>
                        <strong>Against:</strong> {report.reported_user?.email || 'Unknown'}
                      </p>
                      <p style={{ color: '#6b7280', marginBottom: '4px', fontSize: '13px' }}>
                        <strong>Date:</strong> {new Date(report.created_at).toLocaleString()}
                      </p>
                      {report.description && (
                        <p style={{ color: '#111827', marginBottom: '0', fontSize: '13px', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                          <strong>Details:</strong> {report.description}
                        </p>
                      )}
                    </div>
                    <div>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 14px',
                        background: report.status === 'pending' ? '#f59e0b' : '#16a34a',
                        color: 'white',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {report.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  {report.status === 'pending' && (
                    <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => handleResolveReport(report.id, 'ban', report.reported_user_id)}
                        style={{ 
                          padding: '8px 18px', 
                          background: '#dc2626', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '6px',
                          fontWeight: '600',
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
                      >
                        🚫 Ban & Resolve
                      </button>
                      <button 
                        onClick={() => handleResolveReport(report.id, 'resolve', report.reported_user_id)}
                        style={{ 
                          padding: '8px 18px', 
                          background: '#16a34a', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '6px',
                          fontWeight: '600',
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#15803d'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#16a34a'}
                      >
                        ✅ Resolve
                      </button>
                      <button 
                        onClick={() => handleDismissReport(report.id)}
                        style={{ 
                          padding: '8px 18px', 
                          background: '#6b7280', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '6px',
                          fontWeight: '600',
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#565d6d'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#6b7280'}
                      >
                        ❌ Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div style={{ 
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#111827', margin: '0 0 20px 0' }}>🛒 Product Management ({stats.products.length})</h2>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seller</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Views</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Image</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.products.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                      No products found
                    </td>
                  </tr>
                ) : (
                  stats.products.map((product, index) => (
                    <tr key={product.id} style={{ 
                      borderBottom: '1px solid #e5e7eb',
                      background: index % 2 === 0 ? 'white' : '#f8fafc',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#eff6ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#f8fafc';
                    }}>
                      <td style={{ padding: '12px', color: '#111827' }}>
                        <div>
                          <strong>{product.name}</strong>
                          <div style={{ fontSize: '12px', color: '#6b7280', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {product.status && (
                              <span style={{
                                display: 'inline-block',
                                padding: '1px 8px',
                                background: product.status === 'active' ? '#dcfce7' : '#fee2e2',
                                color: product.status === 'active' ? '#16a34a' : '#dc2626',
                                borderRadius: '12px',
                                fontSize: '10px',
                                fontWeight: '600',
                                marginTop: '4px'
                              }}>
                                {product.status.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: '#111827' }}>
                        {product.seller_id?.substring(0, 8) || 'Unknown'}
                      </td>
                      <td style={{ padding: '12px', color: '#111827', fontWeight: 'bold' }}>${product.price}</td>
                      <td style={{ padding: '12px', color: '#111827' }}>{product.views || 0}</td>
                      <td style={{ padding: '12px', color: '#111827' }}>
                        {product.image_url ? (
                          <span style={{ color: '#16a34a' }}>✅ Has Image</span>
                        ) : (
                          <span style={{ color: '#dc2626' }}>❌ No Image</span>
                        )}
                      </td>
                      <td style={{ padding: '12px', color: '#111827' }}>{new Date(product.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button 
                            onClick={() => window.open(`/product/${product.id}`, '_blank')}
                            style={{ 
                              padding: '4px 12px',
                              background: '#2563eb',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
                          >
                            View
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(product.id)}
                            style={{ 
                              padding: '4px 12px',
                              background: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
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
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#111827', margin: '0 0 20px 0' }}>📈 Advanced Analytics</h2>
          
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#111827', marginBottom: '15px' }}>🔥 Top Products by Views</h3>
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
                      ticks: {
                        color: '#6b7280'
                      },
                      beginAtZero: true
                    },
                    y: {
                      grid: {
                        color: 'rgba(0,0,0,0.05)'
                      },
                      ticks: {
                        color: '#6b7280'
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          <div>
            <h3 style={{ color: '#111827', marginBottom: '15px' }}>⚡ Engagement Metrics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
              <div style={{ textAlign: 'center', padding: '15px', background: '#dbeafe', borderRadius: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>
                  {stats.dailyStats.reduce((sum, day) => sum + (day.searches || 0), 0)}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>Total Searches</div>
              </div>
              <div style={{ textAlign: 'center', padding: '15px', background: '#dcfce7', borderRadius: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>
                  {stats.dailyStats.reduce((sum, day) => sum + (day.contacts || 0), 0)}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>Total Contacts</div>
              </div>
              <div style={{ textAlign: 'center', padding: '15px', background: '#fef3c7', borderRadius: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                  {stats.products.filter(p => p.views > 0).length}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>Products Viewed</div>
              </div>
              <div style={{ textAlign: 'center', padding: '15px', background: '#f3e8ff', borderRadius: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c3aed' }}>
                  {stats.recentUsers.length}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>New Users (24h)</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '30px' }}>
            <h3 style={{ color: '#111827', marginBottom: '15px' }}>⚡ Real-time Activity Feed</h3>
            <div style={{ 
              maxHeight: '280px',
              overflowY: 'auto',
              background: '#f8fafc',
              borderRadius: '10px',
              padding: '10px'
            }}>
              {realtimeData.recentActivities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                  No recent activities
                </div>
              ) : (
                realtimeData.recentActivities.map((activity, index) => {
                  const colors = {
                    'search': '#2563eb',
                    'contact': '#16a34a',
                    'view_product': '#f59e0b',
                    'save_wishlist': '#7c3aed',
                    'login': '#dc2626'
                  };
                  const color = colors[activity.action_type] || '#6b7280';
                  
                  return (
                    <div key={index} style={{
                      padding: '10px',
                      borderBottom: '1px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: index === 0 ? '#eff6ff' : 'transparent',
                      borderRadius: '6px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = index === 0 ? '#eff6ff' : 'transparent';
                    }}>
                      <span style={{
                        padding: '2px 10px',
                        background: color,
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '600'
                      }}>
                        {activity.action_type.replace('_', ' ').toUpperCase()}
                      </span>
                      <span style={{ flex: 1, fontSize: '12px', color: '#111827' }}>
                        User {activity.user_id?.substring(0, 8)}...
                      </span>
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>
                        {new Date(activity.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Analytics Tab */}
      {activeTab === 'errors' && (
        <div style={{ 
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <AdminErrorAnalytics />
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #f3f4f6;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>

      {/* INCOMPLETE USERS SECTION */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginTop: '30px'
      }}>
        <h2 style={{ color: '#111827', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
          <span>⚠️ Incomplete Users ({incompleteUsers.length})</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={async () => {
                console.log('🔄 Manual refresh triggered...');
                setLoading(true);
                await fetchIncompleteUsers();
                await fetchAuthStats();
                setLoading(false);
                console.log('✅ Manual refresh complete!');
              }}
              style={{
                padding: '6px 14px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              🔄 Refresh List
            </button>
            <span style={{ fontSize: '14px', color: '#f59e0b', fontWeight: 'normal' }}>
              {incompleteUsers.length === 0 ? '✅ All users complete!' : 'Users needing setup'}
            </span>
          </div>
        </h2>

        {incompleteUsers.length === 0 ? (
          <p style={{ color: '#16a34a', textAlign: 'center', padding: '20px' }}>
            ✅ No incomplete users found
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fef3c7' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>User Info</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>Created</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {incompleteUsers.map((user, index) => (
                  <tr key={user.user_id} style={{
                    borderBottom: '1px solid #e5e7eb',
                    background: index % 2 === 0 ? 'white' : '#fef3c7'
                  }}>
                    <td style={{ padding: '12px', color: '#111827' }}>
                      <div>
                        <strong>{user.username || 'No username'}</strong>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                          ID: {user.user_id.substring(0, 12)}...
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          📍 {user.location || 'No location'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                          📞 {user.phone_number || 'No phone'}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: '#111827', fontSize: '13px' }}>
                      {new Date(user.created_at).toLocaleDateString()}
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        {new Date(user.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => deleteUserCompletely(user.user_id)}
                        style={{
                          padding: '8px 16px',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
                      >
                        🗑️ Delete User
                      </button>
                      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                        Deletes all user data
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PRODUCTS WITH NO IMAGES SECTION */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginTop: '30px'
      }}>
        <h2 style={{ color: '#111827', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
          <span>🖼️ Products Without Images ({productsWithNoImages.length})</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            {productsWithNoImages.length > 0 && (
              <button
                onClick={deleteAllProductsWithNoImages}
                style={{
                  padding: '8px 16px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
              >
                🗑️ Delete All
              </button>
            )}
          </div>
        </h2>

        {productsWithNoImages.length === 0 ? (
          <p style={{ color: '#16a34a', textAlign: 'center', padding: '20px' }}>
            ✅ All products have images
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fee2e2' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>Product</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>Price</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>Seller</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>Created</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#111827', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {productsWithNoImages.map((product, index) => (
                  <tr key={product.id} style={{
                    borderBottom: '1px solid #e5e7eb',
                    background: index % 2 === 0 ? 'white' : '#fee2e2'
                  }}>
                    <td style={{ padding: '12px', color: '#111827' }}>
                      <strong>{product.name}</strong>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        {product.description ? product.description.substring(0, 50) + '...' : 'No description'}
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: '#111827', fontWeight: 'bold' }}>
                      ${product.price}
                    </td>
                    <td style={{ padding: '12px', color: '#111827', fontSize: '13px' }}>
                      {product.seller_id?.substring(0, 8) || 'Unknown'}
                    </td>
                    <td style={{ padding: '12px', color: '#111827', fontSize: '13px' }}>
                      {new Date(product.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => deleteProductWithNoImage(product.id)}
                        style={{
                          padding: '6px 14px',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
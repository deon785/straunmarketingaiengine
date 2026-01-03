import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { userMonitor } from './userBehaviorMonitor';

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
    
    const handleUnblockUser = (userId) => {
        // You'd need to add an unblock method to userMonitor
        console.log('Unblock user:', userId);
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
  // 1. Initialize state with all three arrays/counts
  const [stats, setStats] = useState({ 
    users: 0, 
    feedback: [], 
    products: [] 
  });
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);

  // Fetch reports
  useEffect(() => {
    const fetchReports = async () => {
      const { data } = await supabase
        .from('reports')
        .select(`
          *,
          reporter:reporter_id (email),
          reported_user:reported_user_id (email)
        `)
        .order('created_at', { ascending: false });
      setReports(data || []);
    };
    fetchReports();
  }, []);

  // FIXED: handleResolveReport function - added report parameter
  const handleResolveReport = async (reportId, action, reportedUserId) => {
    try {
      if (action === 'ban' && reportedUserId) {
        // Ban the reported user
        const { error: banError } = await supabase
          .from('profiles')
          .update({ banned: true })
          .eq('user_id', reportedUserId);
        
        if (banError) {
          console.error('Error banning user:', banError);
          alert('Error banning user. Check console.');
          return;
        }
        alert(`User ${reportedUserId.substring(0, 8)}... has been banned.`);
      }
      
      // Mark report as resolved
      const { error: updateError } = await supabase
        .from('reports')
        .update({ status: 'resolved' })
        .eq('id', reportId);
      
      if (updateError) {
        console.error('Error updating report:', updateError);
        alert('Error updating report status.');
        return;
      }
      
      // Refresh reports
      const { data } = await supabase
        .from('reports')
        .select(`
          *,
          reporter:reporter_id (email),
          reported_user:reported_user_id (email)
        `)
        .order('created_at', { ascending: false });
      
      setReports(data || []);
      alert('Report resolved successfully.');
      
    } catch (error) {
      console.error('Error in handleResolveReport:', error);
      alert('An unexpected error occurred. Check console.');
    }
  };

  // Dismiss report without banning
  const handleDismissReport = async (reportId) => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: 'dismissed' })
        .eq('id', reportId);
      
      if (error) throw error;
      
      // Refresh reports
      const { data } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      
      setReports(data || []);
      alert('Report dismissed.');
      
    } catch (error) {
      console.error('Error dismissing report:', error);
      alert('Error dismissing report.');
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // 2. Fetch User Count
        const { count: userCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        // 3. Fetch Feedback
        const { data: feedbackData } = await supabase
          .from('feedback')
          .select('*')
          .order('created_at', { ascending: false });

        // 4. Fetch Products with joined Profiles
        const { data: productsData } = await supabase
          .from('products')
          .select(`
            id,
            name,
            price,
            created_at,
            profiles!seller_id (
                username,          
                role
            )
          `)
          .order('created_at', { ascending: false });

        // 5. Update state all at once
        setStats({
          users: userCount || 0,
          feedback: feedbackData || [],
          products: productsData || []
        });
      } catch (error) {
        console.error("Error loading admin data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  if (loading) return <div style={{ padding: '40px' }}>Loading Dashboard Data...</div>;

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Admin Monitoring</h1>
      
      {/* Quick Stats Row */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <div style={{ 
          background: reports.filter(r => r.status === 'pending').length > 0 ? '#fef3c7' : '#f3f4f6',
          padding: '15px',
          borderRadius: '8px',
          border: reports.filter(r => r.status === 'pending').length > 0 ? '2px solid #f59e0b' : '1px solid #ddd',
          minWidth: '200px'
        }}>
          <h3>Pending Reports</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: reports.filter(r => r.status === 'pending').length > 0 ? '#d97706' : '#333' }}>
            {reports.filter(r => r.status === 'pending').length}
          </p>
          {reports.filter(r => r.status === 'pending').length > 0 && (
            <p style={{ fontSize: '12px', color: '#92400e', marginTop: '5px' }}>⚠️ Needs attention</p>
          )}
        </div>
        
        <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '10px', border: '1px solid #ddd', minWidth: '200px' }}>
          <h3>Total Users</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>{stats.users}</p>
        </div>
        <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '10px', border: '1px solid #ddd', minWidth: '200px' }}>
          <h3>Live Products</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>{stats.products.length}</p>
        </div>
      </div>

      {/* REPORTS SECTION - MOVED TO TOP (MOST IMPORTANT) */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: reports.filter(r => r.status === 'pending').length > 0 ? '#dc2626' : '#333' }}>
          📢 User Reports ({reports.filter(r => r.status === 'pending').length} pending)
          {reports.filter(r => r.status === 'pending').length > 0 && (
            <span style={{ fontSize: '14px', background: '#dc2626', color: 'white', padding: '2px 8px', borderRadius: '10px' }}>
              ACTION NEEDED
            </span>
          )}
        </h2>
        
        {reports.length === 0 ? (
          <p>No reports yet. Users can report suspicious listings/users.</p>
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
                    <p><strong>Reason:</strong> <span style={{ 
                      background: '#e5e7eb', 
                      padding: '2px 8px', 
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}>{report.reason}</span></p>
                    <p><strong>Reported by:</strong> {report.reporter?.email || 'Unknown'}</p>
                    <p><strong>Against user:</strong> {report.reported_user?.email || 'Unknown'}</p>
                    <p><strong>Date:</strong> {new Date(report.created_at).toLocaleString()}</p>
                    {report.description && (
                      <p><strong>Details:</strong> {report.description}</p>
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
                      fontWeight: 'bold'
                    }}>
                      {report.status.toUpperCase()}
                    </div>
                  </div>
                </div>
                
                {report.status === 'pending' && (
                  <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={() => handleResolveReport(report.id, 'ban', report.reported_user_id)}
                      style={{ 
                        padding: '8px 20px', 
                        background: '#dc2626', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
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
                        cursor: 'pointer'
                      }}
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
                        cursor: 'pointer'
                      }}
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

      {/* Products Table */}
      <h2>Recent Product Listings ({stats.products.length})</h2>
      <div style={{ overflowX: 'auto', marginBottom: '40px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee', background: '#f9f9f9' }}>
              <th style={{ padding: '12px' }}>Product</th>
              <th>Seller</th>
              <th>Price</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {stats.products.slice(0, 10).map((product) => (
              <tr key={product.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px' }}>{product.name}</td>
                <td style={{ color: '#666' }}>{product.profiles?.email || product.profiles?.username || 'N/A'}</td>
                <td>${product.price}</td>
                <td>{new Date(product.created_at).toLocaleDateString()}</td>
                <td>
                  <button 
                    onClick={() => {
                      // Add function to view product or take action
                      window.open(`/product/${product.id}`, '_blank');
                    }}
                    style={{ 
                      padding: '4px 12px', 
                      background: '#3b82f6', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Feedback Table */}
      <h2>User Feedback ({stats.feedback.length})</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee', background: '#f9f9f9' }}>
              <th style={{ padding: '12px' }}>Date</th>
              <th>Message</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {stats.feedback.slice(0, 10).map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{new Date(item.created_at).toLocaleDateString()}</td>
                <td>{item.feedback_text}</td>
                <td>
                  <button 
                    onClick={() => {
                      // Add function to respond to feedback
                      alert(`Respond to feedback from ${item.user_id}`);
                    }}
                    style={{ 
                      padding: '4px 12px', 
                      background: '#8b5cf6', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    Respond
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
    </div>
  );
};

export default AdminDashboard;
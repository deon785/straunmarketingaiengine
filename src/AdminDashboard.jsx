import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

const AdminDashboard = () => {
  // 1. Initialize state with all three arrays/counts
  const [stats, setStats] = useState({ 
    users: 0, 
    feedback: [], 
    products: [] 
  });
  const [loading, setLoading] = useState(true);

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
      
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '10px', border: '1px solid #ddd' }}>
          <h3>Total Users</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>{stats.users}</p>
        </div>
        <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '10px', border: '1px solid #ddd' }}>
          <h3>Live Products</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>{stats.products.length}</p>
        </div>
      </div>

      {/* Products Table */}
      <h2>Recent Product Listings</h2>
      <div style={{ overflowX: 'auto', marginBottom: '40px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee', background: '#f9f9f9' }}>
              <th style={{ padding: '12px' }}>Product</th>
              <th>Seller (Email)</th>
              <th>Price</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {stats.products.map((product) => (
              <tr key={product.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px' }}>{product.name}</td>
                <td style={{ color: '#666' }}>{product.profiles?.email || 'N/A'}</td>
                <td>${product.price}</td>
                <td>{new Date(product.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Feedback Table */}
      <h2>User Feedback</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee', background: '#f9f9f9' }}>
              <th style={{ padding: '12px' }}>Date</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {stats.feedback.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{new Date(item.created_at).toLocaleDateString()}</td>
                <td>{item.feedback_text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
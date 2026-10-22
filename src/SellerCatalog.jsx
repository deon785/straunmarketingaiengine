import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import ReactGA from 'react-ga4';

const T = {
  text: '#0f172a', textMuted: '#64748b',
  card: '#ffffff', bg: '#f1f5f9', border: '#e2e8f0',
  primary: '#4361ee', errorText: '#dc2626', success: '#10b981'
};

const SellerCatalog = ({ products, onEdit, onDeleted, onAddFirst }) => {
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [updatingStockId, setUpdatingStockId] = useState(null);

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setDeletingId(product.id);
    setError(null);
    try {
      if (product.image_url?.includes('supabase.co/storage')) {
        const fileName = product.image_url.split('/').pop();
        await supabase.storage.from('product-images').remove([fileName]);
      }
      
      const { error: delErr } = await supabase.from('products').delete().eq('id', product.id);
      
      if (delErr) {
        // ✅ CHECK FOR FOREIGN KEY ERROR (409)
        if (delErr.code === '23503') {
          throw new Error("Cannot delete this product because buyers have saved it or interacted with it. Try marking it as 'Sold' instead.");
        }
        throw delErr;
      }
      
      ReactGA.event({ category: 'Seller', action: 'Product_Deleted' });
      onDeleted?.(product.id);
      
    } catch (err) {
      console.error('Delete failed:', err);
      // Show a clean message instead of a giant database error object
      setError(err.message || 'Failed to delete product.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateStock = async (product, change) => {
    const currentStock = product.stock || 0;
    const newStock = Math.max(0, currentStock + change); // Prevent negative stock

    if (newStock === currentStock) return; // Don't do anything if already at 0

    setUpdatingStockId(product.id);
    try {
      const { error: updateErr } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', product.id);

      if (updateErr) throw updateErr;
      
      // Update the local state instantly so the UI feels snappy
      // We call the parent's fetch function if provided, or you can update the array directly.
      // For simplicity, we reload the products from the parent.
      if (onEdit) {
         // We use a trick: just trigger a re-fetch by calling the parent's fetch function
         // In this setup, modifying the array directly is faster:
         product.stock = newStock; 
         // Force a re-render (if your parent doesn't auto-update)
         onDeleted?.(null); // Hack to trigger refresh - ideally, you pass a 'onRefresh' prop
      }
      
    } catch (err) {
      console.error('Stock update failed:', err);
      alert('Failed to update stock.');
    } finally {
      setUpdatingStockId(null);
    }
  };

  if (!products || products.length === 0) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: '16px' }}>🍼</div>
        <h3 style={{ fontSize: '20px', fontWeight: 700, color: T.text, marginBottom: '8px' }}>No products yet</h3>
        <p style={{ fontSize: '15px', color: T.textMuted, marginBottom: '24px' }}>Add your first item to start selling.</p>
        <button
          onClick={onAddFirst}
          style={{ padding: '14px 28px', background: T.primary, color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(67,97,238,0.3)' }}
        >
          ＋ Add First Product
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', marginBottom: '16px' }}>
          <p style={{ color: T.errorText, fontSize: '13px', margin: 0 }}>{error}</p>
        </div>
      )}

      <div style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
        <span>Your Products</span>
        <span style={{ color: T.textMuted, fontSize: '14px', fontWeight: 500 }}>{products.length} items</span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px'
      }}>
        {products.map((p) => (
          <div
            key={p.id}
            style={{
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: '16px', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}
          >
            {/* Image Area */}
            <div style={{ position: 'relative', paddingTop: '65%', background: T.bg }}>
              {p.image_url ? (
                <img 
                  src={p.image_url} 
                  alt={p.name} 
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>
                  🍼
                </div>
              )}
              {/* Status Badge */}
              <div style={{
                position: 'absolute', top: '12px', right: '12px',
                background: p.status === 'active' ? '#dcfce7' : '#fef3c7',
                color: p.status === 'active' ? '#166534' : '#92400e',
                padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase'
              }}>
                {p.status || 'Active'}
              </div>
            </div>

            {/* Content Area */}
            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: T.text, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.name}
              </div>
              <div style={{ fontSize: '13px', color: T.textMuted, marginBottom: '12px' }}>
                📍 {p.location}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: T.primary, marginBottom: '16px' }}>
                ${Number(p.price).toFixed(2)}
              </div>
              
              {/* ✅ NEW: Stock Counter */}
              <div style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: T.bg, padding: '8px 12px', borderRadius: '10px',
                marginBottom: '16px', border: `1px solid ${T.border}`
              }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: T.textMuted }}>Stock Left:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={() => handleUpdateStock(p, -1)}
                    disabled={updatingStockId === p.id || (p.stock || 0) <= 0}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      border: 'none', background: (p.stock || 0) <= 0 ? '#e2e8f0' : 'white',
                      color: (p.stock || 0) <= 0 ? '#94a3b8' : T.text, fontSize: '18px',
                      fontWeight: 'bold', cursor: (p.stock || 0) <= 0 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    −
                  </button>
                  
                  <span style={{ fontSize: '16px', fontWeight: 800, width: '24px', textAlign: 'center', color: (p.stock || 0) > 0 ? T.success : T.errorText }}>
                    {updatingStockId === p.id ? '...' : (p.stock ?? 0)}
                  </span>
                  
                  <button
                    onClick={() => handleUpdateStock(p, 1)}
                    disabled={updatingStockId === p.id}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      border: 'none', background: 'white', color: T.text,
                      fontSize: '18px', fontWeight: 'bold', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    ＋
                  </button>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  onClick={() => onEdit?.(p)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${T.border}`, background: 'white', color: T.text, fontFamily: 'inherit' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  disabled={deletingId === p.id}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: deletingId === p.id ? 'not-allowed' : 'pointer', border: '1px solid #fecaca', background: '#fef2f2', color: T.errorText, fontFamily: 'inherit' }}
                >
                  {deletingId === p.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SellerCatalog;
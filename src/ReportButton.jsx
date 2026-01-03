import { useState } from 'react';
import { supabase } from './lib/supabase';

// Define style objects outside the component
const floatingStyle = {
  position: 'fixed',
  bottom: '20px',
  right: '20px',
  zIndex: 1000,
  backgroundColor: '#ff3b30',
  color: 'white',
  border: 'none',
  padding: '12px 16px',
  borderRadius: '50px',
  fontWeight: 'bold',
  fontSize: '14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  transition: 'all 0.3s ease',
};

const defaultStyle = {
  backgroundColor: '#ff3b30',
  color: 'white',
  border: 'none',
  padding: '8px 12px',
  borderRadius: '6px',
  fontWeight: 'bold',
  fontSize: '12px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
};

export default function ReportButton({ 
  targetUserId, 
  listingId, 
  listingTitle, 
  floating = false,  // Add floating prop with default value
  style = {}        // Add style prop with default value
}) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          reported_user_id: targetUserId,
          listing_id: listingId,
          reason: reason,
          description: `Reported ${listingTitle || 'user'}`
        });

      if (error) throw error;
      
      alert('Report submitted. We will review within 24 hours.');
      setShowModal(false);
    } catch (error) {
      alert('Error submitting report');
    } finally {
      setLoading(false);
    }
  };

  // Determine which style to use
  const buttonStyle = floating 
    ? { ...floatingStyle, ...style } 
    : { ...defaultStyle, ...style };

  return (
    <>
      {/* REPORT BUTTON */}
      <button 
        style={buttonStyle}
        onClick={() => setShowModal(true)}
        className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
      >
        {floating ? '⚠️ Report Issue' : 'Report'}
      </button>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Report Content</h3>
            
            <div className="space-y-2 mb-4">
              {['scam', 'fake', 'harassment', 'spam', 'illegal'].map((r) => (
                <label key={r} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={(e) => setReason(e.target.value)}
                    className="h-4 w-4"
                  />
                  <span className="capitalize">{r}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || loading}
                className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
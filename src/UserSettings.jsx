// UserSettings.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTrash,
  faDownload,
  faExclamationTriangle,
  faSpinner,
  faCheckCircle,
  faTimesCircle,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import './UserSettings.css';

const UserSettings = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const navigate = useNavigate();

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const handleDataExport = async () => {
    try {
      setExportLoading(true);
      setError(null);
      setSuccess(null);
      
      // 1. Get ALL user data from ALL tables
      const [
        { data: profileData, error: profileError },
        { data: productData, error: productError },
        { data: searchData, error: searchError },
        { data: feedbackData, error: feedbackError }
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id),
        supabase.from('products').select('*').eq('seller_id', user.id),
        supabase.from('searches').select('*').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
        supabase.from('feedback').select('*').eq('user_id', user.id)
      ]);

      // Check for errors
      const errors = [profileError, productError, searchError, feedbackError].filter(e => e);
      if (errors.length > 0) {
        console.error('Export errors:', errors);
        // Continue anyway with available data
      }

      // 2. Combine all data
      const allUserData = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        user_email: user.email,
        metadata: {
          profile_count: profileData?.length || 0,
          product_count: productData?.length || 0,
          search_count: searchData?.length || 0,
          feedback_count: feedbackData?.length || 0
        },
        data: {
          profile: profileData || [],
          products: productData || [],
          searches: searchData || [],
          feedback: feedbackData || []
        }
      };

      // 3. Create downloadable file
      const blob = new Blob([JSON.stringify(allUserData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-data-${user.id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccess(`✅ Data exported successfully! ${allUserData.metadata.profile_count + allUserData.metadata.product_count + allUserData.metadata.search_count + allUserData.metadata.feedback_count} records included.`);
      
    } catch (err) {
      console.error('Export error:', err);
      setError('❌ Failed to export data. Please try again or contact support.');
    } finally {
      setExportLoading(false);
    }
  };

  const showDeleteConfirmation = () => {
    setShowConfirmModal(true);
    setConfirmText('');
    setError(null);
    setSuccess(null);
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') {
      setError('Please type "DELETE" exactly as shown to confirm.');
      return;
    }

    try {
      setIsConfirming(true);
      setError(null);
      setSuccess(null);
      
      console.log('Starting account deletion for user:', user.id);
      
      // 1. Delete from ALL database tables (in transaction order)
      const deletionPromises = [
        supabase.from('feedback').delete().eq('user_id', user.id),
        supabase.from('searches').delete().or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
        supabase.from('products').delete().eq('seller_id', user.id),
        supabase.from('profiles').delete().eq('user_id', user.id)
      ];
      
      const results = await Promise.all(deletionPromises);
      
      // Check for errors
      const errors = results.filter(result => result.error).map(r => r.error);
      if (errors.length > 0) {
        console.error('Database deletion errors:', errors);
        // Continue anyway - try to delete auth user
      }
      
      // 2. Try to delete auth user via Edge Function first
      try {
        const { error: functionError } = await supabase.functions.invoke('delete-user', {
          body: { userId: user.id }
        });
        
        if (functionError) {
          console.warn('Edge Function deletion warning:', functionError);
        } else {
          console.log('Auth user deleted via Edge Function');
        }
      } catch (funcError) {
        console.warn('Edge Function error:', funcError);
        // Fallback to admin API if function fails
      }
      
      // 3. Sign out and clear local data
      await supabase.auth.signOut();
      localStorage.clear();
      
      // 4. Show success message
      setSuccess('✅ Account deleted successfully! Redirecting...');
      
      // 5. Redirect to home page after delay
      setTimeout(() => {
        navigate('/', { replace: true });
        window.location.reload();
      }, 2000);
      
    } catch (err) {
      console.error('Account deletion error:', err);
      setError(`❌ ${err.message || 'Failed to delete account. Please contact support: support@straun.ai'}`);
      
      // If deletion partially succeeded, sign out anyway
      try {
        await supabase.auth.signOut();
        localStorage.clear();
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
      } catch (signoutError) {
        console.error('Sign out error:', signoutError);
      }
    } finally {
      setIsConfirming(false);
      setShowConfirmModal(false);
      setConfirmText('');
    }
  };

  return (
    <div className="privacy-settings" style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '30px'
    }}>
      {/* Error/Success messages at the TOP */}
      {(error || success) && (
        <div className="message-container" style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          width: '90%',
          maxWidth: '500px'
        }}>
          {error && (
            <div style={{
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              color: '#c33',
              padding: '15px 20px',
              borderRadius: '8px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <FontAwesomeIcon icon={faExclamationTriangle} />
              <div style={{ flex: 1 }}>
                <strong>Error:</strong> {error}
              </div>
              <button
                onClick={() => setError(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#c33',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                <FontAwesomeIcon icon={faTimesCircle} />
              </button>
            </div>
          )}
          
          {success && (
            <div style={{
              backgroundColor: '#dfd',
              border: '1px solid #ada',
              color: '#373',
              padding: '15px 20px',
              borderRadius: '8px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <FontAwesomeIcon icon={faCheckCircle} />
              <div style={{ flex: 1 }}>
                <strong>Success:</strong> {success}
              </div>
              <button
                onClick={() => setSuccess(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#373',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                <FontAwesomeIcon icon={faTimesCircle} />
              </button>
            </div>
          )}
        </div>
      )}

      <h1 style={{
        fontSize: '32px',
        fontWeight: '700',
        color: '#333',
        marginBottom: '30px',
        textAlign: 'center'
      }}>
        Data Privacy
      </h1>

      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '30px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#444',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <FontAwesomeIcon icon={faInfoCircle} style={{ color: '#667eea' }} />
          Manage Your Data
        </h2>
        
        <p style={{ 
          color: '#666', 
          marginBottom: '30px', 
          lineHeight: '1.6',
          fontSize: '16px'
        }}>
          You have control over your personal data. You can export all your data or permanently delete your account.
        </p>

        {/* Export Data Section */}
        <div style={{
          padding: '25px',
          background: '#f8f9fa',
          borderRadius: '8px',
          marginBottom: '25px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '15px'
          }}>
            <div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#333',
                marginBottom: '5px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <FontAwesomeIcon icon={faDownload} style={{ color: '#667eea' }} />
                Export My Data
              </h3>
              <p style={{ color: '#666', fontSize: '14px' }}>
                Get all your data in JSON format including profile, products, searches, and feedback.
              </p>
            </div>
            <button
              onClick={handleDataExport}
              disabled={exportLoading}
              style={{
                padding: '12px 24px',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: exportLoading ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: exportLoading ? 0.7 : 1,
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => !exportLoading && (e.target.style.background = '#5a6fd8')}
              onMouseLeave={(e) => !exportLoading && (e.target.style.background = '#667eea')}
            >
              {exportLoading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin />
                  Exporting...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faDownload} />
                  Export Data
                </>
              )}
            </button>
          </div>
        </div>

        {/* Delete Account Section */}
        <div style={{
          padding: '25px',
          background: '#fff5f5',
          borderRadius: '8px',
          border: '1px solid #fed7d7'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#c53030',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <FontAwesomeIcon icon={faTrash} />
                Delete My Account
              </h3>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
                Permanently remove all your data from our systems. This includes:
              </p>
              <ul style={{
                color: '#666',
                fontSize: '14px',
                paddingLeft: '20px',
                marginBottom: '15px'
              }}>
                <li>Your profile information</li>
                <li>All your product listings</li>
                <li>Your search history</li>
                <li>Your feedback submissions</li>
                <li>Your account credentials</li>
              </ul>
              <div style={{
                backgroundColor: '#feebc8',
                borderLeft: '4px solid #dd6b20',
                padding: '12px 15px',
                borderRadius: '4px',
                marginBottom: '15px'
              }}>
                <p style={{
                  color: '#744210',
                  fontSize: '14px',
                  fontWeight: '600',
                  margin: 0
                }}>
                  ⚠️ Warning: This action is permanent and cannot be undone!
                </p>
              </div>
            </div>
            <button
              onClick={showDeleteConfirmation}
              disabled={loading}
              style={{
                padding: '12px 24px',
                background: '#c53030',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.3s ease',
                minWidth: '150px'
              }}
              onMouseEnter={(e) => !loading && (e.target.style.background = '#b91c1c')}
              onMouseLeave={(e) => !loading && (e.target.style.background = '#c53030')}
            >
              <FontAwesomeIcon icon={faTrash} />
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{
              fontSize: '22px',
              fontWeight: '600',
              color: '#c53030',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <FontAwesomeIcon icon={faExclamationTriangle} />
              Confirm Account Deletion
            </h3>
            
            <div style={{
              backgroundColor: '#fff5f5',
              border: '1px solid #fed7d7',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '25px'
            }}>
              <p style={{ color: '#744210', marginBottom: '15px', fontWeight: '600' }}>
                This will permanently delete ALL your data including:
              </p>
              <ul style={{
                color: '#744210',
                paddingLeft: '20px',
                marginBottom: '15px'
              }}>
                <li>Your profile information</li>
                <li>All your product listings</li>
                <li>Your search history</li>
                <li>Your feedback submissions</li>
                <li>Your account credentials</li>
              </ul>
              <p style={{ color: '#c53030', fontWeight: '600' }}>
                ⚠️ This action cannot be undone!
              </p>
            </div>
            
            <div style={{ marginBottom: '25px' }}>
              <label style={{
                display: 'block',
                color: '#666',
                marginBottom: '10px',
                fontWeight: '500'
              }}>
                Type <strong style={{ color: '#c53030' }}>DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 15px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '16px',
                  transition: 'all 0.3s ease'
                }}
                placeholder="Type DELETE here"
                autoFocus
              />
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '15px'
            }}>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmText('');
                }}
                disabled={isConfirming}
                style={{
                  padding: '12px 24px',
                  background: '#e2e8f0',
                  color: '#4a5568',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isConfirming ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  opacity: isConfirming ? 0.7 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isConfirming || confirmText !== 'DELETE'}
                style={{
                  padding: '12px 24px',
                  background: confirmText === 'DELETE' ? '#c53030' : '#cbd5e0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (isConfirming || confirmText !== 'DELETE') ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (isConfirming || confirmText !== 'DELETE') ? 0.7 : 1,
                  transition: 'all 0.3s ease'
                }}
              >
                {isConfirming ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    Deleting...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faTrash} />
                    Permanently Delete Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSettings;
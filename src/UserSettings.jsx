// UserSettings.jsx - Dark Theme Version with Theme Customization
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

  // Load saved theme on component mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('user_theme');
    if (savedTheme) {
      document.body.classList.remove('dark-theme', 'light-theme', 'ocean-theme', 'sunset-theme', 'forest-theme');
      document.body.classList.add(`${savedTheme}-theme`);
    }
  }, []);

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

      const errors = [profileError, productError, searchError, feedbackError].filter(e => e);
      if (errors.length > 0) {
        console.error('Export errors:', errors);
      }

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
      
      const deletionPromises = [
        supabase.from('feedback').delete().eq('user_id', user.id),
        supabase.from('searches').delete().or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
        supabase.from('products').delete().eq('seller_id', user.id),
        supabase.from('profiles').delete().eq('user_id', user.id)
      ];
      
      const results = await Promise.all(deletionPromises);
      
      const errors = results.filter(result => result.error).map(r => r.error);
      if (errors.length > 0) {
        console.error('Database deletion errors:', errors);
      }
      
      try {
          console.log('Attempting to delete auth user via Edge Function...');
          const { data: functionData, error: functionError } = await supabase.functions.invoke('delete-user', {
              body: { userId: user.id }
          });
          
          if (functionError) {
              console.error('Edge Function error details:', functionError);
              setError(`Auth deletion failed: ${functionError.message}. Please contact support.`);
              return;
          }
          
          console.log('Auth user deleted successfully:', functionData);
          
      } catch (funcError) {
          console.error('Edge Function exception:', funcError);
          setError(`Failed to delete auth account: ${funcError.message}`);
          return;
      }
      await supabase.auth.signOut();
      localStorage.clear();
      
      setSuccess('✅ Account deleted successfully! Redirecting...');
      
      setTimeout(() => {
        navigate('/', { replace: true });
        window.location.reload();
      }, 2000);
      
    } catch (err) {
      console.error('Account deletion error:', err);
      setError(`❌ ${err.message || 'Failed to delete account. Please contact support: support@straun.ai'}`);
      
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
  <div className="privacy-settings">
    {/* Error/Success messages */}
    {(error || success) && (
      <div className="message-container">
        {error && (
          <div className="error-message">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            <div style={{ flex: 1 }}>
              <strong>Error:</strong> {error}
            </div>
            <button onClick={() => setError(null)} className="close-btn">
              <FontAwesomeIcon icon={faTimesCircle} />
            </button>
          </div>
        )}
        
        {success && (
          <div className="success-message">
            <FontAwesomeIcon icon={faCheckCircle} />
            <div style={{ flex: 1 }}>
              <strong>Success:</strong> {success}
            </div>
            <button onClick={() => setSuccess(null)} className="close-btn">
              <FontAwesomeIcon icon={faTimesCircle} />
            </button>
          </div>
        )}
      </div>
    )}

    <h1 className="settings-title">
      Data Privacy
    </h1>

    <div className="settings-card">
      <h2 className="settings-card-title">
        <FontAwesomeIcon icon={faInfoCircle} />
        Manage Your Data
      </h2>
      
      <p className="settings-description">
        You have control over your personal data. You can export all your data or permanently delete your account.
      </p>

      {/* Export Data Section */}
      <div className="export-section">
        <div className="export-header">
          <div>
            <h3 className="export-title">
              <FontAwesomeIcon icon={faDownload} />
              Export My Data
            </h3>
            <p className="export-description">
              Get all your data in JSON format including profile, products, searches, and feedback.
            </p>
          </div>
          <button
            onClick={handleDataExport}
            disabled={exportLoading}
            className="export-btn"
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
      <div className="delete-section">
        <div className="delete-header">
          <div style={{ flex: 1 }}>
            <h3 className="delete-title">
              <FontAwesomeIcon icon={faTrash} />
              Delete My Account
            </h3>
            <p className="delete-description">
              Permanently remove all your data from our systems. This includes:
            </p>
            <ul className="delete-list">
              <li>Your profile information</li>
              <li>All your product listings</li>
              <li>Your search history</li>
              <li>Your feedback submissions</li>
              <li>Your account credentials</li>
            </ul>
            <div className="warning-box">
              <p className="warning-text">
                ⚠️ Warning: This action is permanent and cannot be undone!
              </p>
            </div>
          </div>
          <button
            onClick={showDeleteConfirmation}
            disabled={loading}
            className="delete-btn"
          >
            <FontAwesomeIcon icon={faTrash} />
            Delete Account
          </button>
        </div>

        {/* Theme Customization Section */}
        <div className="theme-section">
          <h3 className="theme-title">
            <span style={{ fontSize: '20px' }}>🎨</span>
            Theme Customization
          </h3>
          <p className="theme-description">
            Choose your preferred app theme
          </p>
          
          <div className="theme-buttons">
            <button onClick={() => {
              localStorage.setItem('user_theme', 'dark');
              document.body.classList.add('dark-theme');
              document.body.classList.remove('light-theme', 'ocean-theme', 'sunset-theme', 'forest-theme');
              setSuccess('✅ Theme changed to Dark');
            }} className="theme-btn">
              🌙 Dark
            </button>
            
            <button onClick={() => {
              localStorage.setItem('user_theme', 'light');
              document.body.classList.add('light-theme');
              document.body.classList.remove('dark-theme', 'ocean-theme', 'sunset-theme', 'forest-theme');
              setSuccess('✅ Theme changed to Light');
            }} className="theme-btn">
              ☀️ Light
            </button>
            
            <button onClick={() => {
              localStorage.setItem('user_theme', 'ocean');
              document.body.classList.add('ocean-theme');
              document.body.classList.remove('dark-theme', 'light-theme', 'sunset-theme', 'forest-theme');
              setSuccess('✅ Theme changed to Ocean Blue');
            }} className="theme-btn">
              🌊 Ocean Blue
            </button>
            
            <button onClick={() => {
              localStorage.setItem('user_theme', 'sunset');
              document.body.classList.add('sunset-theme');
              document.body.classList.remove('dark-theme', 'light-theme', 'ocean-theme', 'forest-theme');
              setSuccess('✅ Theme changed to Sunset');
            }} className="theme-btn">
              🌅 Sunset
            </button>
            
            <button onClick={() => {
              localStorage.setItem('user_theme', 'forest');
              document.body.classList.add('forest-theme');
              document.body.classList.remove('dark-theme', 'light-theme', 'ocean-theme', 'sunset-theme');
              setSuccess('✅ Theme changed to Forest Green');
            }} className="theme-btn">
              🌲 Forest Green
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Confirmation Modal - Keep as is but update colors */}
    {showConfirmModal && (
      <div className="modal-overlay">
        <div className="modal-content">
          <h3 className="modal-title">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            Confirm Account Deletion
          </h3>
          
          <div className="modal-warning">
            <p className="modal-warning-text">
              This will permanently delete ALL your data including:
            </p>
            <ul className="modal-list">
              <li>Your profile information</li>
              <li>All your product listings</li>
              <li>Your search history</li>
              <li>Your feedback submissions</li>
              <li>Your account credentials</li>
            </ul>
            <p className="modal-danger-text">
              ⚠️ This action cannot be undone!
            </p>
          </div>
          
          <div className="modal-input-group">
            <label className="modal-label">
              Type <strong className="danger-text">DELETE</strong> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="modal-input"
              placeholder="Type DELETE here"
              autoFocus
            />
          </div>
          
          <div className="modal-buttons">
            <button
              onClick={() => {
                setShowConfirmModal(false);
                setConfirmText('');
              }}
              disabled={isConfirming}
              className="modal-cancel-btn"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isConfirming || confirmText !== 'DELETE'}
              className="modal-confirm-btn"
              style={{
                background: confirmText === 'DELETE' ? '#dc2626' : '#2a2a2a',
                opacity: (isConfirming || confirmText !== 'DELETE') ? 0.5 : 1
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
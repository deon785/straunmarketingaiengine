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

// ============ HELPER FUNCTIONS ============
const fetchWithRetry = async (fetchFn, maxRetries = 3) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFn();
    } catch (err) {
      lastError = err;
      console.warn(`Fetch attempt ${i + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  throw lastError;
};

// ============ NOTIFICATION SETTINGS (top-level component) ============
const NotificationSettings = () => {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [subscribing, setSubscribing] = useState(false);

  // Re-check permission whenever window regains focus
  useEffect(() => {
    const onFocus = () => {
      if (typeof Notification !== 'undefined') {
        setPermission(Notification.permission);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleEnable = async () => {
    if (typeof Notification === 'undefined') return;

    // Don't re-ask if already decided
    if (Notification.permission !== 'default') {
      setPermission(Notification.permission);
      return;
    }

    try {
      setSubscribing(true);
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // Ask the parent app to subscribe — see the custom event below
        window.dispatchEvent(new CustomEvent('straun:notification-granted'));
      }
    } catch (err) {
      console.error('Notification permission request failed:', err);
    } finally {
    setSubscribing(false);           
  }
  };

  const openBrowserSettings = () => {
    const ua = navigator.userAgent;
    let instructions = '';
    if (/Chrome/.test(ua) && !/Edg/.test(ua)) {
      instructions = 'Tap the lock icon in the address bar → Site settings → Notifications → Allow';
    } else if (/Safari/.test(ua)) {
      instructions = 'Settings app → Safari → [this site] → Notifications → Allow';
    } else if (/Firefox/.test(ua)) {
      instructions = 'Tap the lock icon → Connection secure → More information → Permissions → Notifications';
    } else if (/Edg/.test(ua)) {
      instructions = 'Tap the lock icon → Permissions for this site → Notifications → Allow';
    } else {
      instructions = 'Open your browser settings and allow notifications for this site.';
    }
    alert(instructions);
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title" style={{ marginBottom: '8px' }}>
        🔔 Notifications
      </h3>

      {permission === 'granted' && (
        <p className="settings-description">
          ✅ Notifications are enabled. You'll receive updates like WhatsApp.
        </p>
      )}

      {permission === 'default' && (
        <>
          <p className="settings-description">
            You haven't enabled notifications yet. Turn them on to get notified about matches, messages, and price drops.
          </p>
          <button
            onClick={handleEnable}
            disabled={subscribing}
            className="export-btn"
            style={{ marginTop: '8px' }}
          >
            🔔 Enable Notifications
          </button>
        </>
      )}

      {permission === 'denied' && (
        <>
          <p className="settings-description">
            🔕 Notifications are blocked.
          </p>
          <p className="settings-description" style={{ fontSize: '13px', opacity: 0.7 }}>
            You previously chose "Block". To enable them again, you need to change it in your browser settings.
          </p>
          <button
            onClick={openBrowserSettings}
            className="export-btn"
            style={{ marginTop: '8px', background: '#4a5568' }}
          >
            How to enable in browser settings
          </button>
        </>
      )}

      {permission === 'unsupported' && (
        <p className="settings-description">
          ⚠️ Notifications are not supported in this browser.
        </p>
      )}
    </div>
  );
};

// ============ MAIN COMPONENT ============
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
    try {
      const savedTheme = localStorage.getItem('user_theme');
      if (savedTheme) {
        const themes = ['dark', 'light', 'ocean', 'sunset', 'forest'];
        const body = document.body;
        themes.forEach(t => {
          try {
            body.classList.remove(`${t}-theme`);
          } catch (e) {
            // Ignore
          }
        });
        body.classList.add(`${savedTheme}-theme`);
      }
    } catch (err) {
      console.warn('Theme loading error:', err);
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

  // ✅ If no user, show error and return early
  if (!user) {
    return (
      <div className="privacy-settings">
        <div className="error-message" style={{
          padding: '20px',
          textAlign: 'center',
          background: '#fee2e2',
          borderRadius: '8px',
          color: '#dc2626'
        }}>
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <strong style={{ marginLeft: '10px' }}>Error:</strong> User not found. Please log in again.
        </div>
      </div>
    );
  }

  // ============ THEME APPLICATION ============
  const applyTheme = (themeName) => {
    try {
      const themes = ['dark', 'light', 'ocean', 'sunset', 'forest'];
      const body = document.body;
      
      // Remove all theme classes safely
      themes.forEach(t => {
        try {
          body.classList.remove(`${t}-theme`);
        } catch (e) {
          // Ignore - class might not exist
        }
      });
      
      // Add new theme
      body.classList.add(`${themeName}-theme`);
      localStorage.setItem('user_theme', themeName);
      
      const themeNames = {
        dark: 'Dark',
        light: 'Light',
        ocean: 'Ocean Blue',
        sunset: 'Sunset',
        forest: 'Forest Green'
      };
      setSuccess(`✅ Theme changed to ${themeNames[themeName] || themeName}`);
    } catch (err) {
      console.error('Theme application error:', err);
      setError('Failed to apply theme. Please try again.');
    }
  };

  // ============ DATA EXPORT ============
  const handleDataExport = async () => {
    // ✅ Check offline status
    if (!navigator.onLine) {
      setError('You are offline. Please connect to the internet to export data.');
      return;
    }

    try {
      setExportLoading(true);
      setError(null);
      setSuccess(null);
      
      let profileData = [];
      let productData = [];
      let searchData = [];
      let feedbackData = [];
      
      // ✅ Use fetchWithRetry for each query
      try {
        const profileResult = await fetchWithRetry(() => 
          supabase.from('profiles').select('*').eq('user_id', user.id)
        );
        profileData = profileResult.data || [];
      } catch (err) {
        console.warn('Profile fetch failed:', err);
        // Continue with empty data
      }
      
      try {
        const productResult = await fetchWithRetry(() => 
          supabase.from('products').select('*').eq('seller_id', user.id)
        );
        productData = productResult.data || [];
      } catch (err) {
        console.warn('Products fetch failed:', err);
      }
      
      try {
        const searchResult = await fetchWithRetry(() => 
          supabase.from('searches').select('*').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        );
        searchData = searchResult.data || [];
      } catch (err) {
        console.warn('Searches fetch failed:', err);
      }
      
      try {
        const feedbackResult = await fetchWithRetry(() => 
          supabase.from('feedback').select('*').eq('user_id', user.id)
        );
        feedbackData = feedbackResult.data || [];
      } catch (err) {
        console.warn('Feedback fetch failed:', err);
      }

      const allUserData = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        user_email: user.email,
        metadata: {
          profile_count: profileData.length,
          product_count: productData.length,
          search_count: searchData.length,
          feedback_count: feedbackData.length
        },
        data: {
          profile: profileData,
          products: productData,
          searches: searchData,
          feedback: feedbackData
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
      
      const totalRecords = allUserData.metadata.profile_count + 
                          allUserData.metadata.product_count + 
                          allUserData.metadata.search_count + 
                          allUserData.metadata.feedback_count;
      
      setSuccess(`✅ Data exported successfully! ${totalRecords} records included.`);
      
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

  // ============ DELETE ACCOUNT ============
  const handleDeleteAccount = async () => {
    // ✅ Add user validation
    if (!user || !user.id) {
      setError('User not authenticated. Please log in again.');
      return;
    }
    
    if (confirmText !== 'DELETE') {
      setError('Please type "DELETE" exactly as shown to confirm.');
      return;
    }

    try {
      setIsConfirming(true);
      setError(null);
      setSuccess(null);
      
      console.log('Starting account deletion for user:', user.id);
      
      // ✅ Use fetchWithRetry for deletion operations
      try {
        const deletionPromises = [
          fetchWithRetry(() => supabase.from('feedback').delete().eq('user_id', user.id)),
          fetchWithRetry(() => supabase.from('searches').delete().or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)),
          fetchWithRetry(() => supabase.from('products').delete().eq('seller_id', user.id)),
          fetchWithRetry(() => supabase.from('profiles').delete().eq('user_id', user.id))
        ];
        
        const results = await Promise.all(deletionPromises);
        
        const errors = results.filter(result => result.error).map(r => r.error);
        if (errors.length > 0) {
          console.error('Database deletion errors:', errors);
          // Continue with auth deletion
        }
      } catch (dbErr) {
        console.error('Database deletion error:', dbErr);
        // Continue with auth deletion
      }
      
      // Delete auth user via Edge Function with error handling
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
      
      // Sign out safely
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.error('Sign out error:', signOutErr);
        // Continue - user will be signed out anyway
      }
      
      localStorage.clear();
      
      setSuccess('✅ Account deleted successfully! Redirecting...');
      
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);
      
    } catch (err) {
      console.error('Account deletion error:', err);
      setError(`❌ ${err.message || 'Failed to delete account. Please contact support: support@straun.ai'}`);
      
      // Try to sign out anyway
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

  // ============ RENDER ============
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

        <NotificationSettings />
        
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
              <button onClick={() => applyTheme('dark')} className="theme-btn">
                🌙 Dark
              </button>
              
              <button onClick={() => applyTheme('light')} className="theme-btn">
                ☀️ Light
              </button>
              
              <button onClick={() => applyTheme('ocean')} className="theme-btn">
                🌊 Ocean Blue
              </button>
              
              <button onClick={() => applyTheme('sunset')} className="theme-btn">
                🌅 Sunset
              </button>
              
              <button onClick={() => applyTheme('forest')} className="theme-btn">
                🌲 Forest Green
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
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
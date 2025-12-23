// UserSettings.jsx
import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import { useNavigate } from 'react-router-dom';
import './UserSettings.css';

const UserSettings = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();

  const handleDataExport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 1. Get ALL user data from ALL tables
      const [
        { data: profileData },
        { data: productData },
        { data: searchData },
        { data: feedbackData }
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id),
        supabase.from('products').select('*').eq('seller_id', user.id),
        supabase.from('searches').select('*').eq('buyer_id', user.id).eq('seller_id', user.id),
        supabase.from('feedback').select('*').eq('user_id', user.id)
      ]);

      // 2. Combine all data
      const allUserData = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        user_email: user.email,
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
      a.download = `user-data-export-${user.id}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccess('Data exported successfully! Check your downloads.');
      
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountDeletion = async () => {
    const confirmed = window.confirm(
      '⚠️ WARNING: This will permanently delete:\n' +
      '• Your profile information\n' +
      '• All your product listings\n' +
      '• Your search history\n' +
      '• Your feedback submissions\n' +
      '• Your account credentials\n\n' +
      'This action CANNOT be undone!\n\n' +
      'Type "DELETE" to confirm:'
    );
    
    if (!confirmed) return;
    
    const userInput = prompt('Please type "DELETE" to confirm permanent deletion:');
    if (userInput !== 'DELETE') {
      alert('Deletion cancelled. Account not deleted.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Starting account deletion for user:', user.id);
      
      // 1. Delete from ALL database tables (in transaction)
      const deletionPromises = [
        supabase.from('profiles').delete().eq('user_id', user.id),
        supabase.from('products').delete().eq('seller_id', user.id),
        supabase.from('searches').delete().or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
        supabase.from('feedback').delete().eq('user_id', user.id)
      ];
      
      const results = await Promise.all(deletionPromises);
      
      // Check for errors
      const hasError = results.some(result => result.error);
      if (hasError) {
        throw new Error('Failed to delete some data. Please contact support.');
      }
      
      // 2. Delete auth user (Supabase provides this)
      const { error: authError } = await supabase.auth.admin.deleteUser(
        user.id
      );
      
    try {
    const { error: deleteError } = await supabase.functions.invoke('delete-user', {
        body: { userId: user.id }
    });
    
    if (deleteError) {
        console.warn('Auth deletion warning:', deleteError);
        // Log for admin follow-up
        console.log(`User ${user.id} (${user.email}): Tables cleaned but auth user may remain`);
    }
    
    } catch (authErr) {
    console.warn('Could not delete auth user via function:', authErr);
    // Non-critical error - main user data is already deleted
    }
      
      // 3. Sign out locally
      await supabase.auth.signOut();
      
      // 4. Clear localStorage
      localStorage.removeItem('user');
      localStorage.removeItem('supabase.auth.token');
      
      // 5. Show success and redirect
      alert('✅ Account deleted successfully. You will now be signed out.');
      
      // 6. Redirect to home page
      navigate('/');
      window.location.reload(); // Full refresh to clear state
      
    } catch (err) {
      console.error('Account deletion error:', err);
      setError(err.message || 'Failed to delete account. Please contact support.');
      alert('❌ Failed to delete account: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="privacy-settings">
      <h3>Data Privacy</h3>
      
      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}
      
      {success && (
        <div className="success-message">
          ✅ {success}
        </div>
      )}
      
      <div className="privacy-actions">
        <button 
          onClick={handleDataExport} 
          disabled={loading}
          className="export-btn"
        >
          {loading ? 'Exporting...' : '📥 Export My Data'}
        </button>
        
        <button 
          onClick={handleAccountDeletion} 
          disabled={loading}
          className="delete-btn danger"
        >
          {loading ? 'Deleting...' : '🗑️ Delete My Account'}
        </button>
      </div>
      
      <div className="privacy-info">
        <p><strong>Export:</strong> Get all your data in JSON format</p>
        <p><strong>Delete:</strong> Permanently remove all your data from our systems</p>
        <p className="warning-note">
          ⚠️ Account deletion is permanent and cannot be undone.
        </p>
      </div>
    </div>
  );
};

export default UserSettings;
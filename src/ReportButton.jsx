import { useState } from 'react';
import { supabase } from './lib/supabase';

export default function ReportButton({ 
  targetUserId, 
  listingId, 
  listingTitle, 
  floating = false,
  style = {}
}) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      alert('Please select a reason for reporting');
      return;
    }
    
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
          description: description || `Reported ${listingTitle || 'user'}`
        });

      if (error) throw error;
      
      alert('Report submitted. We will review within 24 hours.');
      setShowModal(false);
      setReason('');
      setDescription('');
    } catch (error) {
      alert('Error submitting report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* REPORT BUTTON - NO TOOLTIPS OR POPUPS */}
      <button 
        onClick={() => setShowModal(true)}
        style={{
          background: '#dc2626',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s',
          // Remove any possible tooltip indicators
          position: 'relative',
          ...style
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
        onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
        // IMPORTANT: Remove title attribute if present
        title=""
        // Prevent any default tooltip behavior
        onMouseOver={(e) => {
          e.stopPropagation();
          // Remove any tooltip that might appear
          const tooltips = document.querySelectorAll('[role="tooltip"], .tooltip, [class*="tooltip"]');
          tooltips.forEach(tip => tip.remove());
        }}
      >
        <span>⚠️</span> Report Issue
      </button>

      {/* CLEAN, USABLE MODAL - NO EXTERNAL POPUPS */}
      {showModal && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setShowModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
              zIndex: 999,
              animation: 'fadeIn 0.2s ease'
            }}
          />

          {/* Modal Container */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '85vh',
            background: 'white',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideUp 0.3s ease'
          }}>
            
            {/* Header with X Button */}
            <div style={{
              padding: '24px 28px',
              borderBottom: '2px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'white',
              borderRadius: '20px 20px 0 0'
            }}>
              <div>
                <h2 style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1a1a1a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '28px' }}>🚨</span>
                  Report Issue
                </h2>
                <p style={{
                  margin: '8px 0 0 0',
                  fontSize: '14px',
                  color: '#666'
                }}>
                  Help us keep the community safe
                </p>
              </div>
              
              {/* X Button - Close */}
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '28px',
                  cursor: 'pointer',
                  color: '#999',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f0f0f0';
                  e.currentTarget.style.color = '#333';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#999';
                }}
                title="" // Remove any tooltip
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 28px'
            }}>
              
              {/* What's being reported */}
              {listingTitle && (
                <div style={{
                  background: '#f8f9fa',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  border: '1px solid #e9ecef'
                }}>
                  <p style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#666',
                    fontWeight: '500',
                    marginBottom: '6px'
                  }}>
                    Reporting content related to:
                  </p>
                  <p style={{
                    margin: 0,
                    fontSize: '16px',
                    color: '#1a1a1a',
                    fontWeight: '600'
                  }}>
                    {listingTitle}
                  </p>
                </div>
              )}

              {/* Reason for reporting */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#333',
                  marginBottom: '12px'
                }}>
                  Reason for reporting <span style={{ color: '#dc2626' }}>*</span>
                </label>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '12px'
                }}>
                  {['scam', 'fake', 'harassment', 'spam', 'illegal'].map((r) => (
                    <label
                      key={r}
                      onClick={() => setReason(r)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        background: reason === r ? '#fee2e2' : '#f8f9fa',
                        border: reason === r ? '2px solid #dc2626' : '1px solid #e9ecef',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      title="" // Remove any tooltip
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={r}
                        checked={reason === r}
                        onChange={() => setReason(r)}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          accentColor: '#dc2626'
                        }}
                      />
                      <span style={{
                        fontSize: '15px',
                        fontWeight: reason === r ? '600' : '400',
                        color: reason === r ? '#dc2626' : '#333',
                        textTransform: 'capitalize'
                      }}>
                        {r}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Additional details */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#333',
                  marginBottom: '12px'
                }}>
                  Additional details (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please describe what happened. Include any relevant details that will help us investigate."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '14px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    transition: 'border 0.2s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#dc2626'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
                />
                <p style={{
                  margin: '8px 0 0 0',
                  fontSize: '12px',
                  color: '#888'
                }}>
                  Maximum 500 characters
                </p>
              </div>

              {/* Warning message */}
              <div style={{
                background: '#fef3c7',
                borderLeft: '4px solid #f59e0b',
                padding: '14px 16px',
                borderRadius: '8px',
                marginTop: '8px'
              }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '20px' }}>⚠️</span>
                  <div>
                    <p style={{
                      margin: 0,
                      fontSize: '13px',
                      color: '#92400e',
                      fontWeight: '500'
                    }}>
                      False reports may result in account restrictions
                    </p>
                    <p style={{
                      margin: '4px 0 0 0',
                      fontSize: '12px',
                      color: '#b45309'
                    }}>
                      Please only report genuine issues
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer with buttons */}
            <div style={{
              padding: '20px 28px',
              borderTop: '1px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              background: 'white',
              borderRadius: '0 0 20px 20px'
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 24px',
                  background: 'transparent',
                  border: '1px solid #d0d0d0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#666',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                  e.currentTarget.style.borderColor = '#bbb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = '#d0d0d0';
                }}
                title="" // Remove any tooltip
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || loading}
                style={{
                  padding: '10px 28px',
                  background: !reason || loading ? '#ccc' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: !reason || loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (reason && !loading) {
                    e.currentTarget.style.background = '#b91c1c';
                  }
                }}
                onMouseLeave={(e) => {
                  if (reason && !loading) {
                    e.currentTarget.style.background = '#dc2626';
                  }
                }}
                title="" // Remove any tooltip
              >
                {loading ? (
                  <>
                    <span style={{
                      display: 'inline-block',
                      width: '16px',
                      height: '16px',
                      border: '2px solid white',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite'
                    }} />
                    Submitting...
                  </>
                ) : (
                  <>
                    <span>✓</span> Submit Report
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Add animations */}
          <style>{`
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
            
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translate(-50%, -45%);
              }
              to {
                opacity: 1;
                transform: translate(-50%, -50%);
              }
            }
            
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }

            *[title] {
              title: none !important;
            }

            /* Remove any tooltip pseudo-elements */
            *:hover::before,
            *:hover::after {
              display: none !important;
            }
            
            /* Remove any global tooltip styles */
            [title] {
              pointer-events: auto !important;
            }
            
            /* Hide any pseudo-element tooltips */
            button:hover::before,
            button:hover::after,
            [class*="tooltip"]:hover::before,
            [class*="tooltip"]:hover::after {
              display: none !important;
              content: none !important;
            }
          `}</style>
        </>
      )}
    </>
  );
}
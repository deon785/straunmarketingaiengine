import React, { useState } from 'react'; // Added useState import
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './signup';
import SocialAIMarketingEngine from './SocialAIMarketingEngine';
import './App.css';

// ============ ADD FEEDBACK BUTTON COMPONENT HERE ============
// This goes OUTSIDE the App function but INSIDE the same file
const FeedbackButton = () => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  const handleSendFeedback = () => {
    console.log('Feedback sent:', feedbackText);
    alert('Thank you! This helps a lot!');
    setFeedbackText('');
    setShowFeedback(false);
  };

  return (
    <>
      <button 
        onClick={() => setShowFeedback(true)}
        className="feedback-button"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '50px',
          padding: '12px 20px',
          cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          zIndex: 1000,
          fontSize: '14px',
          fontWeight: '500'
        }}
      >
        💬 Give Feedback
      </button>
      
      {showFeedback && (
        <>
          {/* Overlay */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 1001
            }}
            onClick={() => setShowFeedback(false)}
          />
          
          {/* Modal */}
          <div 
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              zIndex: 1002,
              minWidth: '300px'
            }}
          >
            <h3 style={{ marginBottom: '15px' }}>Help us improve!</h3>
            <textarea 
              placeholder="What's working? What's confusing? What's missing?"
              rows={4}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '15px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handleSendFeedback}
                style={{
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Send Feedback
              </button>
              <button 
                onClick={() => setShowFeedback(false)}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};
// ============ END FEEDBACK BUTTON COMPONENT ============

// Main App function - Add <FeedbackButton /> INSIDE the return statement
function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/app" element={<SocialAIMarketingEngine />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        {/* ADD THIS LINE: Feedback button will show on ALL pages */}
        <FeedbackButton />
      </div>
    </Router>
  );
}

export default App;
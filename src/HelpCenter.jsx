import React, { useState } from 'react';
import { faqData } from './faqData';

const HelpCenter = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeId, setActiveId] = useState(null);

  const toggleAccordion = (id) => {
    setActiveId(activeId === id ? null : id);
  };

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '40px auto', 
      padding: '20px', 
      fontFamily: 'sans-serif' 
    }}>
      <h1 style={{ 
        textAlign: 'center', 
        color: '#1a202c',
        marginBottom: '30px'
      }}>
        Help Center & FAQ
      </h1>
      
      {/* Search Bar */}
      <input 
        type="text" 
        placeholder="Search for help (e.g. 'payments')..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
        style={{
          width: '100%', 
          padding: '15px', 
          borderRadius: '8px',
          border: '1px solid #cbd5e0', 
          marginBottom: '30px', 
          fontSize: '16px',
          boxSizing: 'border-box'
        }}
      />

      {/* FAQ Sections */}
      {faqData.map((section, sIdx) => {
        const filteredQuestions = section.questions.filter(item => 
          item.q.toLowerCase().includes(searchTerm) || 
          item.a.toLowerCase().includes(searchTerm)
        );
        
        if (filteredQuestions.length === 0) return null;
        
        return (
          <div key={sIdx} style={{ marginBottom: '40px' }}>
            <h2 style={{ 
              color: '#2d3748', 
              borderBottom: '2px solid #edf2f7', 
              paddingBottom: '10px',
              marginBottom: '20px'
            }}>
              {section.category}
            </h2>
            
            {filteredQuestions.map((item, qIdx) => {
              const id = `${sIdx}-${qIdx}`;
              const isActive = activeId === id;
              
              return (
                <div 
                  key={id} 
                  style={{ 
                    borderBottom: '1px solid #edf2f7',
                    marginBottom: '10px'
                  }}
                >
                  <button 
                    onClick={() => toggleAccordion(id)}
                    style={{
                      width: '100%', 
                      textAlign: 'left', 
                      padding: '15px 0',
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer',
                      fontSize: '18px', 
                      fontWeight: '500', 
                      display: 'flex',
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      color: isActive ? '#2b6cb0' : '#4a5568',
                      transition: 'color 0.2s ease'
                    }}
                  >
                    <span style={{ flex: 1, textAlign: 'left' }}>{item.q}</span>
                    <span style={{
                      fontSize: '24px',
                      fontWeight: '300',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isActive ? '−' : '+'}
                    </span>
                  </button>
                  
                  {isActive && (
                    <div style={{ 
                      padding: '0 0 20px 0', 
                      color: '#718096', 
                      lineHeight: '1.6',
                      animation: 'fadeIn 0.3s ease'
                    }}>
                      {typeof item.a === 'string' ? (
                        <p style={{ margin: 0 }}>{item.a}</p>
                      ) : (
                        <div>{item.a}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* "No results" message */}
      {faqData.every(section => 
        section.questions.every(item => 
          !item.q.toLowerCase().includes(searchTerm) && 
          !item.a.toLowerCase().includes(searchTerm)
        )
      ) && searchTerm && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#718096'
        }}>
          <p style={{ fontSize: '18px', marginBottom: '10px' }}>
            No results found for "{searchTerm}"
          </p>
          <p style={{ fontSize: '14px' }}>
            Try searching with different keywords or browse the categories above.
          </p>
        </div>
      )}

      {/* WhatsApp Support Section */}
      <div style={{
        marginTop: '50px',
        padding: '30px',
        backgroundColor: '#f0fff4',
        borderRadius: '12px',
        textAlign: 'center',
        border: '1px solid #c6f6d5'
      }}>
        <h3 style={{ 
          color: '#22543d', 
          marginBottom: '10px',
          fontSize: '24px'
        }}>
          Still need help?
        </h3>
        <p style={{ 
          color: '#276749', 
          marginBottom: '20px',
          fontSize: '16px',
          lineHeight: '1.5'
        }}>
          Chat with our support team directly on WhatsApp for quick assistance.
        </p>
        
        <a 
          href="https://wa.me/263786830122?text=Hi!%20I'm%20using%20the%20AI%20Marketing%20Engine%20and%20need%20some%20help."
          target="_blank"
          rel="noopener noreferrer"
          style={{
            backgroundColor: '#25D366',
            color: 'white',
            padding: '14px 28px',
            borderRadius: '50px',
            textDecoration: 'none',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
            fontSize: '16px',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 211, 102, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.3)';
          }}
        >
          <span>💬</span>
          <span>Message us on WhatsApp</span>
        </a>
      </div>

      {/* Add CSS animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default HelpCenter;
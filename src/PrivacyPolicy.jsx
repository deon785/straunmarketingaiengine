import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Monitor scroll position to show/hide the "Scroll to Top" button
  const handleScroll = (e) => {
    const position = e.target.scrollTop;
    setShowScrollBtn(position > 300);
  };

  const scrollToTop = () => {
    scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const termlyHTML = `
    <style>
      [data-custom-class='body'], [data-custom-class='body'] * { background: transparent !important; }
      [data-custom-class='title'], [data-custom-class='title'] * { font-family: Arial !important; font-size: 26px !important; color: #000000 !important; text-align: center; font-weight: bold; }
      [data-custom-class='body_text'], [data-custom-class='body_text'] * { color: #595959 !important; font-size: 14px !important; line-height: 1.6 !important; font-family: Arial !important; }
      .policy-section-title { color: #000; font-size: 18px; font-weight: bold; margin-top: 20px; display: block; }
      .policy-sub-title { font-weight: bold; color: #333; margin-top: 15px; display: block; }
    </style>
    <div data-custom-class="body">
      <div data-custom-class="title">PRIVACY POLICY</div>
      <p data-custom-class="body_text"><strong>Last updated December 17, 2025</strong></p>
      
      <div data-custom-class="body_text">
        <p>This Privacy Notice for Straun Marketing AI Engine ('<strong>we</strong>', '<strong>us</strong>', or '<strong>our</strong>'), describes how and why we might access, collect, store, use, and/or share ('<strong>process</strong>') your personal information when you use our services ('<strong>Services</strong>').</p>

        <div class="policy-section-title">TABLE OF CONTENTS</div>
        <ol>
          <li>WHAT INFORMATION DO WE COLLECT?</li>
          <li>HOW DO WE PROCESS YOUR INFORMATION?</li>
          <li>WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?</li>
          <li>DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?</li>
          <li>HOW LONG DO WE KEEP YOUR INFORMATION?</li>
          <li>HOW DO WE KEEP YOUR INFORMATION SAFE?</li>
          <li>DO WE COLLECT INFORMATION FROM MINORS?</li>
          <li>WHAT ARE YOUR PRIVACY RIGHTS?</li>
          <li>CONTROLS FOR DO-NOT-TRACK FEATURES?</li>
          <li>DO OTHER REGIONS HAVE SPECIFIC PRIVACY RIGHTS?</li>
          <li>DO WE MAKE UPDATES TO THIS NOTICE?</li>
          <li>HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</li>
          <li>HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?</li>
        </ol>

        <div class="policy-section-title">1. WHAT INFORMATION DO WE COLLECT?</div>
        <p>We collect personal information that you voluntarily provide to us when you register on the Services, such as phone numbers, email addresses, usernames, and passwords.</p>

        <div class="policy-section-title">2. HOW DO WE PROCESS YOUR INFORMATION?</div>
        <p>We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.</p>

        <div class="policy-section-title">3. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?</div>
        <p>We may share your data with third-party vendors like Supabase (for database/auth) and Vercel (for hosting) who perform services for us.</p>

        <div class="policy-section-title">4. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?</div>
        <p><em><strong>In Short:</strong> We may use cookies and other tracking technologies to collect and store your information.</em></p>
        <p>We may use cookies and similar tracking technologies (like web beacons and pixels) to access or store information. Specific information about how we use such technologies and how you can refuse certain cookies is set out in our Cookie Notice.</p>

        <div class="policy-section-title">5. HOW LONG DO WE KEEP YOUR INFORMATION?</div>
        <p><em><strong>In Short:</strong> We keep your information for as long as necessary to fulfil the purposes outlined in this Privacy Notice unless otherwise required by law.</em></p>
        <p>We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). No purpose in this notice will require us keeping your personal information for longer than the period of time in which users have an account with us.</p>

        <div class="policy-section-title">6. HOW DO WE KEEP YOUR INFORMATION SAFE?</div>
        <p><em><strong>In Short:</strong> We aim to protect your personal information through a system of organisational and technical security measures.</em></p>
        <p>We have implemented appropriate and reasonable technical and organisational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure.</p>

        <div class="policy-section-title">7. DO WE COLLECT INFORMATION FROM MINORS?</div>
        <p><em><strong>In Short:</strong> We do not knowingly collect data from or market to children under 18 years of age.</em></p>
        <p>We do not knowingly solicit data from or market to children under 18 years of age. By using the Services, you represent that you are at least 18 or that you are the parent or guardian of such a minor and consent to such minor dependent’s use of the Services.</p>

        <div class="policy-section-title">8. WHAT ARE YOUR PRIVACY RIGHTS?</div>
        <p><em><strong>In Short:</strong> You may review, change, or terminate your account at any time.</em></p>
        <p>If you are located in the EEA or UK and you believe we are unlawfully processing your personal information, you also have the right to complain to your Member State data protection authority. You can find their contact details here: <a href="https://ec.europa.eu/justice/data-protection/bodies/authorities/index_en.htm" style="color: #3030F1;">https://ec.europa.eu/justice/data-protection/bodies/authorities/index_en.htm</a></p>
        <p><strong>Withdrawing your consent:</strong> If we are relying on your consent to process your personal information, you have the right to withdraw your consent at any time. You can withdraw your consent at any time by contacting us using the contact details provided in the section 'HOW CAN YOU CONTACT US ABOUT THIS NOTICE?' below.</p>

        <div class="policy-section-title">11. DO WE MAKE UPDATES TO THIS NOTICE?</div>
        <p><em><strong>In Short:</strong> Yes, we will update this notice as necessary to stay compliant with relevant laws.</em></p>
        <p>We may update this Privacy Notice from time to time. The updated version will be indicated by an updated 'Revised' date and the updated version will be effective as soon as it is accessible.</p>

        <div class="policy-section-title">12. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</div>
        <p>If you have questions or comments about this notice, you may email us at <strong>deonmahachi8@gmail.com</strong>.</p>

        <div class="policy-section-title">13. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?</div>
        <p>Based on the applicable laws of your country, you may have the right to request access to the personal information we collect from you, change that information, or delete it. To request to review, update, or delete your personal information, please fill out a <span style="color: #3030F1; text-decoration: underline;">data subject access request</span>.</p>
      </div>
    </div>
  `;

  return (
    <div style={{ 
      padding: '10px', 
      maxWidth: '800px', 
      margin: '0 auto', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#fff' 
    }}>
      {/* Navigation Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
        <button 
          onClick={() => navigate(-1)} 
          style={{ cursor: 'pointer', padding: '8px 16px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          ← Back
        </button>
        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Privacy Policy</h2>
      </div>

      {/* Scrollable Content Area */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          WebkitOverflowScrolling: 'touch', 
          border: '1px solid #f0f0f0',
          padding: '20px',
          marginTop: '10px',
          borderRadius: '8px'
        }}
      >
        <div 
          style={{ wordBreak: 'break-word' }} 
          dangerouslySetInnerHTML={{ __html: termlyHTML }} 
        />
      </div>

      {/* Floating Scroll to Top Button */}
      {showScrollBtn && (
        <button 
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            backgroundColor: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
          ↑
        </button>
      )}
    </div>
  );
};

export default PrivacyPolicy;
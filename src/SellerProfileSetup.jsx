import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from './lib/supabase';
import ReactGA from 'react-ga4';

const T = {
  text: '#0f172a', textMuted: '#52607a', textLight: '#8291a9',
  cardBg: '#ffffff', cardBorder: '#e5e7eb',
  softBg: '#f7f8fa', softBorder: '#eaeef2',
  inputBorder: '#d1d5db', errorText: '#dc2626', errorBorder: '#f87171',
  primary: '#4361ee', success: '#10b981', radius: '12px',
};

const fetchWithRetry = async (fn, n = 3) => {
  let last;
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) { last = e; await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000)); }
  }
  throw last;
};

const SellerProfileSetup = ({ user, existingProfile, onComplete }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: {
      shop_name: existingProfile?.shop_name || '',
      location: existingProfile?.location || '',
      phone_number: existingProfile?.phone_number || '',
      shop_bio: existingProfile?.shop_bio || '',
    },
  });

  const shopNameValue = watch('shop_name', '');
  const locationValue = watch('location', '');
  const bioValue = watch('shop_bio', '');

  const validatePhone = useCallback((phone) => {
    if (!phone) return 'Phone number is required';
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '').replace(/^\+/, '');
    const digits = cleaned.replace(/\D/g, '');
    const isLocal = cleaned.startsWith('0');
    if (isLocal && digits.length !== 10) return 'Enter a valid local number (e.g., 0712345678)';
    if (!isLocal && digits.length !== 12) return 'Enter a valid number with country code (e.g., 263712345678)';
    return true;
  }, []);

  const onSubmit = useCallback(async (data) => {
    if (!user?.id) { setError('Please sign in.'); return; }
    setSubmitting(true);
    setError(null);

    try {
      const sanitized = {
        shop_name: data.shop_name.trim().substring(0, 60),
        location: data.location.trim().substring(0, 100),
        phone_number: data.phone_number.trim().replace(/[^\d+]/g, '').substring(0, 20),
        shop_bio: (data.shop_bio || '').trim().substring(0, 120),
      };

      const { data: result, error: upsertError } = await fetchWithRetry(() =>
        supabase.from('profiles').upsert([{
          user_id: user.id,
          username: user.email,
          shop_name: sanitized.shop_name,
          shop_bio: sanitized.shop_bio,
          location: sanitized.location,
          phone_number: sanitized.phone_number,
          is_seller: true,
          seller_setup_completed: true,
          updated_at: new Date().toISOString(),
        }], { onConflict: 'user_id' }).select().single()
      );

      if (upsertError) throw upsertError;

      ReactGA.event({ category: 'Seller', action: 'Profile_Setup_Complete' });
      onComplete(result);
    } catch (err) {
      console.error('Profile setup failed:', err);
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [user, onComplete]);

  const inputStyle = {
    width: '100%', padding: '14px 16px',
    border: `2px solid ${T.inputBorder}`, borderRadius: T.radius,
    fontSize: '16px', background: T.cardBg, color: T.text,
    fontFamily: 'inherit', boxSizing: 'border-box',
    outline: 'none', transition: 'border-color 0.15s ease',
  };
  const labelStyle = { display: 'block', fontSize: '15px', fontWeight: 600, marginBottom: '6px', color: T.text };
  const helperStyle = { fontSize: '12px', color: T.textLight, marginTop: '6px' };
  const errStyle = { color: T.errorText, fontSize: '13px', marginTop: '6px', fontWeight: 500 };

  return (
    <div style={{
      maxWidth: '640px', margin: '32px auto', padding: '32px',
      background: T.cardBg, border: `1px solid ${T.cardBorder}`,
      borderRadius: '16px',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 12px 30px -20px rgba(15,23,42,0.10)',
      color: T.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '13px', color: T.textLight }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>1</div>
        <div style={{ flex: 1, height: 2, background: T.softBorder }} />
        <span>Step 1 of 2 · Profile</span>
      </div>

      <h2 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px' }}>
        Set Up Your Seller Profile
      </h2>
      <p style={{ fontSize: '15px', color: T.textMuted, marginBottom: '24px', lineHeight: 1.5 }}>
        We need these once. They're attached to every product you list.
      </p>

      <div style={{ background: T.softBg, border: `1px solid ${T.softBorder}`, borderRadius: '12px', padding: '16px 18px', marginBottom: '24px' }}>
        <p style={{ fontSize: '13px', color: T.textMuted, lineHeight: 1.5, margin: 0 }}>
          <strong style={{ color: T.text }}>Signed in as:</strong> {user?.email}
        </p>
      </div>

      {error && (
        <div style={{ padding: '14px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: '10px', marginBottom: '20px' }}>
          <strong style={{ color: T.errorText, fontSize: '14px' }}>Error:</strong>
          <p style={{ color: T.errorText, fontSize: '14px', marginTop: '4px', margin: 0 }}>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Shop Name *</label>
          <input
            type="text"
            style={errors.shop_name ? { ...inputStyle, borderColor: T.errorBorder } : inputStyle}
            {...register('shop_name', {
              required: 'Shop name is required',
              minLength: { value: 2, message: 'At least 2 characters' },
              maxLength: { value: 60, message: 'Max 60 characters' },
            })}
            disabled={submitting}
            placeholder="e.g., Tendai's Babywear"
          />
          {errors.shop_name && <p style={errStyle}>{errors.shop_name.message}</p>}
          <small style={helperStyle}>{shopNameValue.length}/60 characters</small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Location *</label>
          <input
            type="text"
            style={errors.location ? { ...inputStyle, borderColor: T.errorBorder } : inputStyle}
            {...register('location', {
              required: 'Location is required',
              minLength: { value: 2, message: 'At least 2 characters' },
              maxLength: { value: 100, message: 'Max 100 characters' },
            })}
            disabled={submitting}
            placeholder="e.g., Harare or Chegutu"
          />
          {errors.location && <p style={errStyle}>{errors.location.message}</p>}
          <small style={helperStyle}>{locationValue.length}/100 characters</small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Phone Number *</label>
          <input
            type="tel"
            style={errors.phone_number ? { ...inputStyle, borderColor: T.errorBorder } : inputStyle}
            {...register('phone_number', { required: 'Phone number is required', validate: validatePhone })}
            disabled={submitting}
            placeholder="e.g., 0712345678 or 263712345678"
          />
          {errors.phone_number && <p style={errStyle}>{errors.phone_number.message}</p>}
          <small style={helperStyle}>Buyers will contact you via WhatsApp on this number</small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Near Location (optional)</label>
          <input
            type="text"
            style={inputStyle}
            {...register('shop_bio', { maxLength: { value: 120, message: 'Max 120 characters' } })}
            disabled={submitting}
            placeholder="e.g., Handpicked babywear trusted by 200+ mums"
          />
          {errors.shop_bio && <p style={errStyle}>{errors.shop_bio.message}</p>}
          <small style={helperStyle}>{bioValue.length}/120 characters</small>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%', padding: '16px',
            background: submitting ? '#cbd5e1' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: submitting ? '#64748b' : 'white',
            border: 'none', borderRadius: '12px', fontSize: '17px',
            fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', marginTop: '12px',
            boxShadow: submitting ? 'none' : '0 4px 15px rgba(16,185,129,0.3)',
          }}
        >
          {submitting ? 'Saving…' : 'Continue to My Shop →'}
        </button>
      </form>
    </div>
  );
};

export default SellerProfileSetup;
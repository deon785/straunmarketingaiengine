import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from './lib/supabase';
import DOMPurify from 'dompurify';
import ReactGA from 'react-ga4';
import ImageUploader from './ImageUploader';

const T = {
  text: '#0f172a', textMuted: '#52607a', textLight: '#8291a9',
  cardBg: '#ffffff', cardBorder: '#e5e7eb',
  softBg: '#f7f8fa', softBorder: '#eaeef2',
  inputBorder: '#d1d5db', errorText: '#dc2626', errorBorder: '#f87171',
  radius: '12px', primary: '#4361ee', secondary: '#7209b7',
};

const fetchWithRetry = async (fn, n = 3) => {
  let last;
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) { last = e; await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000)); }
  }
  throw last;
};

const ProductForm = ({ user, profile, product = null, onSaved, onCancel }) => {
  const isEdit = Boolean(product?.id);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [imageUrl, setImageUrl] = useState(product?.image_url || '');

  // Pre-fill with profile data if it exists, otherwise start empty.
  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm({
    defaultValues: {
      name: product?.name || '',
      price: product?.price != null ? String(product.price) : '',
      description: product?.description || '',
      location: profile?.location || '', 
      phone_number: profile?.phone_number || '',
    },
  });

  // Re-sync if the product or profile changes (e.g. if profile loaded late)
  useEffect(() => {
    reset({
      name: product?.name || '',
      price: product?.price != null ? String(product.price) : '',
      description: product?.description || '',
      location: profile?.location || '',
      phone_number: profile?.phone_number || '',
    });
    setImageUrl(product?.image_url || '');
  }, [product, profile, reset]);

  const nameValue = watch('name', '');
  const descriptionValue = watch('description', '');
  const locationValue = watch('location', '');
  const phoneValue = watch('phone_number', '');

  const handleDeletePhoto = useCallback(async () => {
    if (!imageUrl) return;
    if (imageUrl.includes('supabase.co/storage')) {
      const fileName = imageUrl.split('/').pop();
      await supabase.storage.from('product-images').remove([fileName]);
    }
    setImageUrl('');
  }, [imageUrl]);

  const onSubmit = useCallback(async (data) => {
    if (!navigator.onLine) { setError('You are offline.'); return; }
    if (!imageUrl) { setError('Product image is required.'); return; }
    if (!user?.id) { setError('Please sign in.'); return; }

    setSubmitting(true);
    setError(null);

    try {
      const finalLocation = data.location.trim();
      const finalPhone = data.phone_number.trim();

      // 1. Update the profile table if the data was missing or changed
      if (
        finalLocation !== profile?.location || 
        finalPhone !== profile?.phone_number
      ) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({ location: finalLocation, phone_number: finalPhone })
          .eq('user_id', user.id);
          
        if (profileErr) throw new Error("Failed to update profile details. Please try again.");
      }

      // 2. Prepare product data
      const payload = {
        name: data.name.trim().substring(0, 200),
        price: data.price ? parseFloat(data.price) : null,
        description: DOMPurify.sanitize(data.description.trim(), {
          ALLOWED_TAGS: [], ALLOWED_ATTR: [], KEEP_CONTENT: true,
        }).substring(0, 1000),
        location: finalLocation,
        stock: parseInt(data.stock) || 0,
        phone_number: finalPhone,
        image_url: imageUrl,
      };

      // 3. Save product
      if (isEdit) {
        const { data: updated, error: upErr } = await fetchWithRetry(() =>
          supabase.from('products').update(payload).eq('id', product.id).select().single()
        );
        if (upErr) throw upErr;
        ReactGA.event({ category: 'Seller', action: 'Product_Updated' });
        onSaved?.(updated);
      } else {
        const { data: inserted, error: insErr } = await fetchWithRetry(() =>
          supabase.from('products').insert([{
            ...payload,
            seller_id: user.id,
            created_at: new Date().toISOString(),
            status: 'active',
          }]).select().single()
        );
        if (insErr) throw insErr;
        ReactGA.event({ category: 'Seller', action: 'Product_Created' });
        onSaved?.(inserted);
      }
    } catch (err) {
      console.error('Product save failed:', err);
      setError(err.message || 'Failed to save product.');
    } finally {
      setSubmitting(false);
    }
  }, [user, profile, imageUrl, isEdit, product, onSaved]);

  const inputStyle = {
    width: '100%', padding: '14px 16px',
    border: `2px solid ${T.inputBorder}`, borderRadius: T.radius,
    fontSize: '16px', background: T.cardBg, color: T.text,
    fontFamily: 'inherit', boxSizing: 'border-box',
    outline: 'none', transition: 'border-color 0.15s ease',
  };
  const textareaStyle = { ...inputStyle, minHeight: '120px', resize: 'vertical', lineHeight: 1.5 };
  const labelStyle = { display: 'block', fontSize: '15px', fontWeight: 600, marginBottom: '6px', color: T.text };
  const helperStyle = { fontSize: '12px', color: T.textLight, marginTop: '6px' };
  const errStyle = { color: T.errorText, fontSize: '13px', marginTop: '6px', fontWeight: 500 };

  return (
    <div style={{
      maxWidth: '640px', margin: '32px auto', padding: '32px',
      background: T.cardBg, border: `1px solid ${T.cardBorder}`,
      borderRadius: '16px', color: T.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 12px 30px -20px rgba(15,23,42,0.10)',
    }}>
      <button 
        onClick={onCancel} 
          disabled={submitting} 
          style={{
            background: 'linear-gradient(135deg, #d6336c, #7c3aed , #d6336c)',
            border: 'none',
            color: '#ffffff',
            padding: '9px 18px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'inherit',
            boxShadow: '0 4px 14px -6px rgba(214,51,108,0.5)',
            opacity: 0.9,
            transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px -6px rgba(214,51,108,0.7)';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 14px -6px rgba(214,51,108,0.5)';
        }}>
        ← Back to My Shop
      </button>

      <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px' }}>
        {isEdit ? 'Edit Product' : 'Add Single Item'}
      </h2>
      <p style={{ fontSize: '14px', color: T.textMuted, marginBottom: '24px' }}>
        {isEdit ? 'Update the details below.' : 'List one product in your shop.'}
      </p>

      {error && (
        <div style={{ padding: '14px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: '10px', marginBottom: '20px' }}>
          <strong style={{ color: T.errorText, fontSize: '14px' }}>Error:</strong>
          <p style={{ color: T.errorText, fontSize: '14px', marginTop: '4px', margin: 0 }}>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
        
        {/* --- CONTACT DETAILS SECTION --- */}
        <div style={{ padding: '16px', background: T.softBg, borderRadius: '12px', border: `1px solid ${T.softBorder}`, marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: T.text }}>Contact Details</h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ ...labelStyle, fontSize: '13px' }}>Location *</label>
            <input
              type="text"
              style={errors.location ? { ...inputStyle, borderColor: T.errorBorder } : inputStyle}
              {...register('location', { required: 'Location is required' })}
              placeholder="e.g., Shop 2 Eastgate, Harare"
              disabled={submitting}
            />
            {errors.location && <p style={errStyle}>{errors.location.message}</p>}
            <small style={helperStyle}>{locationValue.length}/100 characters</small>
          </div>

          <div>
            <label style={{ ...labelStyle, fontSize: '13px' }}>Phone Number *</label>
            <input
              type="tel"
              style={errors.phone_number ? { ...inputStyle, borderColor: T.errorBorder } : inputStyle}
              {...register('phone_number', { required: 'Phone number is required' })}
              placeholder="e.g., 0712345678"
              disabled={submitting}
            />
            {errors.phone_number && <p style={errStyle}>{errors.phone_number.message}</p>}
            <small style={helperStyle}>Buyers will contact you on WhatsApp</small>
          </div>
        </div>
        {/* ------------------------------- */}

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Product Name *</label>
          <input
            type="text"
            style={errors.name ? { ...inputStyle, borderColor: T.errorBorder } : inputStyle}
            {...register('name', {
              required: 'Product name is required',
              minLength: { value: 3, message: 'At least 3 characters' },
              maxLength: { value: 100, message: 'Max 100 characters' },
            })}
            disabled={submitting}
            placeholder="e.g., Baby Feeder Bottle"
          />
          {errors.name && <p style={errStyle}>{errors.name.message}</p>}
          <small style={helperStyle}>{nameValue.length}/100 characters</small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Price ($) *</label>
          <input
            type="text"
            style={errors.price ? { ...inputStyle, borderColor: T.errorBorder } : inputStyle}
            {...register('price', {
              required: 'Price is required',
              validate: {
                valid: (v) => {
                  const n = parseFloat(v);
                  if (isNaN(n)) return 'Enter a valid number';
                  if (n <= 0) return 'Must be greater than 0';
                  if (n > 999999.99) return 'Price too high';
                  return true;
                },
              },
            })}
            disabled={submitting}
            placeholder="e.g., 49.99"
          />
          {errors.price && <p style={errStyle}>{errors.price.message}</p>}
          <small style={helperStyle}>USD · Max 999999.99</small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Stock Available *</label>
          <input
            type="number"
            style={errors.stock ? { ...inputStyle, borderColor: T.errorBorder } : inputStyle}
            {...register('stock', {
              required: 'Stock is required',
              min: { value: 0, message: 'Cannot be negative' },
            })}
            disabled={submitting}
            placeholder="e.g., 10"
          />
          {errors.stock && <p style={errStyle}>{errors.stock.message}</p>}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Product Description *</label>
          <textarea
            style={errors.description ? { ...textareaStyle, borderColor: T.errorBorder } : textareaStyle}
            {...register('description', {
              required: 'Description is required',
              minLength: { value: 10, message: 'At least 10 characters' },
              maxLength: { value: 1000, message: 'Max 1000 characters' },
            })}
            disabled={submitting}
            placeholder="Describe features, condition, brand…"
          />
          {errors.description && <p style={errStyle}>{errors.description.message}</p>}
          <small style={helperStyle}>{descriptionValue.length}/1000 · Min 10 · HTML stripped</small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Product Image *</label>
          <div style={{ background: '#fafbfc', border: '2px dashed #cbd5e1', borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
            <ImageUploader
              key={imageUrl || 'empty'}
              onUploadSuccess={(url) => setImageUrl(url)}
              onUploadError={(err) => setError(err)}
            />
            {imageUrl && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={imageUrl} alt="Preview" style={{ width: 128, height: 128, borderRadius: 12, objectFit: 'cover', border: `2px solid ${T.cardBorder}` }} />
                  <button
                    type="button"
                    onClick={handleDeletePhoto}
                    style={{ position: 'absolute', top: -10, right: -10, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
                  >✕</button>
                </div>
                <p style={{ color: '#1e40af', fontSize: '13px', marginTop: '10px', fontWeight: 600 }}>✓ Image uploaded</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{ flex: 1, padding: '16px', background: T.softBg, color: T.textMuted, border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !imageUrl}
            style={{
              flex: 1, padding: '16px',
              background: (submitting || !imageUrl) ? '#cbd5e1' : `linear-gradient(135deg, ${T.primary} 0%, ${T.secondary} 100%)`,
              color: (submitting || !imageUrl) ? '#64748b' : 'white',
              border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 700,
              cursor: (submitting || !imageUrl) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: (submitting || !imageUrl) ? 'none' : '0 4px 15px rgba(67, 97, 238, 0.3)',
            }}
          >
            {submitting ? 'Saving…' : !imageUrl ? 'Upload image to save' : isEdit ? 'Save Changes' : 'Save Product'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductForm;
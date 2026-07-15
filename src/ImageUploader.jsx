import React, { useState, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase';
import imageCompression from 'browser-image-compression';

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

const ImageUploader = ({ onUploadSuccess, onUploadError }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const progressIntervalRef = useRef(null);
  const MAX_RETRIES = 2;

  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    clearProgressInterval();
    setUploading(false);
    setUploadProgress(0);
    setRetryCount(0);
  }, [clearProgressInterval]);

  const handleUpload = async (event) => {
    if (!navigator.onLine) {
      const msg = 'You are offline. Please connect to the internet to upload images.';
      setError(msg);
      if (onUploadError) onUploadError(msg);
      else alert(msg);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    clearProgressInterval();
    
    try {
      const imageFile = event.target.files[0];
      if (!imageFile) {
        setUploading(false);
        return;
      }

      // ✅ Validate file size (max 20MB before compression)
      if (imageFile.size > 20 * 1024 * 1024) {
        throw new Error('Image too large. Please select an image under 20MB.');
      }

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/heic', 'image/heif'];
      if (!validTypes.includes(imageFile.type) && !imageFile.type.startsWith('image/')) {
        throw new Error('Please upload a valid image (JPEG, PNG, or WebP)');
      }

      console.log('📸 Original size:', (imageFile.size / 1024 / 1024).toFixed(2), 'MB');

      // ✅ UPDATED: Better compression options for large images
      const options = {
        maxSizeMB: 0.8,           // Target 800KB (was 0.2)
        maxWidthOrHeight: 1024,   // 1024px (was 600)
        useWebWorker: true,
        initialQuality: 0.8,      // 80% quality (was 0.75)
        fileType: 'image/jpeg',
        // ✅ Progressive compression if first attempt fails
        alwaysKeepResolution: false,
        onProgress: (progress) => {
          console.log(`Compression: ${progress}%`);
        }
      };

      // ✅ Try compression with fallback
      let compressedFile;
      try {
        compressedFile = await imageCompression(imageFile, options);
      } catch (compressError) {
        console.warn('⚠️ Primary compression failed, trying fallback...');
        // ✅ Fallback: Less aggressive compression
        const fallbackOptions = {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 800,
          useWebWorker: true,
          initialQuality: 0.7,
          fileType: 'image/jpeg',
        };
        compressedFile = await imageCompression(imageFile, fallbackOptions);
      }
      
      console.log('✅ Compressed size:', (compressedFile.size / 1024).toFixed(2), 'KB');

      // ✅ If still too large, compress more aggressively
      if (compressedFile.size > 300 * 1024) {
        console.log('⚠️ Still large, re-compressing...');
        const recompressOptions = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 600,
          useWebWorker: true,
          initialQuality: 0.6,
          fileType: 'image/jpeg',
        };
        compressedFile = await imageCompression(compressedFile, recompressOptions);
        console.log('✅ Re-compressed size:', (compressedFile.size / 1024).toFixed(2), 'KB');
      }

      // Generate unique filename
      const fileExt = 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = fileName;

      // Start progress interval
      progressIntervalRef.current = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // Upload with retry
      const { error: uploadError } = await fetchWithRetry(() => 
        supabase.storage
          .from('product-images')
          .upload(filePath, compressedFile, {
            cacheControl: '31536000',
            upsert: false,
            contentType: 'image/jpeg'
          })
      );

      clearProgressInterval();

      if (uploadError) {
        if (retryCount < MAX_RETRIES) {
          setRetryCount(prev => prev + 1);
          setError(`Upload failed. Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
          setTimeout(() => {
            const input = document.getElementById('image-upload-input');
            if (input) input.value = '';
            handleUpload(event);
          }, 2000);
          return;
        }
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setUploadProgress(100);
      setRetryCount(0);
      
      if (onUploadSuccess) {
        onUploadSuccess(data.publicUrl);
      }
      
      setTimeout(() => setUploadProgress(0), 1500);

    } catch (error) {
      console.error('❌ Upload error:', error);
      const errorMessage = error.message || 'Error uploading image';
      setError(errorMessage);
      if (onUploadError) {
        onUploadError(errorMessage);
      } else {
        alert('Error uploading image: ' + errorMessage);
      }
      setUploadProgress(0);
    } finally {
      setUploading(false);
      clearProgressInterval();
    }
  };

  React.useEffect(() => {
    return () => {
      clearProgressInterval();
      resetState();
    };
  }, [clearProgressInterval, resetState]);

  return (
    <div style={{ 
      width: '100%',
      height: '120px',
      position: 'relative',
      marginBottom: '15px'
    }}>
      <input
        id="image-upload-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={handleUpload}
        disabled={uploading}
        style={{ display: 'none' }}
      />
      
      <div
        style={{
          width: '100%',
          height: '100%',
          border: `2px dashed ${error ? '#EF4444' : '#4F46E5'}`,
          borderRadius: '8px',
          backgroundColor: error ? 'rgba(239, 68, 68, 0.05)' : 'rgba(79, 70, 229, 0.05)',
          cursor: uploading ? 'wait' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '12px',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
          opacity: uploading ? 0.7 : 1
        }}
        onClick={() => !uploading && document.getElementById('image-upload-input').click()}
        onDragOver={(e) => {
          if (uploading) return;
          e.preventDefault();
          e.currentTarget.style.borderColor = '#10B981';
          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.borderColor = error ? '#EF4444' : '#4F46E5';
          e.currentTarget.style.backgroundColor = error ? 'rgba(239, 68, 68, 0.05)' : 'rgba(79, 70, 229, 0.05)';
        }}
        onDrop={(e) => {
          if (uploading) return;
          e.preventDefault();
          const files = e.dataTransfer.files;
          if (files.length > 0) {
            const event = { target: { files } };
            handleUpload(event);
          }
        }}
      >
        {error && (
          <div style={{
            position: 'absolute',
            top: '5px',
            left: '5px',
            right: '5px',
            background: '#EF4444',
            color: 'white',
            fontSize: '10px',
            padding: '4px 8px',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}
        
        <div style={{ 
          fontSize: '28px', 
          marginBottom: '6px',
          color: error ? '#EF4444' : (uploading ? '#10B981' : '#9CA3AF')
        }}>
          {uploading ? '⏳' : '📷'}
        </div>
        
        {uploading ? (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <p style={{ 
              color: '#10B981', 
              fontSize: '12px',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              {retryCount > 0 ? `Retrying (${retryCount}/${MAX_RETRIES})...` : 'Compressing & Uploading...'}
            </p>
            {uploadProgress > 0 && (
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#374151',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  backgroundColor: '#10B981',
                  transition: 'width 0.3s ease'
                }}></div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', maxWidth: '90%' }}>
            <p style={{ 
              color: '#D1D5DB', 
              fontSize: '12px',
              marginBottom: '4px',
              fontWeight: '500',
              lineHeight: '1.2'
            }}>
              Click or Drag Image
            </p>
            <p style={{ 
              color: '#9CA3AF', 
              fontSize: '10px',
              lineHeight: '1.2'
            }}>
              JPEG, PNG, WebP • Up to 20MB
            </p>
          </div>
        )}
        
        <div style={{
          position: 'absolute',
          bottom: '6px',
          left: '0',
          right: '0',
          textAlign: 'center'
        }}>
          <span style={{
            fontSize: '9px',
            color: error ? '#EF4444' : '#6B7280',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            Compressed to ~800KB • 1024px
          </span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ImageUploader);
import React, { useState, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase';
import imageCompression from 'browser-image-compression';

// ✅ Add fetchWithRetry helper
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

  // ✅ Clean up interval
  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // ✅ Reset state on mount
  const resetState = useCallback(() => {
    clearProgressInterval();
    setUploading(false);
    setUploadProgress(0);
    setRetryCount(0);
  }, [clearProgressInterval]);

  const handleUpload = async (event) => {
    // ✅ Check offline status
    if (!navigator.onLine) {
      const msg = 'You are offline. Please connect to the internet to upload images.';
      setError(msg);
      if (onUploadError) onUploadError(msg);
      else alert(msg);
      return;
    }

    // ✅ Clear previous state
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

      // Validate file size (max 10MB before compression)
      if (imageFile.size > 10 * 1024 * 1024) {
        throw new Error('Image too large. Please select an image under 10MB.');
      }

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!validTypes.includes(imageFile.type)) {
        throw new Error('Please upload a valid image (JPEG, PNG, or WebP)');
      }

      console.log('Original size:', (imageFile.size / 1024 / 1024).toFixed(2), 'MB');
      
      // Compression options
      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 600,
        useWebWorker: true,
        initialQuality: 0.75,
        fileType: 'image/jpeg',
      };

      const compressedFile = await imageCompression(imageFile, options);
      
      console.log('Compressed size:', (compressedFile.size / 1024).toFixed(2), 'KB');

      // ✅ Check compressed size
      if (compressedFile.size > 200 * 1024) {
        console.warn('Compressed file still large:', (compressedFile.size / 1024).toFixed(2), 'KB');
      }

      // Generate unique filename
      const fileExt = 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = fileName;

      // ✅ Start progress interval
      progressIntervalRef.current = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // ✅ Use fetchWithRetry for upload
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
        // ✅ Retry logic
        if (retryCount < MAX_RETRIES) {
          setRetryCount(prev => prev + 1);
          setError(`Upload failed. Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
          // Retry after 2 seconds
          setTimeout(() => {
            // Reset file input to allow retry
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
      
      // Notify parent component
      if (onUploadSuccess) {
        onUploadSuccess(data.publicUrl);
      }
      
      // Clear progress after delay
      setTimeout(() => setUploadProgress(0), 1500);

    } catch (error) {
      console.error('Upload error:', error);
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

  // ✅ Reset state on unmount
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
      {/* Hidden file input */}
      <input
        id="image-upload-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={handleUpload}
        disabled={uploading}
        style={{ 
          display: 'none'
        }}
      />
      
      {/* Upload Container */}
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
        {/* Error Message */}
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
        
        {/* Upload Icon */}
        <div style={{ 
          fontSize: '28px', 
          marginBottom: '6px',
          color: error ? '#EF4444' : (uploading ? '#10B981' : '#9CA3AF')
        }}>
          {uploading ? '⏳' : '📷'}
        </div>
        
        {uploading ? (
          <div style={{ 
            width: '100%',
            textAlign: 'center'
          }}>
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
          <div style={{ 
            textAlign: 'center',
            maxWidth: '90%'
          }}>
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
              JPEG, PNG, WebP
            </p>
          </div>
        )}
        
        {/* Bottom label */}
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
            Max 200KB • Auto-compressed
          </span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ImageUploader);
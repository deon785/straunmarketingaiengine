import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import imageCompression from 'browser-image-compression';

const ImageUploader = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleUpload = async (event) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      
      const imageFile = event.target.files[0];
      if (!imageFile) return;

      // --- COMPRESSION LOGIC ---
      const options = {
        maxSizeMB: 0.4,           // Reduced from 0.5MB to 300KB
        maxWidthOrHeight: 800,    // Reduced from 1024px to 800px
        useWebWorker: true,
        initialQuality: 0.8,      // 80% quality
      };

      console.log('Original size:', (imageFile.size / 1024 / 1024).toFixed(2), 'MB');
      
      const compressedFile = await imageCompression(imageFile, options);
      
      console.log('Compressed size:', (compressedFile.size / 1024).toFixed(2), 'KB');

      const fileExt = 'jpg'; // Force JPEG for better compression
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = fileName;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get the Public URL
      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      onUploadSuccess(data.publicUrl);
      setUploadProgress(100);
      
      setTimeout(() => setUploadProgress(0), 1000);

    } catch (error) {
      alert('Error uploading image: ' + error.message);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ 
      marginBottom: '15px',
      padding: '0',
      width: '100%'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <label style={{ 
          color: 'white', 
          fontSize: '14px',
          fontWeight: '600'
        }}>
          📷 Product Image *
        </label>
        <span style={{
          fontSize: '12px',
          color: '#9CA3AF'
        }}>
          Required
        </span>
      </div>
      
      <div style={{
        position: 'relative',
        border: '2px dashed #4F46E5',
        borderRadius: '10px',
        padding: '15px',
        textAlign: 'center',
        backgroundColor: 'rgba(79, 70, 229, 0.05)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        minHeight: '100px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}
      onClick={() => document.getElementById('image-upload-input').click()}
      onDragOver={(e) => {
        e.preventDefault();
        e.currentTarget.style.borderColor = '#10B981';
        e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      }}
      onDragLeave={(e) => {
        e.currentTarget.style.borderColor = '#4F46E5';
        e.currentTarget.style.backgroundColor = 'rgba(79, 70, 229, 0.05)';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          const event = { target: { files } };
          handleUpload(event);
        }
      }}
      >
        <input
          id="image-upload-input"
          type="file"
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading}
          style={{ 
            display: 'none',
            width: '0',
            height: '0',
            opacity: '0',
            position: 'absolute'
          }}
        />
        
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>
          {uploading ? '⏳' : '📷'}
        </div>
        
        {uploading ? (
          <div style={{ width: '100%' }}>
            <p style={{ color: '#25D366', fontSize: '14px', marginBottom: '8px' }}>
              Compressing & Uploading...
            </p>
            {uploadProgress > 0 && (
              <div style={{
                width: '100%',
                height: '6px',
                backgroundColor: '#374151',
                borderRadius: '3px',
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
          <>
            <p style={{ 
              color: '#D1D5DB', 
              fontSize: '14px',
              marginBottom: '4px',
              fontWeight: '500'
            }}>
              Click to upload or drag & drop
            </p>
            <p style={{ 
              color: '#9CA3AF', 
              fontSize: '12px',
              lineHeight: '1.3'
            }}>
              JPG, PNG, WebP • Max 5MB • Auto-compressed to 300KB
            </p>
          </>
        )}
      </div>
      
      {uploading && (
        <p style={{ 
          color: '#9CA3AF', 
          fontSize: '11px',
          marginTop: '6px',
          textAlign: 'center'
        }}>
          Optimizing for fast loading...
        </p>
      )}
    </div>
  );
};

export default ImageUploader;
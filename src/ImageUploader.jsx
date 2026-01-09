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
        maxSizeMB: 0.4,
        maxWidthOrHeight: 800,
        useWebWorker: true,
        initialQuality: 0.8,
      };

      console.log('Original size:', (imageFile.size / 1024 / 1024).toFixed(2), 'MB');
      
      const compressedFile = await imageCompression(imageFile, options);
      
      console.log('Compressed size:', (compressedFile.size / 1024).toFixed(2), 'KB');

      const fileExt = 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

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
      width: '100%',
      height: '120px', // FIXED HEIGHT
      position: 'relative',
      marginBottom: '15px'
    }}>
      {/* Hidden file input */}
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
      
      {/* Upload Container */}
      <div
        style={{
          width: '100%',
          height: '100%',
          border: '2px dashed #4F46E5',
          borderRadius: '8px',
          backgroundColor: 'rgba(79, 70, 229, 0.05)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '12px',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.2s ease'
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
        {/* Upload Icon */}
        <div style={{ 
          fontSize: '24px', 
          marginBottom: '6px',
          color: uploading ? '#10B981' : '#9CA3AF'
        }}>
          {uploading ? '⏳' : '📷'}
        </div>
        
        {uploading ? (
          <div style={{ 
            width: '100%',
            textAlign: 'center'
          }}>
            <p style={{ 
              color: '#25D366', 
              fontSize: '13px',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              Uploading...
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
              fontSize: '13px',
              marginBottom: '4px',
              fontWeight: '500',
              lineHeight: '1.2'
            }}>
              Upload Image
            </p>
            <p style={{ 
              color: '#9CA3AF', 
              fontSize: '11px',
              lineHeight: '1.2'
            }}>
              Click or drag & drop
            </p>
          </div>
        )}
        
        {/* Bottom label */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '0',
          right: '0',
          textAlign: 'center'
        }}>
          <span style={{
            fontSize: '10px',
            color: '#6B7280',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            Max 5MB • Auto-compressed
          </span>
        </div>
      </div>
    </div>
  );
};

export default ImageUploader;
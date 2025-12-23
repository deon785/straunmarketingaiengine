import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import imageCompression from 'browser-image-compression';

const ImageUploader = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (event) => {
    try {
      setUploading(true);
      const imageFile = event.target.files[0];

      if (!imageFile) return;

      // --- COMPRESSION LOGIC START ---
      const options = {
        maxSizeMB: 0.5,          // Max size 500KB (Great for mobile)
        maxWidthOrHeight: 1024, // High enough for clear product shots
        useWebWorker: true,
      };

      console.log('Original size:', imageFile.size / 1024 / 1024, 'MB');
      
      const compressedFile = await imageCompression(imageFile, options);
      
      console.log('Compressed size:', compressedFile.size / 1024 / 1024, 'MB');

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`; // Unique name
      const filePath = `${fileName}`;

        // 1. Upload to Supabase Storage
      let { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      // 2. Get the Public URL
      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      // 3. Pass this URL back to your main form
      onUploadSuccess(data.publicUrl);
      alert("Image uploaded successfully!");

    } catch (error) {
      alert('Error uploading image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ color: 'white', display: 'block', marginBottom: '10px' }}>
        Product Image
      </label>
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
        style={{ color: 'white' }}
      />
      {uploading && <p style={{ color: '#25D366' }}>⚡ Compressing & Uploading...</p>}
    </div>
  );
};

export default ImageUploader;
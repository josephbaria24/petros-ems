"use client";
import React, { useState } from 'react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string>('');

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('Please select a file');

    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (res.ok) {
      setUrl(data.url);
    } else {
      alert(data.error || 'Upload failed');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Upload trainee image</h2>
      <form onSubmit={handleUpload}>
        <input
          type="file"
          name="image"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button type="submit">Upload</button>
      </form>

      {url && (
        <div>
          <p>✅ Uploaded successfully:</p>
          <a href={url} target="_blank" rel="noopener noreferrer">
            {url}
          </a>
          <br />
          <img src={url} alt="Uploaded trainee" width="200" />
        </div>
      )}
    </div>
  );
}

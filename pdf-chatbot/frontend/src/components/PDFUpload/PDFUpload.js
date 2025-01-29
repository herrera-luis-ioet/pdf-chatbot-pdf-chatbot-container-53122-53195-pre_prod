import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './PDFUpload.css';

// PUBLIC_INTERFACE
const PDFUpload = ({ onUploadSuccess }) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    
    // Validate file type
    if (!file.type.includes('pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size should not exceed 10MB');
      return;
    }

    setError('');
    setUploadStatus('uploading');
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(progress);
        },
      });

      setUploadStatus('success');
      setError('');
      
      if (onUploadSuccess && response.data?.pdf_id) {
        onUploadSuccess(response.data.pdf_id);
      }
    } catch (err) {
      setUploadStatus('error');
      setError(err.response?.data?.message || 'Error uploading file');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  return (
    <div className="pdf-upload-container">
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''} ${
          uploadStatus === 'error' ? 'error' : ''
        }`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop the PDF file here...</p>
        ) : (
          <p>Drag and drop a PDF file here, or click to select a file</p>
        )}
      </div>

      {uploadStatus === 'uploading' && (
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <p>{uploadProgress}% uploaded</p>
        </div>
      )}

      {uploadStatus === 'success' && (
        <div className="success-message">
          <p>File uploaded successfully!</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default PDFUpload;

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import PDFUpload from '../PDFUpload';

// Mock axios
jest.mock('axios');

// Mock react-dropzone
jest.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    isDragActive: false,
  }),
}));

describe('PDFUpload Component', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
  });

  it('renders upload area with correct text', () => {
    render(<PDFUpload />);
    expect(screen.getByText(/Drag and drop a PDF file here, or click to select a file/i)).toBeInTheDocument();
  });

  it('validates PDF file type', async () => {
    render(<PDFUpload />);
    const file = new File(['dummy content'], 'test.txt', { type: 'text/plain' });
    
    const dropzone = screen.getByText(/Drag and drop a PDF file here/i);
    await fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(await screen.findByText(/Please upload a PDF file/i)).toBeInTheDocument();
  });

  it('validates file size', async () => {
    render(<PDFUpload />);
    // Create a file larger than 10MB
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
    
    const dropzone = screen.getByText(/Drag and drop a PDF file here/i);
    await fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [largeFile],
      },
    });

    expect(await screen.findByText(/File size should not exceed 10MB/i)).toBeInTheDocument();
  });

  it('shows progress during upload', async () => {
    // Mock successful upload with progress
    axios.post.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ data: { message: 'Success' } });
        }, 100);
      });
    });

    render(<PDFUpload />);
    const file = new File(['dummy pdf content'], 'test.pdf', { type: 'application/pdf' });
    
    const dropzone = screen.getByText(/Drag and drop a PDF file here/i);
    await fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    // Check if progress bar is shown
    expect(await screen.findByText(/uploaded/i)).toBeInTheDocument();
  });

  it('handles successful upload', async () => {
    axios.post.mockResolvedValueOnce({ data: { message: 'Success' } });

    render(<PDFUpload />);
    const file = new File(['dummy pdf content'], 'test.pdf', { type: 'application/pdf' });
    
    const dropzone = screen.getByText(/Drag and drop a PDF file here/i);
    await fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(await screen.findByText(/File uploaded successfully!/i)).toBeInTheDocument();
  });

  it('handles upload error', async () => {
    const errorMessage = 'Server error';
    axios.post.mockRejectedValueOnce({ 
      response: { 
        data: { message: errorMessage } 
      } 
    });

    render(<PDFUpload />);
    const file = new File(['dummy pdf content'], 'test.pdf', { type: 'application/pdf' });
    
    const dropzone = screen.getByText(/Drag and drop a PDF file here/i);
    await fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(await screen.findByText(errorMessage)).toBeInTheDocument();
  });
});
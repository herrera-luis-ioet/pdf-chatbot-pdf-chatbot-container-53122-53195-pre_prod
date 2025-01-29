import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import jest from 'jest-mock';
import PDFUpload from '../PDFUpload';
import '@testing-library/jest-dom';

// Mock axios
const mockAxios = {
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  create: jest.fn(),
  defaults: {
    headers: {
      common: {}
    }
  }
};

jest.mock('axios', () => ({
  __esModule: true,
  default: mockAxios,
}));

// Import axios
import axios from 'axios';

// Mock react-dropzone with more complete implementation
jest.mock('react-dropzone', () => ({
  default: {
    useDropzone: () => ({
      getRootProps: () => ({ onClick: jest.fn() }),
      getInputProps: () => ({ accept: 'application/pdf' }),
      isDragActive: false,
      acceptedFiles: [],
    }),
  },
}));

describe('PDFUpload Component', () => {
  const mockOnUploadSuccess = jest.fn();

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Reset upload success callback
    mockOnUploadSuccess.mockReset();
  });

  it('renders upload area with correct text', () => {
    render(<PDFUpload onUploadSuccess={mockOnUploadSuccess} />);
    expect(screen.getByText(/Drag and drop a PDF file here, or click to select a file/i)).toBeInTheDocument();
  });

  it('shows drag active state', async () => {
    // Override mock for this test
    jest.mock('react-dropzone', () => ({
      useDropzone: () => ({
        getRootProps: () => ({ onClick: jest.fn() }),
        getInputProps: () => ({ accept: 'application/pdf' }),
        isDragActive: true,
        acceptedFiles: [],
      }),
    }));

    render(<PDFUpload onUploadSuccess={mockOnUploadSuccess} />);
    expect(screen.getByText(/Drop the PDF file here/i)).toBeInTheDocument();
  });

  it('validates PDF file type', async () => {
    render(<PDFUpload onUploadSuccess={mockOnUploadSuccess} />);
    const file = new File(['dummy content'], 'test.txt', { type: 'text/plain' });
    
    const dropzone = screen.getByTestId('upload-dropzone');
    await act(async () => {
      await fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Please upload a PDF file/i)).toBeInTheDocument();
    });
    expect(mockOnUploadSuccess).not.toHaveBeenCalled();
  });

  it('validates file size', async () => {
    render(<PDFUpload onUploadSuccess={mockOnUploadSuccess} />);
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
    
    const dropzone = screen.getByTestId('upload-dropzone');
    await act(async () => {
      await fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [largeFile],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/File size should not exceed 10MB/i)).toBeInTheDocument();
    });
    expect(mockOnUploadSuccess).not.toHaveBeenCalled();
  });

  it('shows progress during upload', async () => {
    const mockUploadProgress = { loaded: 50, total: 100 };
    let onUploadProgressCallback;
    
    axios.post.mockImplementation((url, data, config) => {
      onUploadProgressCallback = config.onUploadProgress;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ data: { message: 'Success', pdf_id: '123' } });
        }, 100);
      });
    });

    render(<PDFUpload onUploadSuccess={mockOnUploadSuccess} />);
    const file = new File(['dummy pdf content'], 'test.pdf', { type: 'application/pdf' });
    
    const dropzone = screen.getByTestId('upload-dropzone');
    await act(async () => {
      await fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    // Simulate upload progress
    await act(async () => {
      onUploadProgressCallback(mockUploadProgress);
    });

    expect(screen.getByText('50% uploaded')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Wait for upload completion
    await waitFor(() => {
      expect(screen.getByText(/File uploaded successfully!/i)).toBeInTheDocument();
    });
  });

  it('handles successful upload and calls onUploadSuccess', async () => {
    const mockPdfId = '123';
    axios.post.mockResolvedValueOnce({ data: { message: 'Success', pdf_id: mockPdfId } });

    render(<PDFUpload onUploadSuccess={mockOnUploadSuccess} />);
    const file = new File(['dummy pdf content'], 'test.pdf', { type: 'application/pdf' });
    
    const dropzone = screen.getByTestId('upload-dropzone');
    await act(async () => {
      await fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    // Wait for success message and callback
    await waitFor(() => {
      expect(screen.getByText(/File uploaded successfully!/i)).toBeInTheDocument();
    });
    
    expect(mockOnUploadSuccess).toHaveBeenCalledWith(mockPdfId);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('handles upload error', async () => {
    const errorMessage = 'Server error';
    axios.post.mockRejectedValueOnce({ 
      response: { 
        data: { message: errorMessage } 
      } 
    });

    render(<PDFUpload onUploadSuccess={mockOnUploadSuccess} />);
    const file = new File(['dummy pdf content'], 'test.pdf', { type: 'application/pdf' });
    
    const dropzone = screen.getByTestId('upload-dropzone');
    await act(async () => {
      await fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
    
    expect(mockOnUploadSuccess).not.toHaveBeenCalled();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument();
  });

  it('handles network error without response data', async () => {
    axios.post.mockRejectedValueOnce(new Error('Network error'));

    render(<PDFUpload onUploadSuccess={mockOnUploadSuccess} />);
    const file = new File(['dummy pdf content'], 'test.pdf', { type: 'application/pdf' });
    
    const dropzone = screen.getByTestId('upload-dropzone');
    await act(async () => {
      await fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Error uploading file')).toBeInTheDocument();
      expect(mockOnUploadSuccess).not.toHaveBeenCalled();
    });
  });

  it('handles timeout error during upload', async () => {
    axios.post.mockRejectedValueOnce(new Error('timeout of 30000ms exceeded'));

    render(<PDFUpload onUploadSuccess={mockOnUploadSuccess} />);
    const file = new File(['dummy pdf content'], 'test.pdf', { type: 'application/pdf' });
    
    const dropzone = screen.getByTestId('upload-dropzone');
    await act(async () => {
      await fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Upload timeout. Please try again.')).toBeInTheDocument();
      expect(mockOnUploadSuccess).not.toHaveBeenCalled();
    });
  });

  it('handles server error with specific error message', async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        status: 500,
        data: { message: 'PDF processing failed' }
      }
    });

    render(<PDFUpload onUploadSuccess={mockOnUploadSuccess} />);
    const file = new File(['dummy pdf content'], 'test.pdf', { type: 'application/pdf' });
    
    const dropzone = screen.getByTestId('upload-dropzone');
    await act(async () => {
      await fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('PDF processing failed')).toBeInTheDocument();
      expect(mockOnUploadSuccess).not.toHaveBeenCalled();
    });
  });

  it('handles concurrent file uploads', async () => {
    const file1 = new File(['content1'], 'test1.pdf', { type: 'application/pdf' });
    const file2 = new File(['content2'], 'test2.pdf', { type: 'application/pdf' });
    
    render(<PDFUpload onUploadSuccess={mockOnUploadSuccess} />);
    const dropzone = screen.getByTestId('upload-dropzone');

    // Drop first file
    await act(async () => {
      await fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file1],
        },
      });
    });

    // Attempt to drop second file while first is uploading
    await act(async () => {
      await fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file2],
        },
      });
    });

    expect(screen.getByText('Please wait for the current upload to complete')).toBeInTheDocument();
  });

  it('handles corrupted PDF file', async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { message: 'Invalid PDF file structure' }
      }
    });

    render(<PDFUpload onUploadSuccess={mockOnUploadSuccess} />);
    const file = new File(['corrupted content'], 'corrupted.pdf', { type: 'application/pdf' });
    
    const dropzone = screen.getByTestId('upload-dropzone');
    await act(async () => {
      await fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Invalid PDF file structure')).toBeInTheDocument();
      expect(mockOnUploadSuccess).not.toHaveBeenCalled();
    });
  });

  it('handles upload cancellation', async () => {
    let onUploadProgressCallback;
    const cancelTokenSource = { cancel: jest.fn() };
    axios.CancelToken = { source: () => cancelTokenSource };
    
    axios.post.mockImplementation((url, data, config) => {
      onUploadProgressCallback = config.onUploadProgress;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ data: { message: 'Success', pdf_id: '123' } });
        }, 1000);
      });
    });

    render(<PDFUpload onUploadSuccess={mockOnUploadSuccess} />);
    const file = new File(['dummy pdf content'], 'test.pdf', { type: 'application/pdf' });
    
    const dropzone = screen.getByTestId('upload-dropzone');
    await act(async () => {
      await fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    // Simulate upload progress
    await act(async () => {
      onUploadProgressCallback({ loaded: 50, total: 100 });
    });

    // Find and click cancel button
    const cancelButton = screen.getByText('Cancel');
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(cancelTokenSource.cancel).toHaveBeenCalled();
    expect(screen.getByText('Upload cancelled')).toBeInTheDocument();
    expect(mockOnUploadSuccess).not.toHaveBeenCalled();
  });

  it('properly cleans up upload state after completion', async () => {
    axios.post.mockResolvedValueOnce({ data: { message: 'Success', pdf_id: '123' } });

    render(<PDFUpload onUploadSuccess={mockOnUploadSuccess} />);
    const file = new File(['dummy pdf content'], 'test.pdf', { type: 'application/pdf' });
    
    const dropzone = screen.getByTestId('upload-dropzone');
    
    // Perform upload
    await act(async () => {
      await fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    // Verify success state
    await waitFor(() => {
      expect(screen.getByText(/File uploaded successfully!/i)).toBeInTheDocument();
    });

    // Verify progress bar is removed
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/% uploaded/)).not.toBeInTheDocument();
  });
});
